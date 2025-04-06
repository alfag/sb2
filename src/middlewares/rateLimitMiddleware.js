const rateLimit = require('express-rate-limit');
const logWithFileName = require('../utils/logger'); // Importa la funzione logWithFileName

const logger = logWithFileName(__filename); // Crea un logger con il nome del file

const minutiControllo = 15;

const limiter = rateLimit({
    windowMs: minutiControllo * 60 * 1000, // 15 minuti
    max: 100, // Limita ogni IP a 100 richieste per finestra temporale
    message: `Troppe richieste da questo IP, riprova tra ${minutiControllo} minuti.`,
    handler: (req, res, next, options) => {
        logger.warn(`Limite di richieste superato per l'IP: ${req.ip}`); // Logga il superamento del limite
        res.status(options.statusCode).send(options.message);
    }
});

// Applica il middleware a tutte le richieste
const rateLimitMiddleware = (req, res, next) => {
    const clientIp = req.ip || req.connection.remoteAddress || 'IP non disponibile';
    //logger.info(`Richiesta ricevuta dall'IP: ${clientIp}`); // Logga la richiesta ricevuta
    limiter(req, res, next);
};

module.exports = rateLimitMiddleware;