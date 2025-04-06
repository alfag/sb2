const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const logWithFileName = require('../utils/logger'); // Importa logWithFileName

const logger = logWithFileName(__filename); // Crea un logger con il nome del file

// Creazione di un nuovo ordine
router.post('/', (req, res, next) => {
    logger.info('Creazione di un nuovo ordine'); // Log tradotto
    next();
}, orderController.createOrder);

// Recupero dei dettagli di un ordine tramite ID
router.get('/:id', (req, res, next) => {
    logger.info(`Recupero dei dettagli dell'ordine con ID: ${req.params.id}`); // Log tradotto
    next();
}, orderController.getOrderById);

// Recupero di tutti gli ordini per un utente
router.get('/user/:userId', (req, res, next) => {
    logger.info(`Recupero degli ordini per l'utente con ID: ${req.params.userId}`); // Log tradotto
    next();
}, orderController.getOrdersByUserId);

// Aggiornamento dello stato di un ordine
router.put('/:id', (req, res, next) => {
    logger.info(`Aggiornamento dello stato dell'ordine con ID: ${req.params.id}`); // Log tradotto
    next();
}, orderController.updateOrderStatus);

// Eliminazione di un ordine
router.delete('/:id', (req, res, next) => {
    logger.info(`Eliminazione dell'ordine con ID: ${req.params.id}`); // Log tradotto
    next();
}, orderController.deleteOrder);

module.exports = router;