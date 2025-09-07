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

// Ottieni tutti gli utenti e renderizza la vista
router.get('/users', authMiddleware.isAdmin, async (req, res) => {
    try {
        logger.info('Recupero di tutti gli utenti'); // Log in italiano

        // Recupera tutti gli utenti dal controller
        const users = await adminController.getAllUsers(req, res);
        logger.info(`Utenti recuperati: ${JSON.stringify(users)}`); // Log in italiano

        // Renderizza la vista con i dati degli utenti
        res.render('admin/users', { title: 'Gestione Utenti', users });
    } catch (error) {
        logger.error(`Errore durante il recupero degli utenti: ${error.message}`);
        req.flash('error', 'Errore durante il recupero degli utenti');
        res.redirect('/admin');
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

        if (!userId) {
            logger.info('Accesso a updateUser senza utente selezionato');
            return res.render('admin/updateUser', { title: 'Modifica Utente', users, userToEdit: null, user: req.user, message: req.flash() });
        }
        logger.info(`Accesso al form di modifica per utente con ID: ${userId}`);
        const user = await adminController.getUserById(userId);
        
        if (!user) {
            req.flash('error', 'Utente non trovato');
            return res.render('admin/updateUser', { title: 'Modifica Utente', users, userToEdit: null, user: req.user, message: req.flash() });
        }
        
        logger.info(`Utente selezionato per modifica: username=${user.username}`); 
        res.render('admin/updateUser', {
            title: 'Modifica Utente',
            userToEdit: user ? (typeof user.toObject === 'function' ? user.toObject() : user) : null,
            users: null,
            user: req.user,
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

        // Se la password è presente e non vuota, aggiorna la password con hash
        if (updateData.password && updateData.password.trim() !== '') {
            const bcrypt = require('bcrypt');
            updateData.password = await bcrypt.hash(updateData.password, 10);
        } else {
            // Se la password è vuota, non aggiornarla
            delete updateData.password;
        }

        // Recupera l'utente completo con dettagli popolati
        const user = await adminController.getUserById(userId);
        if (!user) {
            req.flash('error', 'Utente non trovato');
            return res.redirect('/administrator/users/update');
        }

        // Aggiorna i dettagli in base al ruolo
        if (user.role === 'customer') {
            // Aggiorna i dettagli customer direttamente nell'oggetto user
            user.customerDetails.customerName = updateData.customerName;
            user.customerDetails.customerSurname = updateData.customerSurname;
            user.customerDetails.customerFiscalCode = updateData.customerFiscalCode;
            if (user.customerDetails.customerAddresses) {
                user.customerDetails.customerAddresses.billingAddress = updateData.customerBillingAddress;
                user.customerDetails.customerAddresses.shippingAddress = updateData.customerShippingAddress;
            }
            user.customerDetails.customerPhoneNumber = updateData.customerPhoneNumber;
        logger.info(`Aggiornamento dettagli customer per utente: ${JSON.stringify(user)}`);
            await user.save();
        } else if (user.role === 'administrator' && user.administratorDetails) {
            await adminController.updateAdministrator(
                user.administratorDetails._id || user.administratorDetails,
                {
                    administratorName: updateData.administratorName,
                    administratorPermission: updateData.administratorPermission
                }
            );
        } else if (user.role === 'brewery' && user.breweryDetails) {
            await adminController.updateBrewery(
                user.breweryDetails._id || user.breweryDetails,
                {
                    breweryName: updateData.breweryName,
                    breweryDescription: updateData.breweryDescription,
                    breweryFiscalCode: updateData.breweryFiscalCode
                }
            );
        }

        // Aggiorna i dati principali dell'utente
        const updatedUser = await adminController.updateUser(userId, updateData);

        if (!updatedUser) {
            req.flash('error', 'Utente non trovato o non aggiornato');
            return res.redirect('/administrator/users/update');
        }

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

// Visualizza collegamenti recensioni-birre (debug/admin)
// router.get('/review-beer-connections', authMiddleware.isAdmin, reviewController.viewReviewBeerConnections);

// === GESTIONE BREWERY ===
// Lista tutti i brewery
router.get('/breweries', authMiddleware.isAdmin, async (req, res) => {
    try {
        logger.info('Accesso alla gestione brewery');
        const breweries = await adminController.getAllBreweries();
        res.render('admin/breweries', { 
            title: 'Gestione Birrifici', 
            breweries, 
            user: req.user,
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
router.get('/statistics/brewery/:id', authMiddleware.isAdmin, async (req, res) => {
    try {
        const breweryId = req.params.id;
        logger.info(`Accesso statistiche brewery specifico: ${breweryId}`);
        await adminController.getBreweryStatisticsDetail(req, res);
    } catch (error) {
        logger.error(`Errore durante il recupero statistiche brewery: ${error.message}`);
        req.flash('error', 'Errore durante il recupero delle statistiche del birrificio');
        res.redirect('/administrator/statistics');
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

module.exports = router;