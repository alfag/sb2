/**
 * NUOVO CONTROLLER PER PUNTO 15
 * Sistema Asincrono: Disaccoppiamento creazione recensione da processing dati
 * 
 * Questo file contiene la nuova implementazione che:
 * 1. Salva recensione SUBITO (stato: pending_validation)
 * 2. Avvia job asincrono per processing AI/web scraping
 * 3. Job aggiorna recensione con riferimenti quando completo
 */

const Review = require('../models/Review');
const mongoose = require('mongoose'); // Import mongoose per ObjectId
const ValidationService = require('../utils/validationService');
const AIValidationService = require('../services/aiValidationService'); // Per detectProductType
const { addReviewProcessingJob, getJobStatus, getQueueStats } = require('../services/queueService');
const logWithFileName = require('../utils/logger');
const GeminiAI = require('../utils/geminiAi');

// 🖼️ FIX 18 GEN 2026: Image processor per ottimizzazione dimensioni
const { optimizeBase64Image, getBase64SizeKB } = require('../utils/imageProcessor');

// 🔧 CONFIGURAZIONE LIMITI SISTEMA
const MAX_BOTTLES_PER_IMAGE = 5; // Limite massimo bottiglie per foto per evitare sovraccarico

const logger = logWithFileName(__filename);

/**
 * NUOVO: Analisi immagine con sistema asincrono
 * 
 * Gestisce upload immagine, analisi AI, e avvio processing asincrono
 * Flusso completo:
 * 1. Upload immagine
 * 2. Analisi AI immediata (estrazione dati etichetta)
 * 3. Crea recensione con stato "pending_validation"
 * 4. Avvia job asincrono per processing completo
 * 5. Ritorna reviewId per polling
 */
