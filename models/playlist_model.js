const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const playlistSchema = new Schema({
    username: String,
    items: [{
        name: String,
        image: String,
        tracks: [{
            name: String,
            duration_ms: Number,
            album: String,
            artist: String
        }]
    }]
});

const Playlist = mongoose.model('playlist', playlistSchema);
module.exports = Playlist;