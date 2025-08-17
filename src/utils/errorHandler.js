const logWithFileName = require('./logger');
const logger = logWithFileName(__filename);

/**
 * Gestore centralizzato degli errori per l'applicazione
 * Fornisce una gestione uniforme di tutti i tipi di errore
 */
class ErrorHandler {
  /**
   * Middleware centralizzato per la gestione degli errori
   * @param {Error} err - L'errore da gestire
   * @param {Object} req - L'oggetto request di Express
   * @param {Object} res - L'oggetto response di Express
   * @param {Function} next - La funzione next di Express
   */
  static handle(err, req, res, next) {
    // Log dettagliato dell'errore
    logger.error('[ErrorHandler] Errore catturato', {
      error: err.message,
      stack: err.stack,
      url: req.url,
      method: req.method,
      userId: req.user?._id,
      sessionId: req.sessionID,
      userAgent: req.get('User-Agent'),
      timestamp: new Date().toISOString()
    });

    // Determina il tipo di errore e la risposta appropriata
    const errorResponse = this.categorizeError(err);

    // Se è una richiesta AJAX/API (header Content-Type application/json o Accept application/json)
    if (this.isApiRequest(req)) {
      return res.status(errorResponse.statusCode).json({
        success: false,
        error: errorResponse.message,
        ...(process.env.NODE_ENV === 'development' && { 
          details: err.message,
          stack: err.stack 
        })
      });
    }

    // Per richieste web normali
    req.flash('error', errorResponse.userMessage);
    
    if (process.env.NODE_ENV === 'development') {
      // In sviluppo, mostra errore dettagliato
      return res.status(errorResponse.statusCode).render('error.njk', {
        title: 'Errore del Server',
        error: {
          message: err.message,
          stack: err.stack,
          statusCode: errorResponse.statusCode
        }
      });
    } else {
      // In produzione, redirect con messaggio flash
      const redirectUrl = req.headers.referer || '/';
      return res.status(errorResponse.statusCode).redirect(redirectUrl);
    }
  }

  /**
   * Categorizza l'errore e determina la risposta appropriata
   * @param {Error} err - L'errore da categorizzare
   * @returns {Object} - Oggetto con statusCode, message e userMessage
   */
  static categorizeError(err) {
    // Errori di validazione Mongoose
    if (err.name === 'ValidationError') {
      return {
        statusCode: 400,
        message: 'Dati non validi',
        userMessage: 'I dati forniti non sono validi. Controlla i campi e riprova.',
        details: Object.values(err.errors).map(e => e.message)
      };
    }

    // Errori di cast Mongoose (ID non validi)
    if (err.name === 'CastError') {
      return {
        statusCode: 400,
        message: 'ID non valido',
        userMessage: 'L\'identificativo fornito non è valido.'
      };
    }

    // Errori di duplicati MongoDB
    if (err.code === 11000) {
      const field = Object.keys(err.keyPattern)[0];
      return {
        statusCode: 409,
        message: 'Risorsa già esistente',
        userMessage: `Il valore per il campo "${field}" è già in uso.`
      };
    }

    // Errori di JWT
    if (err.name === 'JsonWebTokenError') {
      return {
        statusCode: 401,
        message: 'Token non valido',
        userMessage: 'Sessione non valida. Effettua nuovamente il login.'
      };
    }

    if (err.name === 'TokenExpiredError') {
      return {
        statusCode: 401,
        message: 'Token scaduto',
        userMessage: 'Sessione scaduta. Effettua nuovamente il login.'
      };
    }

    // Errori HTTP personalizzati
    if (err.statusCode) {
      return {
        statusCode: err.statusCode,
        message: err.message,
        userMessage: err.userMessage || this.getDefaultUserMessage(err.statusCode)
      };
    }

    // Errore generico del server
    return {
      statusCode: 500,
      message: 'Errore interno del server',
      userMessage: 'Si è verificato un errore interno. Riprova più tardi.'
    };
  }

  /**
   * Determina se la richiesta è una chiamata API
   * @param {Object} req - L'oggetto request di Express
   * @returns {boolean} - True se è una richiesta API
   */
  static isApiRequest(req) {
    return (
      req.xhr ||
      req.headers.accept?.includes('application/json') ||
      req.headers['content-type']?.includes('application/json') ||
      req.url.startsWith('/api/')
    );
  }

  /**
   * Ottiene un messaggio utente di default basato sul codice di stato
   * @param {number} statusCode - Il codice di stato HTTP
   * @returns {string} - Il messaggio utente appropriato
   */
  static getDefaultUserMessage(statusCode) {
    switch (statusCode) {
      case 400:
        return 'Richiesta non valida. Controlla i dati inseriti.';
      case 401:
        return 'Accesso non autorizzato. Effettua il login.';
      case 403:
        return 'Non hai i permessi per eseguire questa operazione.';
      case 404:
        return 'Risorsa non trovata.';
      case 409:
        return 'Conflitto: la risorsa esiste già.';
      case 429:
        return 'Troppe richieste. Riprova più tardi.';
      case 500:
      default:
        return 'Si è verificato un errore interno. Riprova più tardi.';
    }
  }

  /**
   * Crea un errore HTTP personalizzato
   * @param {number} statusCode - Il codice di stato HTTP
   * @param {string} message - Il messaggio tecnico dell'errore
   * @param {string} userMessage - Il messaggio da mostrare all'utente
   * @returns {Error} - L'errore personalizzato
   */
  static createHttpError(statusCode, message, userMessage = null) {
    const error = new Error(message);
    error.statusCode = statusCode;
    error.userMessage = userMessage || this.getDefaultUserMessage(statusCode);
    return error;
  }

  /**
   * Wrapper per gestire errori asincroni nei controller
   * @param {Function} fn - La funzione asincrona da wrappare
   * @returns {Function} - La funzione wrappata che cattura gli errori
   */
  static asyncWrapper(fn) {
    return (req, res, next) => {
      Promise.resolve(fn(req, res, next)).catch(next);
    };
  }
}

module.exports = ErrorHandler;
