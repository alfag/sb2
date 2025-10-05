const logWithFileName = require('../utils/logger');
const Brewery = require('../models/Brewery');
const Beer = require('../models/Beer');
const logger = logWithFileName(__filename);

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
          
          if (breweryValidation.isValid && breweryValidation.action === 'SAVE_DIRECTLY') {
            validationResults.verifiedData.breweries.push(breweryValidation);
            validationResults.summary.verifiedBreweries++;
          } else {
            validationResults.unverifiedData.breweries.push(breweryValidation);
            validationResults.summary.unverifiedBreweries++;
            
            if (breweryValidation.requiresUserAction) {
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
            
            if (beerValidation.requiresUserAction) {
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
        const qualityScore = this.assessDataQuality(breweryData.verifiedData);
        
        if (qualityScore >= 0.8) {
          validation.isValid = true;
          validation.action = 'SAVE_DIRECTLY';
          validation.confidence = qualityScore;
          
          logger.info('[AIValidation] Nuovo birrificio verificato - salvataggio diretto', {
            breweryName: breweryData.verifiedData.breweryName,
            qualityScore: qualityScore
          });
          
          return validation;
        } else {
          validation.issues.push('Dati di qualità insufficiente nonostante la verifica AI');
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
      // Check 1: Il birrificio della birra deve essere verificato
      const brewery = verifiedBreweries.find(b => 
        b.originalData.labelName === beerData.labelData.breweryName
      );
      
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

      // Check 2: Verifica se è marcata come VERIFIED dall'AI
      if (beerData.webVerification?.dataMatch === 'VERIFIED') {
        const qualityScore = this.assessBeerDataQuality(beerData.verifiedData);
        
        if (qualityScore >= 0.7) {
          validation.isValid = true;
          validation.action = 'SAVE_DIRECTLY';
          validation.confidence = qualityScore;
          validation.brewery = brewery;
          
          logger.info('[AIValidation] Birra verificata - salvataggio diretto', {
            beerName: beerData.verifiedData.beerName,
            breweryName: brewery.originalData.labelName,
            qualityScore: qualityScore
          });
          
          return validation;
        } else {
          validation.issues.push('Dati birra di qualità insufficiente');
        }
      }

      // Check 3: Gestione casi non verificati
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

      logger.info('[AIValidation] Birra richiede intervento utente', {
        beerName: beerData.labelData.beerName,
        verification: beerData.webVerification?.dataMatch,
        actionType: validation.userAction?.type
      });

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
    
    return existingBreweries.find(b => 
      b.breweryName && b.breweryName.toLowerCase().trim() === breweryName.toLowerCase().trim()
    );
  }

  static assessDataQuality(breweryData) {
    let score = 0;
    let maxScore = 5;

    // Componenti essenziali
    if (breweryData.breweryName) score += 1;
    if (breweryData.breweryWebsite) score += 1;
    if (breweryData.breweryLegalAddress) score += 1;

    // Componenti di qualità
    if (breweryData.breweryEmail) score += 0.5;
    if (breweryData.breweryPhoneNumber) score += 0.5;
    if (breweryData.foundingYear) score += 0.3;
    if (breweryData.breweryDescription && breweryData.breweryDescription.length > 50) score += 0.7;

    // Penalità per dati mancanti critici
    if (!breweryData.breweryWebsite && !breweryData.breweryEmail) score -= 1;

    return Math.max(0, Math.min(1, score / maxScore));
  }

  static assessBeerDataQuality(beerData) {
    let score = 0;
    let maxScore = 4;

    if (beerData.beerName) score += 1;
    if (beerData.alcoholContent) score += 1;
    if (beerData.beerType) score += 1;
    if (beerData.volume) score += 0.5;
    if (beerData.description) score += 0.5;

    return Math.max(0, Math.min(1, score / maxScore));
  }

  static findMissingFields(data) {
    const requiredFields = ['breweryName', 'breweryWebsite', 'breweryLegalAddress'];
    const optionalFields = ['breweryEmail', 'breweryPhoneNumber', 'foundingYear'];
    
    const missing = [];
    
    requiredFields.forEach(field => {
      if (!data[field]) missing.push({ field, priority: 'high', label: this.getFieldLabel(field) });
    });
    
    optionalFields.forEach(field => {
      if (!data[field]) missing.push({ field, priority: 'low', label: this.getFieldLabel(field) });
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