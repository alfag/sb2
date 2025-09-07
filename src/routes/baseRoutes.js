const express = require('express');
const router = express.Router();
const logWithFileName = require('../utils/logger');
const authRoutes = require('./authRoutes'); // Importa le rotte di autenticazione
const administratorRoutes = require('./administratorRoutes'); // Importa le rotte amministrative
const reviewRoutes = require('./reviewRoutes');
const { isAuthenticated } = require('../middlewares/authMiddleware');

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
    // Salva il ruolo attivo scelto in sessione
    if (req.body.activeRole && req.user.role.includes(req.body.activeRole)) {
        req.session.activeRole = req.body.activeRole;
        req.flash('info', `Ruolo attivo cambiato in: ${req.body.activeRole}`);
    }
    // Puoi anche gestire qui l'aggiornamento password/dati se necessario
    res.redirect('/profile');
});

router.use('/', authRoutes); // Usa le rotte di autenticazione
router.use('/administrator', administratorRoutes); // Usa le rotte amministrative
router.use('/review', reviewRoutes); // Usa le rotte di recensioni

module.exports = router;