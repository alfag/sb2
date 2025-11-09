/**
 * 🎯 ADDRESS VERIFICATION SERVICE - Sistema Multi-Strategia per Validazione Indirizzi
 * 
 * Strategia: Usa TUTTI i metodi disponibili e scegli il migliore basato su scoring affidabilità
 * 
 * CASCATA DI VERIFICA:
 * 1. HTMLParser diretto dal sito ufficiale (confidence: 1.0 se trovato)
 * 2. Gemini AI web search con grounding (confidence: 0.5-0.9 basata su fonti)
 * 3. Database interno (confidence: 0.8 se già verificato, 0.3 se non verificato)
 * 4. Google Maps API (confidence: 0.6 - spesso impreciso per birrifici)
 * 
 * OUTPUT: Sceglie il dato con confidence più alta e lo marca con fonte
 */

const logWithFileName = require('../utils/logger');
const logger = logWithFileName(__filename);
const HTMLParser = require('../utils/htmlParser');
const Brewery = require('../models/Brewery');
const AIValidationService = require('./aiValidationService');

class AddressVerificationService {
  
  /**
   * Verifica indirizzo birrificio usando TUTTI i metodi disponibili
   * @param {Object} breweryData - Dati birrificio da verificare
   * @param {string} breweryData.name - Nome birrificio
   * @param {string} [breweryData.website] - Sito web se disponibile
   * @param {string} [breweryData.currentAddress] - Indirizzo attuale in database
   * @returns {Promise<Object>} Migliore indirizzo verificato con fonte e confidence
   */
  static async verifyBreweryAddress(breweryData) {
    try {
      logger.info('[AddressVerification] 🔍 Avvio verifica multi-strategia indirizzo', {
        breweryName: breweryData.name,
        hasWebsite: !!breweryData.website,
        hasCurrentAddress: !!breweryData.currentAddress
      });

      const results = [];

      // STRATEGIA 1: HTMLParser dal sito ufficiale (SE disponibile)
      if (breweryData.website) {
        logger.info('[AddressVerification] 📡 STRATEGIA 1: HTMLParser dal sito ufficiale');
        const htmlResult = await this.tryHTMLParsing(breweryData.website, breweryData.name);
        if (htmlResult) {
          results.push(htmlResult);
        }
      }

      // STRATEGIA 2: Database interno (check se già verificato)
      logger.info('[AddressVerification] 🗄️ STRATEGIA 2: Check database interno');
      const dbResult = await this.tryDatabaseLookup(breweryData.name, breweryData.currentAddress);
      if (dbResult) {
        results.push(dbResult);
        
        // STRATEGIA 2.5: Se DB ha un sito web ma non ha HTMLParser eseguito,
        // prova HTMLParser ora con quel sito
        if (dbResult.website && !breweryData.website) {
          logger.info('[AddressVerification] 🔗 STRATEGIA 2.5: HTMLParser con sito da database', {
            website: dbResult.website
          });
          const htmlFromDb = await this.tryHTMLParsing(dbResult.website, breweryData.name);
          if (htmlFromDb && htmlFromDb.confidence > dbResult.confidence) {
            results.push(htmlFromDb);
            logger.info('[AddressVerification] ✅ HTMLParser da DB migliore', {
              htmlConfidence: htmlFromDb.confidence,
              dbConfidence: dbResult.confidence
            });
          }
        }
      }
      
      // STRATEGIA 2.9: Fuzzy matching database (se nome non esatto)
      // Cerca birrifici simili e usa il loro sito web per HTMLParser
      if (!breweryData.website && results.length === 0) {
        logger.info('[AddressVerification] 🔍 STRATEGIA 2.9: Fuzzy matching database');
        const fuzzyResult = await this.tryFuzzyDatabaseMatch(breweryData.name);
        if (fuzzyResult) {
          results.push(fuzzyResult);
        }
      }

      // STRATEGIA 3: Gemini AI web search (SEMPRE come fallback/conferma)
      logger.info('[AddressVerification] 🤖 STRATEGIA 3: Gemini AI web search');
      // Questa viene gestita dal chiamante (webSearchService) per evitare duplicazione

      // SELEZIONE MIGLIORE RISULTATO
      if (results.length === 0) {
        logger.warn('[AddressVerification] ⚠️ Nessun risultato da strategie 1-2, necessario Gemini AI fallback');
        return {
          found: false,
          address: null,
          confidence: 0,
          source: 'NONE',
          message: 'Indirizzo non trovato con metodi diretti - fallback a Gemini AI necessario'
        };
      }

      // Ordina per confidence e prendi il migliore
      results.sort((a, b) => b.confidence - a.confidence);
      const bestResult = results[0];

      logger.info('[AddressVerification] 🎯 Migliore risultato selezionato', {
        source: bestResult.source,
        confidence: bestResult.confidence,
        address: bestResult.address,
        totalResults: results.length
      });

      // Log di tutti i risultati per trasparenza
      if (results.length > 1) {
        logger.info('[AddressVerification] 📊 Altri risultati trovati (non usati)', {
          alternatives: results.slice(1).map(r => ({
            source: r.source,
            confidence: r.confidence,
            address: r.address
          }))
        });
      }

      return bestResult;

    } catch (error) {
      logger.error('[AddressVerification] ❌ Errore verifica indirizzo', {
        breweryName: breweryData.name,
        error: error.message
      });
      return {
        found: false,
        address: null,
        confidence: 0,
        source: 'ERROR',
        error: error.message
      };
    }
  }

