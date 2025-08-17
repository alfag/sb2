const GeminiAI = require('../utils/geminiAi');
const logWithFileName = require('../utils/logger');
const ErrorHandler = require('../utils/errorHandler');
const cacheService = require('../utils/cacheService');

const logger = logWithFileName(__filename);

/**
 * Service Layer per la gestione delle operazioni AI
 * Centralizza logica business per analisi AI
 */
class AIService {
  /**
   * Configura rate limiting per utente
   */
  static getUserRateLimit(userId) {
    return {
      maxRequests: 10, // Max 10 richieste
      windowMs: 60 * 60 * 1000, // Per ora
      keyGenerator: () => `ai_analysis:${userId}`
    };
  }

  /**
   * Controlla se utente può fare richieste AI
   */
  static canMakeRequest(session, userId = null) {
    const sessionKey = 'aiRequestCount';
    const requestCount = session[sessionKey] || 0;
    const maxRequests = userId ? 20 : 5; // Utenti registrati hanno più richieste

    if (requestCount >= maxRequests) {
      logger.warn('[AIService] Rate limit raggiunto', {
        sessionId: session.id,
        userId,
        requestCount,
        maxRequests
      });
      return false;
    }

    return true;
  }

  /**
   * Processo analisi immagine con caching
   */
  static async processImageAnalysis(imageBuffer, session, userId = null) {
    logger.info('[AIService] Avvio analisi immagine', {
      sessionId: session.id,
      userId,
      imageSize: imageBuffer.length
    });

    try {
      // Genera hash per cache
      const imageHash = this.generateImageHash(imageBuffer);
      
      // TEMPORANEO: Disabilita cache per debug
      logger.debug('[AIService] Cache temporaneamente disabilitata per debug');
      /*
      // Controlla cache AI
      const cachedResult = cacheService.getAI(imageHash);
      if (cachedResult) {
        logger.info('[AIService] Cache hit per analisi AI', {
          sessionId: session.id,
          userId,
          imageHash: imageHash.substring(0, 8) + '...',
          bottlesFound: cachedResult.bottles?.length || 0
        });
        
        // Salva risultato cached in sessione
        this.saveAnalysisToSession(session, cachedResult);
        return cachedResult;
      }
      */

      // Verifica dimensione immagine
      if (imageBuffer.length > 10 * 1024 * 1024) { // 10MB limit
        throw ErrorHandler.createHttpError(413, 
          'Immagine troppo grande', 
          'Image size exceeds 10MB limit'
        );
      }

      // Verifica formato (basic check)
      if (!this.isValidImageFormat(imageBuffer)) {
        throw ErrorHandler.createHttpError(400, 
          'Formato immagine non supportato', 
          'Only JPEG, PNG, WebP formats are supported'
        );
      }

      // Incrementa contatore richieste
      this.incrementRequestCount(session);

      // Esegui analisi AI
      logger.info('[AIService] Chiamata GeminiAI.validateImage', {
        sessionId: session.id,
        userId,
        imageSize: imageBuffer.length,
        hasGeminiAI: !!GeminiAI,
        hasValidateImageMethod: typeof GeminiAI.validateImage === 'function'
      });
      
      // Converti Buffer in base64 data URL per GeminiAI
      const base64Image = `data:image/jpeg;base64,${imageBuffer.toString('base64')}`;
      
      logger.debug('[AIService] Buffer convertito in base64', {
        sessionId: session.id,
        originalSize: imageBuffer.length,
        base64Size: base64Image.length
      });
      
      const analysisResult = await GeminiAI.validateImage(base64Image, null, userId, session.id);
      
      logger.info('[AIService] GeminiAI.validateImage completata', {
        sessionId: session.id,
        userId,
        resultType: typeof analysisResult,
        resultKeys: analysisResult ? Object.keys(analysisResult) : null,
        bottlesFound: analysisResult?.bottles?.length || 0
      });

      // Cache risultato per 1 ora - DISABILITATA per debug
      // cacheService.setAI(imageHash, analysisResult, 3600);

      // Salva risultati in sessione
      this.saveAnalysisToSession(session, analysisResult);

      logger.info('[AIService] Analisi completata e cached', {
        sessionId: session.id,
        userId,
        imageHash: imageHash.substring(0, 8) + '...',
        bottlesFound: analysisResult.bottles?.length || 0,
        breweryFound: !!analysisResult.brewery
      });

      return analysisResult;

    } catch (error) {
      logger.error('[AIService] Errore durante analisi', {
        sessionId: session.id,
        userId,
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Incrementa contatore richieste in sessione
   */
  static incrementRequestCount(session) {
    const sessionKey = 'aiRequestCount';
    session[sessionKey] = (session[sessionKey] || 0) + 1;
    
    logger.debug('[AIService] Request count incrementato', {
      sessionId: session.id,
      count: session[sessionKey]
    });
  }

  /**
   * Genera hash per identificare univocamente un'immagine
   */
  static generateImageHash(buffer) {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }

  /**
   * Verifica formato immagine valido
   */
  static isValidImageFormat(buffer) {
    // Check magic bytes per JPEG, PNG, WebP
    const jpegMagic = buffer.slice(0, 3).toString('hex') === 'ffd8ff';
    const pngMagic = buffer.slice(0, 8).toString('hex') === '89504e470d0a1a0a';
    const webpMagic = buffer.slice(8, 12).toString('ascii') === 'WEBP';

    return jpegMagic || pngMagic || webpMagic;
  }

  /**
   * Salva risultati analisi in sessione
   */
  static saveAnalysisToSession(session, analysisResult) {
    try {
      session.aiAnalysisData = {
        ...analysisResult,
        timestamp: new Date(),
        processed: true
      };

      logger.debug('[AIService] Risultati salvati in sessione', {
        sessionId: session.id,
        bottlesFound: analysisResult.bottles?.length || 0,
        breweryFound: !!analysisResult.brewery
      });

    } catch (error) {
      logger.error('[AIService] Errore salvataggio in sessione', {
        sessionId: session.id,
        error: error.message
      });
    }
  }

  /**
   * Recupera dati AI dalla sessione
   */
  static getAiDataFromSession(session) {
    try {
      const data = session.aiAnalysisData;
      
      if (!data) {
        logger.debug('[AIService] Nessun dato AI in sessione', {
          sessionId: session.id
        });
        return null;
      }

      // Controlla se i dati sono troppo vecchi (2 minuti per debug)
      const dataAge = Date.now() - new Date(data.timestamp).getTime();
      const maxAge = 2 * 60 * 1000; // 2 minuti per debug

      if (dataAge > maxAge) {
        logger.debug('[AIService] Dati AI in sessione scaduti', {
          sessionId: session.id,
          ageMinutes: Math.round(dataAge / 60000)
        });
        delete session.aiAnalysisData;
        return null;
      }

      return data;

    } catch (error) {
      logger.error('[AIService] Errore recupero dati da sessione', {
        sessionId: session.id,
        error: error.message
      });
      return null;
    }
  }

  /**
   * Pulisce dati AI dalla sessione
   */
  static clearAiDataFromSession(session) {
    try {
      const hadData = !!session.aiAnalysisData;
      delete session.aiAnalysisData;
      
      logger.debug('[AIService] Dati AI rimossi da sessione', {
        sessionId: session.id,
        hadData
      });

      return { success: true, hadData };

    } catch (error) {
      logger.error('[AIService] Errore pulizia dati da sessione', {
        sessionId: session.id,
        error: error.message
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Valida i dati dell'analisi AI
   */
  static validateAnalysisData(analysisData) {
    const errors = [];

    if (!analysisData) {
      errors.push('Dati analisi mancanti');
      return { isValid: false, errors };
    }

    if (!analysisData.bottles || !Array.isArray(analysisData.bottles)) {
      errors.push('Lista bottiglie mancante o non valida');
    } else if (analysisData.bottles.length === 0) {
      errors.push('Nessuna bottiglia trovata nell\'immagine');
    }

    if (!analysisData.brewery || !analysisData.brewery.name) {
      errors.push('Informazioni brewery mancanti');
    }

    // Valida ogni bottiglia
    analysisData.bottles?.forEach((bottle, index) => {
      if (!bottle.name || bottle.name.trim().length < 2) {
        errors.push(`Bottiglia ${index + 1}: nome mancante o troppo corto`);
      }
      
      if (!bottle.style || bottle.style.trim().length < 2) {
        errors.push(`Bottiglia ${index + 1}: stile mancante`);
      }

      if (bottle.abv !== undefined && (isNaN(bottle.abv) || bottle.abv < 0 || bottle.abv > 100)) {
        errors.push(`Bottiglia ${index + 1}: ABV non valido`);
      }

      if (bottle.ibu !== undefined && (isNaN(bottle.ibu) || bottle.ibu < 0 || bottle.ibu > 300)) {
        errors.push(`Bottiglia ${index + 1}: IBU non valido`);
      }
    });

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Prepara dati per creazione recensioni
   */
  static prepareReviewData(analysisData, additionalData = {}) {
    if (!analysisData || !analysisData.bottles) {
      throw ErrorHandler.createHttpError(400, 
        'Dati analisi non validi', 
        'Invalid analysis data for review preparation'
      );
    }

    return {
      brewery: analysisData.brewery,
      bottles: analysisData.bottles.map(bottle => ({
        ...bottle,
        ...additionalData[bottle.name] || {}
      })),
      timestamp: new Date(),
      source: 'ai_analysis'
    };
  }
}

module.exports = AIService;
