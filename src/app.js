const express = require('express');
const mongoose = require('../config/db');
const helmet = require('helmet');
const rateLimitMiddleware = require('./middlewares/rateLimitMiddleware');
const cors = require('cors');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const nunjucks = require('nunjucks');
const path = require('path'); // Path fornisce funzionalità per lavorare con i percorsi dei file e delle directory
const sessionMiddleware = require('./middlewares/sessionMiddleware');
const flash = require('connect-flash');
const passport = require('../config/passport');
const logWithFileName = require('./utils/logger');

const app = express();

const logger = logWithFileName(__filename); // Crea un logger con il nome del file

// Configura Nunjucks
nunjucks.configure('views', {
    autoescape: true,
    express: app,
    noCache: true, // Disabilita il caching durante lo sviluppo
});

// Imposta Nunjucks come motore di template predefinito
app.set('view engine', 'njk');

// Middleware per la gestione delle sessioni
app.use(sessionMiddleware); // Gestisce le sessioni degli utenti

// Inizializza Passport e collega la sessione
app.use(passport.initialize()); // Inizializza Passport
app.use(passport.session()); // Collega Passport alla sessione

// Configura connect-flash
app.use(flash()); // Permette di mostrare messaggi flash (una tantum) nelle viste

// Middleware per rendere i messaggi flash disponibili nelle viste
app.use((req, res, next) => {
    res.locals.message = req.flash();
    next();
});

// Middleware per rendere alreadyLoggedIn disponibile nelle viste
app.use((req, res, next) => {
    res.locals.alreadyLoggedIn = req.isAuthenticated(); // Verifica se l'utente è autenticato
    next();
});

// Middleware per servire file statici
app.use(express.static(path.join(__dirname, '../public'))); // Serve i file dalla cartella "public"

// Middleware vari
app.use(helmet()); // Helmet aiuta a proteggere l'app impostando vari header HTTP
app.use(cors()); // Abilita la condivisione di risorse tra origini diverse (CORS)
app.use(rateLimitMiddleware); // Limita la frequenza delle richieste per prevenire abusi
app.use(cookieParser()); // Analizza i cookie nelle richieste
app.use(express.json({ limit: '50mb' })); // Analizza i dati JSON
app.use(express.urlencoded({ limit: '50mb', extended: true, parameterLimit: 50000 })); // Analizza i dati URL-encoded

// Routes
app.get('/', (req, res) => {
    logger.info('Renderizzazione della pagina principale'); // Log tradotto
    res.render('index.njk'); // Renderizza il template index.njk
});

// Middleware globale per la gestione degli errori
app.use((err, req, res, next) => {
    // Log dell'errore con il messaggio e lo stack
    logger.error(`Errore: ${err.message}`);
    console.error('Stack dell\'errore:', err.stack); // Scrive lo stack dell'errore nella console

    // Imposta il messaggio di errore come flashMessage
    req.flash('error', err.message || 'Si è verificato un errore interno');

    // Ottieni l'URL della pagina precedente dall'header Referer
    const redirectUrl = req.headers.referer || '/';

    // Mantieni lo status 500 e reindirizza
    res.status(500).redirect(redirectUrl);
});

module.exports = app;