exports.analyzeImageAsync = async (req, res) => {
  try {
    logger.info('[analyzeImageAsync] 🖼️ Nuova richiesta analisi immagine asincrona');
    
    // 1. Verifica presenza immagine
    if (!req.file && !req.files) {
      return res.status(400).json({
        success: false,
        message: 'Nessuna immagine caricata'
      });
    }

    const imageFile = req.file || req.files[0];
    const imageBuffer = imageFile.buffer;
    const mimeType = imageFile.mimetype;

    logger.info(`[analyzeImageAsync] 📊 Immagine ricevuta: ${imageFile.originalname} (${imageFile.size} bytes)`);

    // 2. Converti buffer in base64 per Gemini AI
    const imageBase64 = `data:${mimeType};base64,${imageBuffer.toString('base64')}`;

    // 3. Analisi AI immediata per estrarre dati etichetta
    const aiResult = await GeminiAI.validateImage(imageBase64);

    if (!aiResult.success || !aiResult.bottles || aiResult.bottles.length === 0) {
      return res.status(400).json({
        success: false,
        message: '🔍 Non abbiamo trovato bottiglie di birra in questa immagine. Prova a scattare una foto più ravvicinata dell\'etichetta o scegli un\'altra immagine con birre ben visibili.',
        errorType: 'NO_BEER_DETECTED'
      });
    }

    logger.info(`[analyzeImageAsync] ✅ AI ha rilevato ${aiResult.bottles.length} bottiglia/e`);

    // 🔍 DEBUG: Log completo della prima bottiglia per vedere struttura AI
    if (aiResult.bottles.length > 0) {
      logger.info('🔍 DEBUG - Struttura bottiglia AI:', JSON.stringify(aiResult.bottles[0], null, 2));
    }

    // 🚫 CONTROLLO CRITICO: Blocco prodotti NON-BIRRA (liquori, vini, sidri)
    // Verifica OGNI bottiglia rilevata per assicurarsi che sia birra
    for (const bottle of aiResult.bottles) {
      // Prepara i dati per detectProductType
      // 🔥 FIX 21 DIC 2025: Includi readingNotes esplicitamente per catturare "liqueur" e simili
      const beerDataForCheck = {
        verifiedData: {
          beerName: bottle.labelData?.beerName || bottle.beerName,
          beerType: bottle.labelData?.beerStyle || bottle.beerStyle || '',
          description: bottle.labelData?.otherText || bottle.otherText || ''
        },
        labelData: {
          beerName: bottle.labelData?.beerName || bottle.beerName,
          beerStyle: bottle.labelData?.beerStyle || bottle.beerStyle,
          otherText: bottle.labelData?.otherText || bottle.otherText || '',
          // 🆕 Passa readingNotes esplicitamente - contiene testi aggiuntivi letti dall'etichetta
          // Es: "The World's Favourite Italian Liqueur" nel caso Disaronno
          readingNotes: bottle.labelData?.readingNotes || bottle.readingNotes || bottle.stylisticElements || ''
        },
        webVerification: bottle.webVerification || {}
      };

      // Chiama detectProductType per verificare se è birra
      const productType = AIValidationService.detectProductType(beerDataForCheck);
      
      logger.debug('[analyzeImageAsync] 🔍 Controllo tipo prodotto', {
        beerName: bottle.beerName,
        productType: productType.type,
        confidence: productType.confidence,
        readingNotes: bottle.readingNotes?.substring(0, 100)
      });

      // Se NON è birra, blocca immediatamente
      if (productType.type !== 'beer') {
        logger.warn('[analyzeImageAsync] 🚫 PRODOTTO NON-BIRRA RILEVATO - Blocco elaborazione', {
          detectedName: productType.detectedName,
          displayType: productType.displayType,
          reason: productType.reason,
          confidence: productType.confidence,
          sessionId: req.sessionID,
          userId: req.user?._id
        });

        // Messaggio errore personalizzato
        const productName = productType.detectedName;
        const displayType = productType.displayType;
        let errorMessage;
        
        if (productName && productName !== 'Prodotto sconosciuto' && productName.toLowerCase() !== 'sconosciuto') {
          errorMessage = `Il prodotto rilevato nell'immagine ("${productName}") è un ${displayType}, ma questa applicazione è dedicata esclusivamente alle birre.`;
        } else {
          errorMessage = `Il prodotto rilevato nell'immagine sembra essere un ${displayType}, ma questa applicazione è dedicata esclusivamente alle birre.`;
        }

        return res.status(200).json({
          success: false,
          message: errorMessage,
          errorType: 'NON_BEER_DETECTED',
          blocked: true,
          productInfo: {
            detectedName: productName || 'Prodotto non identificato',
            productType: productType.type,
            displayType: displayType,
            reason: productType.reason,
            confidence: productType.confidence,
            suggestedApp: productType.suggestedApp
          },
          bottles: []
        });
      }
    }

    logger.info('[analyzeImageAsync] ✅ Tutti i prodotti verificati come birra - Continua elaborazione');

    // 4. Mappa i dati delle bottiglie nel formato richiesto per frontend
    const mappedBottles = aiResult.bottles.map((bottle, index) => ({
      // ⚠️ Nome birra dall'etichetta
      beerName: bottle.labelData?.beerName || bottle.beerName || 'Nome sconosciuto',
      
      // 🔥 FIX 21 DIC 2025: Includi breweryName estratto dall'AI se presente
      // L'AI ora estrae separatamente beerName e breweryName dall'etichetta
      breweryName: bottle.labelData?.breweryName || bottle.breweryName || null,
      
      // Altri dati opzionali dall'etichetta (se presenti)
      alcoholContent: bottle.labelData?.alcoholContent || bottle.alcoholContent || null,
      volume: bottle.labelData?.volume || bottle.volume || null,
      beerStyle: bottle.labelData?.beerStyle || bottle.beerStyle || null,
      year: bottle.labelData?.year || bottle.year || null,
      location: bottle.labelData?.location || bottle.location || null,
      otherText: bottle.labelData?.otherText || bottle.otherText || null,
      
      // Mantieni anche i dati AI originali
      labelData: bottle.labelData,
      searchQueries: bottle.searchQueries || bottle.searchVariants, // searchVariants è il nuovo nome
      extractionConfidence: bottle.extractionConfidence || bottle.confidence,
      stylisticElements: bottle.stylisticElements || bottle.readingNotes,
      dataSource: bottle.dataSource || 'label_only',
      
      // Metadati utili
      bottleIndex: index,
      originalId: bottle.id
    }));

    // 🔥 LOG DEBUG: Verifica che breweryName venga passato
    if (mappedBottles.length > 0 && mappedBottles[0].breweryName) {
      logger.info(`🎯 [analyzeImageAsync] breweryName estratto dall'AI: "${mappedBottles[0].breweryName}"`);
    }

    // 🛡️ VALIDAZIONE LIMITE BOTTIGLIE: Max 5 bottiglie per foto
    if (mappedBottles.length > MAX_BOTTLES_PER_IMAGE) {
      logger.warn('[analyzeImageAsync] ⚠️ LIMITE SUPERATO - Troppe bottiglie nella foto', {
        detected: mappedBottles.length,
        maxAllowed: MAX_BOTTLES_PER_IMAGE,
        userId: req.user?._id?.toString(),
        sessionId: req.sessionID
      });

      return res.status(400).json({
        success: false,
        errorType: 'TOO_MANY_BOTTLES',
        message: `La foto contiene troppe bottiglie (${mappedBottles.length} rilevate)`,
        userMessage: `Per garantire una recensione accurata e dettagliata, puoi valutare al massimo ${MAX_BOTTLES_PER_IMAGE} birre per fotografia. La tua immagine ne contiene ${mappedBottles.length}. Ti suggeriamo di scattare più foto con meno bottiglie per volta.`,
        data: {
          detectedCount: mappedBottles.length,
          maxAllowed: MAX_BOTTLES_PER_IMAGE,
          suggestion: 'Scatta più foto separate con meno bottiglie ciascuna'
        }
      });
    }

    // 5. Prepara imageDataUrl per il frontend (con OTTIMIZZAZIONE)
    // 🖼️ FIX 18 GEN 2026: Downscale immagine a max 1080px e qualità 82% per ridurre dimensione DB
    const originalBase64 = `data:${mimeType};base64,${imageBuffer.toString('base64')}`;
    const originalSizeKB = getBase64SizeKB(originalBase64);
    
    let imageDataUrl = originalBase64;
    
    // Ottimizza solo se l'immagine è più grande di 200KB
    if (originalSizeKB > 200) {
      try {
        const optimizationResult = await optimizeBase64Image(originalBase64, {
          maxWidth: 1080,   // Perfetto per mobile/tablet senza sgranatura
          maxHeight: 1920,  // Per immagini portrait
          quality: 82       // Ottimo compromesso qualità/dimensione
        });
        imageDataUrl = optimizationResult.dataUrl;
        
        logger.info('🖼️ [analyzeImageAsync] Immagine OTTIMIZZATA per salvataggio', {
          originalSizeKB: optimizationResult.originalSizeKB,
          optimizedSizeKB: optimizationResult.optimizedSizeKB,
          reductionPercent: optimizationResult.reductionPercent + '%',
          savedKB: optimizationResult.originalSizeKB - optimizationResult.optimizedSizeKB
        });
      } catch (optError) {
        logger.warn('⚠️ [analyzeImageAsync] Errore ottimizzazione immagine, uso originale', {
          error: optError.message
        });
        // In caso di errore, usa l'immagine originale
      }
    } else {
      logger.info('🖼️ [analyzeImageAsync] Immagine già piccola, skip ottimizzazione', { sizeKB: originalSizeKB });
    }
    
    // 6. Memorizza dati temporanei in sessione per creazione Review successiva
    req.session.pendingReviewData = {
      bottles: mappedBottles,
      imageDataUrl,
      imageSize: imageFile.size,
      imageName: imageFile.originalname,
      aiAnalysisData: {
        totalBottles: aiResult.totalBottles,
        imageValidation: aiResult.imageValidation,
        confidence: aiResult.confidence,
        analysisDate: new Date()
      },
      userId: req.user?._id?.toString(),
      sessionId: req.sessionID,
      expiresAt: Date.now() + (30 * 60 * 1000) // Scade dopo 30 minuti
    };

    logger.info(`[analyzeImageAsync] 💾 Dati AI memorizzati in sessione (NON salvati in DB fino a conferma utente)`);

    // 7. Risposta immediata SENZA reviewId (non ancora creato) ma CON dati bottiglie per aprire modale modal
    return res.status(200).json({
      success: true,
      message: 'Analisi completata - compila le recensioni per confermare',
      async: true, // Flag per distinguere risposta asincrona
      data: {
        bottlesCount: mappedBottles.length,
        sessionStored: true // Indica che i dati sono in sessione
      },
      // 🔥 RITORNA I DATI DELLE BOTTIGLIE per aprire il modal recensioni
      bottles: mappedBottles.map(bottle => ({
        id: bottle.originalId || `bottle-${bottle.bottleIndex}`,
        beerName: bottle.beerName,
        breweryName: bottle.breweryName || 'Da determinare',
        alcoholContent: bottle.alcoholContent,
        volume: bottle.volume,
        beerStyle: bottle.beerStyle,
        thumbnail: imageDataUrl, // Usa l'immagine caricata come thumbnail
        dataSource: bottle.dataSource,
        confidence: bottle.extractionConfidence,
        labelData: bottle.labelData
      }))
    });

  } catch (error) {
    logger.error('[analyzeImageAsync] ❌ Errore:', error);
    return res.status(500).json({
      success: false,
      message: 'Errore durante l\'analisi dell\'immagine',
      error: error.message
    });
  }
};

