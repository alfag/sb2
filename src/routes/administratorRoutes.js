const express = require('express');
const router = express.Router();
const adminController = require('../controllers/administratorController');
const reviewController = require('../controllers/reviewController');
const authMiddleware = require('../middlewares/authMiddleware');
const Brewery = require('../models/Brewery');
const logWithFileName = require('../utils/logger'); // Importa logWithFileName
const WebScrapingService = require('../services/webScrapingService'); // 🖼️ Per scraping logo
const SocialMediaValidationService = require('../services/socialMediaValidationService'); // 📱 Per scraping social (1 feb 2026)
const LogoAnalyzerService = require('../services/logoAnalyzerService'); // 🎨 Per analisi luminosità logo (1 feb 2026)

const logger = logWithFileName(__filename); // Crea un logger con il nome del file

// ========================================
// Funzione helper per calcolare i campi mancanti di un birrificio
// Usata per mostrare alert "Dati Incompleti" nelle pagine view/edit
// ========================================
function calculateMissingFields(brewery) {
    const missingFields = [];
    
    // Campi principali obbligatori per completezza
    if (!brewery.breweryEmail) {
        missingFields.push({ field: 'Email', icon: 'fa-envelope' });
    }
    if (!brewery.breweryWebsite) {
        missingFields.push({ field: 'Sito Web', icon: 'fa-globe' });
    }
    if (!brewery.breweryPhoneNumber) {
        missingFields.push({ field: 'Telefono', icon: 'fa-phone' });
    }
    
    // Verifica logo valido (stessa logica usata nelle statistiche)
    const hasValidLogo = (brewery) => {
        if (!brewery.breweryLogo) return false;
        const logo = brewery.breweryLogo.toLowerCase();
        const invalidPatterns = [
            'placeholder', 'default', 'no-logo', 'nologo', 
            'missing', 'blank', 'empty', 'null', 'undefined'
        ];
        return !invalidPatterns.some(pattern => logo.includes(pattern));
    };
    
    if (!hasValidLogo(brewery)) {
        missingFields.push({ field: 'Logo', icon: 'fa-image' });
    }
    
    return missingFields;
}

/**
 * Calcola i campi mancanti per una birra
 * Usato per mostrare alert dati incompleti nella pagina di modifica
 */
function calculateBeerMissingFields(beer) {
    const missingFields = [];
    
    if (!beer.beerType) {
        missingFields.push({ field: 'Stile', icon: 'fa-tag', tab: 'info' });
    }
    if (!beer.alcoholContent) {
        missingFields.push({ field: 'Gradazione Alcolica', icon: 'fa-percentage', tab: 'info' });
    }
    if (!beer.description) {
        missingFields.push({ field: 'Descrizione', icon: 'fa-align-left', tab: 'desc' });
    }
    
    return missingFields;
}

// Rotta root: redirect alla home (la dashboard è stata rimossa)
router.get('/', authMiddleware.isAdmin, (req, res) => {
    logger.info('Accesso area amministrativa - redirect a home');
    res.redirect('/');
});

// Pagina Sistema (cache, code, moderazione, test AI)
router.get('/system', authMiddleware.isAdmin, (req, res) => {
    logger.info('Accesso alla pagina Sistema');
    res.render('admin/system', { title: 'Sistema', user: req.user });
});

// Lista tutti gli utenti
router.get('/users', authMiddleware.isAdmin, async (req, res) => {
    try {
        logger.info('Accesso alla lista completa utenti');
        const users = await adminController.getAllUsers();
        
        // Calcola statistiche reali dal database
        const stats = {
            totalUsers: users.length,
            customers: users.filter(u => u.role.includes('customer')).length,
            breweries: users.filter(u => u.role.includes('brewery')).length,
            administrators: users.filter(u => u.role.includes('administrator')).length
        };
        
        logger.info(`Statistiche utenti calcolate: ${JSON.stringify(stats)}`);
        
        res.render('admin/listUsers', {
            title: 'Lista Utenti',
            users: users,
            stats: stats,
            user: req.user,        // Per il layout/menu di autenticazione
            currentUser: req.user, // Per i controlli nella tabella utenti
            message: req.flash()
        });
    } catch (error) {
        logger.error(`Errore durante il recupero degli utenti: ${error.message}`);
        req.flash('error', 'Errore durante il recupero della lista utenti');
        res.redirect('/administrator');
    }
});

// Mostra il form per creare un nuovo utente
router.get('/users/new', authMiddleware.isAdmin, (req, res) => {
    logger.info('Accesso al form di creazione nuovo utente');
    res.render('admin/createUser', { title: 'Crea Nuovo Utente', user: req.user, message: req.flash() });
});

// Gestisce la creazione di un nuovo utente
router.post('/users/new', authMiddleware.isAdmin, async (req, res) => {
    try {
        logger.info('Creazione di un nuovo utente'); // Log in italiano

        // Recupera i dati dal body della richiesta
        const { username, password, role, 
                customerName, customerSurname, customerFiscalCode, customerBillingAddress, customerShippingAddress, customerPhoneNumber,
                administratorName, administratorPermission,
                breweryName, breweryDescription, breweryFiscalCode } = req.body;

        // Chiama il controller per creare un nuovo utente (la risposta viene gestita dal controller)
        await adminController.createUser({ 
            username, password, role, 
            customerName, customerSurname, customerFiscalCode, customerBillingAddress, customerShippingAddress, customerPhoneNumber,
            administratorName, administratorPermission,
            breweryName, breweryDescription, breweryFiscalCode
        }, req, res);
        // Non aggiungere altro qui, la risposta è gestita dal controller
    } catch (error) {
        logger.error(`Errore durante la creazione di un nuovo utente: ${error.message}`);
        req.flash('error', 'Errore durante la creazione del nuovo utente');
        res.render('admin/createUser', { title: 'Crea Nuovo Utente', message: { error: req.flash('error') }, user: req.user });
    }
});

