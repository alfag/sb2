const logWithFileName = require('../utils/logger');
const Brewery = require('../models/Brewery');
const Beer = require('../models/Beer');
const logger = logWithFileName(__filename);
const config = require('../../config/config');

/**
 * Servizio di validazione avanzata per prevenire allucinazioni AI
 * Gestisce il flusso di verifica e richiesta conferma utente
 */
class AIValidationService {
  
  /**
   * Processa i risultati AI con validazione rigorosa
   * @param {Object} aiResult - Risultati dall'analisi AI
   * @param {Array} existingBreweries - Birrifici esistenti nel database
   * @returns {Object} - Risultato con azioni necessarie per l'utente
   */
  static async processAIResults(aiResult, existingBreweries = []) {
    logger.info('[AIValidation] Inizio validazione risultati AI', {
      bottlesFound: aiResult.bottles?.length || 0,
      breweriesFound: aiResult.breweries?.length || 0,
      requiresIntervention: aiResult.summary?.requiresUserIntervention
    });

    let validationResults = {
      canSaveDirectly: false,
      requiresUserConfirmation: false,
      requiresUserCompletion: false,
      blockedByValidation: false,
      
      verifiedData: {
        breweries: [],
        beers: []
      },
      
      unverifiedData: {
        breweries: [],
        beers: []
      },
      
      userActions: [],
      errorMessages: [],
      
      summary: {
        totalBreweries: aiResult.breweries?.length || 0,
        totalBeers: aiResult.bottles?.length || 0,
        verifiedBreweries: 0,
        unverifiedBreweries: 0,
        verifiedBeers: 0,
        unverifiedBeers: 0
      }
    };

    try {
      // FASE 1: Validazione birrifici
      if (aiResult.breweries && aiResult.breweries.length > 0) {
        for (const brewery of aiResult.breweries) {
          const breweryValidation = await this.validateBrewery(brewery, existingBreweries);
          
          // ✅ Considera validi sia SAVE_DIRECTLY che UPDATE_EXISTING
          if (breweryValidation.isValid && 
              (breweryValidation.action === 'SAVE_DIRECTLY' || 
               breweryValidation.action === 'UPDATE_EXISTING')) {
            validationResults.verifiedData.breweries.push(breweryValidation);
            validationResults.summary.verifiedBreweries++;
          } else {
            validationResults.unverifiedData.breweries.push(breweryValidation);
            validationResults.summary.unverifiedBreweries++;
            
            if (breweryValidation.requiresUserAction && breweryValidation.userAction) {
              validationResults.userActions.push(breweryValidation.userAction);
            }
          }
        }
      }

      // FASE 2: Validazione birre (solo per birrifici verificati)
      if (aiResult.bottles && aiResult.bottles.length > 0) {
        for (const bottle of aiResult.bottles) {
          const beerValidation = await this.validateBeer(bottle, validationResults.verifiedData.breweries);
          
          if (beerValidation.isValid && beerValidation.action === 'SAVE_DIRECTLY') {
            validationResults.verifiedData.beers.push(beerValidation);
            validationResults.summary.verifiedBeers++;
          } else {
            validationResults.unverifiedData.beers.push(beerValidation);
            validationResults.summary.unverifiedBeers++;
            
            if (beerValidation.requiresUserAction && beerValidation.userAction) {
              validationResults.userActions.push(beerValidation.userAction);
            }
          }
        }
      }

      // FASE 3: Determinazione azione finale
      validationResults = this.determineUserFlow(validationResults);

      logger.info('[AIValidation] Validazione completata', {
        canSaveDirectly: validationResults.canSaveDirectly,
        requiresConfirmation: validationResults.requiresUserConfirmation,
        requiresCompletion: validationResults.requiresUserCompletion,
        blocked: validationResults.blockedByValidation,
        userActionsCount: validationResults.userActions.length,
        summary: validationResults.summary
      });

      return validationResults;

    } catch (error) {
      logger.error('[AIValidation] Errore durante validazione', {
        error: error.message,
        stack: error.stack
      });
      
      return {
        canSaveDirectly: false,
        blockedByValidation: true,
        errorMessages: [`Errore nella validazione: ${error.message}`],
        userActions: [{
          type: 'RETRY',
          title: 'Riprova l\'analisi',
          description: 'Si è verificato un errore tecnico. Riprova con un\'altra immagine.',
          priority: 'high'
        }]
      };
    }
  }

