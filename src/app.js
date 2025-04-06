const express = require('express');
const mongoose = require('../config/db');
const helmet = require('helmet');
const rateLimitMiddleware = require('./middlewares/rateLimitMiddleware');
const cors = require('cors');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const nunjucks = require('nunjucks');
const path = require('path'); // Importa il modulo path
const sessionMiddleware = require('./middlewares/sessionMiddleware'); // Importa il middleware delle sessioni
const flash = require('connect-flash'); // Importa connect-flash
const passport = require('../config/passport');
const { router: authRouter, getLogin, postLogin, logout } = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const breweryRoutes = require('./routes/breweryRoutes');
const orderRoutes = require('./routes/orderRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const qrcodeRoutes = require('./routes/qrcodeRoutes');
const adminRoutes = require('./routes/adminRoutes');
const reviewRoutes = require('./routes/reviewRoutes');
const logWithFileName = require('./utils/logger'); // Importa logWithFileName

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
app.use(sessionMiddleware);

// Inizializza Passport e collega la sessione
app.use(passport.initialize());
app.use(passport.session());

// Configura connect-flash
app.use(flash());

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
app.use(helmet());
app.use(cors());
app.use(rateLimitMiddleware);
app.use(cookieParser());
app.use(express.json({ limit: '50mb' })); // Analizza i dati JSON
app.use(express.urlencoded({ limit: '50mb', extended: true, parameterLimit: 50000 })); // Analizza i dati URL-encoded

// Routes
app.get('/', (req, res) => {
    logger.info('Renderizzazione della pagina principale'); // Log tradotto
    res.render('index.njk'); // Renderizza il template index.njk
});

// Rotte per /login
app.get('/login', getLogin);
app.post('/login', postLogin);

// Rotta per il logout
app.get('/logout', logout);

// Usa il router per le altre rotte di autenticazione
app.use('/auth', authRouter);

app.use('/admin', adminRoutes);
app.use('/users', userRoutes);
app.use('/breweries', breweryRoutes);
app.use('/orders', orderRoutes);
app.use('/payments', paymentRoutes);
app.use('/qrcodes', qrcodeRoutes);
app.use('/reviews', reviewRoutes);

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