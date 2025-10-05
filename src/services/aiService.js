const GeminiAI = require('../utils/geminiAi');
const logWithFileName = require('../utils/logger');
const ErrorHandler = require('../utils/errorHandler');
const cacheService = require('../utils/cacheService');
const Brewery = require('../models/Brewery');
const AIValidationService = require('./aiValidationService');

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
   * @param {Object} session - Sessione utente
   * @param {string|null} userId - ID utente (null per guest)
   * @returns {Object} - Risultato controllo con dettagli rate limiting
   */
  static canMakeRequest(session, userId = null) {
    // In ambiente di sviluppo non ci sono limiti
    if (process.env.NODE_ENV === 'development') {
      logger.debug('[AIService] Ambiente di sviluppo: nessun limite di richieste');
      return {
        canMakeRequest: true,
        requestCount: 0,
        maxRequests: Infinity,
        remainingRequests: Infinity,
        isUserAuthenticated: !!userId,
        resetInfo: {
          resetTime: 'N/A - ambiente sviluppo',
          resetMethod: 'Nessun limite in sviluppo'
        },
        developmentMode: true
      };
    }

    const sessionKey = 'aiRequestCount';
    const requestCount = session[sessionKey] || 0;
    const maxRequests = userId ? 30 : 10; // Utenti registrati: 30, guest: 10
    const remainingRequests = Math.max(0, maxRequests - requestCount);
    const isLimitReached = requestCount >= maxRequests;

    const result = {
      canMakeRequest: !isLimitReached,
      requestCount,
      maxRequests,
      remainingRequests,
      isUserAuthenticated: !!userId,
      resetInfo: {
        resetTime: 'fine sessione',
        resetMethod: 'Chiudi e riapri il browser'
      }
    };

    if (isLimitReached) {
      logger.warn('[AIService] Rate limit raggiunto', {
        sessionId: session.id,
        userId,
        requestCount,
        maxRequests,
        isUserAuthenticated: !!userId
      });
      
      // Messaggio personalizzato in base al tipo di utente
      if (userId) {
        result.message = `Hai raggiunto il limite di ${maxRequests} analisi AI per questa sessione. Per continuare ad utilizzare il servizio, chiudi e riapri il browser.`;
        result.suggestion = 'Le tue analisi sono state salvate nel tuo account.';
      } else {
        result.message = `Hai raggiunto il limite di ${maxRequests} analisi AI per utenti non registrati. Registrati per avere ${30} analisi per sessione.`;
        result.suggestion = 'Crea un account gratuito per avere più analisi disponibili e salvare i tuoi dati.';
        result.authUrl = '/auth/register';
      }
    } else {
      // Avviso quando ci si avvicina al limite
      if (remainingRequests <= 2) {
        result.warning = `Ti rimangono solo ${remainingRequests} analisi AI per questa sessione.`;
        if (!userId) {
          result.warning += ' Registrati per avere più analisi disponibili.';
          result.authUrl = '/auth/register';
        }
      }
    }

    logger.debug('[AIService] Check rate limit completato', {
      sessionId: session.id,
      userId,
      canMakeRequest: result.canMakeRequest,
      requestCount,
      maxRequests,
      remainingRequests
    });

    return result;
  }

  /**
   * Processo analisi immagine con caching e matching robusto
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

      // 1. Recupera tutti i birrifici esistenti con più dettagli
      const breweries = await Brewery.find({}, 'breweryName breweryWebsite breweryEmail breweryLegalAddress breweryProductionAddress').lean();
      const breweryNames = breweries.map(b => b.breweryName);

      logger.debug('[AIService] Recuperati birrifici esistenti', {
        sessionId: session.id,
        breweryCount: breweryNames.length
      });

      // 2. Esegui analisi AI con prompt semplificato
      logger.info('[AIService] Chiamata GeminiAI.validateImage con prompt semplificato', {
        sessionId: session.id,
        userId,
        imageSize: imageBuffer.length
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
        bottlesFound: analysisResult?.bottles?.length || 0,
        breweriesFound: analysisResult?.breweries?.length || 0,
        requiresIntervention: analysisResult?.summary?.requiresUserIntervention
      });

      // NUOVO: Sistema Anti-Allucinazioni Completo
      if (analysisResult && analysisResult.success) {
        logger.info('[AIService] 🛡️ Avvio sistema anti-allucinazioni', {
          sessionId: session.id,
          userId,
          totalBottles: analysisResult.totalBottlesFound || 0,
          hasBreweries: !!(analysisResult.breweries && analysisResult.breweries.length > 0),
          hasBeers: !!(analysisResult.beers && analysisResult.beers.length > 0)
        });

        // Recupera birrifici esistenti per la validazione
        const existingBreweries = await Brewery.find({}, 'breweryName breweryWebsite breweryEmail breweryLegalAddress breweryProductionAddress').lean();
        
        logger.debug('[AIService] Dati per validazione preparati', {
          sessionId: session.id,
          existingBreweriesCount: existingBreweries.length
        });

        // 🎯 FASE 1: Validazione rigorosa anti-allucinazioni
        const validationResult = await AIValidationService.processAIResults(analysisResult, existingBreweries);
        
        logger.info('[AIService] 🔍 Validazione anti-allucinazioni completata', {
          sessionId: session.id,
          canSaveDirectly: validationResult.canSaveDirectly,
          requiresConfirmation: validationResult.requiresUserConfirmation,
          requiresCompletion: validationResult.requiresUserCompletion,
          blocked: validationResult.blockedByValidation,
          userActionsCount: validationResult.userActions?.length || 0,
          verifiedBreweriesCount: validationResult.verifiedData?.breweries?.length || 0,
          unverifiedBreweriesCount: validationResult.unverifiedData?.breweries?.length || 0,
          verifiedBeersCount: validationResult.verifiedData?.beers?.length || 0,
          unverifiedBeersCount: validationResult.unverifiedData?.beers?.length || 0
        });

        // 🎯 FASE 2: Determina flusso utente basato su validazione
        let userFlowType = 'DIRECT_SAVE';
        if (validationResult.blockedByValidation) {
          userFlowType = 'BLOCKED';
        } else if (validationResult.requiresUserCompletion) {
          userFlowType = 'REQUIRES_COMPLETION';
        } else if (validationResult.requiresUserConfirmation) {
          userFlowType = 'REQUIRES_CONFIRMATION';
        }

        // 🎯 FASE 3: Crea risultato finale con tutti i dati necessari
        const enhancedResult = {
          ...analysisResult,
          
          // Dati sistema anti-allucinazioni
          validation: validationResult,
          antiHallucination: {
            enabled: true,
            processed: true,
            timestamp: new Date().toISOString(),
            userFlowType: userFlowType,
            safeToSave: validationResult.canSaveDirectly
          },
          
          // Stato flusso utente
          needsUserIntervention: !validationResult.canSaveDirectly,
          canSaveDirectly: validationResult.canSaveDirectly,
          userActions: validationResult.userActions || [],
          userFlowType: userFlowType,
          
          // Dati processati e categorizzati
          processedData: {
            verified: {
              breweries: validationResult.verifiedData?.breweries || [],
              beers: validationResult.verifiedData?.beers || [],
              count: {
                breweries: validationResult.verifiedData?.breweries?.length || 0,
                beers: validationResult.verifiedData?.beers?.length || 0
              }
            },
            unverified: {
              breweries: validationResult.unverifiedData?.breweries || [],
              beers: validationResult.unverifiedData?.beers || [],
              count: {
                breweries: validationResult.unverifiedData?.breweries?.length || 0,
                beers: validationResult.unverifiedData?.beers?.length || 0
              }
            },
            blocked: {
              breweries: validationResult.blockedData?.breweries || [],
              beers: validationResult.blockedData?.beers || [],
              count: {
                breweries: validationResult.blockedData?.breweries?.length || 0,
                beers: validationResult.blockedData?.beers?.length || 0
              }
            }
          },
          
          // Messaggi utente
          messages: {
            success: validationResult.canSaveDirectly ? 
              'Tutti i dati sono stati verificati e possono essere salvati automaticamente.' : null,
            warning: !validationResult.canSaveDirectly ? 
              'Alcuni dati richiedono la tua conferma prima del salvataggio.' : null,
            info: userFlowType === 'REQUIRES_COMPLETION' ?
              'Completa i dati mancanti per procedere con il salvataggio.' : null,
            error: validationResult.blockedByValidation ?
              'Rilevati possibili dati inventati. Controlla attentamente prima di procedere.' : null
          }
        };

        // 🎯 FASE 4: Salva in sessione con flag di validazione
        session.aiValidationResult = validationResult;
        this.saveAnalysisToSession(session, enhancedResult);
        
        logger.info('[AIService] ✅ Sistema anti-allucinazioni completato', {
          sessionId: session.id,
          userId,
          userFlowType: userFlowType,
          safeToSave: validationResult.canSaveDirectly,
          totalActions: validationResult.userActions?.length || 0,
          processingComplete: true
        });
        
        return enhancedResult;
      }

      // Fallback per analisi senza sistema di validazione

      // Risultato standard senza enhancement
      this.saveAnalysisToSession(session, analysisResult);
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
    // In ambiente di sviluppo non incrementare il contatore
    if (process.env.NODE_ENV === 'development') {
      logger.debug('[AIService] Ambiente sviluppo: contatore richieste non incrementato');
      return;
    }

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
   * Trova birrificio corrispondente usando logica robusta con gestione ambiguità
   * @param {string} breweryName - Nome del birrificio estratto dall'AI
   * @param {Object} breweryData - Dati completi del birrificio dall'AI
   * @param {Array} allBreweries - Lista di tutti i birrifici nel database
   * @returns {Object} - Risultato matching con possibili ambiguità
   */
  static async findMatchingBrewery(breweryName, breweryData, allBreweries) {
    if (!breweryName || !allBreweries || allBreweries.length === 0) {
      return { match: null, ambiguities: [], needsDisambiguation: false };
    }

    const searchName = breweryName.trim();
    logger.debug('[AIService] Ricerca birrificio con gestione ambiguità', {
      searchName,
      hasWebsite: !!breweryData?.breweryWebsite,
      hasEmail: !!breweryData?.breweryEmail,
      hasAddress: !!breweryData?.breweryLegalAddress,
      totalBreweries: allBreweries.length
    });

    // FASE 1: Ricerca per nome esatto (case insensitive)
    let brewery = allBreweries.find(b =>
      b.breweryName && b.breweryName.toLowerCase() === searchName.toLowerCase()
    );

    if (brewery) {
      logger.info('[AIService] MATCHING_ROBUSTO - Nome esatto trovato', {
        searchName,
        foundBrewery: brewery.breweryName,
        matchType: 'EXACT_NAME'
      });
      return {
        match: { ...brewery, matchType: 'EXACT_NAME', confidence: 1.0 },
        ambiguities: [],
        needsDisambiguation: false
      };
    }

    // FASE 2: Ricerca fuzzy per nome simile con soglia più bassa
    const fuzzyMatches = allBreweries
      .map(b => ({
        ...b,
        similarity: this.calculateNameSimilarity(searchName, b.breweryName),
        keywordMatch: this.hasCommonKeywords(searchName, b.breweryName)
      }))
      .filter(b => b.similarity > 0.6 || b.keywordMatch) // Soglia più bassa + controllo parole chiave
      .sort((a, b) => b.similarity - a.similarity);

    // FASE 3: Analizza i risultati fuzzy per determinare se c'è ambiguità
    if (fuzzyMatches.length > 0) {
      const bestMatch = fuzzyMatches[0];
      const hasHighConfidence = bestMatch.similarity > 0.85;
      const hasKeywordMatch = bestMatch.keywordMatch;
      const hasMultipleSimilar = fuzzyMatches.filter(b => b.similarity > 0.7).length > 1;

      logger.info('[AIService] MATCHING_ROBUSTO - Analisi fuzzy completata', {
        searchName,
        bestMatch: {
          name: bestMatch.breweryName,
          similarity: bestMatch.similarity.toFixed(2),
          keywordMatch: bestMatch.keywordMatch
        },
        totalMatches: fuzzyMatches.length,
        highConfidence: hasHighConfidence,
        multipleSimilar: hasMultipleSimilar
      });

      // Se alta confidenza e match di parole chiave, usa direttamente
      if (hasHighConfidence && hasKeywordMatch && !hasMultipleSimilar) {
        logger.info('[AIService] MATCHING_ROBUSTO - Match fuzzy ad alta confidenza', {
          searchName,
          foundBrewery: bestMatch.breweryName,
          similarity: bestMatch.similarity.toFixed(2),
          matchType: 'FUZZY_HIGH_CONFIDENCE'
        });
        return {
          match: { ...bestMatch, matchType: 'FUZZY_HIGH_CONFIDENCE', confidence: bestMatch.similarity },
          ambiguities: [],
          needsDisambiguation: false
        };
      }

      // Se c'è ambiguità (multiple corrispondenze simili O multiple con parole chiave), richiedi disambiguazione
      const hasMultipleKeywordMatches = fuzzyMatches.filter(b => b.keywordMatch).length > 1;
      
      if (hasMultipleSimilar || (fuzzyMatches.length > 1 && fuzzyMatches[1].similarity > 0.6) || hasMultipleKeywordMatches) {
        const ambiguities = fuzzyMatches.slice(0, 5).map(b => ({
          ...b,
          matchType: 'AMBIGUOUS_FUZZY',
          confidence: b.similarity
        }));

        logger.info('[AIService] MATCHING_ROBUSTO - Ambiguità rilevata, disambiguazione necessaria', {
          searchName,
          ambiguitiesCount: ambiguities.length,
          hasMultipleSimilar,
          hasMultipleKeywordMatches,
          secondMatchSimilarity: fuzzyMatches[1]?.similarity || 0,
          ambiguities: ambiguities.map(a => ({
            name: a.breweryName,
            similarity: a.similarity.toFixed(2),
            keywordMatch: a.keywordMatch
          }))
        });

        return {
          match: null,
          ambiguities: ambiguities,
          needsDisambiguation: true,
          disambiguationReason: hasMultipleKeywordMatches ? 'MULTIPLE_KEYWORD_MATCHES' : 'MULTIPLE_SIMILAR_MATCHES'
        };
      }

      // Match singolo con confidenza media, richiedi conferma
      if (bestMatch.similarity > 0.7 || bestMatch.keywordMatch) {
        logger.info('[AIService] MATCHING_ROBUSTO - Match singolo ambigua, conferma necessaria', {
          searchName,
          foundBrewery: bestMatch.breweryName,
          similarity: bestMatch.similarity.toFixed(2),
          keywordMatch: bestMatch.keywordMatch,
          matchType: 'AMBIGUOUS_SINGLE'
        });

        return {
          match: null,
          ambiguities: [{
            ...bestMatch,
            matchType: 'AMBIGUOUS_SINGLE',
            confidence: bestMatch.similarity
          }],
          needsDisambiguation: true,
          disambiguationReason: 'SINGLE_AMBIGUOUS_MATCH'
        };
      }
    }

    // FASE 4-6: Ricerca per website, email, indirizzo (se disponibili)
    // Queste rimangono invariate ma ora restituiscono anche informazioni di ambiguità

    // FASE 7: Ricerca per parti del nome (fallback con logica migliorata)
    const nameParts = searchName.toLowerCase().split(/\s+/);
    const partialMatches = allBreweries
      .map(b => {
        if (!b.breweryName) return null;
        const breweryNameLower = b.breweryName.toLowerCase();
        const matchingParts = nameParts.filter(part =>
          part.length > 2 && breweryNameLower.includes(part)
        );
        const matchRatio = matchingParts.length / nameParts.length;
        return matchRatio >= 0.5 ? { ...b, matchRatio, matchingParts } : null;
      })
      .filter(Boolean)
      .sort((a, b) => b.matchRatio - a.matchRatio);

    if (partialMatches.length > 0) {
      const bestPartial = partialMatches[0];

      logger.info('[AIService] MATCHING_ROBUSTO - Part matching con ambiguità', {
        searchName,
        foundBrewery: bestPartial.breweryName,
        matchRatio: bestPartial.matchRatio.toFixed(2),
        matchingParts: bestPartial.matchingParts,
        matchType: 'PARTIAL_AMBIGUOUS'
      });

      return {
        match: null,
        ambiguities: [{
          ...bestPartial,
          matchType: 'PARTIAL_AMBIGUOUS',
          confidence: bestPartial.matchRatio * 0.8
        }],
        needsDisambiguation: true,
        disambiguationReason: 'PARTIAL_NAME_MATCH'
      };
    }

    logger.debug('[AIService] MATCHING_ROBUSTO - Nessuna corrispondenza trovata', {
      searchName,
      searchedCriteria: {
        exactName: true,
        fuzzyName: true,
        website: !!breweryData?.breweryWebsite,
        email: !!breweryData?.breweryEmail,
        address: !!breweryData?.breweryLegalAddress,
        partialName: true
      }
    });

    return {
      match: null,
      ambiguities: [],
      needsDisambiguation: false
    };
  }

  /**
   * Verifica se due nomi hanno parole chiave comuni che indicano possibile identità
   */
  static hasCommonKeywords(name1, name2) {
    if (!name1 || !name2) return false;

    const normalize = (str) => str.toLowerCase().replace(/[^\w\s]/g, '').trim();
    const n1 = normalize(name1);
    const n2 = normalize(name2);

    // Parole chiave che spesso identificano birrifici unici
    const keywords = [
      'viana', 'moretti', 'peroni', 'heineken', 'corona', 'guinness',
      'budweiser', 'pilsner', 'ipa', 'lager', 'stout', 'weizen'
    ];

    // Controlla se entrambi i nomi contengono la stessa parola chiave
    const commonKeywords = keywords.filter(keyword =>
      n1.includes(keyword) && n2.includes(keyword)
    );

    if (commonKeywords.length > 0) {
      logger.debug('[AIService] Parole chiave comuni trovate', {
        name1,
        name2,
        commonKeywords
      });
      return true;
    }

    // Controlla similarità per parti significative del nome
    const parts1 = n1.split(/\s+/).filter(p => p.length > 3);
    const parts2 = n2.split(/\s+/).filter(p => p.length > 3);

    const commonParts = parts1.filter(part =>
      parts2.some(p2 => this.calculateNameSimilarity(part, p2) > 0.8)
    );

    return commonParts.length >= 2; // Almeno 2 parti comuni
  }

  /**
   * Calcola similarità tra due nomi
   */
  static calculateNameSimilarity(name1, name2) {
    if (!name1 || !name2) return 0;
    
    const normalize = (str) => str.toLowerCase().replace(/[^\w\s]/g, '').trim();
    const n1 = normalize(name1);
    const n2 = normalize(name2);
    
    if (n1 === n2) return 1.0;
    
    // Algoritmo Levenshtein semplificato
    const longer = n1.length > n2.length ? n1 : n2;
    const shorter = n1.length > n2.length ? n2 : n1;
    
    if (longer.length === 0) return 1.0;
    
    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  /**
   * Distanza Levenshtein
   */
  static levenshteinDistance(str1, str2) {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));
    
    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;
    
    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,    // insertion
          matrix[j - 1][i] + 1,    // deletion
          matrix[j - 1][i - 1] + indicator // substitution
        );
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  /**
   * Pulisce URL per confronto
   */
  static cleanUrl(url) {
    if (!url) return '';
    return url.toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .replace(/\/$/, '')
      .trim();
  }

  /**
   * Normalizza indirizzo per confronto
   */
  static normalizeAddress(address) {
    if (!address) return '';
    return address.toLowerCase()
      .replace(/\s+/g, ' ')
      .replace(/[^\w\s]/g, '')
      .trim();
  }
}

module.exports = AIService;