  /**
   * Valida un singolo birrificio
   */
  static async validateBrewery(breweryData, existingBreweries) {
    const validation = {
      id: breweryData.id,
      type: 'brewery',
      originalData: breweryData,
      isValid: false,
      action: null,
      requiresUserAction: false,
      confidence: 0,
      issues: [],
      userAction: null
    };

    try {
      // Check 1: Verifica se è marcato come VERIFIED dall'AI
      if (breweryData.verification === 'VERIFIED') {
        // Check 2: Verifica contro database esistente
        const existingMatch = this.findExistingBrewery(breweryData.verifiedData?.breweryName, existingBreweries);
        
        if (existingMatch) {
          validation.isValid = true;
          validation.action = 'UPDATE_EXISTING';
          validation.confidence = 0.95;
          validation.existingBrewery = existingMatch;
          
          logger.info('[AIValidation] Birrificio verificato - aggiornamento esistente', {
            breweryName: breweryData.verifiedData.breweryName,
            existingId: existingMatch._id
          });
          
          return validation;
        }

        // Check 3: Nuovo birrificio verificato - controllo qualità dati
        const qualityScore = this.assessDataQuality(breweryData.verifiedData, breweryData);

        // 🎯 LOGICA INTELLIGENTE GROUNDING:
        // - Se quality score >= 0.6 → SALVA (dati AI ricchi e coerenti)
        // - Strict grounding richiesto SOLO se quality score < 0.6 (dati dubbiosi)
        const strictGrounding = config.STRICT_AI_GROUNDING === true || config.STRICT_AI_GROUNDING === 'true';

        if (qualityScore >= 0.6) {
          // ✅ Quality score sufficiente → SALVA DIRETTAMENTE
          // Il grounding è un bonus ma non blocca se i dati sono ricchi
          validation.isValid = true;
          validation.action = 'SAVE_DIRECTLY';
          validation.confidence = qualityScore;

          logger.info('[AIValidation] Nuovo birrificio verificato - salvataggio diretto', {
            breweryName: breweryData.verifiedData.breweryName,
            qualityScore: qualityScore,
            threshold: 0.6,
            hasWebVerification: !!(breweryData.webVerification?.sourcesFound?.length),
            groundingRequired: false
          });

          return validation;
        } else if (strictGrounding && qualityScore < 0.6) {
          // ⚠️ Quality score basso → verifica se abbiamo almeno grounding web come backup
          const hasGrounding = this.isGrounded(breweryData);
          
          if (hasGrounding) {
            // ✅ Quality score basso MA grounding OK → SALVA con confidence ridotta
            validation.isValid = true;
            validation.action = 'SAVE_DIRECTLY';
            validation.confidence = 0.65; // Confidence forzata più bassa

            logger.info('[AIValidation] Birrificio con quality basso ma grounded - salvataggio', {
              breweryName: breweryData.verifiedData.breweryName,
              qualityScore: qualityScore,
              hasGrounding: true,
              confidence: 0.65
            });

            return validation;
          } else {
            // ❌ Quality score basso E grounding insufficiente → RICHIEDE VERIFICA
            validation.isValid = false;
            validation.action = null;
            validation.requiresUserAction = true;
            validation.issues.push('Quality score basso e grounding web insufficiente');
            validation.userAction = {
              type: 'GROUNDING_REQUIRED',
              title: `Verifica web per "${breweryData.verifiedData.breweryName}"`,
              description: 'Dati AI incompleti e non confermati da fonti web. Verifica necessaria.',
              data: {
                verifiedData: breweryData.verifiedData,
                webVerification: breweryData.webVerification || {},
                searchQueries: breweryData.webVerification?.searchQueries || this.generateSearchQueries(breweryData.labelName),
                qualityScore: qualityScore,
                missingFields: this.findMissingFields(breweryData.verifiedData)
              },
              priority: 'high'
            };

            logger.warn('[AIValidation] Quality basso + grounding insufficiente - richiede verifica', {
              breweryName: breweryData.verifiedData.breweryName,
              qualityScore: qualityScore,
              webVerification: breweryData.webVerification
            });

            return validation;
          }
        } else {
          // Quality score basso ma strict grounding disabilitato → segnala solo warning
          validation.issues.push(`Dati di qualità insufficiente (score: ${qualityScore.toFixed(2)}, richiesto: 0.60)`);
          logger.warn('[AIValidation] Quality score insufficiente per salvataggio automatico', {
            breweryName: breweryData.verifiedData.breweryName,
            qualityScore: qualityScore,
            threshold: 0.6,
            missingFields: this.findMissingFields(breweryData.verifiedData)
          });
        }
      }

      // Check 4: Gestione casi non verificati
      validation.requiresUserAction = true;
      
      if (breweryData.verification === 'UNVERIFIED') {
        validation.userAction = {
          type: 'MANUAL_VERIFICATION',
          title: `Verifica birrificio "${breweryData.labelName}"`,
          description: 'Questo birrificio non è stato trovato online. Verifica se esiste realmente.',
          data: {
            labelName: breweryData.labelName,
            suggestedActions: breweryData.suggestedActions || [],
            searchQueries: this.generateSearchQueries(breweryData.labelName)
          },
          priority: 'high'
        };
      } else if (breweryData.verification === 'CONFLICTING') {
        validation.userAction = {
          type: 'RESOLVE_CONFLICTS',
          title: `Risolvi conflitti per "${breweryData.labelName}"`,
          description: 'Trovati dati contrastanti tra etichetta e ricerche online.',
          data: {
            labelName: breweryData.labelName,
            conflicts: breweryData.conflictingData || [],
            verifiedData: breweryData.verifiedData
          },
          priority: 'medium'
        };
      } else if (breweryData.verification === 'PARTIAL') {
        validation.userAction = {
          type: 'COMPLETE_DATA',
          title: `Completa dati per "${breweryData.labelName}"`,
          description: 'Birrificio trovato ma mancano alcune informazioni importanti.',
          data: {
            labelName: breweryData.labelName,
            partialData: breweryData.verifiedData,
            missingFields: this.findMissingFields(breweryData.verifiedData)
          },
          priority: 'low'
        };
      }

      logger.info('[AIValidation] Birrificio richiede intervento utente', {
        breweryName: breweryData.labelName,
        verification: breweryData.verification,
        actionType: validation.userAction?.type
      });

      return validation;

    } catch (error) {
      logger.error('[AIValidation] Errore validazione birrificio', {
        breweryData: breweryData.labelName,
        error: error.message
      });
      
      validation.issues.push(`Errore tecnico: ${error.message}`);
      validation.requiresUserAction = true;
      validation.userAction = {
        type: 'RETRY',
        title: 'Errore nella verifica',
        description: 'Si è verificato un problema tecnico. Riprova.',
        priority: 'high'
      };
      
      return validation;
    }
  }

