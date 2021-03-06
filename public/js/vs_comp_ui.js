function CharsInAString(str, ch) {
    return (str.match(new RegExp(ch, "g")) || []).length;
}

$(document).ready(function() {

    // Keep it disabled on page load until stockfish is up; enabled when engineStatus.engineLoaded is true
    $('#AI_EVALUATE_BTN').addClass("disabled");

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
                g_backgroundEngine = new Worker("js/garbochess.js");
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
            board.position(game.fen(), false);
        }
        $('#AI_SWITCH_SIDES_BTN').removeClass("disabled");
        $('#AI_TAKEBACK_BTN').removeClass("disabled");
        $('#AI_RESIGN_BTN').removeClass("disabled");
        if (!is_stockfish_analyzing) {
            $('#AI_EVALUATE_BTN').removeClass("disabled");
        } else {
            stockfish.postMessage("stop");
        }
        updateStatus();
    }

//--------------------------------------------------------------------------

    var game = new Chess();
    var d    = moment().format("MMM Do YYYY");
    game.header('Event', 'Casual Game', 'Site', 'Chess Arena', 'Date', d, 'Round', '?', 'White', '?', 'Black', '?', 'Result', '*');
    var board,
        statusEl = $('#AI_STATUS'),
        pgnEl    = $('#AI_PGN'),
        fenEl    = $('#AI_FEN'),
        color    = 'white';
    var board_theme = 0;
    var last_game_pgn; // Used for downloading pgn from the modal
    
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
        board.clear(false);
        board.position(game.fen(), false);
        if (is_stockfish_analyzing)
            stockfish.postMessage("stop");
        if (game.game_over()) {
            EnsureAnalysisStopped();
            ResetGame();
            updateStatus();
            return;
        }
        updateStatus();
        $('#AI_SWITCH_SIDES_BTN').addClass("disabled");
        $('#AI_TAKEBACK_BTN').addClass("disabled");
        $('#AI_RESIGN_BTN').addClass("disabled");
        $('#AI_EVALUATE_BTN').addClass("disabled");
        // Call garbochess
        statusEl.html('<i class="fa fa-cog fa-spin fa-fw"></i> Thinking...');
        setTimeout(function() {
            EnsureAnalysisStopped();
            ResetGame();
            InitializeFromFen(game.fen());            
            SearchAndUpdateStatus();
        }, 1000);
    };

    // update the board position after the piece snap 
    // for castling, en passant, pawn promotion
    var onSnapEnd = function() {
        board.position(game.fen(), false);
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
        pgnEl.empty();
        
        // Hightlight the last move
        var h = game.history({ verbose: true });
        var boardEl = $('#AI_BOARD');
        if (h.length > 1) {
            var last_but_one_move = h[h.length - 2];
            boardEl.find('.square-' + last_but_one_move.from).removeClass('highlight-last-move');
            boardEl.find('.square-' + last_but_one_move.to).removeClass('highlight-last-move');
        }
        if (h.length) {
            var last_move = h[h.length - 1];
            boardEl.find('.square-' + last_move.from).addClass('highlight-last-move');
            boardEl.find('.square-' + last_move.to).addClass('highlight-last-move');

            //pgnEl.html(game.pgn({ max_width: 5, newline_char: '<br />' }));
            //pgnEl.animate({scrollTop: 10000}); // scroll down to the last move
            var pgn_text = "<table class=\"table table-striped\">";
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
        $('#AI_SELF_MATERIAL_DIFF').empty();
        $('#AI_OPPN_MATERIAL_DIFF').empty();
        var diff = 0;
        if (wp > bp) {
            diff = wp - bp;
            $('#AI_SELF_MATERIAL_DIFF').prepend('<img src="img/chesspieces/regular/bp.svg" alt="P" height="28" />&times;' + diff.toString());
        } else if (bp > wp) {
            diff = bp - wp;
            $('#AI_OPPN_MATERIAL_DIFF').prepend('<img src="img/chesspieces/regular/bp.svg" alt="P" height="28" />&times;' + diff.toString());
        }
        if (wn > bn) {
            diff = wn - bn;
            $('#AI_SELF_MATERIAL_DIFF').prepend('<img src="img/chesspieces/regular/bn.svg" alt="N" height="28" />&times;' + diff.toString());
        } else if (bn > wn) {
            diff = bn - wn;
            $('#AI_OPPN_MATERIAL_DIFF').prepend('<img src="img/chesspieces/regular/bn.svg" alt="N" height="28" />&times;' + diff.toString());
        }
        if (wb > bb) {
            diff = wb - bb;
            $('#AI_SELF_MATERIAL_DIFF').prepend('<img src="img/chesspieces/regular/bb.svg" alt="B" height="28" />&times;' + diff.toString());
        } else if (bb > wb) {
            diff = bb - wb;
            $('#AI_OPPN_MATERIAL_DIFF').prepend('<img src="img/chesspieces/regular/bb.svg" alt="B" height="28" />&times;' + diff.toString());
        }
        if (wr > br) {
            diff = wr - br;
            $('#AI_SELF_MATERIAL_DIFF').prepend('<img src="img/chesspieces/regular/br.svg" alt="R" height="28" />&times;' + diff.toString());
        } else if (br > wr) {
            diff = br - wr;
            $('#AI_OPPN_MATERIAL_DIFF').prepend('<img src="img/chesspieces/regular/br.svg" alt="R" height="28" />&times;' + diff.toString());
        }
        if (wq > bq) {
            diff = wq - bq;
            $('#AI_SELF_MATERIAL_DIFF').prepend('<img src="img/chesspieces/regular/bq.svg" alt="Q" height="28" />&times;' + diff.toString());
        } else if (bq > wq) {
            diff = bq - wq;
            $('#AI_OPPN_MATERIAL_DIFF').prepend('<img src="img/chesspieces/regular/bq.svg" alt="Q" height="28" />&times;' + diff.toString());
        }

        if ($('#AI_RESIGN_BTN_ICON').hasClass("fa-check")) // Take away confirm-resign? icon
            $('#AI_RESIGN_BTN_ICON').removeClass("fa-check").addClass("fa-flag");

        var game_is_over = false;
        if (game.in_checkmate() === true) {
            if (game.turn() == 'w') {
                game.header('Result', '0-1');
            } else {
                game.header('Result', '1-0');
            }
            var pgn_html  = game.pgn({ newline_char: '<br />' });
            last_game_pgn = game.pgn({ newline_char: '\n' });
            $('#AI_GAME_RESULT_TITLE').html("Game over.");
            $('#AI_GAME_RESULT').html(pgn_html);
            $('#AI_GAME_RESULT_POPUP').modal({ keyboard: false, backdrop: 'static' });
            game_is_over = true;
        } else if (game.in_draw() === true) {
            game.header('Result', '1/2-1/2');
            var pgn_html  = game.pgn({ newline_char: '<br />' });
            last_game_pgn = game.pgn({ newline_char: '\n' });
            $('#AI_GAME_RESULT_TITLE').html("Game drawn.");
            $('#AI_GAME_RESULT').html(pgn_html);
            $('#AI_GAME_RESULT_POPUP').modal({ keyboard: false, backdrop: 'static' });
            game_is_over = true;
        }
        
        if (game_is_over === true) {
            // Setup the board for the next game
            $('#AI_STOCKFISH_EVAL_OUTPUT').html('Coach: Stockfish 6');
            var h = game.history({ verbose: true });
            if (h.length) {
                var last_move = h[h.length - 1];
                var boardEl = $('#AI_BOARD');
                boardEl.find('.square-' + last_move.from).removeClass('highlight-last-move');
                boardEl.find('.square-' + last_move.to).removeClass('highlight-last-move');
            }
            game.reset();
            var d = moment().format("MMM Do YYYY");
            game.header('Event', 'Casual Game', 'Site', 'Chess Arena', 'Date', d, 'Round', '?', 'White', '?', 'Black', '?', 'Result', '*');
            if (color == 'black') {
                color = 'white';
                board.flip();
                ChangeBoardBackground(board_theme);
            }
            board.position(game.fen(), false);
            updateStatus();
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
    $('#AI_BOARD .white-1e1d7').css("background-color", "#e8e1d9");
    $('#AI_BOARD .black-3c85d').css("background-color", "#b2997f");
    $('#AI_BOARD .white-1e1d7').css("color", "#b2997f");
    $('#AI_BOARD .black-3c85d').css("color", "#e8e1d9");
    updateStatus();

    $('#AI_SWITCH_SIDES_BTN').click(function() {
        $(this).blur();
        if ($(this).hasClass("disabled"))
            return;
        if (game.game_over() === true)
            return;
        if (is_stockfish_analyzing)
            stockfish.postMessage("stop");
        board.flip();
        ChangeBoardBackground(board_theme);
        if (color == 'white')
            color = 'black';
        else
            color = 'white';
        $('#AI_SWITCH_SIDES_BTN').addClass("disabled");
        $('#AI_TAKEBACK_BTN').addClass("disabled");
        $('#AI_RESIGN_BTN').addClass("disabled");
        $('#AI_EVALUATE_BTN').addClass("disabled");
        $('#AI_STOCKFISH_EVAL_OUTPUT').html('Coach: Stockfish 6');
        $('#AI_STATUS').html('<i class="fa fa-cog fa-spin fa-fw"></i> Thinking...');
        setTimeout(function() {
            EnsureAnalysisStopped();
            ResetGame();
            InitializeFromFen(game.fen());
            SearchAndUpdateStatus();
        }, 1000);
    });
    
    $('#AI_TAKEBACK_BTN').click(function() {
        $(this).blur();
        if ($(this).hasClass("disabled"))
            return;
        if (is_stockfish_analyzing)
            stockfish.postMessage("stop");
        var h = game.history({ verbose: true });
        if (h.length < 1)
            return;

        // Remove the last-move highlight
        var last_move = h[h.length - 1];
        var boardEl = $('#AI_BOARD');
        boardEl.find('.square-' + last_move.from).removeClass('highlight-last-move');
        boardEl.find('.square-' + last_move.to).removeClass('highlight-last-move');
        
        if (h.length < 2) { // This takeback switches sides (maybe needed for FEN setup)
            game.undo(); // opponent's move
            if (color == 'black')
                color = 'white';
            else
                color = 'black';
            board.flip();
            ChangeBoardBackground(board_theme);
        } else {
            game.undo(); // opponent's move
            game.undo(); // your last move
        }
        board.position(game.fen(), false);
        $('#AI_STOCKFISH_EVAL_OUTPUT').html('Coach: Stockfish 6');
        updateStatus();
    });
    
    $('#AI_RESIGN_BTN').click(function() {
        $(this).blur();
        if ($(this).hasClass("disabled"))
            return;
        
        // First confirm the resignation
        if ($('#AI_RESIGN_BTN_ICON').hasClass("fa-flag")) {
            $('#AI_RESIGN_BTN_ICON').removeClass("fa-flag").addClass("fa-check");
            return;
        } else {
            $('#AI_RESIGN_BTN_ICON').removeClass("fa-check").addClass("fa-flag");
        }

        if (is_stockfish_analyzing)
            stockfish.postMessage("stop");
        $('#AI_STOCKFISH_EVAL_OUTPUT').html('Coach: Stockfish 6');
        // Show the game-result modal allow which allows pgn to be downloaded
        var pgn_html  = game.pgn({ newline_char: '<br />' });
        last_game_pgn = game.pgn({ newline_char: '\n' });
        $('#AI_GAME_RESULT_TITLE').html("Game over.");
        $('#AI_GAME_RESULT').html(pgn_html);
        $('#AI_GAME_RESULT_POPUP').modal({ keyboard: false, backdrop: 'static' });
        
        var h = game.history({ verbose: true });
        if (h.length) {
            var last_move = h[h.length - 1];
            var boardEl = $('#AI_BOARD');
            boardEl.find('.square-' + last_move.from).removeClass('highlight-last-move');
            boardEl.find('.square-' + last_move.to).removeClass('highlight-last-move');
        }
        game.reset();
        var d = moment().format("MMM Do YYYY");
        game.header('Event', 'Casual Game', 'Site', 'Chess Arena', 'Date', d, 'Round', '?', 'White', '?', 'Black', '?', 'Result', '*');
        if (color == 'black') {
            color = 'white';
            board.flip();
            ChangeBoardBackground(board_theme);
        }
        board.position(game.fen(), false);
        updateStatus();
    });
    
    // Board theme related stuff
    function ChangeBoardBackground(board_theme) {
        switch (board_theme) {
            case 0: // greenish
                $('#AI_BOARD .white-1e1d7').css("background-color", "#e8e1d9");
                $('#AI_BOARD .black-3c85d').css("background-color", "#b2997f");
                $('#AI_BOARD .white-1e1d7').css("color", "#b2997f");
                $('#AI_BOARD .black-3c85d').css("color", "#e8e1d9");
                break;
            case 1: // blue
                $('#AI_BOARD .white-1e1d7').css("background-color", "#dee3e6");
                $('#AI_BOARD .black-3c85d').css("background-color", "#8ca2ad");
                $('#AI_BOARD .white-1e1d7').css("color", "#8ca2ad");
                $('#AI_BOARD .black-3c85d').css("color", "#dee3e6");
                break;
            case 2: // chessboard.js default (brown)
                $('#AI_BOARD .white-1e1d7').css("background-color", "#f0d9b5");
                $('#AI_BOARD .black-3c85d').css("background-color", "#b58863");
                $('#AI_BOARD .white-1e1d7').css("color", "#b58863");
                $('#AI_BOARD .black-3c85d').css("color", "#f0d9b5");
                break;
            default: // greenish
                $('#AI_BOARD .white-1e1d7').css("background-color", "#e8e1d9");
                $('#AI_BOARD .black-3c85d').css("background-color", "#b2997f");
                $('#AI_BOARD .white-1e1d7').css("color", "#b2997f");
                $('#AI_BOARD .black-3c85d').css("color", "#e8e1d9");
                break;
        }
    }
    
    $('#AI_CHANGE_BOARD_BACKGROUND').click(function(ev) {
        board_theme = board_theme + 1;
        board_theme = board_theme % 3;
        ChangeBoardBackground(board_theme);
    });
    
    $('#LOAD_FEN_BTN').click(function() {
        var user_fen         =  $('#FEN_INPUT').val();
        var trimmed_user_fen = user_fen.trim();
        $('#FEN_INPUT_MODAL').modal("hide");
        var trial      = new Chess();
        var fen_result = trial.validate_fen(trimmed_user_fen);
        if (!fen_result.valid) {
            $('#AI_STATUS').empty();
            $('#AI_STATUS').html(fen_result.error);
            return;
        }
        
        if (trial.load(trimmed_user_fen)) {
        var h = game.history({ verbose: true });
            if (h.length) {
                var last_move = h[h.length - 1];
                var boardEl = $('#AI_BOARD');
                boardEl.find('.square-' + last_move.from).removeClass('highlight-last-move');
                boardEl.find('.square-' + last_move.to).removeClass('highlight-last-move');
            }
            if (color == 'black') {
                color = 'white';
                board.flip();
                ChangeBoardBackground(board_theme);
            }            
            game.load(trimmed_user_fen);
            if (game.turn() == 'b') {
                color = 'black';
                board.flip();
                ChangeBoardBackground(board_theme);
            } else{
                color = 'white';
            }
            board.position(game.fen(), false);
            updateStatus();
        } else {
            $('#AI_STATUS').empty();
            $('#AI_STATUS').html('<strong>Loading FEN failed</strong>');
        }
    });
    
    $('#AI_DOWNLOAD_PGN_FILE_BTN').click(function() {
        $(this).blur();
        DownLoadPGN("game_vs_gc.pgn", game.pgn({ newline_char: '\n' }));
    });
    $('#AI_DOWNLOAD_PGN_FILE_MODAL_BTN').click(function() {
        $(this).blur();
        DownLoadPGN("game_vs_gc.pgn", last_game_pgn);
    });
    
    var stockfish              = new Worker("js/stockfish.js");
    var engineStatus           = {};
    var position_for_analysis  = "";
    var is_stockfish_analyzing = false;
    stockfish.postMessage("uci");
    
    $('#AI_EVALUATE_BTN').click(function() {
        $(this).blur();
        if ($(this).hasClass("disabled"))
            return;
        if (!is_stockfish_analyzing) {
            engineStatus = {};
            stockfish.postMessage("isready");
            position_for_analysis = game.fen();
            stockfish.postMessage("position fen " + position_for_analysis);
            stockfish.postMessage("go depth 16");
            is_stockfish_analyzing = true;
            $('#AI_EVALUATE_BTN').addClass("disabled");
        }
    });

    stockfish.onmessage = function(event) {
        var line = event.data;
        if (line == 'uciok') {
            engineStatus.engineLoaded = true;
        } else if (line == 'readyok') {
            engineStatus.engineReady = true;
        } else {
            var match = line.match(/^bestmove ([a-h][1-8])([a-h][1-8])([qrbn])?/);
            if (match) {
                var dummy_game = new Chess(position_for_analysis);
                var move_obj;
                if (typeof match[3] === 'undefined') {
                    move_obj = dummy_game.move( {from: match[1], to: match[2]} );
                } else {
                    move_obj = dummy_game.move( {from: match[1], to: match[2], promotion: match[3]} );
                }
                engineStatus.best_move = move_obj.san;
                is_stockfish_analyzing = false;
                $('#AI_EVALUATE_BTN').removeClass("disabled");
            } else if (match = line.match(/^info .*\bdepth (\d+) .*\bnps (\d+) .*\bpv (.*)/)) {
                engineStatus.search = 'Depth: ' + match[1] + ' NPS: ' + match[2];
                engineStatus.pv     = match[3];
            }
            if (match = line.match(/^info .*\bscore (\w+) (-?\d+)/)) {
                var score = parseInt(match[2]) * (game.turn() == 'w' ? 1 : -1);
                if (match[1] == 'cp') {
                    engineStatus.score = (score / 100.0).toFixed(2);
                } else if (match[1] == 'mate') {
                    engineStatus.score = '#' + score;
                }
                if (match = line.match(/\b(upper|lower)bound\b/)) {
                    engineStatus.score = ((match[1] == 'upper') == (game.turn() == 'w') ? '<= ' : '>= ') + engineStatus.score;
                }
            }
        }
        updateEvaluationDisplay();
    };

    function updateEvaluationDisplay() {
        var status = 'Coach: Stockfish 6';
        if (engineStatus.engineLoaded) {
            if ($('#AI_EVALUATE_BTN').hasClass("disabled"))
                $('#AI_EVALUATE_BTN').removeClass("disabled");
        }
        if (engineStatus.search) {
            status += '<br>' + engineStatus.search;
            if (engineStatus.score) {
                status += '<br />Score: ' + engineStatus.score;
                status += '<br />PV: ' + engineStatus.pv;
            }
            if (engineStatus.best_move) {
                status += '<br/><b>Best move: ' + engineStatus.best_move + '</b>';
            }
        }
        $('#AI_STOCKFISH_EVAL_OUTPUT').html(status);
    }
    
});
