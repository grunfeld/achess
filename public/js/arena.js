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

function CharsInAString(str, ch) {
    return (str.match(new RegExp(ch, "g")) || []).length;
}

$(document).ready(function() {
    
    function ScrollDownTheChat() {
        var height = 0;
        $('#CHAT p').each(function(i, value) {
            height += parseInt($(this).height());
        });
        $('#CHAT').animate({scrollTop: height});        
    }

    function DownLoadPGN(filename, text) {
        // Set up the link
        var link = document.createElement("a");
        link.setAttribute("target", "_blank");
        if (Blob !== undefined) {
            var blob = new Blob([text], { type: "text/plain" });
            link.setAttribute("href", URL.createObjectURL(blob));
        } else {
            link.setAttribute("href", "data:text/plain," + encodeURIComponent(text));
        }
        link.setAttribute("download", filename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
    
    var socket = io.connect('http://localhost:3333');
    //var socket = io.connect('https://chess-arena.herokuapp.com');

    var player = "";
    if ($('#ONLINE_PLAYER').length) {
        player = $('#ONLINE_PLAYER').data("handle");
        socket.emit('player_logged_on', { player: player });
    }

    // [Tournament related events (player not involved)] ------------------------------
    // This event comes from the admin login
    $('#START_TOURNAMENT_BTN').click(function() {
        if ($(this).hasClass("disabled"))
            return;
        var duration  = $('#DURATION_SEL').find(":selected").val();
        var base_time = $('#BASE_TIME_SEL').find(":selected").val(); 
        var increment = $('#INCREMENT_SEL').find(":selected").val();
        
        $('#START_TOURNAMENT_BTN').addClass("disabled"); // Can create only 1 tournament at a time
        socket.emit("start_tournament", { duration : duration,
                                          base_time: base_time,
                                          increment: increment
                                        });
    });
    if ($('#START_TOURNAMENT_BTN').length) {
        socket.emit("get_tournament_status");
        socket.on("tournament_status", function(data) {
            if (data.status === "in_progress") {
                $('#START_TOURNAMENT_BTN').addClass("disabled");
            }
        });
    }
    
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

        $('#TOURNAMENT_GAMES_DOWNLOAD_BTN').click(function() {
            $(this).blur();
            DownLoadPGN("chess_arena_games.pgn", data.pgns);
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
        $(this).blur();
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
                var wsp         = "&nbsp;&nbsp;";
                for (var j = 0; j < whitespaces; j++)
                    wsp += '&nbsp;';
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
                    display_text += "<li>" + key + " Vs. " + value.opponent + "</li>";
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
            $('#SELF_CLOCK').removeClass("less_than_10_sec");
            countdown = setInterval(function() {
                            my_time_left -= 1000;
                            if (my_time_left < 0) {
                                my_time_left = 0;
                                socket.emit("timeout", {});
                                clearInterval(countdown);
                                countdown = ReturnUndefined();
                            }
                            if (my_time_left <= 10000) {
                                $('#SELF_CLOCK').addClass("less_than_10_sec");
                            } else {
                                $('#SELF_CLOCK').removeClass("less_than_10_sec");
                            }
                            $('#SELF_CLOCK').html(msToMins(my_time_left));
                        }, 1000);
        } else {
            $('#SELF_CLOCK').html(msToMins(my_time_left));
            $('#SELF_CLOCK').removeClass("active_timer");
            $('#SELF_CLOCK').addClass("inactive_timer");
            $('#SELF_CLOCK').removeClass("less_than_10_sec"); // carried over from the last match
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

        // Show material difference
        var fen = game.fen().split(" ")[0];
        var wp  = CharsInAString(fen, "P");
        var wr  = CharsInAString(fen, "R");
        var wn  = CharsInAString(fen, "N");
        var wb  = CharsInAString(fen, "B");
        var wq  = CharsInAString(fen, "Q");
        var bp  = CharsInAString(fen, "p");
        var br  = CharsInAString(fen, "r");
        var bn  = CharsInAString(fen, "n");
        var bb  = CharsInAString(fen, "b");
        var bq  = CharsInAString(fen, "q");
        if (data.color === 'black') {
            var c = bp; bp = wp; wp = c;
                c = bn; bn = wn; wn = c;
                c = bb; bb = wb; wb = c;
                c = br; br = wr; wr = c;
                c = bq; bq = wq; wq = c;
        }
        $('#SELF_MATERIAL_DIFF').empty();
        $('#OPPN_MATERIAL_DIFF').empty();
        var diff = 0;
        if (wp > bp) {
            diff = wp - bp;
            $('#SELF_MATERIAL_DIFF').prepend('<img src="img/chesspieces/regular/bp.svg" alt="P" height="28" />&times;' + diff.toString());
        } else if (bp > wp) {
            diff = bp - wp;
            $('#OPPN_MATERIAL_DIFF').prepend('<img src="img/chesspieces/regular/bp.svg" alt="P" height="28" />&times;' + diff.toString());
        }
        if (wn > bn) {
            diff = wn - bn;
            $('#SELF_MATERIAL_DIFF').prepend('<img src="img/chesspieces/regular/bn.svg" alt="N" height="28" />&times;' + diff.toString());
        } else if (bn > wn) {
            diff = bn - wn;
            $('#OPPN_MATERIAL_DIFF').prepend('<img src="img/chesspieces/regular/bn.svg" alt="N" height="28" />&times;' + diff.toString());
        }
        if (wb > bb) {
            diff = wb - bb;
            $('#SELF_MATERIAL_DIFF').prepend('<img src="img/chesspieces/regular/bb.svg" alt="B" height="28" />&times;' + diff.toString());
        } else if (bb > wb) {
            diff = bb - wb;
            $('#OPPN_MATERIAL_DIFF').prepend('<img src="img/chesspieces/regular/bb.svg" alt="B" height="28" />&times;' + diff.toString());
        }
        if (wr > br) {
            diff = wr - br;
            $('#SELF_MATERIAL_DIFF').prepend('<img src="img/chesspieces/regular/br.svg" alt="R" height="28" />&times;' + diff.toString());
        } else if (br > wr) {
            diff = br - wr;
            $('#OPPN_MATERIAL_DIFF').prepend('<img src="img/chesspieces/regular/br.svg" alt="R" height="28" />&times;' + diff.toString());
        }
        if (wq > bq) {
            diff = wq - bq;
            $('#SELF_MATERIAL_DIFF').prepend('<img src="img/chesspieces/regular/bq.svg" alt="Q" height="28" />&times;' + diff.toString());
        } else if (bq > wq) {
            diff = bq - wq;
            $('#OPPN_MATERIAL_DIFF').prepend('<img src="img/chesspieces/regular/bq.svg" alt="Q" height="28" />&times;' + diff.toString());
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
                var pattern_w = new RegExp("[abcdefgh]8$");
                var pattern_b = new RegExp("[abcdefgh]1$");
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

            var move = game.move({ from: source, to: target, promotion: promote_to });
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
            board.position(game.fen(), false);
        };

        var updateStatus = function() {
            if ($('#RESIGN_BTN_ICON').hasClass("fa-check")) // Take away confirm-resign? icon
                $('#RESIGN_BTN_ICON').removeClass("fa-check").addClass("fa-flag");
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
            var h = game.history({ verbose: true });
            pgnEl.empty();
            //pgnEl.html(game.pgn({max_width: 5, newline_char: '<br />'}));
            //pgnEl.animate({scrollTop: 10000}); // scroll down to the last move
            var pgn_text = "<table class=\"table table-striped\">";
            pgn_text += '<thead><tr><th class="firstmovetab">' + game.header().White + '</th>';
            pgn_text += '<th>' + game.header().Black + '</th></tr></thead>';
            if (h.length) {
                var i = 0;
                for (i = 0; i < h.length - 1; i += 2) {
                    pgn_text += '<tr><td class="firstmovetab">' + (i/2+1).toString() + '. ' + h[i].san + '</td>';
                    pgn_text += '<td>' + h[i+1].san + '</td></tr>';
                }
                if (i == h.length - 1) {
                    pgn_text += '<tr><td colspan="2" class="firstmovetab">' + (i/2+1).toString() + '. ' + h[i].san + '</td></tr>';
                }
            }
            pgn_text += "</table>";
            pgnEl.html(pgn_text);
            pgnEl.scrollTop(pgnEl.prop("scrollHeight"));

            if (data.hasOwnProperty("msg")) {
                $('#CHAT').append("<p>" + data.msg + "</p>");
                ScrollDownTheChat();
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
            $('#CHAT').append("<p>" + "Takeback declined" + "</p>");
            ScrollDownTheChat();
            socket.emit("takeback_denied", {});
        }
        if ($('#DRAW_BTN').hasClass('btn-info')) {
            $('#DRAW_BTN').removeClass('btn-info');
            $('#DRAW_BTN').addClass('btn-default');
            $('#CHAT').append("<p>" + "Draw declined" + "</p>");
            ScrollDownTheChat();
            socket.emit("draw_denied", {});
        }
        board = ChessBoard('BOARD', cfg);
        $('#BOARD .white-1e1d7').css("background-color", "#e8e1d9");
        $('#BOARD .black-3c85d').css("background-color", "#b2997f");
        $('#BOARD .white-1e1d7').css("color", "#b2997f");
        $('#BOARD .black-3c85d').css("color", "#e8e1d9");
        updateStatus();
        
        var h = game.history({ verbose: true });
        if (h.length) {
            var last_move = h[h.length - 1];
            var boardEl = $('#BOARD');
            boardEl.find('.square-' + last_move.from).addClass('highlight-last-move');
            boardEl.find('.square-' + last_move.to).addClass('highlight-last-move');
        }
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
        var final_pos   = ChessBoard('FINAL_POSITION', 
                                     { draggable: false, position: data.fen, showNotation: true, orientation : data.color, pieceTheme: 'img/chesspieces/merida/{piece}.svg' });
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
        $(this).blur();
        // Confirm the resignation
        if ($('#RESIGN_BTN_ICON').hasClass("fa-flag")) {
            $('#RESIGN_BTN_ICON').removeClass("fa-flag").addClass("fa-check");
            return;
        } else {
            $('#RESIGN_BTN_ICON').removeClass("fa-check").addClass("fa-flag");
        }
        socket.emit("resign", {});
    });

    // DRAW functionality is similar to the TAKEBACK functionality
    $('#DRAW_BTN').click(function() {
        $(this).blur();
        if ($(this).hasClass('btn-default')) {
            socket.emit("draw_offered", {});
            $('#CHAT').append("<p>" + "Draw offer sent" + "</p>");
            ScrollDownTheChat();
        } else{
            socket.emit("draw_accepted", {});
            $(this).removeClass('btn-info');
            $(this).addClass('btn-default');            
        }
    });
    socket.on("opponent_offers_draw", function(data) { // Similar to opponent_wishes_to_takeback
        $('#CHAT').append("<p>" + data.who + " offers a draw" + "</p>");
        ScrollDownTheChat();
        $('#DRAW_BTN').removeClass('btn-default');
        $('#DRAW_BTN').addClass('btn-info');
    });
    socket.on("draw_denied", function(data) {
        $('#CHAT').append("<p>" + data.who + " declined draw" + "</p>");
        ScrollDownTheChat();
    });

    // TAKEBACK functionality is similar to the DRAW functionality
    $('#TAKEBACK_BTN').click(function() {
        $(this).blur();
        if ($(this).hasClass('btn-default')) {
            socket.emit("takeback_proposed", {});
            $('#CHAT').append("<p>" + "Takeback proposal sent" + "</p>");
            ScrollDownTheChat();
        } else {
            socket.emit("takeback_granted", {});
            $(this).removeClass('btn-info');
            $(this).addClass('btn-default');
        }
    });
    socket.on("opponent_wishes_to_takeback", function(data) {
        $('#CHAT').append("<p>" + data.who + " wishes to takeback" + "</p>");
        ScrollDownTheChat();
        $('#TAKEBACK_BTN').removeClass('btn-default');
        $('#TAKEBACK_BTN').addClass('btn-info');
    });
    socket.on("takeback_denied", function(data) {
        $('#CHAT').append("<p>" + data.who + " refused takeback" + "</p>");
        ScrollDownTheChat();
    });

    $('#ADD_TIME_BTN').click(function() {
        $(this).blur();
        socket.emit("give_bonus_time", {});
    });
    
    // Chat section
    $('#WELL_PLAYED').click(function() {
        $(this).blur();
        socket.emit("chat", { msg: "Well played!" });
    });
    $('#ALL_THE_BEST').click(function() {
        $(this).blur();
        socket.emit("chat", { msg: "All the best!" });
    });
    $('#THANKS').click(function() {
        $(this).blur();
        socket.emit("chat", { msg: "Thanks!" });
    });
    $('#YOU_TOO').click(function() {
        $(this).blur();
        socket.emit("chat", { msg: "You, too!" });
    });
    socket.on("chat", function(data) {
        $('#CHAT').append("<p>[" + data.who + "] " + data.msg + "</p>");
        ScrollDownTheChat();
    });
});