// Gestisce sia la selezione che la modifica dell'utente con un'unica rotta
router.get('/users/update', authMiddleware.isAdmin, async (req, res) => {
    try {
        const userId = req.query.userUpdateId || req.params.userUpdateId;
        // Recupera tutti gli utenti tranne quello collegato
        const allUsers = await adminController.getAllUsers(req, res, { raw: true });
        const users = allUsers.filter(u => u.id !== req.user.id);

        // Recupera tutti i birrifici disponibili per la selezione
        const availableBreweries = await adminController.getAllBreweries();

        if (!userId) {
            logger.info('Accesso a updateUser senza utente selezionato');
            return res.render('admin/updateUser', { 
                title: 'Modifica Utente', 
                users, 
                userToEdit: null, 
                user: req.user, 
                availableBreweries,
                message: req.flash() 
            });
        }
        logger.info(`Accesso al form di modifica per utente con ID: ${userId}`);
        const user = await adminController.getUserById(userId);
        
        if (!user) {
            req.flash('error', 'Utente non trovato');
            return res.render('admin/updateUser', { 
                title: 'Modifica Utente', 
                users, 
                userToEdit: null, 
                user: req.user, 
                availableBreweries,
                message: req.flash() 
            });
        }
        
        logger.info(`Utente selezionato per modifica: username=${user.username}`);
        // Force reload
        
        res.render('admin/updateUser', {
            title: 'Modifica Utente',
            userToEdit: user ? (typeof user.toObject === 'function' ? user.toObject() : user) : null,
            users: null,
            user: req.user,
            availableBreweries,
            message: req.flash()
        });
    } catch (error) {
        logger.error(`Errore durante la selezione/modifica utente: ${error.message}`);
        logger.error(error.stack); // Log dello stack trace completo
        req.flash('error', 'Errore durante la selezione/modifica utente');
        res.redirect('/administrator');
    }
});

// Rotta POST per aggiornare l'utente selezionato
router.post('/users/update/:id', authMiddleware.isAdmin, async (req, res) => {
    try {
        const userId = req.params.id;
        const updateData = { ...req.body };
        
        logger.info(`🔍 Aggiornamento utente ${userId} - Dati ricevuti:`, updateData);

        // La password verrà hashata automaticamente dal middleware pre-save del modello User
        if (updateData.password && updateData.password.trim() !== '') {
            logger.info(`🔐 Password fornita per aggiornamento: "${updateData.password}"`);
            logger.info(`🔐 La password verrà hashata automaticamente dal modello User`);
            // NON hashare qui - se ne occupa il middleware pre-save
        } else {
            // Se la password è vuota, non aggiornarla
            logger.info(`🔐 Password vuota - non viene aggiornata`);
            delete updateData.password;
        }

        // Recupera l'utente completo con dettagli popolati (documento Mongoose)
        const User = require('../models/User');
        const user = await User.findById(userId)
            .populate('customerDetails')
            .populate('administratorDetails')
            .populate('breweryDetails');
            
        if (!user) {
            req.flash('error', 'Utente non trovato');
            return res.redirect('/administrator/users/update');
        }

        // Aggiorna i dettagli in base ai ruoli (sistema multi-ruolo)
        if (user.role.includes('customer') && user.customerDetails) {
            logger.info(`🔍 Aggiornamento dettagli customer per utente: ${user.username}`);
            logger.info(`📝 Dati da aggiornare:`, updateData);
            logger.info(`🔎 CustomerDetails PRIMA:`, JSON.stringify(user.customerDetails, null, 2));
            
            // Aggiorna i dettagli customer
            if (updateData.customerName !== undefined) {
                logger.info(`🏷️ Aggiornamento customerName: ${user.customerDetails.customerName} -> ${updateData.customerName}`);
                user.customerDetails.customerName = updateData.customerName;
                user.markModified('customerDetails.customerName');
            }
            if (updateData.customerSurname !== undefined) {
                logger.info(`🏷️ Aggiornamento customerSurname: ${user.customerDetails.customerSurname} -> ${updateData.customerSurname}`);
                user.customerDetails.customerSurname = updateData.customerSurname;
                user.markModified('customerDetails.customerSurname');
            }
            if (updateData.customerFiscalCode !== undefined) {
                logger.info(`🏷️ Aggiornamento customerFiscalCode: ${user.customerDetails.customerFiscalCode} -> ${updateData.customerFiscalCode}`);
                user.customerDetails.customerFiscalCode = updateData.customerFiscalCode;
                user.markModified('customerDetails.customerFiscalCode');
            }
            if (updateData.customerPhoneNumber !== undefined) {
                logger.info(`🏷️ Aggiornamento customerPhoneNumber: ${user.customerDetails.customerPhoneNumber} -> ${updateData.customerPhoneNumber}`);
                user.customerDetails.customerPhoneNumber = updateData.customerPhoneNumber;
                user.markModified('customerDetails.customerPhoneNumber');
            }
            
            if (user.customerDetails.customerAddresses) {
                if (updateData.customerBillingAddress !== undefined) {
                    logger.info(`🏷️ Aggiornamento billingAddress: ${user.customerDetails.customerAddresses.billingAddress} -> ${updateData.customerBillingAddress}`);
                    user.customerDetails.customerAddresses.billingAddress = updateData.customerBillingAddress;
                    user.markModified('customerDetails.customerAddresses');
                }
                if (updateData.customerShippingAddress !== undefined) {
                    logger.info(`🏷️ Aggiornamento shippingAddress: ${user.customerDetails.customerAddresses.shippingAddress} -> ${updateData.customerShippingAddress}`);
                    user.customerDetails.customerAddresses.shippingAddress = updateData.customerShippingAddress;
                    user.markModified('customerDetails.customerAddresses');
                }
            }
            
            logger.info(`🔎 CustomerDetails DOPO:`, JSON.stringify(user.customerDetails, null, 2));
        }

        // Aggiorna i campi principali dell'utente
        if (updateData.username !== undefined && updateData.username.trim() !== '') user.username = updateData.username;
        if (updateData.email !== undefined && updateData.email.trim() !== '') user.email = updateData.email;
        if (updateData.password !== undefined) {
            logger.info(`🔐 Impostazione password in chiaro nel documento (sarà hashata dal pre-save): ${updateData.password}`);
            user.password = updateData.password;
        }
        
        // Aggiorna defaultRole solo per utenti NON administrator
        if (updateData.defaultRole !== undefined && updateData.defaultRole.trim() !== '' && !user.role.includes('administrator')) {
            logger.info(`🎯 Aggiornamento defaultRole: ${user.defaultRole} -> ${updateData.defaultRole}`);
            user.defaultRole = updateData.defaultRole;
        } else if (user.role.includes('administrator')) {
            if (updateData.defaultRole !== undefined) {
                logger.info(`⚠️ Tentativo di aggiornare defaultRole per administrator - IGNORATO`);
            }
            // Assicurati che gli administrator non abbiano mai un defaultRole
            if (user.defaultRole !== undefined) {
                logger.info(`🧹 Rimozione defaultRole da utente administrator`);
                user.defaultRole = undefined;
            }
        }

        logger.info(`💾 Salvataggio in corso per utente: ${user.username}...`);
        await user.save();
        logger.info(`✅ Salvataggio completato per utente: ${user.username}`);
        
        if (user.role.includes('administrator') && user.administratorDetails) {
            logger.info(`🔧 Aggiornamento administratorDetails per ID: ${user.administratorDetails._id || user.administratorDetails}`);
            logger.info(`📝 Dati administrator:`, {
                administratorName: updateData.administratorName,
                administratorPermission: updateData.administratorPermission
            });
            const updatedAdmin = await adminController.updateAdministrator(
                user.administratorDetails._id || user.administratorDetails,
                {
                    administratorName: updateData.administratorName,
                    administratorPermission: updateData.administratorPermission
                }
            );
            logger.info(`✅ Administrator aggiornato:`, updatedAdmin ? 'Successo' : 'Fallito');
        }
        
        if (user.role.includes('brewery') && user.breweryDetails) {
            logger.info(`🏭 Aggiornamento breweryDetails per ID: ${user.breweryDetails._id || user.breweryDetails}`);
            logger.info(`📝 Dati brewery:`, {
                breweryName: updateData.breweryName,
                breweryDescription: updateData.breweryDescription,
                breweryFiscalCode: updateData.breweryFiscalCode
            });
            const updatedBrewery = await adminController.updateBrewery(
                user.breweryDetails._id || user.breweryDetails,
                {
                    breweryName: updateData.breweryName,
                    breweryDescription: updateData.breweryDescription,
                    breweryFiscalCode: updateData.breweryFiscalCode
                }
            );
            logger.info(`✅ Brewery aggiornato:`, updatedBrewery ? 'Successo' : 'Fallito');
        }

        // Non chiamare adminController.updateUser perché abbiamo già salvato tutto
        req.flash('success', 'Utente aggiornato con successo');
        res.redirect('/administrator/users/update');
    } catch (error) {
        logger.error(`Errore durante l\'aggiornamento dell\'utente: ${error.message}`);
        logger.error(error.stack);
        req.flash('error', 'Errore durante l\'aggiornamento dell\'utente');
        res.redirect('/administrator/users/update');
    }
});

