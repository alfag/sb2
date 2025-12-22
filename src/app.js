const express = require('express'); // Framework web principale per la gestione delle route e middleware
const mongoose = require('../config/db'); // Connessione e configurazione centralizzata a MongoDB tramite Mongoose
const helmet = require('helmet'); // Middleware sicurezza: imposta header HTTP per protezione da vulnerabilità comuni
const cors = require('cors'); // Middleware per abilitare CORS e gestire richieste cross-origin
const bodyParser = require('body-parser'); // Middleware legacy per parsing body (non usato direttamente, vedi override sotto)
const cookieParser = require('cookie-parser'); // Middleware per parsing e gestione dei cookie HTTP
const nunjucks = require('nunjucks'); // Motore di template lato server, configurato con autoescape e noCache in sviluppo
const path = require('path'); // Utility Node.js per gestione e normalizzazione dei percorsi file/directory
const rateLimitMiddleware = require('./middlewares/rateLimitMiddleware'); // Middleware legacy per rate limiting base (fallback)
const sessionMiddleware = require('./middlewares/sessionMiddleware'); // Middleware personalizzato per gestione sessioni utente su MongoDB
const authMiddleware = require('./middlewares/authMiddleware'); // Middleware di autenticazione e gestione ruoli
const flash = require('connect-flash'); // Middleware per messaggi flash temporanei, integrato con sessione e res.locals
const passport = require('../config/passport'); // Configurazione Passport.js: strategie locali e OAuth multi-provider, gestione autenticazione multi-ruolo
const logWithFileName = require('./utils/logger'); // Logger centralizzato con Winston, log su file/console e tracciabilità per file
const ErrorHandler = require('./utils/errorHandler'); // Gestione errori centralizzata: categorizzazione, logging e messaggi utente personalizzati
const RateLimitService = require('./utils/rateLimitService'); // Rate limiting avanzato: limiti multi-layer per endpoint, logging dettagliato, skip admin
const CleanupService = require('./services/cleanupService'); // Servizio pulizia automatica dati temporanei

const baseRoutes = require('./routes/baseRoutes'); // Rotte principali pubbliche e di base dell'applicazione
const administratorRoutes = require('./routes/administratorRoutes'); // Rotte amministrative (abilitabili, protette da middleware multi-ruolo)
const validationRoutes = require('./routes/validationRoutes'); // Rotte validazione birrifici/birre (administrator only)
const cacheRoutes = require('./routes/cacheRoutes'); // Rotte per gestione cache multi-layer (admin)
// const reviewRoutes = require('./routes/reviewRoutes'); // RIMOSSO: Rotte recensioni birre e AI, ora incluse in baseRoutes
const contentModerationRoutes = require('./routes/contentModerationRoutes'); // Rotte test moderazione contenuti AI (admin, sviluppo)

const app = express();
// Necessario per express-rate-limit dietro proxy o in LAN
app.set('trust proxy', 1);

const logger = logWithFileName(__filename); // Crea un logger con il nome del file

