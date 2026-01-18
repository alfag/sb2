const Review = require('../models/Review');
const Brewery = require('../models/Brewery');
const Beer = require('../models/Beer');
const User = require('../models/User');
const path = require('path');
const fs = require('fs');
const GeminiAI = require('../utils/geminiAi');
const ValidationService = require('../utils/validationService');
const AIService = require('../services/aiService');
const CleanupService = require('../services/cleanupService');
const WebSearchService = require('../services/webSearchService');
const validationController = require('./validationController');
const { extractImageFromReview } = require('../utils/imageProcessor');
const logWithFileName = require('../utils/logger');
const logger = logWithFileName(__filename);

/**
 * 🍺 FUZZY MATCHING BIRRE - Gestisce nomi parziali da etichette
 * 
 * Problema: Su bottiglie, lettere finali possono essere nascoste sul bordo/fianco
 * Esempio: Etichetta mostra "SUDIGIR" ma nome reale è "SUDIGIRI" (I nascosta)
 * 
 * Strategia di matching:
 * 1. Exact match (case-insensitive)
 * 2. Prefix match: etichetta è prefisso del nome DB (max 2 caratteri differenza)
 * 3. Suffix match: etichetta è suffisso del nome DB
 * 4. Normalizzazione accenti e punteggiatura
 */
async function findExistingBeer(labelBeerName, breweryId) {
  if (!labelBeerName || !breweryId) return null;
  
  const searchName = labelBeerName.toLowerCase().trim();
  
  // Trova tutte le birre di questo birrificio
  const beersInBrewery = await Beer.find({ brewery: breweryId });
  if (!beersInBrewery || beersInBrewery.length === 0) return null;
  
  // 1. Exact match (case-insensitive)
  let match = beersInBrewery.find(b => 
    b.beerName && b.beerName.toLowerCase().trim() === searchName
  );
  if (match) {
    logger.info('🍺 Beer exact match trovato', { 
      labelName: labelBeerName, 
      dbName: match.beerName 
    });
    return match;
  }
  
  // 2. Prefix match - etichetta è prefisso del nome DB
  // Gestisce lettere nascoste sul bordo bottiglia
  // Esempio: "SUDIGIR" (etichetta) → "SUDIGIRI" (DB, I nascosta)
  match = beersInBrewery.find(b => {
    if (!b.beerName) return false;
    const dbName = b.beerName.toLowerCase().trim();
    
    // Se etichetta è prefisso di DB name e differenza ≤ 2 caratteri
    if (dbName.startsWith(searchName) && (dbName.length - searchName.length) <= 2) {
      return true;
    }
    return false;
  });
  
  if (match) {
    logger.info('🍺 Beer prefix match trovato (lettere nascoste sul bordo)', { 
      labelName: labelBeerName, 
      dbName: match.beerName,
      hiddenChars: match.beerName.substring(searchName.length)
    });
    return match;
  }
  
  // 3. Suffix match - casi rari dove parte iniziale nascosta
  match = beersInBrewery.find(b => {
    if (!b.beerName) return false;
    const dbName = b.beerName.toLowerCase().trim();
    
    if (dbName.endsWith(searchName) && (dbName.length - searchName.length) <= 2) {
      return true;
    }
    return false;
  });
  
  if (match) {
    logger.info('🍺 Beer suffix match trovato', { 
      labelName: labelBeerName, 
      dbName: match.beerName 
    });
    return match;
  }
  
  // 4. Normalizzazione accenti e punteggiatura per nomi artistici
  const normalizeForComparison = (str) => str
    .toLowerCase()
    .trim()
    .replace(/[àáâãäå]/g, 'a')
    .replace(/[èéêë]/g, 'e')
    .replace(/[ìíîï]/g, 'i')
    .replace(/[òóôõö]/g, 'o')
    .replace(/[ùúûü]/g, 'u')
    .replace(/[^a-z0-9]/g, ''); // Rimuove punteggiatura
  
  const normalizedSearch = normalizeForComparison(searchName);
  
  match = beersInBrewery.find(b => {
    if (!b.beerName) return false;
    const normalizedDb = normalizeForComparison(b.beerName);
    
    // Match esatto dopo normalizzazione
    if (normalizedDb === normalizedSearch) return true;
    
    // Prefix match dopo normalizzazione (max 2 char diff)
    if (normalizedDb.startsWith(normalizedSearch) && 
        (normalizedDb.length - normalizedSearch.length) <= 2) {
      return true;
    }
    
    return false;
  });
  
  if (match) {
    logger.info('🍺 Beer normalized match trovato', { 
      labelName: labelBeerName, 
      dbName: match.beerName 
    });
    return match;
  }
  
  logger.debug('🍺 Nessun match trovato per birra', { 
    labelName: labelBeerName, 
    breweryId: breweryId,
    availableBeers: beersInBrewery.map(b => b.beerName)
  });
  
  return null;
}

/**
 * Dizionario espansione acronimi per stili birra
 */
const BEER_ACRONYMS = {
  'ipa': ['india pale ale', 'indian pale ale'],
  'dipa': ['double ipa', 'double india pale ale'],
  'tipa': ['triple ipa', 'triple india pale ale'],
  'apa': ['american pale ale'],
  'epa': ['english pale ale'],
  'esb': ['extra special bitter'],
  'neipa': ['new england ipa', 'new england india pale ale'],
  'wcipa': ['west coast ipa', 'west coast india pale ale'],
  'ddh': ['double dry hopped'],
  'smash': ['single malt and single hop', 'single malt single hop'],
  'ipl': ['india pale lager'],
  'ba': ['barrel aged'],
  'rye': ['segale'],
  'wit': ['witbier', 'white beer'],
  'hefe': ['hefeweizen'],
  'pils': ['pilsner'],
  'bock': ['bockbier']
};

/**
 * Espande acronimi in un nome birra
 * @param {string} name - Nome birra originale
 * @returns {Array<string>} - Array di varianti espanse
 */
function expandBeerAcronyms(name) {
  const variants = [name]; // Include sempre l'originale
  const nameLower = name.toLowerCase();
  
  // Per ogni acronimo nel dizionario
  for (const [acronym, expansions] of Object.entries(BEER_ACRONYMS)) {
    const acronymRegex = new RegExp(`\\b${acronym}\\b`, 'gi');
    
    // Se il nome contiene questo acronimo
    if (acronymRegex.test(nameLower)) {
      // Genera varianti con tutte le espansioni
      expansions.forEach(expansion => {
        const expanded = nameLower.replace(acronymRegex, expansion);
        if (expanded !== nameLower) {
          variants.push(expanded);
        }
      });
    }
  }
  
  return variants;
}

/**
 * Match beer from label with web-scraped beers using 4-tier strategy + acronym expansion
 * @param {string} labelBeerName - Nome birra dall'etichetta foto
 * @param {Array} webBeers - Array birre dal web scraping
 * @returns {Object|null} - Birra matched dal web o null
 * 
 * Strategia matching:
 * 1. Exact match (case-insensitive)
 * 2. Prefix match: etichetta è prefisso del nome web
 * 3. Suffix match: etichetta è suffisso del nome web
 * 4. Normalizzazione accenti e punteggiatura
 * 5. Espansione acronimi (IPA → India Pale Ale)
 */
function matchBeerFromWeb(labelBeerName, webBeers) {
  if (!labelBeerName || !webBeers || webBeers.length === 0) return null;
  
  const searchName = labelBeerName.toLowerCase().trim();
  
  // Genera varianti con acronimi espansi
  const searchVariants = expandBeerAcronyms(searchName);
  
  logger.debug('🔍 Varianti ricerca con acronimi', {
    original: labelBeerName,
    variants: searchVariants
  });
  
  // 1. Exact match (case-insensitive) - prova tutte le varianti
  for (const variant of searchVariants) {
    const match = webBeers.find(wb => 
      wb.beerName && wb.beerName.toLowerCase().trim() === variant
    );
    if (match) {
      logger.debug('🔍 Web beer exact match', { 
        labelName: labelBeerName,
        matchedVariant: variant,
        webName: match.beerName 
      });
      return match;
    }
  }
  
  // 2. Prefix match - etichetta è prefisso del nome web
  // Esempio: "Ichnusa" (etichetta) → "Ichnusa Non Filtrata" (web)
  // Esempio: "IPA" (etichetta) → "India Pale Ale Dry Hopped" (web) ← ACRONIMI
  for (const variant of searchVariants) {
    const match = webBeers.find(wb => {
      if (!wb.beerName) return false;
      const webName = wb.beerName.toLowerCase().trim();
      
      // Se variante è prefisso di web name
      if (webName.startsWith(variant)) {
        return true;
      }
      return false;
    });
    
    if (match) {
      logger.debug('🔍 Web beer prefix match', { 
        labelName: labelBeerName,
        matchedVariant: variant,
        webName: match.beerName
      });
      return match;
    }
  }
  
  // 3. Suffix match - etichetta è suffisso del nome web
  // Esempio: "IPA" (etichetta) → "Sudigiri IPA" (web)
  // Esempio: "India Pale Ale" (espansione) → "Craft India Pale Ale" (web)
  for (const variant of searchVariants) {
    const match = webBeers.find(wb => {
      if (!wb.beerName) return false;
      const webName = wb.beerName.toLowerCase().trim();
      
      if (webName.endsWith(variant)) {
        return true;
      }
      return false;
    });
    
    if (match) {
      logger.debug('🔍 Web beer suffix match', { 
        labelName: labelBeerName,
        matchedVariant: variant,
        webName: match.beerName 
      });
      return match;
    }
  }
  
  // 4. Normalizzazione accenti e punteggiatura per nomi artistici + acronimi
  const normalizeForComparison = (str) => str
    .toLowerCase()
    .trim()
    .replace(/[àáâãäå]/g, 'a')
    .replace(/[èéêë]/g, 'e')
    .replace(/[ìíîï]/g, 'i')
    .replace(/[òóôõö]/g, 'o')
    .replace(/[ùúûü]/g, 'u')
    .replace(/[^a-z0-9]/g, ''); // Rimuove punteggiatura
  
  // Normalizza tutte le varianti (incluse espansioni acronimi)
  const normalizedVariants = searchVariants.map(v => normalizeForComparison(v));
  
  for (const normalizedSearch of normalizedVariants) {
    const match = webBeers.find(wb => {
      if (!wb.beerName) return false;
      const normalizedWeb = normalizeForComparison(wb.beerName);
      
      // Match esatto dopo normalizzazione
      if (normalizedWeb === normalizedSearch) return true;
      
      // Prefix match dopo normalizzazione
      if (normalizedWeb.startsWith(normalizedSearch)) return true;
      
      // Suffix match dopo normalizzazione
      if (normalizedWeb.endsWith(normalizedSearch)) return true;
      
      return false;
    });
    
    if (match) {
      logger.debug('🔍 Web beer normalized match', { 
        labelName: labelBeerName,
        matchedVariant: normalizedSearch,
        webName: match.beerName 
      });
      return match;
    }
  }
  
  // Nessun match trovato
  logger.debug('🔍 Nessun match web per birra', { 
    labelName: labelBeerName,
    webBeersCount: webBeers.length,
    searchedVariants: searchVariants
  });
  return null;
}


const extractRawSuggestions = (aiResult) => {
  if (!aiResult) return [];
  if (Array.isArray(aiResult.suggestions) && aiResult.suggestions.length > 0) {
    return aiResult.suggestions;
  }
  if (Array.isArray(aiResult.ambiguities) && aiResult.ambiguities.length > 0) {
    return aiResult.ambiguities;
  }
  if (Array.isArray(aiResult.candidates) && aiResult.candidates.length > 0) {
    return aiResult.candidates;
  }
  return [];
};

const normalizeBrewerySuggestions = (rawSuggestions = []) => {
  if (!Array.isArray(rawSuggestions)) return [];

  return rawSuggestions.map((item = {}, index) => {
    const idCandidate = item._id || item.id || item.breweryId || item.originalId;
    const normalizedId = idCandidate ? idCandidate.toString() : `suggestion-${index}`;

    const location = item.breweryLocation || item.location || item.breweryLegalAddress || item.breweryProductionAddress || null;
    const website = item.breweryWebsite || item.website || item.url || null;
    const email = item.breweryEmail || item.email || null;

    let confidence = null;
    if (typeof item.confidence === 'number') {
      confidence = item.confidence;
    } else if (typeof item.similarity === 'number') {
      confidence = item.similarity;
    } else if (typeof item.matchRatio === 'number') {
      confidence = item.matchRatio;
    }

    return {
      id: normalizedId,
      _id: item._id || null,
      breweryName: item.breweryName || item.name || item.label || 'Birrificio non identificato',
      breweryLocation: location,
      breweryWebsite: website,
      breweryEmail: email,
      confidence,
      matchType: item.matchType || null,
      keywordMatch: Boolean(item.keywordMatch),
      meta: {
        similarity: typeof item.similarity === 'number' ? item.similarity : null,
        matchRatio: typeof item.matchRatio === 'number' ? item.matchRatio : null,
        matchingParts: item.matchingParts || null,
        source: item.source || null
      }
    };
  });
};