// Rotta POST per cancellare l'utente selezionato
router.post('/users/delete/:id', authMiddleware.isAdmin, async (req, res) => {
    try {
        const userId = req.params.id;
        const deletedUser = await adminController.deleteUser(userId);

        if (!deletedUser) {
            req.flash('error', 'Utente non trovato o già eliminato');
            return res.redirect('/administrator/users/update');
        }

        req.flash('success', 'Utente eliminato con successo');
        res.redirect('/administrator/users/update');
    } catch (error) {
        logger.error(`Errore durante la cancellazione dell'utente: ${error.message}`);
        logger.error(error.stack);
        req.flash('error', 'Errore durante la cancellazione dell\'utente');
        res.redirect('/administrator/users/update');
    }
});

// Aggiunta ruolo a utente
router.post('/users/addRole/:id', authMiddleware.isAdmin, async (req, res) => {
    try {
        const userId = req.params.id;
        const { roleToAdd } = req.body;
        await adminController.addRoleToUser(userId, roleToAdd, req, res);
    } catch (error) {
        logger.error(`Errore durante l'aggiunta ruolo: ${error.message}`);
        req.flash('error', 'Errore durante l\'aggiunta del ruolo');
        res.redirect(`/administrator/users/update?userUpdateId=${req.params.id}`);
    }
});

// Rimozione ruolo da utente
router.post('/users/removeRole/:id', authMiddleware.isAdmin, async (req, res) => {
    try {
        const userId = req.params.id;
        const { roleToRemove } = req.body;
        await adminController.removeRoleFromUser(userId, roleToRemove, req, res);
    } catch (error) {
        logger.error(`Errore durante la rimozione ruolo: ${error.message}`);
        req.flash('error', 'Errore durante la rimozione del ruolo');
        res.redirect(`/administrator/users/update?userUpdateId=${req.params.id}`);
    }
});

// 📍 Aggiornamento preferenze geolocalizzazione utente da admin
router.post('/users/update-location-consent/:id', authMiddleware.isAdmin, async (req, res) => {
    try {
        const userId = req.params.id;
        const { locationConsent } = req.body;
        
        // Converti il valore stringa dal form al tipo corretto
        let consentValue;
        if (locationConsent === 'true') {
            consentValue = true;
        } else if (locationConsent === 'false') {
            consentValue = false;
        } else {
            consentValue = null; // 'null' o altro = chiedi ogni volta
        }
        
        const User = require('../models/User');
        const user = await User.findById(userId);
        
        if (!user) {
            req.flash('error', 'Utente non trovato');
            return res.redirect(`/administrator/users/update?userUpdateId=${userId}`);
        }
        
        // Inizializza customerDetails se non esiste
        if (!user.customerDetails) {
            user.customerDetails = {};
        }
        
        // Aggiorna la preferenza
        user.customerDetails.locationConsent = {
            enabled: consentValue,
            lastUpdated: new Date(),
            updatedBy: 'admin'
        };
        
        // Marca customerDetails come modificato per Mongoose
        user.markModified('customerDetails');
        
        await user.save();
        
        logger.info(`📍 Admin ha aggiornato preferenze geolocalizzazione per utente ${user.username}`, {
            userId: userId,
            adminId: req.user._id,
            newValue: consentValue
        });
        
        req.flash('success', 'Preferenza geolocalizzazione aggiornata con successo');
        res.redirect(`/administrator/users/update?userUpdateId=${userId}`);
        
    } catch (error) {
        logger.error(`Errore durante l'aggiornamento preferenza geolocalizzazione: ${error.message}`);
        req.flash('error', 'Errore durante l\'aggiornamento della preferenza');
        res.redirect(`/administrator/users/update?userUpdateId=${req.params.id}`);
    }
});

// Visualizza collegamenti recensioni-birre (debug/admin)
// router.get('/review-beer-connections', authMiddleware.isAdmin, reviewController.viewReviewBeerConnections);

