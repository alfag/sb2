/**
 * Rotte per AI Verification System
 * Integrazione completa del sistema anti-allucinazioni
 */

const express = require('express');
const router = express.Router();
const aiValidationService = require('../services/aiValidationService');
const userConfirmationController = require('../controllers/userConfirmationController');
const { isAuthenticated } = require('../middlewares/authMiddleware');
const RateLimitService = require('../utils/rateLimitService');
const logWithFileName = require('../utils/logger');
const logger = logWithFileName(__filename);

// Middleware per gestire sia utenti autenticati che guest
const allowGuestAccess = (req, res, next) => {
  // Per utenti autenticati, continua normalmente
  if (req.isAuthenticated()) {
    return next();
  }
  
  // Per utenti guest, imposta un ID sessione come identificativo
  req.guestId = req.sessionID;
  req.isGuest = true;
  
  // Log per guest access
  logger.info(`Accesso guest al sistema AI - SessionID: ${req.sessionID}`);
  
  next();
};

/**
 * GET /review/verify-ai-analysis
 * Mostra interfaccia di verifica per risultati AI (supporta sia utenti autenticati che guest)
 */
router.get('/verify-ai-analysis', allowGuestAccess, async function(req, res) {
  try {
    const userIdentifier = req.isGuest ? `Guest-${req.sessionID}` : req.user._id;
    logger.info(`Accesso interfaccia verifica AI - Utente: ${userIdentifier} (Guest: ${req.isGuest || false})`);

    // Recupera dati di validazione dalla sessione
    const validationResult = req.session.aiValidationResult;
    const sessionData = req.session.aiAnalysisData;

    if (!validationResult || !sessionData) {
      req.flash('error', 'Nessun dato di analisi AI disponibile. Riprova l\'upload.');
      return res.redirect('/');
    }

    // Prepara dati per il template
    const templateData = {
      title: 'Verifica Analisi AI',
      validation: validationResult,
      sessionData: sessionData,
      user: req.user || null,
      isGuest: req.isGuest || false,
      guestId: req.guestId || null,
      csrfToken: req.csrfToken && req.csrfToken()
    };

    res.render('review/aiVerification', templateData);

  } catch (error) {
    logger.error(`Errore caricamento interfaccia verifica: ${error.message}`);
    req.flash('error', 'Errore nel caricamento dell\'interfaccia di verifica.');
    res.redirect('/');
  }
});

/**
 * POST /review/confirm-ai-analysis
 * Elabora conferme utente e salva dati verificati (supporta sia utenti autenticati che guest)
 */
router.post('/confirm-ai-analysis', 
  allowGuestAccess,
  RateLimitService.createAILimiter(),
  async (req, res) => {
    try {
      const userIdentifier = req.isGuest ? `Guest-${req.sessionID}` : req.user._id;
      logger.info(`Conferma analisi AI - Utente: ${userIdentifier} (Guest: ${req.isGuest || false})`);

      const { confirmVerified, userCompletions } = req.body;
      const validationResult = req.session.aiValidationResult;
      const sessionData = req.session.aiAnalysisData;

      // Validazione dati richiesti
      if (!validationResult || !sessionData) {
        return res.status(400).json({
          success: false,
          message: 'Dati di sessione non validi. Riprova l\'analisi.'
        });
      }

      // Per guest users, usa null come user e passa guestId
      const userParam = req.isGuest ? null : req.user;
      const guestInfo = req.isGuest ? { guestId: req.guestId, sessionId: req.sessionID } : null;

      // Elabora conferma tramite controller dedicato
      const result = await userConfirmationController.processUserConfirmation(
        userParam,
        validationResult,
        sessionData,
        {
          confirmVerified: !!confirmVerified,
          userCompletions: userCompletions || [],
          guestInfo: guestInfo
        }
      );

      if (result.success) {
        // Pulisci dati di sessione
        delete req.session.aiValidationResult;
        delete req.session.aiAnalysisData;

        logger.info(`Conferma AI completata con successo - Utente: ${userIdentifier}`);

        const redirectUrl = req.isGuest ? '/' : (result.redirect || '/profile');

        return res.json({
          success: true,
          message: result.message,
          redirect: redirectUrl,
          savedData: result.data,
          isGuest: req.isGuest
        });

      } else {
        logger.warn(`Conferma AI fallita - Utente: ${userIdentifier} - Errore: ${result.message}`);

        return res.status(400).json({
          success: false,
          message: result.message
        });
      }

    } catch (error) {
      logger.error(`Errore elaborazione conferma AI: ${error.message}`);

      return res.status(500).json({
        success: false,
        message: 'Si è verificato un errore tecnico. Riprova.'
      });
    }
  }
);

/**
 * GET /review/api/suggestions
 * API per suggerimenti di completamento automatico (supporta guest)
 */
