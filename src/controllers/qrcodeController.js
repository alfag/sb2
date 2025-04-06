const QRCode = require('qrcode');
const qrcodeUtils = require('../utils/qrcodeUtils');
const logWithFileName = require('../utils/logger'); // Importa logWithFileName

const logger = logWithFileName(__filename); // Crea un logger con il nome del file

// Function to generate a QR code for a BeerBox or invitation
exports.generateQRCode = async (req, res) => {
    const { data } = req.body;

    try {
        const qrCodeImage = await QRCode.toDataURL(data);
        logger.info('QR code generato con successo'); // Logga il successo della generazione
        res.status(200).json({ qrCodeImage });
    } catch (error) {
        logger.error(`Errore durante la generazione del QR code: ${error.message}`); // Logga l'errore
        res.status(500).json({ message: 'Errore durante la generazione del QR code', error });
    }
};

// Function to scan a QR code and retrieve associated data
exports.scanQRCode = async (req, res) => {
    const { id } = req.params;

    try {
        const data = await qrcodeUtils.decodeQRCode(id);
        logger.info(`QR code scansionato con successo: ${id}`); // Logga il successo della scansione
        res.status(200).json({ data });
    } catch (error) {
        logger.error(`Errore durante la scansione del QR code: ${error.message}`); // Logga l'errore
        res.status(500).json({ message: 'Errore durante la scansione del QR code', error });
    }
};