// === GESTIONE BREWERY ===
// Lista tutti i brewery
router.get('/breweries', authMiddleware.isAdmin, async (req, res) => {
    try {
        logger.info('Accesso alla gestione brewery');
        const breweries = await adminController.getAllBreweries();
        
        // Funzione helper per verificare se il logo è valido
        // Un logo è considerato "non valido" se manca, è vuoto, o contiene URL placeholder/errore
        const hasValidLogo = (brewery) => {
            if (!brewery.breweryLogo) return false;
            const logo = brewery.breweryLogo.toLowerCase();
            // Verifica URL placeholder o non validi
            const invalidPatterns = [
                'placeholder', 'default', 'no-logo', 'nologo', 
                'missing', 'blank', 'empty', 'null', 'undefined'
            ];
            return !invalidPatterns.some(pattern => logo.includes(pattern));
        };
        
        // Calcola statistiche reali dal database
        const stats = {
            totalBreweries: breweries.length,
            withEmail: breweries.filter(b => b.breweryEmail).length,
            withWebsite: breweries.filter(b => b.breweryWebsite).length,
            incompleteData: breweries.filter(b => !b.breweryEmail || !b.breweryWebsite || !b.breweryPhoneNumber).length,
            withoutLogo: breweries.filter(b => !hasValidLogo(b)).length
        };
        
        logger.info(`Statistiche birrifici calcolate: ${JSON.stringify(stats)}`);
        
        res.render('admin/breweries', { 
            title: 'Gestione Birrifici', 
            breweries,
            stats: stats,
            user: req.user,
            currentUser: req.user, // Per controlli nella tabella
            message: req.flash() 
        });
    } catch (error) {
        logger.error(`Errore durante il recupero dei brewery: ${error.message}`);
        req.flash('error', 'Errore durante il recupero dei birrifici');
        res.redirect('/administrator');
    }
});

// Mostra form per creare nuovo brewery
router.get('/breweries/new', authMiddleware.isAdmin, (req, res) => {
    logger.info('Accesso al form di creazione nuovo brewery');
    res.render('admin/createBrewery', { 
        title: 'Crea Nuovo Birrificio', 
        user: req.user,
        message: req.flash() 
    });
});

// Crea nuovo brewery
router.post('/breweries/new', authMiddleware.isAdmin, async (req, res) => {
    try {
        logger.info('Creazione di un nuovo brewery');
        await adminController.createBrewery(req.body, req, res);
    } catch (error) {
        logger.error(`Errore durante la creazione del brewery: ${error.message}`);
        req.flash('error', 'Errore durante la creazione del birrificio');
        res.render('admin/createBrewery', { 
            title: 'Crea Nuovo Birrificio', 
            message: { error: req.flash('error') }, 
            user: req.user 
        });
    }
});

// Mostra dettagli brewery per modifica
router.get('/breweries/edit/:id', authMiddleware.isAdmin, async (req, res) => {
    try {
        const breweryId = req.params.id;
        logger.info(`Accesso al form di modifica brewery: ${breweryId}`);
        
        const brewery = await adminController.getBreweryById(breweryId);
        if (!brewery) {
            req.flash('error', 'Birrificio non trovato');
            return res.redirect('/administrator/breweries');
        }
        
        // Calcola i campi mancanti per mostrare alert incompleto
        const breweryObj = brewery.toObject ? brewery.toObject() : brewery;
        const missingFields = calculateMissingFields(breweryObj);
        
        res.render('admin/editBrewery', { 
            title: 'Modifica Birrificio', 
            brewery: breweryObj,
            missingFields: missingFields,
            user: req.user,
            message: req.flash() 
        });
    } catch (error) {
        logger.error(`Errore durante il recupero del brewery per modifica: ${error.message}`);
        req.flash('error', 'Errore durante il recupero del birrificio');
        res.redirect('/administrator/breweries');
    }
});

// Aggiorna brewery
router.post('/breweries/edit/:id', authMiddleware.isAdmin, async (req, res) => {
    try {
        const breweryId = req.params.id;
        logger.info(`Aggiornamento brewery: ${breweryId}`);
        
        const updatedBrewery = await adminController.updateBrewery(breweryId, req.body);
        if (!updatedBrewery) {
            req.flash('error', 'Birrificio non trovato o non aggiornato');
            return res.redirect('/administrator/breweries');
        }
        
        req.flash('success', 'Birrificio aggiornato con successo');
        res.redirect('/administrator/breweries');
    } catch (error) {
        logger.error(`Errore durante l'aggiornamento del brewery: ${error.message}`);
        req.flash('error', 'Errore durante l\'aggiornamento del birrificio');
        res.redirect(`/administrator/breweries/edit/${req.params.id}`);
    }
});