// Validazione AI primo livello (immagine) - UNICA ROTTA NECESSARIA
exports.firstCheckAI = async (req, res) => {
  try {
    // Controllo rate limiting prima di elaborare la richiesta
    const rateLimitCheck = AIService.canMakeRequest(req.session, req.user?._id);
    
    if (!rateLimitCheck.canMakeRequest) {
      logger.warn('[firstCheckAI] Rate limit superato', {
        sessionId: req.sessionID,
        userId: req.user?._id,
        requestCount: rateLimitCheck.requestCount,
        maxRequests: rateLimitCheck.maxRequests,
        isUserAuthenticated: rateLimitCheck.isUserAuthenticated
      });
      
      logger.info('[firstCheckAI] Invio risposta rate limit e return', { 
        sessionId: req.sessionID
      });
      
      return res.status(429).json({
        success: false,
        error: 'RATE_LIMIT_EXCEEDED',
        message: 'Hai raggiunto il limite di richieste. Effettua il login per continuare o riprova più tardi.',
        suggestion: 'Accedi per aumentare il numero di richieste disponibili o attendi prima di riprovare.',
        details: {
          requestCount: rateLimitCheck.requestCount,
          maxRequests: rateLimitCheck.maxRequests,
          remainingRequests: rateLimitCheck.remainingRequests,
          resetInfo: rateLimitCheck.resetInfo,
          authUrl: rateLimitCheck.authUrl
        }
      });
    }
    
    // Avviso warning se ci si avvicina al limite
    let responseWarning = null;
    if (rateLimitCheck.warning) {
      responseWarning = {
        message: rateLimitCheck.warning,
        remainingRequests: rateLimitCheck.remainingRequests,
        authUrl: rateLimitCheck.authUrl
      };
      
      logger.info('[firstCheckAI] Warning rate limit', {
        sessionId: req.sessionID,
        userId: req.user?._id,
        remainingRequests: rateLimitCheck.remainingRequests,
        warning: rateLimitCheck.warning
      });
    }

    // Usa req.file.buffer con Multer invece di req.body.image
    const imageBuffer = req.file?.buffer;
    if (!imageBuffer) {
      logger.error('[firstCheckAI] Nessuna immagine fornita', {
        sessionId: req.sessionID,
        hasFile: !!req.file,
        hasBuffer: !!req.file?.buffer
      });
      return res.status(400).json({ success: false, message: 'Immagine mancante.' });
    }
    
    // Converti buffer in data URL per compatibilità con GeminiAI
    const mimeType = req.file?.mimetype || 'image/jpeg';
    const base64Image = imageBuffer.toString('base64');
    const dataUrl = `data:${mimeType};base64,${base64Image}`;
    
    logger.info('[firstCheckAI] Avvio analisi immagine', {
      userId: req.user?._id,
      sessionId: req.sessionID,
      imageSize: imageBuffer.length,
      mimeType: mimeType
    });
    
    // 🧠 OTTIMIZZAZIONE: UNA SOLA chiamata AI completa che estrae TUTTO
    // (brewery + beers + website), poi web scraping per VALIDARE/ARRICCHIRE
    let aiResult;
    let webScrapingData = null;
    let shouldEnhanceWithWebScraping = false;
    
    try {
      logger.info('[firstCheckAI] 🔍 FASE 1: AI legge SOLO scritte sulle etichette');
      
      // ⚠️ ARCHITETTURA CORRETTA (Punto 0 task_memo - AGGIORNATA 5 NOV 2025):
      // 1. AI legge SOLO le scritte su TUTTE le etichette (nome birra, nome birrificio per ogni bottiglia)
      // 2. Per OGNI bottiglia: Google Search → trova sito web birrificio
      // 3. Per OGNI bottiglia: Web scraping sito → estrae dati completi birrificio + birre
      // 4. Per OGNI bottiglia: Match e arricchimento dati etichetta + dati web
      // NOTA: L'URL del sito NON è praticamente mai presente sull'etichetta
      //       Possono esserci bottiglie di birrifici DIVERSI nella stessa immagine
      
      const GeminiAI = require('../utils/geminiAi');
      const labelAnalysis = await GeminiAI.validateImage(dataUrl);
      
      const labelBottles = labelAnalysis.bottles || [];
      
      logger.info('[firstCheckAI] ✅ Analisi etichette completata', {
        bottlesFound: labelBottles.length,
        confidence: labelAnalysis.confidence
      });
      
      // 🔄 FASE 2-4: Processa OGNI bottiglia individualmente
      const enrichedBottles = [];
      const breweriesData = new Map(); // Cache per evitare ricerche duplicate dello stesso birrificio
      
      const WebSearchService = require('../services/webSearchService');
      const WebScrapingService = require('../services/webScrapingService');
      
      for (let i = 0; i < labelBottles.length; i++) {
        const bottle = labelBottles[i];
        
        // 🔧 FIX: Estrai nome birra dalla posizione corretta (labelData)
        const beerName = bottle.labelData?.beerName || 
                         bottle.beerName ||
                         bottle.searchQueries?.exact || 
                         bottle.searchQueries?.variants?.[0];
        
        logger.info(`[firstCheckAI] 🍺 Processa bottiglia ${i + 1}/${labelBottles.length}`, {
          beerName: beerName,
          fromLabelData: !!bottle.labelData?.beerName,
          fromSearchQueries: !bottle.labelData?.beerName && (!!bottle.searchQueries?.exact || !!bottle.searchQueries?.variants?.[0])
        });
        
        // 🎯 STRATEGIA: Usa le searchQueries generate dall'AI invece di inventare nomi
        let searchQueries = [];
        
        // 1. Priorità: searchQueries dall'AI per la birra
        if (bottle.searchQueries?.variants && bottle.searchQueries.variants.length > 0) {
          searchQueries.push(...bottle.searchQueries.variants);
          if (bottle.searchQueries.exact) {
            searchQueries.unshift(bottle.searchQueries.exact); // Aggiungi exact query all'inizio
          }
          logger.info(`[firstCheckAI] 🔍 Uso searchQueries AI per birra`, {
            queries: searchQueries
          });
        }
        
        // 2. Se AI ha trovato birrificio separatamente, aggiungi quelle query
        const breweriesArray = labelAnalysis.breweries || [];
        if (breweriesArray.length > 0) {
          const breweryInfo = breweriesArray[i] || breweriesArray[0]; // Usa corrispondente o primo
          if (breweryInfo.searchQueries?.variants) {
            searchQueries.push(...breweryInfo.searchQueries.variants);
            if (breweryInfo.searchQueries.exact) {
              searchQueries.push(breweryInfo.searchQueries.exact);
            }
            logger.info(`[firstCheckAI] 🔍 Aggiunte searchQueries AI per birrificio`, {
              queries: breweryInfo.searchQueries.variants
            });
          }
        }
        
        // 3. Fallback: se non ci sono query, usa il nome della birra
        if (searchQueries.length === 0 && beerName) {
          searchQueries.push(`${beerName} birrificio`);
          searchQueries.push(`${beerName} brewery`);
          logger.info(`[firstCheckAI] 💡 Fallback: generato query dal nome birra`, {
            queries: searchQueries
          });
        }
        
        // Se proprio non abbiamo nulla da cercare, skip
        if (searchQueries.length === 0) {
          logger.warn(`[firstCheckAI] ⚠️ Bottiglia ${i + 1}: Nessuna query disponibile - Solo dati etichetta`);
          enrichedBottles.push({
            ...bottle,
            dataSource: 'label_only',
            needsValidation: true,
            validationReason: 'Nessuna query di ricerca disponibile - impossibile cercare online il birrificio'
          });
          continue;
        }
        
        // 🚀 OTTIMIZZAZIONE 1: Riordina query mettendo versione minuscola per prima
        // (ha più successo contro anti-bot)
        const lowercaseQueries = searchQueries.filter(q => q === q.toLowerCase());
        const otherQueries = searchQueries.filter(q => q !== q.toLowerCase());
        searchQueries = [...lowercaseQueries, ...otherQueries];
        
        // 🚀 OTTIMIZZAZIONE 2: Limita a massimo 3 query per ridurre consumo risorse
        const originalQueryCount = searchQueries.length;
        if (searchQueries.length > 3) {
          searchQueries = searchQueries.slice(0, 3);
          logger.info(`[firstCheckAI] ⚡ Limitate query da ${originalQueryCount} a 3 per ottimizzazione`);
        }
        
        // 🌐 FASE 2: Google Search usando le query generate dall'AI
        logger.info(`[firstCheckAI] 🌐 FASE 2: Google Search - Max 3 tentativi (stop al primo successo)`);
        
        let breweryWebData = null;
        let searchResult = null;
        let attemptedQueries = 0;
        
        // Prova ogni query MA fermati al primo successo
        for (let qi = 0; qi < searchQueries.length; qi++) {
          const query = searchQueries[qi];
          attemptedQueries++;
          
          logger.info(`[firstCheckAI] 🔍 Tentativo ${attemptedQueries}/${searchQueries.length}: "${query}"`);
          
          try {
            // Google Search trova sito web del birrificio
            searchResult = await WebSearchService.searchBreweryOnWeb(query, beerName);
            
            if (searchResult.found && searchResult.brewery?.breweryWebsite) {
              logger.info(`[firstCheckAI] ✅ Sito trovato al tentativo ${attemptedQueries}: ${searchResult.brewery.breweryWebsite}`);
              
              // 🔍 FASE 3: Web scraping del sito per estrarre TUTTI i dati
              const scrapingResult = await WebScrapingService.scrapeBreweryWebsite(
                searchResult.brewery.breweryWebsite,
                searchResult.brewery.breweryName || query
              );
              
              if (scrapingResult.success && scrapingResult.confidence >= 0.3) {
                // Merge dati Google Search + Web Scraping
                breweryWebData = {
                  ...searchResult.brewery,
                  ...scrapingResult.data,
                  breweryName: scrapingResult.data.breweryName || searchResult.brewery.breweryName,
                  website: searchResult.brewery.breweryWebsite,
                  beers: scrapingResult.data.beers || [],
                  dataSource: 'google_search+web_scraping',
                  confidence: scrapingResult.confidence
                };
                
                logger.info(`[firstCheckAI] ✅ Dati birrificio completi estratti`, {
                  breweryName: breweryWebData.breweryName,
                  beersFound: breweryWebData.beers.length,
                  confidence: breweryWebData.confidence
                });
                
                // 🎯 STOP: Successo trovato, esci dal loop
                logger.info(`[firstCheckAI] 🎯 SUCCESSO - Evitati ${searchQueries.length - attemptedQueries} tentativi rimanenti`);
                break;
              } else {
                logger.warn(`[firstCheckAI] ⚠️ Web scraping bassa confidence`, {
                  confidence: scrapingResult.confidence
                });
              }
            } else {
              logger.warn(`[firstCheckAI] ⚠️ Query "${query}" non ha trovato sito`);
            }
          } catch (searchError) {
            logger.warn(`[firstCheckAI] ⚠️ Errore con query "${query}": ${searchError.message}`);
            // Continua con la prossima query
          }
        } // Fine loop query
        
        // Log risultato ricerca
        if (breweryWebData) {
          logger.info(`[firstCheckAI] ✅ Birrificio trovato dopo ricerca query`, {
            breweryName: breweryWebData.breweryName,
            beersFound: breweryWebData.beers?.length || 0,
            queriesAttempted: attemptedQueries
          });
        } else {
          logger.warn(`[firstCheckAI] ⚠️ Nessun birrificio trovato dopo ${attemptedQueries} tentativi`);
        }
        
        // 🔀 FASE 4: Match e arricchimento bottiglia con dati web
        if (breweryWebData) {
          // 💾 Salva birrificio nella cache (evita duplicati)
          const breweryKey = breweryWebData.breweryName.toLowerCase();
          if (!breweriesData.has(breweryKey)) {
            breweriesData.set(breweryKey, {
              breweryName: breweryWebData.breweryName,
              website: breweryWebData.website,
              breweryAddress: breweryWebData.breweryAddress,
              email: breweryWebData.email,
              phone: breweryWebData.phone,
              description: breweryWebData.description,
              foundingYear: breweryWebData.foundingYear,
              dataSource: breweryWebData.dataSource,
              confidence: breweryWebData.confidence
            });
            logger.info(`[firstCheckAI] 💾 Birrificio salvato in cache`, {
              breweryName: breweryWebData.breweryName,
              cacheSize: breweriesData.size
            });
          } else {
            logger.debug(`[firstCheckAI] 💾 Birrificio già in cache`, {
              breweryName: breweryWebData.breweryName
            });
          }
          
          // 🔍 MATCHING ROBUSTO: Cerca birra nel sito con strategia 4-tier
          const webBeer = matchBeerFromWeb(beerName, breweryWebData.beers);
          
          if (webBeer) {
            logger.info(`[firstCheckAI] ✅ Match trovato per "${beerName}"`, {
              webBeerName: webBeer.beerName,
              hasAlcohol: !!webBeer.alcoholContent,
              hasDescription: !!webBeer.beerDescription
            });
          } else {
            logger.warn(`[firstCheckAI] ⚠️ Nessun match per "${beerName}"`, {
              breweryName: breweryWebData.breweryName,
              availableBeers: breweryWebData.beers?.map(b => b.beerName).join(', ') || 'nessuna'
            });
          }
          
          enrichedBottles.push({
            // Dati base dall'etichetta
            ...bottle,
            // Arricchimento dal sito web
            ...webBeer,
            // Priorità: nome dall'etichetta (più preciso visivamente)
            beerName: beerName, // ← USA LA VARIABILE ESTRATTA, NON bottle.beerName
            breweryName: breweryWebData.breweryName,
            // Aggiungi dati birrificio
            brewery: {
              breweryName: breweryWebData.breweryName,
              website: breweryWebData.website,
              breweryAddress: breweryWebData.breweryAddress,
              email: breweryWebData.email,
              phone: breweryWebData.phone,
              dataSource: breweryWebData.dataSource
            },
            dataSource: webBeer ? 'label+web' : 'label+brewery_only',
            confidence: breweryWebData.confidence
          });
          
          logger.info(`[firstCheckAI] ✅ Bottiglia ${i + 1} arricchita`, {
            beerMatch: !!webBeer,
            dataSource: webBeer ? 'label+web' : 'label+brewery_only'
          });
        } else {
          // Nessun dato web - solo etichetta
          enrichedBottles.push({
            ...bottle,
            dataSource: 'label_only',
            needsValidation: true,
            validationReason: 'Ricerca web non ha prodotto risultati - dati limitati a etichetta'
          });
          
          logger.warn(`[firstCheckAI] ⚠️ Bottiglia ${i + 1}: Solo dati etichetta`);
        }
      }
      
      // ✅ RISULTATO FINALE: Multi-bottle, Multi-brewery
      logger.info('[firstCheckAI] 📦 Costruzione risultato finale', {
        totalBottles: enrichedBottles.length,
        uniqueBreweries: breweriesData.size,
        labelOnlyCount: enrichedBottles.filter(b => b.dataSource === 'label_only').length,
        enrichedCount: enrichedBottles.filter(b => b.dataSource !== 'label_only').length
      });
      
      // Converti Map in array per risposta
      const breweriesArray = Array.from(breweriesData.values());
      
      aiResult = {
        success: true,
        message: `Elaborazione completata: ${enrichedBottles.length} birre da ${breweriesData.size} birrifici`,
        bottles: enrichedBottles,
        breweries: breweriesArray,  // 🔥 AGGIUNTO: Array birrifici unici trovati
        breweriesProcessed: breweriesData.size,
        dataSource: 'multi_bottle_label+google_search+web_scraping',
        antiHallucinationActive: false,
        needsVerification: enrichedBottles.some(b => b.needsValidation),
        analysisComplete: true
      };
      
      logger.info('[firstCheckAI] ✅ COMPLETATO - Multi-bottle processing', {
        totalBottles: enrichedBottles.length,
        breweriesCount: breweriesData.size,
        successRate: `${((enrichedBottles.filter(b => b.dataSource !== 'label_only').length / enrichedBottles.length) * 100).toFixed(1)}%`
      });
      
    } catch (apiError) {
      logger.error('[firstCheckAI] Errore chiamata API AIService', {
        error: apiError.message,
        stack: apiError.stack,
        sessionId: req.sessionID
      });
      
      // 🚨 GESTIONE QUOTA EXHAUSTION GEMINI AI
      // Se Gemini AI ha raggiunto il limite, salva i dati parziali come pending_validation
      const isQuotaError = apiError.message?.includes('quota') || 
                          apiError.message?.includes('limit') ||
                          apiError.message?.includes('429') ||
                          apiError.statusCode === 429;
      
      if (isQuotaError) {
        logger.warn('[firstCheckAI] 🚨 Quota Gemini AI esaurita - Salvataggio come pending_validation');
        
        // Se abbiamo almeno i dati del birrificio da scraping, salviamo con flag pending
        if (webScrapingData?.success) {
          try {
            // Crea birrificio con status pending_validation
            const Brewery = require('../models/Brewery');
            const newBrewery = new Brewery({
              breweryName: webScrapingData.data.breweryName,
              breweryLegalAddress: webScrapingData.data.address,
              website: webScrapingData.data.website,
              email: webScrapingData.data.contacts?.email,
              phone: webScrapingData.data.contacts?.phone,
              description: webScrapingData.data.description,
              validationStatus: 'pending_validation',
              dataSource: 'web_scraping',
              needsManualReview: true,
              reviewReason: 'Quota Gemini AI esaurita - dati estratti solo da web scraping'
            });
            await newBrewery.save();
            
            // Notifica amministratori
            await validationController.notifyAdministrators('brewery', {
              breweryName: newBrewery.breweryName,
              reason: 'Quota Gemini AI esaurita - validazione manuale richiesta'
            });
            
            logger.info('[firstCheckAI] ✅ Birrificio salvato come pending_validation - ID:', newBrewery._id);
          } catch (saveError) {
            logger.error('[firstCheckAI] ❌ Errore salvataggio birrificio pending', {
              error: saveError.message
            });
          }
        }
        
        return res.status(200).json({
          success: false,
          message: 'Il servizio AI ha raggiunto il limite di richieste. I dati disponibili sono stati salvati per revisione manuale. Riprova più tardi.',
          errorType: 'QUOTA_EXHAUSTED',
          bottles: [],
          brewery: webScrapingData?.data || null
        });
      }
      
      // Fornisci una risposta di fallback generica
      return res.status(200).json({
        success: false,
        message: 'Servizio di analisi temporaneamente non disponibile. Riprova più tardi.',
        errorType: 'SERVICE_ERROR',
        bottles: [],
        brewery: null,
        rateLimitInfo: {
          remainingRequests: AIService.canMakeRequest(req.session, req.user?._id).remainingRequests,
          maxRequests: AIService.canMakeRequest(req.session, req.user?._id).maxRequests,
          isUserAuthenticated: !!req.user
        }
      });
    }
    if (!aiResult.success) {
      logger.warn('[firstCheckAI] Analisi fallita - nessuna birra rilevata', { 
        message: aiResult.message,
        sessionId: req.sessionID,
        bottles: aiResult.bottles?.length || 0,
        brewery: !!aiResult.brewery
      });
      
      // Per "nessuna birra rilevata", restituisci 200 OK con errorType specifico
      const errorMessage = aiResult.message || 'Non sono state rilevate bottiglie di birra nell\'immagine. Carica un\'immagine contenente chiaramente prodotti birrari.';
      
      return res.status(200).json({
        success: false,
        message: errorMessage,
        errorType: 'NO_BEER_DETECTED',
        bottles: [],
        brewery: null
      });
    }
    
    // NOTA: Il controllo duplicati è gestito in reviewService.checkDuplicateReview()
    // che verifica se l'utente ha già recensito una specifica birra (senza limiti temporali)
    // permettendo così di evitare recensioni duplicate mantenendo l'integrità dei dati
    
    logger.info('[firstCheckAI] Analisi completata con successo', {
      sessionId: req.sessionID,
      bottlesFound: aiResult.bottles?.length || 0,
      breweryFound: !!aiResult.brewery,
      antiHallucinationEnabled: !!aiResult.antiHallucination,
      needsUserIntervention: !!aiResult.needsUserIntervention,
      userFlowType: aiResult.userFlowType || 'UNKNOWN'
    });
    
    // � CONTROLLO CRITICO 0: Blocco prodotti NON-BIRRA (liquori, vini, sidri)
    // Questo controllo ha MASSIMA PRIORITÀ - se rileva prodotto non-birra, blocca immediatamente
    if (aiResult.validation?.blockedByValidation && aiResult.userFlowType === 'BLOCKED') {
      logger.warn('[firstCheckAI] 🚫 PRODOTTO NON-BIRRA RILEVATO - Blocco elaborazione', {
        sessionId: req.sessionID,
        userId: req.user?._id,
        userFlowType: aiResult.userFlowType,
        errorMessage: aiResult.messages?.error,
        errorDetails: aiResult.validation?.errorDetails
      });

      // Trova l'azione NON_BEER_DETECTED per dettagli errore
      const nonBeerAction = aiResult.userActions?.find(action => 
        action.type === 'NON_BEER_DETECTED' && action.blocking === true
      );

      const errorDetails = nonBeerAction?.data || aiResult.validation?.errorDetails || {};
      const productType = errorDetails.productType || errorDetails.detectedProductType || errorDetails.displayType || 'prodotto alcolico non-birra';
      const displayType = errorDetails.displayType || productType;
      const productName = errorDetails.productName || errorDetails.detectedName;

      // Messaggio errore personalizzato e user-friendly
      let errorMessage;
      if (productName && productName !== 'sconosciuto' && productName.toLowerCase() !== 'unknown') {
        // Caso 1: Nome prodotto identificato
        errorMessage = `Il prodotto rilevato nell'immagine ("${productName}") è un ${displayType}, ma questa applicazione è dedicata esclusivamente alle birre.`;
      } else {
        // Caso 2: Nome prodotto non identificato - messaggio generico più chiaro
        errorMessage = `Il prodotto rilevato nell'immagine sembra essere un ${displayType}, ma questa applicazione è dedicata esclusivamente alle birre.`;
      }

      // Risposta blocco con dettagli completi per il frontend
      return res.status(200).json({
        success: false,
        message: errorMessage,
        errorType: 'NON_BEER_DETECTED',
        blocked: true,
        productInfo: {
          detectedName: productName || 'Prodotto non identificato',
          productType: productType,
          displayType: displayType,
          reason: errorDetails.reason,
          confidence: errorDetails.confidence,
          suggestedApp: errorDetails.suggestedApp
        },
        bottles: [],
        brewery: null,
        rateLimitInfo: {
          remainingRequests: Math.max(0, (AIService.canMakeRequest(req.session, req.user?._id).remainingRequests || 0)),
          maxRequests: AIService.canMakeRequest(req.session, req.user?._id).maxRequests,
          isUserAuthenticated: !!req.user
        }
      });
    }
    
    // �🛡️ NUOVO SISTEMA ANTI-ALLUCINAZIONI: Controllo se serve intervento utente
    logger.debug('[firstCheckAI] DEBUG - Controllo condizioni anti-allucinazioni', {
      sessionId: req.sessionID,
      needsUserIntervention: !!aiResult.needsUserIntervention,
      antiHallucinationEnabled: !!aiResult.antiHallucination?.enabled,
      antiHallucinationObject: aiResult.antiHallucination,
      conditionResult: !!(aiResult.needsUserIntervention && aiResult.antiHallucination?.enabled)
    });
    
    if (aiResult.needsUserIntervention && aiResult.antiHallucination?.enabled) {
      logger.info('[firstCheckAI] ⚠️ Sistema anti-allucinazioni attivato - Redirect a interfaccia verifica', {
        sessionId: req.sessionID,
        userId: req.user?._id,
        userFlowType: aiResult.userFlowType,
        verifiedCount: aiResult.processedData?.verified?.count || {},
        unverifiedCount: aiResult.processedData?.unverified?.count || {},
        blockedCount: aiResult.processedData?.blocked?.count || {}
      });

      // Salva immagine per l'interfaccia di verifica
      req.session.aiImageData = {
        base64: base64Image,
        mimeType: mimeType,
        timestamp: new Date().toISOString()
      };

      // 🖼️ Aggiungi thumbnail dell'immagine caricata per sistema anti-allucinazioni
      const imageDataUrl = `data:${mimeType};base64,${base64Image}`;

      // 💾 Salva dati di validazione e analisi nella sessione per l'interfaccia
      req.session.aiValidationResult = aiResult.validation || {
        canSaveDirectly: false,
        requiresUserConfirmation: true,
        requiresUserCompletion: false,
        blockedByValidation: false,
        userActions: aiResult.userActions || [],
        messages: aiResult.messages || {}
      };

      req.session.aiAnalysisData = {
        bottles: aiResult.bottles || [],
        breweries: aiResult.breweries || [],
        processedData: aiResult.processedData || {},
        userFlowType: aiResult.userFlowType,
        messages: aiResult.messages || {},
        timestamp: new Date().toISOString()
      };

      // Risposta JSON che indica necessità di verifica
      return res.json({
        success: true,
        antiHallucinationActive: true,
        needsVerification: true,
        userFlowType: aiResult.userFlowType,
        redirectUrl: '/review/verify-ai-analysis',
        message: aiResult.messages?.warning || 'Verifica i dati rilevati prima del salvataggio automatico.',
        // Aggiungi thumbnail e normalizza campi per interfaccia di verifica
        bottles: aiResult.bottles ? aiResult.bottles.map(bottle => ({
          ...bottle,
          // Thumbnail integration
          thumbnail: bottle.thumbnail || imageDataUrl,
          originalImageUrl: imageDataUrl,
          // Field mapping per frontend compatibility 
          bottleLabel: bottle.beerName || bottle.bottleLabel || bottle.name || 'Birra sconosciuta',
          breweryName: bottle.breweryName || bottle.brewery || 'Birrificio sconosciuto', 
          beerType: bottle.beerType || bottle.type || bottle.style || 'Tipo non specificato',
          alcoholContent: bottle.alcoholContent || bottle.abv || bottle.alcohol || 'N/A'
        })) : [],
        data: {
          processedData: aiResult.processedData,
          validation: aiResult.validation,
          messages: aiResult.messages
        },
        rateLimitInfo: {
          remainingRequests: Math.max(0, (AIService.canMakeRequest(req.session, req.user?._id).remainingRequests || 0) - 1),
          maxRequests: AIService.canMakeRequest(req.session, req.user?._id).maxRequests,
          isUserAuthenticated: !!req.user
        }
      });
    }

    // ✅ Dati verificati - Possibile salvataggio diretto
    if (aiResult.canSaveDirectly && aiResult.antiHallucination?.safeToSave) {
      logger.info('[firstCheckAI] ✅ Dati verificati dal sistema anti-allucinazioni - Salvataggio sicuro', {
        sessionId: req.sessionID,
        userId: req.user?._id,
        verifiedBreweriesCount: aiResult.processedData?.verified?.count?.breweries || 0,
        verifiedBeersCount: aiResult.processedData?.verified?.count?.beers || 0
      });

      // Incrementa contatore richieste per salvataggio riuscito
      AIService.incrementRequestCount(req.session);

      // 🖼️ Aggiungi thumbnail dell'immagine caricata ai dati verificati
      const imageDataUrl = `data:${mimeType};base64,${base64Image}`;
      
      // Prepara risposta di successo con dati verificati e thumbnail
      const response = {
        ...aiResult,
        antiHallucinationActive: true,
        directSave: true,
        verified: true,
        message: aiResult.messages?.success || 'Tutti i dati sono stati verificati e possono essere salvati.',
        // Aggiungi thumbnail e normalizza nomi campi per frontend
        bottles: aiResult.bottles ? aiResult.bottles.map((bottle, index) => {
          // 🔧 DEBUG: Log struttura bottle per debugging
          logger.info(`[DIRECT SAVE DEBUG] Bottle ${index + 1} structure:`, JSON.stringify(bottle, null, 2));
          
          return {
            ...bottle,
            // Thumbnail integration
            thumbnail: bottle.thumbnail || imageDataUrl,
            originalImageUrl: imageDataUrl,
            // Field mapping per frontend compatibility - usa verifiedData quando disponibile
            bottleLabel: bottle.verifiedData?.beerName || bottle.labelData?.beerName || bottle.beerName || bottle.bottleLabel || bottle.name || 'Birra sconosciuta',
            breweryName: webScrapingData?.data?.breweryName || bottle.verifiedData?.breweryName || bottle.labelData?.breweryName || bottle.breweryName || bottle.brewery || 'Birrificio sconosciuto',
            beerType: bottle.verifiedData?.beerType || bottle.labelData?.beerStyle || bottle.beerType || bottle.type || bottle.style || 'Tipo non specificato',
            alcoholContent: bottle.verifiedData?.alcoholContent || bottle.labelData?.alcoholContent || bottle.alcoholContent || bottle.abv || bottle.alcohol || 'N/A',
            // Aggiungi campi aggiuntivi dai verified data
            description: bottle.verifiedData?.description || bottle.description,
            ingredients: bottle.verifiedData?.ingredients || bottle.ingredients
          };
        }) : [],
        rateLimitInfo: {
          remainingRequests: Math.max(0, (AIService.canMakeRequest(req.session, req.user?._id).remainingRequests || 0) - 1),
          maxRequests: AIService.canMakeRequest(req.session, req.user?._id).maxRequests,
          isUserAuthenticated: !!req.user
        }
      };

      if (responseWarning) {
        response.rateLimitWarning = responseWarning;
      }

      return res.json(response);
    }

    // FALLBACK: Sistema legacy per retrocompatibilità 
    if (aiResult.needsDisambiguation) {
      const rawSuggestions = extractRawSuggestions(aiResult);
      const normalizedSuggestions = normalizeBrewerySuggestions(rawSuggestions);
      const ambiguities = Array.isArray(aiResult.ambiguities) ? aiResult.ambiguities : rawSuggestions;

      logger.info('[firstCheckAI] Disambiguazione richiesta', {
        sessionId: req.sessionID,
        reason: aiResult.disambiguationReason,
        suggestionsCount: normalizedSuggestions.length
      });

      const sessionPayload = {
        ...aiResult,
        suggestions: normalizedSuggestions,
        ambiguities
      };

      // Salva i dati temporanei con flag disambiguazione
      req.session.aiReviewData = {
        data: sessionPayload,
        timestamp: new Date().toISOString(),
        needsDisambiguation: true,
        tempData: true,
        processed: false
      };

      // 🖼️ Aggiungi thumbnail dell'immagine caricata alle bottiglie per disambiguazione
      const imageDataUrl = `data:${mimeType};base64,${base64Image}`;
      
      return res.status(200).json({
        success: false, // False per indicare che serve azione utente
        needsDisambiguation: true,
        disambiguationReason: aiResult.disambiguationReason,
        suggestions: normalizedSuggestions,
        ambiguities,
        bottles: aiResult.bottles ? aiResult.bottles.map(bottle => ({
          ...bottle,
          // Thumbnail integration
          thumbnail: bottle.thumbnail || imageDataUrl,
          originalImageUrl: imageDataUrl,
          // Field mapping per frontend compatibility 
          bottleLabel: bottle.beerName || bottle.bottleLabel || bottle.name || 'Birra sconosciuta',
          breweryName: webScrapingData?.data?.breweryName || bottle.breweryName || bottle.brewery || 'Birrificio sconosciuto', 
          beerType: bottle.beerType || bottle.type || bottle.style || 'Tipo non specificato',
          alcoholContent: bottle.alcoholContent || bottle.abv || bottle.alcohol || 'N/A'
        })) : [],
        originalAnalysis: sessionPayload,
        originalImage: req.session.aiImageData ? {
          base64: req.session.aiImageData.base64,
          mimeType: req.session.aiImageData.mimeType
        } : null,
        warning: responseWarning
      });
    }

    // 💾 TIMING: Salva i dati di analisi in sessione per persistenza
    // Questi dati vengono salvati IMMEDIATAMENTE dopo l'analisi AI
    // Il frontend riceverà success=true e aprirà il modal
    // Il modal farà polling su getAiDataFromSession() per ottenere questi dati
    req.session.aiReviewData = {
      data: aiResult,
      timestamp: new Date().toISOString(),
      completed: false,
      needsDisambiguation: false,
      tempData: false,
      processed: true
    };
    
    logger.info('[firstCheckAI] Dati analisi salvati in sessione', {
      sessionId: req.sessionID,
      bottlesCount: aiResult.bottles?.length || 0,
      needsDisambiguation: aiResult.needsDisambiguation,
      ambiguitiesCount: aiResult.ambiguities?.length || 0
    });

    // Verifica se è necessaria la disambiguazione
    if (aiResult.needsDisambiguation) {
      logger.info('[firstCheckAI] Disambiguazione necessaria, restituzione dati per frontend', {
        sessionId: req.sessionID,
        userId: req.user?._id,
        disambiguationReason: aiResult.disambiguationReason,
        ambiguitiesCount: aiResult.ambiguities?.length || 0
      });
      
      // Salva anche l'immagine per la pagina di disambiguazione
      req.session.aiImageData = {
        base64: base64Image,
        mimeType: mimeType,
        timestamp: new Date().toISOString()
      };
      
      // 🖼️ Aggiungi thumbnail dell'immagine caricata ai dati di disambiguazione
      const imageDataUrl = `data:${mimeType};base64,${base64Image}`;
      
      // Restituisci JSON invece di redirect - il frontend gestirà il reindirizzamento
      return res.json({
        success: true,
        needsDisambiguation: true,
        disambiguationReason: aiResult.disambiguationReason,
        data: {
          ...aiResult,
          bottles: aiResult.bottles ? aiResult.bottles.map(bottle => ({
            ...bottle,
            // Thumbnail integration
            thumbnail: bottle.thumbnail || imageDataUrl,
            originalImageUrl: imageDataUrl,
            // Field mapping per frontend compatibility 
            bottleLabel: bottle.beerName || bottle.bottleLabel || bottle.name || 'Birra sconosciuta',
            breweryName: webScrapingData?.data?.breweryName || bottle.breweryName || bottle.brewery || 'Birrificio sconosciuto', 
            beerType: bottle.beerType || bottle.type || bottle.style || 'Tipo non specificato',
            alcoholContent: bottle.alcoholContent || bottle.abv || bottle.alcohol || 'N/A'
          })) : []
        },
        originalImage: req.session.aiImageData ? {
          base64: req.session.aiImageData.base64,
          mimeType: req.session.aiImageData.mimeType
        } : null,
        redirectUrl: '/review',
        message: 'Sono state rilevate ambiguità nei dati. Verrai reindirizzato alla pagina di conferma.'
      });
    }

    // Incrementa il contatore delle richieste dopo analisi completata con successo
    AIService.incrementRequestCount(req.session);
    
    // 🖼️ Aggiungi thumbnail dell'immagine caricata a tutte le bottiglie
    const imageDataUrl = `data:${mimeType};base64,${base64Image}`;
    
    // Prepara risposta con eventuale warning e thumbnail
    const response = {
      ...aiResult,
      // Aggiungi thumbnail e normalizza campi per visualizzazione
      bottles: aiResult.bottles ? aiResult.bottles.map(bottle => ({
        ...bottle,
        // Thumbnail integration
        thumbnail: bottle.thumbnail || imageDataUrl,
        originalImageUrl: imageDataUrl,
        // Field mapping per frontend compatibility 
        bottleLabel: bottle.beerName || bottle.bottleLabel || bottle.name || 'Birra sconosciuta',
        breweryName: webScrapingData?.data?.breweryName || bottle.breweryName || bottle.brewery || 'Birrificio sconosciuto', 
        beerType: bottle.beerType || bottle.type || bottle.style || 'Tipo non specificato',
        alcoholContent: bottle.alcoholContent || bottle.abv || bottle.alcohol || 'N/A'
      })) : []
    };
    
    // Aggiungi warning se presente
    if (responseWarning) {
      response.rateLimitWarning = responseWarning;
    }
    
    // Aggiungi info rate limiting nella risposta
    const updatedRateLimitCheck = AIService.canMakeRequest(req.session, req.user?._id);
    response.rateLimitInfo = {
      remainingRequests: Math.max(0, updatedRateLimitCheck.remainingRequests - 1), // -1 perché abbiamo appena fatto una richiesta
      maxRequests: updatedRateLimitCheck.maxRequests,
      isUserAuthenticated: updatedRateLimitCheck.isUserAuthenticated
    };
    
    return res.json(response);
  } catch (err) {
    logger.error('[firstCheckAI] Errore:', { 
      error: err.message,
      sessionId: req.sessionID,
      userId: req.user?._id
    });
    return res.status(500).json({ success: false, message: 'Errore durante l\'analisi dell\'immagine.' });
  }
};

