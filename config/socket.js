// TODO
// 0. Implement tie-breaker
// 1. DONE - admin dashboard, tournament settings should be populated from there.
// 2. Update player ratings after the tournament (glicko2)
// 3. Premoves
// 4. DB search and information retrieval (elastisearch)
// 5. [optional] First pairings should be created based on the player ratings (?).
// 6. [optional] TV feature
// 7. [doc] List how to reproduce scenarios for which special-case code has been implemented.

module.exports = function(server) {
    //var debug  = require('debug');
    var _      = require('lodash');
    var moment = require('moment');
    var io     = require('socket.io').listen(server);
    var Chess  = require('chess.js').Chess;

    var tournament_state       = "not_in_progress"; // in_progress
    var tournament_start_time  = Date.now();
    var tournament_end_time    = Date.now();
    var tournament_base_time   = 300000;           // Default (overwritten by start_tournament event)
    var tournament_increment   = 5000;             // Default (overwritten by start_tournament event)
    var tournament_timecontrol = "300+5";
    var tournament_clock;                          // Countdown timer that lasts till the end of the tournament
    var tournament_countdown_timer;                // Interval-counter that ticks every 1 second to show (the clients)
                                                   // how much time is still left for the tournament to close.
    //var tournament_pairing_clock;                // Pairs are generated periodically using this interval-timer

    var player_vs_socket       = {}; // 1:1 (other connections are discarded by throwing a warning)
    var socket_vs_player       = {}; // 1:1 reverse mapping of the above pairs
    var players_unpaired       = []; // Unsorted list
    var current_pairs          = {}; // Holds opponent handle and game-id against player's name for the ongoing games
    var chess_game_objs        = {}; // Holds chess.js objects agains a unique id number
    var finished_games_ids     = []; // Collection of finished chess.js object ids
    var player_performance     = {}; // Player performance/ranking data for leaderboard generation
    var player_vs_logout_timer = {}; // 1-minute countdown timer object stored against the player who was in a
                                     // game at the time of logout.
    var timing_data            = {}; // Holds game-timer info against game-ids.

    var GeneratePairings = function () {
        if (tournament_state === "not_in_progress")
            return;
        var players_unpaired_uniq = _.uniq(players_unpaired);
        players_unpaired          = players_unpaired_uniq;
         if (players_unpaired.length > 1) {
            //console.log("GP N = " + players_unpaired.length);     
            var points_vs_players  = {};
            for (var i = 0; i < players_unpaired.length; i++) {
                var playername            = players_unpaired[i];
                var points                = player_performance[playername].points;
                points_vs_players[points] = points_vs_players[points] || [];
                points_vs_players[points].push(playername);
            }
            players_unpaired = [];
            _.forOwn(points_vs_players, function(players_on_same_points, points) {
                for (var i = 0; i < players_on_same_points.length; i++) {
                    players_unpaired.push(players_on_same_points[i]);
                }
            });

            while (players_unpaired.length > 1) {
                SetupOneGame(players_unpaired[0], players_unpaired[1]);
            }
        }
    };
    
    var SetupOneGame = function(player1, player2) {
        //console.log("New match:" + player1 + " Vs. " + player2);
        var chess    = new Chess();
        var p1_color = "white";
        var p2_color = "black";
        if (Math.random() >= 0.5) {
            p1_color = "black";
            p2_color = "white";            
        }
        if (p1_color === "white") {
            chess.header('Event', 'Chess Arena', 'Site', 'online', 'Date', moment().format('lll'), 'Round', '?', 'White', player1, 'Black', player2, 'TimeControl', tournament_timecontrol);
        } else {
            chess.header('Event', 'Chess Arena', 'Site', 'online', 'Date', moment().format('lll'), 'Round', '?', 'White', player2, 'Black', player1, 'TimeControl', tournament_timecontrol);
        }

        var pgn                       = chess.pgn();
        var game_id                   = Math.floor((Math.random() * 1000000000) + 1);
        chess_game_objs[game_id]      = chess;
        timing_data[game_id]          = {};
        timing_data[game_id][player1] = { time_left: tournament_base_time, bonus: tournament_increment, thinking_started_at: Date.now() };
        timing_data[game_id][player2] = { time_left: tournament_base_time, bonus: tournament_increment, thinking_started_at: Date.now() };
        if (_.has(player_vs_socket, player1)) {
            io.sockets.connected[player_vs_socket[player1]].emit("make_move", { color: p1_color, pgn: pgn, timer: timing_data[game_id]});
        }
        if (_.has(player_vs_socket, player2)) {
            io.sockets.connected[player_vs_socket[player2]].emit("make_move", { color: p2_color, pgn: pgn, timer: timing_data[game_id]});
        }
        _.pull(players_unpaired, player1, player2);
        current_pairs[player1] = { color: p1_color, opponent: player2, gameId: game_id };
        current_pairs[player2] = { color: p2_color, opponent: player1, gameId: game_id };
    };
    
    var UpdatePerformance = function(player, result) {
        if (result !== -1 && tournament_state === "not_in_progress") { // Ignore the results received after the tournament has ended.
            return;
        }
        if (_.has(player_performance, player)) { // Update
            if (result === 2) { // Victory
                var points = 2;
                player_performance[player].streak += 1;
                if (player_performance[player].streak > 2) {
                    points += 1;
                }
                player_performance[player].points += points;
                player_performance[player].results.push(points);
            } else if (result === 1) { // Draw
                player_performance[player].streak = 0;
                player_performance[player].points += 1;
                player_performance[player].results.push(1);
            } else if (result === 0) { // Loss
                player_performance[player].streak = 0;
                player_performance[player].results.push(0);
            }
        } else { // Create
            player_performance[player]        = { points: 0, streak: 0, results: [] }
            player_performance[player].points = (result === -1) ? 0 : result;
            player_performance[player].streak = (result === 2)  ? 1 : 0;
            if (result !== -1)
                player_performance[player].results.push(result);
        }
    };
    
    var FindWinners = function(perf) {
        var sortable = [];
        for (var player in perf)
            sortable.push([player, perf[player].points]);

        sortable.sort(
            function(a, b) {
                return b[1] - a[1];
            }
        )
        // TODO - implement tiebreaker
        //console.log(sortable);
        var standings = [];
        for (var i = 0; i < sortable.length; i++) {
            standings.push(sortable[i][0]);
        }
        return standings;
    };
    
    var EndOfTournament = function() {
        var mongoose     = require('mongoose');
        var PlayerDB     = mongoose.model('PlayerDB');
        var GameDB       = mongoose.model('GameDB');
        var TournamentDB = mongoose.model('TournamentDB');
        var util         = require('../config/util.js');
        
        //console.log("Tournament ended!");
        var standings = FindWinners(player_performance);

        // Calculate new ratings of the players
        /*  // Update ratings at the end of the tournament
        var glicko2 = require('glicko2');
        var glicko2_settings = {tau : 0.5,
                                rating : 1500,
                                rd : 200,
                                vol : 0.06
                                };
        var ranking = new glicko2.Glicko2(glicko2_settings);
        */
        // TODO - Update player stats in the database
        
        // Store the tournament-matches in the database
        var all_pgns = "";
        for (var i = 0; i < finished_games_ids.length; i++) {
            var game        = chess_game_objs[finished_games_ids[i]];
            var game_header = game.header();
            var pgn_html    = game.pgn({ max_width: 5, newline_char: '<br />' });
            var pgn_nl      = game.pgn({ max_width: 5, newline_char: '\n' });
            all_pgns       += pgn_nl + "\n\n";
            var wp          = game_header.White;
            var bp          = game_header.Black;
            PlayerDB.findOne({handle: wp}, function(err, p1) {
                PlayerDB.findOne({handle: bp}, function(err, p2) {
                    var g = new GameDB({
                                id          : util.RandomString(8), // => made up of 8 iterations of random substring slices
                                white       : p1,
                                black       : p2,
                                timecontrol : game_header.TimeControl,
                                pgn         : pgn_html,
                                result      : game_header.Result,
                                date        : game_header.Date,
                                rated       : true
                            });
                    g.save(function(err) {
                        if (err) {
                            next(err);
                        } else {
                            //console.log("Game successfully saved in the DB.");
                        }
                    });
                });
            });
        }

        var fs       = require('fs');
        var path     = require('path');
        var tour_id  = util.RandomString(3);
        var filepath = path.resolve(__dirname + "/../public/data/" + tour_id + ".pgn");
        fs.writeFile(filepath, all_pgns, function(err) {
            if (err) {
                //console.log(err)
                return;
            }
            //console.log("The file was saved!");
        });

        // Store tournament in the database
        var t = new TournamentDB({
            name          : util.RandomString(8), // => made up of 8 iterations of random substring slices
            format        : "Arena",
            timecontrol   : tournament_timecontrol,
            start_time    : tournament_start_time,
            duration      : tournament_end_time - tournament_start_time,
            all_games_pgn : all_pgns,
            standings     : standings
        });
        t.save(function(err) {
            if (err) {
                next(err);
            } else {
                //console.log("Tournament successfully saved in the DB.");
            }
        });
        
        // Put the download link for this file on to the Arena page using the return value
        return {pgn_file: "file:///" + filepath,
                winners : standings
               };
    };
    
    io.sockets.on('connection', function(socket) {
        //console.log("+Client = " + socket.id);
        // Only admin can trigger this event by pressing the button on the admin console.
        socket.on("start_tournament", function(data) {
            if (tournament_state === "not_in_progress") {
                //console.log("Starting the tournament T = " + data.duration + ' ' + data.base_time + '+' + data.increment);
                tournament_state       = "in_progress";
                tournament_start_time  = Date.now();
                duration               = parseInt(data.duration);
                tournament_base_time   = parseInt(data.base_time);
                tournament_increment   = parseInt(data.increment);
                tournament_end_time    = tournament_start_time + duration;
                tournament_timecontrol = (tournament_base_time/1000).toString() + '+' + (tournament_increment/1000).toString();
                tournament_clock       = setTimeout(function() {
                                            //console.log("Tournament ended.");
                                            tournament_state = "not_in_progress";
                                            clearInterval(tournament_countdown_timer);
                                            //clearInterval(tournament_pairing_clock);
                                            var results = EndOfTournament();
                                            io.sockets.emit('tournament_ended', results);  
                                        }, duration);

                // Updates time on the leaderboard page after every 1 second.
                tournament_countdown_timer = setInterval(function() {
                    var time_now  = Date.now();
                    var time_left = (tournament_end_time > time_now) ? (tournament_end_time - time_now) : 0;
                    io.sockets.emit("tournament_countdown_timer", time_left)
                }, 1000);

                //tournament_pairing_clock = setInterval(function() {
                //    GeneratePairings();
                //}, 10000);

                GeneratePairings(); // For the players who have join before the tournament begins.
            }
        });
        
        // Fired when player is in the Arena but yet to participate in the tournament
        socket.on('player_logged_on', function(data) { // This event gets fired on page-refresh as well
            //console.log("++Client " + data.player + " socket.id " + socket.id);
            //console.log("N = " + io.sockets.server.eio.clientsCount);
            if (_.has(player_vs_socket, data.player)) {
                //console.log("Multiple logins " + data.player);
                io.sockets.connected[socket.id].emit("multiple_login_warning", {});
            } else {
                socket_vs_player[socket.id]   = data.player;
                player_vs_socket[data.player] = socket.id;

                io.emit('leaderboard', { perf: player_performance, pairs: current_pairs });
                // Cases to consider
                // 1. First time login
                // 2. Was never a tournament participant
                // 3. Was not playing (unpaired) but then was disconnected/refreshed -> reconnected

                // 4. Was playing currently but then was disconnected/refreshed -> reconnected   
                //    4.1. when disconnected, it was his move
                //    4.2. when disconncted it was opponent's move
                if (_.has(player_vs_logout_timer, data.player)) {
                    var player = data.player;
                    clearTimeout(player_vs_logout_timer[player]);
                    delete player_vs_logout_timer[player];
                    //console.log(player + " reconnected.");
                    if (_.has(current_pairs, player)) {
                        var game_id  = current_pairs[player].gameId;
                        var game     = chess_game_objs[game_id];
                        var color    = current_pairs[player].color;
                        var pgn      = game.pgn();
                        var msg      = "[" + player + "] reconnected";
                        var opponent = current_pairs[player].opponent;
                        if (_.has(player_vs_socket, player)) {
                            var game_timer = timing_data[game_id];
                            if ((game.turn() === 'w' && color === "white") || (game.turn() === 'b' && color === "black")) {
                                // 1. It was player's move when he logged out
                                // 2. It was opponent's move and he has moved when the player was logged out
                                var last_move_t = Math.max(game_timer[player].thinking_started_at, game_timer[opponent].thinking_started_at);
                                game_timer[player].time_left          -= (Date.now() - last_move_t);
                                game_timer[player].thinking_started_at = Date.now();
                            } else {
                                // 3. It was opponent's move when player logged out and opponent hasn't moved yet    
                            }
                            io.sockets.connected[player_vs_socket[player]].emit("make_move", { color: color, pgn: pgn, msg: msg, timer: game_timer });
                        }
                        if (_.has(player_vs_socket, opponent)) {
                            io.sockets.connected[player_vs_socket[opponent]].emit("chat", { who: player, msg: "reconnected" });
                        }
                    }
                }
            }
        });

        socket.on('disconnect', function() {
            //console.log("-Client = " + socket.id);
            if (_.has(socket_vs_player, socket.id)) {
                var player = socket_vs_player[socket.id];
                delete player_vs_socket[player];
                delete socket_vs_player[socket.id];
    
                //console.log(player + " logged out.");
                _.pull(players_unpaired, player); // If the player was not playing currently.
                if (_.has(current_pairs, player)) {
                    // Defer forfeit by 60 seconds (to allow browser refresh not count as a logout)
                    player_vs_logout_timer[player] = setTimeout(function() {
                        //console.log("Logout timeout - " + player);
                        var opponent = current_pairs[player].opponent;
                        var color    = current_pairs[player].color;
                        var game_id  = current_pairs[player].gameId;
                        var game     = chess_game_objs[game_id];
                        var result   = (color === "white") ? "0-1" : "1-0";
                        if (!_.has(player_vs_logout_timer, opponent)) { // opponent is online
                            var pgn         = game.pgn({max_width: 5, newline_char: '<br />'});
                            var description = opponent + " won! Your opponent left the game.";
                            io.sockets.connected[player_vs_socket[opponent]].emit("game_over", { result: result, info: description, pgn: pgn });
                        } else {
                            // opponent left the game in-between this reconnect-wait interval
                            // We have to terminate his timer in here, if we let it expire later and in the meantime
                            // if his oppoenent which is "player" comes back-online... he will wrongly be granted a victory.
                            clearTimeout(player_vs_logout_timer[opponent]);
                            delete player_vs_logout_timer[opponent];
                        }
                        // The game might already have been over.
                        // 1. p1 makes a "winning move (checkmate)" when p2 was offline
                        //    in the make_move event the game is processed for the result and
                        //    put onto the finished games list appropriately.
                        // 2. The advantage of checking this is that had p1's last move resulted in
                        //    a stalemate p2 still earns 1 point even when his logout-counter is
                        //    about to expire (actually has expired when this function is called).
                        if (_.indexOf(finished_games_ids, game_id) === -1) {
                            UpdatePerformance(player, 0);
                            UpdatePerformance(opponent, 2);
                            game.header('Result', result);
                            if (tournament_state === "in_progress")
                                finished_games_ids.push(game_id);
                            delete current_pairs[player];
                            delete current_pairs[opponent];
                        }
                        delete player_vs_logout_timer[player];
                    }, 60000); // 60 seconds
                }
            }
        });

        socket.on('player_joined_tournament', function(data) {
            //console.log(data.player + " joined tournament");
            players_unpaired.push(data.player);
            UpdatePerformance(data.player, -1); // Initializes perf D.S.
            GeneratePairings();
            io.emit('leaderboard', { perf: player_performance, pairs: current_pairs });
        });

        socket.on('player_left_tournament', function(data) {
            //console.log(data.player + " left tournament");
            _.pull(players_unpaired, data.player);
        });

        socket.on('move', function(data) {
            var player   = socket_vs_player[socket.id];
            var opponent = current_pairs[player].opponent;
            var game_id  = current_pairs[player].gameId
            var game     = chess_game_objs[game_id];
            game.move(data);
            var pgn                       = game.pgn();
            var p1_color                  = current_pairs[player].color;
            var p2_color                  = current_pairs[opponent].color;
            var game_over                 = false;
            var game_timer                = timing_data[game_id];
            game_timer[player].time_left -= (Date.now() - game_timer[player].thinking_started_at);
            if (game_timer[player].time_left <= 0) {
                game_over = true; // timeout
            } else {
                game_timer[player].time_left            += game_timer[player].bonus;
                game_timer[opponent].thinking_started_at = Date.now();
            }
            if (_.has(player_vs_socket, player)) {
                io.sockets.connected[player_vs_socket[player]].emit("make_move", { color: p1_color, pgn: pgn, timer: game_timer });   
            }
            if (_.has(player_vs_socket, opponent)) {
                io.sockets.connected[player_vs_socket[opponent]].emit("make_move", { color: p2_color, pgn: pgn, timer: game_timer });
            }

            var result      = "";
            var description = "Game drawn";
            if (game_over || game.in_checkmate()) {
                var move_color = 'white';
                result = "0-1";
                if (game.turn() === 'b') {
                    move_color = 'black';
                    result     = "1-0";
                }
                if (p1_color === move_color) { // player2 won
                    description = opponent + " won!";
                    UpdatePerformance(opponent, 2);
                    UpdatePerformance(player, 0);
                } else { // player1 won
                    description = player + " won!";
                    UpdatePerformance(player, 2);
                    UpdatePerformance(opponent, 0);
                }
                if (game_over)
                    description += " (timeout)";
                game_over = true;
            } else if (game.in_stalemate()) {
                game_over   = true;
                result      = "1/2-1/2";
                description = description + " (stalemate)";
                UpdatePerformance(player, 1);
                UpdatePerformance(opponent, 1);
            } else if (game.in_threefold_repetition()) {
                game_over   = true;
                result      = "1/2-1/2";
                description = description + " (3-fold repetition)";
                UpdatePerformance(player, 1);
                UpdatePerformance(opponent, 1);
            } else if (game.in_draw()) {
                game_over = true;
                result    = "1/2-1/2";
                UpdatePerformance(player, 1);
                UpdatePerformance(opponent, 1);
                description = description + " (not enough material/50-move rule)";
            }
            if (game_over) {
                delete current_pairs[player];
                delete current_pairs[opponent];
                if (tournament_state === "in_progress")
                    finished_games_ids.push(game_id);
                game.header('Result', result);
                var pgn = game.pgn({ max_width: 5, newline_char: '<br />' });
                // game_over event will eventually trigger the re-joining event putting this player back
                // on the unpaired players' list
                if (_.has(player_vs_socket, player)) {
                    io.sockets.connected[player_vs_socket[player]].emit("game_over", { result: result, info: description, pgn: pgn });  
                }
                if (_.has(player_vs_socket, opponent)) {
                    io.sockets.connected[player_vs_socket[opponent]].emit("game_over", { result: result, info: description, pgn: pgn });
                }
                io.emit('leaderboard', { perf: player_performance, pairs: current_pairs });
            }
        });
    
        socket.on('resign', function(data) {
            var player      = socket_vs_player[socket.id];
            var opponent    = current_pairs[player].opponent;
            var game_id     = current_pairs[player].gameId;
            var game        = chess_game_objs[game_id];
            var color       = current_pairs[player].color;
            var result      = (color === "white") ? "0-1" : "1-0";
            var description = opponent + " won! " + player + " resigned.";
            UpdatePerformance(player, 0);
            UpdatePerformance(opponent, 2);
            delete current_pairs[player];
            delete current_pairs[opponent];
            if (tournament_state === "in_progress")
                finished_games_ids.push(game_id);
            game.header('Result', result);
            var pgn = game.pgn({ max_width: 5, newline_char: '<br />' });
            if (_.has(player_vs_socket, player)) {
                io.sockets.connected[player_vs_socket[player]].emit("game_over", { result: result, info: description, pgn: pgn });  
            }
            if (_.has(player_vs_socket, opponent)) {
                io.sockets.connected[player_vs_socket[opponent]].emit("game_over", { result: result, info: description, pgn: pgn });
            }
            io.emit('leaderboard', { perf: player_performance, pairs: current_pairs });
        });
        
        socket.on('timeout', function(data) { // Same as resign
            var player      = socket_vs_player[socket.id];
            if (!_.has(current_pairs, player)) return;
            //console.log(player + " timed out");
            var opponent    = current_pairs[player].opponent;
            var game_id     = current_pairs[player].gameId;
            var game        = chess_game_objs[game_id];
            var color       = current_pairs[player].color;
            var result      = (color === "white") ? "0-1" : "1-0";
            var description = opponent + " won! " + player + " (timeout)";
            UpdatePerformance(player, 0);
            UpdatePerformance(opponent, 2);
            delete current_pairs[player];
            delete current_pairs[opponent];
            if (tournament_state === "in_progress")
                finished_games_ids.push(game_id);
            game.header('Result', result);
            var pgn = game.pgn({ max_width: 5, newline_char: '<br />' });
            if (_.has(player_vs_socket, player)) {
                io.sockets.connected[player_vs_socket[player]].emit("game_over", { result: result, info: description, pgn: pgn });  
            }
            if (_.has(player_vs_socket, opponent)) {
                io.sockets.connected[player_vs_socket[opponent]].emit("game_over", { result: result, info: description, pgn: pgn });
            }
            io.emit('leaderboard', { perf: player_performance, pairs: current_pairs });
        });
        
        socket.on('draw_offered', function(data) { // Similar to takeback_proposed
            var player   = socket_vs_player[socket.id];
            var opponent = current_pairs[player].opponent;
            if (_.has(player_vs_socket, opponent)) {
                io.sockets.connected[player_vs_socket[opponent]].emit("opponent_offers_draw", { who: player });
            } else {
                io.sockets.connected[socket.id].emit("chat", { who: opponent, msg: "is offline" });
            }
        });

        socket.on('draw_accepted', function(data) {
            var player      = socket_vs_player[socket.id];
            var opponent    = current_pairs[player].opponent;
            var game_id     = current_pairs[player].gameId;
            var game        = chess_game_objs[game_id];
            var result      = "1/2-1/2";
            var description = "Game drawn by agreement.";
            UpdatePerformance(player, 1);
            UpdatePerformance(opponent, 1);
            delete current_pairs[player];
            delete current_pairs[opponent];
            if (tournament_state === "in_progress")
                finished_games_ids.push(game_id);
            game.header('Result', result);
            var pgn = game.pgn({ max_width: 5, newline_char: '<br />' });
            if (_.has(player_vs_socket, player)) {
                io.sockets.connected[player_vs_socket[player]].emit("game_over", { result: result, info: description, pgn: pgn });  
            }
            if (_.has(player_vs_socket, opponent)) {
                io.sockets.connected[player_vs_socket[opponent]].emit("game_over", { result: result, info: description, pgn: pgn });
            }
            io.emit('leaderboard', { perf: player_performance, pairs: current_pairs });
        });
        
        socket.on('draw_denied', function(data) { // Similar to takeback_denied
            var player   = socket_vs_player[socket.id];
            var opponent = current_pairs[player].opponent;
            if (_.has(player_vs_socket, opponent)) {
                io.sockets.connected[player_vs_socket[opponent]].emit("draw_denied", { who: player });
            } else {
                io.sockets.connected[socket.id].emit("chat", { who: opponent, msg: "is offline" });
            }
        });
        
        socket.on('takeback_proposed', function(data) { // Just relay the request to the opponent
            var player   = socket_vs_player[socket.id];
            var opponent = current_pairs[player].opponent;
            if (_.has(player_vs_socket, opponent)) {
                io.sockets.connected[player_vs_socket[opponent]].emit("opponent_wishes_to_takeback", { who: player });
            } else {
                io.sockets.connected[socket.id].emit("chat", { who: opponent, msg: "is offline" });
            }
        });
        
        socket.on('takeback_granted', function(data) {
            var player   = socket_vs_player[socket.id];
            var opponent = current_pairs[player].opponent;
            var game_id  = current_pairs[player].gameId;
            var game     = chess_game_objs[game_id];
            game.undo();
            var pgn      = game.pgn();
            var p1_color = current_pairs[player].color;
            var p2_color = current_pairs[opponent].color;
            var msg      = "[" + player + "] takeback granted";
            
            // TODO - check this logic
            // Is the person granting the takeback at loss? If yes, add some bonus time to his clock
            var game_timer = timing_data[game_id];
            var game_over  = false;
            game_timer[player].time_left -= (Date.now() - game_timer[player].thinking_started_at);
            if (game_timer[player].time_left <= 0) {
                game_over = true;
            } else {
                game_timer[player].time_left            += game_timer[player].bonus;
                game_timer[opponent].thinking_started_at = Date.now();
            }
            // TODO game_over handling (timeout)

            if (_.has(player_vs_socket, player)) {
                io.sockets.connected[player_vs_socket[player]].emit("make_move", { color: p1_color, pgn: pgn, msg: msg, timer: game_timer });  
            }
            if (_.has(player_vs_socket, opponent)) {
                io.sockets.connected[player_vs_socket[opponent]].emit("make_move", { color: p2_color, pgn: pgn, msg: msg, timer : game_timer });
            } else {
                io.sockets.connected[socket.id].emit("chat", { who: opponent, msg: "is offline" });
            }
        });
        
        socket.on('takeback_denied', function(data) { // Similar to draw_denied, just relays the information to the other player
            var player   = socket_vs_player[socket.id];
            var opponent = current_pairs[player].opponent;
            if (_.has(player_vs_socket, opponent)) {
                io.sockets.connected[player_vs_socket[opponent]].emit("takeback_denied", { who: player });
            } else {
                io.sockets.connected[socket.id].emit("chat", { who: opponent, msg: "is offline" });
            }
        });
        
        socket.on('chat', function(data) {
            var player   = socket_vs_player[socket.id];
            var opponent = current_pairs[player].opponent;
            var msg      = data.msg;
            if (_.has(player_vs_socket, player)) {
                io.sockets.connected[player_vs_socket[player]].emit("chat", { who: player, msg: msg });
            }
            if (_.has(player_vs_socket, opponent)) {
                io.sockets.connected[player_vs_socket[opponent]].emit("chat", { who: player, msg: msg });
            } else {
                io.sockets.connected[socket.id].emit("chat", { who: opponent, msg: "is offline" });
            }
        });

        socket.on('give_bonus_time', function(data) {
            var player     = socket_vs_player[socket.id];
            var opponent   = current_pairs[player].opponent;
            var game_id    = current_pairs[player].gameId;
            var game_timer = timing_data[game_id];
            var msg        = "+15 seconds!";
            game_timer[opponent].time_left += 15000;
            if (_.has(player_vs_socket, player)) {
                io.sockets.connected[player_vs_socket[player]].emit("chat", { who: player, msg: msg });
            }
            if (_.has(player_vs_socket, opponent)) {
                io.sockets.connected[player_vs_socket[opponent]].emit("chat", { who: player, msg: msg });
            } else {
                io.sockets.connected[socket.id].emit("chat", { who: opponent, msg: "is offline" });
            }
        });
        
        // TODO
        socket.on('premove', function(data) {});
        socket.on('cancel_premove', function(data) {});
    });
};