// ========================================
// API: Ricerca GSR (Google Search Retrieval) per arricchimento dati birrificio
// Include anche scraping logo e social media dal sito ufficiale
// ========================================
router.post('/breweries/:id/gsr-search', authMiddleware.isAdmin, async (req, res) => {
    try {
        const breweryId = req.params.id;
        logger.info(`[GSR Admin] Avvio ricerca GSR per birrificio: ${breweryId}`);
        
        // Recupera il birrificio esistente
        const brewery = await Brewery.findById(breweryId);
        if (!brewery) {
            logger.warn(`[GSR Admin] Birrificio non trovato: ${breweryId}`);
            return res.status(404).json({
                success: false,
                error: 'Birrificio non trovato'
            });
        }
        
        // Import del servizio GSR
        const googleSearchRetrievalService = require('../services/googleSearchRetrievalService');
        
        // Verifica stato rate limiter
        const rateLimitStats = googleSearchRetrievalService.getRateLimitStats();
        logger.info(`[GSR Admin] Rate limiter status: ${rateLimitStats.count}/${rateLimitStats.limit} chiamate oggi`);
        
        // STEP 1: Esegui la ricerca GSR per dati generali
        logger.info(`[GSR Admin] Esecuzione ricerca GSR per: "${brewery.breweryName}"`);
        const gsrResult = await googleSearchRetrievalService.searchBreweryInfo(brewery.breweryName);
        
        if (!gsrResult || !gsrResult.success) {
            logger.warn(`[GSR Admin] Nessun risultato GSR per: ${brewery.breweryName}`);
            return res.json({
                success: false,
                error: gsrResult?.reason || 'Nessun risultato trovato dalla ricerca web',
                rateLimitStats: googleSearchRetrievalService.getRateLimitStats()
            });
        }
        
        logger.info(`[GSR Admin] ✅ Dati GSR recuperati con successo per: ${brewery.breweryName}`, {
            confidence: gsrResult.confidence,
            hasLogo: !!gsrResult.brewery?.breweryLogo,
            hasWebsite: !!gsrResult.brewery?.breweryWebsite,
            hasAddress: !!gsrResult.brewery?.breweryLegalAddress
        });
        
        // Prepara oggetto dati finale (partendo da GSR)
        const enrichedData = { ...gsrResult.brewery };
        
        // STEP 2: Scraping LOGO dal sito ufficiale (più affidabile di GSR)
        const websiteUrl = gsrResult.brewery?.breweryWebsite || brewery.breweryWebsite;
        if (websiteUrl) {
            logger.info(`[GSR Admin] 🖼️ Avvio scraping logo dal sito: ${websiteUrl}`);
            try {
                const logoFromScraping = await WebScrapingService.scrapeLogoOnly(websiteUrl);
                if (logoFromScraping) {
                    enrichedData.breweryLogo = logoFromScraping;
                    logger.info(`[GSR Admin] 🖼️ ✅ Logo recuperato via scraping: ${logoFromScraping.substring(0, 80)}`);
                    
                    // STEP 2.1: Analizza luminosità logo per determinare se è chiaro
                    try {
                        const isLight = await LogoAnalyzerService.isImageLight(logoFromScraping);
                        enrichedData.logoIsLight = isLight;
                        logger.info(`[GSR Admin] 🎨 Logo analizzato: ${isLight ? '☀️ CHIARO' : '🌙 SCURO'}`);
                    } catch (analyzeError) {
                        logger.warn(`[GSR Admin] 🎨 Errore analisi luminosità logo: ${analyzeError.message}`);
                        enrichedData.logoIsLight = null;
                    }
                } else if (!enrichedData.breweryLogo) {
                    logger.debug(`[GSR Admin] 🖼️ Nessun logo trovato via scraping`);
                }
            } catch (logoError) {
                logger.warn(`[GSR Admin] 🖼️ Errore scraping logo: ${logoError.message}`);
            }
            
            // STEP 3: Scraping SOCIAL MEDIA dal sito ufficiale (GSR spesso inventa URL)
            logger.info(`[GSR Admin] 📱 Avvio estrazione social dal sito: ${websiteUrl}`);
            try {
                // I social da GSR vengono passati solo per logging (saranno ignorati)
                const gsrSocialForLogging = gsrResult.brewery?.brewerySocialMedia || {};
                
                const validatedSocial = await SocialMediaValidationService.getValidatedSocialMedia(
                    websiteUrl,
                    gsrSocialForLogging
                );
                
                // Sostituisci completamente i social con quelli validati dal sito
                enrichedData.brewerySocialMedia = validatedSocial;
                
                const socialCount = Object.values(validatedSocial).filter(Boolean).length;
                logger.info(`[GSR Admin] 📱 ✅ Social media validati: ${socialCount} link`, {
                    facebook: validatedSocial.facebook || null,
                    instagram: validatedSocial.instagram || null,
                    youtube: validatedSocial.youtube || null,
                    twitter: validatedSocial.twitter || null,
                    linkedin: validatedSocial.linkedin || null
                });
            } catch (socialError) {
                logger.warn(`[GSR Admin] 📱 Errore estrazione social: ${socialError.message}`);
                // In caso di errore, imposta social vuoti (meglio vuoto che sbagliato)
                enrichedData.brewerySocialMedia = {};
            }
        } else {
            logger.warn(`[GSR Admin] ⚠️ Nessun website disponibile - skip scraping logo e social`);
            // Senza website, non possiamo estrarre social affidabili
            enrichedData.brewerySocialMedia = {};
        }
        
        // Restituisci i dati trovati (non salva automaticamente, lascia all'utente la scelta)
        return res.json({
            success: true,
            data: enrichedData,
            confidence: gsrResult.confidence,
            source: 'google_search_retrieval + web_scraping',
            rateLimitStats: googleSearchRetrievalService.getRateLimitStats()
        });
        
    } catch (error) {
        logger.error(`[GSR Admin] Errore durante ricerca GSR: ${error.message}`, {
            breweryId: req.params.id,
            errorStack: error.stack
        });
        return res.status(500).json({
            success: false,
            error: `Errore durante la ricerca: ${error.message}`
        });
    }
});

// Elimina brewery
router.post('/breweries/delete/:id', authMiddleware.isAdmin, async (req, res) => {
    try {
        const breweryId = req.params.id;
        logger.info(`Eliminazione brewery: ${breweryId}`);
        
        const deletedBrewery = await adminController.deleteBrewery(breweryId);
        if (!deletedBrewery) {
            req.flash('error', 'Birrificio non trovato o già eliminato');
            return res.redirect('/administrator/breweries');
        }
        
        req.flash('success', 'Birrificio eliminato con successo');
        res.redirect('/administrator/breweries');
    } catch (error) {
        logger.error(`Errore durante l'eliminazione del brewery: ${error.message}`);
        req.flash('error', 'Errore durante l\'eliminazione del birrificio');
        res.redirect('/administrator/breweries');
    }
});

// Visualizza dettagli brewery (solo lettura)
router.get('/breweries/view/:id', authMiddleware.isAdmin, async (req, res) => {
    try {
        const breweryId = req.params.id;
        logger.info(`Visualizzazione dettagli brewery: ${breweryId}`);
        
        const brewery = await adminController.getBreweryDetailsById(breweryId);
        if (!brewery) {
            req.flash('error', 'Birrificio non trovato');
            return res.redirect('/administrator/breweries');
        }
        
        // Calcola i campi mancanti per mostrare alert incompleto
        const missingFields = calculateMissingFields(brewery);
        
        res.render('admin/viewBrewery', { 
            title: 'Dettagli Birrificio', 
            brewery: brewery,
            missingFields: missingFields,
            user: req.user,
            message: req.flash() 
        });
    } catch (error) {
        logger.error(`Errore durante la visualizzazione del brewery: ${error.message}`);
        req.flash('error', 'Errore durante la visualizzazione del birrificio');
        res.redirect('/administrator/breweries');
    }
});

// Dashboard risoluzione birrifici non riconosciuti
router.get('/brewery-resolution', authMiddleware.isAdmin, reviewController.adminBreweryResolution);

// Approva/rifiuta birrificio
router.post('/brewery/:breweryId/approve', authMiddleware.isAdmin, reviewController.approveBrewery);

