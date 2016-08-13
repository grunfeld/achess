var express  = require('express');
var mongoose = require('mongoose');
var passport = require('passport');

var PlayerDB = mongoose.model('PlayerDB');
var router   = express.Router();

router.get('/', function(req, res) {
    res.render('partials/login', {
        title: 'Chess Arena login'
    });
});

router.post('/',
    passport.authenticate('local', {failureRedirect: '/login', failureFlash: true}),
    function(req, res) {
        PlayerDB.findOne({handle: req.user.handle}, function(err, player) {
            //req.flash('success_msg', 'Hello ' + player.handle + '!');
            if (req.user.handle === "admin") {
                res.redirect('/admin');
            } else {
                res.redirect('/arena');
            }
        });
 });

module.exports = router;