// Dashboard admin per risoluzione birrifici non riconosciuti
exports.adminBreweryResolution = async (req, res) => {
  try {
    // Recupera recensioni con birrifici non verificati
    const reviewsWithUnverifiedBreweries = await Review.find({
      status: 'pending_brewery_verification'
    })
    .populate('user', 'username email')
    .populate('ratings.brewery', 'breweryName status createdBy')
    .sort({ date: -1 });

    // Raggruppa per birrificio per una gestione più efficiente
    const breweryGroups = {};
    
    reviewsWithUnverifiedBreweries.forEach(review => {
      review.ratings.forEach(rating => {
        if (rating.brewery) {
          const breweryId = rating.brewery._id.toString();
          
          if (!breweryGroups[breweryId]) {
            breweryGroups[breweryId] = {
              brewery: rating.brewery,
              reviews: [],
              totalReviews: 0
            };
          }
          
          breweryGroups[breweryId].reviews.push({
            reviewId: review._id,
            user: review.user,
            date: review.date,
            beerName: rating.bottleLabel,
            rating: rating.rating,
            imageUrl: review.imageUrl
          });
          
          breweryGroups[breweryId].totalReviews++;
        }
      });
    });

    const breweryList = Object.values(breweryGroups);
    
    logger.info('[adminBreweryResolution] Dashboard birrifici non verificati caricata', {
      userId: req.user?._id,
      unverifiedBreweries: breweryList.length,
      totalReviews: reviewsWithUnverifiedBreweries.length
    });

    res.render('admin/breweryResolution.njk', {
      title: 'Risoluzione Birrifici',
      header: 'Birrifici da Verificare',
      breweryGroups: breweryList,
      totalUnverified: breweryList.length,
      totalReviews: reviewsWithUnverifiedBreweries.length
    });

  } catch (error) {
    logger.error('[adminBreweryResolution] Errore:', {
      error: error.message,
      userId: req.user?._id
    });
    res.status(500).render('error.njk', { 
      message: 'Errore interno del server',
      error: process.env.NODE_ENV === 'development' ? error : {}
    });
  }
};

