const express = require('express');
const router = express.Router();
const reviewController = require('../controllers/reviewController');
const { ensureAuthenticated, ensureRole } = require('../middlewares/authMiddleware');
const { aiImageUpload } = require('../middlewares/uploadMiddleware');
const { moderateReviewContent, logContentViolations, sanitizeContent } = require('../middlewares/contentModerationMiddleware');


// Rotta pubblica per validazione AI (primo check)
router.post('/api/gemini/firstcheck', aiImageUpload, reviewController.firstCheckAI);

// Rotte pubbliche (temporaneamente senza autenticazione per test)
// Applica sanificazione e logging delle violazioni
router.post('/create', sanitizeContent(['notes']), reviewController.createReview);
router.post('/create-multiple', 
  logContentViolations,
  moderateReviewContent, 
  reviewController.createMultipleReviews
);

// Gestione dati AI in sessione
router.get('/ai-session-data', reviewController.getAiDataFromSession);
router.delete('/ai-session-data', reviewController.clearAiDataFromSession);
router.post('/clear-session-data', reviewController.clearAiDataFromSession); // Per sendBeacon

// Rotte admin
router.post('/batch-validate', ensureRole(['administrator']), reviewController.batchValidateReviews);
router.get('/incomplete-breweries', ensureRole(['administrator']), reviewController.incompleteBreweries);

module.exports = router;