/**
 * NUOVO: Crea Review E avvia job SOLO DOPO conferma utente
 * 
 * Questo endpoint viene chiamato quando l'utente conferma le recensioni compilate.
 * Solo a questo punto:
 * 1. Crea documento Review in DB
 * 2. Avvia job asincrono per arricchimento dati
 * 
 * Previene creazione Review "orfani" se utente chiude modal senza confermare.
 */
exports.confirmAndCreateReview = async (req, res) => {
  try {
    logger.info('[confirmAndCreateReview] 📝 Richiesta creazione Review dopo conferma utente');
    
    // 1. Recupera dati temporanei dalla sessione
    const pendingData = req.session.pendingReviewData;
    
    if (!pendingData) {
      logger.warn('[confirmAndCreateReview] ⚠️ Nessun dato pending in sessione');
      return res.status(400).json({
        success: false,
        message: 'Sessione scaduta o dati non trovati. Ricarica l\'immagine.'
      });
    }

    // 2. Verifica che i dati non siano scaduti (30 minuti)
    if (pendingData.expiresAt && Date.now() > pendingData.expiresAt) {
      logger.warn('[confirmAndCreateReview] ⏰ Dati sessione scaduti');
      delete req.session.pendingReviewData;
      return res.status(400).json({
        success: false,
        message: 'Sessione scaduta. Ricarica l\'immagine.'
      });
    }

    // 🛡️ 2.5 MODERAZIONE CONTENUTI PREVENTIVA (Soluzione B)
    // Valida PRIMA di creare Review - previene salvataggio contenuto inappropriato
    const { reviews } = req.body;
    if (reviews && Array.isArray(reviews) && reviews.length > 0) {
      const validationResult = ValidationService.validateReviewsInput({ 
        reviews, 
        aiAnalysisData: pendingData.aiAnalysisData 
      });
      
      if (!validationResult.isValid && validationResult.inappropriateContent) {
        logger.warn('[confirmAndCreateReview] 🛡️ Moderazione FALLITA - contenuto inappropriato rilevato', {
          userId: pendingData.userId,
          violations: validationResult.details,
          sessionMaintained: true
        });
        
        // ⚠️ MANTIENI sessione per permettere correzione e retry
        return res.status(400).json({
          error: 'Contenuto inappropriato rilevato',
          inappropriateContent: true,
          message: validationResult.message || 'Alcune recensioni contengono linguaggio inappropriato. Per favore, rivedi il contenuto ed evita parole volgari o offensive.',
          details: validationResult.details
        });
      }
      
      logger.info('[confirmAndCreateReview] ✅ Moderazione PASSATA - procedo con creazione Review');
    }

    // 📍 3. Recupera dati geolocalizzazione dal body (se disponibili)
    const locationData = req.body.locationData;
    let reviewLocation = null;
    
    if (locationData) {
      logger.info('[confirmAndCreateReview] 📍 Dati geolocalizzazione ricevuti:', {
        consentGiven: locationData.consentGiven,
        source: locationData.source,
        hasCoordinates: !!locationData.coordinates
      });
      
      // Valida e prepara i dati location per il Review
      if (locationData.consentGiven && locationData.coordinates) {
        reviewLocation = {
          coordinates: {
            latitude: locationData.coordinates.latitude,
            longitude: locationData.coordinates.longitude,
            accuracy: locationData.coordinates.accuracy,
            altitude: locationData.coordinates.altitude,
            altitudeAccuracy: locationData.coordinates.altitudeAccuracy,
            heading: locationData.coordinates.heading,
            speed: locationData.coordinates.speed
          },
          timestamp: locationData.timestamp ? new Date(locationData.timestamp) : new Date(),
          consentGiven: true,
          source: locationData.source || 'gps'
        };
        
        logger.info('[confirmAndCreateReview] 📍 ✅ Location validata e preparata per salvataggio');
      } else {
        logger.info('[confirmAndCreateReview] 📍 Consent negato o coordinate mancanti - location non salvata');
        reviewLocation = {
          consentGiven: false,
          source: 'none'
        };
      }
    } else {
      logger.info('[confirmAndCreateReview] 📍 Nessun dato geolocalizzazione nel payload');
    }

    // 4. Crea Review con TUTTI i dati AI estratti + location
    // 🖼️ FIX 18 GEN 2026: Immagine salvata SOLO in rawAiData.imageDataUrl (rimosso duplicato imageUrl)
    const imageSizeKB = getBase64SizeKB(pendingData.imageDataUrl);
    logger.info('💾 [confirmAndCreateReview] Salvataggio immagine UNICA in rawAiData', { imageSizeKB });
    
    const review = new Review({
      userId: pendingData.userId ? new mongoose.Types.ObjectId(pendingData.userId) : undefined,
      sessionId: pendingData.sessionId,
      // 🖼️ FIX 18 GEN 2026: imageUrl ora contiene un placeholder, l'immagine reale è in rawAiData
      imageUrl: 'stored_in_rawAiData',
      processingStatus: 'pending_validation',
      bottlesCount: pendingData.bottles.length,
      aiExtracted: true,
      
      // 📍 Aggiungi location se disponibile
      ...(reviewLocation && { location: reviewLocation }),
      
      // 🖼️ FIX 18 GEN 2026: Immagine salvata QUI come UNICA copia
      rawAiData: {
        bottles: pendingData.bottles,
        imageDataUrl: pendingData.imageDataUrl // 👈 UNICA copia dell'immagine
      },
      
      metadata: {
        uploadedAt: new Date(),
        imageSize: pendingData.imageSize,
        imageSizeKB: imageSizeKB, // 🆕 Dimensione in KB per monitoraggio
        imageName: pendingData.imageName,
        
        // Dati bottiglie dall'AI
        extractedBottles: pendingData.bottles.map(bottle => ({
          beerName: bottle.beerName,
          // 🔥 FIX 21 DIC 2025: Includi breweryName per consistenza con job data
          breweryName: bottle.breweryName || null,
          alcoholContent: bottle.alcoholContent,
          volume: bottle.volume,
          beerStyle: bottle.beerStyle,
          year: bottle.year,
          location: bottle.location,
          otherText: bottle.otherText,
          bottleIndex: bottle.bottleIndex,
          dataSource: bottle.dataSource,
          extractionConfidence: bottle.extractionConfidence
        })),
        
        // Dati tecnici AI (SENZA imageDataUrl duplicato)
        aiAnalysisData: {
          ...pendingData.aiAnalysisData,
          // Rimuovi imageDataUrl se presente in aiAnalysisData
          imageDataUrl: undefined
        }
      }
    });

    await review.save();
    
    logger.info(`[confirmAndCreateReview] 💾 Review creato DOPO conferma E moderazione: ${review._id}`, {
      hasLocation: !!reviewLocation,
      locationSource: reviewLocation?.source
    });

    // 5. Avvia job asincrono per arricchimento
    const jobData = {
      reviewId: review._id.toString(),
      bottles: pendingData.bottles,
      imageDataUrl: pendingData.imageDataUrl,
      userId: pendingData.userId,
      sessionId: pendingData.sessionId
    };

    const job = await addReviewProcessingJob(jobData);
    
    logger.info(`[confirmAndCreateReview] 🚀 Job asincrono avviato: ${job.id}`);

    // 6. ✅ Pulizia sessione DOPO creazione Review (moderazione già passata)
    delete req.session.pendingReviewData;
    logger.info('[confirmAndCreateReview] 🧹 Sessione pulita dopo creazione Review con moderazione passata');

    // 7. Risposta con reviewId per tracking
    return res.status(200).json({
      success: true,
      message: 'Review creato con successo',
      data: {
        reviewId: review._id.toString(),
        status: review.processingStatus,
        jobId: job.id,
        bottlesCount: pendingData.bottles.length,
        hasLocation: !!reviewLocation
      }
    });

  } catch (error) {
    logger.error('[confirmAndCreateReview] ❌ Errore:', error);
    return res.status(500).json({
      success: false,
      message: 'Errore durante la creazione della recensione',
      error: error.message
    });
  }
};

