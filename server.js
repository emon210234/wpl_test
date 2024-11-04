const express = require('express');
const axios = require('axios');
const bodyParser = require('body-parser');
const path = require('path');
const passport = require('passport');
const FacebookStrategy = require('passport-facebook').Strategy;
const session = require('express-session');

const app = express();
const PORT = process.env.PORT || 3000;
const pageId = "428613487004010";  
const FACEBOOK_APP_ID = '555467183701959';
const FACEBOOK_APP_SECRET = '2ee223c4076b50a2827c419e16608a64';

let pageAccessToken = '';  // Store the page access token here

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use(session({ secret: 'secret', resave: true, saveUninitialized: true }));
app.use(passport.initialize());
app.use(passport.session());

app.use(express.static(path.join(__dirname, 'public')));

passport.use(new FacebookStrategy({
    clientID: FACEBOOK_APP_ID,
    clientSecret: FACEBOOK_APP_SECRET,
    callbackURL: 'http://localhost:3000/auth/facebook/callback',
    profileFields: ['id', 'displayName', 'emails']
}, async (accessToken, refreshToken, profile, done) => {
    try {
        // Use the user access token to get the page access token
        const response = await axios.get(`https://graph.facebook.com/v11.0/${pageId}`, {
            params: {
                fields: 'access_token',
                access_token: accessToken,
            }
        });

        // Save the page access token for posting
        pageAccessToken = response.data.access_token;
        return done(null, { profile, accessToken });
    } catch (error) {
        console.error('Error fetching page access token:', error);
        return done(error);
    }
}));

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Route to initiate Facebook login
app.get('/auth/facebook', passport.authenticate('facebook', { scope: ['pages_manage_posts', 'pages_read_engagement'] }));

// Callback route for Facebook authentication
app.get('/auth/facebook/callback',
    passport.authenticate('facebook', { failureRedirect: '/' }),
    (req, res) => {
        res.redirect('/'); // Redirect to home page after login
    }
);

// Endpoint to check if user is authenticated
app.get('/checkAuth', (req, res) => {
    res.json({ isAuthenticated: req.isAuthenticated() });
});

// Endpoint to post to the Facebook page using the page access token
app.post('/posttopage', (req, res) => {
    if (!req.isAuthenticated()) {
        return res.status(401).json({ error: 'User not authenticated' });
    }

    const text = req.body.text;

    axios
        .post(`https://graph.facebook.com/v11.0/${pageId}/feed`, 
            {
                message: text,
                access_token: pageAccessToken  // Use the page access token here
            }
        )
        .then((response) => {
            console.log(response.data);
            res.status(200).json(response.data);
        })
        .catch((error) => {
            console.error(error);
            res.status(500).json({ error: 'Error posting to page' });
        });
});

// Start server
app.listen(PORT, () => {
    console.log(`Server started on http://localhost:${PORT}`);
});
