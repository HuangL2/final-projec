const express = require('express'),
    request = require('request'),
    jwt = require('jsonwebtoken');
const Playlist = require('../models/playlist_model'),
    User = require('../models/user_model');
const keys = require('../config/keys'),
    urls = require('../config/urls');
const {google} = require('googleapis'),
    youtube = google.youtube('v3');

const router = express();

const authCheckSpotify = (req, res, next) => {
    const userJWT = req.cookies.spotifyCode;
    if(!userJWT)
        res.send(401, 'Invalid or missing Spotify code');
    else {
        const userJWYPayload = jwt.verify(userJWT, keys.jwtSecret);
        if(!userJWYPayload) {
            res.clearCookie('spotifyCode');
            res.send(401, 'Invalid or missing Spotify code')
        } else {
            User.findOne({'spotify.access_token': userJWYPayload.spotifyCode})
                .then( user => {
                    if (!user)
                        res.send(401, 'Invalid or missing Spotify code');
                    else {
                        console.log('Valid user:', user.spotify.userName);
                        req.user = user;
                        next();
                    }
                } )
        }
    }
};

const authCheckYoutube = (req, res, next) => {
    const userJWT = req.cookies.youtubeCode;
    if(!userJWT)
        res.send(401, 'Invalid or missing Youtube code');
    else {
        const userJWYPayload = jwt.verify(userJWT, keys.jwtSecret);
        if(!userJWYPayload) {
            res.clearCookie('youtubeCode');
            res.send(401, 'Invalid or missing Youtube code')
        } else {
            User.findOne({'youtube.access_token': userJWYPayload.youtubeCode})
                .then( user => {
                    if (!user)
                        res.send(401, 'Invalid or missing Youtube code');
                    else {
                        console.log('Valid user:', user.youtube.userName);
                        req.user = user;
                        next();
                    }
                } )
        }
    }
};

const parseDuration = (str) => {
    let vals = str.split(/[^0-9]/).reverse();
    return (Number(vals[1]) + 60 * Number(vals[2]) + 360 * Number(vals[3]) + 21600 * Number(vals[4])) * 1000
};

router.get('/', function (req, res) {
     res.send({spotify: req.cookies.spotifyCode, youtube: req.cookies.youtubeCode});
});

router.get('/logout/youtube',authCheckYoutube ,function (req, res) {
    const userJWT = req.cookies.youtubeCode;
    const userJWTPayload = jwt.verify(userJWT, keys.jwtSecret);

    res.clearCookie('youtubeCode');
    User.findOneAndUpdate({'youtube.access_token': userJWTPayload.youtubeCode},
        {'youtube.access_token': null},
        function (err, result) {
            if(err) console.log(err);
            else console.log('Deleted access token for', result.userName);
            res.redirect('/')
        });
});

router.get('/logout/spotify',authCheckSpotify, function (req, res) {
    const userJWT = req.cookies.spotifyCode;
    const userJWTPayload = jwt.verify(userJWT, keys.jwtSecret);

    res.clearCookie('spotifyCode');
    User.findOneAndUpdate({'spotify.access_token': userJWTPayload.spotifyCode},
        {'spotify.access_token': null},
        function (err, result) {
            if(err) console.log(err);
            else console.log('Deleted access token for', result.userName);
            res.redirect('/')
        });
});

router.get('/playlist', authCheckSpotify, function (req, res) {
    Playlist.findOne({userId: req.user.spotify.id}, function (err, playlist) {
        if(err)                 // error occurred
            throw err;
        let newPlaylist = playlist? playlist : new Playlist();

        // options needed to request playlist data from spotify
        let options = {
            url: urls.Spotify.userPlaylistURL,
            headers: { 'Authorization': 'Bearer ' + req.user.spotify.access_token }
        };

        // request the playlist data from spotify
        request(options, function (err, response, body) {
            // error checking
            if (err) console.log(err);

            // playlist user data
            newPlaylist.username = req.user.spotify.userName;
            newPlaylist.items = [];

            // the body param returned from request is a string and needs to be parsed first
            let bodyJSON = JSON.parse(body);

            // used to allow all async requests to be handled before saving
            let promises = [];

            // to get the each playlist data for each playlist
            for (let playlist of bodyJSON.items) {
                let playlist_option = {
                    url: playlist.href,
                    headers: {'Authorization': 'Bearer ' + req.user.spotify.access_token}
                };

                // request the tracks of each playlist from spotify
                promises.push(new Promise(resolve => {
                    request(playlist_option, function (err, response, body) {
                        if (err) throw err;
                        let bodyJSON = JSON.parse(body);

                        // add track information to the playlist
                        let playlistTracks = [];
                        for (let track of bodyJSON.tracks.items)
                            playlistTracks.push({
                                name: track.track.name,
                                duration_ms: track.track.duration_ms,
                                album: track.track.album.name,
                                artist: track.track.artists[0].name
                            })
                        newPlaylist.items.push({
                            name: bodyJSON.name,
                            image: bodyJSON.images[0].url,
                            tracks: playlistTracks
                        });

                        resolve()
                    })
                }));
            }
            Promise.all(promises)
                .then( () => {
                    return new Promise( resolve => Playlist.remove({}, () => resolve()) );
                })
                .then( () => {
                    return new Promise( resolve => {
                        newPlaylist.save({}, () => resolve() )
                    } )
                } )
                .then( () => {
                    Playlist.findOne({}, (err, plst) => {
                        console.log('found');
                        res.json(plst);
                    } )
                } )
        })
    })
});

