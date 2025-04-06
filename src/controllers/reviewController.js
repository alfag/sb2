const Review = require('../models/Review');
const logWithFileName = require('../utils/logger'); // Importa logWithFileName

const logger = logWithFileName(__filename); // Crea un logger con il nome del file

// Create a new review
async function createReview(req, res) {
    try {
        const { beerBoxId, userId, rating, comment } = req.body;
        const newReview = new Review({ beerBoxId, userId, rating, comment });
        await newReview.save();
        logger.info(`Recensione creata con successo: ${newReview._id}`); // Logga il successo della creazione
        res.status(201).json({ message: 'Recensione creata con successo', review: newReview });
    } catch (error) {
        logger.error(`Errore durante la creazione della recensione: ${error.message}`); // Logga l'errore
        res.status(500).json({ message: 'Errore durante la creazione della recensione', error: error.message });
    }
}

// Get reviews for a specific BeerBox
async function getReviewsByBeerBox(req, res) {
    try {
        const { beerBoxId } = req.params;
        const reviews = await Review.find({ beerBoxId });
        logger.info(`Recensioni recuperate con successo per il BeerBox: ${beerBoxId}`); // Logga il successo del recupero
        res.status(200).json(reviews);
    } catch (error) {
        logger.error(`Errore durante il recupero delle recensioni: ${error.message}`); // Logga l'errore
        res.status(500).json({ message: 'Errore durante il recupero delle recensioni', error: error.message });
    }
}

// Delete a review
async function deleteReview(req, res) {
    try {
        const { id } = req.params;
        await Review.findByIdAndDelete(id);
        logger.info(`Recensione eliminata con successo: ${id}`); // Logga il successo dell'eliminazione
        res.status(200).json({ message: 'Recensione eliminata con successo' });
    } catch (error) {
        logger.error(`Errore durante l'eliminazione della recensione: ${error.message}`); // Logga l'errore
        res.status(500).json({ message: 'Errore durante l\'eliminazione della recensione', error: error.message });
    }
}

module.exports = {
    createReview,
    getReviewsByBeerBox,
    deleteReview,
};