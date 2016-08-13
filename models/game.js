var mongoose = require('mongoose');
var Schema   = mongoose.Schema;

var GameSchema = mongoose.Schema({
    id          : String,
    white       : { type: Schema.ObjectId, ref: 'PlayerDB' },
    black       : { type: Schema.ObjectId, ref: 'PlayerDB' },
    timecontrol : String,
    pgn         : String,
    result      : String,
    date        : { type: Date, default: Date.now },
    rated       : { type: Boolean, default: true }
});

mongoose.model('GameDB', GameSchema);
