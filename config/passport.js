var mongoose      = require('mongoose');
var LocalStrategy = require('passport-local').Strategy;
var PlayerDB      = mongoose.model('PlayerDB');

module.exports = function (app, passport) {

    // Serialize sessions
    passport.serializeUser(function(user, done) {
        done(null, user.id);
    });
    passport.deserializeUser(function(id, done) {
        PlayerDB.findById(id, function (err, user) {
            done(err, user);
        });
    });

    // Use local strategy
    passport.use(new LocalStrategy({
            usernameField: 'handle',
            passwordField: 'password'
        },
        function(handle, password, done) {
            var query = {handle: handle};
            PlayerDB.findOne(query, function(err, user) {
                if (err) {
                    return done(err);
                }
                if (!user) {
                    return done(null, false, { message: 'This handle is not registered.' });
                }
                if (!user.authenticate(password)) {
                    return done(null, false, { message: 'Incorrect password.' });
                }
                return done(null, user);
            });
        }
    ));
};
