module.exports = {
    Spotify : {
        callback: 'http://localhost:3000/oauth/callback/spotify',
        authorize: 'https://accounts.spotify.com/authorize',
        get_token: 'https://accounts.spotify.com/api/token',
        profile: 'https://api.spotify.com/v1/me',
        userPlaylistURL: 'https://api.spotify.com/v1/me/playlists'
    },
    Youtube: {
        callback: 'http://localhost:3000/oauth/callback/youtube',
        authorize: 'https://accounts.google.com/o/oauth2/v2/auth',
        get_token: 'https://www.googleapis.com/oauth2/v4/token',
        profile: 'https://www.googleapis.com/plus/v1/people/me'
    }
};