exports.getReviewStatus = async (req, res) => {
  try {
    const { reviewId } = req.params;
    if (!reviewId) {
      return res.status(400).json({ success: false, error: 'reviewId mancante' });
    }

    const review = await Review.findById(reviewId);
    if (!review) {
      return res.status(404).json({ success: false, error: 'Recensione non trovata' });
    }

    const response = {
      success: true,
      data: {
        reviewId: review._id.toString(),
        status: review.processingStatus || 'unknown',
        progress: review.processingProgress || 0,
        currentStep: review.currentStep || 'waiting',
        attempts: review.processingAttempts || 0,
        bottlesCount: review.bottlesCount || 0
      },
      // 🛑 FLAG CRITICO: Indica al frontend di fermare il polling
      completed: review.processingStatus === 'completed' || review.processingStatus === 'failed',
      shouldStopPolling: review.processingStatus === 'completed' || review.processingStatus === 'failed'
    };

    if (review.processingStatus === 'completed') {
      // 🎯 Aggiungi i dati AI recuperati dal metadata
      response.data.result = {
        bottlesCount: review.bottlesCount,
        completedAt: review.processingCompletedAt,
        // Includi i dati delle bottiglie processate
        bottles: review.metadata?.processedBottles || review.metadata?.bottles || []
      };
    } else if (review.processingStatus === 'failed') {
      response.data.error = review.processingError || 'Errore sconosciuto';
      response.data.failedAt = review.processingFailedAt;
    }

    return res.status(200).json(response);
  } catch (error) {
    logger.error('[getReviewStatus] Errore:', error);
    return res.status(500).json({ success: false, error: 'Errore recupero status', message: error.message });
  }
};