// === GESTIONE STATISTICHE ===
// Autocomplete birrifici per filtro
router.get('/statistics/breweries/search', authMiddleware.isAdmin, async (req, res) => {
    try {
        const query = req.query.q;
        if (!query || query.length < 3) {
            return res.json([]);
        }
        
        try {
            // Prova a usare il database MongoDB se disponibile
            const breweries = await Brewery.find({
                breweryName: { $regex: query, $options: 'i' }
            })
            .select('_id breweryName')
            .limit(10)
            .lean();
            
            // Trasforma il risultato per mantenere la compatibilità con il frontend
            const formattedBreweries = breweries.map(brewery => ({
                _id: brewery._id,
                name: brewery.breweryName
            }));
            
            logger.info(`Ricerca birrifici per query: "${query}", trovati: ${formattedBreweries.length}`);
            res.json(formattedBreweries);
            
        } catch (dbError) {
            // Se il database non è disponibile, usa dati di test
            logger.warn(`Database non disponibile, uso dati di test: ${dbError.message}`);
            
            const testBreweries = [
                { _id: '507f1f77bcf86cd799439011', name: 'Birrificio Baladin' },
                { _id: '507f1f77bcf86cd799439012', name: 'Birrificio Italiano' },
                { _id: '507f1f77bcf86cd799439013', name: 'Birra del Borgo' },
                { _id: '507f1f77bcf86cd799439014', name: 'Lambrate' },
                { _id: '507f1f77bcf86cd799439015', name: 'Toccalmatto' },
                { _id: '507f1f77bcf86cd799439016', name: 'Brewfist' },
                { _id: '507f1f77bcf86cd799439017', name: 'Mastri Birrai Umbri' }
            ];
            
            // Filtra i birrifici in base alla query
            const filteredBreweries = testBreweries.filter(brewery => 
                brewery.name.toLowerCase().includes(query.toLowerCase())
            ).slice(0, 10);
            
            logger.info(`Ricerca birrifici per query: "${query}", trovati: ${filteredBreweries.length} (dati di test)`);
            res.json(filteredBreweries);
        }
    } catch (error) {
        logger.error(`Errore durante la ricerca birrifici: ${error.message}`);
        res.status(500).json({ error: 'Errore interno del server' });
    }
});

// API per statistiche breweries con filtri
router.get('/api/breweries-stats', authMiddleware.isAdmin, async (req, res) => {
    try {
        logger.info('API richiesta statistiche breweries', { query: req.query });
        await adminController.getBreweriesStatsAPI(req, res);
    } catch (error) {
        logger.error(`Errore API statistiche breweries: ${error.message}`);
        res.status(500).json({ success: false, error: 'Errore interno del server' });
    }
});

// Dettagli statistiche singolo brewery
router.get('/statistics/brewery/:id', async (req, res, next) => {
    // Middleware custom: permetti accesso ad admin o utenti brewery per il loro birrificio
    const breweryId = req.params.id;
    
    logger.info(`🔍 Accesso statistiche brewery ${breweryId} da utente: ${req.user?.username}`);
    logger.info(`👤 Ruoli utente: ${JSON.stringify(req.user?.role)}`);
    logger.info(`🎯 ActiveRole: ${req.session?.activeRole}`);
    logger.info(`🏭 BreweryDetails: ${req.user?.breweryDetails}`);
    
    const isAdmin = req.isAuthenticated() && 
                   ((req.session.activeRole === 'administrator') ||
                    (Array.isArray(req.user.role) && req.user.role.includes('administrator')));
    
    const isOwnerBrewery = req.isAuthenticated() && 
                          req.user.role.includes('brewery') &&
                          req.user.breweryDetails &&
                          (req.user.breweryDetails._id?.toString() === breweryId || 
                           req.user.breweryDetails.toString() === breweryId);
    
    logger.info(`✅ IsAdmin: ${isAdmin}`);
    logger.info(`🏭 IsOwnerBrewery: ${isOwnerBrewery}`);
    
    if (!isAdmin && !isOwnerBrewery) {
        logger.warn(`❌ Accesso negato per utente ${req.user?.username} a brewery ${breweryId}`);
        req.flash('error', 'Accesso negato. Non hai i permessi per visualizzare queste statistiche.');
        return res.redirect('/');
    }
    
    try {
        logger.info(`Accesso statistiche brewery specifico: ${breweryId} da ${req.user.username} (admin: ${isAdmin}, owner: ${isOwnerBrewery})`);
        await adminController.getBreweryStatisticsDetail(req, res);
    } catch (error) {
        logger.error(`Errore durante il recupero statistiche brewery: ${error.message}`);
        req.flash('error', 'Errore durante il recupero delle statistiche del birrificio');
        res.redirect(isAdmin ? '/administrator/statistics' : '/profile');
    }
});

// Dashboard statistiche principali
router.get('/statistics', authMiddleware.isAdmin, async (req, res) => {
    try {
        logger.info('Accesso alle statistiche generali');
        await adminController.getStatisticsDashboard(req, res);
    } catch (error) {
        logger.error(`Errore durante il recupero delle statistiche: ${error.message}`);
        req.flash('error', 'Errore durante il recupero delle statistiche');
        res.redirect('/administrator');
    }
});

// =====================================================
// DASHBOARD MODERAZIONE RECENSIONI
// =====================================================

// Dashboard principale recensioni
router.get('/reviews', authMiddleware.isAdmin, async (req, res) => {
    try {
        logger.info('Accesso alla dashboard moderazione recensioni');
        await adminController.getReviewsDashboard(req, res);
    } catch (error) {
        logger.error(`Errore durante il caricamento dashboard recensioni: ${error.message}`);
        req.flash('error', 'Errore durante il caricamento della dashboard recensioni');
        res.redirect('/administrator');
    }
});

// API per ottenere elenco birre e birrifici (per modal modifica recensione)
// ⚠️ DEVE essere definita PRIMA di /api/reviews/:id per evitare conflitto con parametro dinamico
router.get('/api/reviews/beers-breweries', authMiddleware.isAdmin, async (req, res) => {
    try {
        await adminController.getBeersAndBreweriesList(req, res);
    } catch (error) {
        logger.error(`Errore API elenco birre/birrifici: ${error.message}`);
        res.status(500).json({ success: false, error: 'Errore interno del server' });
    }
});

// API per ottenere dettagli singola recensione
router.get('/api/reviews/:id', authMiddleware.isAdmin, async (req, res) => {
    try {
        logger.info(`API richiesta dettagli recensione: ${req.params.id}`);
        await adminController.getReviewDetails(req, res);
    } catch (error) {
        logger.error(`Errore API dettagli recensione: ${error.message}`);
        res.status(500).json({ success: false, error: 'Errore interno del server' });
    }
});

