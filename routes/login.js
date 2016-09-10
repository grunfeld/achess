var express      = require('express');
var mongoose     = require('mongoose');
var passport     = require('passport');
var _            = require('lodash');
var MobileDetect = require('mobile-detect');

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
        PlayerDB.findOne({handle: req.user.handle}, function(err, player_db) {
            //req.flash('success_msg', 'Hello ' + player.handle + '!');
            if (req.user.handle === "admin") {
                res.redirect('/admin');
            } else {
                var md = new MobileDetect(req.headers['user-agent']);
                if (md.phone() != null || md.tablet() != null || md.mobile() != null) {
                    res.render('partials/nomobile', {
                        title: 'Chess Arena Mobile'
                    });
                } else {
                    res.render('partials/arena', {
                        title        : 'Chess Arena',
                        player       : req.user, // The html page layout.bhs extracts .handle attribute
                        player_rating: _.floor(player_db.rating_obj.rating),
                        player_rd    : _.floor(player_db.rating_obj.rd)
                    });
                }
            }
        });
 });

module.exports = router;
