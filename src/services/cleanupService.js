const logWithFileName = require('../utils/logger');
const logger = logWithFileName(__filename);

/**
 * Service per la pulizia automatica di dati temporanei e non risolti
 */
class CleanupService {
  
  /**
   * Pulisce i dati di sessione per ambiguità non risolte
   * @param {Object} session - Oggetto sessione Express
   * @returns {boolean} - True se è stata fatta pulizia
   */
  static cleanupUnresolvedSessionData(session) {
    try {
      if (!session.aiReviewData || !session.aiReviewData.data) {
        return false;
      }

      const sessionData = session.aiReviewData; // FIX: i flag sono direttamente in aiReviewData
      const now = new Date();
      const dataTimestamp = new Date(session.aiReviewData.timestamp);
      
      // Timeout differenziati per tipo di dati
      const generalTimeoutMs = 30 * 60 * 1000; // 30 minuti per dati generali
      const disambiguationTimeoutMs = 10 * 60 * 1000; // 10 minuti per disambiguazione
      
      const isGeneralExpired = (now - dataTimestamp) > generalTimeoutMs;
      const isDisambiguationExpired = (now - dataTimestamp) > disambiguationTimeoutMs;
      
      // Determina se pulire in base al tipo di dati
      let shouldClean = false;
      
      if (sessionData.needsDisambiguation && sessionData.tempData) {
        // Per dati di disambiguazione: pulisci dopo 10 minuti
        shouldClean = isDisambiguationExpired;
      } else if (sessionData.tempData) {
        // Per altri dati temporanei: pulisci dopo 30 minuti
        shouldClean = isGeneralExpired;
      }
      
      if (shouldClean) {        logger.info('[CleanupService] Pulizia dati di sessione scaduti', {
          sessionId: session.id,
          dataAge: Math.round((now - dataTimestamp) / 1000 / 60), // minuti
          needsDisambiguation: sessionData.needsDisambiguation,
          tempData: sessionData.tempData,
          processed: sessionData.processed
        });

        // Rimuovi i dati dalla sessione
        delete session.aiReviewData;
        return true;
      }
      
      return false;
    } catch (error) {
      logger.error('[CleanupService] Errore durante cleanup sessione', {
        error: error.message,
        sessionId: session.id
      });
      return false;
    }
  }

  /**
   * Middleware per pulizia automatica ad ogni richiesta
   */
  static middleware() {
    return (req, res, next) => {
      // Esegui cleanup se necessario
      if (req.session) {
        CleanupService.cleanupUnresolvedSessionData(req.session);
      }
      next();
    };
  }

  /**
   * Pulisce tutti i dati temporanei per una sessione specifica
   * @param {Object} session - Oggetto sessione Express
   */
  static forceCleanSession(session) {
    try {
      if (session.aiReviewData) {
        logger.info('[CleanupService] Pulizia forzata sessione', {
          sessionId: session.id
        });
        delete session.aiReviewData;
        
        // Pulisci anche eventuali dati immagine
        if (session.aiImageData) {
          delete session.aiImageData;
        }
      }
    } catch (error) {
      logger.error('[CleanupService] Errore durante pulizia forzata', {
        error: error.message,
        sessionId: session.id
      });
    }
  }

  /**
   * Verifica se i dati di sessione necessitano di cleanup
   * @param {Object} session - Oggetto sessione Express
   * @returns {Object} - Informazioni sullo stato dei dati
   */
  static getSessionDataStatus(session) {
    if (!session.aiReviewData || !session.aiReviewData.data) {
      return { hasData: false };
    }

    const sessionData = session.aiReviewData.data;
    const now = new Date();
    const dataTimestamp = new Date(session.aiReviewData.timestamp);
    const ageMinutes = Math.round((now - dataTimestamp) / 1000 / 60);
    
    return {
      hasData: true,
      tempData: sessionData.tempData || false,
      processed: sessionData.processed || false,
      needsDisambiguation: sessionData.needsDisambiguation || false,
      ageMinutes: ageMinutes,
      shouldCleanup: sessionData.tempData && !sessionData.processed && ageMinutes > 30
    };
  }
}

module.exports = CleanupService;
