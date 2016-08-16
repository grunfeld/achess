var fs           = require('fs');
var path         = require('path');
var express      = require('express');
var session      = require('express-session');
var cookieParser = require('cookie-parser');
var bodyParser   = require('body-parser');
var mongoose     = require('mongoose');
var passport     = require('passport');
var flash        = require('connect-flash');
var config       = require('config');
var favicon      = require('serve-favicon');

var env = process.env.NODE_ENV || 'default';
var app = express();

// Configure database
require('./config/db')(app, mongoose);
// Read-in the data models
fs.readdirSync(__dirname + '/models').forEach(function (file) {
    if (~file.indexOf('.js')) require(__dirname + '/models/' + file);
});

// Configure the application -------------------------------------------------
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'hbs');
app.use(favicon(__dirname + '/public/favicon.ico'));

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: false}));

// Express session
app.use(express.static(path.join(__dirname, 'public')));
app.use(cookieParser('ACH35S'));
app.use(session({secret: 'S3S5I0N', saveUninitialized: true, resave: true}));
app.use(flash());

app.use(function (req, res, next) {
    res.locals.success_msg = req.flash('success_msg');
    res.locals.error_msg   = req.flash('error_msg');
    res.locals.error       = req.flash('error');
    res.locals.user        = req.user || null;
    next();
});

// Passport initialization
require('./config/passport')(app, passport);
app.use(passport.initialize());
app.use(passport.session());

// Configure routes
app.use('/',         require('./routes/index'));
app.use('/login',    require('./routes/login'));
app.use('/register', require('./routes/register'));
app.use('/arena',    require('./routes/arena'));
app.use('/admin',    require('./routes/admin'));
app.use('/dpgn',     require('./routes/download'));
app.use('/logout',   require('./routes/logout'));


// The 404 Route (ALWAYS Keep this as the last route)
app.get('*', function(req, res){
    res.status(404).send('404: Page not Found');
});

// Configure error handlers
require('./config/error_handlers.js')(app);
//-----------------------------------------------------------------------------

var port   = process.env.PORT || 3333;
var server = require('http').createServer(app).listen(port);
console.log('Server running on port 3333');
require('./config/socket.js')(server);

module.exports = app;
