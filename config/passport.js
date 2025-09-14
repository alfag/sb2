const passport = require('passport');
const User = require('../src/models/User');
const bcrypt = require('bcrypt');
const logWithFileName = require('../src/utils/logger'); // Importa il logger
const LocalStrategy = require('passport-local').Strategy;
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const FacebookStrategy = require('passport-facebook').Strategy;
const InstagramStrategy = require('passport-instagram').Strategy;
const AppleStrategy = require('passport-apple');
const AmazonStrategy = require('passport-amazon').Strategy;

const logger = logWithFileName(__filename); // Crea un logger con il nome del file

// Configura la strategia locale
passport.use(
    new LocalStrategy({ usernameField: 'username' }, async (username, password, done) => {
        try {
            logger.debug(`Tentativo di login con username: ${username}`); // Logga l'username

            const user = await User.findOne({ username: username });
            if (!user) {
                logger.debug(`Utente non trovato per username: ${username}`); // Logga se l'utente non è trovato
                return done(null, false, { message: 'Utente non riconosciuto' });
            }

            logger.debug(`Utente trovato: ${user.username}`);
            logger.debug(`Password hashata nel DB: ${user.password}`);
            const isMatch = await bcrypt.compare(password, user.password);
            
            if (!isMatch) {
                logger.debug(`Password errata per username: ${username}`); // Logga se la password è errata
                return done(null, false, { message: 'Password errata' });
            }

            logger.debug(`Login riuscito per username: ${username}`); // Logga il successo del login
            return done(null, user);
        } catch (error) {
            logger.error(`Errore durante il login per username: ${username}`, error); // Logga l'errore
            return done(error);
        }
    })
);

/*
// Configura la strategia Google OAuth
passport.use(
    new GoogleStrategy(
        {
            clientID: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            callbackURL: '/auth/google/callback',
        },
        async (accessToken, refreshToken, profile, done) => {
            try {
                let user = await User.findOne({ googleId: profile.id });
                if (!user) {
                    user = new User({
                        googleId: profile.id,
                        username: profile.usernames[0].value,
                        name: profile.displayName,
                    });
                    await user.save();
                }
                return done(null, user);
            } catch (error) {
                return done(error, null);
            }
        }
    )
);

// Facebook
passport.use(new FacebookStrategy({
    clientID: process.env.FACEBOOK_CLIENT_ID,
    clientSecret: process.env.FACEBOOK_CLIENT_SECRET,
    callbackURL: '/auth/facebook/callback',
    profileFields: ['id', 'displayName', 'emails']
}, async (accessToken, refreshToken, profile, done) => {
    try {
        let user = await User.findOne({ facebookId: profile.id });
        if (!user) {
            user = new User({
                facebookId: profile.id,
                username: profile.emails?.[0]?.value || profile.displayName,
                name: profile.displayName,
            });
            await user.save();
        }
        return done(null, user);
    } catch (error) {
        return done(error, null);
    }
}));

// Twitter
passport.use(new TwitterStrategy({
    consumerKey: process.env.TWITTER_CONSUMER_KEY,
    consumerSecret: process.env.TWITTER_CONSUMER_SECRET,
    callbackURL: '/auth/twitter/callback',
    includeEmail: true
}, async (token, tokenSecret, profile, done) => {
    try {
        let user = await User.findOne({ twitterId: profile.id });
        if (!user) {
            user = new User({
                twitterId: profile.id,
                username: profile.username,
                name: profile.displayName,
            });
            await user.save();
        }
        return done(null, user);
    } catch (error) {
        return done(error, null);
    }
}));

// Instagram
passport.use(new InstagramStrategy({
    clientID: process.env.INSTAGRAM_CLIENT_ID,
    clientSecret: process.env.INSTAGRAM_CLIENT_SECRET,
    callbackURL: '/auth/instagram/callback'
}, async (accessToken, refreshToken, profile, done) => {
    try {
        let user = await User.findOne({ instagramId: profile.id });
        if (!user) {
            user = new User({
                instagramId: profile.id,
                username: profile.username,
                name: profile.displayName,
            });
            await user.save();
        }
        return done(null, user);
    } catch (error) {
        return done(error, null);
    }
}));

// Apple
passport.use(new AppleStrategy({
    clientID: process.env.APPLE_CLIENT_ID,
    teamID: process.env.APPLE_TEAM_ID,
    keyID: process.env.APPLE_KEY_ID,
    privateKeyLocation: process.env.APPLE_PRIVATE_KEY_PATH,
    callbackURL: '/auth/apple/callback'
}, async (accessToken, refreshToken, idToken, profile, done) => {
    try {
        let user = await User.findOne({ appleId: idToken.sub });
        if (!user) {
            user = new User({
                appleId: idToken.sub,
                username: idToken.email,
                name: idToken.email,
            });
            await user.save();
        }
        return done(null, user);
    } catch (error) {
        return done(error, null);
    }
}));

// Amazon
passport.use(new AmazonStrategy({
    clientID: process.env.AMAZON_CLIENT_ID,
    clientSecret: process.env.AMAZON_CLIENT_SECRET,
    callbackURL: '/auth/amazon/callback'
}, async (accessToken, refreshToken, profile, done) => {
    try {
        let user = await User.findOne({ amazonId: profile.id });
        if (!user) {
            user = new User({
                amazonId: profile.id,
                username: profile.emails?.[0]?.value || profile.displayName,
                name: profile.displayName,
            });
            await user.save();
        }
        return done(null, user);
    } catch (error) {
        return done(error, null);
    }
}));
*/

// Serializzazione e deserializzazione dell'utente
passport.serializeUser((user, done) => {
logger.info(`Serializzazione utente con ID: ${user.id}`);
    done(null, user.id); // Salva solo l'ID dell'utente nella sessione
});

passport.deserializeUser(async (id, done) => {
    try {
        const user = await User.findById(id);
        if (!user) {
            logger.warn(`Utente non trovato durante la deserializzazione con ID: ${id}`);
            return done(null, false);
        }
        //logger.info(`Utente deserializzato con successo: ${user.toJSON().username}`);
        done(null, user); // Aggiunge l'utente a req.user
    } catch (error) {
        logger.error(`Errore durante la deserializzazione dell'utente con ID: ${id}`, error);
        done(error, null);
    }
});

module.exports = passport;