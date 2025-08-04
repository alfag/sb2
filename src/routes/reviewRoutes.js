const express = require('express');
const router = express.Router();
const reviewController = require('../controllers/reviewController');
const { ensureAuthenticated, ensureRole } = require('../middlewares/authMiddleware');


// Rotta pubblica per validazione AI (primo check)
router.post('/api/gemini/firstcheck', reviewController.firstCheckAI);

// Rotte pubbliche
router.post('/create', ensureRole(['Customer']), reviewController.createReview);

// Rotte admin
router.post('/batch-validate', ensureRole(['Administrator']), reviewController.batchValidateReviews);
router.get('/incomplete-breweries', ensureRole(['Administrator']), reviewController.incompleteBreweries);

module.exports = router;
