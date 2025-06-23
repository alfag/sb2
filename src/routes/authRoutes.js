const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const logWithFileName = require('../utils/logger'); // Importa logWithFileName

const logger = logWithFileName(__filename); // Crea un logger con il nome del file

// Rotte per /login
router.get('/login', (req, res, next) => {
    logger.info('Accesso alla pagina di login');
    next();
}, authController.getLogin);

router.post('/login', (req, res, next) => {
    logger.info('Invio dati di login');
    next();
}, authController.postLogin);

// Rotta per il logout
router.get('/logout', (req, res, next) => {
    logger.info('Richiesta di logout');
    next();
}, authController.getLogout);

// Rotta GET per la pagina di registrazione customer
router.get('/register', (req, res) => {
    logger.info('Accesso alla pagina di registrazione customer');
    res.render('customer/registerUser.njk');
});

// Rotta per la registrazione
router.post('/register', (req, res, next) => {
    logger.info('Registrazione di un nuovo utente'); // Log tradotto
    next();
}, authController.postRegister);

/*
// Rotta per l'autenticazione via Facebook
router.get('/auth/facebook', passport.authenticate('facebook', { scope: ['email'] }));
router.get('/auth/facebook/callback', passport.authenticate('facebook', {
    successRedirect: '/',
    failureRedirect: '/login'
}));

// Rotta per l'autenticazione via Instagram
router.get('/auth/instagram', passport.authenticate('instagram'));
router.get('/auth/instagram/callback', passport.authenticate('instagram', {
    successRedirect: '/',
    failureRedirect: '/login'
}));

// Rotta per l'autenticazione via Apple
router.get('/auth/apple', passport.authenticate('apple'));
router.post('/auth/apple/callback', passport.authenticate('apple', {
    successRedirect: '/',
    failureRedirect: '/login'
}));

// Rotta per l'autenticazione via Amazon
router.get('/auth/amazon', passport.authenticate('amazon', { scope: ['profile'] }));
router.get('/auth/amazon/callback', passport.authenticate('amazon', {
    successRedirect: '/',
    failureRedirect: '/login'
}));
*/

// Esporta solo il router come default export
module.exports = router;