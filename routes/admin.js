var express = require('express');
var router  = express.Router();
var util    = require('../config/util.js');

router.get('/', util.ensureAuthenticated, function(req, res) {
    if (req.user.handle == "admin") {
        res.render('partials/admin', {
            title: 'Chess Arena admin',
            player: req.user
        });
    } else {
        req.flash('error_msg', 'YOU SHALL NOT PASS!');
        res.redirect('/arena');
    }
});

module.exports = router;
