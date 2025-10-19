const logWithFileName = require('../utils/logger');
const logger = logWithFileName(__filename);
const Brewery = require('../models/Brewery');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { GEMINI_API_KEY } = require('../../config/config');
const { BREWERY_WEB_SEARCH_PROMPT, BEER_WEB_SEARCH_PROMPT, fillPromptTemplate } = require('../../config/aiPrompts');

// Inizializza Gemini AI per ricerche web intelligenti
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

/**
 * 🌐 WEB SEARCH SERVICE - Ricerca e Validazione Dati Birrifici/Birre
 * 
 * Questo servizio effettua ricerche web automatiche per:
 * 1. Validare esistenza reale di birrifici/birre
 * 2. Completare dati mancanti da fonti affidabili
 * 3. Evitare input manuale dell'utente (minimizzare errori e contenuti inappropriati)
 * 
 * Strategia:
 * - Ricerca prioritaria nel database interno
 * - Ricerca web su fonti affidabili (Google, siti birrifici)
 * - Proposta dati completi all'utente per semplice conferma
 */

class WebSearchService {
  
  /**
   * Ricerca completa di un birrificio basata su dati parziali
   * @param {Object} partialData - Dati parziali estratti dall'AI
   * @param {string} partialData.name - Nome parziale o completo del birrificio
   * @param {string} [partialData.location] - Località se disponibile
   * @param {string} [partialData.website] - Sito web se disponibile
   * @returns {Promise<Object>} Dati completi del birrificio con fonte
   */
  static async searchBrewery(partialData) {
    try {
      logger.info('[WebSearch] 🔍 Ricerca birrificio avviata', { 
        name: partialData.name,
        location: partialData.location 
      });

      // STEP 1: Ricerca nel database interno (prioritaria)
      const dbResult = await this.searchBreweryInDatabase(partialData.name);
      if (dbResult.found) {
        logger.info('[WebSearch] ✅ Birrificio trovato nel database', { 
          breweryId: dbResult.brewery._id,
          name: dbResult.brewery.breweryName 
        });
        
        return {
          found: true,
          source: 'DATABASE',
          confidence: 1.0,
          brewery: {
            breweryName: dbResult.brewery.breweryName,
            breweryWebsite: dbResult.brewery.breweryWebsite,
            breweryLegalAddress: dbResult.brewery.breweryLegalAddress,
            breweryEmail: dbResult.brewery.breweryEmail,
            breweryPhoneNumber: dbResult.brewery.breweryPhoneNumber,
            breweryDescription: dbResult.brewery.breweryDescription,
            foundingYear: dbResult.brewery.foundingYear,
            _id: dbResult.brewery._id,
            verified: true,
            existsInDb: true
          },
          matchType: dbResult.matchType
        };
      }

      // STEP 2: Ricerca web con API Google (se configurata)
      // TODO: Implementare quando si attiva API Google Custom Search
      const webResult = await this.searchBreweryOnWeb(partialData.name, partialData.location);
      
      if (webResult.found) {
        logger.info('[WebSearch] ✅ Birrificio trovato sul web', { 
          name: webResult.brewery.breweryName,
          source: webResult.source 
        });
        
        return {
          found: true,
          source: 'WEB',
          confidence: webResult.confidence,
          brewery: webResult.brewery,
          verified: true,
          existsInDb: false,
          webSources: webResult.sources
        };
      }

      // STEP 3: Nessun risultato trovato
      logger.warn('[WebSearch] ⚠️ Nessun risultato trovato per il birrificio', { 
        name: partialData.name 
      });
      
      return {
        found: false,
        source: 'NONE',
        confidence: 0,
        brewery: null,
        suggestion: {
          message: 'Birrificio non trovato. Potrebbe essere un birrificio nuovo o il nome potrebbe essere incompleto.',
          action: 'USER_CONFIRMATION_REQUIRED'
        }
      };

    } catch (error) {
      logger.error('[WebSearch] ❌ Errore durante la ricerca birrificio', error);
      throw error;
    }
  }

