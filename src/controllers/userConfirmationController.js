const AIValidationService = require('../services/aiValidationService');
const GeminiAI = require('../utils/geminiAi');
const AIService = require('../services/aiService');
const logWithFileName = require('../utils/logger');
const ErrorHandler = require('../utils/errorHandler');

const logger = logWithFileName(__filename);

/**
 * Controller per gestire conferme utente e completamento manuale dati
 */
class UserConfirmationController {

  /**
   * Metodo servizio per processare conferme utente (chiamato dalle rotte)
   */
  static async processUserConfirmation(user, validationResult, sessionData, options = {}) {
    try {
      const { confirmVerified, userCompletions, guestInfo } = options;
      const userId = user?._id || null;
      const isGuest = !user && guestInfo;
      const sessionId = guestInfo?.sessionId || 'unknown';

      logger.info('[UserConfirmation] Elaborazione conferma utente', {
        sessionId,
        userId,
        isGuest,
        confirmVerified,
        hasCompletions: !!userCompletions,
        hasValidationResult: !!validationResult
      });

      // Validazione input
      if (!validationResult || !sessionData) {
        return {
          success: false,
          message: 'Dati di validazione mancanti. Riprova l\'analisi dell\'immagine.'
        };
      }

      // Se l'utente ha confermato di salvare i dati verificati
      if (confirmVerified && validationResult.canSaveDirectly) {
        const saveResult = await this.saveVerifiedData(validationResult.verifiedData, userId, sessionId, { isGuest, guestInfo });
        
        if (saveResult.success) {
          return {
            success: true,
            message: `Salvato con successo: ${saveResult.savedBreweries} birrifici e ${saveResult.savedBeers} birre.`,
            data: saveResult,
            redirect: isGuest ? '/' : '/profile'
          };
        } else {
          return {
            success: false,
            message: 'Errore durante il salvataggio: ' + saveResult.error
          };
        }
      }

      // Se l'utente ha fornito completamenti manuali
      if (userCompletions && userCompletions.length > 0) {
        const completionResult = await this.processUserCompletions(userCompletions, sessionData, userId, sessionId, { isGuest, guestInfo });
        
        if (completionResult.success) {
          return {
            success: true,
            message: completionResult.message,
            data: completionResult.data,
            redirect: isGuest ? '/' : '/profile'
          };
        } else {
          return {
            success: false,
            message: completionResult.error
          };
        }
      }

      return {
        success: false,
        message: 'Nessuna azione valida specificata.'
      };

    } catch (error) {
      logger.error('[UserConfirmation] Errore durante elaborazione conferma', error);
      return {
        success: false,
        message: 'Errore interno durante l\'elaborazione della conferma.'
      };
    }
  }

