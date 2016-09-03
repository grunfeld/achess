function CharsInAString(str, ch) {
    return (str.match(new RegExp(ch, "g")) || []).length;
}

$(document).ready(function() {
    //var base_url = 'http://localhost:3333'
    var base_url = 'https://chess-arena.herokuapp.com';
    var socket = io.connect(base_url);

    if ($('#H_BOARD').length) {
        var token = $('#H_BOARD').data('token');
        var color  = $('#H_BOARD').data('orientation');
        var opponent_color = (color === "white") ? "black" : "white";
        socket.on('casual_wait', function () {
            var url = base_url + '/casual/' + token + "/" + opponent_color;
            $('#H_GAME_URL').html(url);
            $('#H_GAME_URL_POPUP').modal({ keyboard: false, backdrop: 'static' });
        });

        var game = new Chess();
        game.header('Event', 'Casual Game', 'Site', 'Chess Arena', 'Date', '?', 'Round', '?', 'White', 'Anon', 'Black', 'Anon', 'Result', '*');
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
            pgnEl.html(game.pgn({max_width: 5, newline_char: '<br />'}));
            pgnEl.animate({scrollTop: 10000}); // scroll down to the last move
            fenEl.html(game.fen());
            
            // Hightlight the last move
            var h = game.history({ verbose: true });
            if (h.length > 1) {
                var last_but_one_move = h[h.length - 2];
                var boardEl = $('#H_BOARD');
                boardEl.find('.square-' + last_but_one_move.from).removeClass('highlight-last-move');
                boardEl.find('.square-' + last_but_one_move.to).removeClass('highlight-last-move');
            }
            if (h.length) {
                var last_move = h[h.length - 1];
                var boardEl = $('#H_BOARD');
                boardEl.find('.square-' + last_move.from).addClass('highlight-last-move');
                boardEl.find('.square-' + last_move.to).addClass('highlight-last-move');
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
            if (wp > bp) {
                var diff = wp - bp;
                $('#H_SELF_MATERIAL_DIFF').prepend('<img src="../../../img/chesspieces/regular/bp.svg" height="28" />&times;' + diff.toString());
            } else if (bp > wp) {
                var diff = bp - wp;
                $('#H_OPPN_MATERIAL_DIFF').prepend('<img src="../../../img/chesspieces/regular/bp.svg" height="28" />&times;' + diff.toString());
            }
            if (wn > bn) {
                var diff = wn - bn;
                $('#H_SELF_MATERIAL_DIFF').prepend('<img src="../img/chesspieces/regular/bn.svg" height="28" />&times;' + diff.toString());
            } else if (bn > wn) {
                var diff = bn - wn;
                $('#H_OPPN_MATERIAL_DIFF').prepend('<img src="../img/chesspieces/regular/bn.svg" height="28" />&times;' + diff.toString());
            }
            if (wb > bb) {
                var diff = wb - bb;
                $('#H_SELF_MATERIAL_DIFF').prepend('<img src="../img/chesspieces/regular/bb.svg" height="28" />&times;' + diff.toString());
            } else if (bb > wb) {
                var diff = bb - wb;
                $('#H_OPPN_MATERIAL_DIFF').prepend('<img src="../img/chesspieces/regular/bb.svg" height="28" />&times;' + diff.toString());
            }
            if (wr > br) {
                var diff = wr - br;
                $('#H_SELF_MATERIAL_DIFF').prepend('<img src="../img/chesspieces/regular/br.svg" height="28" />&times;' + diff.toString());
            } else if (br > wr) {
                var diff = br - wr;
                $('#H_OPPN_MATERIAL_DIFF').prepend('<img src="../img/chesspieces/regular/br.svg" height="28" />&times;' + diff.toString());
            }
            if (wq > bq) {
                var diff = wq - bq;
                $('#H_SELF_MATERIAL_DIFF').prepend('<img src="../img/chesspieces/regular/bq.svg" height="28" />&times;' + diff.toString());
            } else if (bq > wq) {
                var diff = bq - wq;
                $('#H_OPPN_MATERIAL_DIFF').prepend('<img src="../img/chesspieces/regular/bq.svg" height="28" />&times;' + diff.toString());
            }
            
            // Show the result-modal if the game has ended
            if (game.in_checkmate() === true) {
                if (game.turn() === 'w') {
                    game.header('Result', '0-1');
                } else {
                    game.header('Result', '1-0');
                }
                var raw_pgn  = game.pgn();
                var pgn_html = raw_pgn.split(']').join(']<br>'); // WOW!
                $('#H_GAME_RESULT_TITLE').html("Game over.");
                $('#H_GAME_RESULT').html(pgn_html);
                $('#H_GAME_RESULT_POPUP').modal({ keyboard: false, backdrop: 'static' });
            } else if (game.in_draw() === true) {
                game.header('Result', '1/2-1/2');
                var raw_pgn  = game.pgn();
                var pgn_html = raw_pgn.split(']').join(']<br>'); // WOW!
                $('#H_GAME_RESULT_TITLE').html("Game drawn.");
                $('#H_GAME_RESULT').html(pgn_html);
                $('#H_GAME_RESULT_POPUP').modal({ keyboard: false, backdrop: 'static' });
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
        socket.on("casual_make_move", function(data) {
            var move = game.move({ from: data.source, to: data.target, promotion: data.promotion });
            if (move !== null) {
                board.position(game.fen(), false);
                updateStatus();
            }
        });
        socket.on("casual_disconnection", function(data) {
            var raw_pgn  = game.pgn();
            var pgn_html = raw_pgn.split(']').join(']<br>'); // WOW!
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
            var raw_pgn  = game.pgn();
            var pgn_html = raw_pgn.split(']').join(']<br>'); // WOW!
            $('#H_GAME_RESULT_TITLE').html("Game over. " + data.color + " resigned.");
            $('#H_GAME_RESULT').html(pgn_html);
            $('#H_GAME_RESULT_POPUP').modal({ keyboard: false, backdrop: 'static' });
        });
        
        $('#H_RESIGN_BTN').click(function(ev) {
            ev.preventDefault();
            $(this).blur();
            socket.emit('casual_resign', {token: token, color: color });
        });
    }
});
