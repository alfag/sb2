const User = require('../models/User');
const logWithFileName = require('../utils/logger'); // Importa logWithFileName

const logger = logWithFileName(__filename); // Crea un logger con il nome del file

// Get user profile by ID
exports.getUserProfile = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) {
            logger.warn(`Utente non trovato: ${req.params.id}`); // Logga l'utente non trovato
            return res.status(404).json({ message: 'Utente non trovato' });
        }
        logger.info(`Profilo utente recuperato con successo: ${req.params.id}`); // Logga il successo del recupero
        res.status(200).json(user);
    } catch (error) {
        logger.error(`Errore durante il recupero del profilo utente: ${error.message}`); // Logga l'errore
        res.status(500).json({ message: 'Errore del server', error });
    }
};

// Update user profile
exports.updateUserProfile = async (req, res) => {
    try {
        const user = await User.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!user) {
            logger.warn(`Utente non trovato: ${req.params.id}`); // Logga l'utente non trovato
            return res.status(404).json({ message: 'Utente non trovato' });
        }
        logger.info(`Profilo utente aggiornato con successo: ${req.params.id}`); // Logga il successo dell'aggiornamento
        res.status(200).json(user);
    } catch (error) {
        logger.error(`Errore durante l'aggiornamento del profilo utente: ${error.message}`); // Logga l'errore
        res.status(500).json({ message: 'Errore del server', error });
    }
};

// Get user order history
exports.getUserOrders = async (req, res) => {
    try {
        const user = await User.findById(req.user.id).populate('orders');
        if (!user) {
            logger.warn(`Utente non trovato: ${req.user.id}`); // Logga l'utente non trovato
            return res.status(404).json({ message: 'Utente non trovato' });
        }
        logger.info(`Ordini dell'utente recuperati con successo: ${req.user.id}`); // Logga il successo del recupero
        res.status(200).json(user.orders);
    } catch (error) {
        logger.error(`Errore durante il recupero degli ordini dell'utente: ${error.message}`); // Logga l'errore
        res.status(500).json({ message: 'Errore del server', error });
    }
};