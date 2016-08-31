function CharsInAString(str, ch) {
    return (str.match(new RegExp(ch, "g")) || []).length;
}

$(document).ready(function() {

//--------------------------------------------------------------------------
    g_timeout = 5000;
    function EnsureAnalysisStopped() {
        if (g_backgroundEngine != null) {
            g_backgroundEngine.terminate();
            g_backgroundEngine = null;
        }
    }

    var g_backgroundEngineValid = true;
    var g_backgroundEngine;

    function InitializeBackgroundEngine() {
        if (!g_backgroundEngineValid) {
            return false;
        }
        if (g_backgroundEngine == null) {
            g_backgroundEngineValid = true;
            try {
                g_backgroundEngine = new Worker("garbochess.js");
                g_backgroundEngine.error = function (e) {
                    alert("Error from background worker:" + e.message);
                };
            } catch (error) {
                g_backgroundEngineValid = false;
            }
        }
        return g_backgroundEngineValid;
    }

    function SearchAndUpdateStatus() {
        if (InitializeBackgroundEngine())
            Search(FinishMoveCB, 99, null);
    }
    
    function FinishMoveCB(bestMove, value, timeTaken, ply) {
        if (bestMove != null) {
            var alg_notation_move = FormatMove(bestMove);
            var f = alg_notation_move.substring(0, 2);
            var t = alg_notation_move.substring(2, 4);
            var prom = 'q';
            if (alg_notation_move.length == 5)
                prom = alg_notation_move[4];
            game.move({ from: f, to: t, promotion: prom });
            board.position(game.fen());
        }
        $('#AI_SWITCH_SIDES_BTN').removeClass("disabled");
        $('#AI_TAKEBACK_BTN').removeClass("disabled");
        $('#AI_RESIGN_BTN').removeClass("disabled");
        updateStatus();            
    }

//--------------------------------------------------------------------------

    var game     = new Chess();
    var board,
        statusEl = $('#AI_STATUS'),
        pgnEl    = $('#AI_PGN'),
        color    = 'white';

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
        board.clear(false);
        board.position(game.fen());
        updateStatus();
        
        $('#AI_SWITCH_SIDES_BTN').addClass("disabled");
        $('#AI_TAKEBACK_BTN').addClass("disabled");
        $('#AI_RESIGN_BTN').addClass("disabled");
        // Call garbochess
        EnsureAnalysisStopped();
        ResetGame();
        InitializeFromFen(game.fen());
        statusEl.html("Thinking...");
        setTimeout(function() {
            SearchAndUpdateStatus();
        }, 50);
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
        var h = game.history({ verbose: true });
        if (h.length) {
            var last_move = h[h.length - 1];
            var boardEl = $('#AI_BOARD');
            boardEl.find('.square-' + last_move.from).addClass('highlight-last-move');
            boardEl.find('.square-' + last_move.to).addClass('highlight-last-move');
        }
        if (h.length > 1) {
            var last_but_one_move = h[h.length - 2];
            var boardEl = $('#AI_BOARD');
            boardEl.find('.square-' + last_but_one_move.from).removeClass('highlight-last-move');
            boardEl.find('.square-' + last_but_one_move.to).removeClass('highlight-last-move');
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
        if (color === 'black') {
            var c = bp; bp = wp; wp = c;
                c = bn; bn = wn; wn = c;
                c = bb; bb = wb; wb = c;
                c = br; br = wr; wr = c;
                c = bq; bq = wq; wq = c;
        }
        $('#AI_SELF_MATERIAL_DIFF').empty();
        $('#AI_OPPN_MATERIAL_DIFF').empty();
        if (wp > bp) {
            var diff = wp - bp;
            $('#AI_SELF_MATERIAL_DIFF').prepend('<img src="../img/chesspieces/regular/bp.svg" height="28" />&times;' + diff.toString());
        } else if (bp > wp) {
            var diff = bp - wp;
            $('#AI_OPPN_MATERIAL_DIFF').prepend('<img src="../img/chesspieces/regular/bp.svg" height="28" />&times;' + diff.toString());
        }
        if (wn > bn) {
            var diff = wn - bn;
            $('#AI_SELF_MATERIAL_DIFF').prepend('<img src="../img/chesspieces/regular/bn.svg" height="28" />&times;' + diff.toString());
        } else if (bn > wn) {
            var diff = bn - wn;
            $('#AI_OPPN_MATERIAL_DIFF').prepend('<img src="../img/chesspieces/regular/bn.svg" height="28" />&times;' + diff.toString());
        }
        if (wb > bb) {
            var diff = wb - bb;
            $('#AI_SELF_MATERIAL_DIFF').prepend('<img src="../img/chesspieces/regular/bb.svg" height="28" />&times;' + diff.toString());
        } else if (bb > wb) {
            var diff = bb - wb;
            $('#AI_OPPN_MATERIAL_DIFF').prepend('<img src="../img/chesspieces/regular/bb.svg" height="28" />&times;' + diff.toString());
        }
        if (wr > br) {
            var diff = wr - br;
            $('#AI_SELF_MATERIAL_DIFF').prepend('<img src="../img/chesspieces/regular/br.svg" height="28" />&times;' + diff.toString());
        } else if (br > wr) {
            var diff = br - wr;
            $('#AI_OPPN_MATERIAL_DIFF').prepend('<img src="../img/chesspieces/regular/br.svg" height="28" />&times;' + diff.toString());
        }
        if (wq > bq) {
            var diff = wq - bq;
            $('#AI_SELF_MATERIAL_DIFF').prepend('<img src="../img/chesspieces/regular/bq.svg" height="28" />&times;' + diff.toString());
        } else if (bq > wq) {
            var diff = bq - wq;
            $('#AI_OPPN_MATERIAL_DIFF').prepend('<img src="../img/chesspieces/regular/bq.svg" height="28" />&times;' + diff.toString());
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
        pieceTheme  : 'img/chesspieces/merida/{piece}.svg'
    };
    board = ChessBoard('AI_BOARD', cfg);
    updateStatus();

    $('#AI_SWITCH_SIDES_BTN').click(function() {
        $(this).blur();
        if ($(this).hasClass("disabled"))
            return;
        board.flip();
        if (color == 'white')
            color = 'black';
        else
            color = 'white';
        $('#AI_SWITCH_SIDES_BTN').addClass("disabled");
        $('#AI_TAKEBACK_BTN').addClass("disabled");
        $('#AI_RESIGN_BTN').addClass("disabled");
        EnsureAnalysisStopped();
        ResetGame();
        InitializeFromFen(game.fen());
        $('#AI_STATUS').html("Thinking...");
        setTimeout(function() {
            SearchAndUpdateStatus();
        }, 50);
    });
    
    $('#AI_TAKEBACK_BTN').click(function() {
        $(this).blur();
        var h = game.history({ verbose: true });
        if (h.length < 2) // Cannot takeback opponent's move
            return;
        if (h.length) {
            var last_move = h[h.length - 1];
            var boardEl = $('#AI_BOARD');
            boardEl.find('.square-' + last_move.from).removeClass('highlight-last-move');
            boardEl.find('.square-' + last_move.to).removeClass('highlight-last-move');
        }
        game.undo(); // opponent's move
        game.undo(); // your last move
        board.position(game.fen());
    });
});
