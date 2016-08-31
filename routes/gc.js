var express  = require('express');
var router   = express.Router();

router.get('/', function(req, res) {
    res.render('partials/gc', {
        title: 'Garbochess AI',
        ai   : 'garbochess'
    });
});

module.exports = router;
