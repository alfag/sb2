const QRCode = require('qrcode');
const logWithFileName = require('./logger'); // Importa logWithFileName

const logger = logWithFileName(__filename); // Crea un logger con il nome del file

const generateQRCode = async (data) => {
    try {
        const qrCodeDataUrl = await QRCode.toDataURL(data);
        logger.info('QR code generato con successo'); // Log tradotto
        return qrCodeDataUrl;
    } catch (error) {
        logger.error(`Errore durante la generazione del QR code: ${error.message}`); // Log tradotto
        throw new Error('Errore durante la generazione del QR code: ' + error.message);
    }
};

const scanQRCode = async (image) => {
    // Implementa la logica di scansione del QR code qui
    logger.info('QR code scansionato con successo'); // Log tradotto
};

module.exports = {
    generateQRCode,
    scanQRCode
};