// Approva birrificio e pubblica recensioni associate
exports.approveBrewery = async (req, res) => {
  try {
    const { breweryId } = req.params;
    const { action } = req.body; // 'approve' o 'reject'
    
    logger.info('[approveBrewery] Operazione su birrificio', {
      userId: req.user?._id,
      breweryId,
      action
    });
    
    if (action === 'approve') {
      // Approva birrificio
      await Brewery.findByIdAndUpdate(breweryId, {
        status: 'approved',
        approvedBy: req.user._id,
        approvedAt: new Date()
      });
      
      // Pubblica tutte le recensioni associate
      const result = await Review.updateMany(
        { 
          'ratings.brewery': breweryId,
          status: 'pending_brewery_verification'
        },
        { status: 'completed' }
      );
      
      logger.info('[approveBrewery] Birrificio approvato e recensioni pubblicate', {
        userId: req.user?._id,
        breweryId,
        reviewsPublished: result.modifiedCount
      });
      
      req.session.message = { 
        info: `Birrificio approvato! ${result.modifiedCount} recensioni pubblicate.` 
      };
      
    } else if (action === 'reject') {
      // Rifiuta birrificio
      await Brewery.findByIdAndUpdate(breweryId, {
        status: 'rejected',
        rejectedBy: req.user._id,
        rejectedAt: new Date()
      });
      
      // Rimuovi recensioni associate o portale in stato draft
      const result = await Review.updateMany(
        { 
          'ratings.brewery': breweryId,
          status: 'pending_brewery_verification'
        },
        { status: 'draft' }
      );
      
      logger.info('[approveBrewery] Birrificio rifiutato e recensioni spostate in draft', {
        userId: req.user?._id,
        breweryId,
        reviewsDrafted: result.modifiedCount
      });
      
      req.session.message = { 
        warning: `Birrificio rifiutato. ${result.modifiedCount} recensioni spostate in bozza.` 
      };
    }
    
    res.redirect('/admin/brewery-resolution');
    
  } catch (error) {
    logger.error('[approveBrewery] Errore:', {
      error: error.message,
      userId: req.user?._id,
      breweryId: req.params.breweryId
    });
    req.session.message = { error: 'Errore durante l\'operazione.' };
    res.redirect('/admin/brewery-resolution');
  }
};

// Normalizza nome birra/birrificio per confronto
function normalizeBeerName(name) {
  if (!name) return '';
  return name.toLowerCase()
    .replace(/[^\w\s]/g, '') // Rimuovi caratteri speciali
    .replace(/\s+/g, ' ')    // Normalizza spazi
    .trim();
}

// Batch di validazione secondo livello (solo admin)
exports.batchValidateReviews = async (req, res) => {
  try {
    const pendingReviews = await Review.find({ status: 'pending' });
    let updated = 0;
    for (const review of pendingReviews) {
      // Chiamata AI: estrazione dettagli birra/birrificio
      const details = await GeminiAI.extractBeerDetails(extractImageFromReview(review));
      // Aggiorna Review e Brewery con i dettagli recuperati
      if (details) {
        // Aggiorna brewery se necessario
        let brewery = await Brewery.findOne({ breweryEmail: details.breweryEmail });
        if (!brewery) {
          // 🔒 PROTEZIONE INTELLIGENTE: Salva dati con flag se non grounded
          const AIValidationService = require('../services/aiValidationService');
          const grounded = AIValidationService.isGrounded({ 
            verifiedData: details, 
            webVerification: details.webVerification 
          });

          // ✅ Salviamo sempre tutti i campi disponibili
          brewery = new Brewery({
            breweryName: details.breweryName,
            breweryEmail: details.breweryEmail || '',
            breweryWebsite: details.breweryWebsite || '',
            breweryLegalAddress: details.breweryLegalAddress || '',
            breweryDescription: details.breweryDescription || '',
            aiExtracted: true,
            needsValidation: !grounded,
            validationNotes: grounded 
              ? 'Creato da batch validation con dati grounded' 
              : 'Creato da batch validation - dati estratti ma non completamente verificati',
            dataSource: grounded ? 'batch_validation_grounded' : 'batch_validation_flagged'
          });
          
          if (grounded) {
            logger.info('[batchValidateReviews] ✅ Nuovo birrificio con dati grounded', {
              breweryName: details.breweryName
            });
          } else {
            logger.warn('[batchValidateReviews] ⚠️ Nuovo birrificio salvato ma flaggato', {
              breweryName: details.breweryName
            });
          }
          await brewery.save();
        }
        // Aggiorna review con dettagli birra
        review.ratings[0].beerType = details.beerType;
        review.ratings[0].alcoholContent = details.alcoholContent;
        review.ratings[0].brewery = brewery._id;
      }
      review.status = 'completed';
      await review.save();
      
      logger.info('[batchValidateReviews] Recensione salvata con successo', {
        type: 'REVIEW_SAVED_SUCCESS',
        reviewId: review._id,
        userId: review.userId,
        sessionId: review.sessionId,
        breweryId: review.ratings[0].brewery,
        beerName: review.ratings[0].beerName,
        beerType: review.ratings[0].beerType,
        status: review.status,
        createdAt: review.createdAt
      });
      
      updated++;
    }
    return res.json({ message: `Batch completato: ${updated} review aggiornate.` });
  } catch (err) {
    return res.status(500).json({ error: 'Errore batch validazione.' });
  }
};

// Visualizza birrifici incompleti (solo admin)
exports.incompleteBreweries = async (req, res) => {
  try {
    const incomplete = await Brewery.find({ $or: [
      { breweryEmail: { $exists: false } },
      { breweryEmail: '' },
      { breweryName: { $exists: false } },
      { breweryName: '' }
    ] });
    const complete = await Brewery.find({ breweryEmail: { $ne: '' }, breweryName: { $ne: '' } });
    return res.render('admin/incompleteBreweries.njk', { incomplete, complete });
  } catch (err) {
    return res.status(500).json({ error: 'Errore nel recupero birrifici.' });
  }
};

