const Review = require('../models/Review');
const Brewery = require('../models/Brewery');
const User = require('../models/User');
const path = require('path');
const fs = require('fs');
const GeminiAI = require('../utils/geminiAi');
const logWithFileName = require('../utils/logger');
const logger = logWithFileName(__filename);

// Validazione AI primo livello (immagine)
exports.firstCheckAI = async (req, res) => {
  try {
    const { image } = req.body;
    if (!image) {
      return res.status(400).json({ success: false, message: 'Immagine mancante.' });
    }
    
    logger.info('[firstCheckAI] Avvio analisi AI', {
      userId: req.user?._id,
      sessionId: req.sessionID,
      imageSize: image.length
    });
    
    // Chiamata AI per analisi immagine
    const aiResult = await GeminiAI.validateImage(image);
    if (!aiResult.success) {
      logger.warn('[firstCheckAI] Analisi AI fallita', { 
        message: aiResult.message,
        sessionId: req.sessionID 
      });
      return res.status(400).json(aiResult);
    }
    
    // CONTROLLO DUPLICATI SESSIONE: Verifica se le birre sono già state recensite
    if (aiResult.bottles && aiResult.bottles.length > 0) {
      const duplicateCheck = await checkDuplicateBeersInSession(
        aiResult.bottles, 
        req.sessionID, 
        req.user?._id
      );
      
      if (duplicateCheck.hasDuplicates) {
        logger.warn('[firstCheckAI] Rilevati duplicati nella sessione', {
          sessionId: req.sessionID,
          duplicates: duplicateCheck.duplicates,
          userId: req.user?._id
        });
        
        return res.status(409).json({
          success: false,
          message: 'Alcune birre sono già state recensite in questa sessione',
          duplicates: duplicateCheck.duplicates,
          errorType: 'DUPLICATE_REVIEW_IN_SESSION'
        });
      }
    }
    
    logger.info('[firstCheckAI] Analisi completata con successo', {
      sessionId: req.sessionID,
      bottlesFound: aiResult.bottles?.length || 0,
      breweryFound: !!aiResult.brewery
    });
    
    return res.json(aiResult);
  } catch (err) {
    logger.error('[firstCheckAI] Errore:', { 
      error: err.message,
      sessionId: req.sessionID,
      userId: req.user?._id
    });
    return res.status(500).json({ success: false, message: 'Errore validazione AI.' });
  }
};

// Funzione per controllare duplicati nella sessione
async function checkDuplicateBeersInSession(bottles, sessionId, userId) {
  try {
    const duplicates = [];
    const timeWindow = 2 * 60 * 60 * 1000; // 2 ore in millisecondi
    const cutoffTime = new Date(Date.now() - timeWindow);
    
    logger.debug('[checkDuplicates] Controllo duplicati sessione', {
      sessionId,
      userId,
      bottlesToCheck: bottles.length,
      timeWindow: '2 ore'
    });
    
    for (const bottle of bottles) {
      if (!bottle.bottleLabel || !bottle.breweryName) {
        continue; // Salta bottiglie senza dati sufficienti
      }
      
      // Normalizza nomi per confronto
      const normalizedBeerName = normalizeBeerName(bottle.bottleLabel);
      const normalizedBreweryName = normalizeBeerName(bottle.breweryName);
      
      // Cerca recensioni recenti nella sessione o dello stesso utente
      const searchCriteria = {
        createdAt: { $gte: cutoffTime },
        $or: [],
        'ratings.aiData': { $exists: true }
      };
      
      // Aggiungi criteri di ricerca
      if (sessionId) {
        searchCriteria.$or.push({ sessionId: sessionId });
      }
      if (userId) {
        searchCriteria.$or.push({ user: userId });
      }
      
      // Se non abbiamo né sessione né utente, salta il controllo
      if (searchCriteria.$or.length === 0) {
        continue;
      }
      
      const recentReviews = await Review.find(searchCriteria).populate('ratings.brewery');
      
      // Controlla ogni recensione recente
      for (const review of recentReviews) {
        for (const rating of review.ratings) {
          if (rating.aiData && rating.brewery) {
            const existingBeerName = normalizeBeerName(rating.aiData.bottleLabel || rating.bottleLabel);
            const existingBreweryName = normalizeBeerName(rating.brewery.breweryName);
            
            // Controllo match
            if (existingBeerName === normalizedBeerName && 
                existingBreweryName === normalizedBreweryName) {
              
              duplicates.push({
                beerName: bottle.bottleLabel,
                breweryName: bottle.breweryName,
                lastReviewDate: review.createdAt,
                reviewId: review._id
              });
              
              logger.info('[checkDuplicates] Duplicato trovato', {
                beerName: bottle.bottleLabel,
                breweryName: bottle.breweryName,
                existingReviewId: review._id,
                sessionId,
                userId
              });
              break;
            }
          }
        }
      }
    }
    
    return {
      hasDuplicates: duplicates.length > 0,
      duplicates: duplicates
    };
    
  } catch (error) {
    logger.error('[checkDuplicates] Errore controllo duplicati', {
      error: error.message,
      sessionId,
      userId
    });
    return { hasDuplicates: false, duplicates: [] };
  }
}

