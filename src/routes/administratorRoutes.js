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
    res.render('admin/createUser', { title: 'Crea Nuovo Utente' });
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

        // Chiama il controller per creare un nuovo utente
        await adminController.createUser({ 
            username, password, role, 
            customerName, customerSurname, customerFiscalCode, customerBillingAddress, customerShippingAddress, customerPhoneNumber,
            administratorName, administratorPermission,
            breweryName, breweryDescription, breweryFiscalCode
        }, req, res);

        req.flash('success', 'Utente creato con successo');
        res.redirect('/administrator/users');
    } catch (error) {
        logger.error(`Errore durante la creazione di un nuovo utente: ${error.message}`);
        req.flash('error', 'Errore durante la creazione del nuovo utente');
        res.redirect('/');
    }
});

// Ottieni un singolo utente tramite ID
router.get('/users/:id', authMiddleware.isAdmin, adminController.getUserById);

// Aggiorna un utente
router.put('/users/:id', authMiddleware.isAdmin, adminController.updateUser);

// Elimina un utente
router.delete('/users/:id', authMiddleware.isAdmin, adminController.deleteUser);

module.exports = router;