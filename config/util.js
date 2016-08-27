var crypto = require('crypto');

module.exports = {
    encrypt: function(plainText) {
        return crypto.createHash('sha512').update(plainText).digest('hex');
    },

    RandomString: function(length) {
        var chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghiklmnopqrstuvwxyz';
        var str = '';
        for (var i = 0; i < length; i++) {
            var random_number = Math.floor(Math.random() * chars.length);
            str += chars.substr(random_number, random_number + 1);
        }
        return str;
    },
    
    ensureAuthenticated: function(req, res, next) {
        if (req.isAuthenticated()) {
            return next();
        } else {
            //req.flash('error_msg','You are not logged in.');
            res.redirect('/login');
        }
    }
};
