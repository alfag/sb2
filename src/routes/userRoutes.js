const express = require('express');
const { getUserProfile, updateUserProfile, getUserOrders } = require('../controllers/userController');
const { authMiddleware } = require('../middlewares/authMiddleware');
const logWithFileName = require('../utils/logger'); // Importa logWithFileName

const logger = logWithFileName(__filename); // Crea un logger con il nome del file

const router = express.Router();

// Ottieni il profilo utente
router.get('/:id', authMiddleware, (req, res, next) => {
    logger.info(`Recupero del profilo per l'utente ${req.params.id}`); // Log tradotto
    next();
}, getUserProfile);

// Aggiorna il profilo utente
router.put('/:id', authMiddleware, (req, res, next) => {
    logger.info(`Aggiornamento del profilo per l'utente ${req.params.id}`); // Log tradotto
    next();
}, updateUserProfile);

// Ottieni gli ordini dell'utente
router.get('/:id/orders', authMiddleware, (req, res, next) => {
    logger.info(`Recupero degli ordini per l'utente ${req.params.id}`); // Log tradotto
    next();
}, getUserOrders);

module.exports = router;