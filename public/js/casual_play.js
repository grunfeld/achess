function CharsInAString(str, ch) {
    return (str.match(new RegExp(ch, "g")) || []).length;
}

$(document).ready(function() {

    function ScrollDownTheChat() {
        var height = 0;
        $('#H_CHAT p').each(function(i, value) {
            height += parseInt($(this).height());
        });
        $('#H_CHAT').animate({scrollTop: height});        
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
    
    //var base_url = 'http://localhost:3333';
    var base_url = 'https://chess-arena.herokuapp.com';
    var socket   = io.connect(base_url);

    if ($('#H_BOARD').length) {
        var token          = $('#H_BOARD').data('token');
        var color          = $('#H_BOARD').data('orientation');
        var opponent_color = (color === "white") ? "black" : "white";
        socket.on('casual_wait', function () {
            var url = base_url + '/casual/' + token + "/" + opponent_color;
            $('#H_GAME_URL').html(url);
            $('#H_GAME_URL_POPUP').modal({ keyboard: false, backdrop: 'static' });
        });

        var game = new Chess();
        var d    = moment().format("MMM Do YYYY");
        game.header('Event', 'Casual Game', 'Site', 'Chess Arena', 'Date', d, 'Round', '?', 'White', 'Anon', 'Black', 'Anon', 'Result', '*');
        var board,
            statusEl = $('#H_STATUS'),
            pgnEl    = $('#H_PGN'),
            fenEl    = $('#H_FEN');

        // Do not pick up pieces if the game is over
        // only pick up pieces for the side to move
        var onDragStart = function(source, piece, position, orientation) {
            if (game.game_over() === true ||
                (game.turn() === 'w' && piece.search(/^b/) !== -1) ||
                (game.turn() === 'b' && piece.search(/^w/) !== -1) ||
                (game.turn() === 'w' && color === 'black') ||
                (game.turn() === 'b' && color === 'white')) {
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
            socket.emit("casual_move", { token: token, source: source, target: target, promotion: promote_to });
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
            fenEl.html(game.fen());
            
            // Hightlight the last move
            var h       = game.history({ verbose: true });
            var boardEl = $('#H_BOARD');
            if (h.length > 1) {
                var last_but_one_move = h[h.length - 2];
                boardEl.find('.square-' + last_but_one_move.from).removeClass('highlight-last-move');
                boardEl.find('.square-' + last_but_one_move.to).removeClass('highlight-last-move');
            }
            if (h.length) {
                var last_move = h[h.length - 1];
                boardEl.find('.square-' + last_move.from).addClass('highlight-last-move');
                boardEl.find('.square-' + last_move.to).addClass('highlight-last-move');

                pgnEl.empty();
                //pgnEl.html(game.pgn({max_width: 5, newline_char: '<br />'}));
                //pgnEl.animate({scrollTop: 10000}); // scroll down to the last move
                var pgn_text = "<table>";
                var i = 0;
                for (i = 0; i < h.length - 1; i += 2) {
                    pgn_text += '<tr><td class="firstmovetab">' + (i/2+1).toString() + '. ' + h[i].san + '</td>';
                    pgn_text += '<td>' + h[i+1].san + '</td></tr>';
                }
                if (i == h.length - 1) {
                    pgn_text += '<tr><td colspan="2" class="firstmovetab">' + (i/2+1).toString() + '. ' + h[i].san + '</td></tr>';
                }
                pgn_text += "</table>";
                pgnEl.html(pgn_text);
                pgnEl.scrollTop(pgnEl.prop("scrollHeight"));
            }
            // Show material difference
            var raw = game.fen();
            var fen = raw.split(" ")[0];
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
            if (color === 'black') {
                var c = bp; bp = wp; wp = c;
                    c = bn; bn = wn; wn = c;
                    c = bb; bb = wb; wb = c;
                    c = br; br = wr; wr = c;
                    c = bq; bq = wq; wq = c;
            }
            $('#H_SELF_MATERIAL_DIFF').empty();
            $('#H_OPPN_MATERIAL_DIFF').empty();
            var diff = 0;
            if (wp > bp) {
                diff = wp - bp;
                $('#H_SELF_MATERIAL_DIFF').prepend('<img src="../../img/chesspieces/regular/bp.svg" alt="P" height="28" />&times;' + diff.toString());
            } else if (bp > wp) {
                diff = bp - wp;
                $('#H_OPPN_MATERIAL_DIFF').prepend('<img src="../../img/chesspieces/regular/bp.svg" alt="P" height="28" />&times;' + diff.toString());
            }
            if (wn > bn) {
                diff = wn - bn;
                $('#H_SELF_MATERIAL_DIFF').prepend('<img src="../../img/chesspieces/regular/bn.svg" alt="N" height="28" />&times;' + diff.toString());
            } else if (bn > wn) {
                diff = bn - wn;
                $('#H_OPPN_MATERIAL_DIFF').prepend('<img src="../../img/chesspieces/regular/bn.svg" alt="N" height="28" />&times;' + diff.toString());
            }
            if (wb > bb) {
                diff = wb - bb;
                $('#H_SELF_MATERIAL_DIFF').prepend('<img src="../../img/chesspieces/regular/bb.svg" alt="B" height="28" />&times;' + diff.toString());
            } else if (bb > wb) {
                diff = bb - wb;
                $('#H_OPPN_MATERIAL_DIFF').prepend('<img src="../../img/chesspieces/regular/bb.svg" alt="B" height="28" />&times;' + diff.toString());
            }
            if (wr > br) {
                diff = wr - br;
                $('#H_SELF_MATERIAL_DIFF').prepend('<img src="../../img/chesspieces/regular/br.svg" alt="R" height="28" />&times;' + diff.toString());
            } else if (br > wr) {
                diff = br - wr;
                $('#H_OPPN_MATERIAL_DIFF').prepend('<img src="../../img/chesspieces/regular/br.svg" alt="R" height="28" />&times;' + diff.toString());
            }
            if (wq > bq) {
                diff = wq - bq;
                $('#H_SELF_MATERIAL_DIFF').prepend('<img src="../../img/chesspieces/regular/bq.svg" alt="Q" height="28" />&times;' + diff.toString());
            } else if (bq > wq) {
                diff = bq - wq;
                $('#H_OPPN_MATERIAL_DIFF').prepend('<img src="../../img/chesspieces/regular/bq.svg" alt="Q" height="28" />&times;' + diff.toString());
            }
            
            // Show the result-modal if the game has ended
            if (game.in_checkmate() === true) {
                if (game.turn() === 'w') {
                    game.header('Result', '0-1');
                } else {
                    game.header('Result', '1-0');
                }
                var pgn_html = game.pgn({ newline_char: '<br />' });
                $('#H_GAME_RESULT_TITLE').html("Game over.");
                $('#H_GAME_RESULT').html(pgn_html);
                $('#H_GAME_RESULT_POPUP').modal({ keyboard: false, backdrop: 'static' });
            } else if (game.in_draw() === true) {
                game.header('Result', '1/2-1/2');
                var pgn_html = game.pgn({ newline_char: '<br />' });
                $('#H_GAME_RESULT_TITLE').html("Game drawn.");
                $('#H_GAME_RESULT').html(pgn_html);
                $('#H_GAME_RESULT_POPUP').modal({ keyboard: false, backdrop: 'static' });
            }
            
            if ($('#H_TAKEBACK_BTN').hasClass("btn-info")) {
                $('#H_TAKEBACK_BTN').removeClass("btn-info");
                $('#H_TAKEBACK_BTN').addClass("btn-default");
                socket.emit("casual_takeback_denied", { token: token });
            }
            if ($('#H_DRAW_BTN').hasClass("btn-info")) {
                $('#H_DRAW_BTN').removeClass("btn-info");
                $('#H_DRAW_BTN').addClass("btn-default");
                socket.emit("casual_draw_declined", { token: token });
            }
        };

        var cfg = {
            draggable   : true,
            position    : game.fen(),
            showNotation: true,
            orientation : color,
            onDragStart : onDragStart,
            onDrop      : onDrop,
            onSnapEnd   : onSnapEnd,
            pieceTheme  : '../../img/chesspieces/merida/{piece}.svg'
        };
        board = ChessBoard('H_BOARD', cfg);
        updateStatus();

        socket.emit("casual_join", {token: token, color: color});
        socket.on("casual_ready", function (data) {
            $('#H_GAME_URL_POPUP').modal('hide');
        });
        socket.on("casual_room_full", function() {
            $('#H_GAME_RESULT_TITLE').html("Game in progress.");
            $('#H_GAME_RESULT').html("Feature to watch other players play is not implemented yet.");
            $('#H_GAME_RESULT_POPUP').modal({ keyboard: false, backdrop: 'static' });
        });
        socket.on("casual_make_move", function(data) {
            var move = game.move({ from: data.source, to: data.target, promotion: data.promotion });
            if (move !== null) {
                board.position(game.fen(), false);
                updateStatus();
            }
        });
        socket.on("casual_disconnection", function(data) {
            var pgn_html = game.pgn({ newline_char: '<br />' });
            $('#H_GAME_RESULT_TITLE').html("Game over. Opponent disconnected.");
            $('#H_GAME_RESULT').html(pgn_html);
            $('#H_GAME_RESULT_POPUP').modal({ keyboard: false, backdrop: 'static' });
        });
        socket.on("casual_oppn_resigned", function(data) {
            if (data.color === "white") {
                game.header('Result', '0-1');
            } else {
                game.header('Result', '1-0');
            }
            var pgn_html = game.pgn({ newline_char: '<br />' });
            $('#H_GAME_RESULT_TITLE').html("Game over. " + data.color + " resigned.");
            $('#H_GAME_RESULT').html(pgn_html);
            $('#H_GAME_RESULT_POPUP').modal({ keyboard: false, backdrop: 'static' });
        });
        
        $('#H_RESIGN_BTN').click(function(ev) {
            ev.preventDefault();
            $(this).blur();
            socket.emit('casual_resign', { token: token, color: color });
        });
        
        // Takeback - events are simiar to draw related ones
        $('#H_TAKEBACK_BTN').click(function(ev) {
            ev.preventDefault();
            $(this).blur();
            if ($('#H_TAKEBACK_BTN').hasClass("btn-info")) {
                socket.emit('casual_takeback_granted', { token: token, color: color });
                $('#H_TAKEBACK_BTN').addClass("btn-default");
            } else {
                socket.emit('casual_takeback_request', { token: token, color: color });
                socket.emit('casual_chat', { token: token, who: color, msg: " wants to takeback." });
            }
        });
        socket.on("casual_takeback_requested", function() {
            $('#H_TAKEBACK_BTN').addClass("btn-info");
        });
        socket.on("casual_takeback", function() {
            $('#H_TAKEBACK_BTN').removeClass("btn-info");
            $('#H_TAKEBACK_BTN').addClass("btn-default");
            var h = game.history({ verbose: true });
            if (h.length) {
                var last_move = h[h.length - 1];
                var boardEl = $('#H_BOARD');
                boardEl.find('.square-' + last_move.from).removeClass('highlight-last-move');
                boardEl.find('.square-' + last_move.to).removeClass('highlight-last-move');
            }
            game.undo();
            board.position(game.fen(), false);
            updateStatus();
        });
        
        // Draw - events are similar to takeback ones
        $('#H_DRAW_BTN').click(function(ev) {
            ev.preventDefault();
            $(this).blur();
            if ($('#H_DRAW_BTN').hasClass("btn-info")) {
                socket.emit('casual_draw_accepted', { token: token, color: color });
                $('#H_TAKEBACK_BTN').addClass("btn-default");
            } else {
                socket.emit('casual_draw_offer', { token: token, color: color });
                socket.emit('casual_chat', { token: token, who: color, msg: " offers a draw." });
            }
        });
        socket.on("casual_draw_offered", function(data) {
            $('#H_DRAW_BTN').addClass("btn-info");
        });
        socket.on("casual_draw", function(data) {
            game.header('Result', '1/2-1/2');
            var pgn_html = game.pgn({ newline_char: '<br />' });
            $('#H_GAME_RESULT_TITLE').html("Game drawn by agreement.");
            $('#H_GAME_RESULT').html(pgn_html);
            $('#H_GAME_RESULT_POPUP').modal({ keyboard: false, backdrop: 'static' });
        });

        // Chat
        $('#H_HAVE_FUN').click(function() {
            $(this).blur();
            socket.emit('casual_chat', { token: token, who: color, msg: "Have fun!" });
        });
        $('#H_THANKS').click(function() {
            $(this).blur();
            socket.emit('casual_chat', { token: token, who: color, msg: "Thanks!" });
        });
        $('#H_YOU_TOO').click(function() {
            $(this).blur();
            socket.emit('casual_chat', { token: token, who: color, msg: "You too!" });
        });
        socket.on("casual_chat_out", function(data) {
            $('#H_CHAT').append("<p>[" + data.who + "] " + data.msg + "</p>");
            ScrollDownTheChat();
        });

        var board_theme = 0;
        $('#H_CHANGE_BOARD_BACKGROUND').click(function(ev) {
            board_theme = board_theme + 1;
            board_theme = board_theme % 3;
            switch (board_theme) {
                case 0: // chessboard.js default (brown)
                    $('#H_BOARD .white-1e1d7').css("background-color", "#f0d9b5");
                    $('#H_BOARD .black-3c85d').css("background-color", "#b58863");
                    $('#H_BOARD .white-1e1d7').css("color", "#b58863");
                    $('#H_BOARD .black-3c85d').css("color", "#f0d9b5");
                    break;
                case 1: // blue
                    $('#H_BOARD .white-1e1d7').css("background-color", "#dee3e6");
                    $('#H_BOARD .black-3c85d').css("background-color", "#8ca2ad");
                    $('#H_BOARD .white-1e1d7').css("color", "#8ca2ad");
                    $('#H_BOARD .black-3c85d').css("color", "#dee3e6");
                    break;
                case 2: // green
                    $('#H_BOARD .white-1e1d7').css("background-color", "#ffffdd");
                    $('#H_BOARD .black-3c85d').css("background-color", "#86a666");
                    $('#H_BOARD .white-1e1d7').css("color", "#86a666");
                    $('#H_BOARD .black-3c85d').css("color", "#ffffdd");
                    break;
                default:
                    $('#H_BOARD .white-1e1d7').css("background-color", "#f0d9b5");
                    $('#H_BOARD .black-3c85d').css("background-color", "#b58863");
                    $('#H_BOARD .white-1e1d7').css("color", "#b58863");
                    $('#H_BOARD .black-3c85d').css("color", "#f0d9b5");
                    break;
            }
        });

        $('#H_DOWNLOAD_PGN_FILE').click(function() {
            $(this).blur();
            DownLoadPGN("casual_game.pgn", game.pgn({ newline_char: '\n' }));
        });
        $('#H_DOWNLOAD_PGN_FILE_MODAL_BTN').click(function() {
            $(this).blur();
            DownLoadPGN("casual_game.pgn", game.pgn({ newline_char: '\n' }));
        });
    }
});
