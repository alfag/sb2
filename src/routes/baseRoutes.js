const express = require('express');
const router = express.Router();
const mongoose = require('mongoose'); // 🆕 Import per ObjectId
const logWithFileName = require('../utils/logger');
const authRoutes = require('./authRoutes'); // Importa le rotte di autenticazione
const administratorRoutes = require('./administratorRoutes'); // Importa le rotte amministrative
const reviewRoutes = require('./reviewRoutes');
const { isAuthenticated } = require('../middlewares/authMiddleware');
const uploadMiddleware = require('../middlewares/uploadMiddleware'); // 🆕 Upload middleware
const User = require('../models/User'); // Import per aggiornamento defaultRole
const Brewery = require('../models/Brewery'); // 🆕 Import per gestione immagini
const profileController = require('../controllers/profileController'); // 🆕 Profile controller

const logger = logWithFileName(__filename);

router.get('/', (req, res) => {
    // Debug logging per capire lo stato dell'utente
    if (req.user) {
        logger.info('Home access - User info:', {
            username: req.user.username,
            roles: req.user.role,
            defaultRole: req.user.defaultRole,
            sessionActiveRole: req.session.activeRole,
            hasBreweryDetails: !!req.user.breweryDetails
        });
    }
    
    // Se l'utente è autenticato e ha ruolo brewery attivo, redirect alla dashboard
    if (req.user && 
        req.session.activeRole === 'brewery' &&
        req.user.role.includes('brewery') &&
        req.user.breweryDetails) {
        logger.info(`Redirect utente brewery dalla home alla dashboard: ${req.user.username}`);
        return res.redirect('/brewery/dashboard');
    }
    
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
// Ora il profilo è gestito tramite dropdown, redirect alla home
router.get('/profile', isAuthenticated, (req, res) => {
    logger.info('Accesso al profilo - redirect alla home con dropdown ruoli');
    // Redirect alla home page dove il dropdown ruoli è disponibile
    res.redirect('/#profile-dropdown');
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
// FASE 2: Brewery Dashboard Unificato
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

        // Popola i dati brewery per il controller
        await User.populate(req.user, 'breweryDetails');
        
        // Usa il nuovo controller dedicato per la dashboard unificata
        const adminController = require('../controllers/administratorController');
        req.params.id = req.user.breweryDetails._id || req.user.breweryDetails;
        
        logger.info(`Brewery user accede alla dashboard unificata: ${req.user.username}, brewery: ${req.params.id}`);
        return await adminController.getBreweryDashboard(req, res);
        
    } catch (error) {
        logger.error('Errore accesso brewery dashboard:', error);
        req.flash('error', 'Errore durante l\'accesso alla dashboard');
        res.redirect('/profile');
    }
});

// FASE 2: Route per aggiornamento dati brewery dalla dashboard
router.post('/brewery/dashboard/update/:id', 
    isAuthenticated, 
    uploadMiddleware.breweryImagesUpload, // 🆕 Middleware upload immagini
    async (req, res) => {
    try {
        // Verifica che l'utente abbia il ruolo brewery
        if (!req.user.role.includes('brewery')) {
            req.flash('error', 'Accesso negato. Richiesto ruolo brewery.');
            return res.redirect('/profile');
        }

        const breweryId = req.params.id;
        
        // Verifica che l'utente possa modificare questo birrificio
        const isOwnerBrewery = req.user.breweryDetails &&
                              (req.user.breweryDetails._id?.toString() === breweryId || 
                               req.user.breweryDetails.toString() === breweryId);
        const isAdmin = req.user.role.includes('administrator');

        if (!isAdmin && !isOwnerBrewery) {
            req.flash('error', 'Non hai i permessi per modificare questo birrificio.');
            return res.redirect('/brewery/dashboard');
        }

        // Prepara i dati per l'aggiornamento
        const updateData = { ...req.body };
        
        // 🆕 Gestione upload immagini
        if (req.files && req.files.length > 0) {
            // Ottieni il brewery attuale per aggiornare l'array immagini
            const currentBrewery = await Brewery.findById(breweryId);
            const currentImages = currentBrewery?.breweryImages || [];
            
            // Aggiungi le nuove immagini all'array esistente
            const newImagePaths = req.files.map(file => `/images/breweries/${file.filename}`);
            updateData.breweryImages = [...currentImages, ...newImagePaths];
            
            logger.info(`🖼️ Upload ${req.files.length} nuove immagini per brewery ${breweryId}`, {
                newImages: newImagePaths,
                totalImages: updateData.breweryImages.length
            });
        }
        
        logger.info(`Aggiornamento dati brewery ${breweryId} da dashboard, dati:`, updateData);
        
        // Usa il controller per l'aggiornamento
        const adminController = require('../controllers/administratorController');
        const updatedBrewery = await adminController.updateBrewery(breweryId, updateData);
        
        if (updatedBrewery) {
            const uploadMessage = req.files && req.files.length > 0 
                ? ` e ${req.files.length} immagine/i caricate`
                : '';
            req.flash('success', `Dati birrificio aggiornati con successo${uploadMessage}`);
        } else {
            req.flash('error', 'Errore durante l\'aggiornamento');
        }
        
        res.redirect('/brewery/dashboard');
        
    } catch (error) {
        logger.error('Errore aggiornamento brewery da dashboard:', error);
        req.flash('error', 'Errore durante l\'aggiornamento dei dati');
        res.redirect('/brewery/dashboard');
    }
});

// 🆕 Route per upload logo birrificio
router.post('/brewery/dashboard/logo/:id', 
    isAuthenticated, 
    uploadMiddleware.breweryLogoUpload, 
    async (req, res) => {
    try {
        // Verifica che l'utente abbia il ruolo brewery
        if (!req.user.role.includes('brewery')) {
            req.flash('error', 'Accesso negato. Richiesto ruolo brewery.');
            return res.redirect('/profile');
        }

        const breweryId = req.params.id;
        
        // Verifica che l'utente possa modificare questo birrificio
        const isOwnerBrewery = req.user.breweryDetails &&
                              (req.user.breweryDetails._id?.toString() === breweryId || 
                               req.user.breweryDetails.toString() === breweryId);
        const isAdmin = req.user.role.includes('administrator');

        if (!isAdmin && !isOwnerBrewery) {
            req.flash('error', 'Non hai i permessi per modificare questo birrificio.');
            return res.redirect('/brewery/dashboard');
        }

        if (!req.file) {
            req.flash('error', 'Nessun file selezionato per il logo');
            return res.redirect('/brewery/dashboard');
        }

        // Aggiorna il brewery con il nuovo logo
        const logoPath = `/images/breweries/${req.file.filename}`;
        
        const adminController = require('../controllers/administratorController');
        const updatedBrewery = await adminController.updateBrewery(breweryId, {
            breweryLogo: logoPath
        });
        
        if (updatedBrewery) {
            logger.info(`🏷️ Logo aggiornato per brewery ${breweryId}: ${logoPath}`);
            req.flash('success', 'Logo birrificio aggiornato con successo');
        } else {
            req.flash('error', 'Errore durante l\'aggiornamento del logo');
        }
        
        res.redirect('/brewery/dashboard');
        
    } catch (error) {
        logger.error('Errore upload logo brewery:', error);
        req.flash('error', 'Errore durante l\'upload del logo');
        res.redirect('/brewery/dashboard');
    }
});

// 🆕 Route per eliminazione immagine birrificio
router.delete('/brewery/dashboard/image/:id', isAuthenticated, async (req, res) => {
    try {
        const breweryId = req.params.id;
        const imageToDelete = req.body.imagePath;
        
        // Verifica autorizzazioni
        const isOwnerBrewery = req.user.breweryDetails &&
                              (req.user.breweryDetails._id?.toString() === breweryId || 
                               req.user.breweryDetails.toString() === breweryId);
        const isAdmin = req.user.role.includes('administrator');

        if (!isAdmin && !isOwnerBrewery) {
            return res.status(403).json({ success: false, message: 'Accesso negato' });
        }

        // Rimuovi l'immagine dall'array del brewery
        const brewery = await Brewery.findById(breweryId);
        if (!brewery) {
            return res.status(404).json({ success: false, message: 'Birrificio non trovato' });
        }

        brewery.breweryImages = brewery.breweryImages.filter(img => img !== imageToDelete);
        await brewery.save();

        // Elimina il file dal filesystem
        const filename = imageToDelete.split('/').pop();
        await uploadMiddleware.deleteBreweryImage(filename);

        logger.info(`🗑️ Immagine eliminata da brewery ${breweryId}: ${imageToDelete}`);
        res.json({ success: true, message: 'Immagine eliminata con successo' });
        
    } catch (error) {
        logger.error('Errore eliminazione immagine brewery:', error);
        res.status(500).json({ success: false, message: 'Errore durante l\'eliminazione' });
    }
});

// API Endpoints per gestione ruoli utente
router.get('/api/user/roles', isAuthenticated, async (req, res) => {
    try {
        logger.info(`Richiesta dati ruoli per utente: ${req.user.username}`);
        
        // Filtra ruoli per escludere administrator dalla UI (per sicurezza)
        const selectableRoles = req.user.role.filter(role => role !== 'administrator');
        
        res.json({
            success: true,
            roles: selectableRoles,
            activeRole: req.session.activeRole || req.user.defaultRole || 'customer',
            defaultRole: req.user.defaultRole || 'customer'
        });
        
    } catch (error) {
        logger.error('Errore nel recupero ruoli utente:', error);
        res.status(500).json({
            success: false,
            message: 'Errore interno del server'
        });
    }
});

// API Endpoint per ottenere tutti i birrifici (per disambiguation)
router.get('/api/breweries/all', async (req, res) => {
    try {
        logger.info('Richiesta lista completa birrifici per disambiguation');
        
        const breweries = await Brewery.find({}, 'breweryName _id')
            .sort({ breweryName: 1 })
            .lean();
        
        res.json({
            success: true,
            breweries: breweries
        });
        
    } catch (error) {
        logger.error('Errore nel recupero lista birrifici:', error);
        res.status(500).json({
            success: false,
            message: 'Errore interno del server'
        });
    }
});

router.post('/api/user/roles', isAuthenticated, async (req, res) => {
    try {
        const { activeRole, defaultRole } = req.body;
        const userId = req.user._id;
        
        logger.info(`Aggiornamento ruoli per utente ${req.user.username}:`, {
            activeRole,
            defaultRole,
            currentRoles: req.user.role
        });
        
        // Validazione: i ruoli devono essere presenti nell'array ruoli dell'utente
        const userRoles = req.user.role;
        
        if (activeRole && !userRoles.includes(activeRole)) {
            return res.status(400).json({
                success: false,
                message: 'Ruolo attivo non valido per questo utente'
            });
        }
        
        if (defaultRole && !userRoles.includes(defaultRole)) {
            return res.status(400).json({
                success: false,
                message: 'Ruolo default non valido per questo utente'
            });
        }
        
        // SECURITY FIX: Blocca la selezione di administrator come default tramite UI
        if (defaultRole === 'administrator') {
            return res.status(403).json({
                success: false,
                message: 'Il ruolo administrator non può essere impostato come default tramite questa interfaccia'
            });
        }
        
        // Aggiorna il defaultRole nel database se specificato
        const updateData = {};
        if (defaultRole) {
            updateData.defaultRole = defaultRole;
        }
        
        if (Object.keys(updateData).length > 0) {
            await User.findByIdAndUpdate(userId, updateData);
            logger.info(`DefaultRole aggiornato nel database per utente ${req.user.username}: ${defaultRole}`);
        }
        
        // Aggiorna activeRole nella sessione se specificato
        if (activeRole) {
            req.session.activeRole = activeRole;
            logger.info(`ActiveRole aggiornato nella sessione per utente ${req.user.username}: ${activeRole}`);
        }
        
        res.json({
            success: true,
            message: 'Ruoli aggiornati con successo',
            activeRole: req.session.activeRole,
            defaultRole: defaultRole || req.user.defaultRole
        });
        
    } catch (error) {
        logger.error('Errore nell\'aggiornamento ruoli utente:', error);
        res.status(500).json({
            success: false,
            message: 'Errore interno del server'
        });
    }
});

// 🔧 Route per log errori frontend
router.post('/api/log-error', (req, res) => {
    const { error, url, line, column } = req.body;
    logWithFileName(__filename, 'error', 'Errore JavaScript frontend:', {
        error,
        url,
        line,
        column,
        userAgent: req.get('User-Agent'),
        userId: req.user ? req.user._id : 'guest'
    });
    res.status(200).json({ success: true });
});

// 🆕 COMPLETE PROFILE MANAGEMENT ROUTES
// GET - Visualizza la pagina di gestione profilo completo
router.get('/complete-profile', isAuthenticated, profileController.getCompleteProfile);

// POST - Aggiorna i dati del profilo completo
router.post('/complete-profile', isAuthenticated, (req, res, next) => {
    // Gestisci upload multipli con configurazione custom
    const multer = require('multer');
    const path = require('path');
    const fs = require('fs');
    
    // Storage su disco per immagini birrifici
    const breweryDiskStorage = multer.diskStorage({
        destination: function (req, file, cb) {
            const uploadPath = path.join(__dirname, '../../public/uploads');
            
            // Crea la directory se non esiste
            if (!fs.existsSync(uploadPath)) {
                fs.mkdirSync(uploadPath, { recursive: true });
            }
            
            cb(null, uploadPath);
        },
        filename: function (req, file, cb) {
            const timestamp = Date.now();
            const fieldName = file.fieldname;
            const extension = path.extname(file.originalname).toLowerCase();
            const filename = `brewery_${timestamp}_${fieldName}${extension}`;
            cb(null, filename);
        }
    });
    
    // Filtro per immagini
    const imageFilter = (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Solo immagini sono consentite'), false);
        }
    };
    
    const upload = multer({
        storage: breweryDiskStorage,
        fileFilter: imageFilter,
        limits: {
            fileSize: 5 * 1024 * 1024, // 5MB
            files: 11 // 1 logo + 10 immagini max
        }
    }).fields([
        { name: 'breweryLogo', maxCount: 1 },
        { name: 'breweryImages', maxCount: 10 }
    ]);
    
    upload(req, res, (err) => {
        if (err) {
            req.flash('error', 'Errore durante l\'upload dei file: ' + err.message);
            return res.redirect('/complete-profile');
        }
        profileController.updateCompleteProfile(req, res);
    });
});

// API Routes per upload specifici
router.post('/api/profile/brewery/logo', isAuthenticated, uploadMiddleware.breweryLogoUpload, profileController.uploadBreweryLogo);
router.post('/api/profile/brewery/images', isAuthenticated, uploadMiddleware.breweryImagesUpload, profileController.uploadBreweryImages);
router.delete('/api/profile/brewery/image', isAuthenticated, profileController.deleteBreweryImage);

// Route per gestire rate limit exceeded
router.get('/rate-limit-exceeded', (req, res) => {
    logger.info('Accesso alla pagina di rate limit exceeded', {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        user: req.user?.username || 'anonymous'
    });
    
    res.render('rateLimitExceeded.njk', { 
        user: req.user,
        title: 'Limite Richieste Superato'
    });
});

module.exports = router;