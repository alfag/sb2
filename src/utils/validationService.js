const Joi = require('joi');
const ErrorHandler = require('./errorHandler');
const { 
  getInappropriateWords, 
  moderationPatterns, 
  severityLevels, 
  moderationContexts 
} = require('../../config/contentModeration');

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
      aiAnalysisData: Joi.object().optional().allow(null)
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

    // Controllo linguaggio inappropriato su tutti i campi di testo delle recensioni
    const inappropriateContentResults = [];
    
    for (let i = 0; i < value.reviews.length; i++) {
      const review = value.reviews[i];
      const fieldsToCheckStrict = {};  // Campi con controllo strict (notes)
      const fieldsToCheckRelaxed = {}; // Campi con controllo rilassato (nomi birra/birrificio)
      
      // 🔧 FIX FALSI POSITIVI: beerName e breweryName controllati SOLO per parole esplicite
      // (non per pattern come consonant_clustering o excessive_caps che causano falsi positivi)
      if (review.beerName) fieldsToCheckRelaxed.beerName = review.beerName;
      if (review.breweryName) fieldsToCheckRelaxed.breweryName = review.breweryName;
      
      // Notes controllate con strict mode (pattern sospetti inclusi)
      if (review.notes) fieldsToCheckStrict.notes = review.notes;
      
      // Controlla le note dettagliate con strict mode
      if (review.detailedRatings) {
        ['appearance', 'aroma', 'taste', 'mouthfeel'].forEach(category => {
          if (review.detailedRatings[category]?.notes) {
            fieldsToCheckStrict[`detailedRatings.${category}.notes`] = review.detailedRatings[category].notes;
          }
        });
      }
      
      // Controllo campi strict (notes)
      if (Object.keys(fieldsToCheckStrict).length > 0) {
        const contentCheck = this.checkMultipleFieldsForInappropriateContent(fieldsToCheckStrict, {
          strict: true,
          context: `review_${i}`
        });
        
        if (!contentCheck.isClean) {
          inappropriateContentResults.push({
            reviewIndex: i,
            violations: contentCheck.violations,
            violatingFields: contentCheck.summary.violatingFields
          });
          
          // Applica la sanificazione automatica ai campi problematici
          for (const [fieldName, fieldResult] of Object.entries(contentCheck.fields)) {
            if (!fieldResult.isClean) {
              // Naviga nel percorso del campo per applicare la sanificazione
              const fieldPath = fieldName.split('.');
              let target = review;
              
              for (let j = 0; j < fieldPath.length - 1; j++) {
                target = target[fieldPath[j]];
              }
              
              const finalField = fieldPath[fieldPath.length - 1];
              target[finalField] = fieldResult.sanitizedText;
            }
          }
        }
      }
      
      // 🔧 Controllo campi relaxed (beerName/breweryName) - SOLO parole esplicite inappropriate
      if (Object.keys(fieldsToCheckRelaxed).length > 0) {
        const contentCheckRelaxed = this.checkMultipleFieldsForInappropriateContent(fieldsToCheckRelaxed, {
          strict: false,  // NO pattern matching, solo parole esplicite
          context: `review_${i}_names`
        });
        
        // Per i nomi, blocca SOLO se ci sono violazioni HIGH severity (parole esplicite)
        const highSeverityViolations = contentCheckRelaxed.violations.filter(v => 
          v.violations && v.violations.some(viol => viol.severity === 'high')
        );
        
        if (highSeverityViolations.length > 0) {
          inappropriateContentResults.push({
            reviewIndex: i,
            violations: highSeverityViolations,
            violatingFields: highSeverityViolations.length
          });
        }
      }
    }

    // Se sono stati trovati contenuti inappropriati, restituisci un errore
    if (inappropriateContentResults.length > 0) {
      return {
        isValid: false,
        message: 'Sono stati rilevati contenuti inappropriati in alcuni campi delle recensioni',
        inappropriateContent: true,
        details: inappropriateContentResults.map(result => ({
          reviewIndex: result.reviewIndex,
          violatingFields: result.violatingFields,
          fieldNames: result.violations.map(v => v.field).filter((field, index, arr) => arr.indexOf(field) === index), // Nomi unici dei campi violati
          message: `Recensione ${result.reviewIndex + 1}: linguaggio inappropriato rilevato in ${result.violatingFields} campo/i`,
          violations: result.violations
        })),
        sanitizedData: value // Restituisce i dati sanificati
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
   * Verifica se un testo contiene linguaggio inappropriato usando ricerca avanzata
   * @param {string} text - Il testo da verificare
   * @param {Object} options - Opzioni di configurazione
   * @returns {Object} - Risultato della verifica
   */
  static checkInappropriateLanguage(text, options = {}) {
    if (!text || typeof text !== 'string') {
      return {
        isClean: true,
        violations: [],
        sanitizedText: text,
        confidence: 1.0
      };
    }

    const { strict = false, context = 'general' } = options;
    const violations = [];
    let cleanText = text;
    const normalizedText = this.normalizeTextForProfanityCheck(text);
    let inappropriateWords = [];

    try {
      // Ottieni le parole inappropriate decifrate
      inappropriateWords = getInappropriateWords();
      
      if (inappropriateWords.length === 0) {
        console.warn('Nessuna parola inappropriata caricata - verificare la configurazione della chiave di cifratura');
      }

      // Controllo parole inappropriate - ricerca più efficace anche se "attaccate"
      for (const inappropriateWord of inappropriateWords) {
        if (inappropriateWord && inappropriateWord.length > 2) {
          // 🔧 FIX FALSI POSITIVI: Cerca la parola con word boundaries per evitare match parziali
          // Es: "commerciale" non deve matchare "merda" dentro "comMERciale"
          // Ma "porcomerda" o "merdaccia" devono matchare
          
          // Prima prova con word boundaries (più preciso)
          const wordBoundaryRegex = new RegExp(`\\b${inappropriateWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
          let matches = normalizedText.match(wordBoundaryRegex);
          
          // Se non trova con boundaries, prova senza MA solo per parole corte (< 5 caratteri)
          // per catturare evasioni tipo "porcod1o" ma evitare falsi positivi in parole lunghe
          if (!matches && inappropriateWord.length < 5) {
            const wordRegex = new RegExp(inappropriateWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
            matches = normalizedText.match(wordRegex);
          }
          
          if (matches && matches.length > 0) {
            violations.push({
              type: 'inappropriate_word',
              severity: 'high',
              description: 'Parola inappropriata rilevata',
              word: inappropriateWord.charAt(0) + '*'.repeat(inappropriateWord.length - 1),
              matches: matches.length,
              positions: this.findWordPositions(normalizedText, inappropriateWord)
            });
            
            // Sostituisci tutte le occorrenze nel testo originale
            const originalWordRegex = new RegExp(`\\b${inappropriateWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
            cleanText = cleanText.replace(originalWordRegex, '*'.repeat(inappropriateWord.length));
          }

          // Controllo anche varianti leet speak e con sostituzioni
          const leetVariants = this.generateLeetVariants([inappropriateWord]);
          for (const variant of leetVariants) {
            // 🔧 FIX FALSI POSITIVI: Usa word boundaries anche per varianti
            const variantBoundaryRegex = new RegExp(`\\b${variant.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
            let variantMatches = normalizedText.match(variantBoundaryRegex);
            
            // Se non trova con boundaries, prova senza MA solo per varianti corte
            if (!variantMatches && variant.length < 5) {
              const variantRegex = new RegExp(variant.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
              variantMatches = normalizedText.match(variantRegex);
            }
            
            if (variantMatches && variantMatches.length > 0) {
              violations.push({
                type: 'inappropriate_word_variant',
                severity: 'high',
                description: 'Variante di parola inappropriata rilevata',
                word: variant.charAt(0) + '*'.repeat(variant.length - 1),
                originalWord: inappropriateWord.charAt(0) + '*'.repeat(inappropriateWord.length - 1),
                matches: variantMatches.length
              });
              
              // Sostituisci anche le varianti
              const originalVariantRegex = new RegExp(`\\b${variant.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
              cleanText = cleanText.replace(originalVariantRegex, '*'.repeat(variant.length));
            }
          }
        }
      }
    } catch (error) {
      console.error('Errore durante il controllo delle parole inappropriate:', error.message);
      // In caso di errore con la decifratura, continua con gli altri controlli
    }

    // Pattern per rilevare linguaggio inappropriato senza elencare parole specifiche
    const inappropriatePatterns = [
      // Pattern per parole con caratteri sostituiti (es: c4zzo, m3rda) - più specifico
      {
        pattern: /[bcdfghjklmnpqrstvwxyz]{1,2}[\d@#$%&*]{1,2}[aeiou]{1,2}[\d@#$%&*]{1,2}[bcdfghjklmnpqrstvwxyz]{1,3}/gi,
        type: 'suspicious_substitution',
        severity: 'medium'
      },
      // Pattern per caratteri ripetuti eccessivamente (possibile evasione)
      {
        pattern: moderationPatterns.excessive_repetition,
        type: 'excessive_repetition',
        severity: 'low'
      },
      // Pattern per alternanza sospetta maiuscole/minuscole
      {
        pattern: moderationPatterns.case_alternation,
        type: 'suspicious_casing',
        severity: 'low'
      },
      // Pattern per spazi che interrompono parole - molto più specifico per evitare falsi positivi
      {
        pattern: /[bcdfghjklmnpqrstvwxyz]{2,}[\s\-_\.]{1}[bcdfghjklmnpqrstvwxyz]{1}[\s\-_\.]{1}[bcdfghjklmnpqrstvwxyz]{2,}/gi,
        type: 'word_breaking',
        severity: 'medium'
      },
      // Pattern per sequenze di consonanti sospette
      {
        pattern: moderationPatterns.consonant_clustering,
        type: 'consonant_clustering',
        severity: 'medium'
      }
    ];

    // Controllo CAPS LOCK eccessivo (possibile aggressività)
    const capsRatio = (text.match(/[A-Z]/g) || []).length / text.length;
    if (text.length > 10 && capsRatio > 0.7) {
      violations.push({
        type: 'excessive_caps',
        severity: 'low',
        description: 'Uso eccessivo di maiuscole'
      });
    }

    // Controllo pattern sospetti solo se non abbiamo già trovato parole inappropriate
    if (violations.filter(v => v.severity === 'high').length === 0) {
      for (const patternObj of inappropriatePatterns) {
        const matches = normalizedText.match(patternObj.pattern);
        if (matches && matches.length > 0) {
          // Filtro per evitare falsi positivi su parole normali
          const suspiciousMatches = matches.filter(match => {
            // Escludi numeri, acronimi comuni, codici prodotto
            if (/^\d+$/.test(match) || /^[A-Z]{2,4}$/.test(match)) return false;
            // Escludi parole troppo corte o troppo lunghe
            if (match.length < 3 || match.length > 15) return false;
            return true;
          });

          if (suspiciousMatches.length > 0) {
            violations.push({
              type: patternObj.type,
              severity: patternObj.severity,
              matches: suspiciousMatches.length,
              description: `Pattern sospetto rilevato: ${patternObj.type}`
            });
          }
        }
      }
    }

    // Controllo entropia del testo (testi molto casuali possono indicare tentativi di evasione)
    const entropy = this.calculateTextEntropy(normalizedText);
    if (entropy > 4.5 && text.length > 20) {
      violations.push({
        type: 'high_entropy',
        severity: 'medium',
        entropy: entropy,
        description: 'Testo con entropia sospettamente alta'
      });
    }

    // Controllo sequenze di caratteri speciali
    const specialCharsRatio = (text.match(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\?]/g) || []).length / text.length;
    if (specialCharsRatio > 0.3 && text.length > 10) {
      violations.push({
        type: 'excessive_special_chars',
        severity: 'medium',
        ratio: specialCharsRatio,
        description: 'Uso eccessivo di caratteri speciali'
      });
    }

    // Se ci sono molti pattern sospetti, aumenta la severità
    const highSeverityCount = violations.filter(v => v.severity === 'high').length;
    const mediumSeverityCount = violations.filter(v => v.severity === 'medium').length;
    
    // Calcola confidenza
    const confidence = this.calculateContentConfidence(violations, text.length);
    
    // Determina se il testo è pulito - più severo ora
    const isClean = highSeverityCount === 0 && (mediumSeverityCount < 1 || !strict);

    // Se il testo non è pulito, applica sanificazione
    if (!isClean) {
      cleanText = this.sanitizeInappropriateContent(cleanText);
    }

    return {
      isClean: isClean,
      violations: violations,
      sanitizedText: cleanText,
      confidence: confidence,
      context: context,
      analysis: {
        originalLength: text.length,
        capsRatio: capsRatio,
        specialCharsRatio: specialCharsRatio,
        entropy: entropy,
        inappropriateWordsChecked: inappropriateWords ? inappropriateWords.length : 0
      }
    };
  }

  /**
   * Trova le posizioni di una parola all'interno di un testo
   * @param {string} text - Il testo in cui cercare
   * @param {string} word - La parola da cercare
   * @returns {Array} - Array delle posizioni trovate
   */
  static findWordPositions(text, word) {
    const positions = [];
    const regex = new RegExp(word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    let match;
    
    while ((match = regex.exec(text)) !== null) {
      positions.push({
        start: match.index,
        end: match.index + match[0].length,
        match: match[0]
      });
    }
    
    return positions;
  }

  /**
   * Genera varianti leet speak delle parole
   * @param {Array} words - Array di parole
   * @returns {Array} - Array di varianti generate
   */
  static generateLeetVariants(words) {
    const variants = [];
    const leetMap = { 'a': '4', 'e': '3', 'i': '1', 'o': '0', 's': '5', 't': '7' };
    
    for (const word of words) {
      if (word.length > 2) {
        let variant = word.toLowerCase();
        for (const [letter, num] of Object.entries(leetMap)) {
          variant = variant.replace(new RegExp(letter, 'g'), num);
        }
        if (variant !== word.toLowerCase()) {
          variants.push(variant);
        }
      }
    }
    return variants;
  }

  /**
   * Normalizza il testo per il controllo di contenuti inappropriati
   * @param {string} text - Il testo da normalizzare
   * @returns {string} - Il testo normalizzato
   */
  static normalizeTextForProfanityCheck(text) {
    return text
      .toLowerCase()
      // Sostituisci numeri che potrebbero sostituire lettere
      .replace(/3/g, 'e')
      .replace(/4/g, 'a')
      .replace(/1/g, 'i')
      .replace(/0/g, 'o')
      .replace(/5/g, 's')
      .replace(/7/g, 't')
      // Rimuovi simboli che possono nascondere parole
      .replace(/[@#$%&*\-_\.]/g, '')
      // Rimuovi spazi multipli
      .replace(/\s+/g, ' ')
      // Rimuovi caratteri ripetuti eccessivamente
      .replace(/(.)\1{3,}/g, '$1$1')
      .trim();
  }

  /**
   * Calcola l'entropia di un testo
   * @param {string} text - Il testo di cui calcolare l'entropia
   * @returns {number} - Il valore di entropia
   */
  static calculateTextEntropy(text) {
    const frequencies = {};
    const length = text.length;

    // Conta le frequenze dei caratteri
    for (const char of text) {
      frequencies[char] = (frequencies[char] || 0) + 1;
    }

    // Calcola l'entropia
    let entropy = 0;
    for (const freq of Object.values(frequencies)) {
      const probability = freq / length;
      entropy -= probability * Math.log2(probability);
    }

    return entropy;
  }

  /**
   * Calcola la confidenza del controllo contenuti
   * @param {Array} violations - Le violazioni trovate
   * @param {number} textLength - La lunghezza del testo
   * @returns {number} - Il valore di confidenza (0-1)
   */
  static calculateContentConfidence(violations, textLength) {
    if (violations.length === 0) {
      return 1.0;
    }

    let penaltyScore = 0;
    
    for (const violation of violations) {
      switch (violation.severity) {
        case 'high':
          penaltyScore += 0.4;
          break;
        case 'medium':
          penaltyScore += 0.2;
          break;
        case 'low':
          penaltyScore += 0.1;
          break;
      }
    }

    // Penalità maggiore per testi corti con violazioni
    if (textLength < 50 && violations.length > 0) {
      penaltyScore *= 1.5;
    }

    return Math.max(0, Math.min(1, 1 - penaltyScore));
  }

  /**
   * Sanifica contenuti inappropriati
   * @param {string} text - Il testo da sanificare
   * @returns {string} - Il testo sanificato
   */
  static sanitizeInappropriateContent(text) {
    let sanitized = text;
    
    // Rimuovi caratteri ripetuti eccessivamente
    sanitized = sanitized.replace(/(.)\1{4,}/g, '$1$1');
    
    // Converti tutto in minuscole eccetto la prima lettera
    sanitized = sanitized.charAt(0).toUpperCase() + sanitized.slice(1).toLowerCase();
    
    // Rimuovi caratteri speciali eccessivi
    sanitized = sanitized.replace(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\?]{3,}/g, '...');
    
    // Normalizza spazi
    sanitized = sanitized.replace(/\s+/g, ' ').trim();
    
    return sanitized;
  }

  /**
   * Verifica multipli campi di testo per contenuti inappropriati
   * @param {Object} fields - Oggetto con i campi da verificare
   * @param {Object} options - Opzioni di configurazione
   * @returns {Object} - Risultato della verifica per tutti i campi
   */
  static checkMultipleFieldsForInappropriateContent(fields, options = {}) {
    const results = {};
    let hasViolations = false;
    const allViolations = [];

    for (const [fieldName, fieldValue] of Object.entries(fields)) {
      if (fieldValue && typeof fieldValue === 'string') {
        const result = this.checkInappropriateLanguage(fieldValue, {
          ...options,
          context: fieldName
        });
        
        results[fieldName] = result;
        
        if (!result.isClean) {
          hasViolations = true;
          allViolations.push({
            field: fieldName,
            originalValue: fieldValue,  // 🔍 Aggiunto per debug: valore originale che ha causato la violazione
            sanitizedValue: result.sanitizedText,  // 🔍 Aggiunto: valore dopo sanificazione
            detectedWords: result.violations.map(v => v.word).join(', '),  // 🔍 Aggiunto: parole rilevate
            violations: result.violations
          });
        }
      }
    }

    return {
      isClean: !hasViolations,
      fields: results,
      summary: {
        totalFields: Object.keys(fields).length,
        violatingFields: allViolations.length,
        totalViolations: allViolations.reduce((sum, field) => sum + field.violations.length, 0)
      },
      violations: allViolations
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
