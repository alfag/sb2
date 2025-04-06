const express = require('express');
const reviewController = require('../controllers/reviewController');
const authMiddleware = require('../middlewares/authMiddleware');
const logWithFileName = require('../utils/logger'); // Importa logWithFileName

const logger = logWithFileName(__filename); // Crea un logger con il nome del file

const router = express.Router();

// Crea una recensione
router.post('/', (req, res, next) => {
    logger.info('Creazione di una nuova recensione'); // Log tradotto
    next();
}, reviewController.createReview);

// Ottieni recensioni per un BeerBox specifico
router.get('/:beerboxId', (req, res, next) => {
    logger.info(`Recupero delle recensioni per il BeerBox ${req.params.beerboxId}`); // Log tradotto
    next();
}, reviewController.getReviewsByBeerBox);

// Elimina una recensione (solo admin)
router.delete('/:id', authMiddleware.isAdmin, (req, res, next) => {
    logger.info(`Eliminazione della recensione ${req.params.id}`); // Log tradotto
    next();
}, reviewController.deleteReview);

module.exports = router;