  /**
   * STRATEGIA 1: HTMLParser - Estrazione diretta dal sito ufficiale
   */
  static async tryHTMLParsing(websiteUrl, breweryName) {
    try {
      logger.info('[AddressVerification] 🔍 HTMLParser: Tentativo estrazione da sito', { websiteUrl });

      const htmlData = await HTMLParser.extractBreweryInfoFromWebsite(websiteUrl);

      if (!htmlData || !htmlData.address || htmlData.confidence < 0.5) {
        logger.warn('[AddressVerification] ⚠️ HTMLParser: Dati insufficienti', {
          hasAddress: !!htmlData?.address,
          confidence: htmlData?.confidence || 0
        });
        return null;
      }

      // Valida l'indirizzo estratto
      if (!AIValidationService.isValidAddress(htmlData.address)) {
        logger.warn('[AddressVerification] ⚠️ HTMLParser: Indirizzo non valido pattern', {
          address: htmlData.address
        });
        return null;
      }

      logger.info('[AddressVerification] ✅ HTMLParser: Indirizzo valido estratto', {
        address: htmlData.address,
        confidence: htmlData.confidence,
        source: htmlData.source
      });

      return {
        found: true,
        address: htmlData.address,
        email: htmlData.email,
        phone: htmlData.phone,
        confidence: Math.min(htmlData.confidence, 1.0), // Cap a 1.0
        source: 'HTML_PARSER',
        sourceUrl: htmlData.source,
        verified: true,
        verificationMethod: 'DIRECT_HTML_EXTRACTION'
      };

    } catch (error) {
      logger.warn('[AddressVerification] ⚠️ HTMLParser: Errore estrazione', {
        websiteUrl,
        error: error.message
      });
      return null;
    }
  }

  /**
   * STRATEGIA 2: Database Lookup - Check se birrificio già verificato
   */
  static async tryDatabaseLookup(breweryName, currentAddress) {
    try {
      logger.info('[AddressVerification] 🔍 Database: Ricerca birrificio', { breweryName });

      // Ricerca exact match
      const brewery = await Brewery.findOne({
        breweryName: { $regex: new RegExp(`^${breweryName}$`, 'i') }
      });

      if (!brewery) {
        logger.debug('[AddressVerification] Database: Birrificio non trovato');
        return null;
      }

      // Se birrificio esiste ma indirizzo vuoto/non specificato
      if (!brewery.breweryLegalAddress || 
          brewery.breweryLegalAddress === 'Non specificato' ||
          brewery.breweryLegalAddress.length < 10) {
        logger.debug('[AddressVerification] Database: Indirizzo non disponibile', {
          currentAddress: brewery.breweryLegalAddress
        });
        return null;
      }

      // Calcola confidence basata su metadati
      let confidence = 0.5; // Base per dati database

      // Bonus se indirizzo già verificato in passato
      if (brewery.needsValidation === false) {
        confidence += 0.3;
        logger.debug('[AddressVerification] Database: Indirizzo già verificato in passato');
      }

      // Bonus se ha metadati AI recenti
      if (brewery.lastAiUpdate) {
        const daysSinceUpdate = (Date.now() - new Date(brewery.lastAiUpdate).getTime()) / (1000 * 60 * 60 * 24);
        if (daysSinceUpdate < 30) {
          confidence += 0.2;
          logger.debug('[AddressVerification] Database: Dati AI recenti (< 30 giorni)');
        }
      }

      logger.info('[AddressVerification] ✅ Database: Indirizzo trovato', {
        address: brewery.breweryLegalAddress,
        confidence: confidence,
        needsValidation: brewery.needsValidation,
        lastUpdate: brewery.lastAiUpdate
      });

      return {
        found: true,
        address: brewery.breweryLegalAddress,
        email: brewery.breweryEmail,
        phone: brewery.breweryPhoneNumber,
        website: brewery.breweryWebsite,
        confidence: confidence,
        source: 'DATABASE',
        verified: brewery.needsValidation === false,
        verificationMethod: 'EXISTING_VERIFIED_DATA',
        breweryId: brewery._id
      };

    } catch (error) {
      logger.warn('[AddressVerification] ⚠️ Database: Errore ricerca', {
        breweryName,
        error: error.message
      });
      return null;
    }
  }