/**
 * GET TEST STATUS - Polling stato job test asincrono
 * Endpoint dedicato per controllare lo stato di un job test
 */
exports.getTestJobStatus = async (req, res) => {
  try {
    const { reviewId } = req.params;
    
    if (!reviewId) {
      return res.status(400).json({ 
        success: false, 
        test: true,
        error: 'reviewId mancante' 
      });
    }

    logger.info(`[getTestJobStatus] 📊 Controllo stato job test: ${reviewId}`);

    // Costruisci jobId come nel worker
    const jobId = `review-${reviewId}`;
    
    // Ottieni stato dal queue service
    const jobStatus = await getJobStatus(jobId);
    
    if (!jobStatus) {
      return res.status(404).json({ 
        success: false,
        test: true,
        error: 'Job non trovato',
        jobId: jobId
      });
    }

    // Mappa lo stato del job
    const response = {
      success: true,
      test: true,
      data: {
        reviewId: reviewId,
        jobId: jobId,
        status: jobStatus.status, // 'waiting', 'active', 'completed', 'failed'
        progress: jobStatus.progress?.percent || 0,
        currentStep: jobStatus.progress?.step || 'waiting',
        processedOn: jobStatus.processedOn,
        finishedOn: jobStatus.finishedOn
      }
    };

    // Se completato, includi i risultati
    if (jobStatus.status === 'completed' && jobStatus.result) {
      response.data.result = {
        bottlesProcessed: jobStatus.result.bottlesProcessed,
        processingTime: jobStatus.result.processingTime,
        dataSource: jobStatus.result.dataSource,
        bottles: jobStatus.result.bottles || [],
        summary: jobStatus.result.summary || {}
      };
      
      logger.info(`[getTestJobStatus] ✅ Job completato`, {
        reviewId,
        bottlesProcessed: response.data.result.bottlesProcessed,
        processingTime: response.data.result.processingTime
      });
    } else if (jobStatus.status === 'failed') {
      response.data.error = jobStatus.failedReason || 'Errore sconosciuto';
      response.data.failedAt = jobStatus.finishedOn;
      
      logger.error(`[getTestJobStatus] ❌ Job fallito`, {
        reviewId,
        error: response.data.error
      });
    } else {
      // Job ancora in elaborazione
      logger.info(`[getTestJobStatus] ⏳ Job in elaborazione`, {
        reviewId,
        status: jobStatus.status,
        progress: response.data.progress,
        step: response.data.currentStep
      });
    }

    return res.status(200).json(response);
    
  } catch (error) {
    logger.error('[getTestJobStatus] ❌ Errore:', error);
    return res.status(500).json({ 
      success: false,
      test: true,
      error: 'Errore recupero status test', 
      message: error.message 
    });
  }
};

/**
 * NUOVA createMultipleReviews con sistema asincrono (Punto 15)
 * 
 * Flusso:
 * 1. Valida input recensioni
 * 2. Salva recensione IMMEDIATA con stato "pending_validation"
 * 3. Avvia job asincrono per processing
 * 4. Ritorna SUBITO all'utente (non blocca)
 */
