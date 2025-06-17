const User = require('../models/User');
const logWithFileName = require('../utils/logger'); // Importa logWithFileName

const logger = logWithFileName(__filename); // Crea un logger con il nome del file

const isAuthenticated = (req, res, next) => {
    if (!req.isAuthenticated()) {
        logger.warn('Accesso negato. Utente non autenticato.');
        return res.status(401).json({ message: 'Accesso negato. Utente non autenticato.' });
    }

    // Aggiungi l'informazione al req
    req.alreadyLoggedIn = true;
    logger.info(`Utente già autenticato: ${req.user.toJSON().username}`);
    next(); // Passa al middleware successivo o alla rotta
};

const isAdmin = (req, res, next) => {
    if (!req.user || req.user.role !== 'administrator') {
        logger.warn('Accesso negato. Solo gli amministratori possono accedere.');
        return res.status(403).json({ message: 'Accesso negato. Solo gli amministratori possono accedere.' });
    }

    logger.info(`Accesso amministratore concesso: ${req.user.toJSON().username}`);
    next();
};

module.exports = {
    isAuthenticated,
    isAdmin,
};