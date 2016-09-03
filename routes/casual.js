var express = require('express');
var router  = express.Router();
var util    = require('../config/util.js');

router.get('/', function(req, res) {
    res.render('partials/human', {
        title: 'Chess Arena Casual game'
    });
});

router.post('/', function(req, res) {
    var opponent_type = req.body.oppn;
    if (opponent_type == "ai") {
        res.redirect('/ai')
    } else if (opponent_type == "hw") {
        var token = util.RandomStringOfLength(24);
        res.redirect('/casual/' + token + '/' + 'white');
    } else if (opponent_type == "hb") {
        var token = util.RandomStringOfLength(24);
        res.redirect('/casual/' + token + '/' + 'black');
    }
});

module.exports = router;