router.get('/api/suggestions', 
  allowGuestAccess,
  RateLimitService.createGeneralLimiter(),
  async (req, res) => {
    try {
      const { searchType, breweryName, beerName } = req.query;

      logger.info(`Ricerca suggerimenti - Tipo: ${searchType}, Brewery: ${breweryName}, Beer: ${beerName}`);

      const suggestions = await aiValidationService.searchSuggestions({
        type: searchType,
        breweryName: breweryName || '',
        beerName: beerName || ''
      });

      res.json({
        success: true,
        suggestions: suggestions,
        total: suggestions.length
      });

    } catch (error) {
      logger.error(`Errore ricerca suggerimenti: ${error.message}`);

      res.status(500).json({
        success: false,
        message: 'Errore nella ricerca suggerimenti',
        suggestions: []
      });
    }
  }
);

/**
 * POST /review/resolve-brewery-ambiguity
 * Risolve ambiguità nel riconoscimento birrifici (supporta guest)
 */
router.post('/resolve-brewery-ambiguity', 
  allowGuestAccess,
  RateLimitService.createAILimiter(),
  async (req, res) => {
    try {
      const { breweryId, userData } = req.body;
      const sessionData = req.session.aiAnalysisData;

      if (!sessionData) {
        return res.status(400).json({
          success: false,
          message: 'Sessione scaduta. Riprova l\'analisi.'
        });
      }

      const userIdentifier = req.isGuest ? `Guest-${req.sessionID}` : req.user._id;
      logger.info(`Risoluzione ambiguità birrificio - ID: ${breweryId} - Utente: ${userIdentifier} (Guest: ${req.isGuest || false})`);

      const userParam = req.isGuest ? null : req.user;
      const guestInfo = req.isGuest ? { guestId: req.guestId, sessionId: req.sessionID } : null;

      const result = await userConfirmationController.resolveBreweryAmbiguity(
        userParam,
        breweryId,
        userData,
        sessionData,
        { isGuest: req.isGuest, guestInfo }
      );

      res.json(result);

    } catch (error) {
      logger.error(`Errore risoluzione ambiguità: ${error.message}`);

      res.status(500).json({
        success: false,
        message: 'Errore nella risoluzione ambiguità'
      });
    }
  }
);

/**
 * GET /review/validation-status
 * Controllo stato validazione corrente (supporta guest)
 */
router.get('/validation-status', allowGuestAccess, (req, res) => {
  try {
    const validationResult = req.session.aiValidationResult;
    const sessionData = req.session.aiAnalysisData;

    res.json({
      hasValidation: !!validationResult,
      hasSessionData: !!sessionData,
      validation: validationResult || null,
      timestamp: sessionData?.timestamp || null
    });

  } catch (error) {
    logger.error(`Errore controllo stato validazione: ${error.message}`);

    res.status(500).json({
      hasValidation: false,
      error: 'Errore nel controllo dello stato'
    });
  }
});

/**
 * POST /review/clear-validation-session
 * Pulisce dati di validazione dalla sessione (supporta guest)
 */
router.post('/clear-validation-session', allowGuestAccess, (req, res) => {
  try {
    delete req.session.aiValidationResult;
    delete req.session.aiAnalysisData;

    const userIdentifier = req.isGuest ? `Guest-${req.sessionID}` : req.user._id;
    logger.info(`Sessione validazione pulita - Utente: ${userIdentifier} (Guest: ${req.isGuest || false})`);

    res.json({
      success: true,
      message: 'Sessione pulita con successo'
    });

  } catch (error) {
    logger.error(`Errore pulizia sessione: ${error.message}`);

    res.status(500).json({
      success: false,
      message: 'Errore nella pulizia della sessione'
    });
  }
});

/**
 * Middleware per logging dettagliato delle richieste AI
 */
router.use((req, res, next) => {
  const originalJson = res.json;
  res.json = function(data) {
    // Log delle risposte per monitoraggio
    if (req.path.includes('/confirm-ai-analysis') || req.path.includes('/resolve-brewery-ambiguity')) {
      const userIdentifier = req.isGuest ? `Guest-${req.sessionID}` : (req.user?._id || 'Unknown');
      const userType = req.isGuest ? '(Guest)' : '(Auth)';
      
      logger.info(`Risposta AI Verification - Path: ${req.path} - Success: ${data.success} - User: ${userIdentifier} ${userType}`);
      
      if (!data.success) {
        logger.warn(`AI Verification Error - Path: ${req.path} - Message: ${data.message} - User: ${userIdentifier} ${userType}`);
      }
    }
    
    return originalJson.call(this, data);
  };
  
  next();
});

/**
 * Error handler specifico per rotte AI verification
 */
router.use((error, req, res, next) => {
  logger.error(`Errore rotte AI Verification: ${error.message} - Stack: ${error.stack}`);

  // Se è una richiesta AJAX, restituisci JSON
  if (req.xhr || req.headers.accept?.indexOf('json') > -1) {
    return res.status(500).json({
      success: false,
      message: 'Si è verificato un errore del server',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal Server Error'
    });
  }

  // Altrimenti, redirect con messaggio di errore
  req.flash('error', 'Si è verificato un errore nel sistema di verifica AI. Riprova.');
  res.redirect('/review/create');
});

module.exports = router;