  /**
   * STRATEGIA 2.9: Fuzzy matching database + HTMLParser
   * Cerca birrifici con nomi simili e usa il loro sito per HTMLParser
   */
  static async tryFuzzyDatabaseMatch(breweryName) {
    try {
      logger.info('[AddressVerification] 🔍 Fuzzy matching database', { breweryName });

      // Normalizza il nome per matching
      const normalized = breweryName
        .toLowerCase()
        .replace(/^(birrificio|brewery|birra|beer)\s+/i, '')
        .replace(/dr\.|dott\.|dr\s+/gi, '')
        .trim();

      logger.debug('[AddressVerification] Nome normalizzato per fuzzy', {
        original: breweryName,
        normalized
      });

      // Cerca nel database con regex case-insensitive
      const breweries = await Brewery.find({
        $or: [
          { breweryName: new RegExp(normalized, 'i') },
          { breweryName: new RegExp(breweryName, 'i') }
        ]
      }).limit(5);

      if (!breweries || breweries.length === 0) {
        logger.debug('[AddressVerification] Nessun match fuzzy trovato');
        return null;
      }

      logger.info('[AddressVerification] ✅ Match fuzzy trovati', {
        count: breweries.length,
        names: breweries.map(b => b.breweryName)
      });

      // Prendi il primo che ha un sito web
      const breweryWithWebsite = breweries.find(b => b.breweryWebsite && b.breweryWebsite.length > 10);
      
      if (!breweryWithWebsite) {
        logger.debug('[AddressVerification] Nessun match con website disponibile');
        return null;
      }

      logger.info('[AddressVerification] 🌐 Match con website trovato', {
        breweryName: breweryWithWebsite.breweryName,
        website: breweryWithWebsite.breweryWebsite
      });

      // Usa HTMLParser con il sito trovato
      const htmlResult = await this.tryHTMLParsing(
        breweryWithWebsite.breweryWebsite,
        breweryWithWebsite.breweryName
      );

      if (htmlResult) {
        logger.info('[AddressVerification] ✅ HTMLParser da fuzzy match riuscito', {
          matchedBrewery: breweryWithWebsite.breweryName,
          confidence: htmlResult.confidence
        });

        // Marca come fuzzy match con confidence ridotta
        return {
          ...htmlResult,
          confidence: htmlResult.confidence * 0.9, // Ridotto 10% per fuzzy
          source: 'HTML_PARSER_FUZZY_MATCH',
          matchedBrewery: breweryWithWebsite.breweryName,
          originalQuery: breweryName
        };
      }

      return null;

    } catch (error) {
      logger.warn('[AddressVerification] ⚠️ Errore fuzzy matching', {
        error: error.message
      });
      return null;
    }
  }

  /**
   * Combina risultato HTMLParser/DB con risultato Gemini AI
   * Sceglie il migliore basato su confidence scoring
   */
  static selectBestResult(directResult, geminiResult) {
    const results = [];

    if (directResult && directResult.found) {
      results.push(directResult);
    }

    if (geminiResult && geminiResult.found) {
      results.push({
        found: true,
        address: geminiResult.address,
        email: geminiResult.email,
        phone: geminiResult.phone,
        confidence: geminiResult.confidence || 0.6,
        source: 'GEMINI_AI',
        verified: false,
        verificationMethod: 'AI_WEB_SEARCH'
      });
    }

    if (results.length === 0) {
      return {
        found: false,
        address: null,
        confidence: 0,
        source: 'NONE'
      };
    }

    // Ordina per confidence e prendi il migliore
    results.sort((a, b) => b.confidence - a.confidence);
    const best = results[0];

    logger.info('[AddressVerification] 🎯 Risultato finale selezionato', {
      selectedSource: best.source,
      confidence: best.confidence,
      address: best.address,
      alternativesConsidered: results.length
    });

    return best;
  }
}

module.exports = AddressVerificationService;