  /**
   * Valida una singola birra
   */
  static async validateBeer(beerData, verifiedBreweries) {
    const validation = {
      id: beerData.id,
      type: 'beer',
      originalData: beerData,
      isValid: false,
      action: null,
      requiresUserAction: false,
      confidence: 0,
      issues: [],
      userAction: null
    };

    try {
      // Check 0: CRITICO - Verifica che sia effettivamente una BIRRA e non altro tipo di bevanda
      logger.debug('[AIValidation] detectProductType - Input beerData', {
        labelData: beerData.labelData,
        verifiedData: beerData.verifiedData,
        webVerification: beerData.webVerification
      });
      const productType = this.detectProductType(beerData);
      logger.debug('[AIValidation] detectProductType - Result', { productType });
      if (productType.type !== 'beer') {
        validation.issues.push(`Prodotto non valido: ${productType.type} - ${productType.reason}`);
        validation.requiresUserAction = true;
        validation.userAction = {
          type: 'NON_BEER_DETECTED',
          title: `⚠️ Prodotto non supportato: ${productType.detectedName}`,
          description: `Questa app è dedicata solo alle birre. Il prodotto rilevato è: ${productType.displayType}.`,
          data: {
            productType: productType.type,
            productName: productType.detectedName,
            reason: productType.reason,
            suggestedApp: productType.suggestedApp
          },
          priority: 'critical',
          blocking: true
        };
        
        logger.warn('[AIValidation] ⚠️ Prodotto non-birra rilevato e bloccato', {
          productName: productType.detectedName,
          detectedType: productType.type,
          beerType: beerData.verifiedData?.beerType || beerData.labelData?.beerType,
          reason: productType.reason
        });
        
        return validation;
      }
      
      // Check 1: Il birrificio della birra deve essere verificato
      // Cerca birrificio usando diversi criteri di matching
      const brewery = verifiedBreweries.find(b => {
        const breweryLabelName = b.originalData.labelName?.toLowerCase();
        const breweryVerifiedName = b.originalData.verifiedData?.breweryName?.toLowerCase();
        
        const beerBreweryName = beerData.labelData.breweryName?.toLowerCase();
        const beerVerifiedBreweryName = beerData.verifiedData?.breweryName?.toLowerCase();
        
        // Match per nome da etichetta
        if (beerBreweryName && (breweryLabelName === beerBreweryName || breweryVerifiedName?.includes(beerBreweryName))) {
          return true;
        }
        
        // Match per nome verificato dall'AI
        if (beerVerifiedBreweryName && (breweryVerifiedName?.includes(beerVerifiedBreweryName) || breweryLabelName === beerVerifiedBreweryName)) {
          return true;
        }
        
        return false;
      });
      
      if (!brewery) {
        validation.issues.push('Birrificio non verificato - impossibile validare la birra');
        validation.requiresUserAction = true;
        validation.userAction = {
          type: 'BREWERY_REQUIRED',
          title: `Verifica prima il birrificio per "${beerData.labelData.beerName}"`,
          description: 'Prima di aggiungere questa birra, è necessario verificare il birrificio.',
          priority: 'high'
        };
        
        return validation;
      }

      // Check 2: Verifica qualità dati birra (da AI o da web)
      const beerDataToValidate = beerData.verifiedData || beerData.labelData;
      const qualityScore = this.assessBeerDataQuality(beerDataToValidate);
      
      // Se il birrificio è verificato e i dati birra sono di qualità sufficiente → SALVA
      if (qualityScore >= 0.6) {
        validation.isValid = true;
        validation.action = 'SAVE_DIRECTLY';
        validation.confidence = qualityScore;
        validation.brewery = brewery;
        
        logger.info('[AIValidation] Birra validata - salvataggio diretto', {
          beerName: beerDataToValidate.beerName,
          breweryName: brewery.originalData.labelName,
          qualityScore: qualityScore,
          source: beerData.webVerification ? 'web_verification' : 'ai_analysis'
        });
        
        return validation;
      }
      
      // Check 3: Qualità insufficiente - verifica se ci sono conflitti web
      if (beerData.webVerification?.dataMatch === 'VERIFIED' && qualityScore < 0.6) {
        validation.issues.push('Dati birra di qualità insufficiente');
      }

      // Check 4: Gestione casi non verificati o con problemi
      validation.requiresUserAction = true;
      
      if (beerData.webVerification?.dataMatch === 'UNVERIFIED') {
        validation.userAction = {
          type: 'MANUAL_BEER_VERIFICATION',
          title: `Verifica birra "${beerData.labelData.beerName}"`,
          description: 'Questa birra non è stata trovata nel catalogo del birrificio online.',
          data: {
            beerName: beerData.labelData.beerName,
            breweryName: beerData.labelData.breweryName,
            labelData: beerData.labelData,
            searchQueries: beerData.webVerification?.searchQueries || []
          },
          priority: 'medium'
        };
      } else if (beerData.webVerification?.dataMatch === 'CONFLICTING') {
        validation.userAction = {
          type: 'RESOLVE_BEER_CONFLICTS',
          title: `Risolvi conflitti per "${beerData.labelData.beerName}"`,
          description: 'Trovati dati contrastanti per questa birra.',
          data: {
            beerName: beerData.labelData.beerName,
            conflicts: beerData.webVerification?.conflictingData || [],
            labelData: beerData.labelData,
            verifiedData: beerData.verifiedData
          },
          priority: 'medium'
        };
      }

      // Log solo se effettivamente richiede intervento
      if (validation.requiresUserAction) {
        logger.info('[AIValidation] Birra richiede intervento utente', {
          beerName: beerData.labelData.beerName,
          verification: beerData.webVerification?.dataMatch,
          actionType: validation.userAction?.type,
          reason: validation.issues.join('; ')
        });
      }

      return validation;

    } catch (error) {
      logger.error('[AIValidation] Errore validazione birra', {
        beerName: beerData.labelData?.beerName,
        error: error.message
      });
      
      validation.issues.push(`Errore tecnico: ${error.message}`);
      validation.requiresUserAction = true;
      
      return validation;
    }
  }

  /**
   * Determina il flusso finale per l'utente
   */
  static determineUserFlow(validationResults) {
    const { summary, userActions, verifiedData, unverifiedData } = validationResults;
    
    logger.debug('[AIValidation] determineUserFlow - Check condizioni', {
      verifiedBreweries: summary.verifiedBreweries,
      unverifiedBreweries: summary.unverifiedBreweries,
      verifiedBeers: summary.verifiedBeers,
      unverifiedBeers: summary.unverifiedBeers,
      userActionsCount: userActions.length,
      caso1Check: summary.verifiedBreweries > 0 && summary.unverifiedBreweries === 0 && 
                   summary.verifiedBeers > 0 && summary.unverifiedBeers === 0
    });
    
    // Caso 0: CRITICO - Prodotto non-birra rilevato (BLOCKING)
    const nonBeerAction = userActions.find(action => 
      action && action.type === 'NON_BEER_DETECTED' && action.blocking === true
    );
    
    if (nonBeerAction) {
      validationResults.blockedByValidation = true;
      validationResults.errorMessages.push(
        `⚠️ ${nonBeerAction.title}: ${nonBeerAction.description}`
      );
      validationResults.errorType = 'NO_BEER_DETECTED';
      validationResults.errorDetails = nonBeerAction.data;
      
      logger.error('[AIValidation] ❌ Flusso bloccato - prodotto non-birra rilevato', {
        productType: nonBeerAction.data?.productType,
        productName: nonBeerAction.data?.productName,
        reason: nonBeerAction.data?.reason
      });
      
      return validationResults;
    }
    
    // Caso 1: Tutto verificato - salvataggio diretto
    if (summary.verifiedBreweries > 0 && summary.unverifiedBreweries === 0 && 
        summary.verifiedBeers > 0 && summary.unverifiedBeers === 0) {
      validationResults.canSaveDirectly = true;
      validationResults.successMessage = `Analisi completata: ${summary.verifiedBreweries} birrifici e ${summary.verifiedBeers} birre verificati. Procedi con il salvataggio.`;
      
      logger.info('[AIValidation] Flusso diretto - tutto verificato', {
        verifiedBreweries: summary.verifiedBreweries,
        verifiedBeers: summary.verifiedBeers
      });
      
      return validationResults;
    }

    // Caso 2: Dati parzialmente verificati - richiede conferma utente
    if (summary.verifiedBreweries > 0 && summary.verifiedBeers > 0 && userActions.length > 0) {
      validationResults.requiresUserConfirmation = true;
      validationResults.warningMessage = `Trovati ${summary.verifiedBreweries} birrifici e ${summary.verifiedBeers} birre verificati, ma ${userActions.length} elementi richiedono la tua verifica.`;
      
      return validationResults;
    }

    // Caso 3: Nulla verificato automaticamente - richiede completamento manuale
    if (summary.verifiedBreweries === 0 || summary.verifiedBeers === 0) {
      validationResults.requiresUserCompletion = true;
      
      if (summary.totalBreweries === 0) {
        validationResults.errorMessages.push('Nessun birrificio identificato nell\'immagine.');
      } else {
        validationResults.infoMessage = 'Non sono riuscito a verificare automaticamente birrifici e birre. Il tuo aiuto è necessario per completare l\'analisi.';
      }
      
      return validationResults;
    }

    // Caso 4: Errori bloccanti
    if (validationResults.errorMessages.length > 0) {
      validationResults.blockedByValidation = true;
      
      return validationResults;
    }

    // Default: richiede completamento
    validationResults.requiresUserCompletion = true;
    validationResults.infoMessage = 'Analisi completata ma richiede la tua verifica prima del salvataggio.';
    
    return validationResults;
  }

