const express = require('express');
const router = express.Router();
const adminController = require('../controllers/administratorController');
const reviewController = require('../controllers/reviewController');
const authMiddleware = require('../middlewares/authMiddleware');
const Brewery = require('../models/Brewery');
const logWithFileName = require('../utils/logger'); // Importa logWithFileName

const logger = logWithFileName(__filename); // Crea un logger con il nome del file

// Rotta per la dashboard amministrativa
router.get('/', authMiddleware.isAdmin, (req, res) => {
    logger.info('Accesso alla dashboard amministrativa'); // Log in italiano
    res.render('admin/index', { title: 'Dashboard Amministrativa', user: req.user });
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
        
        res.render('admin/editBrewery', { 
            title: 'Modifica Birrificio', 
            brewery: brewery.toObject ? brewery.toObject() : brewery,
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
        
        res.render('admin/viewBrewery', { 
            title: 'Dettagli Birrificio', 
            brewery: brewery,
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