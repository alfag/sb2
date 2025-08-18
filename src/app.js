const express = require('express');
const mongoose = require('../config/db');
const helmet = require('helmet');
const cors = require('cors');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const nunjucks = require('nunjucks');
const path = require('path'); // Path fornisce funzionalità per lavorare con i percorsi dei file e delle directory
const rateLimitMiddleware = require('./middlewares/rateLimitMiddleware');
const sessionMiddleware = require('./middlewares/sessionMiddleware');
const disclaimerMiddleware = require('./middlewares/disclaimerMiddleware');
const flash = require('connect-flash');
const passport = require('../config/passport');
const logWithFileName = require('./utils/logger');
const ErrorHandler = require('./utils/errorHandler');
const RateLimitService = require('./utils/rateLimitService');

const baseRoutes = require('./routes/baseRoutes');
const administratorRoutes = require('./routes/administratorRoutes');
const cacheRoutes = require('./routes/cacheRoutes');
const reviewRoutes = require('./routes/reviewRoutes');
const contentModerationRoutes = require('./routes/contentModerationRoutes');

const app = express();
// Necessario per express-rate-limit dietro proxy o in LAN
app.set('trust proxy', 1);

const logger = logWithFileName(__filename); // Crea un logger con il nome del file

// Configura Nunjucks
const env = nunjucks.configure('views', {
    autoescape: true,
    express: app,
    noCache: true, // Disabilita il caching durante lo sviluppo
});

// Filtro custom escapejs
env.addFilter('escapejs', function(str) {
    if (typeof str !== 'string') return str;
    return str
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\\'")
        .replace(/"/g, '\\"')
        .replace(/\r/g, '\\r')
        .replace(/\n/g, '\\n')
        .replace(/<\/(script)/gi, '<\\/$1');
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

// Middleware per rendere activeRole disponibile nelle viste
app.use((req, res, next) => {
    if (req.session.activeRole) {
        res.locals.activeRole = req.session.activeRole;
    } else if (req.user && req.user.role) {
        const rolePriority = ['administrator', 'brewery', 'customer'];
        let userRoles = Array.isArray(req.user.role) ? req.user.role : [req.user.role];
        const found = rolePriority.find(r => userRoles.includes(r));
        res.locals.activeRole = found || userRoles[0];
    } else {
        res.locals.activeRole = null;
    }
    next();
});

// Middleware per servire file statici
app.use(express.static(path.join(__dirname, '../public'))); // Serve i file dalla cartella "public"

// Middleware per disclaimer maggiore età
app.use(disclaimerMiddleware);

// Middleware vari
app.use(helmet()); // Helmet aiuta a proteggere l'app impostando vari header HTTP
app.use(cors()); // Abilita la condivisione di risorse tra origini diverse (CORS)

// Rate Limiting avanzato
app.use(RateLimitService.createLoggingMiddleware()); // Logging rate limit hits
app.use('/api/rate-limit-info', RateLimitService.getRateLimitInfo); // Info sui limiti
app.use(RateLimitService.createGeneralLimiter()); // Rate limiting generale
app.use('/review/first-check-ai', RateLimitService.createAILimiter()); // Rate limiting AI
app.use('/review/create-multiple', RateLimitService.createReviewLimiter()); // Rate limiting recensioni
app.use('/auth/login', RateLimitService.createAuthLimiter()); // Rate limiting auth
app.use('/auth/register', RateLimitService.createRegistrationLimiter()); // Rate limiting registrazione

app.use(rateLimitMiddleware); // Limita la frequenza delle richieste per prevenire abusi (legacy)
app.use(cookieParser()); // Analizza i cookie nelle richieste

// Middleware per body parsing - ESCLUDI routes con upload multipart
app.use((req, res, next) => {
  // Skip body parsing per routes che usano Multer
  if (req.path.startsWith('/api/gemini/')) {
    return next();
  }
  // Applica body parsing per altre routes
  express.json({ limit: '50mb' })(req, res, next);
});

app.use((req, res, next) => {
  // Skip body parsing per routes che usano Multer  
  if (req.path.startsWith('/api/gemini/')) {
    return next();
  }
  // Applica body parsing per altre routes
  express.urlencoded({ limit: '50mb', extended: true, parameterLimit: 50000 })(req, res, next);
});

// Middleware per la Content Security Policy
app.use((req, res, next) => {
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self'; object-src 'none'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; media-src 'none'; frame-src 'none'; font-src 'self';"
  );
  next();
});

// Middleware centralizzato per la gestione degli errori
app.use(ErrorHandler.handle);



// Routes
app.use('/', baseRoutes); // Gestisce le rotte di base dell'applicazione
//app.use('/admin', administratorRoutes); // Gestisce le rotte amministrative
app.use('/api/cache', cacheRoutes); // Gestisce le rotte cache (admin)
app.use('/', reviewRoutes); // Gestisce le rotte delle recensioni e AI (senza prefisso, include /api/...)
app.use('/content-moderation', contentModerationRoutes); // Gestisce le rotte di test moderazione contenuti (admin)

module.exports = app;