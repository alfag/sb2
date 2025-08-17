const Joi = require('joi');
const ErrorHandler = require('./errorHandler');

/**
 * Sistema di validazione centralizzato per input dell'applicazione
 */
class ValidationService {
  /**
   * Valida i dati delle recensioni multiple
   * @param {Object} data - I dati da validare
   * @returns {Object} - Risultato della validazione
   */
  static validateReviewsInput(data) {
    const schema = Joi.object({
      reviews: Joi.array().items(
        Joi.object({
          beerName: Joi.string().min(1).max(200).required()
            .messages({
              'string.empty': 'Il nome della birra è obbligatorio',
              'string.max': 'Il nome della birra non può superare i 200 caratteri'
            }),
          rating: Joi.number().integer().min(1).max(5).required()
            .messages({
              'number.base': 'Il rating deve essere un numero',
              'number.min': 'Il rating deve essere almeno 1',
              'number.max': 'Il rating non può essere superiore a 5'
            }),
          notes: Joi.string().max(1000).optional().allow('')
            .messages({
              'string.max': 'Le note non possono superare i 1000 caratteri'
            }),
          beerId: Joi.string().optional().allow(null),
          breweryName: Joi.string().max(200).optional(),
          detailedRatings: Joi.object({
            appearance: Joi.object({
              rating: Joi.number().integer().min(1).max(5).optional().allow(null),
              notes: Joi.string().max(500).optional().allow('', null)
            }).optional().allow(null),
            aroma: Joi.object({
              rating: Joi.number().integer().min(1).max(5).optional().allow(null),
              notes: Joi.string().max(500).optional().allow('', null)
            }).optional().allow(null),
            taste: Joi.object({
              rating: Joi.number().integer().min(1).max(5).optional().allow(null),
              notes: Joi.string().max(500).optional().allow('', null)
            }).optional().allow(null),
            mouthfeel: Joi.object({
              rating: Joi.number().integer().min(1).max(5).optional().allow(null),
              notes: Joi.string().max(500).optional().allow('', null)
            }).optional().allow(null)
          }).optional().allow(null),
          aiData: Joi.object().optional(),
          thumbnail: Joi.string().optional().allow(null, '')
        })
      ).min(1).max(10).required()
        .messages({
          'array.min': 'È necessaria almeno una recensione',
          'array.max': 'Non è possibile recensire più di 10 birre alla volta'
        }),
      aiAnalysisData: Joi.object().optional()
    });

    const { error, value } = schema.validate(data, { 
      abortEarly: false,
      stripUnknown: true 
    });

    if (error) {
      return {
        isValid: false,
        message: 'Dati di input non validi',
        details: error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message,
          value: detail.context?.value
        }))
      };
    }

    return {
      isValid: true,
      data: value
    };
  }

  /**
   * Valida i dati di input per l'analisi AI
   * @param {Object} data - I dati da validare
   * @returns {Object} - Risultato della validazione
   */
  static validateAiInput(data) {
    const schema = Joi.object({
      image: Joi.string().required()
        .messages({
          'string.empty': 'L\'immagine è obbligatoria',
          'any.required': 'L\'immagine è obbligatoria'
        })
    });

    const { error, value } = schema.validate(data);

    if (error) {
      return {
        isValid: false,
        message: error.details[0].message
      };
    }

    // Validazione aggiuntiva per la dimensione dell'immagine (base64)
    const imageSize = Buffer.byteLength(value.image, 'base64');
    const maxSize = 10 * 1024 * 1024; // 10MB

    if (imageSize > maxSize) {
      return {
        isValid: false,
        message: `L'immagine è troppo grande. Dimensione massima: ${Math.round(maxSize / 1024 / 1024)}MB`
      };
    }

    return {
      isValid: true,
      data: value
    };
  }

  /**
   * Valida i dati di registrazione utente
   * @param {Object} data - I dati da validare
   * @returns {Object} - Risultato della validazione
   */
  static validateUserRegistration(data) {
    const schema = Joi.object({
      username: Joi.string().alphanum().min(3).max(30).required()
        .messages({
          'string.alphanum': 'Il nome utente può contenere solo lettere e numeri',
          'string.min': 'Il nome utente deve essere lungo almeno 3 caratteri',
          'string.max': 'Il nome utente non può superare i 30 caratteri'
        }),
      email: Joi.string().email().required()
        .messages({
          'string.email': 'Inserisci un indirizzo email valido'
        }),
      password: Joi.string().min(8).pattern(new RegExp('^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])')).required()
        .messages({
          'string.min': 'La password deve essere lunga almeno 8 caratteri',
          'string.pattern.base': 'La password deve contenere almeno una lettera minuscola, una maiuscola e un numero'
        }),
      role: Joi.array().items(Joi.string().valid('customer', 'brewery', 'administrator')).min(1).required()
        .messages({
          'array.min': 'Seleziona almeno un ruolo'
        })
    });

    const { error, value } = schema.validate(data);

    if (error) {
      return {
        isValid: false,
        message: error.details[0].message,
        field: error.details[0].path[0]
      };
    }

    return {
      isValid: true,
      data: value
    };
  }

  /**
   * Valida i dati di login
   * @param {Object} data - I dati da validare
   * @returns {Object} - Risultato della validazione
   */
  static validateLogin(data) {
    const schema = Joi.object({
      username: Joi.string().required()
        .messages({
          'string.empty': 'Il nome utente è obbligatorio'
        }),
      password: Joi.string().required()
        .messages({
          'string.empty': 'La password è obbligatoria'
        })
    });

    const { error, value } = schema.validate(data);

    if (error) {
      return {
        isValid: false,
        message: error.details[0].message
      };
    }

    return {
      isValid: true,
      data: value
    };
  }

  /**
   * Middleware per validazione automatica delle richieste
   * @param {Function} validationFunction - La funzione di validazione da utilizzare
   * @returns {Function} - Il middleware di validazione
   */
  static createValidationMiddleware(validationFunction) {
    return (req, res, next) => {
      const result = validationFunction(req.body);
      
      if (!result.isValid) {
        const error = ErrorHandler.createHttpError(
          400, 
          result.message,
          result.message
        );
        error.validationDetails = result.details;
        return next(error);
      }

      // Sostituisci i dati della richiesta con quelli validati
      req.body = result.data;
      next();
    };
  }

  /**
   * Sanifica una stringa rimuovendo caratteri potenzialmente pericolosi
   * @param {string} input - La stringa da sanificare
   * @returns {string} - La stringa sanificata
   */
  static sanitizeString(input) {
    if (typeof input !== 'string') {
      return input;
    }

    return input
      .trim()
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Rimuovi tag script
      .replace(/javascript:/gi, '') // Rimuovi javascript: URLs
      .replace(/on\w+\s*=/gi, '') // Rimuovi attributi evento
      .substring(0, 1000); // Limita lunghezza
  }

  /**
   * Valida e sanifica i parametri di query
   * @param {Object} query - I parametri di query da validare
   * @param {Object} schema - Lo schema di validazione Joi
   * @returns {Object} - Risultato della validazione
   */
  static validateQueryParams(query, schema) {
    // Sanifica i valori stringa
    const sanitizedQuery = {};
    for (const [key, value] of Object.entries(query)) {
      sanitizedQuery[key] = typeof value === 'string' ? this.sanitizeString(value) : value;
    }

    const { error, value } = schema.validate(sanitizedQuery, {
      stripUnknown: true,
      convert: true
    });

    if (error) {
      return {
        isValid: false,
        message: error.details[0].message
      };
    }

    return {
      isValid: true,
      data: value
    };
  }
}

module.exports = ValidationService;
