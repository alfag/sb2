const express = require('express');
const router = express.Router();
const ValidationService = require('../utils/validationService');
const { ensureRole } = require('../middlewares/authMiddleware');
const logWithFileName = require('../utils/logger');
const logger = logWithFileName(__filename);

/**
 * Rotte di test per la moderazione contenuti (solo admin)
 */

// Test singolo testo per moderazione
router.post('/test-content', ensureRole(['administrator']), (req, res) => {
  try {
    const { text, options = {} } = req.body;
    
    if (!text) {
      return res.status(400).json({ error: 'Testo richiesto per il test' });
    }

    logger.info('[ContentModerationTest] Test moderazione richiesto', {
      textLength: text.length,
      options: options,
      userId: req.user?._id
    });

    const result = ValidationService.checkInappropriateLanguage(text, {
      strict: true,
      ...options
    });

    return res.json({
      success: true,
      input: {
        text: text,
        length: text.length,
        options: options
      },
      result: {
        isClean: result.isClean,
        confidence: result.confidence,
        violations: result.violations,
        analysis: result.analysis,
        sanitizedText: result.sanitizedText
      }
    });

  } catch (error) {
    logger.error('[ContentModerationTest] Errore test moderazione', {
      error: error.message,
      userId: req.user?._id
    });
    return res.status(500).json({ error: 'Errore interno durante il test' });
  }
});

// Test validazione recensioni
router.post('/test-reviews', ensureRole(['administrator']), (req, res) => {
  try {
    const { reviews } = req.body;
    
    if (!reviews || !Array.isArray(reviews)) {
      return res.status(400).json({ error: 'Array di recensioni richiesto per il test' });
    }

    logger.info('[ContentModerationTest] Test validazione recensioni', {
      reviewsCount: reviews.length,
      userId: req.user?._id
    });

    const validationResult = ValidationService.validateReviewsInput({ reviews });

    return res.json({
      success: true,
      input: {
        reviewsCount: reviews.length,
        reviews: reviews
      },
      validationResult: validationResult
    });

  } catch (error) {
    logger.error('[ContentModerationTest] Errore test recensioni', {
      error: error.message,
      userId: req.user?._id
    });
    return res.status(500).json({ error: 'Errore interno durante il test recensioni' });
  }
});

// Test multipli campi
router.post('/test-fields', ensureRole(['administrator']), (req, res) => {
  try {
    const { fields, options = {} } = req.body;
    
    if (!fields || typeof fields !== 'object') {
      return res.status(400).json({ error: 'Oggetto fields richiesto per il test' });
    }

    logger.info('[ContentModerationTest] Test multipli campi', {
      fieldsCount: Object.keys(fields).length,
      fieldNames: Object.keys(fields),
      userId: req.user?._id
    });

    const result = ValidationService.checkMultipleFieldsForInappropriateContent(fields, {
      strict: true,
      ...options
    });

    return res.json({
      success: true,
      input: {
        fields: fields,
        options: options
      },
      result: result
    });

  } catch (error) {
    logger.error('[ContentModerationTest] Errore test multipli campi', {
      error: error.message,
      userId: req.user?._id
    });
    return res.status(500).json({ error: 'Errore interno durante il test campi' });
  }
});

// Pagina di test per amministratori
router.get('/test-page', ensureRole(['administrator']), (req, res) => {
  try {
    return res.render('admin/contentModerationTest.njk', {
      title: 'Test Moderazione Contenuti',
      user: req.user
    });
  } catch (error) {
    logger.error('[ContentModerationTest] Errore rendering pagina test', {
      error: error.message,
      userId: req.user?._id
    });
    return res.status(500).render('error.njk', { 
      error: 'Errore nel caricamento della pagina di test' 
    });
  }
});

// Statistiche sistema moderazione
router.get('/stats', ensureRole(['administrator']), (req, res) => {
  try {
    // Qui si potrebbero aggiungere statistiche dal database
    // per ora restituiamo info di base del sistema
    
    const stats = {
      systemInfo: {
        moderationEnabled: true,
        strictModeDefault: true,
        algorithmsUsed: [
          'pattern_recognition',
          'entropy_analysis',
          'caps_detection',
          'special_chars_analysis',
          'consonant_clustering'
        ]
      },
      configurationInfo: {
        maxViolationsBeforeBlock: 2,
        confidenceThreshold: 0.5,
        strictModeEnabled: true
      },
      testInfo: {
        message: 'Usa gli endpoint di test per verificare il sistema',
        endpoints: [
          'POST /content-moderation/test-content',
          'POST /content-moderation/test-reviews', 
          'POST /content-moderation/test-fields'
        ]
      }
    };

    return res.json({
      success: true,
      stats: stats,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('[ContentModerationTest] Errore recupero statistiche', {
      error: error.message,
      userId: req.user?._id
    });
    return res.status(500).json({ error: 'Errore nel recupero delle statistiche' });
  }
});

module.exports = router;
