const Review = require('../models/Review');
const Brewery = require('../models/Brewery');
const User = require('../models/User');
const path = require('path');
const fs = require('fs');
const GeminiAI = require('../utils/geminiAi');
const ValidationService = require('../utils/validationService');
const AIService = require('../services/aiService');
const CleanupService = require('../services/cleanupService');
const logWithFileName = require('../utils/logger');
const logger = logWithFileName(__filename);

const extractRawSuggestions = (aiResult) => {
  if (!aiResult) return [];
  if (Array.isArray(aiResult.suggestions) && aiResult.suggestions.length > 0) {
    return aiResult.suggestions;
  }
  if (Array.isArray(aiResult.ambiguities) && aiResult.ambiguities.length > 0) {
    return aiResult.ambiguities;
  }
  if (Array.isArray(aiResult.candidates) && aiResult.candidates.length > 0) {
    return aiResult.candidates;
  }
  return [];
};

const normalizeBrewerySuggestions = (rawSuggestions = []) => {
  if (!Array.isArray(rawSuggestions)) return [];

  return rawSuggestions.map((item = {}, index) => {
    const idCandidate = item._id || item.id || item.breweryId || item.originalId;
    const normalizedId = idCandidate ? idCandidate.toString() : `suggestion-${index}`;

    const location = item.breweryLocation || item.location || item.breweryLegalAddress || item.breweryProductionAddress || null;
    const website = item.breweryWebsite || item.website || item.url || null;
    const email = item.breweryEmail || item.email || null;

    let confidence = null;
    if (typeof item.confidence === 'number') {
      confidence = item.confidence;
    } else if (typeof item.similarity === 'number') {
      confidence = item.similarity;
    } else if (typeof item.matchRatio === 'number') {
      confidence = item.matchRatio;
    }

    return {
      id: normalizedId,
      _id: item._id || null,
      breweryName: item.breweryName || item.name || item.label || 'Birrificio non identificato',
      breweryLocation: location,
      breweryWebsite: website,
      breweryEmail: email,
      confidence,
      matchType: item.matchType || null,
      keywordMatch: Boolean(item.keywordMatch),
      meta: {
        similarity: typeof item.similarity === 'number' ? item.similarity : null,
        matchRatio: typeof item.matchRatio === 'number' ? item.matchRatio : null,
        matchingParts: item.matchingParts || null,
        source: item.source || null
      }
    };
  });
};

