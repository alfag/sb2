const ValidationService = require('../utils/validationService');
const logWithFileName = require('../utils/logger');
const logger = logWithFileName(__filename);

/**
 * Middleware per la moderazione dei contenuti
 * Controlla il linguaggio inappropriato nei campi di testo delle richieste
 */

/**
 * Middleware per controllare contenuti inappropriati nelle recensioni
 */
exports.moderateReviewContent = (req, res, next) => {
  try {
    const { reviews } = req.body;
    
    if (!reviews || !Array.isArray(reviews)) {
      return next(); // Se non ci sono recensioni, passa al prossimo middleware
    }

    logger.info('[ContentModeration] Controllo moderazione contenuti recensioni', {
      userId: req.user?._id,
      sessionId: req.sessionID,
      reviewsCount: reviews.length
    });

    const inappropriateContentFound = [];
    
    // Controlla ogni recensione
    for (let i = 0; i < reviews.length; i++) {
      const review = reviews[i];
      const fieldsToCheckStrict = {};   // Notes - controllo strict
      const fieldsToCheckRelaxed = {};  // Nomi birra/birrificio - solo parole esplicite
      
      // 🔧 FIX FALSI POSITIVI: beerName e breweryName controllati SOLO per parole esplicite
      // (non per pattern come consonant_clustering o excessive_caps)
      if (review.beerName) fieldsToCheckRelaxed.beerName = review.beerName;
      if (review.breweryName) fieldsToCheckRelaxed.breweryName = review.breweryName;
      
      // Notes controllate con strict mode
      if (review.notes) fieldsToCheckStrict.notes = review.notes;
      
      // Controlla le note dettagliate con strict mode
      if (review.detailedRatings) {
        ['appearance', 'aroma', 'taste', 'mouthfeel', 'overall'].forEach(category => {
          if (review.detailedRatings[category]?.notes) {
            fieldsToCheckStrict[`detailedRatings.${category}.notes`] = review.detailedRatings[category].notes;
          }
        });
      }
      
      // Controllo campi strict (notes)
      if (Object.keys(fieldsToCheckStrict).length > 0) {
        const contentCheck = ValidationService.checkMultipleFieldsForInappropriateContent(fieldsToCheckStrict, {
          strict: true,
          context: `review_${i}`
        });
        
        if (!contentCheck.isClean) {
          inappropriateContentFound.push({
            reviewIndex: i,
            violations: contentCheck.violations,
            violatingFields: contentCheck.summary.violatingFields,
            totalViolations: contentCheck.summary.totalViolations
          });
        }
      }
      
      // 🔧 Controllo campi relaxed (beerName/breweryName) - SOLO parole esplicite inappropriate
      if (Object.keys(fieldsToCheckRelaxed).length > 0) {
        const contentCheckRelaxed = ValidationService.checkMultipleFieldsForInappropriateContent(fieldsToCheckRelaxed, {
          strict: false,  // NO pattern matching, solo parole esplicite
          context: `review_${i}_names`
        });
        
        // Per i nomi, blocca SOLO se ci sono violazioni HIGH severity (parole esplicite)
        const highSeverityViolations = contentCheckRelaxed.violations.filter(v => 
          v.violations && v.violations.some(viol => viol.severity === 'high')
        );
        
        if (highSeverityViolations.length > 0) {
          inappropriateContentFound.push({
            reviewIndex: i,
            violations: highSeverityViolations,
            violatingFields: highSeverityViolations.length,
            totalViolations: highSeverityViolations.reduce((sum, v) => sum + v.violations.length, 0)
          });
        }
      }
    }

    if (inappropriateContentFound.length > 0) {
      logger.warn('[ContentModeration] Contenuto inappropriato rilevato', {
        userId: req.user?._id,
        sessionId: req.sessionID,
        violatingReviews: inappropriateContentFound.length,
        totalViolations: inappropriateContentFound.reduce((sum, item) => sum + item.totalViolations, 0)
      });

      // 🔍 LOG DETTAGLIATO: Mostra campo e valore che hanno causato il blocco
      inappropriateContentFound.forEach((item, idx) => {
        logger.warn(`[ContentModeration] 🚫 DETTAGLIO VIOLAZIONE Recensione #${item.reviewIndex + 1}:`);
        if (item.violations && item.violations.length > 0) {
          item.violations.forEach((violation) => {
            logger.warn(`[ContentModeration] 📍 Campo: "${violation.field}" | Valore: "${violation.originalValue}" | Parole rilevate: "${violation.detectedWords}"`);
          });
        }
      });

      return res.status(400).json({
        error: 'Contenuto inappropriato rilevato',
        inappropriateContent: true,
        message: 'Alcune recensioni contengono linguaggio inappropriato. Per favore, rivedi il contenuto ed evita parole volgari o offensive.',
        details: inappropriateContentFound.map(item => ({
          reviewIndex: item.reviewIndex,
          violatingFields: item.violatingFields,
          message: `Recensione ${item.reviewIndex + 1}: linguaggio inappropriato rilevato in ${item.violatingFields} campo/i`
        }))
      });
    }

    logger.info('[ContentModeration] Controllo moderazione completato - nessun contenuto inappropriato', {
      userId: req.user?._id,
      sessionId: req.sessionID,
      reviewsChecked: reviews.length
    });

    next();
    
  } catch (error) {
    logger.error('[ContentModeration] Errore durante il controllo moderazione', {
      error: error.message,
      stack: error.stack,
      userId: req.user?._id,
      sessionId: req.sessionID
    });
    
    // SICUREZZA: In caso di errore, blocca la richiesta invece di permettere il passaggio
    return res.status(500).json({
      error: 'Errore durante il controllo di moderazione',
      message: 'Impossibile verificare il contenuto. Riprova più tardi.'
    });
  }
};