  /**
   * Controller Express per processare conferme utente (metodo originale)
   */
  static async processUserConfirmationExpress(req, res) {
    try {
      const { confirmVerified, userCompletions, sessionData } = req.body;
      const userId = req.user?._id;
      const sessionId = req.session.id;

      logger.info('[UserConfirmation] Elaborazione conferma utente', {
        sessionId,
        userId,
        confirmVerified,
        hasCompletions: !!userCompletions,
        hasSessionData: !!sessionData
      });

      // Validazione input
      if (!sessionData) {
        return res.status(400).json({
          success: false,
          message: 'Dati di sessione mancanti. Riprova l\'analisi dell\'immagine.'
        });
      }

      let finalData = sessionData;

      // Se l'utente ha confermato di salvare i dati verificati
      if (confirmVerified && sessionData.validation?.canSaveDirectly) {
        const saveResult = await this.saveVerifiedData(sessionData.validation.verifiedData, userId, sessionId);
        
        if (saveResult.success) {
          // Pulisci dati temporanei dalla sessione
          AIService.clearAiDataFromSession(req.session);
          
          return res.json({
            success: true,
            message: `Salvato con successo: ${saveResult.savedBreweries} birrifici e ${saveResult.savedBeers} birre.`,
            savedData: saveResult,
            redirect: '/profile' // Reindirizza al profilo per vedere i risultati
          });
        } else {
          return res.status(500).json({
            success: false,
            message: 'Errore durante il salvataggio: ' + saveResult.error
          });
        }
      }

      // Se l'utente ha fornito completamenti manuali
      if (userCompletions && userCompletions.length > 0) {
        const completionResult = await this.processUserCompletions(userCompletions, sessionData, userId, sessionId);
        
        if (completionResult.success) {
          // Aggiorna dati in sessione con i completamenti
          finalData = {
            ...sessionData,
            userCompletions: completionResult.processedCompletions,
            readyForSave: completionResult.readyForSave
          };
          
          AIService.saveAnalysisToSession(req.session, finalData);
          
          if (completionResult.readyForSave) {
            const saveResult = await this.saveCompletedData(completionResult.processedCompletions, userId, sessionId);
            
            if (saveResult.success) {
              AIService.clearAiDataFromSession(req.session);
              
              return res.json({
                success: true,
                message: `Completamento riuscito: ${saveResult.savedBreweries} birrifici e ${saveResult.savedBeers} birre salvati.`,
                savedData: saveResult,
                redirect: '/profile'
              });
            } else {
              return res.status(500).json({
                success: false,
                message: 'Errore nel salvataggio dei dati completati: ' + saveResult.error
              });
            }
          } else {
            return res.json({
              success: true,
              message: 'Dati parzialmente completati. Completa i campi rimanenti per procedere.',
              updatedData: finalData,
              nextActions: completionResult.nextActions
            });
          }
        } else {
          return res.status(400).json({
            success: false,
            message: 'Errore nel processare i completamenti: ' + completionResult.error
          });
        }
      }

      // Caso default - nessuna azione specifica
      return res.status(400).json({
        success: false,
        message: 'Azione non riconosciuta. Specifica cosa vuoi fare con i dati.'
      });

    } catch (error) {
      logger.error('[UserConfirmation] Errore elaborazione conferma', {
        sessionId: req.session.id,
        userId: req.user?._id,
        error: error.message,
        stack: error.stack
      });

      res.status(500).json({
        success: false,
        message: 'Si è verificato un errore tecnico durante l\'elaborazione. Riprova.',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * Fornisce suggerimenti per completare dati mancanti
   */
  static async provideSuggestions(req, res) {
    try {
      const { breweryName, beerName, searchType } = req.query;
      
      logger.info('[UserConfirmation] Richiesta suggerimenti', {
        breweryName,
        beerName,
        searchType,
        sessionId: req.session.id
      });

      let suggestions = [];

      if (searchType === 'brewery' && breweryName) {
        suggestions = await this.generateBrewerySuggestions(breweryName);
      } else if (searchType === 'beer' && beerName && breweryName) {
        suggestions = await this.generateBeerSuggestions(beerName, breweryName);
      } else {
        return res.status(400).json({
          success: false,
          message: 'Parametri di ricerca insufficienti.'
        });
      }

      res.json({
        success: true,
        suggestions: suggestions,
        searchPerformed: true
      });

    } catch (error) {
      logger.error('[UserConfirmation] Errore generazione suggerimenti', {
        error: error.message,
        breweryName: req.query.breweryName,
        beerName: req.query.beerName
      });

      res.status(500).json({
        success: false,
        message: 'Errore durante la ricerca di suggerimenti.',
        suggestions: []
      });
    }
  }

  /**
   * Salva dati già verificati dall'AI
   */
  static async saveVerifiedData(verifiedData, userId, sessionId, options = {}) {
    try {
      const { isGuest, guestInfo } = options;
      const result = {
        success: false,
        savedBreweries: 0,
        savedBeers: 0,
        breweryIds: [],
        beerIds: [],
        error: null,
        isGuest: isGuest || false
      };

      logger.info('[UserConfirmation] Salvataggio dati verificati', {
        sessionId,
        userId,
        isGuest: isGuest || false,
        hasBreweries: !!(verifiedData.breweries?.length),
        hasBeers: !!(verifiedData.beers?.length)
      });

      // Salva birrifici verificati
      if (verifiedData.breweries && verifiedData.breweries.length > 0) {
        for (const breweryValidation of verifiedData.breweries) {
          try {
            let breweryId = null;

            if (breweryValidation.action === 'UPDATE_EXISTING') {
              breweryId = breweryValidation.existingBrewery._id;
              
              // Aggiorna birrificio esistente se necessario
              if (breweryValidation.originalData.verifiedData) {
                await this.updateExistingBrewery(breweryId, breweryValidation.originalData.verifiedData);
              }
            } else if (breweryValidation.action === 'SAVE_DIRECTLY') {
              // Crea nuovo birrificio
              breweryId = await GeminiAI.findOrCreateBrewery(breweryValidation.originalData.verifiedData);
            }

            if (breweryId) {
              result.breweryIds.push(breweryId);
              result.savedBreweries++;
            }
          } catch (breweryError) {
            logger.error('[UserConfirmation] Errore salvataggio birrificio', {
              breweryName: breweryValidation.originalData?.labelName,
              error: breweryError.message
            });
          }
        }
      }

      // Salva birre verificate
      if (verifiedData.beers && verifiedData.beers.length > 0) {
        for (const beerValidation of verifiedData.beers) {
          try {
            const breweryId = result.breweryIds.find(id => 
              beerValidation.brewery?.originalData?.id === beerValidation.originalData?.id
            ) || beerValidation.brewery?.existingBrewery?._id;

            if (breweryId && beerValidation.originalData.verifiedData) {
              const beerData = {
                beerName: beerValidation.originalData.verifiedData.beerName,
                alcoholContent: beerValidation.originalData.verifiedData.alcoholContent,
                beerType: beerValidation.originalData.verifiedData.beerType,
                volume: beerValidation.originalData.verifiedData.volume,
                description: beerValidation.originalData.verifiedData.description,
                confidence: beerValidation.confidence
              };

              const beerId = await GeminiAI.findOrCreateBeer(beerData, breweryId);
              if (beerId) {
                result.beerIds.push(beerId);
                result.savedBeers++;
              }
            }
          } catch (beerError) {
            logger.error('[UserConfirmation] Errore salvataggio birra', {
              beerName: beerValidation.originalData?.labelData?.beerName,
              error: beerError.message
            });
          }
        }
      }

      result.success = result.savedBreweries > 0 || result.savedBeers > 0;

      logger.info('[UserConfirmation] Salvataggio dati verificati completato', {
        success: result.success,
        savedBreweries: result.savedBreweries,
        savedBeers: result.savedBeers,
        userId,
        sessionId
      });

      return result;
    } catch (error) {
      logger.error('[UserConfirmation] Errore salvataggio dati verificati', {
        error: error.message,
        userId,
        sessionId
      });
      
      return {
        success: false,
        savedBreweries: 0,
        savedBeers: 0,
        error: error.message
      };
    }
  }

  /**
   * Processa completamenti forniti dall'utente
   */
  static async processUserCompletions(userCompletions, sessionData, userId, sessionId, options = {}) {
    try {
      const { isGuest, guestInfo } = options;
      const processedCompletions = [];
      let readyForSave = true;
      const nextActions = [];

      logger.info('[UserConfirmation] Elaborazione completamenti utente', {
        sessionId,
        userId,
        isGuest: isGuest || false,
        completionsCount: userCompletions.length
      });

      for (const completion of userCompletions) {
        const processed = {
          id: completion.id,
          type: completion.type, // 'brewery' or 'beer'
          action: completion.action, // 'verify', 'complete', 'skip'
          originalData: completion.originalData,
          userData: completion.userData || {},
          isValid: false,
          issues: [],
          guestSubmission: isGuest || false
        };

        if (completion.action === 'verify') {
          // Utente ha confermato che i dati sono corretti
          processed.isValid = true;
          processed.finalData = completion.originalData;
        } else if (completion.action === 'complete') {
          // Utente ha completato dati mancanti
          const mergedData = this.mergeUserData(completion.originalData, completion.userData);
          const validation = await this.validateUserCompletedData(mergedData, completion.type);
          
          processed.isValid = validation.isValid;
          processed.issues = validation.issues;
          processed.finalData = mergedData;
          
          if (!validation.isValid) {
            readyForSave = false;
            nextActions.push({
              type: 'COMPLETE_REQUIRED_FIELDS',
              target: completion.id,
              missingFields: validation.missingFields
            });
          }
        } else if (completion.action === 'skip') {
          // Utente ha scelto di saltare questo elemento
          processed.skipped = true;
          processed.isValid = false;
        }

        processedCompletions.push(processed);
      }

      return {
        success: true,
        processedCompletions,
        readyForSave,
        nextActions
      };
    } catch (error) {
      logger.error('[UserConfirmation] Errore processamento completamenti', {
        error: error.message,
        completionsCount: userCompletions?.length || 0
      });
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Utility methods
   */
  static mergeUserData(originalData, userData) {
    // Combina dati originali con quelli forniti dall'utente
    const merged = { ...originalData };
    
    Object.keys(userData).forEach(key => {
      if (userData[key] && userData[key].trim() !== '') {
        merged[key] = userData[key].trim();
      }
    });
    
    return merged;
  }

  static async validateUserCompletedData(data, type) {
    const validation = {
      isValid: true,
      issues: [],
      missingFields: []
    };

    if (type === 'brewery') {
      const requiredFields = ['breweryName'];
      const recommendedFields = ['breweryWebsite', 'breweryLegalAddress'];
      
      requiredFields.forEach(field => {
        if (!data[field] || data[field].trim() === '') {
          validation.isValid = false;
          validation.missingFields.push({ field, required: true });
        }
      });
      
      recommendedFields.forEach(field => {
        if (!data[field] || data[field].trim() === '') {
          validation.missingFields.push({ field, required: false });
        }
      });
    } else if (type === 'beer') {
      const requiredFields = ['beerName'];
      
      requiredFields.forEach(field => {
        if (!data[field] || data[field].trim() === '') {
          validation.isValid = false;
          validation.missingFields.push({ field, required: true });
        }
      });
    }

    return validation;
  }

  static async generateBrewerySuggestions(breweryName) {
    // Implementazione per generare suggerimenti di birrifici
    // Potresti utilizzare API esterne o database di birrifici noti
    return [
      {
        type: 'suggestion',
        name: `${breweryName} Brewery`,
        confidence: 0.7,
        source: 'name_variation'
      },
      {
        type: 'suggestion', 
        name: `Birrificio ${breweryName}`,
        confidence: 0.6,
        source: 'italian_variation'
      }
    ];
  }

  static async generateBeerSuggestions(beerName, breweryName) {
    // Implementazione per generare suggerimenti di birre
    return [
      {
        type: 'suggestion',
        name: beerName,
        brewery: breweryName,
        confidence: 0.8,
        source: 'exact_match'
      }
    ];
  }
}

module.exports = UserConfirmationController;