// Crea multiple recensioni da interfaccia AI
exports.createMultipleReviews = async (req, res) => {
  try {
    const { reviews, aiAnalysisData, locationData } = req.body;
    
    if (!reviews || !Array.isArray(reviews) || reviews.length === 0) {
      return res.status(400).json({ error: 'Nessuna recensione da salvare.' });
    }

    // 📍 Processa dati geolocalizzazione (se disponibili)
    let reviewLocation = null;
    if (locationData) {
      logger.info('[createMultipleReviews] 📍 Dati geolocalizzazione ricevuti:', {
        consentGiven: locationData.consentGiven,
        source: locationData.source,
        hasCoordinates: !!locationData.coordinates
      });
      
      // Valida e prepara i dati location per il Review
      if (locationData.consentGiven && locationData.coordinates) {
        reviewLocation = {
          coordinates: {
            latitude: locationData.coordinates.latitude,
            longitude: locationData.coordinates.longitude,
            accuracy: locationData.coordinates.accuracy,
            altitude: locationData.coordinates.altitude,
            altitudeAccuracy: locationData.coordinates.altitudeAccuracy,
            heading: locationData.coordinates.heading,
            speed: locationData.coordinates.speed
          },
          timestamp: locationData.timestamp ? new Date(locationData.timestamp) : new Date(),
          consentGiven: true,
          source: locationData.source || 'gps'
        };
        
        logger.info('[createMultipleReviews] 📍 ✅ Location validata e preparata per salvataggio', {
          latitude: reviewLocation.coordinates.latitude,
          longitude: reviewLocation.coordinates.longitude,
          accuracy: reviewLocation.coordinates.accuracy,
          source: reviewLocation.source
        });
      } else {
        logger.info('[createMultipleReviews] 📍 Consent negato o coordinate mancanti - location non salvata');
        reviewLocation = {
          consentGiven: false,
          source: 'none'
        };
      }
    } else {
      logger.info('[createMultipleReviews] 📍 Nessun dato geolocalizzazione nel payload');
    }

    logger.info('[createMultipleReviews] Creazione recensioni multiple', {
      userId: req.user?._id,
      sessionId: req.sessionID,
      reviewsCount: reviews.length,
      reviewsData: reviews.map(r => ({ 
        beerName: r?.beerName, 
        rating: r?.rating, 
        notes: r?.notes,
        hasNotes: !!r?.notes,
        hasDetailedRatings: !!r?.detailedRatings,
        detailedRatings: r?.detailedRatings,
        hasData: !!r?.aiData,
        beerId: r?.beerId
      }))
    });

    // Validazione input incluso controllo linguaggio inappropriato
    logger.info('[createMultipleReviews] Test validazione con reviews:', {
      reviewsCount: reviews.length,
      sampleTexts: reviews.slice(0, 2).map(r => ({
        beerName: r.beerName,
        notes: r.notes
      }))
    });
    
    const validationResult = ValidationService.validateReviewsInput({ reviews, aiAnalysisData });
    
    logger.info('[createMultipleReviews] Risultato validazione:', {
      isValid: validationResult.isValid,
      inappropriateContent: validationResult.inappropriateContent,
      hasDetails: !!validationResult.details
    });
    
    if (!validationResult.isValid) {
      if (validationResult.inappropriateContent) {
        // 🔍 DEBUG: Log dettagliato delle violazioni per troubleshooting
        logger.warn('[createMultipleReviews] ⚠️ Contenuto inappropriato rilevato - DETTAGLI COMPLETI:', {
          userId: req.user?._id,
          sessionId: req.sessionID,
          violationsCount: validationResult.details?.length || 0,
          violations: JSON.stringify(validationResult.details, null, 2),
          reviewsContent: reviews.map((r, idx) => ({
            reviewIndex: idx,
            tastingNotes: r.tastingNotes?.substring(0, 100),
            reviewNotes: r.reviewNotes?.substring(0, 100)
          }))
        });
        
        return res.status(400).json({
          error: 'Sono stati rilevati contenuti inappropriati nelle recensioni',
          inappropriateContent: true,
          details: validationResult.details,
          message: 'Per favore, rivedi il linguaggio utilizzato nelle tue recensioni. Evita contenuti volgari o inappropriati.'
        });
      } else {
        logger.warn('[createMultipleReviews] Validazione fallita', {
          userId: req.user?._id,
          sessionId: req.sessionID,
          errors: validationResult.details
        });
        
        return res.status(400).json({
          error: validationResult.message,
          details: validationResult.details
        });
      }
    }

    // Usa i dati validati (e potenzialmente sanificati)
    const validatedReviews = validationResult.data.reviews;
    const createdReviews = [];

    // 🔍 FILTRO RECENSIONI: Salva SOLO bottiglie con rating compilato (rating > 0)
    // Questo previene salvataggio di bottiglie presenti nella foto ma non recensite dall'utente
    const reviewsWithRating = validatedReviews.filter(review => {
      const hasRating = review.rating && review.rating > 0;
      if (!hasRating) {
        logger.info('[createMultipleReviews] ⏭️ Bottiglia saltata - nessuna recensione compilata', {
          beerName: review.beerName,
          rating: review.rating
        });
      }
      return hasRating;
    });

    if (reviewsWithRating.length === 0) {
      logger.warn('[createMultipleReviews] ⚠️ Nessuna recensione con rating valido trovata', {
        totalReviews: validatedReviews.length,
        sessionId: req.sessionID
      });
      return res.status(400).json({ 
        error: 'Nessuna recensione valida. Devi dare almeno una valutazione (stelle) per salvare.',
        details: 'Compila almeno una recensione prima di inviare.'
      });
    }

    logger.info('[createMultipleReviews] ✅ Recensioni filtrate', {
      totalBottles: validatedReviews.length,
      bottlesWithReview: reviewsWithRating.length,
      skipped: validatedReviews.length - reviewsWithRating.length
    });

    // Crea una singola review con ratings multipli (seguendo il modello Review esistente)
    const ratingsArray = [];
    
    // Recupera i dati di analisi dalla sessione per ottenere gli ID delle birre
    // O usa i dati forniti nel payload se disponibili (fallback per sessioni perse)
    let sessionAiData = req.session.aiReviewData;
    let usingFallbackData = false;
    
    if (!sessionAiData || !sessionAiData.data || !sessionAiData.data.processed || sessionAiData.data.tempData) {
      logger.warn('[createMultipleReviews] Dati sessione non disponibili, controllo fallback aiAnalysisData dal payload', {
        hasSessionData: !!sessionAiData,
        hasPayloadAiData: !!aiAnalysisData,
        sessionId: req.sessionID,
        userId: req.user?._id
      });
      
      // DEBUG: Log completo aiAnalysisData per capire cosa c'è
      logger.debug('[createMultipleReviews] DEBUG aiAnalysisData completo', {
        aiAnalysisData: aiAnalysisData,
        hasBottles: !!aiAnalysisData?.bottles,
        hasBreweryId: !!aiAnalysisData?.breweryId,
        hasBeerIds: !!aiAnalysisData?.beerIds,
        bottlesCount: aiAnalysisData?.bottles?.length,
        keys: aiAnalysisData ? Object.keys(aiAnalysisData) : []
      });
      
      // Fallback: usa i dati dal payload se disponibili
      // FIX: breweryId e beerIds potrebbero non esserci se è il primo tentativo o dopo errore moderazione
      // Accettiamo anche con solo bottles - creeremo le birre al volo
      if (aiAnalysisData && aiAnalysisData.bottles && aiAnalysisData.bottles.length > 0) {
        logger.info('[createMultipleReviews] ✅ Uso dati fallback dal payload', {
          bottlesCount: aiAnalysisData.bottles?.length || 0,
          breweryId: aiAnalysisData.breweryId || 'non presente (creerò al volo)',
          hasBeerIds: !!aiAnalysisData.beerIds,
          sessionId: req.sessionID
        });
        
        sessionAiData = {
          data: {
            ...aiAnalysisData,
            processed: true,
            tempData: false,
            beerIds: aiAnalysisData.beerIds || [] // Può essere vuoto, creeremo le birre
          }
        };
        usingFallbackData = true;
      } else {
        logger.error('[createMultipleReviews] CRITICO: Nessun dato disponibile né in sessione né nel payload', {
          hasSessionData: !!sessionAiData,
          hasPayloadAiData: !!aiAnalysisData,
          hasBottles: !!aiAnalysisData?.bottles,
          hasBreweryId: !!aiAnalysisData?.breweryId,
          hasBeerIds: !!aiAnalysisData?.beerIds,
          payloadKeys: aiAnalysisData ? Object.keys(aiAnalysisData) : [],
          sessionId: req.sessionID,
          userId: req.user?._id
        });
        
        return res.status(400).json({
          error: 'I dati di analisi non sono disponibili. Ricarica la pagina e riprova.',
          needsReanalysis: true,
          debug: {
            hasPayload: !!aiAnalysisData,
            missingFields: []
              .concat(!aiAnalysisData?.bottles ? ['bottles'] : [])
          }
        });
      }
    }
    
    let beerIds = sessionAiData?.data?.beerIds || [];
    
    // 🔧 ARRICCHIMENTO UNIVERSALE: Esegui arricchimento dati SEMPRE quando abbiamo bottles
    // IMPORTANTE: Arricchiamo SOLO le bottiglie per cui l'utente ha compilato una recensione
    // Filtriamo aiAnalysisData.bottles per includere solo quelle in reviewsWithRating
    const reviewedBottleNames = reviewsWithRating.map(r => r.beerName?.toLowerCase());
    const bottlesToEnrich = aiAnalysisData?.bottles?.filter(bottle => {
      const bottleName = (bottle.beerName || bottle.bottleLabel || bottle.verifiedData?.beerName)?.toLowerCase();
      return reviewedBottleNames.includes(bottleName);
    }) || [];

    logger.info('[createMultipleReviews] 🔍 Bottiglie da arricchire', {
      totalInPhoto: aiAnalysisData?.bottles?.length || 0,
      withReview: reviewsWithRating.length,
      toEnrich: bottlesToEnrich.length
    });
    
    // Non solo nel fallback, ma anche nel flusso normale con dati in sessione
    if (bottlesToEnrich.length > 0) {
      const needsEnrichment = beerIds.length === 0 || usingFallbackData || true; // SEMPRE arricchisci
      
      logger.info('[createMultipleReviews] 🔧 Esecuzione arricchimento dati birrificio e birre', {
        totalBottlesInPhoto: aiAnalysisData?.bottles?.length || 0,
        bottlesToEnrich: bottlesToEnrich.length,
        beerIdsCount: beerIds.length,
        usingFallback: usingFallbackData,
        sessionId: req.sessionID
      });
      
      try {
        const Brewery = require('../models/Brewery');
        const Beer = require('../models/Beer');
        
        // 🔧 FIX MULTI-BREWERY: Mappa per tracciare birrifici già processati in questa richiesta
        const processedBreweries = new Map(); // breweryName -> brewery document
        
        // Funzione helper per CERCARE birrificio esistente (NON crea - lascia al job asincrono)
        const getExistingBrewery = async (bottle) => {
          // 🔧 FIX BREWERY NAME: Priorità ai dati della bottiglia
          const breweryName = bottle.breweryName || bottle.brewery || 'Birrificio Sconosciuto';
          
          // Se già processato in questa richiesta, riusa lo stesso
          if (processedBreweries.has(breweryName)) {
            logger.debug('[createMultipleReviews] 🔄 Riuso birrificio già processato', {
              breweryName: breweryName,
              breweryId: processedBreweries.get(breweryName)?._id || 'null (pending async)'
            });
            return processedBreweries.get(breweryName);
          }
          
          // Cerca birrificio esistente nel DB
          let brewery = await Brewery.findOne({ breweryName: breweryName });
          
          if (!brewery) {
            // 🚫 FIX 13 GEN 2026: NON creare birrificio qui!
            // Il job asincrono (reviewProcessingService) lo creerà DOPO il Google Search Retrieval
            // con dati verificati (nome corretto, logo, website, ecc.)
            logger.info('[createMultipleReviews] ⏳ Birrificio NON trovato - sarà creato dal job asincrono dopo GSR', {
              breweryName: breweryName,
              reason: 'Evita creazione birrifici con nomi errati da AI OCR non verificata'
            });
            
            // Salva null nella mappa per non ripetere la ricerca
            processedBreweries.set(breweryName, null);
            return null;
          } else {
            // Birrificio ESISTE - arricchiscilo con nuovi dati se necessario
            let updated = false;
            const updates = {};
            
            // DEBUG: Log stato brewery corrente
            logger.debug('[createMultipleReviews] DEBUG: Stato brewery corrente prima arricchimento', {
              breweryId: brewery._id,
              breweryName: brewery.breweryName,
              hasWebsite: !!brewery.breweryWebsite,
              website: brewery.breweryWebsite,
              websiteType: typeof brewery.breweryWebsite,
              hasEmail: !!brewery.breweryEmail,
              email: brewery.breweryEmail,
              hasDescription: !!brewery.breweryDescription,
              description: brewery.breweryDescription ? brewery.breweryDescription.substring(0, 50) : null,
              hasSocialMedia: !!brewery.brewerySocialMedia,
              socialMedia: brewery.brewerySocialMedia,
              hasMainProducts: !!brewery.mainProducts,
              mainProducts: brewery.mainProducts
            });
            
            // Helper per aggiornare campo solo se vuoto/mancante nel DB
            const updateIfEmpty = (field, value) => {
              const fieldValue = brewery[field];
              const isEmpty = !fieldValue || 
                             fieldValue === '' || 
                             fieldValue === 'Non specificato' ||
                             (Array.isArray(fieldValue) && fieldValue.length === 0) ||
                             (typeof fieldValue === 'object' && !Array.isArray(fieldValue) && Object.keys(fieldValue).length === 0);
              
              // DEBUG: Log per ogni campo controllato
              logger.debug('[createMultipleReviews] DEBUG: Check campo brewery', {
                field: field,
                currentValue: fieldValue,
                newValue: value,
                isEmpty: isEmpty,
                willUpdate: value && isEmpty
              });
              
              if (value && isEmpty) {
                updates[field] = value;
                updated = true;
                return true;
              }
              return false;
            };
            
            // 🔧 FIX: Trova il birrificio CORRETTO per questa bottiglia specifica
            let breweryAiData = bottle.brewery || {};
            
            // Se non abbiamo dati nella bottiglia, cerca in aiAnalysisData.breweries
            if (!breweryAiData || Object.keys(breweryAiData).length === 0) {
              if (aiAnalysisData.breweries && aiAnalysisData.breweries.length > 0) {
                // Cerca il birrificio che corrisponde a questa bottiglia per nome
                const matchingBrewery = aiAnalysisData.breweries.find(b => 
                  b.verifiedData?.breweryName?.toLowerCase() === breweryName.toLowerCase() ||
                  b.labelData?.breweryName?.toLowerCase() === breweryName.toLowerCase()
                );
                
                if (matchingBrewery) {
                  breweryAiData = matchingBrewery.verifiedData || matchingBrewery.labelData || {};
                  logger.debug('[createMultipleReviews] ✅ Trovato birrificio matching per bottiglia', {
                    bottleBreweryName: breweryName,
                    matchedBreweryName: breweryAiData.breweryName,
                    matchedBreweryWebsite: breweryAiData.breweryWebsite,
                    matchedBreweryAddress: breweryAiData.breweryLegalAddress
                  });
                } else {
                  // Fallback al primo solo se non troviamo match (caso raro)
                  breweryAiData = aiAnalysisData.breweries[0]?.verifiedData || {};
                  logger.warn('[createMultipleReviews] ⚠️ Nessun birrificio matching trovato - usando primo (fallback)', {
                    bottleBreweryName: breweryName,
                    availableBreweries: aiAnalysisData.breweries.map(b => b.verifiedData?.breweryName || b.labelData?.breweryName)
                  });
                }
              } else if (aiAnalysisData.brewery) {
                // Caso singolo birrificio
                breweryAiData = aiAnalysisData.brewery;
              }
            }
            
            logger.debug('[createMultipleReviews] DEBUG: Sorgente dati AI brewery per bottiglia', {
              bottleBreweryName: breweryName,
              hasBottleBrewery: !!bottle.brewery,
              hasAiAnalysisBrewery: !!aiAnalysisData.brewery,
              hasAiAnalysisBreweries: !!aiAnalysisData.breweries,
              breweriesCount: aiAnalysisData.breweries?.length || 0,
              foundBreweryName: breweryAiData?.breweryName,
              foundBreweryWebsite: breweryAiData?.breweryWebsite,
              foundBreweryAddress: breweryAiData?.breweryLegalAddress
            });
            
            // Protezione intelligente anti-allucinazioni
            try {
              const AIValidationService = require('../services/aiValidationService');
              const groundedForBrewery = AIValidationService.isGrounded({ 
                verifiedData: breweryAiData, 
                webVerification: breweryAiData.webVerification || aiAnalysisData.webVerification 
              });

              // Salviamo SEMPRE i campi AI disponibili
              updateIfEmpty('breweryDescription', bottle.breweryDescription || breweryAiData.breweryDescription);
              
              // 🛡️ VALIDAZIONE INDIRIZZO: Salva solo se valido
              const addressToSave = bottle.breweryLocation || bottle.breweryLegalAddress || breweryAiData.breweryLegalAddress;
              if (addressToSave && AIValidationService.isValidAddress(addressToSave)) {
                updateIfEmpty('breweryLegalAddress', addressToSave);
                logger.info('[createMultipleReviews] ✅ Indirizzo validato e salvato', { address: addressToSave });
              } else if (addressToSave) {
                logger.warn('[createMultipleReviews] ⚠️ Indirizzo RIFIUTATO - non valido', { 
                  address: addressToSave,
                  reason: 'Pattern sospetto o dati incompleti'
                });
              }
              
              updateIfEmpty('breweryPhoneNumber', bottle.breweryPhoneNumber || breweryAiData.breweryPhoneNumber);
              updateIfEmpty('breweryWebsite', bottle.breweryWebsite || breweryAiData.breweryWebsite);
              updateIfEmpty('breweryEmail', bottle.breweryEmail || breweryAiData.breweryEmail);

              if (groundedForBrewery) {
                logger.info('[createMultipleReviews] ✅ Campi AI salvati con grounding verificato', {
                  breweryName: breweryName,
                  hasWebVerification: !!(breweryAiData.webVerification || aiAnalysisData.webVerification),
                  sourcesFound: (breweryAiData.webVerification || aiAnalysisData.webVerification)?.sourcesFound?.length || 0
                });
              } else {
                updates.needsValidation = true;
                updates.needsValidationReason = updates.needsValidationReason || [];
                updates.needsValidationReason.push('AI_data_saved_but_not_fully_grounded');

                logger.warn('[createMultipleReviews] ⚠️ Campi AI salvati ma non grounded - flag per revisione', {
                  breweryName: breweryName,
                  webVerification: breweryAiData.webVerification || aiAnalysisData.webVerification,
                  reason: 'Dati AI salvati con flag per revisione manuale'
                });
              }
            } catch (e) {
              updates.needsValidation = true;
              updates.needsValidationReason = updates.needsValidationReason || [];
              updates.needsValidationReason.push('grounding_check_error_all_fields_blocked');
              logger.error('[createMultipleReviews] ❌ Errore verifica grounding - NESSUN campo AI salvato', { 
                breweryName: breweryName,
                error: e.message 
              });
            }
            
            // Campi non sensibili
            updateIfEmpty('breweryLogo', bottle.breweryLogo || breweryAiData.breweryLogo);
            updateIfEmpty('foundingYear', bottle.foundingYear || breweryAiData.foundingYear);
            updateIfEmpty('breweryProductionAddress', bottle.breweryProductionAddress || breweryAiData.breweryProductionAddress);
            updateIfEmpty('brewerySize', bottle.brewerySize || breweryAiData.brewerySize);
            updateIfEmpty('employeeCount', bottle.employeeCount || breweryAiData.employeeCount);
            updateIfEmpty('productionVolume', bottle.productionVolume || breweryAiData.productionVolume);
            updateIfEmpty('distributionArea', bottle.distributionArea || breweryAiData.distributionArea);
            updateIfEmpty('breweryHistory', bottle.breweryHistory || breweryAiData.breweryHistory);
            updateIfEmpty('masterBrewer', bottle.masterBrewer || breweryAiData.masterBrewer);
            
            // Aggiorna social media se vuoti
            updateIfEmpty('brewerySocialMedia', bottle.brewerySocialMedia || breweryAiData.brewerySocialMedia);
          
          // Aggiorna array se vuoti
          updateIfEmpty('mainProducts', bottle.mainProducts || breweryAiData.mainProducts);
          updateIfEmpty('awards', bottle.awards || breweryAiData.awards);
          
          // Applica aggiornamenti se necessario
          if (updated) {
            updates.lastAiUpdate = new Date();
            updates.aiExtracted = true;
            
            await Brewery.findByIdAndUpdate(brewery._id, { $set: updates });
            logger.info('[createMultipleReviews] 🔄 Birrificio esistente arricchito con nuovi dati AI', {
              breweryId: brewery._id,
              breweryName: breweryName,
              updatedFields: Object.keys(updates)
            });
          } else {
            logger.info('[createMultipleReviews] ℹ️ Birrificio esistente già completo - nessun aggiornamento necessario', {
              breweryId: brewery._id,
              breweryName: breweryName
            });
          }
        }
        
        // Salva in mappa per riutilizzo
        processedBreweries.set(breweryName, brewery);
        return brewery;
      }; // Fine funzione helper getOrCreateBrewery
      
      // 🔧 CICLO MULTI-BREWERY: Elabora SOLO birre con recensione compilata
      for (const bottle of bottlesToEnrich) {
        // 🔧 OPZIONE A: Cerca SOLO birrificio esistente (creazione delegata a job asincrono GSR)
        const brewery = await getExistingBrewery(bottle);
        
        // Se il birrificio non esiste ancora, skip - sarà creato dal job asincrono dopo verifica GSR
        if (!brewery) {
          logger.info('[createMultipleReviews] ⏳ Birrificio non ancora presente - la birra sarà creata dal job asincrono dopo verifica GSR', {
            beerName: bottle.beerName || bottle.bottleLabel || 'N/A',
            searchedBreweryName: bottle.breweryName || bottle.brewery || 'N/A'
          });
          continue;
        }
        
        const beerName = bottle.beerName || bottle.bottleLabel || bottle.verifiedData?.beerName || bottle.labelData?.beerName || 'Birra Sconosciuta';
        
        // 🔧 FIX: I dati AI possono essere in verifiedData (nuova struttura) o direttamente in bottle
        const beerAiData = bottle.verifiedData || bottle;
        
        // 🛡️ VALIDAZIONE DATI AI: Controlla confidence e web verification
        const hasWebVerification = !!(beerAiData.webVerification || bottle.webVerification);
        const confidence = beerAiData.confidence || bottle.confidence || 0;
        const isReliable = confidence >= 0.6 || hasWebVerification;
        
        logger.info('[createMultipleReviews] 🔍 Validazione dati birra AI', {
          beerName: beerName,
          confidence: confidence,
          hasWebVerification: hasWebVerification,
          isReliable: isReliable,
          beerType: beerAiData.beerType
        });
        
        // Cerca birra esistente collegata al birrificio corretto
        // 🎯 FUZZY MATCHING: gestisce nomi parziali (lettere nascoste sul bordo bottiglia)
        let beer = await findExistingBeer(beerName, brewery._id);
        if (!beer) {
          // 🎯 MAPPATURA COMPLETA: Salviamo SOLO dati AI affidabili
          beer = new Beer({
            beerName: beerName,
            brewery: brewery._id,
            
            // 🛡️ Caratteristiche tecniche: SOLO se dati affidabili
            alcoholContent: isReliable ? (beerAiData.alcoholContent || bottle.aiData?.alcoholContent || '') : '',
            beerType: isReliable ? (beerAiData.beerType || bottle.aiData?.beerType || 'Non specificato') : 'Non specificato',
            beerSubStyle: isReliable ? (beerAiData.beerSubStyle || bottle.aiData?.beerSubStyle || '') : '',
            ibu: isReliable ? (beerAiData.ibu || bottle.aiData?.ibu || '') : '',
            volume: isReliable ? (beerAiData.volume || bottle.aiData?.volume || '') : '',
            
            // 🛡️ Descrizioni e note: SOLO se dati affidabili
            description: isReliable ? (beerAiData.description || bottle.aiData?.description || '') : '',
            ingredients: isReliable ? (beerAiData.ingredients || bottle.aiData?.ingredients || '') : '',
            tastingNotes: isReliable ? (beerAiData.tastingNotes || bottle.aiData?.tastingNotes || '') : '',
            nutritionalInfo: isReliable ? (beerAiData.nutritionalInfo || bottle.aiData?.nutritionalInfo || '') : '',
            
            // 🛡️ Informazioni commerciali: SOLO se dati affidabili
            price: isReliable ? (beerAiData.price || bottle.aiData?.price || '') : '',
            availability: isReliable ? (beerAiData.availability || bottle.aiData?.availability || '') : '',
            
            // Metadati AI
            aiExtracted: true,
            aiConfidence: beerAiData.confidence || bottle.confidence || bottle.aiData?.confidence || 0.5,
            dataSource: beerAiData.dataSource || bottle.dataSource || bottle.aiData?.dataSource || 'label',
            lastAiUpdate: new Date(),
            
            // 🛡️ Flag per dati non affidabili
            needsValidation: !isReliable,
            validationNotes: !isReliable ? 'Dati AI con bassa confidence - richiedono verifica manuale' : ''
          });
          await beer.save();
          
          if (isReliable) {
            logger.info('[createMultipleReviews] ✅ Birra creata con dati AI affidabili', {
              beerId: beer._id,
              beerName: beerName,
              beerType: beer.beerType,
              alcoholContent: beer.alcoholContent,
              confidence: beer.aiConfidence,
              hasWebVerification: hasWebVerification
            });
          } else {
            logger.warn('[createMultipleReviews] ⚠️ Birra creata ma dati limitati (bassa confidence)', {
              beerId: beer._id,
              beerName: beerName,
              confidence: beer.aiConfidence,
              reason: 'Confidence < 0.5 e nessuna web verification'
            });
          }
        } else {
          // 🔄 ARRICCHIMENTO INTELLIGENTE: Aggiorna solo campi vuoti/mancanti con dati AI
          let updated = false;
          const updates = {};
          
          // Helper per aggiornare campo solo se vuoto/mancante nel DB
          const updateIfEmpty = (field, value) => {
            const fieldValue = beer[field];
            const isEmpty = !fieldValue || 
                           fieldValue === '' || 
                           fieldValue === 'Non specificato' ||
                           (Array.isArray(fieldValue) && fieldValue.length === 0) ||
                           (typeof fieldValue === 'object' && !Array.isArray(fieldValue) && Object.keys(fieldValue).length === 0);
            
            if (value && isEmpty) {
              updates[field] = value;
              updated = true;
              return true;
            }
            return false;
          };
          
          // 🛡️ ARRICCHIMENTO INTELLIGENTE: Aggiorna SOLO con dati affidabili
          if (isReliable) {
            // Aggiorna caratteristiche tecniche se vuote
            updateIfEmpty('alcoholContent', beerAiData.alcoholContent || bottle.aiData?.alcoholContent);
            updateIfEmpty('beerType', beerAiData.beerType || bottle.aiData?.beerType);
            updateIfEmpty('beerSubStyle', beerAiData.beerSubStyle || bottle.aiData?.beerSubStyle);
            updateIfEmpty('ibu', beerAiData.ibu || bottle.aiData?.ibu);
            updateIfEmpty('volume', beerAiData.volume || bottle.aiData?.volume);
            
            // Aggiorna descrizioni se vuote
            updateIfEmpty('description', beerAiData.description || bottle.aiData?.description);
            updateIfEmpty('ingredients', beerAiData.ingredients || bottle.aiData?.ingredients);
            updateIfEmpty('tastingNotes', beerAiData.tastingNotes || bottle.aiData?.tastingNotes);
            updateIfEmpty('nutritionalInfo', beerAiData.nutritionalInfo || bottle.aiData?.nutritionalInfo);
            
            // Aggiorna info commerciali se vuote
            updateIfEmpty('price', beerAiData.price || bottle.aiData?.price);
            updateIfEmpty('availability', beerAiData.availability || bottle.aiData?.availability);
          } else {
            logger.warn('[createMultipleReviews] ⚠️ Arricchimento birra esistente SALTATO - dati non affidabili', {
              beerId: beer._id,
              beerName: beerName,
              confidence: confidence,
              reason: 'Confidence < 0.5 e nessuna web verification'
            });
            
            // Flag per revisione manuale
            updates.needsValidation = true;
            updates.validationNotes = 'Dati AI disponibili ma non affidabili - richiedono verifica manuale';
            updated = true;
          }
          
          // Applica aggiornamenti se necessario
          if (updated) {
            updates.lastAiUpdate = new Date();
            updates.aiExtracted = true;
            updates.dataSource = bottle.dataSource || bottle.aiData?.dataSource || 'label';
            
            await Beer.findByIdAndUpdate(beer._id, { $set: updates });
            
            if (isReliable) {
              logger.info('[createMultipleReviews] 🔄 Birra esistente arricchita con dati AI affidabili', {
                beerId: beer._id,
                beerName: beerName,
                fieldsUpdated: Object.keys(updates).filter(k => !['needsValidation', 'validationNotes', 'lastAiUpdate', 'aiExtracted', 'dataSource'].includes(k)).length,
                confidence: confidence,
                hasWebVerification: hasWebVerification
              });
            } else {
              logger.warn('[createMultipleReviews] ⚠️ Birra flaggata per revisione manuale', {
                beerId: beer._id,
                beerName: beerName,
                confidence: confidence,
                updatedFields: Object.keys(updates)
              });
            }
          } else {
            logger.info('[createMultipleReviews] ℹ️ Birra esistente già completa - nessun aggiornamento necessario', {
              beerId: beer._id,
              beerName: beerName
            });
          }
        }
        
        beerIds.push(beer._id);
      } // Fine loop bottle
      
      // Aggiorna sessionAiData con i nuovi IDs se erano vuoti
      if (!sessionAiData.data.beerIds || sessionAiData.data.beerIds.length === 0) {
        sessionAiData.data.beerIds = beerIds;
      }
      
      logger.info('[createMultipleReviews] ✅ Arricchimento completato', {
        breweriesProcessed: processedBreweries.size,
        beerIdsCount: beerIds.length
      });
        
      } catch (enrichmentError) {
        logger.error('[createMultipleReviews] ❌ Errore durante arricchimento dati', {
          error: enrichmentError.message,
          stack: enrichmentError.stack
        });
        // Non bloccare il salvataggio - continua con i dati esistenti
        logger.warn('[createMultipleReviews] ⚠️ Continuo con dati esistenti nonostante errore arricchimento');
      }
    }
    
    // Itera SOLO su recensioni compilate (già filtrate)
    for (const [index, reviewData] of reviewsWithRating.entries()) {
      // Verifica che reviewData sia definito e abbia le proprietà necessarie
      if (!reviewData || typeof reviewData !== 'object') {
        logger.warn('[createMultipleReviews] ReviewData non valido, skipping', {
          reviewData: reviewData
        });
        continue;
      }

      if (!reviewData.rating || reviewData.rating < 1 || reviewData.rating > 5) {
        logger.warn('[createMultipleReviews] Rating non valido, skipping', {
          beerName: reviewData.beerName || 'undefined',
          rating: reviewData.rating
        });
        continue;
      }

      // Usa l'ID della birra dal database se disponibile
      const beerId = reviewData.beerId || beerIds[index] || null;
      
      // Recupera l'ID del birrificio dalla sessione di analisi (breweryId è aggiunto dopo il salvataggio)
      let breweryId = sessionAiData?.data?.breweryId || aiAnalysisData?.breweryId || null;
      
      // FIX: Se breweryId non è disponibile, recuperalo dalla birra
      if (!breweryId && beerId) {
        try {
          const Beer = require('../models/Beer');
          const beer = await Beer.findById(beerId).select('brewery');
          if (beer && beer.brewery) {
            breweryId = beer.brewery;
            logger.info('[createMultipleReviews] BreweryId recuperato dalla birra', {
              beerId: beerId,
              breweryId: breweryId
            });
          }
        } catch (error) {
          logger.error('[createMultipleReviews] Errore recupero brewery dalla birra', {
            beerId: beerId,
            error: error.message
          });
        }
      }

      // Aggiungi alla array ratings
      ratingsArray.push({
        bottleLabel: reviewData.beerName || 'Birra sconosciuta',
        rating: reviewData.rating,
        notes: reviewData.notes || '', // Note generali (già sanificate se necessario)
        beer: beerId, // ID della birra dal database
        brewery: breweryId, // ID del birrificio dal database
        // Valutazioni dettagliate (se presenti) - solo le 4 categorie specifiche
        detailedRatings: reviewData.detailedRatings ? {
          appearance: reviewData.detailedRatings.appearance ? {
            rating: reviewData.detailedRatings.appearance.rating || null,
            notes: reviewData.detailedRatings.appearance.notes || null // Già sanificato se necessario
          } : null,
          aroma: reviewData.detailedRatings.aroma ? {
            rating: reviewData.detailedRatings.aroma.rating || null,
            notes: reviewData.detailedRatings.aroma.notes || null // Già sanificato se necessario
          } : null,
          taste: reviewData.detailedRatings.taste ? {
            rating: reviewData.detailedRatings.taste.rating || null,
            notes: reviewData.detailedRatings.taste.notes || null // Già sanificato se necessario
          } : null,
          mouthfeel: reviewData.detailedRatings.mouthfeel ? {
            rating: reviewData.detailedRatings.mouthfeel.rating || null,
            notes: reviewData.detailedRatings.mouthfeel.notes || null // Già sanificato se necessario
          } : null
        } : null,
        aiData: {
          bottleLabel: reviewData.beerName || 'Birra sconosciuta',
          alcoholContent: reviewData.aiData?.alcoholContent || '',
          beerType: reviewData.aiData?.beerType || '',
          beerSubStyle: reviewData.aiData?.beerSubStyle || '',
          volume: reviewData.aiData?.volume || '',
          description: reviewData.aiData?.description || '',
          ingredients: reviewData.aiData?.ingredients || '',
          tastingNotes: reviewData.notes || '',
          confidence: reviewData.aiData?.confidence || 0,
          dataSource: reviewData.aiData?.dataSource || 'label',
          ibu: reviewData.aiData?.ibu || '',
          nutritionalInfo: reviewData.aiData?.nutritionalInfo || '',
          price: reviewData.aiData?.price || '',
          availability: reviewData.aiData?.availability || ''
        }
      });
      
      logger.info('[createMultipleReviews] Rating aggiunto', {
        beerName: reviewData.beerName || 'undefined',
        rating: reviewData.rating,
        notes: reviewData.notes,
        notesLength: reviewData.notes?.length || 0,
        beerId: beerId,
        breweryId: breweryId,
        hasNotes: !!reviewData.notes,
        hasDetailedRatings: !!reviewData.detailedRatings,
        detailedRatingsCategories: reviewData.detailedRatings ? Object.keys(reviewData.detailedRatings).filter(key => reviewData.detailedRatings[key]) : []
      });
    }

    if (ratingsArray.length === 0) {
      return res.status(400).json({ error: 'Nessuna recensione valida è stata creata.' });
    }

    // ✅ FIX #3: UPDATE Review esistente invece di CREATE nuovo
    let savedReview;
    if (req.body.reviewId) {
      // UPDATE: Review già creata in STEP 1, aggiungi solo ratings e user
      logger.info('[createMultipleReviews] 📥 reviewId ricevuto da STEP 1, aggiornamento Review esistente', {
        reviewId: req.body.reviewId,
        ratingsCount: ratingsArray.length
      });
      
      // 🔧 FIX: Uso findByIdAndUpdate invece di findById + save() per evitare VersionError
      // La race condition avviene perché reviewProcessingService usa updateOne/bulkWrite
      // mentre qui usavamo .save() - entrambi incrementano __v causando conflitto
      savedReview = await Review.findByIdAndUpdate(
        req.body.reviewId,
        {
          $set: {
            user: req.user ? req.user._id : null,
            ratings: ratingsArray,
            status: 'completed',
            processingStatus: 'pending_validation',
            // 📍 Aggiungi location se disponibile
            ...(reviewLocation && { location: reviewLocation }),
            aiAnalysis: {
              webSearchPerformed: aiAnalysisData?.webSearchPerformed || false,
              imageQuality: aiAnalysisData?.imageQuality || 'buona',
              analysisComplete: true,
              overallConfidence: aiAnalysisData?.overallConfidence || 0.8,
              processingTime: aiAnalysisData?.processingTime || '2s'
            }
          }
        },
        { new: true } // Ritorna il documento aggiornato
      );
      
      if (!savedReview) {
        logger.error('[createMultipleReviews] ❌ Review non trovata', { reviewId: req.body.reviewId });
        return res.status(404).json({ error: 'Recensione non trovata. Riprova.' });
      }
      createdReviews.push(savedReview);
      
      logger.info('[createMultipleReviews] ✅ Review aggiornata (NO duplicato!)', {
        reviewId: savedReview._id,
        ratingsCount: ratingsArray.length,
        sessionId: req.sessionID
      });
    } else {
      // CREATE: Fallback legacy (caso edge se reviewId manca)
      logger.warn('[createMultipleReviews] ⚠️ reviewId mancante, creazione nuova Review (legacy fallback)');
      
      const newReview = new Review({
        imageUrl: req.body.reviews?.[0]?.thumbnail || 'data:image/jpeg;base64,placeholder',
        user: req.user ? req.user._id : null,
        sessionId: req.sessionID,
        ratings: ratingsArray,
        status: 'completed',
        date: new Date(),
        // 📍 Aggiungi location se disponibile
        ...(reviewLocation && { location: reviewLocation }),
        aiAnalysis: {
          webSearchPerformed: aiAnalysisData?.webSearchPerformed || false,
          imageQuality: aiAnalysisData?.imageQuality || 'buona',
          analysisComplete: true,
          overallConfidence: aiAnalysisData?.overallConfidence || 0.8,
          processingTime: aiAnalysisData?.processingTime || '2s'
        }
      });
      
      savedReview = await newReview.save();
      createdReviews.push(savedReview);
      
      logger.info('[createMultipleReviews] Recensione salvata (legacy)', {
        reviewId: savedReview._id,
        ratingsCount: ratingsArray.length,
        sessionId: req.sessionID
      });
    }

    if (createdReviews.length === 0) {
      return res.status(400).json({ error: 'Nessuna recensione valida è stata creata.' });
    }

    logger.info('[createMultipleReviews] Tutte le recensioni salvate', {
      totalCreated: createdReviews.length,
      reviewIds: createdReviews.map(r => r._id),
      userId: req.user?._id,
      sessionId: req.sessionID
    });

    // 🔄 TIMING CRITICO: Marca i dati di analisi come completati in sessione
    // Questo FERMA il polling del frontend (getAiDataFromSession restituirà hasData: false)
    // Il frontend chiuderà il modal e mostrerà il messaggio di successo
    if (req.session.aiReviewData) {
      req.session.aiReviewData.completed = true;
      req.session.aiReviewData.completedAt = new Date().toISOString();
      logger.info('[createMultipleReviews] 🔄 Dati analisi marcati come completati - polling frontend si fermerà', {
        sessionId: req.sessionID,
        completedAt: req.session.aiReviewData.completedAt
      });
    }

    // 🎉 MESSAGGIO DI RINGRAZIAMENTO: Aggiungi messaggio flash per utente
    const totalBeers = ratingsArray.length;
    const beersText = totalBeers === 1 ? '1 birra' : `${totalBeers} birre`;
    req.flash('success', `🎉 Grazie per il tuo contributo! Hai recensito ${beersText}. Le tue opinioni aiutano la community a scoprire nuove birre artigianali!`);
    
    logger.info('[createMultipleReviews] Messaggio di ringraziamento impostato per utente', {
      userId: req.user?._id,
      sessionId: req.sessionID,
      totalBeers: totalBeers
    });

    return res.status(201).json({
      success: true,
      message: `${createdReviews.length} recensioni create con successo`,
      reviews: createdReviews.map(review => ({
        id: review._id,
        ratingsCount: review.ratings?.length || 0,
        ratings: review.ratings?.map(rating => ({
          beerName: rating.bottleLabel || rating.aiData?.bottleLabel || 'Birra sconosciuta',
          rating: rating.rating,
          notes: rating.aiData?.tastingNotes || ''
        })) || []
      }))
    });

  } catch (err) {
    logger.error('[createMultipleReviews] Errore:', { 
      error: err.message,
      userId: req.user?._id,
      sessionId: req.sessionID
    });
    return res.status(500).json({ error: 'Errore nella creazione delle recensioni.' });
  }
};

