const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const logWithFileName = require('../utils/logger'); // Importa logWithFileName

const logger = logWithFileName(__filename); // Crea un logger con il nome del file

// Funzione per gestire GET /login
const getLogin = (req, res) => {
    logger.info('Renderizzazione della pagina di login'); // Log tradotto
    res.render('login.njk', { message: req.flash('loginMessage') });
};

// Funzione per gestire POST /login
const postLogin = (req, res, next) => {
    logger.info('Login utente'); // Log tradotto
    authController.login(req, res, next);
};

// Funzione per gestire il logout
const logout = (req, res) => {
    logger.info('Logout utente'); // Log tradotto
    authController.logout(req, res);
};

// Rotta per la registrazione
router.post('/register', (req, res, next) => {
    logger.info('Registrazione di un nuovo utente'); // Log tradotto
    next();
}, authController.register);

// Rotta per OAuth
router.post('/oauth', (req, res, next) => {
    logger.info('Login tramite OAuth'); // Log tradotto
    next();
}, authController.oauthLogin);

// Esporta sia il router che le funzioni specifiche per /login
module.exports = {
    router,      // Esporta il router per le altre rotte
    getLogin,    // Esporta la funzione per GET /login
    postLogin,   // Esporta la funzione per POST /login
    logout,      // Esporta la funzione per il logout
};