// API per toggle visibilità recensione (nascondi/mostra)
router.post('/api/reviews/:id/visibility', authMiddleware.isAdmin, async (req, res) => {
    try {
        logger.info(`API toggle visibilità recensione: ${req.params.id}`);
        await adminController.toggleReviewVisibility(req, res);
    } catch (error) {
        logger.error(`Errore API toggle visibilità: ${error.message}`);
        res.status(500).json({ success: false, error: 'Errore interno del server' });
    }
});

// API per cambiare stato recensione
router.post('/api/reviews/:id/status', authMiddleware.isAdmin, async (req, res) => {
    try {
        logger.info(`API cambio stato recensione: ${req.params.id}`);
        await adminController.updateReviewStatus(req, res);
    } catch (error) {
        logger.error(`Errore API cambio stato: ${error.message}`);
        res.status(500).json({ success: false, error: 'Errore interno del server' });
    }
});

// API per eliminare recensione
router.delete('/api/reviews/:id', authMiddleware.isAdmin, async (req, res) => {
    try {
        logger.info(`API eliminazione recensione: ${req.params.id}`);
        await adminController.deleteReview(req, res);
    } catch (error) {
        logger.error(`Errore API eliminazione recensione: ${error.message}`);
        res.status(500).json({ success: false, error: 'Errore interno del server' });
    }
});

// API per modificare i dati di una recensione (testi, birra, birrificio - NO rating)
router.put('/api/reviews/:id/edit', authMiddleware.isAdmin, async (req, res) => {
    try {
        logger.info(`API modifica recensione: ${req.params.id}`);
        await adminController.editReview(req, res);
    } catch (error) {
        logger.error(`Errore API modifica recensione: ${error.message}`);
        res.status(500).json({ success: false, error: 'Errore interno del server' });
    }
});

// API per bannare utente
router.post('/api/users/:id/ban', authMiddleware.isAdmin, async (req, res) => {
    try {
        logger.info(`API ban utente: ${req.params.id}`);
        await adminController.banUser(req, res);
    } catch (error) {
        logger.error(`Errore API ban utente: ${error.message}`);
        res.status(500).json({ success: false, error: 'Errore interno del server' });
    }
});

// API per sbannare utente
router.post('/api/users/:id/unban', authMiddleware.isAdmin, async (req, res) => {
    try {
        logger.info(`API unban utente: ${req.params.id}`);
        await adminController.unbanUser(req, res);
    } catch (error) {
        logger.error(`Errore API unban utente: ${error.message}`);
        res.status(500).json({ success: false, error: 'Errore interno del server' });
    }
});

// =====================================================
// GESTIONE BIRRE ADMIN - Beer Management
// =====================================================

// Lista tutte le birre
router.get('/beers', authMiddleware.isAdmin, async (req, res) => {
    try {
        logger.info('Accesso alla gestione birre');
        const beers = await adminController.getAllBeers();
        
        // Calcola statistiche per il template
        const stats = {
            totalBeers: beers.length,
            withStyle: beers.filter(b => b.beerType).length,
            withAbv: beers.filter(b => b.alcoholContent).length,
            incompleteData: beers.filter(b => !b.beerType || !b.alcoholContent || !b.description).length,
            aiExtracted: beers.filter(b => b.aiExtracted).length
        };
        
        logger.info(`Statistiche birre calcolate: ${JSON.stringify(stats)}`);
        
        res.render('admin/beers', { 
            title: 'Gestione Birre', 
            beers,
            stats,
            user: req.user,
            message: req.flash() 
        });
    } catch (error) {
        logger.error(`Errore durante il recupero delle birre: ${error.message}`);
        req.flash('error', 'Errore durante il recupero delle birre');
        res.redirect('/administrator');
    }
});

// Visualizza dettagli birra (solo lettura)
router.get('/beers/view/:id', authMiddleware.isAdmin, async (req, res) => {
    try {
        const beerId = req.params.id;
        logger.info(`Visualizzazione dettagli birra: ${beerId}`);
        
        const beer = await adminController.getBeerDetailsById(beerId);
        if (!beer) {
            req.flash('error', 'Birra non trovata');
            return res.redirect('/administrator/beers');
        }
        
        res.render('admin/viewBeer', { 
            title: 'Dettagli Birra', 
            beer,
            user: req.user,
            message: req.flash() 
        });
    } catch (error) {
        logger.error(`Errore durante la visualizzazione della birra: ${error.message}`);
        req.flash('error', 'Errore durante il recupero della birra');
        res.redirect('/administrator/beers');
    }
});

// Form modifica birra
router.get('/beers/edit/:id', authMiddleware.isAdmin, async (req, res) => {
    try {
        const beerId = req.params.id;
        logger.info(`Accesso al form di modifica birra: ${beerId}`);
        
        const beer = await adminController.getBeerDetailsById(beerId);
        if (!beer) {
            req.flash('error', 'Birra non trovata');
            return res.redirect('/administrator/beers');
        }
        
        // Calcola campi mancanti per alert dati incompleti
        const missingFields = calculateBeerMissingFields(beer);
        
        res.render('admin/editBeer', { 
            title: 'Modifica Birra', 
            beer,
            missingFields,
            user: req.user,
            message: req.flash() 
        });
    } catch (error) {
        logger.error(`Errore durante il recupero della birra per modifica: ${error.message}`);
        req.flash('error', 'Errore durante il recupero della birra');
        res.redirect('/administrator/beers');
    }
});

// Salva modifiche birra
router.post('/beers/edit/:id', authMiddleware.isAdmin, async (req, res) => {
    try {
        const beerId = req.params.id;
        logger.info(`Aggiornamento birra: ${beerId}`);
        
        const updatedBeer = await adminController.updateBeer(beerId, req.body);
        if (!updatedBeer) {
            req.flash('error', 'Birra non trovata o non aggiornata');
            return res.redirect('/administrator/beers');
        }
        
        req.flash('success', 'Birra aggiornata con successo');
        res.redirect('/administrator/beers');
    } catch (error) {
        logger.error(`Errore durante l'aggiornamento della birra: ${error.message}`);
        req.flash('error', 'Errore durante l\'aggiornamento della birra');
        res.redirect(`/administrator/beers/edit/${req.params.id}`);
    }
});

