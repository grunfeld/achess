var express  = require('express');
var router   = express.Router();

router.post('/', function(req, res) {
    res.setHeader('Content-disposition', 'attachment; filename=chess_arena_games.pgn');
    res.setHeader('Content-type', 'text/plain');
    res.charset = 'UTF-8';
    res.write(req.body.pgns);
    res.end();
});

module.exports = router;