  /**
   * Utility functions
   */
  static findExistingBrewery(breweryName, existingBreweries) {
    if (!breweryName || !existingBreweries) return null;
    
    const searchName = breweryName.toLowerCase().trim();
    
    // 1. Exact match (case-insensitive)
    let match = existingBreweries.find(b => 
      b.breweryName && b.breweryName.toLowerCase().trim() === searchName
    );
    if (match) return match;
    
    // 2. Match senza "Birrificio" / "Brewery" prefix
    const cleanSearchName = searchName
      .replace(/^(birrificio|brewery|birra|beer)\s+/i, '')
      .replace(/\s+(birrificio|brewery)$/i, '');
    
    match = existingBreweries.find(b => {
      if (!b.breweryName) return false;
      const cleanDbName = b.breweryName.toLowerCase().trim()
        .replace(/^(birrificio|brewery|birra|beer)\s+/i, '')
        .replace(/\s+(birrificio|brewery)$/i, '');
      return cleanDbName === cleanSearchName;
    });
    if (match) return match;
    
    // 3. Fuzzy match con tolleranza per accenti e varianti ortografiche
    match = existingBreweries.find(b => {
      if (!b.breweryName) return false;
      const dbName = b.breweryName.toLowerCase().trim()
        .replace(/^(birrificio|brewery|birra|beer)\s+/i, '');
      
      // Normalizza accenti per confronto
      const normalizeAccents = (str) => str
        .replace(/[àáâãäå]/g, 'a')
        .replace(/[èéêë]/g, 'e')
        .replace(/[ìíîï]/g, 'i')
        .replace(/[òóôõö]/g, 'o')
        .replace(/[ùúûü]/g, 'u');
      
      const normalizedDb = normalizeAccents(dbName);
      const normalizedSearch = normalizeAccents(cleanSearchName);
      
      return normalizedDb === normalizedSearch;
    });
    if (match) return match;
    
    // 4. Substring match (contiene il nome cercato o viceversa)
    match = existingBreweries.find(b => {
      if (!b.breweryName) return false;
      const dbName = b.breweryName.toLowerCase().trim();
      
      // Verifica se uno contiene l'altro (minimo 5 caratteri per evitare false positive)
      if (cleanSearchName.length >= 5 && dbName.includes(cleanSearchName)) return true;
      if (cleanSearchName.length >= 5 && cleanSearchName.includes(dbName)) return true;
      
      return false;
    });
    
    return match || null;
  }

  static assessDataQuality(breweryData, rawBreweryData = {}) {
    // 🎯 NUOVO ALGORITMO: Più permissivo ma intelligente
    // Requirement minimo: breweryName + (website OR legalAddress OR description)
    
    let score = 0;
    let maxScore = 10; // Aumentato per granularità maggiore

    // CAMPO OBBLIGATORIO (blocca se manca)
    if (!breweryData.breweryName) {
      return 0; // Senza nome non si salva MAI
    }
    score += 3; // Nome presente = 30% base score

    // DATI IDENTIFICATIVI (almeno 1 deve essere presente)
    let hasIdentifiers = false;
    // Solo consideriamo website come identificativo se è web-grounded (se presente nelle sorgenti)
    const webVerification = rawBreweryData.webVerification || {};
    const webVerified = webVerification.dataMatch === 'VERIFIED' && Array.isArray(webVerification.sourcesFound) && webVerification.sourcesFound.length > 0;

    if (breweryData.breweryWebsite) {
      // Se siamo in modalità strict, richiediamo che il sito sia tra le fonti trovate
      if (webVerified && this.websiteMatchesSources(breweryData.breweryWebsite, webVerification.sourcesFound)) {
        score += 3; // 30% - Aumentato perché un sito web verificato è un identificativo forte
        hasIdentifiers = true;
      } else if (breweryData.breweryWebsite) {
        // Anche se non è nelle fonti, un website è comunque un buon identificativo
        score += 2; // 20%
        hasIdentifiers = true;
      }
    }
    if (breweryData.breweryLegalAddress && breweryData.breweryLegalAddress !== 'Non specificato') {
      // Validazione qualità indirizzo
      if (this.isValidAddress(breweryData.breweryLegalAddress)) {
        score += 2.5; // 25% - Bonus maggiore per indirizzo completo e valido
        hasIdentifiers = true;
      } else {
        // Indirizzo presente ma sospetto/incompleto
        score += 0.5; // 5% - Penalità per indirizzo di bassa qualità
        logger.debug('[assessDataQuality] Indirizzo presente ma qualità bassa', {
          address: breweryData.breweryLegalAddress
        });
      }
    }
    if (breweryData.breweryDescription && breweryData.breweryDescription.length > 50) {
      score += 1.5; // 15%
      hasIdentifiers = true;
    }
    
    // Se non ha NESSUN identificativo oltre al nome, score basso
    if (!hasIdentifiers) {
      return 0.3; // 30% - Troppo poco per salvataggio automatico
    }

    // DATI DI CONTATTO (bonus points) - li premiamo solo se sembrano plausibili
    if (breweryData.breweryEmail) {
      // email considerata valida se dominio coerente con website (se presente) oppure se webVerified
      try {
        const emailDomain = breweryData.breweryEmail.split('@')[1];
        if (breweryData.breweryWebsite) {
          const siteDomain = this.extractDomain(breweryData.breweryWebsite);
          if (siteDomain && emailDomain && emailDomain.toLowerCase().includes(siteDomain.replace(/^www\./, '').toLowerCase())) {
            score += 1; // 10%
          }
        } else if (webVerified) {
          // se non c'è website ma la verifica web è positiva, premiamo debolmente
          score += 0.5;
        }
      } catch (e) {
        // ignore
      }
    }
    if (breweryData.breweryPhoneNumber) {
      // semplice check su numeri (almeno 7 cifre)
      const digits = ('' + breweryData.breweryPhoneNumber).replace(/\D/g, '');
      if (digits.length >= 7) score += 0.5; // 5%
    }

    // DATI STORICI/DESCRITTIVI (bonus points)
    if (breweryData.foundingYear) score += 0.5; // 5%
    if (breweryData.mainProducts && breweryData.mainProducts.length > 0) score += 0.5; // 5%
    if (breweryData.brewerySocialMedia && 
        (breweryData.brewerySocialMedia.facebook || 
         breweryData.brewerySocialMedia.instagram)) {
      score += 0.5; // 5%
    }

    // BONUS per alta confidence AI (ma non sufficiente da sola)
    if (breweryData.confidence && breweryData.confidence >= 0.9) {
      score += 0.5; // 5% bonus per alta confidence
    }

    const finalScore = Math.min(1, score / maxScore);
    
    // Log per debugging
    logger.debug('[assessDataQuality] Score calcolato', {
      breweryName: breweryData.breweryName,
      hasWebsite: !!breweryData.breweryWebsite,
      hasAddress: !!breweryData.breweryLegalAddress,
      hasDescription: !!breweryData.breweryDescription,
      hasIdentifiers: hasIdentifiers,
      rawScore: score,
      maxScore: maxScore,
      finalScore: finalScore,
      threshold: 0.6
    });

    return finalScore;
  }

