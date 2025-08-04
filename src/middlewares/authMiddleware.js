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

exports.isAdmin = (req, res, next) => {
    if (
        req.isAuthenticated() &&
        (
            (req.session.activeRole === 'administrator') ||
            (Array.isArray(req.user.role) && req.user.role.includes('administrator'))
        )
    ) {
        return next();
    }
    res.redirect('/login');
};

exports.isBrewery = (req, res, next) => {
    if (
        req.isAuthenticated() &&
        (
            (req.session.activeRole === 'brewery') ||
            (Array.isArray(req.user.role) && req.user.role.includes('brewery'))
        )
    ) {
        return next();
    }
    res.redirect('/login');
};

exports.isCustomer = (req, res, next) => {
    if (
        req.isAuthenticated() &&
        (
            (req.session.activeRole === 'customer') ||
            (Array.isArray(req.user.role) && req.user.role.includes('customer'))
        )
    ) {
        return next();
    }
    res.redirect('/login');
};

exports.ensureRole = (roles) => (req, res, next) => {
  if (!req.user || !req.user.role || !roles.some(r => Array.isArray(req.user.role) ? req.user.role.includes(r) : req.user.role === r)) {
    return res.status(403).send('Accesso negato');
  }
  next();
};

module.exports = {
    isAuthenticated,
    isAdmin: exports.isAdmin,
    isBrewery: exports.isBrewery,
    isCustomer: exports.isCustomer,
    ensureRole: exports.ensureRole,
};