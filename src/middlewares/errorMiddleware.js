const logWithFileName = require('../utils/logger'); // Importa logWithFileName
const langTranslator = require('../utils/langTranslator'); // Importa il traduttore di lingua

const logger = logWithFileName(__filename); // Crea un logger con il nome del file

const errorHandler = async (err, req, res, next) => {
    logger.error(`Errore catturato: ${err.stack}`); // Logga l'errore in italiano

    const browserLanguage = req.headers['accept-language']?.split(',')[0] || 'it'; // Ottieni la lingua dal browser, predefinito 'it'

    try {
        // Traduci il messaggio di errore nella lingua del browser
        const translatedMessage = await langTranslator.translate(err.message, browserLanguage);

        res.status(err.status || 500);
        res.json({
            message: translatedMessage,
            error: process.env.NODE_ENV === 'development' ? err : {}
        });
    } catch (translationError) {
        logger.error(`Errore durante la traduzione del messaggio: ${translationError.message}`); // Logga l'errore di traduzione
        res.status(err.status || 500);
        res.json({
            message: 'Si è verificato un errore',
            error: process.env.NODE_ENV === 'development' ? err : {}
        });
    }
};

module.exports = errorHandler;