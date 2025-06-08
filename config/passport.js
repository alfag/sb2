const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../src/models/User');
const bcrypt = require('bcrypt');
const logWithFileName = require('../src/utils/logger'); // Importa il logger

const logger = logWithFileName(__filename); // Crea un logger con il nome del file

// Configura la strategia locale
passport.use(
    new LocalStrategy({ usernameField: 'email' }, async (email, password, done) => {
        try {
            logger.debug(`Tentativo di login con username: ${email}`); // Logga l'email

            const user = await User.findOne({ username: email });
            if (!user) {
                logger.debug(`Utente non trovato per username: ${email}`); // Logga se l'utente non è trovato
                return done(null, false, { message: 'Utente non riconosciuto' });
            }

            const isMatch = await bcrypt.compare(password, user.password);
            if (!isMatch) {
                logger.debug(`Password errata per username: ${email}`); // Logga se la password è errata
                return done(null, false, { message: 'Password errata' });
            }

            logger.debug(`Login riuscito per username: ${email}`); // Logga il successo del login
            return done(null, user);
        } catch (error) {
            logger.error(`Errore durante il login per username: ${email}`, error); // Logga l'errore
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
                        email: profile.emails[0].value,
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
            //logger.warn(`Utente non trovato durante la deserializzazione con ID: ${id}`);
            return done(null, false);
        }
        //logger.info(`Utente deserializzato con successo: ${user.toJSON().email}`);
        done(null, user); // Aggiunge l'utente a req.user
    } catch (error) {
        done(error, null);
    }
});

module.exports = passport;