/**
 * Middleware generico per controllare contenuti inappropriati in campi specifici
 * @param {Array} fieldsToCheck - Array di nomi di campi da controllare nel req.body
 * @param {Object} options - Opzioni per la configurazione del controllo
 */
exports.moderateGenericContent = (fieldsToCheck = [], options = {}) => {
  return (req, res, next) => {
    try {
      const { strict = true } = options;
      const fieldsData = {};
      
      // Raccogli i campi da controllare
      for (const fieldName of fieldsToCheck) {
        const fieldValue = req.body[fieldName];
        if (fieldValue && typeof fieldValue === 'string') {
          fieldsData[fieldName] = fieldValue;
        }
      }
      
      if (Object.keys(fieldsData).length === 0) {
        return next(); // Nessun campo da controllare
      }

      logger.info('[ContentModeration] Controllo moderazione contenuti generici', {
        userId: req.user?._id,
        sessionId: req.sessionID,
        fieldsToCheck: Object.keys(fieldsData)
      });

      const contentCheck = ValidationService.checkMultipleFieldsForInappropriateContent(fieldsData, {
        strict: strict,
        context: 'generic_content'
      });
      
      if (!contentCheck.isClean) {
        logger.warn('[ContentModeration] Contenuto inappropriato rilevato nei campi generici', {
          userId: req.user?._id,
          sessionId: req.sessionID,
          violatingFields: contentCheck.summary.violatingFields,
          totalViolations: contentCheck.summary.totalViolations
        });

        return res.status(400).json({
          error: 'Contenuto inappropriato rilevato',
          inappropriateContent: true,
          message: 'Il contenuto inviato contiene linguaggio inappropriato. Per favore, rivedi il testo ed evita parole volgari o offensive.',
          details: contentCheck.violations.map(violation => ({
            field: violation.field,
            message: `Campo "${violation.field}": linguaggio inappropriato rilevato`
          }))
        });
      }

      logger.info('[ContentModeration] Controllo moderazione completato - nessun contenuto inappropriato', {
        userId: req.user?._id,
        sessionId: req.sessionID,
        fieldsChecked: Object.keys(fieldsData)
      });

      next();
      
    } catch (error) {
      logger.error('[ContentModeration] Errore durante il controllo moderazione generica', {
        error: error.message,
        userId: req.user?._id,
        sessionId: req.sessionID,
        fieldsToCheck: fieldsToCheck
      });
      
      // In caso di errore, permetti comunque il passaggio (fail-safe)
      next();
    }
  };
};

/**
 * Middleware per logging delle violazioni di contenuto (per statistiche)
 */
exports.logContentViolations = (req, res, next) => {
  const originalSend = res.send;
  
  res.send = function(data) {
    try {
      const responseData = typeof data === 'string' ? JSON.parse(data) : data;
      
      if (responseData && responseData.inappropriateContent) {
        logger.warn('[ContentModeration] Violazione contenuto registrata', {
          userId: req.user?._id,
          sessionId: req.sessionID,
          route: req.route?.path || req.path,
          method: req.method,
          userAgent: req.get('User-Agent'),
          ip: req.ip,
          violationDetails: responseData.details
        });
      }
    } catch (error) {
      // Ignora errori di parsing
    }
    
    originalSend.call(this, data);
  };
  
  next();
};

/**
 * Middleware per sanificazione automatica dei contenuti
 * Sanifica automaticamente i campi specificati senza bloccare la richiesta
 * @param {Array} fieldsToSanitize - Array di nomi di campi da sanificare nel req.body
 */
exports.sanitizeContent = (fieldsToSanitize = []) => {
  return (req, res, next) => {
    try {
      logger.debug('[ContentModeration] Sanificazione automatica contenuti', {
        userId: req.user?._id,
        sessionId: req.sessionID,
        fieldsToSanitize: fieldsToSanitize
      });

      for (const fieldName of fieldsToSanitize) {
        const fieldValue = req.body[fieldName];
        if (fieldValue && typeof fieldValue === 'string') {
          const sanitizedValue = ValidationService.sanitizeString(fieldValue);
          if (sanitizedValue !== fieldValue) {
            req.body[fieldName] = sanitizedValue;
            logger.info('[ContentModeration] Campo sanificato', {
              fieldName: fieldName,
              originalLength: fieldValue.length,
              sanitizedLength: sanitizedValue.length
            });
          }
        }
      }

      next();
      
    } catch (error) {
      logger.error('[ContentModeration] Errore durante la sanificazione', {
        error: error.message,
        fieldsToSanitize: fieldsToSanitize
      });
      
      // In caso di errore, permetti comunque il passaggio
      next();
    }
  };
};
