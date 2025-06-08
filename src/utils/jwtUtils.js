const jwt = require('jsonwebtoken');
const logWithFileName = require('./logger'); // Importa logWithFileName

const logger = logWithFileName(__filename); // Crea un logger con il nome del file

const secretKey = process.env.JWT_SECRET || 'your_secret_key';
const tokenExpiration = '1h'; // Tempo di scadenza del token

// Funzione per generare un token JWT
const generateToken = (user) => {
    const payload = {
        id: user._id,
        role: user.role,
    };
    const token = jwt.sign(payload, secretKey, { expiresIn: tokenExpiration });
    logger.info(`Token generato per l'utente: ${user._id}`); // Log tradotto
    return token;
};

// Funzione per verificare un token JWT
const verifyToken = (token) => {
    try {
        const decoded = jwt.verify(token, secretKey);
        logger.info(`Token verificato per l'utente: ${decoded.id}`); // Log tradotto
        return decoded;
    } catch (error) {
        logger.error(`Errore durante la verifica del token: ${error.message}`); // Log tradotto
        return null;
    }
};

// Funzione per decodificare un token JWT
const decodeToken = (token) => {
    const decoded = jwt.decode(token);
    logger.info(`Token decodificato per l'utente: ${decoded ? decoded.id : 'sconosciuto'}`); // Log tradotto
    return decoded;
};

module.exports = {
    generateToken,
    verifyToken,
    decodeToken,
};