/**
 * 🌐 API ENDPOINT: Ricerca Web Automatica Birrifici
 * 
 * Questo endpoint viene chiamato quando l'AI rileva dati incompleti
 * e necessita di completarli tramite ricerca web automatica.
 * 
 * Flow:
 * 1. AI estrae dati parziali (es. solo "Raffo")
 * 2. Frontend chiama questa API per completare i dati
 * 3. Backend cerca nel DB + Web
 * 4. Restituisce dati completi per conferma utente
 */

const express = require('express');
const router = express.Router();
const WebSearchService = require('../services/webSearchService');
const logWithFileName = require('../utils/logger');
const logger = logWithFileName(__filename);

/**
 * POST /api/web-search/brewery
 * Ricerca automatica di un birrificio basata su dati parziali
 */
router.post('/brewery', async (req, res) => {
  try {
    const { name, location, website } = req.body;

    if (!name || name.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Nome birrificio richiesto per la ricerca'
      });
    }

    logger.info('[WebSearchAPI] 🔍 Richiesta ricerca birrificio', { 
      name, 
      location,
      userId: req.user?._id,
      sessionId: req.sessionID 
    });

    // Esegui ricerca automatica
    const result = await WebSearchService.searchBrewery({
      name: name.trim(),
      location: location?.trim(),
      website: website?.trim()
    });

    if (!result.found) {
      logger.warn('[WebSearchAPI] ⚠️ Birrificio non trovato', { name });
      
      return res.json({
        success: false,
        found: false,
        message: `Non ho trovato informazioni sul birrificio "${name}". Potrebbe essere un birrificio nuovo o locale.`,
        suggestion: {
          action: 'USER_INPUT_REQUIRED',
          message: 'Puoi aiutarmi fornendo maggiori dettagli?'
        }
      });
    }

    logger.info('[WebSearchAPI] ✅ Birrificio trovato', { 
      name: result.brewery.breweryName,
      source: result.source,
      confidence: result.confidence 
    });

    // Restituisci dati trovati per conferma utente
    return res.json({
      success: true,
      found: true,
      source: result.source, // 'DATABASE' o 'WEB'
      confidence: result.confidence,
      brewery: {
        breweryName: result.brewery.breweryName,
        breweryWebsite: result.brewery.breweryWebsite,
        breweryLegalAddress: result.brewery.breweryLegalAddress,
        breweryEmail: result.brewery.breweryEmail,
        breweryPhoneNumber: result.brewery.breweryPhoneNumber,
        breweryDescription: result.brewery.breweryDescription,
        foundingYear: result.brewery.foundingYear,
        _id: result.brewery._id, // Se esiste nel DB
        verified: result.brewery.verified,
        existsInDb: result.existsInDb
      },
      matchType: result.matchType, // 'EXACT', 'PARTIAL', 'FUZZY'
      webSources: result.webSources, // URL fonti se da web
      userAction: {
        type: 'CONFIRMATION_REQUIRED',
        message: `Ho trovato "${result.brewery.breweryName}". È corretto?`,
        confirmButton: 'Sì, è questo',
        rejectButton: 'No, cerca altro'
      }
    });

  } catch (error) {
    logger.error('[WebSearchAPI] ❌ Errore ricerca birrificio', error);
    
    return res.status(500).json({
      success: false,
      error: 'Errore durante la ricerca automatica',
      message: 'Si è verificato un errore. Riprova o completa manualmente.'
    });
  }
});

/**
 * POST /api/web-search/beer
 * Ricerca automatica di una birra basata su dati parziali
 */
router.post('/beer', async (req, res) => {
  try {
    const { beerName, breweryId, alcoholContent, beerStyle } = req.body;

    if (!beerName || beerName.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Nome birra richiesto per la ricerca'
      });
    }

    logger.info('[WebSearchAPI] 🔍 Richiesta ricerca birra', { 
      beerName, 
      breweryId,
      userId: req.user?._id 
    });

    // Esegui ricerca automatica
    const result = await WebSearchService.searchBeer({
      beerName: beerName.trim(),
      alcoholContent,
      beerStyle
    }, breweryId);

    if (!result.found) {
      logger.warn('[WebSearchAPI] ⚠️ Birra non trovata', { beerName, breweryId });
      
      return res.json({
        success: false,
        found: false,
        message: `Non ho trovato informazioni sulla birra "${beerName}".`,
        suggestion: {
          action: 'USE_PARTIAL_DATA',
          message: 'Procederemo con i dati parziali estratti dall\'etichetta.'
        }
      });
    }

    logger.info('[WebSearchAPI] ✅ Birra trovata', { 
      name: result.beer.beerName,
      source: result.source 
    });

    return res.json({
      success: true,
      found: true,
      source: result.source,
      confidence: result.confidence,
      beer: result.beer,
      userAction: {
        type: 'CONFIRMATION_REQUIRED',
        message: `Ho trovato "${result.beer.beerName}". È corretta?`,
        confirmButton: 'Sì, è questa',
        rejectButton: 'No, i dati dall\'etichetta sono diversi'
      }
    });

  } catch (error) {
    logger.error('[WebSearchAPI] ❌ Errore ricerca birra', error);
    
    return res.status(500).json({
      success: false,
      error: 'Errore durante la ricerca automatica'
    });
  }
});

module.exports = router;
