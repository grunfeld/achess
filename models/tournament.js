var mongoose = require('mongoose');
var Schema   = mongoose.Schema;

var TournamentSchema = mongoose.Schema({
    name         : String,
    format       : String,
    timecontrol  : String,
    start_time   : { type: Date, default: Date.now },
    duration     : { type: Number, default: 3600000 },
    all_games_pgn: String,
    standings    : [ String ]
});

mongoose.model('TournamentDB', TournamentSchema);
