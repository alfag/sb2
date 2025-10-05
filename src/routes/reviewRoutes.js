const express = require('express');
const router = express.Router();
const reviewController = require('../controllers/reviewController');
const { isAuthenticated, ensureRole } = require('../middlewares/authMiddleware');
const { aiImageUpload } = require('../middlewares/uploadMiddleware');
const { moderateReviewContent, logContentViolations, sanitizeContent } = require('../middlewares/contentModerationMiddleware');


// La pagina delle recensioni è integrata nella welcome page
// Questa rotta reindirizza alla home
router.get('/', (req, res) => {
    res.redirect('/');
});

// Rotta pubblica per validazione AI (primo check) - supporta sia utenti autenticati che guest
router.post('/api/gemini/firstcheck', aiImageUpload, reviewController.firstCheckAI);

// Gestione dati AI in sessione (mantenute per il flusso principale)
router.get('/ai-session-data', reviewController.getAiDataFromSession);
router.delete('/ai-session-data', reviewController.clearAiDataFromSession);
router.post('/clear-session-data', reviewController.clearAiDataFromSession); // Per sendBeacon

// Rotte per recensioni multiple (mantenute per il flusso principale)
router.post('/create-multiple', 
  logContentViolations,
  moderateReviewContent, 
  reviewController.createMultipleReviews
);

// Endpoint per risoluzione ambiguità birrifici
router.post('/resolve-disambiguation', reviewController.resolveDisambiguation);

// Rotte admin
router.post('/batch-validate', ensureRole(['administrator']), reviewController.batchValidateReviews);
router.get('/incomplete-breweries', ensureRole(['administrator']), reviewController.incompleteBreweries);

module.exports = router;
