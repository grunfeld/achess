var express  = require('express');
var mongoose = require('mongoose');
var passport = require('passport');
var util     = require('../config/util.js');

var PlayerDB = mongoose.model('PlayerDB');
var router   = express.Router();

router.get('/', function(req, res) {
    res.render('partials/register', {
        title: 'Chess Arena Sign-Up'
    });
});

router.post('/', function(req, res, next) {
    var handle    = req.body.handle;
    var email     = req.body.email;
    var password  = req.body.password;
    var password2 = req.body.password2;
    
    function checkRegexp(i, regexp) {
        if (!(regexp.test(i))) {
            return false;
        } else {
            return true;
        }
    }

    PlayerDB.findOne({handle: handle}, function(err, player) {
        if (player !== null) {
            req.flash('error_msg', 'That handle is already taken.');
            res.redirect('/register');
        } else { // No player with that handle in the database
            // User input validation
            var valid = true;
            valid = checkRegexp(handle, /^[-\w\.]{1,16}$/);
            if (!valid) {
                req.flash('error_msg', 'Bad characters in handle or it\'s too long.');
                res.redirect('/register');
            }
            valid = checkRegexp(email, /^[-\w\.@]{6,40}$/);
            if (!valid) {
                req.flash('error_msg', 'Badly formatted email address.');
                res.redirect('/register');
            }
            valid = checkRegexp(password, /^[@#%-=:\w\.\*\!\$\+\?\^\&\|\,\;]{4,32}$/);
            if (!valid) {
                req.flash('error_msg', 'Bad character(s) in password or it\'s too short/long.');
                res.redirect('/register');
            } else {
                if (password === password2) {
                    var p = new PlayerDB({
                                    handle: handle,
                                    email: email,
                                    rating_obj : {rating: 1500, rd: 200, vol:0.06},  // glicko2 recommendations
                                    password: util.encrypt(password)
                                });
                    p.save(function(err) {
                        if (err) {
                            next(err);
                        } else {
                            //console.log('New player: ' + p);
                            req.login(p, function(err) {
                                if (err) { return next(err); }
                                req.flash('success_msg', 'Welcome ' + p.handle + "!");
                                return res.redirect('/arena');
                            });
                        }
                    });
                } else {
                    req.flash('error_msg', 'Re-typed password did not match the original.');
                    res.redirect('/register');
                }
            }
        }
    });
});

module.exports = router;
