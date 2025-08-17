const Review = require('../models/Review');
const Brewery = require('../models/Brewery');
const User = require('../models/User');
const path = require('path');
const fs = require('fs');
const GeminiAI = require('../utils/geminiAi');
const logWithFileName = require('../utils/logger');
const ErrorHandler = require('../utils/errorHandler');
const ValidationService = require('../utils/validationService');
const logger = logWithFileName(__filename);

// Import dei nuovi services
const ReviewService = require('../services/reviewService');
const AIService = require('../services/aiService');

// Validazione AI primo livello (immagine)
exports.firstCheckAI = ErrorHandler.asyncWrapper(async (req, res) => {
  // Validazione input con il nuovo sistema
  const validationResult = ValidationService.validateAiInput(req.body);
  if (!validationResult.isValid) {
    const error = ErrorHandler.createHttpError(400, validationResult.message, validationResult.message);
    error.validationDetails = validationResult.details;
    throw error;
  }

  logger.info('[firstCheckAI] Avvio analisi AI', {
    sessionId: req.sessionID,
    imageSize: validationResult.data.imageBuffer.length
  });

  // Usa AIService per processare l'immagine
  const result = await AIService.processImageAnalysis(
    validationResult.data.imageBuffer,
    req.session,
    req.user?._id
  );

  logger.info('[firstCheckAI] Analisi completata con successo', {
    sessionId: req.sessionID,
    bottlesFound: result.metadata.bottlesFound,
    breweryFound: !!result.data.brewery
  });

  logger.info('[firstCheckAI] Dati AI salvati in sessione', {
    sessionId: req.sessionID,
    bottlesCount: result.data.bottles?.length || 0
  });

  res.json(result);
});

// Crea multiple recensioni da interfaccia AI
exports.createMultipleReviews = ErrorHandler.asyncWrapper(async (req, res) => {
  // Validazione input con il nuovo sistema
  const validationResult = ValidationService.validateReviewsInput(req.body);
  if (!validationResult.isValid) {
    logger.error('[createMultipleReviews] Errore di validazione', {
      message: validationResult.message,
      details: validationResult.details,
      sessionId: req.sessionID
    });
    const error = ErrorHandler.createHttpError(400, validationResult.message, validationResult.message);
    error.validationDetails = validationResult.details;
    throw error;
  }

  // Delega al service layer
  const result = await ReviewService.createMultipleReviews(
    validationResult.data,
    req.user,
    req.sessionID
  );

  res.status(201).json(result);
});

/**
 * Recupera i dati AI dalla sessione se presenti
 */
exports.getAiDataFromSession = ErrorHandler.asyncWrapper(async (req, res) => {
  const aiData = AIService.getAnalysisFromSession(req.session);
  
  if (!aiData) {
    logger.info('[getAiDataFromSession] Nessun dato AI in sessione o già completato', {
      sessionId: req.sessionID,
      hasData: false
    });
    return res.json({ hasData: false });
  }
  
  logger.info('[getAiDataFromSession] Dati AI recuperati dalla sessione', {
    sessionId: req.sessionID,
    timestamp: aiData.timestamp,
    bottlesCount: aiData.bottles?.length || 0
  });

  // Prepara dati per frontend
  const frontendData = AIService.prepareDataForFrontend(aiData);

  res.json({
    hasData: true,
    data: frontendData
  });
});

/**
 * Rimuove i dati AI dalla sessione
 */
exports.clearAiDataFromSession = ErrorHandler.asyncWrapper(async (req, res) => {
  AIService.clearAnalysisFromSession(req.session);
  
  logger.info('[clearAiDataFromSession] Dati AI rimossi dalla sessione', {
    sessionId: req.sessionID
  });

  res.json({
    success: true,
    message: 'Dati AI rimossi dalla sessione'
  });
});

/**
 * Ottieni recensioni utente con paginazione
 */
exports.getUserReviews = ErrorHandler.asyncWrapper(async (req, res) => {
  const { page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;

  const result = await ReviewService.getUserReviews(req.user._id, {
    page: parseInt(page),
    limit: parseInt(limit),
    sortBy,
    sortOrder
  });

  res.json({
    success: true,
    data: result
  });
});

/**
 * Ottieni statistiche recensioni per birra
 */
exports.getBeerStats = ErrorHandler.asyncWrapper(async (req, res) => {
  const { beerId } = req.params;

  if (!beerId) {
    throw ErrorHandler.createHttpError(400, 'Beer ID richiesto', 'Beer ID is required');
  }

  const stats = await ReviewService.getBeerStats(beerId);

  res.json({
    success: true,
    data: stats
  });
});