  /**
   * Ricerca birrificio nel database interno
   * @param {string} name - Nome del birrificio da cercare
   * @returns {Promise<Object>} Risultato della ricerca
   */
  static async searchBreweryInDatabase(name) {
    try {
      if (!name || name.trim().length === 0) {
        return { found: false };
      }

      const searchName = name.trim();

      // Ricerca EXACT match (case-insensitive)
      let brewery = await Brewery.findOne({
        breweryName: { $regex: new RegExp(`^${searchName}$`, 'i') }
      });

      if (brewery) {
        return { 
          found: true, 
          brewery, 
          matchType: 'EXACT' 
        };
      }

      // Ricerca PARTIAL match (contiene il nome)
      brewery = await Brewery.findOne({
        breweryName: { $regex: new RegExp(searchName.replace(/\s+/g, '\\s*'), 'i') }
      });

      if (brewery) {
        return { 
          found: true, 
          brewery, 
          matchType: 'PARTIAL' 
        };
      }

      // Ricerca FUZZY (nome simile)
      const allBreweries = await Brewery.find({}).limit(100);
      const fuzzyMatch = allBreweries.find(b => {
        const similarity = this.calculateStringSimilarity(
          searchName.toLowerCase(),
          b.breweryName.toLowerCase()
        );
        return similarity > 0.7; // 70% similarità
      });

      if (fuzzyMatch) {
        return { 
          found: true, 
          brewery: fuzzyMatch, 
          matchType: 'FUZZY' 
        };
      }

      return { found: false };

    } catch (error) {
      logger.error('[WebSearch] Errore ricerca database', error);
      return { found: false };
    }
  }

  /**
   * Ricerca birrificio sul web usando Gemini AI con grounding (accesso web reale)
   * @param {string} name - Nome del birrificio
   * @param {string} [location] - Località opzionale
   * @returns {Promise<Object>} Risultato della ricerca web
   */
  static async searchBreweryOnWeb(name, location = '') {
    try {
      logger.info('[WebSearch] 🌐 Ricerca web con Gemini AI avviata', { name, location });

      // Crea prompt per ricerca strutturata usando template dal config
      const locationInfo = location ? ` situato a ${location}` : '';
      const prompt = fillPromptTemplate(BREWERY_WEB_SEARCH_PROMPT, {
        breweryName: name,
        locationInfo: locationInfo
      });

      // Usa modello Gemini con grounding (accesso web)
      const model = genAI.getGenerativeModel({ 
        model: 'gemini-1.5-flash',
        generationConfig: {
          temperature: 0.1, // Bassa creatività, massima precisione
          topK: 1,
          topP: 0.8,
          maxOutputTokens: 1024,
        }
      });

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      logger.info('[WebSearch] 📡 Risposta Gemini AI ricevuta', { 
        responseLength: text.length,
        preview: text.substring(0, 100) 
      });

      // Parse JSON dalla risposta
      let breweryData;
      try {
        // Rimuovi eventuali markdown code blocks
        const jsonText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        breweryData = JSON.parse(jsonText);
      } catch (parseError) {
        logger.error('[WebSearch] ❌ Errore parsing JSON risposta Gemini', { 
          error: parseError.message,
          rawText: text 
        });
        return { found: false, confidence: 0, brewery: null };
      }

      // Validazione risultato
      if (!breweryData.found || breweryData.confidence < 0.5) {
        logger.warn('[WebSearch] ⚠️ Birrificio non trovato o confidence troppo bassa', {
          found: breweryData.found,
          confidence: breweryData.confidence
        });
        return { found: false, confidence: 0, brewery: null };
      }

      logger.info('[WebSearch] ✅ Birrificio trovato sul web', {
        name: breweryData.breweryName,
        confidence: breweryData.confidence,
        sources: breweryData.sources?.length || 0
      });

      return {
        found: true,
        confidence: breweryData.confidence,
        source: 'GEMINI_WEB_SEARCH',
        brewery: {
          breweryName: breweryData.breweryName,
          breweryWebsite: breweryData.breweryWebsite || null,
          breweryLegalAddress: breweryData.breweryLegalAddress || null,
          breweryEmail: breweryData.breweryEmail || null,
          breweryDescription: breweryData.breweryDescription || null,
          foundingYear: breweryData.foundingYear || null,
          verified: false // Da ricerca web, richiede conferma utente
        },
        sources: breweryData.sources?.map(url => ({
          url: url,
          type: url.includes('wikipedia') ? 'WIKIPEDIA' : 
                url.includes(name.toLowerCase()) ? 'OFFICIAL_WEBSITE' : 'OTHER'
        })) || []
      };

    } catch (error) {
      logger.error('[WebSearch] ❌ Errore ricerca web con Gemini AI', {
        error: error.message,
        stack: error.stack
      });
      return { found: false, confidence: 0, brewery: null };
    }
  }

