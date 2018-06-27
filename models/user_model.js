const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const userSchema = new Schema({
    spotify: {
        userId: String | Number,
        userName: String,
        access_token: String,
        refresh_token: String,
        expires_in: String,
    },
    youtube: {
        userId: String | Number,
        userName: String,
        access_token: String,
        refresh_token: String,
        expires_in: String,
    }
});

const User = mongoose.model('user', userSchema);
module.exports = User;