/**
 * Risolve l'ambiguità di un birrificio e salva i dati nel database
 */
exports.resolveDisambiguation = async (req, res) => {
  try {
    const { selectedBreweryId, createNew, newBreweryData } = req.body;
    
    // Recupera i dati di analisi dalla sessione
    const sessionData = req.session.aiReviewData;
    if (!sessionData || !sessionData.data || sessionData.data.processed || !sessionData.data.tempData) {
      return res.status(400).json({
        success: false,
        error: 'Nessun dato di analisi in attesa di disambiguazione trovato'
      });
    }

    logger.info('[resolveDisambiguation] Avvio risoluzione disambiguazione', {
      sessionId: req.sessionID,
      userId: req.user?._id,
      selectedBreweryId,
      createNew: !!createNew,
      hasNewBreweryData: !!newBreweryData
    });

    let finalBreweryId = null;

    if (createNew && newBreweryData) {
      // Crea nuovo birrificio con dati forniti dall'utente
      logger.info('[resolveDisambiguation] Creazione nuovo birrificio', {
        breweryName: newBreweryData.breweryName,
        sessionId: req.sessionID
      });

      const GeminiAI = require('../utils/geminiAi');
      finalBreweryId = await GeminiAI.findOrCreateBrewery(newBreweryData);
      
    } else if (selectedBreweryId) {
      // Usa birrificio esistente selezionato
      logger.info('[resolveDisambiguation] Uso birrificio esistente', {
        breweryId: selectedBreweryId,
        sessionId: req.sessionID
      });

      finalBreweryId = selectedBreweryId;
      
    } else {
      return res.status(400).json({
        success: false,
        error: 'Devi selezionare un birrificio esistente o fornire i dati per un nuovo birrificio'
      });
    }

    // Ora salva i dati con il birrificio confermato
    const analysisData = sessionData.data;
    
    // Processa le birre e crea/aggiorna gli ID
    const GeminiAI = require('../utils/geminiAi');
    const beerIds = [];
    
    for (const bottle of analysisData.bottles || []) {
      try {
        const beerId = await GeminiAI.findOrCreateBeer(bottle, finalBreweryId);
        if (beerId) {
          beerIds.push(beerId);
        }
      } catch (error) {
        logger.error('[resolveDisambiguation] Errore creazione birra', {
          error: error.message,
          beerName: bottle.beerName || 'sconosciuta',
          breweryId: finalBreweryId
        });
      }
    }

    // Aggiorna i dati di sessione con gli ID confermati
    const resolvedData = {
      ...analysisData,
      breweryId: finalBreweryId,
      beerIds: beerIds,
      needsDisambiguation: false,
      processed: true, // Ora i dati sono confermati e processati
      tempData: false, // Non più temporanei
      resolvedAt: new Date().toISOString()
    };

    // Salva in sessione i dati risolti
    req.session.aiReviewData = {
      data: resolvedData,
      timestamp: new Date().toISOString(),
      completed: false
    };

    logger.info('[resolveDisambiguation] Disambiguazione completata con successo', {
      sessionId: req.sessionID,
      userId: req.user?._id,
      finalBreweryId,
      beerIdsCreated: beerIds.length
    });

    res.json({
      success: true,
      message: 'Disambiguazione completata con successo',
      data: {
        breweryId: finalBreweryId,
        beerIds: beerIds,
        bottles: analysisData.bottles
      }
    });

  } catch (error) {
    logger.error('[resolveDisambiguation] Errore:', {
      error: error.message,
      userId: req.user?._id,
      sessionId: req.sessionID
    });
    
    res.status(500).json({
      success: false,
      error: 'Errore interno durante la risoluzione dell\'ambiguità'
    });
  }
};

