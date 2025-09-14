const express = require('express');
const router = express.Router();
const logWithFileName = require('../utils/logger');
const authRoutes = require('./authRoutes'); // Importa le rotte di autenticazione
const administratorRoutes = require('./administratorRoutes'); // Importa le rotte amministrative
const reviewRoutes = require('./reviewRoutes');
const { isAuthenticated } = require('../middlewares/authMiddleware');
const User = require('../models/User'); // Import per aggiornamento defaultRole

const logger = logWithFileName(__filename);

router.get('/', (req, res) => {
    logger.info('Renderizzazione della pagina di benvenuto');
    res.render('welcome.njk', { user: req.user }); // Renderizza il template index.njk
});

// Gestione accettazione disclaimer maggiore età
router.post('/disclaimer', (req, res) => {
    // Imposta SOLO nella sessione corrente (si cancella quando si chiude il browser)
    req.session.disclaimerAccepted = true;
    
    logger.info('Disclaimer maggiore età accettato per la sessione corrente', {
        sessionId: req.sessionID,
        userAuthenticated: !!req.user,
        userId: req.user?._id
    });
    
    res.status(200).json({ success: true });
});

// Endpoint di debug per controllare lo stato disclaimer (solo in development)
if (process.env.NODE_ENV !== 'production') {
    router.get('/debug/disclaimer-status', (req, res) => {
        res.json({
            sessionId: req.sessionID,
            disclaimerAccepted: req.session.disclaimerAccepted,
            cookies: req.cookies
        });
    });
    
    router.post('/debug/reset-disclaimer', (req, res) => {
        req.session.disclaimerAccepted = false;
        res.clearCookie('disclaimerAccepted');
        res.json({ success: true, message: 'Disclaimer resettato' });
    });
}

// Proteggi la pagina profilo con il middleware isAuthenticated
router.get('/profile', isAuthenticated, (req, res) => {
    logger.info('Accesso alla pagina profilo');
    res.render('customer/userProfile.njk', {
        user: req.user,
        message: req.flash('info')
    });
});

router.post('/profile', isAuthenticated, (req, res) => {
    // SECURITY FIX: Validazione lato server per impedire selezione ruolo administrator
    if (req.body.activeRole && req.body.activeRole === 'administrator') {
        req.flash('error', 'Il ruolo administrator non può essere selezionato come ruolo attivo');
        return res.redirect('/profile');
    }
    
    // Gestione aggiornamento ruolo default
    if (req.body.updateDefaultRole && req.body.defaultRole) {
        if (!['customer', 'brewery'].includes(req.body.defaultRole) || 
            !req.user.role.includes(req.body.defaultRole)) {
            req.flash('error', 'Ruolo default non valido');
            return res.redirect('/profile');
        }
        
        // Aggiorna il ruolo default nel database
        User.findByIdAndUpdate(req.user._id, { defaultRole: req.body.defaultRole }, { new: true })
            .then(() => {
                req.flash('info', `Ruolo default aggiornato: ${req.body.defaultRole}`);
                res.redirect('/profile');
            })
            .catch(error => {
                logger.error('Errore aggiornamento ruolo default:', error);
                req.flash('error', 'Errore durante l\'aggiornamento del ruolo default');
                res.redirect('/profile');
            });
        return;
    }
    
    // Salva il ruolo attivo scelto in sessione
    if (req.body.activeRole && req.user.role.includes(req.body.activeRole)) {
        req.session.activeRole = req.body.activeRole;
        req.flash('info', `Ruolo attivo cambiato in: ${req.body.activeRole}`);
        
        // REDIRECT LOGIC: Se ruolo cambiato a brewery, redirect alla dashboard
        if (req.body.activeRole === 'brewery' && req.user.breweryDetails) {
            return res.redirect('/brewery/dashboard');
        }
    }
    // Puoi anche gestire qui l'aggiornamento password/dati se necessario
    res.redirect('/profile');
});

router.use('/', authRoutes); // Usa le rotte di autenticazione
router.use('/administrator', administratorRoutes); // Usa le rotte amministrative
router.use('/review', reviewRoutes); // Usa le rotte di recensioni

// NUOVA ROTTA: Dashboard brewery per utenti con ruolo brewery
router.get('/brewery/dashboard', isAuthenticated, async (req, res) => {
    try {
        // Verifica che l'utente abbia il ruolo brewery e sia attivo
        if (!req.user.role.includes('brewery') || 
            (req.session.activeRole && req.session.activeRole !== 'brewery')) {
            req.flash('error', 'Accesso negato. Richiesto ruolo brewery attivo.');
            return res.redirect('/profile');
        }

        // Verifica che l'utente abbia breweryDetails
        if (!req.user.breweryDetails) {
            req.flash('error', 'Dati birrificio non trovati. Contatta l\'amministratore.');
            return res.redirect('/profile');
        }

        // Redirect alle statistiche specifiche del birrificio
        const breweryId = req.user.breweryDetails._id || req.user.breweryDetails;
        logger.info(`Brewery user accede alla dashboard: ${req.user.username}, brewery: ${breweryId}`);
        return res.redirect(`/administrator/statistics/brewery/${breweryId}`);
        
    } catch (error) {
        logger.error('Errore accesso brewery dashboard:', error);
        req.flash('error', 'Errore durante l\'accesso alla dashboard');
        res.redirect('/profile');
    }
});

module.exports = router;