// Validazione AI primo livello (immagine) - UNICA ROTTA NECESSARIA
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
    
    // Chiamata AI per analisi immagine usando AIService invece di GeminiAI diretto
    let aiResult;
    try {
      aiResult = await AIService.processImageAnalysis(imageBuffer, req.session, req.user?._id);
    } catch (apiError) {
      logger.error('[firstCheckAI] Errore chiamata API AIService', {
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
      breweryFound: !!aiResult.brewery,
      antiHallucinationEnabled: !!aiResult.antiHallucination,
      needsUserIntervention: !!aiResult.needsUserIntervention,
      userFlowType: aiResult.userFlowType || 'UNKNOWN'
    });
    
    // 🛡️ NUOVO SISTEMA ANTI-ALLUCINAZIONI: Controllo se serve intervento utente
    logger.debug('[firstCheckAI] DEBUG - Controllo condizioni anti-allucinazioni', {
      sessionId: req.sessionID,
      needsUserIntervention: !!aiResult.needsUserIntervention,
      antiHallucinationEnabled: !!aiResult.antiHallucination?.enabled,
      antiHallucinationObject: aiResult.antiHallucination,
      conditionResult: !!(aiResult.needsUserIntervention && aiResult.antiHallucination?.enabled)
    });
    
    if (aiResult.needsUserIntervention && aiResult.antiHallucination?.enabled) {
      logger.info('[firstCheckAI] ⚠️ Sistema anti-allucinazioni attivato - Redirect a interfaccia verifica', {
        sessionId: req.sessionID,
        userId: req.user?._id,
        userFlowType: aiResult.userFlowType,
        verifiedCount: aiResult.processedData?.verified?.count || {},
        unverifiedCount: aiResult.processedData?.unverified?.count || {},
        blockedCount: aiResult.processedData?.blocked?.count || {}
      });

      // Salva immagine per l'interfaccia di verifica
      req.session.aiImageData = {
        base64: base64Image,
        mimeType: mimeType,
        timestamp: new Date().toISOString()
      };

      // 🖼️ Aggiungi thumbnail dell'immagine caricata per sistema anti-allucinazioni
      const imageDataUrl = `data:${mimeType};base64,${base64Image}`;

      // 💾 Salva dati di validazione e analisi nella sessione per l'interfaccia
      req.session.aiValidationResult = aiResult.validation || {
        canSaveDirectly: false,
        requiresUserConfirmation: true,
        requiresUserCompletion: false,
        blockedByValidation: false,
        userActions: aiResult.userActions || [],
        messages: aiResult.messages || {}
      };

      req.session.aiAnalysisData = {
        bottles: aiResult.bottles || [],
        breweries: aiResult.breweries || [],
        processedData: aiResult.processedData || {},
        userFlowType: aiResult.userFlowType,
        messages: aiResult.messages || {},
        timestamp: new Date().toISOString()
      };

      // Risposta JSON che indica necessità di verifica
      return res.json({
        success: true,
        antiHallucinationActive: true,
        needsVerification: true,
        userFlowType: aiResult.userFlowType,
        redirectUrl: '/review/verify-ai-analysis',
        message: aiResult.messages?.warning || 'Verifica i dati rilevati prima del salvataggio automatico.',
        // Aggiungi thumbnail e normalizza campi per interfaccia di verifica
        bottles: aiResult.bottles ? aiResult.bottles.map(bottle => ({
          ...bottle,
          // Thumbnail integration
          thumbnail: bottle.thumbnail || imageDataUrl,
          originalImageUrl: imageDataUrl,
          // Field mapping per frontend compatibility 
          bottleLabel: bottle.beerName || bottle.bottleLabel || bottle.name || 'Birra sconosciuta',
          breweryName: bottle.breweryName || bottle.brewery || 'Birrificio sconosciuto', 
          beerType: bottle.beerType || bottle.type || bottle.style || 'Tipo non specificato',
          alcoholContent: bottle.alcoholContent || bottle.abv || bottle.alcohol || 'N/A'
        })) : [],
        data: {
          processedData: aiResult.processedData,
          validation: aiResult.validation,
          messages: aiResult.messages
        },
        rateLimitInfo: {
          remainingRequests: Math.max(0, (AIService.canMakeRequest(req.session, req.user?._id).remainingRequests || 0) - 1),
          maxRequests: AIService.canMakeRequest(req.session, req.user?._id).maxRequests,
          isUserAuthenticated: !!req.user
        }
      });
    }

    // ✅ Dati verificati - Possibile salvataggio diretto
    if (aiResult.canSaveDirectly && aiResult.antiHallucination?.safeToSave) {
      logger.info('[firstCheckAI] ✅ Dati verificati dal sistema anti-allucinazioni - Salvataggio sicuro', {
        sessionId: req.sessionID,
        userId: req.user?._id,
        verifiedBreweriesCount: aiResult.processedData?.verified?.count?.breweries || 0,
        verifiedBeersCount: aiResult.processedData?.verified?.count?.beers || 0
      });

      // Incrementa contatore richieste per salvataggio riuscito
      AIService.incrementRequestCount(req.session);

      // 🖼️ Aggiungi thumbnail dell'immagine caricata ai dati verificati
      const imageDataUrl = `data:${mimeType};base64,${base64Image}`;
      
      // Prepara risposta di successo con dati verificati e thumbnail
      const response = {
        ...aiResult,
        antiHallucinationActive: true,
        directSave: true,
        verified: true,
        message: aiResult.messages?.success || 'Tutti i dati sono stati verificati e possono essere salvati.',
        // Aggiungi thumbnail e normalizza nomi campi per frontend
        bottles: aiResult.bottles ? aiResult.bottles.map(bottle => ({
          ...bottle,
          // Thumbnail integration
          thumbnail: bottle.thumbnail || imageDataUrl,
          originalImageUrl: imageDataUrl,
          // Field mapping per frontend compatibility 
          bottleLabel: bottle.beerName || bottle.bottleLabel || bottle.name || 'Birra sconosciuta',
          breweryName: bottle.breweryName || bottle.brewery || 'Birrificio sconosciuto', 
          beerType: bottle.beerType || bottle.type || bottle.style || 'Tipo non specificato',
          alcoholContent: bottle.alcoholContent || bottle.abv || bottle.alcohol || 'N/A'
        })) : [],
        rateLimitInfo: {
          remainingRequests: Math.max(0, (AIService.canMakeRequest(req.session, req.user?._id).remainingRequests || 0) - 1),
          maxRequests: AIService.canMakeRequest(req.session, req.user?._id).maxRequests,
          isUserAuthenticated: !!req.user
        }
      };

      if (responseWarning) {
        response.rateLimitWarning = responseWarning;
      }

      return res.json(response);
    }

    // FALLBACK: Sistema legacy per retrocompatibilità 
    if (aiResult.needsDisambiguation) {
      const rawSuggestions = extractRawSuggestions(aiResult);
      const normalizedSuggestions = normalizeBrewerySuggestions(rawSuggestions);
      const ambiguities = Array.isArray(aiResult.ambiguities) ? aiResult.ambiguities : rawSuggestions;

      logger.info('[firstCheckAI] Disambiguazione richiesta', {
        sessionId: req.sessionID,
        reason: aiResult.disambiguationReason,
        suggestionsCount: normalizedSuggestions.length
      });

      const sessionPayload = {
        ...aiResult,
        suggestions: normalizedSuggestions,
        ambiguities
      };

      // Salva i dati temporanei con flag disambiguazione
      req.session.aiReviewData = {
        data: sessionPayload,
        timestamp: new Date().toISOString(),
        needsDisambiguation: true,
        tempData: true,
        processed: false
      };

      // 🖼️ Aggiungi thumbnail dell'immagine caricata alle bottiglie per disambiguazione
      const imageDataUrl = `data:${mimeType};base64,${base64Image}`;
      
      return res.status(200).json({
        success: false, // False per indicare che serve azione utente
        needsDisambiguation: true,
        disambiguationReason: aiResult.disambiguationReason,
        suggestions: normalizedSuggestions,
        ambiguities,
        bottles: aiResult.bottles ? aiResult.bottles.map(bottle => ({
          ...bottle,
          // Thumbnail integration
          thumbnail: bottle.thumbnail || imageDataUrl,
          originalImageUrl: imageDataUrl,
          // Field mapping per frontend compatibility 
          bottleLabel: bottle.beerName || bottle.bottleLabel || bottle.name || 'Birra sconosciuta',
          breweryName: bottle.breweryName || bottle.brewery || 'Birrificio sconosciuto', 
          beerType: bottle.beerType || bottle.type || bottle.style || 'Tipo non specificato',
          alcoholContent: bottle.alcoholContent || bottle.abv || bottle.alcohol || 'N/A'
        })) : [],
        originalAnalysis: sessionPayload,
        originalImage: req.session.aiImageData ? {
          base64: req.session.aiImageData.base64,
          mimeType: req.session.aiImageData.mimeType
        } : null,
        warning: responseWarning
      });
    }

    // Salva i dati di analisi in sessione per persistenza
    req.session.aiReviewData = {
      data: aiResult,
      timestamp: new Date().toISOString(),
      completed: false,
      needsDisambiguation: false,
      tempData: false,
      processed: true
    };
    
    logger.info('[firstCheckAI] Dati analisi salvati in sessione', {
      sessionId: req.sessionID,
      bottlesCount: aiResult.bottles?.length || 0,
      needsDisambiguation: aiResult.needsDisambiguation,
      ambiguitiesCount: aiResult.ambiguities?.length || 0
    });

    // Verifica se è necessaria la disambiguazione
    if (aiResult.needsDisambiguation) {
      logger.info('[firstCheckAI] Disambiguazione necessaria, restituzione dati per frontend', {
        sessionId: req.sessionID,
        userId: req.user?._id,
        disambiguationReason: aiResult.disambiguationReason,
        ambiguitiesCount: aiResult.ambiguities?.length || 0
      });
      
      // Salva anche l'immagine per la pagina di disambiguazione
      req.session.aiImageData = {
        base64: base64Image,
        mimeType: mimeType,
        timestamp: new Date().toISOString()
      };
      
      // 🖼️ Aggiungi thumbnail dell'immagine caricata ai dati di disambiguazione
      const imageDataUrl = `data:${mimeType};base64,${base64Image}`;
      
      // Restituisci JSON invece di redirect - il frontend gestirà il reindirizzamento
      return res.json({
        success: true,
        needsDisambiguation: true,
        disambiguationReason: aiResult.disambiguationReason,
        data: {
          ...aiResult,
          bottles: aiResult.bottles ? aiResult.bottles.map(bottle => ({
            ...bottle,
            // Thumbnail integration
            thumbnail: bottle.thumbnail || imageDataUrl,
            originalImageUrl: imageDataUrl,
            // Field mapping per frontend compatibility 
            bottleLabel: bottle.beerName || bottle.bottleLabel || bottle.name || 'Birra sconosciuta',
            breweryName: bottle.breweryName || bottle.brewery || 'Birrificio sconosciuto', 
            beerType: bottle.beerType || bottle.type || bottle.style || 'Tipo non specificato',
            alcoholContent: bottle.alcoholContent || bottle.abv || bottle.alcohol || 'N/A'
          })) : []
        },
        originalImage: req.session.aiImageData ? {
          base64: req.session.aiImageData.base64,
          mimeType: req.session.aiImageData.mimeType
        } : null,
        redirectUrl: '/review',
        message: 'Sono state rilevate ambiguità nei dati. Verrai reindirizzato alla pagina di conferma.'
      });
    }

    // Incrementa il contatore delle richieste dopo analisi completata con successo
    AIService.incrementRequestCount(req.session);
    
    // 🖼️ Aggiungi thumbnail dell'immagine caricata a tutte le bottiglie
    const imageDataUrl = `data:${mimeType};base64,${base64Image}`;
    
    // Prepara risposta con eventuale warning e thumbnail
    const response = {
      ...aiResult,
      // Aggiungi thumbnail e normalizza campi per visualizzazione
      bottles: aiResult.bottles ? aiResult.bottles.map(bottle => ({
        ...bottle,
        // Thumbnail integration
        thumbnail: bottle.thumbnail || imageDataUrl,
        originalImageUrl: imageDataUrl,
        // Field mapping per frontend compatibility 
        bottleLabel: bottle.beerName || bottle.bottleLabel || bottle.name || 'Birra sconosciuta',
        breweryName: bottle.breweryName || bottle.brewery || 'Birrificio sconosciuto', 
        beerType: bottle.beerType || bottle.type || bottle.style || 'Tipo non specificato',
        alcoholContent: bottle.alcoholContent || bottle.abv || bottle.alcohol || 'N/A'
      })) : []
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

// Dashboard admin per risoluzione birrifici non riconosciuti
exports.adminBreweryResolution = async (req, res) => {
  try {
    // Recupera recensioni con birrifici non verificati
    const reviewsWithUnverifiedBreweries = await Review.find({
      status: 'pending_brewery_verification'
    })
    .populate('user', 'username email')
    .populate('ratings.brewery', 'breweryName status createdBy')
    .sort({ date: -1 });

    // Raggruppa per birrificio per una gestione più efficiente
    const breweryGroups = {};
    
    reviewsWithUnverifiedBreweries.forEach(review => {
      review.ratings.forEach(rating => {
        if (rating.brewery) {
          const breweryId = rating.brewery._id.toString();
          
          if (!breweryGroups[breweryId]) {
            breweryGroups[breweryId] = {
              brewery: rating.brewery,
              reviews: [],
              totalReviews: 0
            };
          }
          
          breweryGroups[breweryId].reviews.push({
            reviewId: review._id,
            user: review.user,
            date: review.date,
            beerName: rating.bottleLabel,
            rating: rating.rating,
            imageUrl: review.imageUrl
          });
          
          breweryGroups[breweryId].totalReviews++;
        }
      });
    });

    const breweryList = Object.values(breweryGroups);
    
    logger.info('[adminBreweryResolution] Dashboard birrifici non verificati caricata', {
      userId: req.user?._id,
      unverifiedBreweries: breweryList.length,
      totalReviews: reviewsWithUnverifiedBreweries.length
    });

    res.render('admin/breweryResolution.njk', {
      title: 'Risoluzione Birrifici',
      header: 'Birrifici da Verificare',
      breweryGroups: breweryList,
      totalUnverified: breweryList.length,
      totalReviews: reviewsWithUnverifiedBreweries.length
    });

  } catch (error) {
    logger.error('[adminBreweryResolution] Errore:', {
      error: error.message,
      userId: req.user?._id
    });
    res.status(500).render('error.njk', { 
      message: 'Errore interno del server',
      error: process.env.NODE_ENV === 'development' ? error : {}
    });
  }
};

// Approva birrificio e pubblica recensioni associate
exports.approveBrewery = async (req, res) => {
  try {
    const { breweryId } = req.params;
    const { action } = req.body; // 'approve' o 'reject'
    
    logger.info('[approveBrewery] Operazione su birrificio', {
      userId: req.user?._id,
      breweryId,
      action
    });
    
    if (action === 'approve') {
      // Approva birrificio
      await Brewery.findByIdAndUpdate(breweryId, {
        status: 'approved',
        approvedBy: req.user._id,
        approvedAt: new Date()
      });
      
      // Pubblica tutte le recensioni associate
      const result = await Review.updateMany(
        { 
          'ratings.brewery': breweryId,
          status: 'pending_brewery_verification'
        },
        { status: 'completed' }
      );
      
      logger.info('[approveBrewery] Birrificio approvato e recensioni pubblicate', {
        userId: req.user?._id,
        breweryId,
        reviewsPublished: result.modifiedCount
      });
      
      req.session.message = { 
        info: `Birrificio approvato! ${result.modifiedCount} recensioni pubblicate.` 
      };
      
    } else if (action === 'reject') {
      // Rifiuta birrificio
      await Brewery.findByIdAndUpdate(breweryId, {
        status: 'rejected',
        rejectedBy: req.user._id,
        rejectedAt: new Date()
      });
      
      // Rimuovi recensioni associate o portale in stato draft
      const result = await Review.updateMany(
        { 
          'ratings.brewery': breweryId,
          status: 'pending_brewery_verification'
        },
        { status: 'draft' }
      );
      
      logger.info('[approveBrewery] Birrificio rifiutato e recensioni spostate in draft', {
        userId: req.user?._id,
        breweryId,
        reviewsDrafted: result.modifiedCount
      });
      
      req.session.message = { 
        warning: `Birrificio rifiutato. ${result.modifiedCount} recensioni spostate in bozza.` 
      };
    }
    
    res.redirect('/admin/brewery-resolution');
    
  } catch (error) {
    logger.error('[approveBrewery] Errore:', {
      error: error.message,
      userId: req.user?._id,
      breweryId: req.params.breweryId
    });
    req.session.message = { error: 'Errore durante l\'operazione.' };
    res.redirect('/admin/brewery-resolution');
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

// Batch di validazione secondo livello (solo admin)
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
    // O usa i dati forniti nel payload se disponibili (fallback per sessioni perse)
    let sessionAiData = req.session.aiReviewData;
    let usingFallbackData = false;
    
    if (!sessionAiData || !sessionAiData.data || !sessionAiData.data.processed || sessionAiData.data.tempData) {
      logger.warn('[createMultipleReviews] Dati sessione non disponibili, controllo fallback aiAnalysisData dal payload', {
        hasSessionData: !!sessionAiData,
        hasPayloadAiData: !!aiAnalysisData,
        sessionId: req.sessionID,
        userId: req.user?._id
      });
      
      // Fallback: usa i dati dal payload se disponibili
      if (aiAnalysisData && aiAnalysisData.bottles && aiAnalysisData.breweryId) {
        logger.info('[createMultipleReviews] Uso dati fallback dal payload', {
          bottlesCount: aiAnalysisData.bottles?.length || 0,
          breweryId: aiAnalysisData.breweryId,
          sessionId: req.sessionID
        });
        
        sessionAiData = {
          data: {
            ...aiAnalysisData,
            processed: true,
            tempData: false,
            beerIds: aiAnalysisData.beerIds || []
          }
        };
        usingFallbackData = true;
      } else {
        logger.error('[createMultipleReviews] CRITICO: Nessun dato disponibile né in sessione né nel payload', {
          hasSessionData: !!sessionAiData,
          hasPayloadAiData: !!aiAnalysisData,
          sessionId: req.sessionID,
          userId: req.user?._id
        });
        
        return res.status(400).json({
          error: 'I dati di analisi non sono disponibili. Ricarica la pagina e riprova.',
          needsReanalysis: true
        });
      }
    }
    
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
 * Risolve l'ambiguità di un birrificio e salva i dati nel database
 */
exports.resolveDisambiguation = async (req, res) => {
  try {
    const { selectedBreweryId, createNew, newBreweryData } = req.body;
    
    // Recupera i dati di analisi dalla sessione
    const sessionData = req.session.aiReviewData;
    if (!sessionData || !sessionData.data || sessionData.data.processed || !sessionData.data.tempData) {
      return res.status(400).json({
        success: false,
        error: 'Nessun dato di analisi in attesa di disambiguazione trovato'
      });
    }

    logger.info('[resolveDisambiguation] Avvio risoluzione disambiguazione', {
      sessionId: req.sessionID,
      userId: req.user?._id,
      selectedBreweryId,
      createNew: !!createNew,
      hasNewBreweryData: !!newBreweryData
    });

    let finalBreweryId = null;

    if (createNew && newBreweryData) {
      // Crea nuovo birrificio con dati forniti dall'utente
      logger.info('[resolveDisambiguation] Creazione nuovo birrificio', {
        breweryName: newBreweryData.breweryName,
        sessionId: req.sessionID
      });

      const GeminiAI = require('../utils/geminiAi');
      finalBreweryId = await GeminiAI.findOrCreateBrewery(newBreweryData);
      
    } else if (selectedBreweryId) {
      // Usa birrificio esistente selezionato
      logger.info('[resolveDisambiguation] Uso birrificio esistente', {
        breweryId: selectedBreweryId,
        sessionId: req.sessionID
      });

      finalBreweryId = selectedBreweryId;
      
    } else {
      return res.status(400).json({
        success: false,
        error: 'Devi selezionare un birrificio esistente o fornire i dati per un nuovo birrificio'
      });
    }

    // Ora salva i dati con il birrificio confermato
    const analysisData = sessionData.data;
    
    // Processa le birre e crea/aggiorna gli ID
    const GeminiAI = require('../utils/geminiAi');
    const beerIds = [];
    
    for (const bottle of analysisData.bottles || []) {
      try {
        const beerId = await GeminiAI.findOrCreateBeer(bottle, finalBreweryId);
        if (beerId) {
          beerIds.push(beerId);
        }
      } catch (error) {
        logger.error('[resolveDisambiguation] Errore creazione birra', {
          error: error.message,
          beerName: bottle.beerName || 'sconosciuta',
          breweryId: finalBreweryId
        });
      }
    }

    // Aggiorna i dati di sessione con gli ID confermati
    const resolvedData = {
      ...analysisData,
      breweryId: finalBreweryId,
      beerIds: beerIds,
      needsDisambiguation: false,
      processed: true, // Ora i dati sono confermati e processati
      tempData: false, // Non più temporanei
      resolvedAt: new Date().toISOString()
    };

    // Salva in sessione i dati risolti
    req.session.aiReviewData = {
      data: resolvedData,
      timestamp: new Date().toISOString(),
      completed: false
    };

    logger.info('[resolveDisambiguation] Disambiguazione completata con successo', {
      sessionId: req.sessionID,
      userId: req.user?._id,
      finalBreweryId,
      beerIdsCreated: beerIds.length
    });

    res.json({
      success: true,
      message: 'Disambiguazione completata con successo',
      data: {
        breweryId: finalBreweryId,
        beerIds: beerIds,
        bottles: analysisData.bottles
      }
    });

  } catch (error) {
    logger.error('[resolveDisambiguation] Errore:', {
      error: error.message,
      userId: req.user?._id,
      sessionId: req.sessionID
    });
    
    res.status(500).json({
      success: false,
      error: 'Errore interno durante la risoluzione dell\'ambiguità'
    });
  }
};

/**
 * Recupera i dati di analisi dalla sessione se presenti
 */
exports.getAiDataFromSession = async (req, res) => {
  try {
    const sessionData = req.session.aiReviewData;
    
    if (!sessionData || sessionData.completed) {
      // logger.info('[getAiDataFromSession] Nessun dato di analisi in sessione o già completato', {
      //   sessionId: req.sessionID,
      //   hasData: !!sessionData,
      //   completed: sessionData?.completed
      // });
      return res.json({ hasData: false });
    }
    
    // logger.info('[getAiDataFromSession] Dati di analisi recuperati dalla sessione', {
    //   sessionId: req.sessionID,
    //   timestamp: sessionData.timestamp,
    //   bottlesCount: sessionData.data?.bottles?.length || 0
    // });
    
    return res.json({ 
      hasData: true, 
      hasDisambiguationData: !!sessionData.data,
      hasReviewData: !!sessionData.data,
      needsDisambiguation: sessionData.data?.needsDisambiguation || false,
      disambiguationReason: sessionData.data?.disambiguationReason,
      bottles: sessionData.data?.bottles,
      suggestions: sessionData.data?.suggestions,
      ambiguities: sessionData.data?.ambiguities,
      originalImage: req.session.aiImageData ? {
        base64: req.session.aiImageData.base64,
        mimeType: req.session.aiImageData.mimeType
      } : null,
      timestamp: sessionData.timestamp,
      ...sessionData.data
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
    // Usa il servizio di cleanup per pulizia completa
    CleanupService.forceCleanSession(req.session);
    
    logger.info('[clearAiDataFromSession] Dati di analisi rimossi dalla sessione via CleanupService', {
      sessionId: req.sessionID
    });
    
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

/**
 * Risolve l'ambiguità di birrifici selezionando manualmente
 */
exports.resolveDisambiguation = async (req, res) => {
  try {
    const { selectedBreweryId, createNewBrewery, newBreweryData } = req.body;
    
    logger.info('[resolveDisambiguation] Risoluzione disambiguazione', {
      sessionId: req.sessionID,
      selectedBreweryId,
      createNewBrewery: !!createNewBrewery,
      hasNewBreweryData: !!newBreweryData
    });

    // Recupera i dati AI temporanei dalla sessione
    if (!req.session.aiReviewData || !req.session.aiReviewData.needsDisambiguation) {
      return res.status(400).json({
        success: false,
        error: 'Nessun dato di disambiguazione trovato in sessione'
      });
    }

    const originalAnalysis = req.session.aiReviewData.data;
    let resolvedBrewery = null;

    if (createNewBrewery && newBreweryData) {
      // Opzione: Crea nuovo birrificio
      logger.info('[resolveDisambiguation] Creazione nuovo birrificio', {
        breweryName: newBreweryData.breweryName,
        sessionId: req.sessionID
      });

      // Validazione dati minimi per nuovo birrificio
      if (!newBreweryData.breweryName || newBreweryData.breweryName.trim().length < 2) {
        return res.status(400).json({
          success: false,
          error: 'Nome birrificio richiesto (minimo 2 caratteri)'
        });
      }

      // Crea nuovo birrificio con dati minimi
      const newBrewery = new Brewery({
        breweryName: newBreweryData.breweryName.trim(),
        breweryWebsite: newBreweryData.breweryWebsite || null,
        breweryEmail: newBreweryData.breweryEmail || null,
        breweryLocation: newBreweryData.breweryLocation || null,
        createdBy: 'ai_disambiguation',
        createdFromAI: true,
        needsValidation: true // Flag per revisione admin
      });

      resolvedBrewery = await newBrewery.save();
      
      logger.info('[resolveDisambiguation] Nuovo birrificio creato', {
        breweryId: resolvedBrewery._id,
        breweryName: resolvedBrewery.breweryName,
        sessionId: req.sessionID
      });

    } else if (selectedBreweryId) {
      // Opzione: Seleziona birrificio esistente
      resolvedBrewery = await Brewery.findById(selectedBreweryId);
      
      if (!resolvedBrewery) {
        return res.status(404).json({
          success: false,
          error: 'Birrificio selezionato non trovato'
        });
      }

      logger.info('[resolveDisambiguation] Birrificio esistente selezionato', {
        breweryId: resolvedBrewery._id,
        breweryName: resolvedBrewery.breweryName,
        sessionId: req.sessionID
      });

    } else {
      return res.status(400).json({
        success: false,
        error: 'Devi selezionare un birrificio esistente o crearne uno nuovo'
      });
    }

    // Aggiorna l'analisi AI con il birrificio risolto
    const resolvedAnalysis = {
      ...originalAnalysis,
      brewery: {
        breweryName: resolvedBrewery.breweryName,
        breweryWebsite: resolvedBrewery.breweryWebsite,
        breweryEmail: resolvedBrewery.breweryEmail,
        breweryLocation: resolvedBrewery.breweryLocation,
        _id: resolvedBrewery._id
      },
      needsDisambiguation: false,
      disambiguationResolved: true,
      disambiguationMethod: createNewBrewery ? 'new_brewery' : 'existing_brewery'
    };

    // Aggiorna le birre con il birrificio risolto
    if (resolvedAnalysis.bottles) {
      resolvedAnalysis.bottles = resolvedAnalysis.bottles.map(bottle => ({
        ...bottle,
        brewery: resolvedAnalysis.brewery,
        breweryName: resolvedBrewery.breweryName,
        // Field mapping per frontend compatibility 
        bottleLabel: bottle.beerName || bottle.bottleLabel || bottle.name || 'Birra sconosciuta',
        beerType: bottle.beerType || bottle.type || bottle.style || 'Tipo non specificato',
        alcoholContent: bottle.alcoholContent || bottle.abv || bottle.alcohol || 'N/A'
      }));
    }

    // Salva l'analisi risolta in sessione
    req.session.aiReviewData = {
      data: resolvedAnalysis,
      timestamp: new Date().toISOString(),
      completed: false,
      needsDisambiguation: false,
      tempData: false,
      processed: true,
      disambiguationResolved: true
    };

    logger.info('[resolveDisambiguation] Disambiguazione completata', {
      sessionId: req.sessionID,
      breweryId: resolvedBrewery._id,
      bottlesCount: resolvedAnalysis.bottles?.length || 0,
      method: resolvedAnalysis.disambiguationMethod
    });

    return res.status(200).json({
      success: true,
      message: 'Disambiguazione risolta con successo',
      brewery: resolvedAnalysis.brewery,
      bottles: resolvedAnalysis.bottles,
      resolvedAnalysis: resolvedAnalysis
    });

  } catch (error) {
    logger.error('[resolveDisambiguation] Errore durante risoluzione', {
      sessionId: req.sessionID,
      error: error.message,
      stack: error.stack
    });

    return res.status(500).json({
      success: false,
      error: 'Errore interno durante la risoluzione dell\'ambiguità'
    });
  }
};
