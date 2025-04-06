const express = require('express');
const breweryController = require('../controllers/breweryController');
const { authMiddleware } = require('../middlewares/authMiddleware');
const logWithFileName = require('../utils/logger'); // Importa logWithFileName

const logger = logWithFileName(__filename); // Crea un logger con il nome del file

const router = express.Router();

// Register a new brewery
router.post('/register', authMiddleware, (req, res, next) => {
    logger.info('Registrazione di un nuovo birrificio');
    next();
}, breweryController.registerBrewery);

// Get brewery details by ID
router.get('/:id', (req, res, next) => {
    logger.info(`Recupero dettagli per il birrificio ${req.params.id}`);
    next();
}, breweryController.getBreweryById);

// Get all breweries
router.get('/', (req, res, next) => {
    logger.info('Recupero di tutti i birrifici');
    next();
}, breweryController.getAllBreweries);

// Get beerbox catalog for a specific brewery
router.get('/:id/beerbox', (req, res, next) => {
    logger.info(`Recupero catalogo BeerBox per il birrificio ${req.params.id}`);
    next();
}, breweryController.getBeerBoxCatalog);

// Get storage information for a specific brewery
router.get('/:id/storage', (req, res, next) => {
    logger.info(`Recupero informazioni di magazzino per il birrificio ${req.params.id}`);
    next();
}, breweryController.getStorageInfo);

// Store a BeerBox at another brewery
router.post('/:id/store', authMiddleware, (req, res, next) => {
    logger.info(`Archiviazione di BeerBox nel birrificio ${req.params.id}`);
    next();
}, breweryController.storeBeerBox);

// Get distributed BeerBox for a specific brewery
router.get('/:id/distributed', (req, res, next) => {
    logger.info(`Recupero BeerBox distribuiti per il birrificio ${req.params.id}`);
    next();
}, breweryController.getDistributedBeerBox);

// Get low stock notifications for BeerBox
router.get('/:id/low-stock', (req, res, next) => {
    logger.info(`Recupero notifiche di scorte basse per il birrificio ${req.params.id}`);
    next();
}, breweryController.getLowStockNotifications);

module.exports = router;