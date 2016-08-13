var express = require('express');
var router  = express.Router();
var util    = require('../config/util.js');

// Homepage
router.get('/', util.ensureAuthenticated, function(req, res) {
	res.redirect('/arena');
});

module.exports = router;
