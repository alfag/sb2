const express = require('express');
const router = express.Router();
const validationController = require('../controllers/validationController');
const { isAuthenticated, isAdmin } = require('../middlewares/authMiddleware');

/**
 * 🛡️ VALIDATION ROUTES - Rotte per gestione validazione entità
 * 
 * Tutte le rotte sono protette e accessibili solo agli administrator
 */

// Middleware: solo administrator
router.use(isAuthenticated, isAdmin);

/**
 * GET /administrator/validation/counts
 * Conteggio entità in attesa di validazione
 */
router.get('/counts', validationController.getPendingCount);

/**
 * GET /administrator/validation/breweries
 * Lista birrifici da validare
 */
router.get('/breweries', validationController.getPendingBreweries);

/**
 * GET /administrator/validation/beers
 * Lista birre da validare
 */
router.get('/beers', validationController.getPendingBeers);

/**
 * POST /administrator/validation/brewery/:breweryId/approve
 * Approva un birrificio (con eventuali modifiche)
 */
router.post('/brewery/:breweryId/approve', validationController.approveBrewery);

/**
 * POST /administrator/validation/brewery/:breweryId/reject
 * Rifiuta ed elimina un birrificio
 */
router.post('/brewery/:breweryId/reject', validationController.rejectBrewery);

/**
 * POST /administrator/validation/beer/:beerId/approve
 * Approva una birra (con eventuali modifiche)
 */
router.post('/beer/:beerId/approve', validationController.approveBeer);

/**
 * POST /administrator/validation/beer/:beerId/reject
 * Rifiuta ed elimina una birra
 */
router.post('/beer/:beerId/reject', validationController.rejectBeer);

module.exports = router;