router.get('/convert/:index', authCheckYoutube, function (req, res, next) {
    console.log('converting...');

    let playlist;
    const token = req.user.youtube.access_token;
    Playlist.findOne({}, function (err, plst) {
        if(req.params.index >= plst.items.length || req.params.index < 0)
            res.send(400, 'unidentified index');
        playlist = plst.items[req.params.index];
    }).then( ()=> {
        console.log(playlist.name, 'number of tracks:', playlist.tracks.length);
        let videoIds = [];
        let promises = [];

        for(let track of playlist.tracks){
            let videos = [];
            // Find top 5 videos;
            promises.push(new Promise (resolve => {
                youtube.search.list({
                    part: 'snippet',
                    'q': `${track.name} ${track.artist}`,
                    maxResults: '5',
                    order: 'relevance',
                    access_token: token
                }, (err, response) => {
                    for (let videoItem of response.data.items)
                        videos.push(videoItem.id.videoId)
                    resolve();
                })
            }).then( () => {
                return new Promise (resolve => {
                    youtube.videos.list({
                        part: 'snippet, contentDetails, statistics',
                        id: videos.join(),
                        access_token: token
                    }, (err, response) => {
                        for(videoData of response.data.items) {
                            const videoDuration = parseDuration(videoData.contentDetails.duration);
                            const maxDuration = track.duration_ms * 1.05 + 10000;
                            const minDuration = track.duration_ms * 0.95 - 10000;

                            if(maxDuration > videoDuration && videoDuration > minDuration) {
                                console.log('videoId add', videoData.id);
                                videoIds.push(videoData.id);
                                resolve();
                                return;
                            }
                        }
                        resolve();
                    })
                })
            }))
        }

        let playlistId;
        promises.push(
            new Promise(resolve => {
                youtube.playlists.list({
                    part: 'snippet, contentDetails',
                    mine: 'true',
                    access_token: token
                }, (err, response) => {
                    for (let snippet of response.data.items) {
                        if (playlist.name === snippet.snippet.title) {
                            playlistId = snippet.id;
                            console.log('playlist found');
                            resolve();
                            return;
                        }
                    }

                    youtube.playlists.insert({
                        part: 'snippet, status',
                        access_token: token,
                        resource: {
                            snippet: { title: playlist.name },
                            status: {privacyStatus: 'private'}
                        },
                    }, (err, response) => {
                        if(err) console.log(err);
                        playlistId = response.data.id;
                        console.log('playlist created');
                        resolve();
                    })
                })
            })
        );

        Promise.all(promises).then( ()=> {
            console.log('starting video insertion');
            console.log();
            insertVideos(videoIds, playlistId, token, '', res)
        } );
    } );
});

const insertVideos = (videoIds, playlistId, token, pageToken, res) => {
    return new Promise(resolve => {
        if(pageToken === undefined) {
            resolve();
            return;
        }

        youtube.playlistItems.list({
            part: 'snippet, contentDetails',
            playlistId: playlistId,
            pageToken: pageToken,
            access_token: token
        }, function (err, response) {
            if(err) throw err;

            console.log('currentVideoIds', videoIds);

            for(let snippet of response.data.items) {
                videoIds = videoIds.filter( item => item !== snippet.snippet.resourceId.videoId );
                console.log('removed videoId:',snippet.snippet.resourceId.videoId);
            }

            if(response.data.nextPageToken){
                resolve();
                return insertVideos(videoIds, playlistId, token, response.data.nextPageToken, res)
            }

            console.log(videoIds);

            let promises = [];
            for(let videoId of videoIds) {
                promises.push(new Promise( resolve => {
                    let requestBody = {
                        snippet: {
                            playlistId: playlistId,
                            resourceId: {kind: 'youtube#video', videoId: videoId}
                        }
                    };
                    youtube.playlistItems.insert({
                        part: 'snippet',
                        resource: requestBody,
                        access_token: token
                    }, (err, response) => {
                        console.log('err:', err, 'video inserted', videoId);
                        console.log();
                        resolve()
                    } )
                } ) .then( () => {return new Promise(resolve => setTimeout(() => resolve(), 3000))} )
                )
            }
            Promise.all(promises).then( () => {
                console.log('done');
                res.send(`https://www.youtube.com/playlist?list=${playlistId}`)
            });
        })
    })
};

module.exports = router;