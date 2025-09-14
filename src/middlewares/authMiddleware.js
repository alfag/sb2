const User = require('../models/User');
const logWithFileName = require('../utils/logger'); // Importa logWithFileName

const logger = logWithFileName(__filename); // Crea un logger con il nome del file

const isAuthenticated = (req, res, next) => {
    if (!req.isAuthenticated()) {
        logger.warn('Accesso negato. Utente non autenticato.');
        req.flash('error', 'Accesso negato. Effettua il login per continuare.');
        return res.redirect('/');
    }

    // Aggiungi l'informazione al req
    req.alreadyLoggedIn = true;
    logger.info(`Utente già autenticato: ${req.user.toJSON().username}`);
    next(); // Passa al middleware successivo o alla rotta
};

exports.isAdmin = (req, res, next) => {
    if (
        req.isAuthenticated() &&
        (
            (req.session.activeRole === 'administrator') ||
            (Array.isArray(req.user.role) && req.user.role.includes('administrator'))
        )
    ) {
        return next();
    }
    res.redirect('/login');
};

exports.isBrewery = (req, res, next) => {
    if (
        req.isAuthenticated() &&
        (
            (req.session.activeRole === 'brewery') ||
            (Array.isArray(req.user.role) && req.user.role.includes('brewery'))
        )
    ) {
        return next();
    }
    res.redirect('/login');
};

exports.isCustomer = (req, res, next) => {
    if (
        req.isAuthenticated() &&
        (
            (req.session.activeRole === 'customer') ||
            (Array.isArray(req.user.role) && req.user.role.includes('customer'))
        )
    ) {
        return next();
    }
    res.redirect('/login');
};

exports.ensureRole = (roles) => (req, res, next) => {
  if (!req.user || !req.user.role || !roles.some(r => Array.isArray(req.user.role) ? req.user.role.includes(r) : req.user.role === r)) {
    return res.status(403).send('Accesso negato');
  }
  next();
};

// Middleware per rendere activeRole disponibile nelle viste
const setActiveRole = (req, res, next) => {
    if (req.session.activeRole) {
        res.locals.activeRole = req.session.activeRole;
    } else if (req.user && req.user.role) {
        const rolePriority = ['administrator', 'brewery', 'customer'];
        let userRoles = Array.isArray(req.user.role) ? req.user.role : [req.user.role];
        
        // NUOVA LOGICA: Usa defaultRole se disponibile e presente nei ruoli dell'utente
        let selectedRole;
        if (req.user.defaultRole && userRoles.includes(req.user.defaultRole)) {
            selectedRole = req.user.defaultRole;
        } else {
            const found = rolePriority.find(r => userRoles.includes(r));
            selectedRole = found || userRoles[0];
        }
        
        res.locals.activeRole = selectedRole;
        
        // REDIRECT LOGIC: Se utente ha ruolo brewery attivo e sta accedendo alla root, redirect alle statistiche
        if (selectedRole === 'brewery' && req.path === '/' && req.user.breweryDetails) {
            logger.info(`Redirect brewery user alla dashboard: ${req.user.username}`);
            return res.redirect('/brewery/dashboard');
        }
    } else {
        res.locals.activeRole = null;
    }
    next();
};

// Middleware per il disclaimer della maggiore età
const disclaimerMiddleware = (req, res, next) => {
    // Il disclaimer deve essere mostrato solo se NON è stato accettato nella sessione corrente
    // e SOLO per le pagine HTML principali (non AJAX, API, risorse statiche)
    
    // Definisci percorsi esclusi dal controllo del disclaimer
    const excludedPaths = ['/disclaimer', '/public/js/review.js', '/debug/'];
    const isExcludedPath = excludedPaths.some(path => req.path === path || req.path.startsWith(path));
    
    // Escludi richieste AJAX, API, risorse statiche basate su header, metodo e percorso
    const isAjaxRequest = req.headers['x-requested-with'] === 'XMLHttpRequest' || 
                         req.headers['content-type']?.includes('application/json') ||
                         req.method === 'POST' ||  // Tutte le POST sono considerate AJAX
                         req.path.startsWith('/api/') ||
                         req.path.startsWith('/review/') ||
                         req.path.startsWith('/auth/') ||
                         req.path.startsWith('/admin/') ||
                         req.path.startsWith('/customer/') ||
                         req.path.startsWith('/brewery/') ||
                         req.path.startsWith('/public/') ||
                         req.path.startsWith('/css/') ||
                         req.path.startsWith('/js/') ||
                         req.path.startsWith('/images/') ||
                         req.path.includes('session-data') ||
                         req.path.includes('clear-session-data') ||
                         req.path === '/favicon.ico' ||
                         req.path === '/manifest.json' ||
                         req.path === '/service-worker.js';
    
    // Mostra disclaimer SOLO se:
    // 1. Non è stato accettato nella sessione
    // 2. Non è un percorso escluso
    // 3. Non è una richiesta AJAX/API
    // 4. È una richiesta GET per una pagina HTML
    const shouldShowDisclaimer = !req.session.disclaimerAccepted && 
                                !isExcludedPath && 
                                !isAjaxRequest && 
                                req.method === 'GET';
    
    if (shouldShowDisclaimer) {
        res.locals.showDisclaimer = true;
        // Logger intenzionalmente commentato per ridurre verbosità nei log
        // Questo disclaimer viene mostrato quando l'utente accede per la prima volta
        // a una pagina HTML principale e non ha ancora accettato il disclaimer
        // logger.info('Popup disclaimer maggiore età mostrato', {
        //     sessionId: req.sessionID,
        //     path: req.path,
        //     method: req.method,
        //     disclaimerAccepted: req.session.disclaimerAccepted,
        //     isExcludedPath: isExcludedPath,
        //     isAjaxRequest: isAjaxRequest,
        //     userAgent: req.get('User-Agent')?.substring(0, 50)
        // });
    } else {
        res.locals.showDisclaimer = false;
        // Logger rimosso per non loggare
        // logger.debug('Disclaimer NON mostrato', {
        //     sessionId: req.sessionID,
        //     path: req.path,
        //     disclaimerAccepted: req.session.disclaimerAccepted,
        //     isExcludedPath: isExcludedPath,
        //     isAjaxRequest: isAjaxRequest
        // });
    }
    next();
};

module.exports = {
    isAuthenticated,
    isAdmin: exports.isAdmin,
    isBrewery: exports.isBrewery,
    isCustomer: exports.isCustomer,
    ensureRole: exports.ensureRole,
    setActiveRole,
    disclaimerMiddleware,
};