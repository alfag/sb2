const express = require('express');
const router = express.Router();
const reviewController = require('../controllers/reviewController');
const { ensureAuthenticated, ensureRole } = require('../middlewares/authMiddleware');


// Rotta pubblica per validazione AI (primo check)
router.post('/api/gemini/firstcheck', reviewController.firstCheckAI);

// Rotte pubbliche (temporaneamente senza autenticazione per test)
router.post('/create', reviewController.createReview);
router.post('/create-multiple', reviewController.createMultipleReviews);

// Gestione dati AI in sessione
router.get('/ai-session-data', reviewController.getAiDataFromSession);
router.delete('/ai-session-data', reviewController.clearAiDataFromSession);

module.exports = router;

// Rotte admin
router.post('/batch-validate', ensureRole(['administrator']), reviewController.batchValidateReviews);
router.get('/incomplete-breweries', ensureRole(['administrator']), reviewController.incompleteBreweries);

module.exports = router;