exports.createMultipleReviewsAsync = async (req, res) => {
  try {
    const { reviews, aiAnalysisData } = req.body;
    
    if (!reviews || !Array.isArray(reviews) || reviews.length === 0) {
      return res.status(400).json({ error: 'Nessuna recensione da salvare.' });
    }

    logger.info('[createMultipleReviewsAsync] 🚀 Creazione recensione asincrona (Punto 15)', {
      userId: req.user?._id,
      sessionId: req.sessionID,
      reviewsCount: reviews.length,
      hasAiData: !!aiAnalysisData
    });

    // 1. Validazione input (moderazione contenuti)
    // ⚠️ NOTA: Moderazione ora fatta in confirmAndCreateReview PRIMA della creazione Review
    // Questo endpoint è chiamato dopo, quindi la moderazione è già passata
    // Manteniamo validazione come doppio controllo sicurezza
    const validationResult = ValidationService.validateReviewsInput({ reviews, aiAnalysisData });
    
    if (!validationResult.isValid) {
      if (validationResult.inappropriateContent) {
        logger.error('[createMultipleReviewsAsync] ⚠️ ERRORE: Contenuto inappropriato rilevato DOPO creazione Review', {
          userId: req.user?._id,
          violations: validationResult.details,
          note: 'Questo NON dovrebbe accadere - moderazione già fatta in confirmAndCreateReview'
        });
        
        // Review già creato - situazione anomala
        return res.status(400).json({
          error: 'Contenuto inappropriato rilevato',
          inappropriateContent: true,
          details: validationResult.details,
          message: 'Errore di validazione tardiva. Contatta il supporto.'
        });
      }
      
      return res.status(400).json({
        error: validationResult.message,
        details: validationResult.details
      });
    }

    // ✅ Validazione doppio-controllo passata
    logger.info('[createMultipleReviewsAsync] ✅ Doppio controllo moderazione passato');

    const validatedReviews = validationResult.data.reviews;

    // 2. Crea array ratings dalle recensioni
    const ratingsArray = validatedReviews.map((review, index) => ({
      bottleLabel: review.beerName || `Bottiglia ${index + 1}`,
      bottleIndex: index, // ✅ FIX #8B: Aggiunto bottleIndex ai ratings iniziali (9 dic 2025)
      rating: review.rating || review.overallRating,
      notes: review.notes || review.tastingNotes,
      detailedRatings: {
        appearance: {
          rating: review.appearance || review.detailedRatings?.appearance?.rating,
          notes: review.appearanceNotes || review.detailedRatings?.appearance?.notes || ''
        },
        aroma: {
          rating: review.aroma || review.detailedRatings?.aroma?.rating,
          notes: review.aromaNotes || review.detailedRatings?.aroma?.notes || ''
        },
        taste: {
          rating: review.taste || review.detailedRatings?.taste?.rating,
          notes: review.tasteNotes || review.detailedRatings?.taste?.notes || ''
        },
        mouthfeel: {
          rating: review.mouthfeel || review.detailedRatings?.mouthfeel?.rating,
          notes: review.mouthfeelNotes || review.detailedRatings?.mouthfeel?.notes || ''
        }
      }
    }));

    // 3. SALVATAGGIO IMMEDIATO RECENSIONE (stato: pending_validation)
    // Questo è il cuore del Punto 15: salviamo PRIMA di processare
    // 🖼️ FIX 18 GEN 2026: Immagine salvata SOLO in rawAiData.imageDataUrl (rimosso duplicato imageUrl)
    const newReview = new Review({
      imageUrl: 'stored_in_rawAiData', // Placeholder - l'immagine vera è in rawAiData.imageDataUrl
      sessionId: req.sessionID,
      user: req.user?._id,
      deviceId: req.body.deviceId || req.sessionID,
      date: new Date(),
      ratings: ratingsArray,
      
      // PUNTO 15: Stati asincroni
      processingStatus: 'pending_validation', // Inizia come "da validare"
      processingAttempts: 0,
      
      // Salva dati grezzi AI per processing background
      rawAiData: {
        bottles: aiAnalysisData?.bottles || [],
        brewery: aiAnalysisData?.brewery || {},
        imageDataUrl: aiAnalysisData?.imageDataUrl
      },
      
      // Status legacy (per compatibilità)
      status: 'pending'
    });

    await newReview.save();

    logger.info('[createMultipleReviewsAsync] ✅ Recensione salvata (pending_validation)', {
      reviewId: newReview._id,
      userId: req.user?._id,
      ratingsCount: ratingsArray.length
    });

    // 4. AVVIA JOB ASINCRONO (non blocca la risposta)
    let jobId = null;
    let jobQueued = false;

    try {
      const job = await addReviewProcessingJob({
        reviewId: newReview._id.toString(),
        bottles: aiAnalysisData?.bottles || [],
        imageDataUrl: aiAnalysisData?.imageDataUrl,
        userId: req.user?._id?.toString(),
        priority: req.user ? 5 : 3 // Utenti registrati hanno priorità media
      });

      jobId = job.id;
      jobQueued = true;

      // Salva job ID nella recensione per tracking
      await Review.updateOne(
        { _id: newReview._id },
        { processingJobId: jobId }
      );

      logger.info('[createMultipleReviewsAsync] 📥 Job asincrono accodato', {
        reviewId: newReview._id,
        jobId: jobId
      });

    } catch (jobError) {
      // Errore job NON blocca il salvataggio recensione
      logger.error('[createMultipleReviewsAsync] ❌ Errore accodamento job (recensione salvata comunque)', {
        reviewId: newReview._id,
        error: jobError.message
      });
    }

    // 5. RISPOSTA IMMEDIATA ALL'UTENTE
    // L'utente NON aspetta il processing!
    return res.status(200).json({
      success: true,
      message: jobQueued 
        ? 'Grazie per la recensione! Stiamo elaborando i dati della birra...'
        : 'Grazie per la recensione! I dati saranno elaborati a breve.',
      review: {
        id: newReview._id,
        status: 'pending_validation',
        jobQueued: jobQueued,
        jobId: jobId,
        estimatedProcessingTime: '10-30 secondi'
      },
      // Per compatibilità con frontend esistente
      reviews: [newReview]
    });

  } catch (error) {
    logger.error('[createMultipleReviewsAsync] ❌ Errore fatale:', {
      error: error.message,
      stack: error.stack
    });

    return res.status(500).json({
      error: 'Errore durante il salvataggio della recensione',
      details: error.message
    });
  }
};

/**
 * API per controllare stato processing di una recensione
 * GET /api/review/:reviewId/status
 */
