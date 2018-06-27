const express = require('express'),
    jwt = require('jsonwebtoken'),
    request = require('request');
const User = require('../models/user_model'),
    keys = require('../config/keys'),
    urls = require('../url/urls');
const router = express.Router();

router.get('/login/spotify', function (req, res) {
    let scopes = 'user-library-read playlist-read-private playlist-read-collaborative';
    let url = urls.Spotify.authorize +
        '?response_type=code' +
        '&client_id=' + keys.Spotify.clientID +
        (scopes ? '&scope=' + encodeURIComponent(scopes) : '') +
        '&redirect_uri=' + encodeURIComponent(urls.Spotify.callback);
    console.log(url);
    res.redirect(url);
});

router.get('/callback/spotify', function (req, res) {
    console.log('logged in to spotify');
    const saveSessionSpotify = (code, res) => {
        const jwtPayload = { spotifyCode: code };
        const authJwtToken = jwt.sign(jwtPayload, keys.jwtSecret);
        const cookieOptions = { httpOnly: true, expires: 0 };
        res.cookie('spotifyCode', authJwtToken, cookieOptions);
    };

    let code = req.query.code,
        access_token,
        refresh_token,
        expires_in;
    let options = {
        url: urls.Spotify.get_token,
        method: 'POST',
        form: {
            grant_type: 'authorization_code',
            code: code,
            redirect_uri: urls.Spotify.callback,
            client_id: keys.Spotify.clientID,
            client_secret: keys.Spotify.clientSecret
        }
    };
    console.log('beginning callback');
    new Promise( (resolve, reject) => {
        request(options, function (error, response, body) {
            if(error) reject(error);
            if(response.statusCode !== 200) reject(response.statusCode);
            else {
                access_token = JSON.parse(body).access_token;
                refresh_token = JSON.parse(body).refresh_token;
                expires_in = new Date((Date.now() + JSON.parse(body).expires_in * 1000));
                console.log('found tokens');
                saveSessionSpotify(access_token, res);
                resolve()
            }
        })
    } ).then( () => {
        let options = {url: urls.Spotify.profile, headers: {Authorization: `Bearer ${access_token}`}};
        return new Promise( (resolve, reject) => {
            request(options, function (error, response, body) {
                console.log('requesting profile info', response.statusCode);
                if(error) reject(error);
                else if(response.statusCode === 200) {
                    User.findOne({'spotify.userId': JSON.parse(body).id}, (err, user) => {
                        console.log('fining user ...');
                        if(err) reject(err);
                        else if(user) {
                            console.log('found');
                            user.spotify.userName = JSON.parse(body).display_name;
                            user.spotify.access_token = access_token;
                            user.spotify.refresh_token = refresh_token;
                            user.spotify.expires_in = expires_in;
                            user.save();
                            resolve()
                        } else {
                            let newUser = new User();
                            newUser.spotify.userName = JSON.parse(body).display_name;
                            newUser.spotify.access_token = access_token;
                            newUser.spotify.refresh_token = refresh_token;
                            newUser.spotify.expires_in = expires_in;
                            newUser.spotify.userId = JSON.parse(body).id;
                            newUser.save();
                            console.log('user Saved');
                            resolve();
                        }
                    } )
                }
            })
        } )
    } ).then( () => {console.log('redirecting to /'); res.redirect('/')} );
});

router.get('/login/google', function (req, res) {
    let scopes = 'https://www.googleapis.com/auth/youtube.force-ssl https://www.googleapis.com/auth/plus.me';
    let url = urls.Youtube.authorize +
        `?${scopes? 'scope=' + encodeURIComponent(scopes) : ''}` +
        '&access_type=' + 'offline' +
        '&include_granted_scopes=true' +
        '&redirect_uri=' + encodeURIComponent(urls.Youtube.callback) +
        '&response_type=code' +
        '&client_id=' + keys.Youtube.clientID;
    res.redirect(url);
});

router.get('/callback/youtube', function (req, res) {
    console.log('logged in to google');
    const saveSessionGoogle = (code, res) => {
        const jwtPayload = { youtubeCode: code };
        const authJwtToken = jwt.sign(jwtPayload, keys.jwtSecret);
        const cookieOptions = { httpOnly: true, expires: 0 };
        res.cookie('youtubeCode', authJwtToken, cookieOptions);
    };
    let code = req.query.code,
        access_token,
        refresh_token,
        expires_in;
    let options = {
        url: urls.Youtube.get_token,
        method: 'POST',
        form: {
            grant_type: 'authorization_code',
            code: code,
            redirect_uri: urls.Youtube.callback,
            client_id: keys.Youtube.clientID,
            client_secret: keys.Youtube.clientSecret
        }};
    new Promise( (resolve, reject) => {
        request(options, function (error, response, body) {
            if(error) reject(error);
            else if(response.statusCode !== 200) reject(response.statusCode);
            else {
                access_token = JSON.parse(body).access_token;
                refresh_token = JSON.parse(body).refresh_token;
                expires_in = new Date((Date.now() + JSON.parse(body).expires_in * 1000));
                console.log('found tokens');
                saveSessionGoogle(access_token, res);
                resolve()
            }
        })
    } ) .then ( () => {
        let options = {url: urls.Youtube.profile, headers: {Authorization: `Bearer ${access_token}`}};
        return new Promise( (resolve, reject) => {
            request(options, function (error, response, body) {
                console.log('requesting profile info', response.statusCode);
                if(error) reject(error);
                else if(response.statusCode === 200) {
                    User.findOne({'youtube.userId': JSON.parse(body).id}, (err, user) => {
                        console.log('fining user ...');
                        if(err) reject(err);
                        else if(user) {
                            console.log('found');
                            user.youtube.userName = JSON.parse(body).displayName;
                            user.youtube.access_token = access_token;
                            user.youtube.refresh_token = refresh_token;
                            user.youtube.expires_in = expires_in;
                            user.save();
                            resolve()
                        } else {
                            let newUser = new User();
                            newUser.youtube.userName = JSON.parse(body).displayName;
                            newUser.youtube.access_token = access_token;
                            newUser.youtube.refresh_token = refresh_token;
                            newUser.youtube.expires_in = expires_in;
                            newUser.youtube.userId = JSON.parse(body).id;
                            newUser.save();
                            console.log('user Saved')
                            resolve();
                        }
                    } )
                }
            })
        } )
    } ).then( () => {console.log('redirecting to /'); res.redirect('/')} );
});

module.exports = router;