// NOTE: When you refresh a page opponents timer will be displayed incorrectly (higher value
// than what it actually is) when it's opponent's turn to move.
function msToTime(duration) {
    var milliseconds = parseInt((duration%1000)/100),
             seconds = parseInt((duration/1000)%60),
             minutes = parseInt((duration/(1000*60))%60),
             hours   = parseInt((duration/(1000*60*60))%24);
    hours   = (hours < 10)   ? "0" + hours : hours;
    minutes = (minutes < 10) ? "0" + minutes : minutes;
    seconds = (seconds < 10) ? "0" + seconds : seconds;
    return hours + ":" + minutes + ":" + seconds;
}

function msToMins(duration) {
    var milliseconds = parseInt((duration%1000)/100),
             seconds = parseInt((duration/1000)%60),
             minutes = parseInt((duration/(1000*60))%60);
    //minutes = (minutes < 10) ? "0" + minutes : minutes;
    seconds = (seconds < 10) ? "0" + seconds : seconds;
    return minutes + ":" + seconds;
}

function ReturnUndefined() {
}

$(document).ready(function() {
    //var socket = io.connect('http://localhost:3333');
    var socket = io.connect('https://chess-arena.herokuapp.com');

    var player = "";
    if ($('#ONLINE_PLAYER').length) {
        player = $('#ONLINE_PLAYER').data("handle");
        socket.emit('player_logged_on', { player: player });
    }

    // [Tournament related events (player not involved)] ------------------------------
    // This event comes from the admin login
    $('#START_TOURNAMENT_BTN').click(function() {
        
        var duration  = $('#DURATION_SEL').find(":selected").val();
        var base_time = $('#BASE_TIME_SEL').find(":selected").val(); 
        var increment = $('#INCREMENT_SEL').find(":selected").val();
        
        $('#START_TOURNAMENT_BTN').addClass("disabled"); // Can create only 1 tournament at a time
        socket.emit("start_tournament", { duration : duration,
                                          base_time: base_time,
                                          increment: increment
                                        });
    });
    
    // Fired after tournament_clock (socket.js) expires
    socket.on("tournament_ended", function(data) {
        $('#START_TOURNAMENT_BTN').removeClass("disabled");
        $('#ARENA_HEAD').hide();
        $('#GAME_ZONE').hide(); // temporary... refresh to resume
        $('#GAME_RESULT_DIV').hide();
        $('#TOURNAMENT_RESULT').show();
        $('#ARENA').show();
        $('#FIRST').hide();
        $('#FIRST_TROPHY').hide();
        $('#SECOND').hide();
        $('#SECOND_TROPHY').hide();
        $('#THIRD').hide();
        $('#THIRD_TROPHY').hide();
        var winners = data.winners;
        if (winners.length > 0) {
            $('#FIRST').html(winners[0]);
            $('#FIRST').show();
            $('#FIRST_TROPHY').show();
            if (winners.length > 1) {
                $('#SECOND').html(winners[1]);
                $('#SECOND').show();
                $('#SECOND_TROPHY').show();
                if (winners.length > 2) {
                    $('#THIRD').html(winners[2]);
                    $('#THIRD').show();
                    $('#THIRD_TROPHY').show();
                }
            }
        }
        
        $('#PGN_HIDDEN_FORM').submit( function(eventObj) {
            $('<input />').attr('type', 'hidden')
            .attr('name', "pgns")
            .attr('value', data.pgns)
            .appendTo('#PGN_HIDDEN_FORM');
            return true;
        });

        if (typeof(Storage) !== "undefined")
            localStorage.setItem("TournamentState", "Ended");
    });

    socket.on("tournament_countdown_timer", function(time_left) { // Fired every 1 seconds once
        $('#TOURNAMENT_NOTIFICATION').show();                     // tournament begins
        $('#TOURNAMENT_BANNER').html("Tournament is on!");
        $('#TOURNAMENT_COUNTDOWN_CLOCK').html(msToTime(time_left));
        if (typeof(Storage) !== "undefined")
            localStorage.setItem("TournamentState", "ON");
    });
    // -------------------------------------------------------------------------------
    
    socket.on("multiple_login_warning", function(data) {
        $('#ARENA_HEAD').hide();
        $('#ARENA').hide();
        $('#GAME_ZONE').hide();
        $('#GAME_RESULT_DIV').hide();
        $('#MULTIPLE_LOGINS_WARNING').show();
    });

    var game_over_timer = ReturnUndefined();
    $('#JOIN_TOURNAMENT_BTN').click(function() {
        var joined = $(this).attr("value");
        if (joined == "withdrew") {
            $(this).attr("value", "joined");
            $(this).removeClass("btn-success");
            $(this).addClass("btn-danger");
            $(this).text("Leave");
            if (typeof game_over_timer === 'undefined')  { // Let the game_over_timer take care of firing this event
                                                           // it can be fired twice when player has refreshed the page
                                                           // and during the game-over timeout he clicks "join". (1)
                                                           // 2nd event will be fired when game-over-timer expires.
                socket.emit("player_joined_tournament", { player: player });
            }
        } else {
            $(this).attr("value", "withdrew");
            $(this).removeClass("btn-danger");
            $(this).addClass("btn-success");
            $(this).text("Join");
            socket.emit("player_left_tournament", { player: player });
        }
    });

    // Arena page data-display
    var CreateLeaderboard = function(perf) {
        var sortable = [];
        for (var player in perf)
            sortable.push([player, perf[player].points]);
        sortable.sort(function(a, b) {
                        return b[1] - a[1];
                      });
        return sortable;
    };
    socket.on('leaderboard', function(data) {
        if ($('#ARENA_LEADERBOARD').length) {
            var perf            = data.perf;
            var ord_player_list = CreateLeaderboard(perf); // Players sorted by decreasing points; no tie-breaker
            var display_text    = "<ul class=\"list-group\"> ";
            var num_of_players  = ord_player_list.length;
            for (var i = 0; i < num_of_players; i++) {
                var player      = ord_player_list[i][0];
                var points      = perf[player].points;
                var results     = perf[player].results;
                var whitespaces = 20 - player.length;
                var wsp         = "&nbsp;&nbsp;"
                for (var j = 0; j < whitespaces; j++)
                    wsp += '&nbsp;'
                display_text += "<li>" + player + wsp + _.join(results, ' ') + " <span class=\"badge\">" + points + "</span></li> ";
            }
            display_text += "</ul>";
            $('#ARENA_LEADERBOARD').html(display_text);
            $('#ARENA_LEADERBOARD > ul.list-group > li').addClass("list-group-item");
        }
        if ($('#ONGOING_MATCHES').length) {
            var pairs        = data.pairs;
            var display_text = "<ul style=\"list-style-type:none\">";
            _.forOwn(pairs, function(value, key) {
                if (value.color =="white") {
                    display_text += "<li>" + key + " Vs. " + value.opponent + "</li>"
                }
            });
            display_text += "</ul>";
            $('#ONGOING_MATCHES').html(display_text);
        }
    });

    // Gameplay events
    var countdown;
    socket.on('make_move', function(data) {
        if (typeof countdown !== 'undefined')
            clearInterval(countdown);
        var game          = new Chess();
        game.load_pgn(data.pgn + '\n');
        var game_timer    = data.timer;
        var my_time_left  = game_timer[player].time_left;
        var opponent      = _.pull(_.keys(game_timer), player);
        var his_time_left = game_timer[opponent[0]].time_left;
        var my_move       = (game.turn() === 'w' && data.color === 'white') || (game.turn() === 'b' && data.color === 'black');
        if (my_move) {
            $('#OPPN_CLOCK').html(msToMins(his_time_left)); // Remains unchanged during my move
            $('#OPPN_CLOCK').removeClass("active_timer");
            $('#OPPN_CLOCK').addClass("inactive_timer");
            $('#SELF_CLOCK').removeClass("inactive_timer");
            $('#SELF_CLOCK').addClass("active_timer");
            countdown = setInterval(function() {
                            my_time_left -= 1000;
                            if (my_time_left < 0) {
                                my_time_left = 0;
                                socket.emit("timeout", {});
                                clearInterval(countdown);
                                countdown = ReturnUndefined();
                            }
                            $('#SELF_CLOCK').html(msToMins(my_time_left));
                        }, 1000);
        } else {
            $('#SELF_CLOCK').html(msToMins(my_time_left));
            $('#SELF_CLOCK').removeClass("active_timer");
            $('#SELF_CLOCK').addClass("inactive_timer");
            $('#OPPN_CLOCK').removeClass("inactive_timer");
            $('#OPPN_CLOCK').addClass("active_timer");
            countdown = setInterval(function() {
                            his_time_left -= 1000;
                            if (his_time_left < 0)
                                his_time_left = 0;  // Don't emit "timeout" event for the opponent. If opponent is offline he will
                                                    // be judged lost after logout-timer expires. If he comes back online, countdown
                                                    // timer at his end will take care of emitting the timeout event.
                            $('#OPPN_CLOCK').html(msToMins(his_time_left));
                        }, 1000);            
        }

        var board,
            statusEl = $('#STATUS'),
            pgnEl    = $('#PGN');
        
        // Do not pick up pieces if the game is over
        // only pick up pieces for the side to move
        var onDragStart = function(source, piece, position, orientation) {
            if (game.game_over() === true ||
                (game.turn() === 'w' && piece.search(/^b/) !== -1) ||
                (game.turn() === 'b' && piece.search(/^w/) !== -1) ||
                (game.turn() === 'w' && data.color === 'black') ||
                (game.turn() === 'b' && data.color === 'white')) {
                return false;
            }
        };

        var onDrop = function(source, target) {
            // See if the move is legal
            //console.log(source + " --> " + target);
            var piece      = game.get(source);
            var promote_to = 'q';
            if (piece.type === 'p') {
                var c         = piece.color;
                var pattern_w = new RegExp("[abcefgh]8$");
                var pattern_b = new RegExp("[abcefgh]1$");
                if (c === 'w' && pattern_w.test(target)) {
                    promote_to = prompt("Promote to? q r n b", "q");
                    promote_to = promote_to.toLowerCase();
                    if (promote_to != 'q' && promote_to != 'r' && promote_to != 'n' && promote_to != 'b') {
                        promote_to = 'q';
                    }
                } else if (c === 'b' && pattern_b.test(target)) {
                    promote_to = prompt("Promote to? q r n b", "q");
                    promote_to = promote_to.toLowerCase();
                    if (promote_to != 'q' && promote_to != 'r' && promote_to != 'n' && promote_to != 'b') {
                        promote_to = 'q';
                    }
                }
            }
            
            var move = game.move({
                            from     : source,
                            to       : target,
                            promotion: promote_to
                        });
            if (move === null) // illegal move
                return 'snapback';
            // Send the move over to the server
            clearInterval(countdown);
            socket.emit("move", { from: source, to: target, promotion: promote_to });
            updateStatus();
        };

        // update the board position after the piece snap 
        // for castling, en passant, pawn promotion
        var onSnapEnd = function() {
            board.position(game.fen());
        };

        var updateStatus = function() {
            var status    = '';
            var moveColor = 'White';
            if (game.turn() === 'b') {
                moveColor = 'Black';
            }
            if (game.in_checkmate() === true) {
                status = moveColor + ' checkmated';
            } else if (game.in_draw() === true) {
                status = 'Game drawn';
            } else {
                if (game.in_check() === true) {
                    status = moveColor + ' is in check';
                } else {
                    status = moveColor + ' to move';    
                }
            }
            statusEl.html(status);
            pgnEl.html(game.pgn());
            if (data.hasOwnProperty("msg")) {
                $('#CHAT').append(data.msg + "<br>");
            }
        };

        var cfg = {
            draggable   : true,
            position    : game.fen(),
            showNotation: true,
            orientation : data.color,
            onDragStart : onDragStart,
            onDrop      : onDrop,
            onSnapEnd   : onSnapEnd,
            pieceTheme  : 'img/chesspieces/merida/{piece}.svg'
        };
        $('#ARENA_HEAD').hide();
        $('#ARENA').hide();
        $('#GAME_ZONE').show();
        
        if ($('#TAKEBACK_BTN').hasClass('btn-info')) {
            $('#TAKEBACK_BTN').removeClass('btn-info');
            $('#TAKEBACK_BTN').addClass('btn-default');
            $('#CHAT').append("Takeback declined.<br>");
            socket.emit("takeback_denied", {});
        }
        if ($('#DRAW_BTN').hasClass('btn-info')) {
            $('#DRAW_BTN').removeClass('btn-info');
            $('#DRAW_BTN').addClass('btn-default');
            $('#CHAT').append("Draw declined.<br>");
            socket.emit("draw_denied", {});
        }
        board = ChessBoard('BOARD', cfg);
        updateStatus();
    });
    
    socket.on("game_over", function(data) {
        var tournament_over = false;
        if (typeof(Storage) !== "undefined") {
            if ("Ended" === localStorage.getItem("TournamentState")) {
                tournament_over = true;
            }
        }
        if (!tournament_over)
            $('#ARENA_HEAD').show();
        $('#GAME_ZONE').hide();
        $('#CHAT').empty();
        $('#GAME_RESULT_DIV').show();
        $('#GAME_RESULT').html(data.result + ' ' + data.info + '<br>You will re-join the Arena in 30 seconds...<br>');
        $('#GAME_PGN').html(data.pgn);
        game_over_timer = setTimeout(function() {  // What if player refreshes the page in this period? - He is not considered a participant
                            $('#GAME_RESULT_DIV').hide();
                            $('#ARENA').show();
                            // Whether player stays in the tournament or not depends on the state of this button
                            // at the end of the countdown. The button stays in "still participating" mode unless
                            // clicked.
                            var joined = $('#JOIN_TOURNAMENT_BTN').attr("value");
                            if (joined === "joined") {
                                socket.emit("player_joined_tournament", { player: player });
                            } else {
                                socket.emit("player_left_tournament", { player: player });
                            }
                            game_over_timer = ReturnUndefined();
                        }, 30000);
    });
    
    $('#RESIGN_BTN').click(function() {
        socket.emit("resign", {});
    });

    // DRAW functionality is similar to the TAKEBACK functionality
    $('#DRAW_BTN').click(function() {
        if ($(this).hasClass('btn-default')) {
            socket.emit("draw_offered", {});
            $('#CHAT').append("Draw offer sent.<br>");            
        } else{
            socket.emit("draw_accepted", {});
            $(this).removeClass('btn-info');
            $(this).addClass('btn-default');            
        }
    });
    socket.on("opponent_offers_draw", function(data) { // Similar to opponent_wishes_to_takeback
        $('#CHAT').append(data.who + " offers a draw<br>");
        $('#DRAW_BTN').removeClass('btn-default');
        $('#DRAW_BTN').addClass('btn-info');
    });
    socket.on("draw_denied", function(data) {
        $('#CHAT').append(data.who + " declined draw<br>");
    });

    // TAKEBACK functionality is similar to the DRAW functionality
    $('#TAKEBACK_BTN').click(function() {
        if ($(this).hasClass('btn-default')) {
            socket.emit("takeback_proposed", {});
            $('#CHAT').append("Takeback proposal sent.<br>");
        } else {
            socket.emit("takeback_granted", {});
            $(this).removeClass('btn-info');
            $(this).addClass('btn-default');
        }
    });
    socket.on("opponent_wishes_to_takeback", function(data) {
        $('#CHAT').append(data.who + " wishes to takeback<br>");
        $('#TAKEBACK_BTN').removeClass('btn-default');
        $('#TAKEBACK_BTN').addClass('btn-info');
    });
    socket.on("takeback_denied", function(data) {
        $('#CHAT').append(data.who + " rejected takeback<br>");
    });

    $('#ADD_TIME_BTN').click(function() {
       socket.emit("give_bonus_time", {});
    });
    
    // Chat section
    $('#WELL_PLAYED').click(function() {
        socket.emit("chat", { msg: "Well played!" });
    });
    $('#ALL_THE_BEST').click(function() {
        socket.emit("chat", { msg: "All the best!" });
    });
    $('#THANKS').click(function() {
        socket.emit("chat", { msg: "Thanks!" });
    });
    $('#YOU_TOO').click(function() {
        socket.emit("chat", { msg: "You, too!" });
    });
    socket.on("chat", function(data) {
        $('#CHAT').append("[" + data.who + "] " + data.msg + "<br>");
    });
});