exports.getReviewProcessingStatus = async (req, res) => {
  try {
    const { reviewId } = req.params;

    // Query base per stato processing
    let review = await Review.findById(reviewId).select(
      'processingStatus processingJobId processingError processingAttempts completedAt ratings'
    );

    if (!review) {
      return res.status(404).json({ 
        success: false,
        error: 'Recensione non trovata' 
      });
    }

    let jobStatus = null;
    let currentStep = null;
    let progress = 0;

    if (review.processingJobId) {
      try {
        jobStatus = await getJobStatus(review.processingJobId);
        
        // Estrai currentStep e progress dal job
        if (jobStatus && typeof jobStatus._progress === 'object') {
          currentStep = jobStatus._progress.step;
          progress = jobStatus._progress.percent || 0;
        } else if (jobStatus && typeof jobStatus._progress === 'number') {
          progress = jobStatus._progress;
        }
        
      } catch (error) {
        logger.warn('Errore recupero stato job:', error);
      }
    }

    // Se completato, popola i riferimenti Brewery e Beer per il frontend
    let enrichedBottles = [];
    if (review.processingStatus === 'completed' && review.ratings && review.ratings.length > 0) {
      // Ri-fetch con populate per avere nomi birrificio e birra
      const populatedReview = await Review.findById(reviewId)
        .populate('ratings.brewery', 'breweryName breweryLogo')
        .populate('ratings.beer', 'beerName beerType alcoholContent')
        .lean();
      
      if (populatedReview && populatedReview.ratings) {
        enrichedBottles = populatedReview.ratings.map(rating => ({
          ...rating,
          // Aggiungi nomi espliciti per il frontend
          breweryName: rating.brewery?.breweryName || 'Birrificio sconosciuto',
          breweryLogo: rating.brewery?.breweryLogo || null,
          beerName: rating.beer?.beerName || rating.bottleLabel || 'Birra sconosciuta',
          beerType: rating.beer?.beerType || null,
          alcoholContent: rating.beer?.alcoholContent || null
        }));
        
        logger.info(`[getReviewProcessingStatus] 🏭 Popolati ${enrichedBottles.length} ratings con nomi:`, {
          bottles: enrichedBottles.map(b => ({ beerName: b.beerName, breweryName: b.breweryName }))
        });
      }
    }

    // Costruisci risposta con stato completo
    const responseData = {
      success: true,
      data: {
        reviewId: review._id,
        status: review.processingStatus,
        currentStep: currentStep || mapStatusToStep(review.processingStatus),
        progress: progress,
        attempts: review.processingAttempts,
        completedAt: review.completedAt,
        error: review.processingError,
        result: review.processingStatus === 'completed' ? {
          success: true,
          bottles: enrichedBottles.length > 0 ? enrichedBottles : (review.ratings || []),
          needsDisambiguation: false
        } : null
      }
    };

    return res.status(200).json(responseData);

  } catch (error) {
    logger.error('Errore getReviewProcessingStatus:', error);
    return res.status(500).json({ 
      success: false,
      error: 'Errore recupero stato' 
    });
  }
};

/**
 * Helper: mappa processingStatus a currentStep per UI
 */
function mapStatusToStep(status) {
  const mapping = {
    'pending': 'waiting',
    'queued': 'waiting',
    'processing': 'active',
    'completed': 'completed',
    'failed': 'failed',
    'needs_admin_review': 'validation'
  };
  return mapping[status] || 'active';
}

/**
 * API per statistiche code (solo admin)
 * GET /admin/api/queue/stats
 */
exports.getQueueStatistics = async (req, res) => {
  try {
    // Verifica permessi admin
    if (!req.user || !req.user.roles.includes('administrator')) {
      return res.status(403).json({ error: 'Accesso negato' });
    }

    const stats = await getQueueStats();

    return res.status(200).json({
      success: true,
      queue: 'review-processing',
      stats: stats,
      timestamp: new Date()
    });

  } catch (error) {
    logger.error('Errore getQueueStatistics:', error);
    return res.status(500).json({ error: 'Errore recupero statistiche' });
  }
};

/**
 * API per lista recensioni pending validation (admin)
 * GET /admin/api/reviews/pending-validation
 */
