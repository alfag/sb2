const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const authMiddleware = require('../middlewares/authMiddleware');
const logWithFileName = require('../utils/logger'); // Importa logWithFileName

const logger = logWithFileName(__filename); // Crea un logger con il nome del file

// Rotta per la dashboard amministrativa
router.get('/', authMiddleware.isAdmin, (req, res) => {
    logger.info('Accesso alla dashboard amministrativa'); // Log in italiano
    res.render('admin/index', { title: 'Dashboard Amministrativa', user: req.user });
});

// Ottieni tutti gli utenti
router.get('/users', authMiddleware.isAdmin, (req, res, next) => {
    logger.info('Recupero di tutti gli utenti'); // Log in italiano
    next();
}, adminController.getAllUsers);

// Ottieni un singolo utente tramite ID
router.get('/users/:id', authMiddleware.isAdmin, (req, res, next) => {
    logger.info(`Recupero dell'utente con ID: ${req.params.id}`); // Log in italiano
    next();
}, adminController.getUserById);

// Aggiorna un utente
router.put('/users/:id', authMiddleware.isAdmin, (req, res, next) => {
    logger.info(`Aggiornamento dell'utente con ID: ${req.params.id}`); // Log in italiano
    next();
}, adminController.updateUser);

// Elimina un utente
router.delete('/users/:id', authMiddleware.isAdmin, (req, res, next) => {
    logger.info(`Eliminazione dell'utente con ID: ${req.params.id}`); // Log in italiano
    next();
}, adminController.deleteUser);

// Ottieni tutti i birrifici
router.get('/breweries', authMiddleware.isAdmin, (req, res, next) => {
    logger.info('Recupero di tutti i birrifici'); // Log in italiano
    next();
}, adminController.getAllBreweries);

// Ottieni un singolo birrificio tramite ID
router.get('/breweries/:id', authMiddleware.isAdmin, (req, res, next) => {
    logger.info(`Recupero del birrificio con ID: ${req.params.id}`); // Log in italiano
    next();
}, adminController.getBreweryById);

// Aggiorna un birrificio
router.put('/breweries/:id', authMiddleware.isAdmin, (req, res, next) => {
    logger.info(`Aggiornamento del birrificio con ID: ${req.params.id}`); // Log in italiano
    next();
}, adminController.updateBrewery);

// Elimina un birrificio
router.delete('/breweries/:id', authMiddleware.isAdmin, (req, res, next) => {
    logger.info(`Eliminazione del birrificio con ID: ${req.params.id}`); // Log in italiano
    next();
}, adminController.deleteBrewery);

// Ottieni tutti gli ordini
router.get('/orders', authMiddleware.isAdmin, (req, res, next) => {
    logger.info('Recupero di tutti gli ordini'); // Log in italiano
    next();
}, adminController.getAllOrders);

// Ottieni un singolo ordine tramite ID
router.get('/orders/:id', authMiddleware.isAdmin, (req, res, next) => {
    logger.info(`Recupero dell'ordine con ID: ${req.params.id}`); // Log in italiano
    next();
}, adminController.getOrderById);

// Aggiorna un ordine
router.put('/orders/:id', authMiddleware.isAdmin, (req, res, next) => {
    logger.info(`Aggiornamento dell'ordine con ID: ${req.params.id}`); // Log in italiano
    next();
}, adminController.updateOrder);

// Elimina un ordine
router.delete('/orders/:id', authMiddleware.isAdmin, (req, res, next) => {
    logger.info(`Eliminazione dell'ordine con ID: ${req.params.id}`); // Log in italiano
    next();
}, adminController.deleteOrder);

// Ottieni tutti i pagamenti
router.get('/payments', authMiddleware.isAdmin, (req, res, next) => {
    logger.info('Recupero di tutti i pagamenti'); // Log in italiano
    next();
}, adminController.getAllPayments);

// Ottieni un singolo pagamento tramite ID
router.get('/payments/:id', authMiddleware.isAdmin, (req, res, next) => {
    logger.info(`Recupero del pagamento con ID: ${req.params.id}`); // Log in italiano
    next();
}, adminController.getPaymentById);

// Aggiorna un pagamento
router.put('/payments/:id', authMiddleware.isAdmin, (req, res, next) => {
    logger.info(`Aggiornamento del pagamento con ID: ${req.params.id}`); // Log in italiano
    next();
}, adminController.updatePayment);

// Elimina un pagamento
router.delete('/payments/:id', authMiddleware.isAdmin, (req, res, next) => {
    logger.info(`Eliminazione del pagamento con ID: ${req.params.id}`); // Log in italiano
    next();
}, adminController.deletePayment);

// Ottieni tutte le inviti
router.get('/invitations', authMiddleware.isAdmin, (req, res, next) => {
    logger.info('Recupero di tutti gli inviti'); // Log in italiano
    next();
}, adminController.getAllInvitations);

// Ottieni un singolo invito tramite ID
router.get('/invitations/:id', authMiddleware.isAdmin, (req, res, next) => {
    logger.info(`Recupero dell'invito con ID: ${req.params.id}`); // Log in italiano
    next();
}, adminController.getInvitationById);

// Aggiorna un invito
router.put('/invitations/:id', authMiddleware.isAdmin, (req, res, next) => {
    logger.info(`Aggiornamento dell'invito con ID: ${req.params.id}`); // Log in italiano
    next();
}, adminController.updateInvitation);

// Elimina un invito
router.delete('/invitations/:id', authMiddleware.isAdmin, (req, res, next) => {
    logger.info(`Eliminazione dell'invito con ID: ${req.params.id}`); // Log in italiano
    next();
}, adminController.deleteInvitation);

// Configurazione generale
router.get('/config', authMiddleware.isAdmin, (req, res, next) => {
    logger.info('Recupero delle configurazioni amministrative'); // Log in italiano
    next();
}, adminController.getAdminConfigurations);

router.put('/config/:id', authMiddleware.isAdmin, (req, res, next) => {
    logger.info(`Aggiornamento della configurazione amministrativa con ID: ${req.params.id}`); // Log in italiano
    next();
}, adminController.updateAdminConfigurations);

router.delete('/config/:id', authMiddleware.isAdmin, (req, res, next) => {
    logger.info(`Eliminazione della configurazione amministrativa con ID: ${req.params.id}`); // Log in italiano
    next();
}, adminController.deleteAdminConfigurations);

module.exports = router;