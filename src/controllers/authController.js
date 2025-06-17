const User = require('../models/User');
const Administrator = require('../models/Administrator');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const passport = require('../../config/passport');
const JWT_SECRET = require('../../config/config').JWT_SECRET;
const logWithFileName = require('../utils/logger'); // Importa logWithFileName

const logger = logWithFileName(__filename); // Crea un logger con il nome del file

// Register a new user
exports.postRegister = async (req, res) => {
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

// Funzione per la renderizzazione della pagina di login
exports.getLogin = (req, res) => {
    logger.info('Renderizzazione della pagina di login');
    res.render('authViews/login.njk');
};

// Funzione per la gestione del post del login
const renderView = (req, res, view, options) => {
    res.render(view, {
        ...options,
        message: { info: req.flash('info') }
    });
};

exports.postLogin = (req, res, next) => {
    passport.authenticate('local', (err, user, info) => {
        if (err) { return next(err); }
        if (!user) {
            req.flash('error', info.message);
            return res.redirect('/login');
        }

        let populatedUser = user;

        if (user.role === 'brewery') {
            User.findById(user._id)
                .populate('breweryDetails')
                .then(populatedUserFromDb => {
                    populatedUser = populatedUserFromDb;
                    req.logIn(populatedUser, (err) => {
                        if (err) { return next(err); }
                        logger.info(`${user.role} - Utente ${populatedUser.username} loggato con successo`);
                        req.flash('info', 'Login effettuato con successo');
                        return renderView(req, res, '/', { user: populatedUser, type: 'info' });
                    });
                })
                .catch(err => {
                    return next(err);
                });
        } else if (user.role === 'administrator') {
            User.findById(user._id)
                .populate('administratorDetails')
                .then(populatedUserFromDb => {
                    populatedUser = populatedUserFromDb;
                    req.logIn(populatedUser, (err) => {
                        if (err) { return next(err); }
                        logger.info(`${user.role} - Utente ${populatedUser.username} loggato con successo`);
                        req.flash('info', 'Login effettuato con successo');
                        return renderView(req, res, 'welcome', { user: populatedUser, type: 'info' });
                    });
                })
                .catch(err => {
                    return next(err);
                });
        } else {
            req.logIn(user, (err) => {
                if (err) { return next(err); }
                logger.info(`${user.role} - Utente ${user.username} loggato con successo`);
                req.flash('info', 'Login effettuato con successo');
                return renderView(req, res, 'welcome', { user: populatedUser, type: 'info' });
            });
        }
    })(req, res, next);
};

// Funzione per la gestione del logout
exports.getLogout = (req, res) => {
    logger.info('Esecuzione del logout');
    req.logout(function (err) {
        if (err) { 
            logger.error('Errore durante il logout:', err);
            return res.redirect('/'); // Reindirizza anche in caso di errore
        }
        req.session.destroy(function (err) {
            if (err) {
                logger.error('Errore durante la distruzione della sessione:', err);
            }
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