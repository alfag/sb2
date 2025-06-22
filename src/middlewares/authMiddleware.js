const User = require('../models/User');
const logWithFileName = require('../utils/logger'); // Importa logWithFileName

const logger = logWithFileName(__filename); // Crea un logger con il nome del file

const isAuthenticated = (req, res, next) => {
    if (!req.isAuthenticated()) {
        logger.warn('Accesso negato. Utente non autenticato.');
        req.flash('error', 'Accesso negato. Effettua il login per continuare.');
        return res.redirect('/');
    }

    // Aggiungi l'informazione al req
    req.alreadyLoggedIn = true;
    logger.info(`Utente già autenticato: ${req.user.toJSON().username}`);
    next(); // Passa al middleware successivo o alla rotta
};

const isAdmin = (req, res, next) => {
    // Prima controlla se l'utente è autenticato
    isAuthenticated(req, res, function () {
        // Poi controlla se è admin
        if (!req.user || req.user.role !== 'administrator') {
            logger.warn('Accesso negato. Solo gli amministratori possono accedere.');
            req.flash('error', 'Accesso negato. Solo gli amministratori possono accedere.');
            const redirectUrl = req.headers.referer || '/';
            return res.redirect(redirectUrl);
        }

        logger.info(`Accesso amministratore concesso: ${req.user.toJSON().username}`);
        //logger.info(`Prossima rotta (next): ${req.originalUrl}`);
        next();
    });
};

module.exports = {
    isAuthenticated,
    isAdmin,
};