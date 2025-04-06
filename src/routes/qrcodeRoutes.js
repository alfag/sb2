const express = require('express');
const router = express.Router();
const qrcodeController = require('../controllers/qrcodeController');
const logWithFileName = require('../utils/logger'); // Importa logWithFileName

const logger = logWithFileName(__filename); // Crea un logger con il nome del file

// Rotta per generare un QR code per una BeerBox o un invito
router.post('/generate', (req, res, next) => {
    logger.info('Generazione di un nuovo QR code'); // Log tradotto
    next();
}, qrcodeController.generateQRCode);

// Rotta per scansionare un QR code e recuperare i dati associati
router.get('/scan/:id', (req, res, next) => {
    logger.info(`Scansione del QR code con ID: ${req.params.id}`); // Log tradotto
    next();
}, qrcodeController.scanQRCode);

module.exports = router;