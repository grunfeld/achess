var express = require('express');
var router  = express.Router();
var util    = require('../config/util.js');

// Homepage
router.get('/', util.ensureAuthenticated, function(req, res) {
	res.redirect('/login');
});


router.get('/casual/:token/:color', function(req, res) {
    var token = req.params.token;
    var color = req.params.color;
    res.render('partials/human', {
        title: 'Chess Arena Casual Game',
        token: token,
        color: color
    });
});

module.exports = router;