// Elimina birra
router.post('/beers/delete/:id', authMiddleware.isAdmin, async (req, res) => {
    try {
        const beerId = req.params.id;
        logger.info(`Eliminazione birra: ${beerId}`);
        
        const deletedBeer = await adminController.deleteBeer(beerId);
        if (!deletedBeer) {
            req.flash('error', 'Birra non trovata o già eliminata');
            return res.redirect('/administrator/beers');
        }
        
        req.flash('success', 'Birra eliminata con successo');
        res.redirect('/administrator/beers');
    } catch (error) {
        logger.error(`Errore durante l'eliminazione della birra: ${error.message}`);
        req.flash('error', 'Errore durante l\'eliminazione della birra');
        res.redirect('/administrator/beers');
    }
});

// ========================================
// API: Ricerca GSR (Google Search Retrieval) per arricchimento dati birra
// Usa searchBeerInfo per cercare informazioni sulla birra via Google
// ========================================
router.post('/beers/:id/gsr-search', authMiddleware.isAdmin, async (req, res) => {
    try {
        const beerId = req.params.id;
        logger.info(`[GSR Beer Admin] Avvio ricerca GSR per birra: ${beerId}`);
        
        // Recupera la birra esistente con il birrificio
        const Beer = require('../models/Beer');
        const beer = await Beer.findById(beerId).populate('brewery', 'breweryName');
        if (!beer) {
            logger.warn(`[GSR Beer Admin] Birra non trovata: ${beerId}`);
            return res.status(404).json({
                success: false,
                error: 'Birra non trovata'
            });
        }
        
        // Import del servizio GSR
        const googleSearchRetrievalService = require('../services/googleSearchRetrievalService');
        
        // Verifica stato rate limiter
        const rateLimitStats = googleSearchRetrievalService.getRateLimitStats();
        logger.info(`[GSR Beer Admin] Rate limiter status: ${rateLimitStats.count}/${rateLimitStats.limit} chiamate oggi`);
        
        // Esegui la ricerca GSR per la birra
        const breweryName = beer.brewery ? beer.brewery.breweryName : null;
        logger.info(`[GSR Beer Admin] Esecuzione ricerca GSR per: "${beer.beerName}" (birrificio: ${breweryName || 'sconosciuto'})`);
        
        const gsrResult = await googleSearchRetrievalService.searchBeerInfo(beer.beerName, breweryName);
        
        if (!gsrResult || !gsrResult.success) {
            logger.warn(`[GSR Beer Admin] Nessun risultato GSR per: ${beer.beerName}`);
            return res.json({
                success: false,
                error: 'Nessun risultato trovato dalla ricerca web per questa birra',
                rateLimitStats: googleSearchRetrievalService.getRateLimitStats()
            });
        }
        
        logger.info(`[GSR Beer Admin] ✅ Dati GSR recuperati per: ${beer.beerName}`, {
            confidence: gsrResult.confidence,
            beerType: gsrResult.beer?.beerType,
            abv: gsrResult.beer?.alcoholContent
        });
        
        // Mappa i campi GSR ai campi del form
        const enrichedData = {};
        const beerData = gsrResult.beer;
        
        if (beerData) {
            if (beerData.beerName) enrichedData.beerName = beerData.beerName;
            if (beerData.beerType) enrichedData.beerType = beerData.beerType;
            if (beerData.beerSubType) enrichedData.beerSubStyle = beerData.beerSubType;
            if (beerData.alcoholContent !== null && beerData.alcoholContent !== undefined) enrichedData.alcoholContent = String(beerData.alcoholContent);
            if (beerData.ibu !== null && beerData.ibu !== undefined) enrichedData.ibu = String(beerData.ibu);
            if (beerData.volume) enrichedData.volume = beerData.volume;
            if (beerData.description) enrichedData.description = beerData.description;
            if (beerData.servingTemperature) enrichedData.servingTemperature = beerData.servingTemperature;
            
            // Ingredienti (array → stringa)
            if (beerData.ingredients && Array.isArray(beerData.ingredients) && beerData.ingredients.length > 0) {
                enrichedData.ingredients = beerData.ingredients.join(', ');
            }
            
            // Note degustazione (oggetto con sotto-campi)
            if (beerData.tastingNotes) {
                if (beerData.tastingNotes.aroma) enrichedData.aroma = beerData.tastingNotes.aroma;
                if (beerData.tastingNotes.appearance) enrichedData.appearance = beerData.tastingNotes.appearance;
                if (beerData.tastingNotes.taste) enrichedData.tastingNotes = beerData.tastingNotes.taste;
                // Mouthfeel dalle note degustazione se disponibile
                if (beerData.tastingNotes.mouthfeel) enrichedData.mouthfeel = beerData.tastingNotes.mouthfeel;
            }
            
            // Abbinamenti (array)
            if (beerData.pairings && Array.isArray(beerData.pairings) && beerData.pairings.length > 0) {
                enrichedData.pairing = beerData.pairings;
            }
        }
        
        return res.json({
            success: true,
            data: enrichedData,
            confidence: gsrResult.confidence,
            source: 'google_search_retrieval',
            rateLimitStats: googleSearchRetrievalService.getRateLimitStats()
        });
        
    } catch (error) {
        logger.error(`[GSR Beer Admin] Errore durante ricerca GSR: ${error.message}`, {
            beerId: req.params.id,
            errorStack: error.stack
        });
        return res.status(500).json({
            success: false,
            error: `Errore durante la ricerca: ${error.message}`
        });
    }
});

// =====================================================
// SISTEMA DI TEST MATCHING BIRRIFICI AI
// =====================================================

// Pagina di test per il matching dei birrifici
router.get('/brewery-matching-test', authMiddleware.isAdmin, async (req, res) => {
    try {
        logger.info('Accesso alla pagina di test matching birrifici');
        await adminController.getBreweryMatchingTest(req, res);
    } catch (error) {
        logger.error(`Errore durante l'accesso alla pagina di test matching: ${error.message}`);
        req.flash('error', 'Errore durante il caricamento della pagina di test');
        res.redirect('/administrator');
    }
});

// API per testare il matching di un birrificio
router.post('/api/test-brewery-matching', authMiddleware.isAdmin, async (req, res) => {
    try {
        logger.info('Test matching birrificio tramite API');
        await adminController.testBreweryMatching(req, res);
    } catch (error) {
        logger.error(`Errore durante il test matching API: ${error.message}`);
        res.status(500).json({
            success: false,
            error: 'Errore interno durante il test di matching'
        });
    }
});

module.exports = router;