/**
 * Recupera i dati di analisi dalla sessione se presenti
 */
/**
 * Recupera i dati di analisi AI dalla sessione per aggiornare i modals frontend
 * 
 * TIMING E FLUSSO:
 * 1. Upload immagine → firstCheckAI() → AI analizza immagine
 * 2. AI completa → Salva risultati in req.session.aiReviewData
 * 3. Frontend riceve risposta firstCheckAI con success=true
 * 4. Frontend apre modal recensione
 * 5. Frontend fa polling ogni 1-2s chiamando questo endpoint
 * 6. Questo endpoint restituisce i dati aggiornati dalla sessione
 * 7. Frontend aggiorna modal con dati birre/birrifici arricchiti
 * 8. Quando utente invia recensione → completed=true → polling si ferma
 * 
 * NOTA: I dati sono GIÀ in sessione quando il modal si apre.
 *       Il polling serve per aggiornare il modal se ci sono modifiche
 *       (es: disambiguazione risolta, dati web scraping arrivati)
 */
exports.getAiDataFromSession = async (req, res) => {
  try {
    const sessionData = req.session.aiReviewData;
    
    if (!sessionData || sessionData.completed) {
      logger.debug('[getAiDataFromSession] 🔄 Polling: Nessun dato o recensione completata', {
        sessionId: req.sessionID,
        hasData: !!sessionData,
        completed: sessionData?.completed,
        reason: !sessionData ? 'no_session_data' : 'review_completed'
      });
      return res.json({ hasData: false });
    }
    
    logger.debug('[getAiDataFromSession] ✅ Polling: Dati disponibili per modal', {
      sessionId: req.sessionID,
      timestamp: sessionData.timestamp,
      bottlesCount: sessionData.data?.bottles?.length || 0,
      needsDisambiguation: sessionData.data?.needsDisambiguation || false,
      processed: sessionData.processed
    });
    
    return res.json({ 
      hasData: true, 
      hasDisambiguationData: !!sessionData.data,
      hasReviewData: !!sessionData.data,
      needsDisambiguation: sessionData.data?.needsDisambiguation || false,
      disambiguationReason: sessionData.data?.disambiguationReason,
      bottles: sessionData.data?.bottles,
      suggestions: sessionData.data?.suggestions,
      ambiguities: sessionData.data?.ambiguities,
      originalImage: req.session.aiImageData ? {
        base64: req.session.aiImageData.base64,
        mimeType: req.session.aiImageData.mimeType
      } : null,
      timestamp: sessionData.timestamp,
      ...sessionData.data
    });
    
  } catch (error) {
    logger.error('[getAiDataFromSession] Errore durante il recupero dei dati dalla sessione', {
      sessionId: req.sessionID,
      error: error.message
    });
    return res.status(500).json({ error: 'Errore interno del server' });
  }
};

/**
 * Pulisce i dati di analisi dalla sessione
 */
exports.clearAiDataFromSession = async (req, res) => {
  try {
    // Usa il servizio di cleanup per pulizia completa
    CleanupService.forceCleanSession(req.session);
    
    logger.info('[clearAiDataFromSession] Dati di analisi rimossi dalla sessione via CleanupService', {
      sessionId: req.sessionID
    });
    
    return res.json({ success: true, message: 'Dati di analisi rimossi dalla sessione' });
    
  } catch (error) {
    logger.error('[clearAiDataFromSession] Errore durante la pulizia dei dati dalla sessione', {
      sessionId: req.sessionID,
      error: error.message
    });
    return res.status(500).json({ error: 'Errore interno del server' });
  }
};

/**
 * Visualizza le recensioni con i collegamenti alle birre (debug/admin)
 */
exports.viewReviewBeerConnections = async (req, res) => {
  try {
    const reviews = await Review.find({})
      .populate('user', 'username email')
      .populate('ratings.brewery', 'breweryName')
      .populate('ratings.beer', 'beerName alcoholContent beerType')
      .sort({ date: -1 })
      .limit(50);

    const reviewConnections = reviews.map(review => ({
      reviewId: review._id,
      user: review.user?.username || 'Anonimo',
      date: review.date,
      status: review.status,
      sessionId: review.sessionId,
      ratingsCount: review.ratings?.length || 0,
      ratings: review.ratings.map(rating => ({
        bottleLabel: rating.bottleLabel,
        rating: rating.rating,
        brewery: {
          id: rating.brewery?._id,
          name: rating.brewery?.breweryName || 'Non collegato'
        },
        beer: {
          id: rating.beer?._id,
          name: rating.beer?.beerName || 'Non collegato',
          alcoholContent: rating.beer?.alcoholContent,
          beerType: rating.beer?.beerType
        },
        hasAiData: !!rating.aiData,
        aiDataBottleLabel: rating.aiData?.bottleLabel
      }))
    }));

    logger.info('[viewReviewBeerConnections] Collegamenti recensioni-birre recuperati', {
      reviewsCount: reviews.length,
      connectedBeers: reviewConnections.reduce((sum, r) => sum + r.ratings.filter(rt => rt.beer.id).length, 0),
      totalRatings: reviewConnections.reduce((sum, r) => sum + r.ratingsCount, 0)
    });

    if (req.headers.accept && req.headers.accept.includes('application/json')) {
      return res.json({
        success: true,
        reviewConnections: reviewConnections,
        summary: {
          totalReviews: reviews.length,
          totalRatings: reviewConnections.reduce((sum, r) => sum + r.ratingsCount, 0),
          connectedBeers: reviewConnections.reduce((sum, r) => sum + r.ratings.filter(rt => rt.beer.id).length, 0),
          unconnectedRatings: reviewConnections.reduce((sum, r) => sum + r.ratings.filter(rt => !rt.beer.id).length, 0)
        }
      });
    } else {
      return res.render('admin/reviewBeerConnections.njk', { 
        reviewConnections,
        title: 'Collegamenti Recensioni-Birre'
      });
    }

  } catch (error) {
    logger.error('[viewReviewBeerConnections] Errore nel recupero collegamenti', {
      error: error.message
    });
    return res.status(500).json({ error: 'Errore nel recupero dei collegamenti' });
  }
};

/**
 * Risolve l'ambiguità di birrifici selezionando manualmente
 */
