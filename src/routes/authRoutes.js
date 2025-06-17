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

// Rotta per la registrazione
router.post('/register', (req, res, next) => {
    logger.info('Registrazione di un nuovo utente'); // Log tradotto
    next();
}, authController.postRegister);

// Rotta per OAuth
router.post('/oauth', (req, res, next) => {
    logger.info('Login tramite OAuth'); // Log tradotto
    next();
}, authController.oauthLogin);

// Esporta solo il router come default export
module.exports = router;