exports.getPendingValidationReviews = async (req, res) => {
  try {
    // Verifica permessi admin
    if (!req.user || !req.user.roles.includes('administrator')) {
      return res.status(403).json({ error: 'Accesso negato' });
    }

    const { page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

    const reviews = await Review.find({
      processingStatus: { $in: ['pending_validation', 'failed', 'needs_admin_review'] }
    })
      .populate('user', 'username email')
      .sort({ date: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Review.countDocuments({
      processingStatus: { $in: ['pending_validation', 'failed', 'needs_admin_review'] }
    });

    return res.status(200).json({
      success: true,
      reviews: reviews,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    logger.error('Errore getPendingValidationReviews:', error);
    return res.status(500).json({ error: 'Errore recupero recensioni' });
  }
};

/**
 * TEST: Analisi immagine con sistema asincrono SENZA salvataggio database
 * 
 * Stesso flusso di analyzeImageAsync ma:
 * - NON crea recensione nel database
 * - Avvia job asincrono con flag isTest: true
 * - Worker riconosce flag e NON salva nulla
 * - Ritorna jobId per polling dello stato
 * 
 * Parametri query:
 * - useRealServices: true/false - Se usare servizi reali (web search/scraping) invece di simulazione
 */
exports.testAnalyzeImageAsync = async (req, res) => {
  try {
    // Leggi parametro useRealServices dalla query string
    const useRealServices = req.query.useRealServices === 'true' || req.body.useRealServices === true;
    
    logger.info('[testAnalyzeImageAsync] 🧪 TEST: Richiesta analisi immagine asincrona (NO DB write)', {
      useRealServices: useRealServices
    });

    // 1. Verifica presenza immagine
    if (!req.file && !req.files) {
      return res.status(400).json({
        success: false,
        test: true,
        message: 'Nessuna immagine caricata'
      });
    }

    const imageFile = req.file || req.files[0];
    const imageBuffer = imageFile.buffer;
    const mimeType = imageFile.mimetype;

    logger.info(`[testAnalyzeImageAsync] 📊 TEST: Immagine ricevuta: ${imageFile.originalname} (${imageFile.size} bytes)`);

    // 2. Converti buffer in base64 per Gemini AI
    const imageBase64 = `data:${mimeType};base64,${imageBuffer.toString('base64')}`;

    // 3. Analisi AI immediata per estrarre dati etichetta
    const aiResult = await GeminiAI.validateImage(imageBase64);

    if (!aiResult.success || !aiResult.bottles || aiResult.bottles.length === 0) {
      return res.status(400).json({
        success: false,
        test: true,
        message: '🔍 Non abbiamo trovato bottiglie di birra in questa immagine. Prova a scattare una foto più ravvicinata dell\'etichetta o scegli un\'altra immagine con birre ben visibili.',
        errorType: 'NO_BEER_DETECTED'
      });
    }

    logger.info(`[testAnalyzeImageAsync] ✅ TEST: AI ha rilevato ${aiResult.bottles.length} bottiglia/e`);

    // 4. Mappa i dati delle bottiglie nel formato richiesto dal worker
    const mappedBottles = aiResult.bottles.map((bottle, index) => ({
      beerName: bottle.labelData?.beerName || bottle.beerName || 'Nome sconosciuto',
      breweryName: bottle.labelData?.breweryName || bottle.breweryName || 'Birrificio sconosciuto',
      alcoholContent: bottle.labelData?.alcoholContent || bottle.alcoholContent || null,
      volume: bottle.labelData?.volume || bottle.volume || null,
      beerStyle: bottle.labelData?.beerStyle || bottle.beerStyle || null,
      year: bottle.labelData?.year || bottle.year || null,
      location: bottle.labelData?.location || bottle.location || null,
      otherText: bottle.labelData?.otherText || bottle.otherText || null,

      // Mantieni anche i dati AI originali
      labelData: bottle.labelData,
      searchQueries: bottle.searchQueries,
      extractionConfidence: bottle.extractionConfidence,
      stylisticElements: bottle.stylisticElements,
      dataSource: bottle.dataSource || 'ai_analysis',

      // Metadati utili
      bottleIndex: index,
      originalId: bottle.id
    }));

    // 5. Prepara dati per job TEST (SENZA creare recensione)
    const imageDataUrl = `data:${mimeType};base64,${imageBuffer.toString('base64')}`;

    const jobData = {
      // Flag TEST - Worker riconoscerà e NON salverà nulla
      isTest: true,
      testMode: true,
      useRealServices: useRealServices, // Nuovo parametro per usare servizi reali

      // ReviewId fittizio per test mode (worker lo riconoscerà)
      reviewId: `test-review-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,

      // Dati immagine
      imageDataUrl: imageDataUrl,

      // Dati bottiglie mappate
      bottles: mappedBottles,

      // Metadati test
      testMetadata: {
        originalImageName: imageFile.originalname,
        imageSize: imageFile.size,
        mimeType: mimeType,
        aiBottlesDetected: aiResult.bottles.length,
        timestamp: new Date(),
        sessionId: req.sessionID,
        userId: req.user?._id || null,
        useRealServices: useRealServices
      }
    };

    // 6. Avvia job asincrono con flag TEST
    const job = await addReviewProcessingJob(jobData);

    logger.info(`[testAnalyzeImageAsync] 📋 TEST: Job asincrono avviato`, {
      jobId: job.id,
      bottlesCount: mappedBottles.length,
      isTest: true
    });

    // 7. 🚀 RISPOSTA IMMEDIATA ASINCRONA (come produzione)
    // Il frontend potrà fare polling su /review/:reviewId/status
    logger.info(`[testAnalyzeImageAsync] ✅ TEST: Risposta immediata, job in background`);

    const jobIdForPolling = `review-${jobData.reviewId}`;

    return res.status(200).json({
      success: true,
      test: true,
      message: useRealServices 
        ? '✅ TEST: Analisi asincrona con servizi reali avviata. ZERO scritture database. Usa reviewId per polling.'
        : '✅ TEST: Analisi asincrona simulata avviata. ZERO scritture database. Usa reviewId per polling.',
      data: {
        // ID per polling dello stato
        reviewId: jobData.reviewId,
        jobId: jobIdForPolling,
        
        // Stato iniziale
        status: 'processing',
        currentStep: 'ai-analysis',
        progress: 10,
        
        // Dati AI immediati (prima del processing completo)
        bottlesDetected: aiResult.bottles.length,
        initialBottles: mappedBottles.map(b => ({
          beerName: b.beerName,
          breweryName: b.breweryName,
          alcoholContent: b.alcoholContent,
          dataSource: 'ai_analysis'
        })),
        
        // Metadata
        estimatedTime: '10-30 secondi',
        pollingUrl: `/review/test-status/${jobData.reviewId}`,
        testMode: true,
        noDatabaseWrites: true,
        useRealServices: useRealServices,
        
        // Istruzioni polling
        polling: {
          url: `/review/test-status/${jobData.reviewId}`,
          intervalMs: 2000,
          description: 'Fai polling su questo endpoint ogni 2 secondi per ottenere lo stato aggiornato'
        }
      }
    });

  } catch (error) {
    logger.error('[testAnalyzeImageAsync] ❌ TEST: Errore fatale:', error);
    return res.status(500).json({
      success: false,
      test: true,
      message: 'Errore durante avvio analisi test asincrona',
      error: error.message
    });
  }
};

module.exports = {
  analyzeImageAsync: exports.analyzeImageAsync,
  confirmAndCreateReview: exports.confirmAndCreateReview, // FIX: Aggiunta funzione mancante
  testAnalyzeImageAsync: exports.testAnalyzeImageAsync,
  getReviewStatus: exports.getReviewStatus,
  getTestJobStatus: exports.getTestJobStatus, // NUOVO - polling test
  getPendingValidationReviews: exports.getPendingValidationReviews,
  getQueueStats: exports.getQueueStatistics
};