// Normalizza nome birra/birrificio per confronto
function normalizeBeerName(name) {
  if (!name) return '';
  return name.toLowerCase()
    .replace(/[^\w\s]/g, '') // Rimuovi caratteri speciali
    .replace(/\s+/g, ' ')    // Normalizza spazi
    .trim();
}

// Salva una nuova recensione
exports.createReview = async (req, res) => {
  try {
    const { image, location, deviceId, bottles } = req.body;
    if (!image || !bottles || !Array.isArray(bottles) || bottles.length === 0) {
      return res.status(400).json({ error: 'Dati mancanti o non validi.' });
    }

    logger.info('[createReview] Creazione recensione', {
      userId: req.user?._id,
      sessionId: req.sessionID,
      bottlesCount: bottles.length,
      hasLocation: !!location
    });

    // Crea la review prima di fare l'analisi AI
    const newReview = new Review({
      imageUrl: image, // Salva l'immagine per la review
      sessionId: req.sessionID, // Aggiungi sessionId per controllo duplicati
      location: location,
      deviceId: deviceId,
      user: req.user ? req.user._id : null,
      status: 'pending',
      ratings: bottles.map(bottle => ({
        bottleLabel: bottle.label,
        rating: bottle.rating,
        brewery: null // Sarà popolato dall'AI
      }))
    });

    const savedReview = await newReview.save();
    
    logger.info('[createReview] Review salvata', {
      reviewId: savedReview._id,
      sessionId: req.sessionID,
      userId: req.user?._id
    });

    // Chiamata AI: validazione e salvataggio automatico su MongoDB
    // Non passiamo l'immagine per evitare di salvarla due volte
    const aiResult = await GeminiAI.validateImage(
      image, 
      savedReview._id, 
      req.user ? req.user._id : null,
      req.sessionID // Passa anche sessionId
    );
    
    if (!aiResult.success) {
      // Se l'AI fallisce, manteniamo comunque la review come 'pending'
      logger.warn('[createReview] Analisi AI fallita ma review salvata', {
        reviewId: savedReview._id,
        aiMessage: aiResult.message
      });
      return res.status(200).json({ 
        success: true, 
        message: 'Review salvata, analisi AI non riuscita', 
        reviewId: savedReview._id 
      });
    }

    logger.info('[createReview] Review e analisi AI completate', {
      reviewId: savedReview._id,
      bottlesAnalyzed: aiResult.bottles?.length || 0,
      breweryFound: !!aiResult.brewery
    });
    
    // Restituisci successo con i dettagli dell'analisi AI
    return res.status(201).json({ 
      success: true,
      message: 'Review salvata e analizzata con successo!', 
      reviewId: savedReview._id,
      aiAnalysis: aiResult
    });
    
  } catch (err) {
    logger.error('[createReview] Errore:', { 
      error: err.message,
      sessionId: req.sessionID,
      userId: req.user?._id
    });
    return res.status(500).json({ error: 'Errore nel salvataggio recensione.' });
  }
};// Batch di validazione secondo livello (solo admin)
exports.batchValidateReviews = async (req, res) => {
  try {
    const pendingReviews = await Review.find({ status: 'pending' });
    let updated = 0;
    for (const review of pendingReviews) {
      // Chiamata AI: estrazione dettagli birra/birrificio
      const details = await GeminiAI.extractBeerDetails(review.imageUrl);
      // Aggiorna Review e Brewery con i dettagli recuperati
      if (details) {
        // Aggiorna brewery se necessario
        let brewery = await Brewery.findOne({ breweryEmail: details.breweryEmail });
        if (!brewery) {
          brewery = new Brewery({
            breweryEmail: details.breweryEmail,
            breweryName: details.breweryName
            // ...altri dettagli...
          });
          await brewery.save();
        }
        // Aggiorna review con dettagli birra
        review.ratings[0].beerType = details.beerType;
        review.ratings[0].alcoholContent = details.alcoholContent;
        review.ratings[0].brewery = brewery._id;
      }
      review.status = 'completed';
      await review.save();
      
      logger.info('[ReviewController] Recensione salvata con successo', {
        type: 'REVIEW_SAVED_SUCCESS',
        reviewId: review._id,
        userId: review.userId,
        sessionId: review.sessionId,
        breweryId: review.ratings[0].brewery,
        beerName: review.ratings[0].beerName,
        beerType: review.ratings[0].beerType,
        status: review.status,
        createdAt: review.createdAt
      });
      
      updated++;
    }
    return res.json({ message: `Batch completato: ${updated} review aggiornate.` });
  } catch (err) {
    return res.status(500).json({ error: 'Errore batch validazione.' });
  }
};

// Visualizza birrifici incompleti (solo admin)
exports.incompleteBreweries = async (req, res) => {
  try {
    const incomplete = await Brewery.find({ $or: [
      { breweryEmail: { $exists: false } },
      { breweryEmail: '' },
      { breweryName: { $exists: false } },
      { breweryName: '' }
    ] });
    const complete = await Brewery.find({ breweryEmail: { $ne: '' }, breweryName: { $ne: '' } });
    return res.render('admin/incompleteBreweries.njk', { incomplete, complete });
  } catch (err) {
    return res.status(500).json({ error: 'Errore nel recupero birrifici.' });
  }
};
