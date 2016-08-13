var mongoose = require('mongoose');
var util     = require('../config/util.js');

var PlayerSchema = mongoose.Schema({
    handle     : String,
    email      : String,
    rating_obj : {
                    rating : {type: Number, default: 1500 },
                    rd     : {type: Number, default: 200},
                    vol    : {type: Number, default: 0.06}
                 },
    password   : String
});

PlayerSchema.methods = {
    authenticate: function (plainText) {
        return util.encrypt(plainText) == this.password;
    }
};

mongoose.model('PlayerDB', PlayerSchema);
