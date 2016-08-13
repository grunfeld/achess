var express  = require('express');
var router   = express.Router();

router.get('/', function(req, res) {

//    req.logout();
/*
	req.logOut();
	//req.flash('success_msg', 'You are logged out.');
	res.redirect('/login');
*/
    req.session.destroy(function(err) {
        res.redirect('/login'); // Inside a callback... bulletproof!
    });
});

module.exports = router;