  /**
   * Restituisce true se almeno una delle fonti web contiene il dominio del sito indicato
   */
  static websiteMatchesSources(website, sources = []) {
    try {
      const siteDomain = this.extractDomain(website);
      if (!siteDomain) return false;
      return sources.some(src => {
        try {
          const srcDomain = this.extractDomain(src);
          if (!srcDomain) return false;
          return srcDomain.includes(siteDomain.replace(/^www\./, '')) || siteDomain.includes(srcDomain.replace(/^www\./, ''));
        } catch (e) {
          return false;
        }
      });
    } catch (e) {
      return false;
    }
  }

  static extractDomain(url) {
    if (!url) return null;
    try {
      // Aggiusta casi mancanti di protocollo
      if (!/^https?:\/\//i.test(url)) url = 'http://' + url;
      const u = new URL(url);
      return u.hostname.toLowerCase();
    } catch (e) {
      return null;
    }
  }

  /**
   * 🔒 GROUNDING COMPLETO SU TUTTI I CAMPI SENSIBILI
   * Verifica che TUTTI i dati estratti dall'AI siano ancorati a fonti web reali
   * 
   * FILOSOFIA: Se l'AI non ha trovato NESSUNA fonte web, NON può inventare dati.
   * Solo i dati verificabili tramite fonti reali possono essere salvati.
   */
  static isGrounded(breweryData) {
    try {
      const webVerification = breweryData.webVerification || {};
      const sources = Array.isArray(webVerification.sourcesFound) ? webVerification.sourcesFound : [];
      const verifiedData = breweryData.verifiedData || {};
      const confidence = verifiedData.confidence || 0;

      // 🚨 REGOLA #1: Se non ci sono fonti web, NESSUN dato è grounded
      if (!sources.length) {
        logger.warn('[isGrounded] Nessuna fonte web trovata - dati non grounded');
        return false;
      }

      // 🚨 REGOLA #2: Confidence minima globale 0.6 per salvare dati AI
      if (confidence < 0.6) {
        logger.warn('[isGrounded] Confidence troppo bassa per salvare dati AI', {
          confidence: confidence,
          threshold: 0.6
        });
        return false;
      }

      // 🔍 VALIDAZIONE CAMPO PER CAMPO
      
      // 1️⃣ BREWERY WEBSITE - DEVE corrispondere alle fonti
      if (verifiedData.breweryWebsite) {
        if (!this.websiteMatchesSources(verifiedData.breweryWebsite, sources)) {
          logger.warn('[isGrounded] Website non trovato nelle fonti web', {
            website: verifiedData.breweryWebsite,
            sources: sources
          });
          return false;
        }
      }

      // 2️⃣ BREWERY EMAIL - Dominio deve essere coerente con website
      if (verifiedData.breweryEmail) {
        const email = verifiedData.breweryEmail;
        const emailDomain = ('' + email).split('@')[1];
        
        // Se c'è un website, verifica coerenza dominio
        if (verifiedData.breweryWebsite) {
          const siteDomain = this.extractDomain(verifiedData.breweryWebsite);
          if (siteDomain && emailDomain) {
            const siteBase = siteDomain.replace(/^www\./, '').toLowerCase();
            if (!emailDomain.toLowerCase().includes(siteBase)) {
              logger.warn('[isGrounded] Email domain non coerente con website', {
                email: email,
                emailDomain: emailDomain,
                websiteDomain: siteDomain
              });
              return false;
            }
          }
        }
        
        // Email DEVE avere formato valido
        if (!this.isValidEmail(email)) {
          logger.warn('[isGrounded] Email formato non valido', { email: email });
          return false;
        }
      }

      // 3️⃣ BREWERY LEGAL ADDRESS - DEVE essere completo e verificato
      if (verifiedData.breweryLegalAddress) {
        const address = verifiedData.breweryLegalAddress;
        
        if (!this.isValidAddress(address)) {
          logger.warn('[isGrounded] Indirizzo non valido o troppo generico', {
            address: address,
            reason: 'Indirizzo manca di dettagli necessari (via, numero, città)'
          });
          return false;
        }
      }

      // 4️⃣ BREWERY PHONE NUMBER - Formato valido italiano/internazionale
      if (verifiedData.breweryPhoneNumber) {
        if (!this.isValidPhoneNumber(verifiedData.breweryPhoneNumber)) {
          logger.warn('[isGrounded] Numero telefono non valido', {
            phone: verifiedData.breweryPhoneNumber
          });
          return false;
        }
      }

      // 5️⃣ FOUNDING YEAR - Deve essere ragionevole (dopo 1000 DC, non futuro)
      if (verifiedData.foundingYear) {
        const year = parseInt(verifiedData.foundingYear);
        const currentYear = new Date().getFullYear();
        if (isNaN(year) || year < 1000 || year > currentYear) {
          logger.warn('[isGrounded] Anno fondazione non plausibile', {
            foundingYear: verifiedData.foundingYear,
            currentYear: currentYear
          });
          return false;
        }
      }

      // 6️⃣ SOCIAL MEDIA - URL devono essere validi
      if (verifiedData.brewerySocialMedia) {
        const social = verifiedData.brewerySocialMedia;
        
        if (social.facebook && !this.isValidUrl(social.facebook)) {
          logger.warn('[isGrounded] Facebook URL non valido', { url: social.facebook });
          return false;
        }
        if (social.instagram && !this.isValidUrl(social.instagram)) {
          logger.warn('[isGrounded] Instagram URL non valido', { url: social.instagram });
          return false;
        }
        if (social.twitter && !this.isValidUrl(social.twitter)) {
          logger.warn('[isGrounded] Twitter URL non valido', { url: social.twitter });
          return false;
        }
      }

      // 7️⃣ DESCRIPTION - Non deve essere troppo corta o placeholder
      if (verifiedData.breweryDescription) {
        const desc = verifiedData.breweryDescription.trim();
        const suspiciousDescriptions = [
          /^birrificio$/i,
          /^produttore di birra$/i,
          /^non disponibile$/i,
          /^n\/a$/i,
          /^\.+$/
        ];
        
        if (desc.length < 10) {
          logger.warn('[isGrounded] Descrizione troppo corta', { 
            description: desc,
            length: desc.length 
          });
          return false;
        }
        
        for (const pattern of suspiciousDescriptions) {
          if (pattern.test(desc)) {
            logger.warn('[isGrounded] Descrizione sospetta/placeholder', { description: desc });
            return false;
          }
        }
      }

      // ✅ TUTTI I CONTROLLI PASSATI - Dati grounded
      logger.info('[isGrounded] ✅ Tutti i campi validati - dati grounded', {
        breweryName: verifiedData.breweryName,
        confidence: confidence,
        sourcesCount: sources.length
      });
      
      return true;
    } catch (e) {
      logger.error('[isGrounded] Errore durante validazione grounding', { error: e.message });
      return false;
    }
  }

  /**
   * Valida che un indirizzo sia sufficientemente dettagliato e non inventato
   * @param {string} address - Indirizzo da validare
   * @returns {boolean} - true se l'indirizzo è valido
   */
  static isValidAddress(address) {
    if (!address || address === 'Non specificato' || address === '' || address.length < 10) {
      return false;
    }

    // Pattern sospetti che indicano indirizzi inventati o troppo generici
    const suspiciousPatterns = [
      /^via\s+dei\s+birrai/i,  // "Via dei Birrai" è troppo generico
      /^via\s+della\s+birra/i, // "Via della Birra" è troppo generico
      /^sede\s+(legale|operativa)/i, // "Sede legale" senza indirizzo
      /^presso/i,              // "Presso..." senza dettagli
      /^c\/o/i,                // "c/o" senza indirizzo completo
      /^[a-z\s]+,\s*italia$/i  // Solo "Città, Italia" senza via
    ];

    for (const pattern of suspiciousPatterns) {
      if (pattern.test(address)) {
        logger.debug('[isValidAddress] Indirizzo bloccato per pattern sospetto', {
          address: address,
          pattern: pattern.toString()
        });
        return false;
      }
    }

    // Verifica presenza elementi essenziali con validazione FLESSIBILE
    const hasStreetName = /via|viale|piazza|corso|strada|contrada|località|borgo|frazione|regione/i.test(address);
    const hasNumber = /\d+/.test(address);
    const hasCityOrProvince = /[A-Za-z]{2,}(?:\)|,|\s|$)/i.test(address) || // Provincia (BI), (ao), etc - case insensitive
                               address.split(',').length >= 2;       // Almeno "via, città"
    
    // 🔓 VALIDAZIONE FLESSIBILE: Accetta vari formati di indirizzo valido
    // 1. Formato completo: tipo strada + numero + città/provincia
    // 2. Formato semplificato: numero + almeno 2 parti (es: "Molignati 12, Candelo")
    // 3. Formato breve: numero + provincia (es: "12, Candelo (BI)")
    const isComplete = (hasStreetName && hasNumber && hasCityOrProvince) || 
                       (hasNumber && address.split(',').length >= 2) ||
                       (hasNumber && hasCityOrProvince);

    if (!isComplete) {
      logger.debug('[isValidAddress] Indirizzo incompleto', {
        address: address,
        hasStreetName: hasStreetName,
        hasNumber: hasNumber,
        hasCityOrProvince: hasCityOrProvince,
        parts: address.split(',').length
      });
    }

    return isComplete;
  }