// Configura Nunjucks
const env = nunjucks.configure('views', {
  autoescape: true,
  express: app,
  noCache: process.env.NODE_ENV !== 'production', // Disabilita il caching solo in sviluppo
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

// Filtro custom tojson - converte oggetto in JSON escapato per JavaScript
env.addFilter('tojson', function(obj) {
    if (obj === null || obj === undefined) {
        return '[]';
    }
    try {
        const jsonString = JSON.stringify(obj);
        // Applica escape JavaScript
        return jsonString
            .replace(/\\/g, '\\\\')
            .replace(/'/g, "\\'")
            .replace(/"/g, '\\"')
            .replace(/\r/g, '\\r')
            .replace(/\n/g, '\\n')
            .replace(/<\/(script)/gi, '<\\/$1');
    } catch (error) {
        console.error('Errore tojson filter:', error);
        return '[]';
    }
});

// Filtro custom cleantext - pulisce caratteri strani da encoding problemi
env.addFilter('cleantext', function(str) {
    if (typeof str !== 'string') return str;
    
    return str
        // Fix caratteri UTF-8 mal codificati comuni
        .replace(/â/g, 'a')
        .replace(/ã/g, 'a')
        .replace(/à/g, 'a')
        .replace(/á/g, 'a')
        .replace(/è/g, 'e')
        .replace(/é/g, 'e')
        .replace(/ì/g, 'i')
        .replace(/í/g, 'i')
        .replace(/ò/g, 'o')
        .replace(/ó/g, 'o')
        .replace(/ù/g, 'u')
        .replace(/ú/g, 'u')
        .replace(/ñ/g, 'n')
        .replace(/ç/g, 'c')
        // Rimuove caratteri di controllo invisibili
        .replace(/[\x00-\x1F\x7F-\x9F]/g, '')
        // Normalizza spazi
        .replace(/\s+/g, ' ')
        .trim();
});

// Filtro custom date - formatta le date usando JavaScript nativo
env.addFilter('date', function(date, format) {
    if (!date) return '';
    
    const d = new Date(date);
    if (isNaN(d.getTime())) return '';
    
    // Formati supportati
    switch (format) {
        case 'DD/MM/YYYY':
            return d.toLocaleDateString('it-IT', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
            });
        case 'd/m/Y':
            return d.toLocaleDateString('it-IT', {
                day: 'numeric',
                month: 'numeric',
                year: 'numeric'
            });
        case 'd/m/Y H:i':
            return d.toLocaleString('it-IT', {
                day: 'numeric',
                month: 'numeric',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        case 'DD/MM/YYYY HH:mm':
            return d.toLocaleString('it-IT', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        default:
            // Formato di default
            return d.toLocaleDateString('it-IT');
    }
});

// Imposta Nunjucks come motore di template predefinito
app.set('view engine', 'njk');

// Configura trust proxy per rate limiting (necessario per leggere IP correttamente)
app.set('trust proxy', true);

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
app.use(authMiddleware.setActiveRole);

// Middleware per pulizia automatica dati temporanei
app.use(CleanupService.middleware());

// Middleware per servire file statici
app.use(express.static(path.join(__dirname, '../public'))); // Serve i file dalla cartella "public"

// Middleware NO-CACHE per development (disabilita completamente la cache)
// Attivo per: localhost, 127.0.0.1, e reti locali private (192.168.x.x, 10.x.x.x, 172.16-31.x.x)
if (process.env.NODE_ENV !== 'production') {
    app.use((req, res, next) => {
        const host = req.hostname || req.get('host') || '';
        const isLocalNetwork = host === 'localhost' || 
                               host === '127.0.0.1' ||
                               /^192\.168\.\d{1,3}\.\d{1,3}$/.test(host) ||
                               /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host) ||
                               /^172\.(1[6-9]|2[0-9]|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(host);
        
        if (isLocalNetwork) {
            res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
            res.set('Pragma', 'no-cache');
            res.set('Expires', '0');
        }
        next();
    });
    logger.info('NO-CACHE headers abilitati per development (localhost + reti locali)');
}

// Middleware per disclaimer maggiore età
app.use(authMiddleware.disclaimerMiddleware);

// Middleware vari
app.use(helmet({
    contentSecurityPolicy: {
        useDefaults: false,
        directives: {
            "default-src": ["'self'"],
            "script-src": ["'self'"],
            "style-src": ["'self'", "'unsafe-inline'"],
            "style-src-elem": ["'self'", "'unsafe-inline'"],
            "font-src": ["'self'", "data:"],
            "img-src": ["'self'", "data:", "https:", "http:"],
            "connect-src": ["'self'"],
            "object-src": ["'none'"],
            "base-uri": ["'self'"]
        }
    }
})); // Helmet con CSP personalizzata per Font Awesome, Chart.js e sicurezza
app.use(cors()); // Abilita la condivisione di risorse tra origini diverse (CORS)

// Rate Limiting avanzato
app.use(RateLimitService.createLoggingMiddleware()); // Logging rate limit hits
app.use('/api/rate-limit-info', RateLimitService.getRateLimitInfo); // Info sui limiti
app.use(RateLimitService.createGeneralLimiter()); // Rate limiting generale
app.use('/review/first-check-ai', RateLimitService.createAILimiter()); // Rate limiting AI
app.use('/review/create-multiple', RateLimitService.createReviewLimiter()); // Rate limiting recensioni
app.use('/auth/login', RateLimitService.createAuthLimiter()); // Rate limiting auth
app.use('/auth/register', RateLimitService.createRegistrationLimiter()); // Rate limiting registrazione

app.use(cookieParser()); // Analizza i cookie nelle richieste

// Middleware unico per body parsing - ESCLUDE routes con upload multipart (Multer)
app.use((req, res, next) => {
  if (req.path.startsWith('/api/gemini/')) {
    return next();
  }
  express.json({ limit: '50mb' })(req, res, function() {
    express.urlencoded({ limit: '50mb', extended: true, parameterLimit: 50000 })(req, res, next);
  });
});

// Middleware per la Content Security Policy
app.use((req, res, next) => {
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline'; " +
    "object-src 'none'; " +
    "style-src 'self' 'unsafe-inline'; " +
    "style-src-elem 'self' 'unsafe-inline'; " +
    "img-src 'self' data: https:; " +
    "media-src 'none'; " +
    "frame-src 'none'; " +
    "font-src 'self' data:; " +
    "connect-src 'self';"
  );
  next();
});

// Middleware centralizzato per la gestione degli errori
app.use(ErrorHandler.handle);



// Routes
app.use('/', baseRoutes); // Gestisce le rotte di base dell'applicazione
app.use('/administrator', administratorRoutes); // Gestisce le rotte amministrative
app.use('/administrator/validation', validationRoutes); // Gestisce validazione birrifici/birre (admin only)
app.use('/api/cache', cacheRoutes); // Gestisce le rotte cache (admin)
// app.use('/', reviewRoutes); // RIMOSSO: Le rotte review sono già incluse in baseRoutes con prefisso /review
app.use('/review', require('./routes/aiVerificationRoutes')); // Sistema Anti-Allucinazioni AI
app.use('/review', require('./routes/reviewAsyncRoutes')); // Sistema Async Recensioni con Bull+Redis (punto 15) - MOUNT SU /review
app.use('/review', require('./routes/reviewTestRoutes')); // 🧪 ROTTE TEST - ZERO SALVATAGGI DATABASE
app.use('/api/web-search', require('./routes/webSearchRoutes')); // Sistema Ricerca Web Automatica
app.use('/content-moderation', contentModerationRoutes); // Gestisce le rotte di test moderazione contenuti (admin)

module.exports = app;