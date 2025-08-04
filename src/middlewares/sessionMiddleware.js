const session = require('express-session');
const MongoStore = require('connect-mongo');

const logWithFileName = require('../utils/logger'); // Importa logWithFileName

const logger = logWithFileName(__filename); // Crea un logger con il nome del file

let store;

try {
    store = MongoStore.create({
        mongoUrl: process.env.MONGODB_URL_SB2, // URL di connessione a MongoDB
        collectionName: 'sessions', // Nome della collezione per le sessioni
        stringify: false,
        autoRemove: 'interval',
        autoRemoveInterval: 1, // Rimuove automaticamente le sessioni scadute ogni 1 minuto
    });
    //logger.debug('Connesso a MongoDB per la gestione delle sessioni');
} catch (err) {
    logger.error('Errore di connessione a MongoDB per le sessioni:', err);
}

const sessionMiddleware = session({
    secret: process.env.SESSION_SECRET || 'session_secret_key', // Chiave segreta per le sessioni
    resave: false,
    saveUninitialized: false,
    store, // Usa lo store creato sopra
    cookie: {
        //maxAge: 1000 * 60 * 60, // 1 ora, * 24, // Durata del cookie: 1 giorno - senza maxAge il cookie durerà fino alla chiusura del browser
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production', // Usa cookie sicuri in produzione
    },
});

module.exports = sessionMiddleware;
