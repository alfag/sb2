const User = require('../models/User');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const passport = require('../../config/passport');
const JWT_SECRET = require('../../config/config').JWT_SECRET;
const logWithFileName = require('../utils/logger'); // Importa logWithFileName

const logger = logWithFileName(__filename); // Crea un logger con il nome del file

// Register a new user
exports.register = async (req, res) => {
    const { name, surname, email, password } = req.body;

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = new User({ name, surname, email, password: hashedPassword });
        await newUser.save();
        logger.info(`Utente registrato con successo: ${email}`); // Logga il successo della registrazione
        res.status(201).json({ message: 'Utente registrato con successo' });
    } catch (error) {
        logger.error(`Errore durante la registrazione: ${error.message}`);
        res.status(500).json({ message: 'Errore durante la registrazione', error });
    }
};

exports.login = (req, res, next) => {
    if (req.alreadyLoggedIn) {
        // L'utente è già autenticato
        req.flash('info', 'Utente già autenticato');
        return res.status(200).json({ alreadyLoggedIn: true });
    }

    passport.authenticate('local', (err, user, info) => {
    if (err) {
        logger.error(`Errore durante il login: ${err.message}`);
        return next(err);
        }
        if (!user) {
            logger.warn(`Login fallito: ${info.message}`);
            req.flash('error', info.message);
            return res.render('login', {message: req.flash()});
        }
        req.login(user, (loginErr) => {
            if (loginErr) {
            logger.error(`Errore durante la creazione della sessione: ${loginErr.message}`);
            return next(loginErr);
        }

        const userJSON = user.toJSON();

        logger.info(`Utente autenticato con successo: ${userJSON.username}`);

        const roleRedirects = {
            admin: '/admin',
            uUser: '/user',
            brewery: '/brewery',
        };

        const redirectUrl = roleRedirects[userJSON.role];
        if (redirectUrl) {
            logger.info(`Reindirizzamento a: ${redirectUrl}`);
            return res.redirect(redirectUrl);
        } else {
            logger.warn(`Ruolo sconosciuto per l'utente: ${userJSON.username}`);
            req.flash('error', 'Ruolo utente non riconosciuto');
            return res.redirect('/login');
        }
    });
    })(req, res, next);
};

exports.logout = (req, res) => {
    req.logout((err) => {
        if (err) {
            logger.error(`Errore durante il logout: ${err.message}`);
            req.flash('error', 'Errore durante il logout');
            return res.redirect('/');
        }

        // Distruggi la sessione
        req.session.destroy((destroyErr) => {
            if (destroyErr) {
                logger.error(`Errore durante la distruzione della sessione: ${destroyErr.message}`);
                req.flash('error', 'Errore durante la distruzione della sessione');
                return res.redirect('/');
            }

            logger.info('Utente disconnesso e sessione distrutta con successo');
            res.redirect('/');
        });
    });
};

exports.oauthLogin = passport.authenticate('google', {
    scope: ['profile', 'email'],
});

exports.oauthCallback = (req, res) => {
    passport.authenticate('google', { failureRedirect: '/login' }, (err, user) => {
        if (err || !user) {
            logger.error('Errore durante il login OAuth');
            req.flash('error', 'Errore durante il login OAuth');
            return res.redirect('/login');
        }

        req.login(user, (loginErr) => {
            if (loginErr) {
                logger.error('Errore durante la creazione della sessione OAuth');
                req.flash('error', 'Errore durante la creazione della sessione');
                return res.redirect('/login');
            }

            logger.info(`Utente autenticato tramite OAuth: ${user.email}`);
            res.redirect('/'); // Reindirizza alla homepage o a una pagina specifica
        });
    })(req, res);
};