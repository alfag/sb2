const Review = require('../models/Review');
const Brewery = require('../models/Brewery');
const User = require('../models/User');
const path = require('path');
const fs = require('fs');
const GeminiAI = require('../utils/geminiAi');
const ValidationService = require('../utils/validationService');
const AIService = require('../services/aiService');
const logWithFileName = require('../utils/logger');
const logger = logWithFileName(__filename);

// Validazione AI primo livello (immagine)
exports.firstCheckAI = async (req, res) => {
  try {
    // Controllo rate limiting prima di elaborare la richiesta
    const rateLimitCheck = AIService.canMakeRequest(req.session, req.user?._id);
    
    if (!rateLimitCheck.canMakeRequest) {
      logger.warn('[firstCheckAI] Rate limit superato', {
        sessionId: req.sessionID,
        userId: req.user?._id,
        requestCount: rateLimitCheck.requestCount,
        maxRequests: rateLimitCheck.maxRequests,
        isUserAuthenticated: rateLimitCheck.isUserAuthenticated
      });
      
      logger.info('[firstCheckAI] Invio risposta rate limit e return', { 
        sessionId: req.sessionID
      });
      
      return res.status(429).json({
        success: false,
        error: 'RATE_LIMIT_EXCEEDED',
        message: 'Hai raggiunto il limite di richieste. Effettua il login per continuare o riprova più tardi.',
        suggestion: 'Accedi per aumentare il numero di richieste disponibili o attendi prima di riprovare.',
        details: {
          requestCount: rateLimitCheck.requestCount,
          maxRequests: rateLimitCheck.maxRequests,
          remainingRequests: rateLimitCheck.remainingRequests,
          resetInfo: rateLimitCheck.resetInfo,
          authUrl: rateLimitCheck.authUrl
        }
      });
    }
    
    // Avviso warning se ci si avvicina al limite
    let responseWarning = null;
    if (rateLimitCheck.warning) {
      responseWarning = {
        message: rateLimitCheck.warning,
        remainingRequests: rateLimitCheck.remainingRequests,
        authUrl: rateLimitCheck.authUrl
      };
      
      logger.info('[firstCheckAI] Warning rate limit', {
        sessionId: req.sessionID,
        userId: req.user?._id,
        remainingRequests: rateLimitCheck.remainingRequests,
        warning: rateLimitCheck.warning
      });
    }

    // Usa req.file.buffer con Multer invece di req.body.image
    const imageBuffer = req.file?.buffer;
    if (!imageBuffer) {
      logger.error('[firstCheckAI] Nessuna immagine fornita', {
        sessionId: req.sessionID,
        hasFile: !!req.file,
        hasBuffer: !!req.file?.buffer
      });
      return res.status(400).json({ success: false, message: 'Immagine mancante.' });
    }
    
    // Converti buffer in data URL per compatibilità con GeminiAI
    const mimeType = req.file?.mimetype || 'image/jpeg';
    const base64Image = imageBuffer.toString('base64');
    const dataUrl = `data:${mimeType};base64,${base64Image}`;
    
    logger.info('[firstCheckAI] Avvio analisi immagine', {
      userId: req.user?._id,
      sessionId: req.sessionID,
      imageSize: imageBuffer.length,
      mimeType: mimeType
    });
    
    // Chiamata AI per analisi immagine
    let aiResult;
    try {
      aiResult = await GeminiAI.validateImage(dataUrl);
    } catch (apiError) {
      logger.error('[firstCheckAI] Errore chiamata API Gemini', {
        error: apiError.message,
        stack: apiError.stack,
        sessionId: req.sessionID
      });
      
      // Fornisci una risposta di fallback
      return res.status(200).json({
        success: false,
        message: 'Servizio di analisi temporaneamente non disponibile. Riprova più tardi.',
        errorType: 'SERVICE_ERROR',
        bottles: [],
        brewery: null,
        rateLimitInfo: {
          remainingRequests: AIService.canMakeRequest(req.session, req.user?._id).remainingRequests,
          maxRequests: AIService.canMakeRequest(req.session, req.user?._id).maxRequests,
          isUserAuthenticated: !!req.user
        }
      });
    }
    if (!aiResult.success) {
      logger.warn('[firstCheckAI] Analisi fallita - nessuna birra rilevata', { 
        message: aiResult.message,
        sessionId: req.sessionID,
        bottles: aiResult.bottles?.length || 0,
        brewery: !!aiResult.brewery
      });
      
      // Per "nessuna birra rilevata", restituisci 200 OK con errorType specifico
      const errorMessage = aiResult.message || 'Non sono state rilevate bottiglie di birra nell\'immagine. Carica un\'immagine contenente chiaramente prodotti birrari.';
      
      return res.status(200).json({
        success: false,
        message: errorMessage,
        errorType: 'NO_BEER_DETECTED',
        bottles: [],
        brewery: null
      });
    }
    
    // NOTA: Il controllo duplicati è gestito in reviewService.checkDuplicateReview()
    // che verifica se l'utente ha già recensito una specifica birra (senza limiti temporali)
    // permettendo così di evitare recensioni duplicate mantenendo l'integrità dei dati
    
    logger.info('[firstCheckAI] Analisi completata con successo', {
      sessionId: req.sessionID,
      bottlesFound: aiResult.bottles?.length || 0,
      breweryFound: !!aiResult.brewery
    });
    
    // Salva i dati di analisi in sessione per persistenza
    req.session.aiReviewData = {
      data: aiResult,
      timestamp: new Date().toISOString(),
      completed: false
    };
    
    logger.info('[firstCheckAI] Dati analisi salvati in sessione', {
      sessionId: req.sessionID,
      bottlesCount: aiResult.bottles?.length || 0
    });
    
    // Incrementa il contatore delle richieste dopo analisi completata con successo
    AIService.incrementRequestCount(req.session);
    
    // Prepara risposta con eventuale warning
    const response = {
      ...aiResult
    };
    
    // Aggiungi warning se presente
    if (responseWarning) {
      response.rateLimitWarning = responseWarning;
    }
    
    // Aggiungi info rate limiting nella risposta
    const updatedRateLimitCheck = AIService.canMakeRequest(req.session, req.user?._id);
    response.rateLimitInfo = {
      remainingRequests: Math.max(0, updatedRateLimitCheck.remainingRequests - 1), // -1 perché abbiamo appena fatto una richiesta
      maxRequests: updatedRateLimitCheck.maxRequests,
      isUserAuthenticated: updatedRateLimitCheck.isUserAuthenticated
    };
    
    return res.json(response);
  } catch (err) {
    logger.error('[firstCheckAI] Errore:', { 
      error: err.message,
      sessionId: req.sessionID,
      userId: req.user?._id
    });
    return res.status(500).json({ success: false, message: 'Errore durante l\'analisi dell\'immagine.' });
  }
};

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

    // Chiamata analisi: validazione e salvataggio automatico su MongoDB
    // Non passiamo l'immagine per evitare di salvarla due volte
    const aiResult = await GeminiAI.validateImage(
      image, 
      savedReview._id, 
      req.user ? req.user._id : null,
      req.sessionID // Passa anche sessionId
    );
    
    if (!aiResult.success) {
      // Se l'analisi fallisce, manteniamo comunque la review come 'pending'
      logger.warn('[createReview] Analisi fallita ma review salvata', {
        reviewId: savedReview._id,
        aiMessage: aiResult.message
      });
      return res.status(200).json({ 
        success: true, 
        message: 'Recensione salvata, analisi non riuscita', 
        reviewId: savedReview._id 
      });
    }

    logger.info('[createReview] Recensione e analisi completate', {
      reviewId: savedReview._id,
      bottlesAnalyzed: aiResult.bottles?.length || 0,
      breweryFound: !!aiResult.brewery
    });
    
    // Restituisci successo con i dettagli dell'analisi
    return res.status(201).json({ 
      success: true,
      message: 'Recensione salvata e analizzata con successo!', 
      reviewId: savedReview._id,
      analysis: aiResult
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
      
      logger.info('[batchValidateReviews] Recensione salvata con successo', {
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

// Crea multiple recensioni da interfaccia AI
exports.createMultipleReviews = async (req, res) => {
  try {
    const { reviews, aiAnalysisData } = req.body;
    
    if (!reviews || !Array.isArray(reviews) || reviews.length === 0) {
      return res.status(400).json({ error: 'Nessuna recensione da salvare.' });
    }

    logger.info('[createMultipleReviews] Creazione recensioni multiple', {
      userId: req.user?._id,
      sessionId: req.sessionID,
      reviewsCount: reviews.length,
      reviewsData: reviews.map(r => ({ 
        beerName: r?.beerName, 
        rating: r?.rating, 
        hasData: !!r?.aiData,
        beerId: r?.beerId
      }))
    });

    // Validazione input incluso controllo linguaggio inappropriato
    logger.info('[createMultipleReviews] Test validazione con reviews:', {
      reviewsCount: reviews.length,
      sampleTexts: reviews.slice(0, 2).map(r => ({
        beerName: r.beerName,
        notes: r.notes
      }))
    });
    
    const validationResult = ValidationService.validateReviewsInput({ reviews, aiAnalysisData });
    
    logger.info('[createMultipleReviews] Risultato validazione:', {
      isValid: validationResult.isValid,
      inappropriateContent: validationResult.inappropriateContent,
      hasDetails: !!validationResult.details
    });
    
    if (!validationResult.isValid) {
      if (validationResult.inappropriateContent) {
        logger.warn('[createMultipleReviews] Contenuto inappropriato rilevato', {
          userId: req.user?._id,
          sessionId: req.sessionID,
          violations: validationResult.details
        });
        
        return res.status(400).json({
          error: 'Sono stati rilevati contenuti inappropriati nelle recensioni',
          inappropriateContent: true,
          details: validationResult.details,
          message: 'Per favore, rivedi il linguaggio utilizzato nelle tue recensioni. Evita contenuti volgari o inappropriati.'
        });
      } else {
        logger.warn('[createMultipleReviews] Validazione fallita', {
          userId: req.user?._id,
          sessionId: req.sessionID,
          errors: validationResult.details
        });
        
        return res.status(400).json({
          error: validationResult.message,
          details: validationResult.details
        });
      }
    }

    // Usa i dati validati (e potenzialmente sanificati)
    const validatedReviews = validationResult.data.reviews;
    const createdReviews = [];

    // Crea una singola review con ratings multipli (seguendo il modello Review esistente)
    const ratingsArray = [];
    
    // Recupera i dati di analisi dalla sessione per ottenere gli ID delle birre
    const sessionAiData = req.session.aiReviewData;
    const beerIds = sessionAiData?.data?.beerIds || [];
    
    for (const [index, reviewData] of validatedReviews.entries()) {
      // Verifica che reviewData sia definito e abbia le proprietà necessarie
      if (!reviewData || typeof reviewData !== 'object') {
        logger.warn('[createMultipleReviews] ReviewData non valido, skipping', {
          reviewData: reviewData
        });
        continue;
      }

      if (!reviewData.rating || reviewData.rating < 1 || reviewData.rating > 5) {
        logger.warn('[createMultipleReviews] Rating non valido, skipping', {
          beerName: reviewData.beerName || 'undefined',
          rating: reviewData.rating
        });
        continue;
      }

      // Usa l'ID della birra dal database se disponibile
      const beerId = reviewData.beerId || beerIds[index] || null;
      
      // Recupera l'ID del birrificio dalla sessione di analisi (breweryId è aggiunto dopo il salvataggio)
      const breweryId = sessionAiData?.data?.breweryId || aiAnalysisData?.breweryId || null;

      // Aggiungi alla array ratings
      ratingsArray.push({
        bottleLabel: reviewData.beerName || 'Birra sconosciuta',
        rating: reviewData.rating,
        notes: reviewData.notes || '', // Note generali (già sanificate se necessario)
        beer: beerId, // ID della birra dal database
        brewery: breweryId, // ID del birrificio dal database
        // Valutazioni dettagliate (se presenti) - solo le 4 categorie specifiche
        detailedRatings: reviewData.detailedRatings ? {
          appearance: reviewData.detailedRatings.appearance ? {
            rating: reviewData.detailedRatings.appearance.rating || null,
            notes: reviewData.detailedRatings.appearance.notes || null // Già sanificato se necessario
          } : null,
          aroma: reviewData.detailedRatings.aroma ? {
            rating: reviewData.detailedRatings.aroma.rating || null,
            notes: reviewData.detailedRatings.aroma.notes || null // Già sanificato se necessario
          } : null,
          taste: reviewData.detailedRatings.taste ? {
            rating: reviewData.detailedRatings.taste.rating || null,
            notes: reviewData.detailedRatings.taste.notes || null // Già sanificato se necessario
          } : null,
          mouthfeel: reviewData.detailedRatings.mouthfeel ? {
            rating: reviewData.detailedRatings.mouthfeel.rating || null,
            notes: reviewData.detailedRatings.mouthfeel.notes || null // Già sanificato se necessario
          } : null
        } : null,
        aiData: {
          bottleLabel: reviewData.beerName || 'Birra sconosciuta',
          alcoholContent: reviewData.aiData?.alcoholContent || '',
          beerType: reviewData.aiData?.beerType || '',
          beerSubStyle: reviewData.aiData?.beerSubStyle || '',
          volume: reviewData.aiData?.volume || '',
          description: reviewData.aiData?.description || '',
          ingredients: reviewData.aiData?.ingredients || '',
          tastingNotes: reviewData.notes || '',
          confidence: reviewData.aiData?.confidence || 0,
          dataSource: reviewData.aiData?.dataSource || 'label',
          ibu: reviewData.aiData?.ibu || '',
          nutritionalInfo: reviewData.aiData?.nutritionalInfo || '',
          price: reviewData.aiData?.price || '',
          availability: reviewData.aiData?.availability || ''
        }
      });
      
      logger.info('[createMultipleReviews] Rating aggiunto', {
        beerName: reviewData.beerName || 'undefined',
        rating: reviewData.rating,
        beerId: beerId,
        breweryId: breweryId,
        hasNotes: !!reviewData.notes,
        hasDetailedRatings: !!reviewData.detailedRatings,
        detailedCategories: reviewData.detailedRatings ? Object.keys(reviewData.detailedRatings).filter(key => reviewData.detailedRatings[key]) : []
      });
    }

    if (ratingsArray.length === 0) {
      return res.status(400).json({ error: 'Nessuna recensione valida è stata creata.' });
    }

    // Crea una singola review con tutti i ratings
    const newReview = new Review({
      imageUrl: req.body.reviews?.[0]?.thumbnail || 'data:image/jpeg;base64,placeholder', // Usa il thumbnail della prima birra o placeholder
      user: req.user ? req.user._id : null,
      sessionId: req.sessionID,
      ratings: ratingsArray,
      status: 'completed',
      date: new Date(),
      aiAnalysis: {
        webSearchPerformed: aiAnalysisData?.webSearchPerformed || false,
        imageQuality: aiAnalysisData?.imageQuality || 'buona',
        analysisComplete: true,
        overallConfidence: aiAnalysisData?.overallConfidence || 0.8,
        processingTime: aiAnalysisData?.processingTime || '2s'
      }
    });

    const savedReview = await newReview.save();
    createdReviews.push(savedReview);

    logger.info('[createMultipleReviews] Recensione salvata', {
      reviewId: savedReview._id,
      ratingsCount: ratingsArray.length,
      sessionId: req.sessionID
    });

    if (createdReviews.length === 0) {
      return res.status(400).json({ error: 'Nessuna recensione valida è stata creata.' });
    }

    logger.info('[createMultipleReviews] Tutte le recensioni salvate', {
      totalCreated: createdReviews.length,
      reviewIds: createdReviews.map(r => r._id),
      userId: req.user?._id,
      sessionId: req.sessionID
    });

    // Marca i dati di analisi come completati in sessione
    if (req.session.aiReviewData) {
      req.session.aiReviewData.completed = true;
      req.session.aiReviewData.completedAt = new Date().toISOString();
      logger.info('[createMultipleReviews] Dati analisi marcati come completati in sessione', {
        sessionId: req.sessionID
      });
    }

    return res.status(201).json({
      success: true,
      message: `${createdReviews.length} recensioni create con successo`,
      reviews: createdReviews.map(review => ({
        id: review._id,
        ratingsCount: review.ratings?.length || 0,
        ratings: review.ratings?.map(rating => ({
          beerName: rating.bottleLabel || rating.aiData?.bottleLabel || 'Birra sconosciuta',
          rating: rating.rating,
          notes: rating.aiData?.tastingNotes || ''
        })) || []
      }))
    });

  } catch (err) {
    logger.error('[createMultipleReviews] Errore:', { 
      error: err.message,
      userId: req.user?._id,
      sessionId: req.sessionID
    });
    return res.status(500).json({ error: 'Errore nella creazione delle recensioni.' });
  }
};

/**
 * Recupera i dati di analisi dalla sessione se presenti
 */
exports.getAiDataFromSession = async (req, res) => {
  try {
    const sessionData = req.session.aiReviewData;
    
    if (!sessionData || sessionData.completed) {
      logger.info('[getAiDataFromSession] Nessun dato di analisi in sessione o già completato', {
        sessionId: req.sessionID,
        hasData: !!sessionData,
        completed: sessionData?.completed
      });
      return res.json({ hasData: false });
    }
    
    logger.info('[getAiDataFromSession] Dati di analisi recuperati dalla sessione', {
      sessionId: req.sessionID,
      timestamp: sessionData.timestamp,
      bottlesCount: sessionData.data?.bottles?.length || 0
    });
    
    return res.json({ 
      hasData: true, 
      data: sessionData.data,
      timestamp: sessionData.timestamp
    });
    
  } catch (error) {
    logger.error('[getAiDataFromSession] Errore durante il recupero dei dati dalla sessione', {
      sessionId: req.sessionID,
      error: error.message
    });
    return res.status(500).json({ error: 'Errore interno del server' });
  }
};

/**
 * Pulisce i dati di analisi dalla sessione
 */
exports.clearAiDataFromSession = async (req, res) => {
  try {
    if (req.session.aiReviewData) {
      delete req.session.aiReviewData;
      logger.info('[clearAiDataFromSession] Dati di analisi rimossi dalla sessione', {
        sessionId: req.sessionID
      });
    }
    
    return res.json({ success: true, message: 'Dati di analisi rimossi dalla sessione' });
    
  } catch (error) {
    logger.error('[clearAiDataFromSession] Errore durante la pulizia dei dati dalla sessione', {
      sessionId: req.sessionID,
      error: error.message
    });
    return res.status(500).json({ error: 'Errore interno del server' });
  }
};

/**
 * Visualizza le recensioni con i collegamenti alle birre (debug/admin)
 */
exports.viewReviewBeerConnections = async (req, res) => {
  try {
    const reviews = await Review.find({})
      .populate('user', 'username email')
      .populate('ratings.brewery', 'breweryName')
      .populate('ratings.beer', 'beerName alcoholContent beerType')
      .sort({ date: -1 })
      .limit(50);

    const reviewConnections = reviews.map(review => ({
      reviewId: review._id,
      user: review.user?.username || 'Anonimo',
      date: review.date,
      status: review.status,
      sessionId: review.sessionId,
      ratingsCount: review.ratings?.length || 0,
      ratings: review.ratings.map(rating => ({
        bottleLabel: rating.bottleLabel,
        rating: rating.rating,
        brewery: {
          id: rating.brewery?._id,
          name: rating.brewery?.breweryName || 'Non collegato'
        },
        beer: {
          id: rating.beer?._id,
          name: rating.beer?.beerName || 'Non collegato',
          alcoholContent: rating.beer?.alcoholContent,
          beerType: rating.beer?.beerType
        },
        hasAiData: !!rating.aiData,
        aiDataBottleLabel: rating.aiData?.bottleLabel
      }))
    }));

    logger.info('[viewReviewBeerConnections] Collegamenti recensioni-birre recuperati', {
      reviewsCount: reviews.length,
      connectedBeers: reviewConnections.reduce((sum, r) => sum + r.ratings.filter(rt => rt.beer.id).length, 0),
      totalRatings: reviewConnections.reduce((sum, r) => sum + r.ratingsCount, 0)
    });

    if (req.headers.accept && req.headers.accept.includes('application/json')) {
      return res.json({
        success: true,
        reviewConnections: reviewConnections,
        summary: {
          totalReviews: reviews.length,
          totalRatings: reviewConnections.reduce((sum, r) => sum + r.ratingsCount, 0),
          connectedBeers: reviewConnections.reduce((sum, r) => sum + r.ratings.filter(rt => rt.beer.id).length, 0),
          unconnectedRatings: reviewConnections.reduce((sum, r) => sum + r.ratings.filter(rt => !rt.beer.id).length, 0)
        }
      });
    } else {
      return res.render('admin/reviewBeerConnections.njk', { 
        reviewConnections,
        title: 'Collegamenti Recensioni-Birre'
      });
    }

  } catch (error) {
    logger.error('[viewReviewBeerConnections] Errore nel recupero collegamenti', {
      error: error.message
    });
    return res.status(500).json({ error: 'Errore nel recupero dei collegamenti' });
  }
};