exports.resolveDisambiguation = async (req, res) => {
  try {
    const { selectedBreweryId, createNewBrewery, newBreweryData } = req.body;
    
    logger.info('[resolveDisambiguation] Risoluzione disambiguazione', {
      sessionId: req.sessionID,
      selectedBreweryId,
      createNewBrewery: !!createNewBrewery,
      hasNewBreweryData: !!newBreweryData
    });

    // Recupera i dati AI temporanei dalla sessione
    if (!req.session.aiReviewData || !req.session.aiReviewData.needsDisambiguation) {
      return res.status(400).json({
        success: false,
        error: 'Nessun dato di disambiguazione trovato in sessione'
      });
    }

    const originalAnalysis = req.session.aiReviewData.data;
    let resolvedBrewery = null;

    if (createNewBrewery && newBreweryData) {
      // Opzione: Crea nuovo birrificio
      logger.info('[resolveDisambiguation] Creazione nuovo birrificio', {
        breweryName: newBreweryData.breweryName,
        sessionId: req.sessionID
      });

      // Validazione dati minimi per nuovo birrificio
      if (!newBreweryData.breweryName || newBreweryData.breweryName.trim().length < 2) {
        return res.status(400).json({
          success: false,
          error: 'Nome birrificio richiesto (minimo 2 caratteri)'
        });
      }

      // 🔒 PROTEZIONE INTELLIGENTE: Salva con flag se non grounded
      const AIValidationService = require('../services/aiValidationService');
      const grounded = AIValidationService.isGrounded({ 
        verifiedData: newBreweryData, 
        webVerification: newBreweryData.webVerification || originalAnalysis.webVerification 
      });

      // ✅ Salviamo sempre tutti i campi disponibili
      const newBreweryDoc = {
        breweryName: newBreweryData.breweryName.trim(),
        breweryWebsite: newBreweryData.breweryWebsite || null,
        breweryEmail: newBreweryData.breweryEmail || null,
        breweryLocation: newBreweryData.breweryLocation || null,
        breweryPhoneNumber: newBreweryData.breweryPhoneNumber || null,
        breweryDescription: newBreweryData.breweryDescription || null,
        breweryLegalAddress: newBreweryData.breweryLegalAddress || null,
        createdBy: 'ai_disambiguation',
        createdFromAI: true,
        needsValidation: !grounded,
        // 🔥 FIX: Aggiungo validationReason (16 dic 2025)
        validationReason: !grounded 
          ? 'Creato da disambiguazione AI - dati non verificati online, richiede verifica manuale'
          : null,
        validationNotes: grounded 
          ? 'Creato da disambiguazione con dati grounded' 
          : 'Creato da disambiguazione - dati estratti ma verifica web consigliata'
      };

      const newBrewery = new Brewery(newBreweryDoc);
      resolvedBrewery = await newBrewery.save();
      
      if (grounded) {
        logger.info('[resolveDisambiguation] ✅ Nuovo birrificio con dati grounded', {
          breweryId: resolvedBrewery._id,
          breweryName: newBreweryData.breweryName,
          hasWebsite: !!newBreweryData.breweryWebsite,
          hasEmail: !!newBreweryData.breweryEmail,
          sessionId: req.sessionID
        });
      } else {
        logger.warn('[resolveDisambiguation] ⚠️ Nuovo birrificio salvato ma flaggato', {
          breweryId: resolvedBrewery._id,
          breweryName: newBreweryData.breweryName,
          needsValidation: true,
          sessionId: req.sessionID
        });
      }

      logger.info('[resolveDisambiguation] Nuovo birrificio creato', {
        breweryId: resolvedBrewery._id,
        breweryName: resolvedBrewery.breweryName,
        grounded: grounded,
        needsValidation: resolvedBrewery.needsValidation,
        sessionId: req.sessionID
      });

    } else if (selectedBreweryId) {
      // Opzione: Seleziona birrificio esistente
      resolvedBrewery = await Brewery.findById(selectedBreweryId);
      
      if (!resolvedBrewery) {
        return res.status(404).json({
          success: false,
          error: 'Birrificio selezionato non trovato'
        });
      }

      logger.info('[resolveDisambiguation] Birrificio esistente selezionato', {
        breweryId: resolvedBrewery._id,
        breweryName: resolvedBrewery.breweryName,
        sessionId: req.sessionID
      });

    } else {
      return res.status(400).json({
        success: false,
        error: 'Devi selezionare un birrificio esistente o crearne uno nuovo'
      });
    }

    // Aggiorna l'analisi AI con il birrificio risolto
    const resolvedAnalysis = {
      ...originalAnalysis,
      brewery: {
        breweryName: resolvedBrewery.breweryName,
        breweryWebsite: resolvedBrewery.breweryWebsite,
        breweryEmail: resolvedBrewery.breweryEmail,
        breweryLocation: resolvedBrewery.breweryLocation,
        _id: resolvedBrewery._id
      },
      needsDisambiguation: false,
      disambiguationResolved: true,
      disambiguationMethod: createNewBrewery ? 'new_brewery' : 'existing_brewery'
    };

    // Aggiorna le birre con il birrificio risolto
    if (resolvedAnalysis.bottles) {
      resolvedAnalysis.bottles = resolvedAnalysis.bottles.map(bottle => ({
        ...bottle,
        brewery: resolvedAnalysis.brewery,
        breweryName: resolvedBrewery.breweryName,
        // Field mapping per frontend compatibility 
        bottleLabel: bottle.beerName || bottle.bottleLabel || bottle.name || 'Birra sconosciuta',
        beerType: bottle.beerType || bottle.type || bottle.style || 'Tipo non specificato',
        alcoholContent: bottle.alcoholContent || bottle.abv || bottle.alcohol || 'N/A'
      }));
    }

    // Salva l'analisi risolta in sessione
    req.session.aiReviewData = {
      data: resolvedAnalysis,
      timestamp: new Date().toISOString(),
      completed: false,
      needsDisambiguation: false,
      tempData: false,
      processed: true,
      disambiguationResolved: true
    };

    logger.info('[resolveDisambiguation] Disambiguazione completata', {
      sessionId: req.sessionID,
      breweryId: resolvedBrewery._id,
      bottlesCount: resolvedAnalysis.bottles?.length || 0,
      method: resolvedAnalysis.disambiguationMethod
    });

    return res.status(200).json({
      success: true,
      message: 'Disambiguazione risolta con successo',
      brewery: resolvedAnalysis.brewery,
      bottles: resolvedAnalysis.bottles,
      resolvedAnalysis: resolvedAnalysis
    });

  } catch (error) {
    logger.error('[resolveDisambiguation] Errore durante risoluzione', {
      sessionId: req.sessionID,
      error: error.message,
      stack: error.stack
    });

    return res.status(500).json({
      success: false,
      error: 'Errore interno durante la risoluzione dell\'ambiguità'
    });
  }
};

/**
 * 🌐 Costruisce risultato analisi da dati web scraping + validazione AI birre
 * @param {Object} webScrapingData - Dati estratti da web scraping
 * @param {Buffer} imageBuffer - Buffer immagine per analisi birre
 * @param {Object} session - Sessione utente
 * @param {String} userId - ID utente
 * @returns {Promise<Object>} Risultato formattato come AIService
 */
/**
 * ✨ NUOVO METODO OTTIMIZZATO: Arricchisce risultato AI con dati web scraping
 * NON fa chiamate AI aggiuntive - usa solo i dati già estratti
 * @param {Object} aiResult - Risultato completo da analisi AI (già contiene birre)
 * @param {Object} webScrapingData - Dati estratti da web scraping
 * @param {Object} session - Sessione utente
 * @param {String} userId - ID utente
 * @returns {Object} Risultato arricchito merge AI + Web Scraping
 */
exports.enhanceAiResultWithWebScraping = async function(aiResult, webScrapingData, session, userId) {
  const validationController = require('./validationController');
  
  try {
    logger.info('[enhanceAiResultWithWebScraping] 🔄 Merge dati AI + Web Scraping');
    
    // ✅ NESSUNA CHIAMATA AI AGGIUNTIVA - usiamo aiResult.bottles già estratte
    
    if (!aiResult.bottles || aiResult.bottles.length === 0) {
      logger.warn('[enhanceAiResultWithWebScraping] ⚠️ Nessuna birra nell\'AI result');
      return aiResult; // Ritorna risultato AI originale
    }
    
    // 1. Arricchisci dati birrificio con info da web scraping
    const enhancedBrewery = {
      ...aiResult.brewery, // Dati base da AI
      ...webScrapingData.data, // Sovrascrive con dati più completi da web
      validationStatus: 'validated',
      dataSource: 'web_scraped+ai',
      needsManualReview: false,
      webScrapingConfidence: webScrapingData.confidence,
      aiConfidence: aiResult.validation?.confidence || 0.8
    };
    
    // 2. Verifica e arricchisci birre: merge dati AI + dettagli da web scraping
    const WebScrapingService = require('../services/webScrapingService');
    const enhancedBeers = [];
    const unvalidatedBeers = [];
    
    for (const aiBeer of aiResult.bottles) {
      try {
        logger.info('[enhanceAiResultWithWebScraping] 🔍 Elaborazione birra', { 
          beerName: aiBeer.beerName 
        });

        // STEP 1: Cerca birra nel sito web usando il nuovo sistema di scraping
        let webBeerData = null;
        
        // Se abbiamo già birre dal web scraping del birrificio, cerca match
        if (webScrapingData.data.beers && webScrapingData.data.beers.length > 0) {
          webBeerData = webScrapingData.data.beers.find(wb => 
            WebScrapingService.verifyBeerBelongsToBrewery(aiBeer.beerName, webScrapingData.data.beers)
          );
          
          if (webBeerData) {
            logger.debug('[enhanceAiResultWithWebScraping] ✅ Birra trovata in lista birrificio');
          }
        }
        
        // STEP 2: Se non trovata, cerca pagina specifica della birra con scraping dettagliato
        if (!webBeerData && enhancedBrewery.website) {
          logger.info('[enhanceAiResultWithWebScraping] 🔎 Ricerca pagina specifica birra', {
            beerName: aiBeer.beerName,
            breweryWebsite: enhancedBrewery.website
          });
          
          const beerSearchResult = await WebScrapingService.searchBeerOnWeb(
            aiBeer.beerName,
            enhancedBrewery.breweryName,
            enhancedBrewery.website
          );
          
          if (beerSearchResult.found && beerSearchResult.confidence >= 0.3) {
            webBeerData = beerSearchResult.beer;
            logger.info('[enhanceAiResultWithWebScraping] ✅ Birra trovata con scraping dedicato', {
              beerName: aiBeer.beerName,
              confidence: beerSearchResult.confidence,
              fieldsFound: beerSearchResult.fieldsFound,
              scrapedFrom: beerSearchResult.scrapedFrom
            });
          } else {
            logger.warn('[enhanceAiResultWithWebScraping] ⚠️ Scraping dedicato non ha trovato dati', {
              beerName: aiBeer.beerName,
              confidence: beerSearchResult.confidence
            });
          }
        }
        
        // STEP 3: Merge dati AI + Web
        if (webBeerData) {
          // ✅ Birra trovata su sito - MERGE intelligente dati AI + Web
          const mergedBeer = {
            ...aiBeer, // Dati base da AI (immagine, posizione, etc)
            // Arricchimento con dati web (priorità web per dettagli tecnici)
            alcoholContent: webBeerData.alcoholContent || aiBeer.alcoholContent,
            beerType: webBeerData.beerType || aiBeer.beerType,
            beerSubStyle: webBeerData.beerSubStyle || aiBeer.beerSubStyle,
            ibu: webBeerData.ibu || aiBeer.ibu,
            volume: webBeerData.volume || aiBeer.volume,
            description: webBeerData.description || aiBeer.description,
            ingredients: webBeerData.ingredients || aiBeer.ingredients,
            tastingNotes: webBeerData.tastingNotes || aiBeer.tastingNotes,
            nutritionalInfo: webBeerData.nutritionalInfo || aiBeer.nutritionalInfo,
            price: webBeerData.price || aiBeer.price,
            availability: webBeerData.availability || aiBeer.availability,
            // Metadati
            beerName: aiBeer.beerName, // SEMPRE priorità nome da AI (più preciso dall'etichetta)
            validationStatus: 'validated',
            dataSource: 'web_scraped+ai',
            needsManualReview: false,
            webScrapingApplied: true
          };
          
          enhancedBeers.push(mergedBeer);
          
          logger.info('[enhanceAiResultWithWebScraping] ✅ Birra arricchita completamente', {
            beerName: aiBeer.beerName,
            hasAlcohol: !!mergedBeer.alcoholContent,
            hasIBU: !!mergedBeer.ibu,
            hasType: !!mergedBeer.beerType,
            hasIngredients: !!mergedBeer.ingredients,
            hasTastingNotes: !!mergedBeer.tastingNotes,
            hasPrice: !!mergedBeer.price
          });
        } else {
          // ⚠️ Birra NON trovata su sito - usa solo dati AI
          unvalidatedBeers.push({
            ...aiBeer,
            validationStatus: 'pending_validation',
            dataSource: 'ai_extracted',
            needsManualReview: true,
            reviewReason: 'Birra non trovata nel sito ufficiale del birrificio (nè in lista nè con scraping dedicato)',
            webScrapingAttempted: true
          });
          
          logger.warn('[enhanceAiResultWithWebScraping] ⚠️ Birra non trovata su web', {
            beerName: aiBeer.beerName,
            reason: 'Nessuna corrispondenza trovata'
          });
        }
      } catch (beerError) {
        logger.error('[enhanceAiResultWithWebScraping] ❌ Errore elaborazione birra', {
          beerName: aiBeer.beerName,
          error: beerError.message
        });
        
        // Fallback: usa dati AI senza arricchimento
        unvalidatedBeers.push({
          ...aiBeer,
          validationStatus: 'pending_validation',
          dataSource: 'ai_extracted',
          needsManualReview: true,
          reviewReason: `Errore durante scraping: ${beerError.message}`,
          webScrapingError: beerError.message
        });
      }
    }
    
    logger.info('[enhanceAiResultWithWebScraping] 🍺 Statistiche arricchimento', {
      totalBeers: aiResult.bottles.length,
      enhancedWithWeb: enhancedBeers.length,
      aiOnly: unvalidatedBeers.length,
      successRate: `${((enhancedBeers.length / aiResult.bottles.length) * 100).toFixed(1)}%`
    });
    
    // 3. Costruisci risultato finale ARRICCHITO
    const enhancedResult = {
      ...aiResult, // Mantieni struttura originale AI
      brewery: enhancedBrewery,
      bottles: [...enhancedBeers, ...unvalidatedBeers],
      validation: {
        ...aiResult.validation,
        source: 'ai+web_scraping',
        webScrapingConfidence: webScrapingData.confidence,
        enhancedBeers: enhancedBeers.length,
        aiOnlyBeers: unvalidatedBeers.length
      },
      dataEnhancement: {
        applied: true,
        source: 'web_scraping',
        confidence: webScrapingData.confidence,
        beersEnhanced: enhancedBeers.length,
        totalBeers: aiResult.bottles.length
      }
    };
    
    // 4. Se ci sono birre non validate, notifica administrator
    if (unvalidatedBeers.length > 0) {
      session.pendingValidation = {
        breweryName: enhancedBrewery.breweryName,
        beersCount: unvalidatedBeers.length,
        timestamp: new Date()
      };
      
      logger.info('[enhanceAiResultWithWebScraping] ⚠️ Birre da validare - Notifica admin', {
        breweryName: enhancedBrewery.breweryName,
        unvalidatedCount: unvalidatedBeers.length
      });
      
      try {
        await validationController.notifyAdministrators('beers', {
          breweryName: enhancedBrewery.breweryName,
          beersCount: unvalidatedBeers.length,
          beers: unvalidatedBeers.map(b => b.beerName)
        });
        logger.info('[enhanceAiResultWithWebScraping] ✅ Email notifica inviata');
      } catch (emailError) {
        logger.error('[enhanceAiResultWithWebScraping] ❌ Errore email notifica', {
          error: emailError.message
        });
      }
    }
    
    return enhancedResult;
    
  } catch (error) {
    logger.error('[enhanceAiResultWithWebScraping] ❌ Errore arricchimento', {
      error: error.message,
      stack: error.stack
    });
    
    // Fallback: ritorna risultato AI originale senza arricchimento
    logger.warn('[enhanceAiResultWithWebScraping] ⚠️ Fallback - Uso solo dati AI originali');
    return aiResult;
  }
};

/**
 * @deprecated - Sostituito da enhanceAiResultWithWebScraping
 * Mantenuto per retrocompatibilità ma NON più usato (causava doppia chiamata AI)
 */
exports.buildResultFromWebScraping = async function(webScrapingData, imageBuffer, session, userId) {
  logger.warn('[buildResultFromWebScraping] ⚠️ DEPRECATED - Usa enhanceAiResultWithWebScraping invece');
  throw new Error('buildResultFromWebScraping is deprecated - use enhanceAiResultWithWebScraping');
};
