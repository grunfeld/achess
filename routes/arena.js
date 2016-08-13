var express = require('express');
var router  = express.Router();
var util    = require('../config/util.js');

router.get('/', util.ensureAuthenticated, function(req, res) {
    res.render('partials/arena', {
        title: 'Chess Arena',
        player: req.user
    });
});

module.exports = router;
