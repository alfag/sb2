const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const logWithFileName = require('../utils/logger'); // Importa logWithFileName

const logger = logWithFileName(__filename); // Crea un logger con il nome del file

// Rotta per creare un nuovo pagamento
router.post('/', (req, res, next) => {
    logger.info('Creazione di un nuovo pagamento'); // Log tradotto
    next();
}, paymentController.createPayment);

// Rotta per ottenere i dettagli di un pagamento tramite ID
router.get('/:id', (req, res, next) => {
    logger.info(`Recupero dei dettagli del pagamento con ID: ${req.params.id}`); // Log tradotto
    next();
}, paymentController.getPaymentDetails);

module.exports = router;