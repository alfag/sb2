const express = require('express');
const router = express.Router();
const adminController = require('../controllers/administratorController');
const authMiddleware = require('../middlewares/authMiddleware');
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
        logger.info(`Utente selezionato per modifica: ${user}`); // Log in italiano
        res.render('admin/updateUser', { title: 'Modifica Utente', userToEdit: user, users: null, user: req.user, message: req.flash() });
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

module.exports = router;