  /**
   * Calcola similarità tra due stringhe (algoritmo Levenshtein semplificato)
   * @param {string} str1 - Prima stringa
   * @param {string} str2 - Seconda stringa
   * @returns {number} Similarità tra 0 e 1
   */
  static calculateStringSimilarity(str1, str2) {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) {
      return 1.0;
    }
    
    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  /**
   * Calcola distanza di Levenshtein tra due stringhe
   * @param {string} str1 - Prima stringa
   * @param {string} str2 - Seconda stringa
   * @returns {number} Distanza di editing
   */
  static levenshteinDistance(str1, str2) {
    const matrix = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }

  /**
   * Ricerca birra nel database o web con Gemini AI
   * @param {Object} partialData - Dati parziali della birra
   * @param {string} breweryId - ID del birrificio a cui appartiene
   * @returns {Promise<Object>} Risultato della ricerca birra
   */
  static async searchBeer(partialData, breweryId) {
    try {
      logger.info('[WebSearch] 🔍 Ricerca birra avviata', { 
        beerName: partialData.beerName,
        breweryId 
      });

      // STEP 1: Ricerca nel database (prioritaria)
      const brewery = await Brewery.findById(breweryId);
      
      if (brewery && brewery.breweryProducts) {
        const beer = brewery.breweryProducts.find(p => 
          p.beerName.toLowerCase().includes(partialData.beerName.toLowerCase())
        );

        if (beer) {
          logger.info('[WebSearch] ✅ Birra trovata nel database', { 
            beerId: beer._id,
            name: beer.beerName 
          });
          
          return {
            found: true,
            source: 'DATABASE',
            confidence: 1.0,
            beer: beer,
            verified: true
          };
        }
      }

      // STEP 2: Ricerca web con Gemini AI
      const breweryName = brewery ? brewery.breweryName : 'birrificio sconosciuto';
      const webResult = await this.searchBeerOnWeb(partialData.beerName, breweryName);
      
      if (webResult.found) {
        logger.info('[WebSearch] ✅ Birra trovata sul web', {
          name: webResult.beer.beerName,
          confidence: webResult.confidence
        });
        
        return {
          found: true,
          source: 'WEB',
          confidence: webResult.confidence,
          beer: webResult.beer,
          verified: false,
          webSources: webResult.sources
        };
      }
      
      return {
        found: false,
        source: 'NONE',
        confidence: 0,
        beer: null
      };

    } catch (error) {
      logger.error('[WebSearch] Errore ricerca birra', error);
      throw error;
    }
  }

  /**
   * Ricerca birra sul web usando Gemini AI
   * @param {string} beerName - Nome della birra
   * @param {string} breweryName - Nome del birrificio
   * @returns {Promise<Object>} Risultato della ricerca web
   */
  static async searchBeerOnWeb(beerName, breweryName) {
    try {
      logger.info('[WebSearch] 🌐 Ricerca birra web con Gemini AI', { beerName, breweryName });

      // Crea prompt per ricerca birra usando template dal config
      const prompt = fillPromptTemplate(BEER_WEB_SEARCH_PROMPT, {
        beerName: beerName,
        breweryName: breweryName
      });

      const model = genAI.getGenerativeModel({ 
        model: 'gemini-1.5-flash',
        generationConfig: {
          temperature: 0.1,
          topK: 1,
          topP: 0.8,
          maxOutputTokens: 1024,
        }
      });

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      logger.info('[WebSearch] 📡 Risposta Gemini AI birra ricevuta', { 
        responseLength: text.length 
      });

      // Parse JSON
      let beerData;
      try {
        const jsonText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        beerData = JSON.parse(jsonText);
      } catch (parseError) {
        logger.error('[WebSearch] ❌ Errore parsing JSON birra', { 
          error: parseError.message,
          rawText: text 
        });
        return { found: false, confidence: 0, beer: null };
      }

      // Validazione
      if (!beerData.found || beerData.confidence < 0.5) {
        logger.warn('[WebSearch] ⚠️ Birra non trovata o confidence bassa', {
          found: beerData.found,
          confidence: beerData.confidence
        });
        return { found: false, confidence: 0, beer: null };
      }

      return {
        found: true,
        confidence: beerData.confidence,
        source: 'GEMINI_WEB_SEARCH',
        beer: {
          beerName: beerData.beerName,
          beerType: beerData.beerType || null,
          alcoholContent: beerData.alcoholContent || null,
          beerDescription: beerData.beerDescription || null,
          ibu: beerData.ibu || null,
          color: beerData.color || null
        },
        sources: beerData.sources || []
      };

    } catch (error) {
      logger.error('[WebSearch] ❌ Errore ricerca birra web', {
        error: error.message
      });
      return { found: false, confidence: 0, beer: null };
    }
  }
}

module.exports = WebSearchService;