  /**
   * Valida formato email
   * @param {string} email - Email da validare
   * @returns {boolean} - true se email valida
   */
  static isValidEmail(email) {
    if (!email || typeof email !== 'string') return false;
    
    // Pattern base per validazione email
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(email)) return false;
    
    // Blocca email sospette/placeholder
    const suspiciousEmails = [
      /^info@example\./i,
      /^contact@example\./i,
      /^email@birrificio\./i,
      /^noreply@/i,
      /^test@/i
    ];
    
    for (const pattern of suspiciousEmails) {
      if (pattern.test(email)) {
        logger.debug('[isValidEmail] Email sospetta/placeholder bloccata', { email: email });
        return false;
      }
    }
    
    return true;
  }

  /**
   * Valida numero di telefono italiano/internazionale
   * @param {string} phone - Numero telefono da validare
   * @returns {boolean} - true se telefono valido
   */
  static isValidPhoneNumber(phone) {
    if (!phone || typeof phone !== 'string') return false;
    
    // Rimuovi spazi e caratteri comuni per normalizzare
    const normalized = phone.replace(/[\s\-\(\)\.]/g, '');
    
    // Deve contenere almeno 6 cifre e massimo 15 (standard internazionale)
    const digits = normalized.replace(/\D/g, '');
    if (digits.length < 6 || digits.length > 15) {
      logger.debug('[isValidPhoneNumber] Numero cifre fuori range', { 
        phone: phone,
        digitsCount: digits.length 
      });
      return false;
    }
    
    // Pattern validi: +39, 0039, numeri italiani, numeri internazionali
    const validPatterns = [
      /^\+\d{6,15}$/,           // Formato internazionale +39...
      /^00\d{6,15}$/,           // Formato internazionale 0039...
      /^0\d{6,11}$/,            // Numero italiano fisso (0... seguito da 6-11 cifre)
      /^3\d{8,9}$/              // Numero italiano mobile (3... seguito da 8-9 cifre)
    ];
    
    const isValid = validPatterns.some(pattern => pattern.test(normalized));
    
    if (!isValid) {
      logger.debug('[isValidPhoneNumber] Formato non valido', { 
        phone: phone,
        normalized: normalized 
      });
    }
    
    return isValid;
  }

  /**
   * Valida formato URL generico
   * @param {string} url - URL da validare
   * @returns {boolean} - true se URL valido
   */
  static isValidUrl(url) {
    if (!url || typeof url !== 'string') return false;
    
    try {
      // Aggiunge protocollo se mancante per validazione
      const urlToTest = /^https?:\/\//i.test(url) ? url : `https://${url}`;
      const parsed = new URL(urlToTest);
      
      // Deve avere almeno hostname valido
      if (!parsed.hostname || parsed.hostname.length < 3) return false;
      
      // Blocca URL placeholder comuni
      const suspiciousHosts = [
        'example.com',
        'example.org',
        'test.com',
        'placeholder.com',
        'yourwebsite.com'
      ];
      
      if (suspiciousHosts.includes(parsed.hostname.toLowerCase())) {
        logger.debug('[isValidUrl] URL placeholder bloccato', { url: url });
        return false;
      }
      
      return true;
    } catch (e) {
      logger.debug('[isValidUrl] URL non parsabile', { url: url, error: e.message });
      return false;
    }
  }

  static assessBeerDataQuality(beerData) {
    // DATI OBBLIGATORI (devono essere presenti)
    if (!beerData.beerName) {
      return 0; // Senza nome birra non possiamo salvare
    }

    // Score base per dati obbligatori presenti
    let score = 1.0; // beerName presente = 100% base score
    
    // DATI OPZIONALI (migliorano lo score ma non sono necessari)
    let bonusScore = 0;
    let maxBonus = 0.5; // Max 50% bonus per dati extra
    
    if (beerData.alcoholContent) bonusScore += 0.15;
    if (beerData.beerType) bonusScore += 0.15;
    if (beerData.volume) bonusScore += 0.10;
    if (beerData.description) bonusScore += 0.10;
    
    // Score finale = base + bonus (cappato a 1.0)
    const finalScore = Math.min(1.0, score + bonusScore);
    
    return finalScore;
  }

  static findMissingFields(data) {
    const missing = [];
    
    // OBBLIGATORIO ASSOLUTO
    if (!data.breweryName) {
      missing.push({ 
        field: 'breweryName', 
        priority: 'critical', 
        label: this.getFieldLabel('breweryName'),
        reason: 'Campo obbligatorio - impossibile salvare senza nome'
      });
    }
    
    // IDENTIFICATIVI (almeno 1 richiesto)
    const hasIdentifiers = 
      data.breweryWebsite || 
      (data.breweryLegalAddress && data.breweryLegalAddress !== 'Non specificato') ||
      (data.breweryDescription && data.breweryDescription.length > 50);
    
    if (!hasIdentifiers) {
      if (!data.breweryWebsite) {
        missing.push({ 
          field: 'breweryWebsite', 
          priority: 'high', 
          label: this.getFieldLabel('breweryWebsite'),
          reason: 'Almeno un identificativo richiesto (website, indirizzo o descrizione)'
        });
      }
      if (!data.breweryLegalAddress || data.breweryLegalAddress === 'Non specificato') {
        missing.push({ 
          field: 'breweryLegalAddress', 
          priority: 'high', 
          label: this.getFieldLabel('breweryLegalAddress'),
          reason: 'Almeno un identificativo richiesto (website, indirizzo o descrizione)'
        });
      }
      if (!data.breweryDescription || data.breweryDescription.length <= 50) {
        missing.push({ 
          field: 'breweryDescription', 
          priority: 'high', 
          label: this.getFieldLabel('breweryDescription'),
          reason: 'Almeno un identificativo richiesto (website, indirizzo o descrizione > 50 caratteri)'
        });
      }
    }
    
    // OPZIONALI CONSIGLIATI (migliorano score)
    const optionalFields = [
      { field: 'breweryEmail', priority: 'medium', reason: 'Contatto utile per comunicazioni' },
      { field: 'breweryPhoneNumber', priority: 'low', reason: 'Contatto alternativo' },
      { field: 'foundingYear', priority: 'low', reason: 'Info storica interessante' },
      { field: 'mainProducts', priority: 'low', reason: 'Lista prodotti birrificio' }
    ];
    
    optionalFields.forEach(({ field, priority, reason }) => {
      if (!data[field] || (Array.isArray(data[field]) && data[field].length === 0)) {
        missing.push({ 
          field, 
          priority, 
          label: this.getFieldLabel(field),
          reason
        });
      }
    });
    
    return missing;
  }

  static getFieldLabel(field) {
    const labels = {
      breweryName: 'Nome birrificio',
      breweryWebsite: 'Sito web',
      breweryLegalAddress: 'Indirizzo',
      breweryEmail: 'Email',
      breweryPhoneNumber: 'Telefono',
      foundingYear: 'Anno di fondazione'
    };
    
    return labels[field] || field;
  }

  static generateSearchQueries(breweryName) {
    return [
      `"${breweryName}" brewery`,
      `"${breweryName}" birrificio`,
      `${breweryName} brewery website`,
      `${breweryName} craft beer`
    ];
  }

  /**
   * Rileva se il prodotto è una birra o un altro tipo di bevanda alcolica
   * @param {Object} beerData - Dati del prodotto da validare
   * @returns {Object} Tipo di prodotto e informazioni di dettaglio
   */
  static detectProductType(beerData) {
    const verifiedData = beerData.verifiedData || {};
    const labelData = beerData.labelData || {};
    const webVerification = beerData.webVerification || {};
    
    // Normalizza i dati per il controllo
    const beerType = (verifiedData.beerType || labelData.beerStyle || '').toLowerCase();
    const beerName = (verifiedData.beerName || labelData.beerName || '').toLowerCase();
    const description = (verifiedData.description || '').toLowerCase();
    const otherText = (labelData.otherText || '').toLowerCase();
    const ingredients = (verifiedData.ingredients || '').toLowerCase();
    // 🆕 FIX 21 Dicembre 2025: Aggiunto readingNotes per catturare "liqueur" e simili
    const readingNotes = (labelData.readingNotes || '').toLowerCase();
    
    // Categorie di bevande NON-birra
    const liquorKeywords = [
      'liquore', 'liqueur', 'amaretto', 'grappa', 'brandy', 
      'cognac', 'whisky', 'whiskey', 'rum', 'vodka', 'gin', 'tequila',
      'limoncello', 'sambuca', 'vermouth', 'aperitivo', 'digestivo',
      'distillato', 'distilled', 'spirit', 'alchermes', 'nocino'
    ];
    
    // Keyword "amaro" richiede controllo contestuale (può essere liquore O gusto birra)
    const amaroContextKeywords = ['liquore amaro', 'amaro alle', 'amaro di', 'amaro del'];
    
    const wineKeywords = [
      'vino', 'wine', 'prosecco', 'spumante', 'champagne', 'chardonnay',
      'merlot', 'cabernet', 'pinot', 'barolo', 'chianti', 'lambrusco',
      'vermentino', 'sangiovese', 'uva', 'grape', 'vendemmia', 'cantina'
    ];
    
    const ciderKeywords = [
      'cidre', 'cider', 'sidro', 'mele', 'apple', 'pera', 'pear'
    ];
    
    // Check 1: Verifica beerType esplicito
    for (const keyword of liquorKeywords) {
      if (beerType.includes(keyword)) {
        return {
          type: 'liquor',
          displayType: 'Liquore/Distillato',
          detectedName: verifiedData.beerName || labelData.beerName || 'Prodotto sconosciuto',
          reason: `Tipo prodotto identificato come "${beerType}" (liquore/distillato)`,
          suggestedApp: 'App dedicata a liquori e distillati',
          confidence: 0.95
        };
      }
    }
    
    for (const keyword of wineKeywords) {
      if (beerType.includes(keyword)) {
        return {
          type: 'wine',
          displayType: 'Vino',
          detectedName: verifiedData.beerName || labelData.beerName || 'Prodotto sconosciuto',
          reason: `Tipo prodotto identificato come "${beerType}" (vino)`,
          suggestedApp: 'App dedicata a vini',
          confidence: 0.95
        };
      }
    }
    
    for (const keyword of ciderKeywords) {
      if (beerType.includes(keyword)) {
        return {
          type: 'cider',
          displayType: 'Sidro/Cidro',
          detectedName: verifiedData.beerName || labelData.beerName || 'Prodotto sconosciuto',
          reason: `Tipo prodotto identificato come "${beerType}" (sidro)`,
          suggestedApp: 'App dedicata a sidri',
          confidence: 0.90
        };
      }
    }
    
    // Check 2: Verifica descrizione (con controllo contestuale per "amaro")
    // 🆕 FIX 21 Dicembre 2025: Aggiunto readingNotes al controllo
    for (const keyword of liquorKeywords) {
      if (description.includes(keyword) || otherText.includes(keyword) || readingNotes.includes(keyword)) {
        return {
          type: 'liquor',
          displayType: 'Liquore/Distillato',
          detectedName: verifiedData.beerName || labelData.beerName || 'Prodotto sconosciuto',
          reason: `Descrizione/readingNotes contiene parola chiave liquore: "${keyword}"`,
          suggestedApp: 'App dedicata a liquori e distillati',
          confidence: 0.85
        };
      }
    }
    
    // Check 2b: Controllo contestuale per "amaro" - distingue tra liquore e gusto birra
    if (description.includes('amaro') || otherText.includes('amaro')) {
      // Verifica se "amaro" è usato in contesto liquore (es: "liquore amaro", "amaro alle erbe")
      const isLiquorContext = amaroContextKeywords.some(ctx => 
        description.includes(ctx) || otherText.includes(ctx)
      );
      
      // Verifica se "amaro" è usato in contesto birra (es: "finale amaro", "gusto amaro", "note amare")
      const isBeerTasteContext = 
        description.includes('finale amaro') ||
        description.includes('gusto amaro') ||
        description.includes('note amare') ||
        description.includes('leggero amaro') ||
        description.includes('leggermente amaro') ||
        description.includes('piacevole amaro') ||
        description.includes('amaro finale') ||
        otherText.includes('finale amaro') ||
        otherText.includes('gusto amaro');
      
      // Blocca SOLO se è contesto liquore E NON è contesto gusto birra
      if (isLiquorContext && !isBeerTasteContext) {
        return {
          type: 'liquor',
          displayType: 'Liquore/Distillato (Amaro)',
          detectedName: verifiedData.beerName || labelData.beerName || 'Prodotto sconosciuto',
          reason: `Descrizione indica liquore amaro in contesto non-birra`,
          suggestedApp: 'App dedicata a liquori e distillati',
          confidence: 0.90
        };
      }
      
      // Se è solo contesto gusto birra, continua (è una birra normale)
    }
    
    // 🆕 Check 2c: Verifica wine keywords in description/otherText/readingNotes
    for (const keyword of wineKeywords) {
      if (description.includes(keyword) || otherText.includes(keyword) || readingNotes.includes(keyword)) {
        return {
          type: 'wine',
          displayType: 'Vino',
          detectedName: verifiedData.beerName || labelData.beerName || 'Prodotto sconosciuto',
          reason: `Descrizione/readingNotes contiene parola chiave vino: "${keyword}"`,
          suggestedApp: 'App dedicata a vini',
          confidence: 0.85
        };
      }
    }
    
    // 🆕 Check 2d: Verifica cider keywords in description/otherText/readingNotes
    for (const keyword of ciderKeywords) {
      if (description.includes(keyword) || otherText.includes(keyword) || readingNotes.includes(keyword)) {
        return {
          type: 'cider',
          displayType: 'Sidro/Cidro',
          detectedName: verifiedData.beerName || labelData.beerName || 'Prodotto sconosciuto',
          reason: `Descrizione/readingNotes contiene parola chiave sidro: "${keyword}"`,
          suggestedApp: 'App dedicata a sidri',
          confidence: 0.85
        };
      }
    }
    
    // Check 3: Verifica conflitti web verification
    if (webVerification.dataMatch === 'CONFLICTING' && webVerification.conflictingData) {
      for (const conflict of webVerification.conflictingData) {
        const conflictText = conflict.toLowerCase();
        
        // Check se il conflitto menziona esplicitamente che non è una birra
        if (conflictText.includes('non') && conflictText.includes('birra')) {
          // Determina il tipo dal conflitto
          for (const keyword of liquorKeywords) {
            if (conflictText.includes(keyword)) {
              return {
                type: 'liquor',
                displayType: 'Liquore/Distillato',
                detectedName: verifiedData.beerName || labelData.beerName || 'Prodotto sconosciuto',
                reason: `Verifica web conferma: non è una birra ma un liquore`,
                suggestedApp: 'App dedicata a liquori e distillati',
                confidence: 0.90
              };
            }
          }
          
          for (const keyword of wineKeywords) {
            if (conflictText.includes(keyword)) {
              return {
                type: 'wine',
                displayType: 'Vino',
                detectedName: verifiedData.beerName || labelData.beerName || 'Prodotto sconosciuto',
                reason: `Verifica web conferma: non è una birra ma un vino`,
                suggestedApp: 'App dedicata a vini',
                confidence: 0.90
              };
            }
          }
        }
      }
    }
    
    // Check 4: Verifica requiresManualCheck con ragioni specifiche
    if (beerData.requiresManualCheck && beerData.manualCheckReason) {
      const checkReason = beerData.manualCheckReason.toLowerCase();
      
      if (checkReason.includes('liquore') || checkReason.includes('liqueur')) {
        return {
          type: 'liquor',
          displayType: 'Liquore/Distillato',
          detectedName: verifiedData.beerName || labelData.beerName || 'Prodotto sconosciuto',
          reason: `Controllo manuale richiesto: ${beerData.manualCheckReason}`,
          suggestedApp: 'App dedicata a liquori e distillati',
          confidence: 0.85
        };
      }
    }
    
    // Default: assume sia una birra se nessun indicatore negativo
    return {
      type: 'beer',
      displayType: 'Birra',
      detectedName: verifiedData.beerName || labelData.beerName || 'Birra',
      reason: 'Nessun indicatore di prodotto non-birra rilevato',
      confidence: 0.70
    };
  }

  /**
   * Cerca suggerimenti per completamento automatico
   */
  static async searchSuggestions(options = {}) {
    try {
      const { type, breweryName, beerName } = options;
      
      logger.info('[AIValidation] Ricerca suggerimenti', {
        type,
        breweryName,
        beerName
      });

      const suggestions = [];

      if (type === 'brewery' && breweryName) {
        // Cerca birrifici simili nel database
        const breweries = await Brewery.find({
          breweryName: { $regex: breweryName, $options: 'i' }
        }).limit(10);

        breweries.forEach(brewery => {
          suggestions.push({
            type: 'brewery',
            id: brewery._id,
            name: brewery.breweryName,
            address: brewery.breweryAddress,
            confidence: 0.8,
            source: 'database'
          });
        });

        // Aggiungi suggerimenti generici se pochi risultati
        if (suggestions.length < 5) {
          suggestions.push({
            type: 'brewery',
            name: `${breweryName} Brewery`,
            confidence: 0.6,
            source: 'generated'
          });
          suggestions.push({
            type: 'brewery',
            name: `Birrificio ${breweryName}`,
            confidence: 0.5,
            source: 'generated'
          });
        }
      }

      if (type === 'beer' && beerName) {
        // Cerca birre simili nel database
        const breweries = await Brewery.find({
          'breweryProducts.beerName': { $regex: beerName, $options: 'i' }
        }).limit(10);

        breweries.forEach(brewery => {
          brewery.breweryProducts.forEach(beer => {
            if (beer.beerName.toLowerCase().includes(beerName.toLowerCase())) {
              suggestions.push({
                type: 'beer',
                id: beer._id,
                name: beer.beerName,
                breweryName: brewery.breweryName,
                type: beer.beerType,
                confidence: 0.8,
                source: 'database'
              });
            }
          });
        });
      }

      return suggestions;

    } catch (error) {
      logger.error('[AIValidation] Errore ricerca suggerimenti:', error);
      return [];
    }
  }
}

module.exports = AIValidationService;