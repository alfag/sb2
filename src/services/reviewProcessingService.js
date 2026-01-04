/**
 * Review Background Processing Service
 * Gestisce il processing asincrono delle recensioni in background
 * Punto 15: Logica di elaborazione birrificio/birra disaccoppiata dalla creazione recensione
 */

const Review = require('../models/Review');
const Brewery = require('../models/Brewery');
const Beer = require('../models/Beer');
const logWithFileName = require('../utils/logger');
const WebScrapingService = require('./webScrapingService');
const WebSearchService = require('./webSearchService');
const HTMLParser = require('../utils/htmlParser'); // 🔥 P0.3: Import per estrazione dati birra da web

const logger = logWithFileName(__filename);

/**
 * 🔥 P2.7 FIX: Estrae il nome del birrificio dal nome della birra (7 dic 2025)
 * SCOPO: Identificare il birrificio, NON modificare il nome della birra
 * 
 * PROBLEMA: L'AI spesso concatena il nome del birrificio nel beerName
 * Es: "Ichnusa Non Filtrata" → birrificio estratto: "Ichnusa", birra RIMANE: "Ichnusa Non Filtrata"
 * Es: "Peroni Nastro Azzurro" → birrificio estratto: "Peroni", birra RIMANE: "Peroni Nastro Azzurro"
 * 
 * NOTA: Il nome del birrificio viene recuperato ESCLUSIVAMENTE via web search (DuckDuckGo)
 * e web scraping del sito ufficiale. NON viene mai "indovinato" dal nome della birra.
 */

/**
 * Processa una recensione in background
 * Questo è il cuore del sistema asincrono (Punto 15)
 * 
 * @param {Object} job - Job Bull con i dati
 * @returns {Promise<Object>} Risultato processing
 */
async function processReviewBackground(job) {
  const { reviewId, bottles, imageDataUrl, userId, isTest, useRealServices } = job.data;
  const startTime = Date.now();

  try {
    logger.info(`🚀 Inizio processing recensione ${reviewId}${isTest ? ' (TEST MODE)' : ''}${useRealServices ? ' (REAL SERVICES)' : ''}`);
    
    // 🔍 TEST MODE: Se è un test, simula il processing senza salvare nulla
    if (isTest && !useRealServices) {
      logger.info(`🧪 TEST MODE: Simulazione processing per ${bottles.length} bottiglie`);
      
      // Simula i passi del processing
      await job.progress({ percent: 10, step: 'ai-analysis' });
      await job.progress({ percent: 70, step: 'web-search' });
      await job.progress({ percent: 90, step: 'validation' });
      await job.progress({ percent: 100, step: 'completed' });
      
      const processingTime = Date.now() - startTime;
      
      // 🎯 RESTITUISCI I DATI DELLE BOTIGLIE PROCESSATE PER IL TEST
      const processedBottles = bottles.map((bottle, index) => ({
        // Dati diretti per compatibilità con frontend
        beerName: bottle.beerName,
        breweryName: bottle.breweryName,
        beerType: bottle.beerStyle,
        alcoholContent: bottle.alcoholContent,
        ibu: bottle.ibu,
        volume: bottle.volume,
        description: bottle.labelData?.description || 'Descrizione da etichetta',
        ingredients: bottle.labelData?.ingredients || '',
        color: bottle.labelData?.color || '',
        servingTemperature: bottle.labelData?.servingTemperature || '',
        tastingNotes: bottle.labelData?.tastingNotes || '',
        breweryLegalAddress: bottle.location,
        website: bottle.labelData?.website || null,
        email: bottle.labelData?.email || null,
        phone: bottle.labelData?.phone || null,
        foundingYear: bottle.year,
        brewerySize: bottle.labelData?.brewerySize || null,
        productionVolume: bottle.labelData?.productionVolume || null,
        breweryDescription: bottle.labelData?.breweryDescription || 'Descrizione da etichetta',
        breweryHistory: bottle.labelData?.breweryHistory || '',
        mainProducts: bottle.labelData?.mainProducts || [],
        awards: bottle.labelData?.awards || [],
        brewerySocialMedia: bottle.labelData?.brewerySocialMedia || [],
        dataSource: bottle.dataSource,
        
        // Metadati processing
        metadata: {
          breweryFound: false, // In test, assumiamo non trovato
          beerFound: false,    // In test, assumiamo non trovato
          webSearchPerformed: true, // Simuliamo ricerca web
          needsDatabaseCreation: true, // Sempre true in test
          extractionConfidence: bottle.extractionConfidence || 0.8
        },
        
        // Dati originali AI
        aiRawData: {
          labelData: bottle.labelData,
          searchQueries: bottle.searchQueries,
          extractionConfidence: bottle.extractionConfidence,
          dataSource: bottle.dataSource
        }
      }));
      
      logger.info(`✅ TEST MODE: Recensione ${reviewId} processata con successo (simulazione)`, {
        processingTime: `${processingTime}ms`,
        bottlesProcessed: processedBottles.length,
        errors: 0
      });
      
      return {
        success: true,
        reviewId,
        bottlesProcessed: processedBottles.length,
        errors: 0,
        processingTime: `${processingTime}ms`,
        dataSource: 'test_simulation',
        isTest: true,
        
        // 🎯 INCLUDI I DATI PROCESSATI PER IL TEST
        bottles: processedBottles,
        
        // Summary per test
        summary: {
          totalBottles: processedBottles.length,
          breweriesFound: 0,
          beersFound: 0,
          webSearchesPerformed: processedBottles.length,
          needsCreation: processedBottles.length,
          errors: 0
        }
      };
    }
    
    // 🔍 TEST MODE WITH REAL SERVICES: Usa servizi reali ma non salva nel database
    if (isTest && useRealServices) {
      logger.info(`🧪🔍 TEST MODE (REAL SERVICES): Processing con servizi reali per ${bottles.length} bottiglie`);
      
      // Funzione helper per aggiornare progress con step
      const updateProgress = async (percent, step) => {
        await job.progress({ percent, step });
        logger.info(`📊 Progress: ${percent}% - ${step}`);
      };
      
      await updateProgress(10, 'ai-analysis'); // 10% - Analisi AI completata
      
      // 2. Processa ogni bottiglia (supporto multi-bottiglia) - SENZA SALVARE
      const processedBottles = [];
      const errors = [];
      
      for (let i = 0; i < bottles.length; i++) {
        const bottle = bottles[i];
        
        // Il nome birra rimane quello originale dall'AI
        // Il birrificio viene trovato SOLO via web search (DuckDuckGo + web scraping)
        
        try {
          const bottleProgress = 10 + (i / bottles.length) * 60;
          const currentStep = i === 0 ? 'web-search' : 'web-scraping';
          await updateProgress(bottleProgress, currentStep); // 10-70% - Processing bottiglie
          
          logger.info(`🍺 Processing bottiglia ${i + 1}/${bottles.length} (REAL SERVICES)`, {
            beerName: bottle.beerName,
            breweryName: bottle.breweryName || '(non specificato)'
          });
          
          // 🔥 FIX 21 DIC 2025: Usa breweryName da AI se disponibile
          // L'AI ora estrae separatamente beerName e breweryName dall'etichetta
          const aiBreweryName = bottle.breweryName && bottle.breweryName !== '(non specificato)' 
            ? bottle.breweryName 
            : null;
          
          if (aiBreweryName) {
            logger.info(`🎯 AI ha estratto breweryName dall'etichetta: "${aiBreweryName}"`);
          }
          
          // 2a. Trova birrificio esistente tramite birra O tramite nome birrificio da AI
          let brewery = null;
          let existingBeer = await Beer.findOne({
            beerName: { $regex: new RegExp(`^${bottle.beerName}$`, 'i') }
          }).populate('brewery');
          
          if (existingBeer && existingBeer.brewery) {
            // Birra trovata, usa il birrificio associato
            brewery = existingBeer.brewery;
            logger.info(`✅ Birrificio trovato tramite birra esistente: ${brewery.breweryName} (da birra: ${bottle.beerName})`);
          } else if (aiBreweryName) {
            // 🔥 FIX: Cerca birrificio per nome estratto da AI
            brewery = await Brewery.findOne({
              breweryName: { $regex: new RegExp(`^${aiBreweryName}$`, 'i') }
            });
            if (brewery) {
              logger.info(`✅ Birrificio trovato in DB tramite nome AI: ${brewery.breweryName}`);
            } else {
              // Prova ricerca parziale
              brewery = await Brewery.findOne({
                breweryName: { $regex: new RegExp(aiBreweryName.replace(/birrificio\s*/i, ''), 'i') }
              });
              if (brewery) {
                logger.info(`✅ Birrificio trovato in DB tramite nome AI (parziale): ${brewery.breweryName}`);
              }
            }
          }
          
          if (!brewery && !aiBreweryName) {
            logger.info(`❌ Birra non trovata in DB e AI non ha fornito breweryName, userò solo nome birra per ricerca web: "${bottle.beerName}"`);
          }
          
          let breweryData = {};
          let breweryName = aiBreweryName; // Usa prima il nome da AI se disponibile
          
          if (brewery) {
            logger.info(`✅ Birrificio trovato in DB: ${brewery.breweryName}`);
            breweryName = brewery.breweryName; // Usa nome dal DB (più affidabile)
            breweryData = {
              breweryName: brewery.breweryName,
              website: brewery.website,
              email: brewery.email,
              phone: brewery.phone,
              breweryLegalAddress: brewery.breweryLegalAddress,
              foundingYear: brewery.foundingYear,
              brewerySize: brewery.brewerySize,
              productionVolume: brewery.productionVolume,
              description: brewery.description,
              breweryHistory: brewery.breweryHistory,
              mainProducts: brewery.mainProducts,
              awards: brewery.awards,
              brewerySocialMedia: brewery.brewerySocialMedia
            };
          } else {
            // 2b. Birrificio non esiste in DB → cerca via web search
            // 🔥 FIX: Usa il nome del birrificio da AI se disponibile per una ricerca più precisa
            const searchTerm = aiBreweryName 
              ? `${aiBreweryName} birrificio sito ufficiale`
              : `${bottle.beerName} birrificio produttore`;
            
            logger.info(`🔍 Birrificio non trovato in DB, ricerca web: "${searchTerm}"`, {
              beerName: bottle.beerName,
              aiBreweryName: aiBreweryName || '(non disponibile)'
            });
            
            if (bottle.website) {
              try {
                logger.info(`🌐 Web scraping birrificio da URL fornito: ${bottle.website}`);
                const webData = await WebScrapingService.scrapeBreweryWebsite(bottle.website);
                
                // 🔥 FIX 8 DIC 2025: Estrai dati da webData.data (struttura corretta)
                // webScrapingService ritorna { success, source, data: { breweryName, breweryDescription, ... } }
                if (webData && webData.success && webData.data) {
                  const scrapedBrewery = webData.data;
                  
                  // Mappa tutti i campi estratti
                  if (scrapedBrewery.breweryName) {
                    breweryName = scrapedBrewery.breweryName;
                    logger.info(`✅ Nome birrificio estratto dal web: ${breweryName}`);
                  }
                  breweryData.website = breweryData.website || webData.websiteUrl;
                  breweryData.breweryLegalAddress = scrapedBrewery.breweryLegalAddress || breweryData.breweryLegalAddress;
                  breweryData.email = scrapedBrewery.breweryEmail || breweryData.email;
                  breweryData.phone = scrapedBrewery.breweryPhoneNumber || breweryData.phone;
                  breweryData.description = scrapedBrewery.breweryDescription || breweryData.description;
                  breweryData.foundingYear = scrapedBrewery.foundingYear || breweryData.foundingYear;
                  breweryData.breweryHistory = scrapedBrewery.breweryHistory || breweryData.breweryHistory;
                  breweryData.awards = scrapedBrewery.awards || breweryData.awards || [];
                  breweryData.brewerySocialMedia = scrapedBrewery.brewerySocialMedia || breweryData.brewerySocialMedia || {};
                  breweryData.breweryLogo = scrapedBrewery.breweryLogo || breweryData.breweryLogo;
                  breweryData.breweryImages = scrapedBrewery.breweryImages || breweryData.breweryImages || [];
                  breweryData.beers = scrapedBrewery.beers || breweryData.beers || [];
                  
                  // Aggiungi metadata scraping
                  breweryData.scrapedAt = webData.scrapedAt;
                  breweryData.scrapingConfidence = webData.confidence;
                  breweryData.dataSource = 'web_scraping';
                  
                  const extractedFields = Object.keys(scrapedBrewery).filter(k => scrapedBrewery[k]);
                  logger.info(`✅ Dati web estratti: ${extractedFields.length} campi`, {
                    campi: extractedFields,
                    hasDescription: !!breweryData.description,
                    hasAddress: !!breweryData.breweryLegalAddress,
                    hasEmail: !!breweryData.email,
                    confidence: webData.confidence
                  });
                } else {
                  logger.warn(`⚠️ Web scraping non ha restituito dati validi`, {
                    success: webData?.success,
                    hasData: !!webData?.data
                  });
                }
              } catch (error) {
                logger.warn(`⚠️ Web scraping fallito per ${bottle.website}: ${error.message}`);
              }
            } else {
              // Prova Google Search
              try {
                logger.info(`🔍 Avvio Google search per birrificio: "${searchTerm}"`);
                const searchResult = await WebSearchService.searchBreweryOnWeb(searchTerm);
                
                if (searchResult && searchResult.found && searchResult.brewery) {
                  // 🎯 SALVA TUTTI I DATI del birrificio restituiti da webSearch
                  const breweryFromWeb = searchResult.brewery;
                  
                  breweryData.website = breweryFromWeb.breweryWebsite;
                  breweryData.breweryLegalAddress = breweryFromWeb.breweryLegalAddress;
                  breweryData.email = breweryFromWeb.breweryEmail;
                  breweryData.phone = breweryFromWeb.breweryPhoneNumber;
                  breweryData.description = breweryFromWeb.breweryDescription;
                  breweryData.foundingYear = breweryFromWeb.foundingYear;
                  breweryData.brewerySize = breweryFromWeb.brewerySize;
                  breweryData.mainProducts = breweryFromWeb.mainProducts || [];
                  breweryData.awards = breweryFromWeb.awards || [];
                  breweryData.brewerySocialMedia = breweryFromWeb.brewerySocialMedia || [];
                  breweryData.breweryHistory = breweryFromWeb.history;
                  // 🔥 P0.2 FIX: Nuovi campi da HTMLParser (7 dic 2025)
                  breweryData.employeeCount = breweryFromWeb.employeeCount;
                  breweryData.productionVolume = breweryFromWeb.productionVolume;
                  breweryData.masterBrewer = breweryFromWeb.masterBrewer;
                  breweryData.breweryFiscalCode = breweryFromWeb.breweryFiscalCode;
                  breweryData.reaCode = breweryFromWeb.reaCode;
                  breweryData.acciseCode = breweryFromWeb.acciseCode;
                  
                  if (breweryFromWeb.breweryName) {
                    breweryName = breweryFromWeb.breweryName;
                    logger.info(`✅ Nome birrificio trovato: ${breweryName}`);
                  }
                  
                  logger.info(`✅ Dati birrificio completi estratti da web search`, {
                    website: !!breweryData.website,
                    address: !!breweryData.breweryLegalAddress,
                    email: !!breweryData.email,
                    phone: !!breweryData.phone,
                    description: !!breweryData.description,
                    foundingYear: !!breweryData.foundingYear,
                    brewerySize: !!breweryData.brewerySize,
                    mainProducts: breweryData.mainProducts?.length || 0,
                    awards: breweryData.awards?.length || 0,
                    socialMedia: Object.keys(breweryData.brewerySocialMedia || {}).length,
                    confidence: searchResult.confidence,
                    source: searchResult.source
                  });
                } else {
                  logger.warn(`❌ Nessun dato birrificio trovato per: "${searchTerm}"`);
                }
              } catch (error) {
                logger.warn(`⚠️ Google search fallito per "${searchTerm}": ${error.message}`);
              }
            }
          }
          
          // 2c. Trova birra esistente (SENZA CREARE)
          let beer = await Beer.findOne({
            beerName: { $regex: new RegExp(`^${bottle.beerName}$`, 'i') },
            brewery: brewery?._id
          });
          
          let beerData = {};
          if (beer) {
            logger.info(`✅ Birra trovata in DB: ${bottle.beerName}`);
            beerData = {
              beerType: beer.beerType,
              alcoholContent: beer.alcoholContent,
              ibu: beer.ibu,
              description: beer.description,
              ingredients: beer.ingredients,
              volume: beer.volume,
              color: beer.color,
              tastingNotes: beer.tastingNotes
            };
          } else {
            // 2d. Birra non esiste, prova web scraping SENZA SALVARE
            logger.info(`🔍 Birra non trovata in DB, ricerca web per: ${bottle.beerName}`);
            
            if (breweryData.website) {
              try {
                logger.info(`🌐 Avvio web scraping per birra: ${bottle.beerName} su ${breweryData.website}`);
                // 🔥 P0.3 FIX: Usa HTMLParser.extractBeerInfoFromWebsite che accetta (url, beerName) - 7 dic 2025
                const beerWebData = await HTMLParser.extractBeerInfoFromWebsite(breweryData.website, bottle.beerName);
                if (beerWebData && beerWebData.confidence > 0 && Object.keys(beerWebData).length > 0) {
                  beerData = { ...beerData, ...beerWebData };
                  logger.info(`✅ Dati birra estratti dal web:`, {
                    fields: Object.keys(beerWebData).join(', '),
                    confidence: beerWebData.confidence,
                    fieldsFound: beerWebData.fieldsFound || []
                  });
                } else {
                  logger.warn(`⚠️ Nessun dato birra estratto dal web (confidence: ${beerWebData?.confidence || 0})`);
                }
              } catch (error) {
                logger.warn(`⚠️ Web scraping birra fallito: ${error.message}`);
              }
            } else {
              // Se non abbiamo sito birrificio, usiamo solo dati AI
              logger.info(`ℹ️ Nessun sito birrificio disponibile, uso solo dati AI per birra`);
            }
          }
          
          // 🎯 Salva TUTTI i dati della bottiglia per il frontend (SENZA SALVARE IN DB)
          const processedBottle = {
            // ✅ SALVO breweryData COMPLETO per usarlo in Fase 2 (7 dic 2025)
            _breweryData: breweryData, // Dati completi birrificio da web scraping
            _breweryName: breweryName, // Nome birrificio determinato
            
            // Dati Birra
            beerName: bottle.beerName,
            beerType: beerData.beerType || bottle.beerStyle || bottle.beerType,
            alcoholContent: beerData.alcoholContent || bottle.alcoholContent,
            ibu: beerData.ibu || bottle.ibu,
            volume: beerData.volume || bottle.volume,
            description: beerData.description || bottle.description || beer?.description,
            ingredients: beerData.ingredients || bottle.ingredients || beer?.ingredients,
            color: beerData.color, // ✅ FIX #7D: SOLO web scraping (9 dic 2025)
            servingTemperature: beerData.servingTemperature, // SOLO web
            tastingNotes: beerData.tastingNotes, // SOLO web
            
            // ✅ FIX #7D: 8 enrichment fields SOLO da web scraping o beer esistente (MAI da AI) - 9 dic 2025
            fermentation: beerData.fermentation || beer?.fermentation,
            pairing: beerData.pairing || beer?.pairing,
            glassType: beerData.glassType || beer?.glassType,
            aroma: beerData.aroma || beer?.aroma,
            appearance: beerData.appearance || beer?.appearance,
            mouthfeel: beerData.mouthfeel || beer?.mouthfeel,
            bitterness: beerData.bitterness || beer?.bitterness,
            carbonation: beerData.carbonation || beer?.carbonation,
            
            // ❌ RIMOSSO: Dati birrificio NON devono stare in processedBottle (vanno solo nel model Brewery)
            breweryName: breweryName, // Manteniamo SOLO il nome per riferimento
            // Metadati
            dataSource: breweryData.website ? 'web_scraped+ai' : 'ai_analysis',
            confidence: bottle.extractionConfidence,
            webVerification: {
              verified: !!breweryData.website,
              source: breweryData.website,
              confidence: bottle.extractionConfidence,
              dataMatch: brewery ? 'FOUND_IN_DB' : (breweryData.website ? 'WEB_VERIFIED' : 'AI_ONLY')
            },
            // Metadati processing
            metadata: {
              breweryFound: !!brewery,
              beerFound: !!beer,
              webSearchPerformed: true,
              needsDatabaseCreation: !brewery || !beer,
              extractionConfidence: bottle.extractionConfidence || 0.8
            },
            // Dati originali AI
            aiRawData: {
              labelData: bottle.labelData,
              searchQueries: bottle.searchQueries,
              extractionConfidence: bottle.extractionConfidence,
              dataSource: bottle.dataSource
            }
          };
          
          logger.info(`✅ Bottiglia ${i + 1}/${bottles.length} processata:`, {
            beerName: processedBottle.beerName,
            breweryName: processedBottle.breweryName,
            dataSource: processedBottle.dataSource,
            hasWebsite: !!processedBottle.website,
            breweryFound: processedBottle.metadata.breweryFound,
            beerFound: processedBottle.metadata.beerFound
          });
          
          processedBottles.push(processedBottle);
          
        } catch (error) {
          logger.error(`❌ Errore processing bottiglia ${i + 1}`, {
            beerName: bottle.beerName,
            error: error.message
          });
          
          errors.push({
            bottleIndex: i,
            beerName: bottle.beerName,
            error: error.message
          });
        }
      }
      
      await updateProgress(90, 'validation'); // 90% - Bottiglie processate
      
      await updateProgress(100, 'completed'); // 100% - Completato
      
      const processingTime = Date.now() - startTime;
      
      logger.info(`✅ TEST MODE (REAL SERVICES): Recensione ${reviewId} processata con successo`, {
        processingTime: `${processingTime}ms`,
        bottlesProcessed: processedBottles.length,
        errors: errors.length,
        breweriesFound: processedBottles.filter(b => b.metadata.breweryFound).length,
        beersFound: processedBottles.filter(b => b.metadata.beerFound).length
      });
      
      return {
        success: true,
        reviewId,
        bottlesProcessed: processedBottles.length,
        errors: errors.length,
        processingTime: `${processingTime}ms`,
        dataSource: 'test_real_services',
        isTest: true,
        useRealServices: true,
        
        // 🎯 INCLUDI I DATI PROCESSATI PER IL TEST
        bottles: processedBottles,
        
        // Summary per test
        summary: {
          totalBottles: processedBottles.length,
          breweriesFound: processedBottles.filter(b => b.metadata.breweryFound).length,
          beersFound: processedBottles.filter(b => b.metadata.beerFound).length,
          webSearchesPerformed: processedBottles.length,
          needsCreation: processedBottles.filter(b => b.metadata.needsDatabaseCreation).length,
          errors: errors.length
        }
      };
    }
    
    // 🚫 SE ARRIVIAMO QUI, NON È TEST MODE - CONTINUA CON PROCESSING NORMALE
    
    // Funzione helper per aggiornare progress con step
    const updateProgress = async (percent, step) => {
      await job.progress({ percent, step });
      logger.info(`📊 Progress: ${percent}% - ${step}`);
    };
    
    // 1. Aggiorna stato recensione a "processing"
    await Review.updateOne(
      { _id: reviewId },
      { 
        processingStatus: 'processing',
        lastProcessingAttempt: new Date(),
        $inc: { processingAttempts: 1 }
      }
    );

    await updateProgress(10, 'ai-analysis'); // 10% - Analisi AI completata (già fatta prima della coda)

    // 2. Processa ogni bottiglia (supporto multi-bottiglia)
    const processedBottles = [];
    const errors = [];

    for (let i = 0; i < bottles.length; i++) {
      const bottle = bottles[i];
      
      // Il nome birra rimane quello originale dall'AI (es: "Ichnusa Non Filtrata")
      // Il birrificio viene trovato ESCLUSIVAMENTE via web search e web scraping
      
      try {
        const bottleProgress = 10 + (i / bottles.length) * 60;
        const currentStep = i === 0 ? 'web-search' : 'web-scraping';
        await updateProgress(bottleProgress, currentStep); // 10-70% - Processing bottiglie
        
        logger.info(`🍺 Processing bottiglia ${i + 1}/${bottles.length}`, {
          beerName: bottle.beerName,
          breweryName: bottle.breweryName || '(non specificato)'
        });

        // 🚀 OPTIMIZATION 16 dic 2025: Cerca birra esistente nel DB PRIMA di fare web search
        // Se la birra esiste già con birrificio associato, salta completamente web search/scraping
        const existingBeer = await Beer.findOne({
          beerName: { $regex: new RegExp(`^${bottle.beerName}$`, 'i') }
        }).populate('brewery');
        
        if (existingBeer && existingBeer.brewery) {
          logger.info(`⚡ FAST PATH: Birra "${bottle.beerName}" già presente in DB - BYPASS web search/scraping`, {
            beerId: existingBeer._id,
            breweryId: existingBeer.brewery._id,
            breweryName: existingBeer.brewery.breweryName,
            hasWebsite: !!existingBeer.brewery.breweryWebsite,
            hasDescription: !!existingBeer.description
          });
          
          // Usa direttamente birra e birrificio esistenti
          processedBottles.push({
            brewery: existingBeer.brewery._id,
            beer: existingBeer._id,
            
            // 🔢 TRACKING INDICE BOTTIGLIA PER FRONTEND
            bottleIndex: bottle.bottleIndex !== undefined ? bottle.bottleIndex : i,
            originalId: bottle.originalId || bottle.id,
            
            // 🍺 Dati Birra da DB esistente
            beerName: existingBeer.beerName,
            beerType: existingBeer.beerType,
            alcoholContent: existingBeer.alcoholContent,
            ibu: existingBeer.ibu,
            volume: existingBeer.volume,
            description: existingBeer.description,
            ingredients: existingBeer.ingredients,
            color: existingBeer.color,
            servingTemperature: existingBeer.servingTemperature,
            tastingNotes: existingBeer.tastingNotes,
            
            // 🏭 Dati Birrificio da DB esistente
            breweryName: existingBeer.brewery.breweryName,
            
            // 📊 Metadati - indica che è stato trovato in cache DB
            dataSource: 'database_cache',
            confidence: 1.0, // Massima confidence perché già verificato
            webVerification: {
              verified: true,
              source: 'database_existing',
              confidence: 1.0,
              dataMatch: 'DB_CACHED'
            }
          });
          
          // ⏭️ SALTA al prossimo ciclo - nessun web search necessario!
          continue;
        }
        
        // 📡 Birra NON trovata in DB - continua con web search normale
        logger.info(`🔍 Birra "${bottle.beerName}" NON in DB - avvio web search/scraping`);

        // 2a. Trova o crea birrificio
        // 🔥 FIX 21 DIC 2025: Usa breweryName da AI se disponibile
        const breweryData = bottle._breweryData || {};
        // Priorità: 1) _breweryName (da Fase 1), 2) breweryName (da AI), 3) null
        const breweryName = bottle._breweryName || bottle.breweryName || null;
        
        if (bottle.breweryName && !bottle._breweryName) {
          logger.info(`🎯 Usando breweryName da AI per ricerca: "${bottle.breweryName}"`);
        }
        
        const brewery = await findOrCreateBrewery(bottle, job, breweryData, breweryName);
        
        // 🔥 FIX 15 dic 2025: Web scraping dati BIRRA prima di creare Beer
        // PROBLEMA: I dati birra (ABV, IBU, descrizione, ingredienti) da web non venivano passati a findOrCreateBeer
        // SOLUZIONE: Fai web scraping birra QUI e arricchisci bottle PRIMA di passarlo a findOrCreateBeer
        let enrichedBottle = { ...bottle }; // Copia bottle per arricchirla
        
        if (brewery.breweryWebsite) {
          try {
            logger.info(`🌐 Web scraping dati BIRRA: ${bottle.beerName} su ${brewery.breweryWebsite}`);
            const beerWebData = await HTMLParser.extractBeerInfoFromWebsite(brewery.breweryWebsite, bottle.beerName);
            
            if (beerWebData && beerWebData.confidence > 0 && Object.keys(beerWebData).length > 0) {
              // Merge dati web con dati AI (web ha priorità per arricchire)
              enrichedBottle = {
                ...enrichedBottle,
                // Caratteristiche tecniche da web (se non presenti in AI)
                alcoholContent: enrichedBottle.alcoholContent || beerWebData.alcoholContent,
                beerType: enrichedBottle.beerType || enrichedBottle.beerStyle || beerWebData.beerType,
                ibu: enrichedBottle.ibu || beerWebData.ibu,
                volume: enrichedBottle.volume || beerWebData.volume,
                // Dati SOLO da web scraping
                color: beerWebData.color,
                servingTemperature: beerWebData.servingTemperature,
                fermentation: beerWebData.fermentation,
                glassType: beerWebData.glassType,
                // Descrizioni e note
                description: enrichedBottle.description || beerWebData.description,
                ingredients: enrichedBottle.ingredients || beerWebData.ingredients,
                tastingNotes: beerWebData.tastingNotes,
                // Caratteristiche sensoriali
                aroma: beerWebData.aroma,
                appearance: beerWebData.appearance,
                mouthfeel: beerWebData.mouthfeel,
                bitterness: beerWebData.bitterness,
                carbonation: beerWebData.carbonation,
                pairing: beerWebData.pairing,
                // Flag per tracciamento
                _hasWebBeerData: true
              };
              
              logger.info(`✅ Dati birra arricchiti da web scraping:`, {
                beerName: bottle.beerName,
                fieldsFromWeb: Object.keys(beerWebData).filter(k => beerWebData[k]).join(', '),
                confidence: beerWebData.confidence,
                alcoholContent: enrichedBottle.alcoholContent,
                ibu: enrichedBottle.ibu,
                hasDescription: !!enrichedBottle.description,
                hasTastingNotes: !!enrichedBottle.tastingNotes
              });
            } else {
              logger.warn(`⚠️ Nessun dato birra estratto dal web per: ${bottle.beerName} (confidence: ${beerWebData?.confidence || 0})`);
            }
          } catch (webError) {
            logger.warn(`⚠️ Web scraping birra fallito per ${bottle.beerName}: ${webError.message}`);
          }
        } else {
          logger.info(`ℹ️ Nessun sito birrificio disponibile per web scraping birra: ${bottle.beerName}`);
        }
        
        // 2b. Trova o crea birra (con dati arricchiti da web)
        const beer = await findOrCreateBeer(enrichedBottle, brewery._id, job);
        
        // 🎯 Salva SOLO riferimenti e dati birra per il frontend (7 dic 2025)
        // ✅ Dati birrificio sono GIÀ salvati nel model Brewery da findOrCreateBrewery
        // 🆕 FIX #9b: Usa enrichedBottle invece di bottle per dati arricchiti da web (15 dic 2025)
        processedBottles.push({
          brewery: brewery._id, // ✅ Riferimento ID birrificio
          beer: beer._id,       // ✅ Riferimento ID birra
          
          // 🔢 TRACKING INDICE BOTTIGLIA PER FRONTEND
          bottleIndex: enrichedBottle.bottleIndex !== undefined ? enrichedBottle.bottleIndex : i,
          originalId: enrichedBottle.originalId || enrichedBottle.id,
          
          // 🍺 Dati Birra (per visualizzazione frontend) - USA enrichedBottle per dati web
          beerName: enrichedBottle.beerName,
          beerType: enrichedBottle.beerStyle || enrichedBottle.beerType,
          alcoholContent: enrichedBottle.alcoholContent,
          ibu: enrichedBottle.ibu,
          volume: enrichedBottle.volume,
          description: enrichedBottle.description || beer.description,
          ingredients: enrichedBottle.ingredients || beer.ingredients,
          color: enrichedBottle.color || beer.color,
          servingTemperature: enrichedBottle.servingTemperature || beer.servingTemperature,
          tastingNotes: enrichedBottle.tastingNotes || beer.tastingNotes,
          
          // 🏭 Solo NOME birrificio per display (dati completi in model Brewery)
          // 🔥 FIX 17 dic 2025: Usa brewery.breweryName direttamente per evitare ReferenceError
          breweryName: brewery.breweryName || bottle._breweryName || 'Birrificio sconosciuto',
          
          // 📊 Metadati - dataSource indica se arricchito da web
          dataSource: enrichedBottle.description || enrichedBottle.tastingNotes ? 'ai_analysis+web' : 'ai_analysis',
          confidence: enrichedBottle.confidence || enrichedBottle.extractionConfidence,
          webVerification: {
            verified: !!brewery.breweryWebsite,
            source: brewery.breweryWebsite,
            confidence: enrichedBottle.confidence || enrichedBottle.extractionConfidence,
            dataMatch: enrichedBottle.description ? 'ENRICHED' : 'AI_ONLY'
          }
        });

      } catch (error) {
        // 🔥 FIX 17 dic 2025: Log dettagliato errore per debug
        logger.error(`❌ Errore processing bottiglia ${i + 1}/${bottles.length}`, {
          beerName: bottle.beerName,
          breweryName: bottle.breweryName,
          error: error.message,
          stack: error.stack?.split('\n').slice(0, 3).join('\n'), // Prime 3 righe stack
          reviewId
        });
        
        errors.push({
          bottleIndex: i,
          beerName: bottle.beerName,
          error: error.message,
          stack: error.stack?.split('\n').slice(0, 3).join('\n') // Per debug admin
        });
      }
    }

    await updateProgress(70, 'validation'); // 70% - Bottiglie processate, inizio validazione

    // 🔍 DEBUG: Verifica array processedBottles PRIMA del salvataggio
    logger.info('🔍 DEBUG - processedBottles array prima del salvataggio:', {
      count: processedBottles.length,
      bottleNames: processedBottles.map(b => b.beerName),
      bottleIndices: processedBottles.map(b => ({ index: b.bottleIndex, name: b.beerName })), // ⬅️ NEW: Verifica indici
      firstBottle: processedBottles[0] ? {
        bottleIndex: processedBottles[0].bottleIndex, // ⬅️ NEW: Log indice
        beerName: processedBottles[0].beerName,
        breweryName: processedBottles[0].breweryName,
        hasBreweryId: !!processedBottles[0].brewery,
        hasBeerId: !!processedBottles[0].beer
      } : null
    });

    // 3. Verifica se abbiamo processato almeno una bottiglia con successo
    if (processedBottles.length === 0) {
      // 🔥 FIX 17 dic 2025: Messaggio errore dettagliato con motivi fallimento
      const errorDetails = errors.length > 0 
        ? errors.map(e => `Bottiglia "${e.beerName || 'N/A'}": ${e.error}`).join('; ')
        : 'Nessun dettaglio disponibile';
      
      logger.error('❌ TUTTE le bottiglie hanno fallito il processing', {
        reviewId,
        totalBottles: bottles.length,
        errorsCount: errors.length,
        errors: errors
      });
      
      throw new Error(`Nessuna bottiglia processata con successo. Errori: ${errorDetails}`);
    }

    // 4. Aggiorna recensione con i riferimenti
    // ✅ Map processedBottles per Review.metadata (SOLO dati birra + riferimenti - 7 dic 2025)
    const mappedBottles = processedBottles.map((b, idx) => ({
      bottleIndex: b.bottleIndex !== undefined ? b.bottleIndex : idx,
      originalId: b.originalId,
      
      // 🍺 Dati Birra
      beerName: b.beerName,
      alcoholContent: b.alcoholContent,
      ibu: b.ibu,
      volume: b.volume,
      beerType: b.beerType,
      description: b.description,
      ingredients: b.ingredients,
      color: b.color,
      servingTemperature: b.servingTemperature,
      tastingNotes: b.tastingNotes,
      
      // 🏭 Solo NOME birrificio (dati completi nel model Brewery)
      breweryName: b.breweryName,
      
      // 📊 Metadati
      dataSource: b.dataSource,
      confidence: b.confidence,
      webVerification: b.webVerification
    }));

    logger.info('🔍 DEBUG - mappedBottles prima del salvataggio:', {
      count: mappedBottles.length,
      firstMapped: mappedBottles[0]
    });

    // 🔧 FIX #4: Gestione ratings array vuoto - Controlla se ratings è vuoto
    // 🔄 FIX RACE CONDITION (23 dic 2025): Verifica se STEP 2 ha già salvato dati utente
    const review = await Review.findById(reviewId);
    if (!review) {
      logger.error('❌ Review non trovata:', { reviewId });
      throw new Error(`Review ${reviewId} non trovata`);
    }

    // Controlla se ratings ha dati utente (rating o notes compilati)
    const ratingsHasUserData = review.ratings?.some(r => 
      (r.rating !== undefined && r.rating !== null) || 
      (r.notes && r.notes.trim().length > 0)
    );
    const ratingsIsEmpty = !review.ratings || review.ratings.length === 0;
    
    logger.info(`🔍 Review ${reviewId} - ratings array ${ratingsIsEmpty ? 'VUOTO' : 'POPOLATO'} (length: ${review.ratings?.length || 0}), hasUserData: ${ratingsHasUserData}`);

    let updateData;
    
    // 🔄 RACE CONDITION FIX: Se ratings ha già dati utente da STEP 2, NON sovrascrivere!
    // Usa sempre bulkWrite per aggiungere solo brewery/beer senza perdere rating/notes
    if (ratingsIsEmpty && !ratingsHasUserData) {
      // ✅ Ratings vuoto E senza dati utente: CREA i ratings con i riferimenti brewery e beer
      // IMPORTANTE: brewery e beer NON esistono a livello root nello schema Review!
      // Devono essere DENTRO l'array ratings[]
      logger.info('📝 Creazione RATINGS con riferimenti brewery/beer (ratings era vuoto)');
      
      // 🔄 RACE CONDITION FIX: Ri-leggi la review PRIMA di scrivere per evitare sovrascritture
      const freshReview = await Review.findById(reviewId);
      const freshRatingsHasUserData = freshReview?.ratings?.some(r => 
        (r.rating !== undefined && r.rating !== null) || 
        (r.notes && r.notes.trim().length > 0)
      );
      
      if (freshRatingsHasUserData) {
        // ⚠️ STEP 2 ha scritto nel frattempo! Non sovrascrivere, usa bulkWrite
        logger.info('🔄 RACE CONDITION EVITATA: STEP 2 ha già salvato ratings utente, passo a bulkWrite');
        // Imposta ratingsIsEmpty a false per usare la logica bulkWrite
        // Il codice continuerà nel branch else sotto
      } else {
        // Ratings ancora vuoto, procedi con creazione
        const newRatings = processedBottles.map((bottle, index) => ({
          bottleLabel: bottle.beerName || `Birra ${index + 1}`,
          bottleIndex: index,
          brewery: bottle.brewery, // ObjectId del birrificio
          beer: bottle.beer,       // ObjectId della birra
          // rating, notes, detailedRatings saranno compilati dall'utente
        }));
        
        updateData = {
          $set: {
            processingStatus: errors.length > 0 ? 'needs_admin_review' : 'completed',
            // 🔥 FIX: Aggiungo motivazione revisione admin (16 dic 2025)
            adminReviewReason: errors.length > 0 
              ? `Elaborazione completata con ${errors.length} errore/i: ${errors.map(e => e.error || e.message || 'Errore sconosciuto').join('; ')}`
              : null,
            completedAt: new Date(),
            bottlesCount: processedBottles.length,
            ratings: newRatings, // CREA l'array ratings con i riferimenti
            'metadata.processedBottles': mappedBottles,
            'metadata.bottlesCount': mappedBottles.length,
            'metadata.lastUpdated': new Date()
          }
        };
        
        logger.info(`✅ Creati ${newRatings.length} ratings con riferimenti brewery/beer`);
      }
    }
    
    // Se updateData non è stato settato (ratings popolato O race condition evitata), usa bulkWrite
    if (!updateData) {
      // ✅ FIX #8: Ratings popolato - Correlazione corretta con bulkWrite (7 dic 2025)
      logger.info('📝 Collegamento RATINGS → BOTTLES con correlazione bottleIndex (preservando rating/notes utente)');
      
      // Prima: update generale della Review
      updateData = {
        $set: {
          processingStatus: errors.length > 0 ? 'needs_admin_review' : 'completed',
          // 🔥 FIX: Aggiungo motivazione revisione admin (16 dic 2025)
          adminReviewReason: errors.length > 0 
            ? `Elaborazione completata con ${errors.length} errore/i: ${errors.map(e => e.error || e.message || 'Errore sconosciuto').join('; ')}`
            : null,
          completedAt: new Date(),
          bottlesCount: processedBottles.length,
          'metadata.processedBottles': mappedBottles,
          'metadata.bottlesCount': mappedBottles.length,
          'metadata.lastUpdated': new Date()
        }
      };
      
      // Poi: update individuale di ogni rating con il suo bottle corretto
      // Recupera la Review completa per accedere ai ratings._id
      const reviewDoc = await Review.findById(reviewId);
      if (reviewDoc && reviewDoc.ratings && reviewDoc.ratings.length > 0) {
        const bulkOps = reviewDoc.ratings.map((rating, index) => {
          // Correlazione: rating[i] → processedBottles[i]
          const correspondingBottle = processedBottles[index];
          if (!correspondingBottle) {
            logger.warn(`⚠️ Nessuna bottiglia corrispondente per rating index ${index}`);
            return null;
          }
          
          return {
            updateOne: {
              filter: { 
                _id: reviewId, 
                'ratings._id': rating._id 
              },
              update: {
                $set: {
                  'ratings.$.brewery': correspondingBottle.brewery,
                  'ratings.$.beer': correspondingBottle.beer,
                  'ratings.$.bottleIndex': index
                }
              }
            }
          };
        }).filter(op => op !== null);
        
        if (bulkOps.length > 0) {
          await Review.bulkWrite(bulkOps);
          logger.info(`✅ Correlati ${bulkOps.length} ratings con le loro bottiglie via bulkWrite`);
        }
      }
    }

    // Log finale multi-bottle
    if (processedBottles.length > 1) {
      logger.info(`✅ FIX #8: Multi-bottiglia gestite - ${processedBottles.length} bottiglie correlate ai ratings`);
    }

    await Review.updateOne({ _id: reviewId }, updateData);

    // 🔍 DEBUG: Verifica cosa è stato salvato
    const updatedReview = await Review.findById(reviewId);
    if (!updatedReview) {
      logger.error('❌ Review non trovata dopo update:', { reviewId });
      throw new Error(`Review ${reviewId} non trovata nel database dopo update`);
    }
    
    logger.info('🔍 DEBUG - Review dopo update:', {
      reviewId,
      processingStatus: updatedReview.processingStatus,
      bottlesCount: updatedReview.bottlesCount,
      hasMetadata: !!updatedReview.metadata,
      processedBottlesCount: updatedReview.metadata?.processedBottles?.length || 0,
      processedBottles: updatedReview.metadata?.processedBottles
    });

    await updateProgress(90, 'validation'); // 90% - Recensione aggiornata

    // 5. Se ci sono errori parziali, notifica admin
    if (errors.length > 0) {
      await notifyAdminForValidation(reviewId, errors);
    }

    await updateProgress(100, 'completed'); // 100% - Completato

    const processingTime = Date.now() - startTime;
    
    logger.info(`✅ Recensione ${reviewId} processata con successo`, {
      processingTime: `${processingTime}ms`,
      bottlesProcessed: processedBottles.length,
      errors: errors.length
    });

    return {
      success: true,
      reviewId,
      bottlesProcessed: processedBottles.length,
      errors: errors.length,
      processingTime: `${processingTime}ms`,
      dataSource: processedBottles[0]?.dataSource
    };

  } catch (error) {
    logger.error(`❌ Errore fatale processing recensione ${reviewId}`, {
      error: error.message,
      stack: error.stack
    });

    // Aggiorna recensione come fallita
    await Review.updateOne(
      { _id: reviewId },
      {
        processingStatus: 'failed',
        processingError: error.message,
        lastProcessingAttempt: new Date()
      }
    );

    // Notifica admin per intervento manuale
    await notifyAdminForValidation(reviewId, [{ error: error.message }]);

    throw error; // Bull gestirà i retry
  }
}

/**
 * Trova o crea birrificio dal dato AI/web
 * @param {Object} bottle - Dati bottiglia (include tutti i dati già estratti da web/AI)
 * @param {Object} job - Job Bull per progress tracking
 * @param {Object} breweryDataFromPhase1 - Dati birrificio GIÀ estratti da web scraping in Fase 1 (7 dic 2025)
 * @param {String} breweryNameFromPhase1 - Nome birrificio determinato in Fase 1 (7 dic 2025)
 * @returns {Promise<Object>} Birrificio MongoDB
 */
async function findOrCreateBrewery(bottle, job, breweryDataFromPhase1 = {}, breweryNameFromPhase1 = null) {
  const beerName = bottle.beerName;

  try {
    // ✅ USA breweryData e breweryName GIÀ CALCOLATI in Fase 1 (7 dic 2025)
    let breweryName = breweryNameFromPhase1;
    let breweryData = breweryDataFromPhase1;
    
    // Se Fase 1 NON ha trovato dati, prova ricerca DB
    if (!breweryName) {
      logger.info(`⚠️ Fase 1 non ha trovato breweryName, provo DB per birra: "${beerName}"`);
      let existingBeer = await Beer.findOne({
        beerName: { $regex: new RegExp(`^${beerName}$`, 'i') }
      }).populate('brewery');

      if (existingBeer && existingBeer.brewery) {
        logger.info(`✅ Birrificio trovato tramite birra in DB: ${existingBeer.brewery.breweryName}`);
        return existingBeer.brewery;
      }
      
      logger.warn(`❌ Nessun birrificio trovato per: "${beerName}" - BLOCCO creazione`);
      breweryName = null;
    } else {
      logger.info(`✅ Fase 1 ha trovato breweryName: "${breweryName}"`, {
        hasWebsite: !!breweryData.website,
        hasEmail: !!breweryData.email,
        hasPhone: !!breweryData.phone,
        hasAddress: !!breweryData.breweryLegalAddress,
        mainProducts: breweryData.mainProducts?.length || 0
      });
    }
    
    // 🔥 FIX 7 dic 2025: Web search se MANCANO dati web (website/email), anche se abbiamo breweryName
    // La condizione precedente (!breweryName && ...) era sbagliata: saltava il web search se avevamo il nome
    const needsWebSearch = !breweryData.website && !breweryData.email;
    
    if (needsWebSearch) {
      // Usa breweryName se disponibile, altrimenti beerName
      const searchBreweryName = breweryName || bottle.breweryName || null;
      const searchTerm = searchBreweryName 
        ? `${searchBreweryName} birrificio sito ufficiale`  // Cerca sito ufficiale del birrificio
        : `${beerName} birrificio produttore`; // Fallback a solo nome birra
      
      logger.info(`🔍 Web search necessario - mancano dati web`, {
        searchTerm,
        hasBreweryName: !!searchBreweryName,
        beerName
      });
      
      try {
        logger.info(`🔍 Google search FALLBACK per: "${searchTerm}"`);
        const searchResult = await WebSearchService.searchBreweryOnWeb(searchTerm);
        
        if (searchResult && searchResult.found && searchResult.brewery) {
          const breweryFromWeb = searchResult.brewery;
          breweryName = breweryFromWeb.breweryName;
          
          breweryData = {
            website: breweryFromWeb.breweryWebsite,
            breweryLegalAddress: breweryFromWeb.breweryLegalAddress,
            email: breweryFromWeb.breweryEmail,
            phone: breweryFromWeb.breweryPhoneNumber,
            description: breweryFromWeb.breweryDescription,
            foundingYear: breweryFromWeb.foundingYear,
            brewerySize: breweryFromWeb.brewerySize,
            mainProducts: breweryFromWeb.mainProducts || [],
            awards: breweryFromWeb.awards || [],
            brewerySocialMedia: breweryFromWeb.brewerySocialMedia || {},
            breweryHistory: breweryFromWeb.history,
            // 🔥 P0.2 FIX: Nuovi campi da HTMLParser (7 dic 2025)
            employeeCount: breweryFromWeb.employeeCount,
            productionVolume: breweryFromWeb.productionVolume,
            masterBrewer: breweryFromWeb.masterBrewer,
            breweryFiscalCode: breweryFromWeb.breweryFiscalCode,
            reaCode: breweryFromWeb.reaCode,
            acciseCode: breweryFromWeb.acciseCode
          };
          
          logger.info(`✅ Birrificio trovato via web FALLBACK: ${breweryName}`, {
            confidence: searchResult.confidence,
            hasWebsite: !!breweryData.website,
            hasAddress: !!breweryData.breweryLegalAddress
          });
        } else {
          // 🔥 P1.6 FIX: Salva comunque con confidence 0 invece di bloccare (7 dic 2025)
          // Quando non troviamo birrificio, salviamo i dati parziali dall'AI con flag
          logger.warn(`⚠️ Nessun birrificio REALE trovato per "${beerName}" - SALVO con confidence 0`);
          
          // Prova a determinare nome birrificio dall'AI se disponibile
          if (bottle.breweryName) {
            breweryName = bottle.breweryName;
            logger.info(`📝 Uso breweryName da AI: "${breweryName}" (non verificato)`);
          } else {
            // Estrai nome birrificio dal nome birra come ultimo fallback
            // Es: "Peroni Nastro Azzurro" → "Peroni"
            const firstWord = beerName.split(' ')[0];
            if (firstWord && firstWord.length > 2) {
              breweryName = firstWord;
              logger.info(`📝 Uso primo token come breweryName: "${breweryName}" (heuristic)`);
            } else {
              breweryName = `Birrificio ${beerName}`;
              logger.warn(`📝 Uso fallback generico: "${breweryName}"`);
            }
          }
          
          breweryData = {
            ...breweryData,
            confidence: 0,
            needsManualReview: true,
            reviewReason: 'Birrificio non trovato online - richiede verifica manuale', // 🔥 FIX: motivazione revisione (16 dic 2025)
            validationStatus: 'pending_validation', // 🔥 FIX: usa valore enum valido (7 dic 2025)
            dataSource: 'ai_analysis', // 🔥 FIX: usa valore enum valido (7 dic 2025)
            blockReason: 'Birrificio non trovato online - richiede verifica manuale'
          };
        }
      } catch (error) {
        // 🔥 P1.6 FIX: Salva comunque con confidence 0 invece di bloccare (7 dic 2025)
        logger.warn(`⚠️ Web search fallback fallito per "${beerName}": ${error.message} - SALVO con confidence 0`);
        
        // Prova a determinare nome birrificio dall'AI se disponibile
        if (bottle.breweryName) {
          breweryName = bottle.breweryName;
          logger.info(`📝 Uso breweryName da AI: "${breweryName}" (non verificato)`);
        } else {
          const firstWord = beerName.split(' ')[0];
          if (firstWord && firstWord.length > 2) {
            breweryName = firstWord;
            logger.info(`📝 Uso primo token come breweryName: "${breweryName}" (heuristic)`);
          } else {
            breweryName = `Birrificio ${beerName}`;
            logger.warn(`📝 Uso fallback generico: "${breweryName}"`);
          }
        }
        
        breweryData = {
          ...breweryData,
          confidence: 0,
          needsManualReview: true,
          reviewReason: `Errore durante ricerca web: ${error.message}`, // 🔥 FIX: motivazione revisione (16 dic 2025)
          validationStatus: 'pending_validation', // 🔥 FIX: usa valore enum valido (7 dic 2025)
          dataSource: 'ai_analysis', // 🔥 FIX: usa valore enum valido (7 dic 2025)
          blockReason: `Web search error: ${error.message}`
        };
      }
    } else {
      logger.info(`✅ SKIP web search - breweryData GIÀ disponibile da Fase 1`, {
        breweryName: breweryName,
        hasWebsite: !!breweryData.website,
        hasEmail: !!breweryData.email
      });
    }
    
    // 3. Verifica se birrificio con questo nome esiste già
    let brewery = await Brewery.findOne({
      breweryName: { $regex: new RegExp(`^${breweryName}$`, 'i') }
    });

    if (brewery) {
      logger.info(`✅ Birrificio trovato in DB dopo web search: ${breweryName} - ARRICCHISCO con dati web`);
      
      // 🆕 ENRICHMENT #4: Aggiorna Brewery esistente con dati web-scraped se disponibili
      const updateFields = {};
      
      // Helper per aggiornare solo se campo è vuoto/mancante
      const updateIfEmpty = (field, value) => {
        const currentValue = brewery[field];
        const isEmpty = !currentValue || 
                       currentValue === '' || 
                       currentValue === 'Non specificato' ||
                       (Array.isArray(currentValue) && currentValue.length === 0) ||
                       (typeof currentValue === 'object' && !Array.isArray(currentValue) && Object.keys(currentValue).length === 0);
        
        if (isEmpty && value !== undefined && value !== null && value !== '') {
          updateFields[field] = value;
        }
      };
      
      // Aggiorna TUTTI i campi disponibili da web search
      updateIfEmpty('breweryDescription', breweryData.description);
      updateIfEmpty('breweryLegalAddress', breweryData.breweryLegalAddress);
      updateIfEmpty('breweryPhoneNumber', breweryData.phone);
      updateIfEmpty('breweryWebsite', breweryData.website);
      updateIfEmpty('breweryEmail', breweryData.email);
      updateIfEmpty('foundingYear', breweryData.foundingYear);
      updateIfEmpty('brewerySize', breweryData.brewerySize);
      updateIfEmpty('productionVolume', breweryData.productionVolume);
      updateIfEmpty('breweryHistory', breweryData.breweryHistory);
      // 🔥 P0.2 FIX: Nuovi campi da HTMLParser (7 dic 2025)
      updateIfEmpty('employeeCount', breweryData.employeeCount);
      updateIfEmpty('masterBrewer', breweryData.masterBrewer);
      updateIfEmpty('breweryFiscalCode', breweryData.breweryFiscalCode);
      updateIfEmpty('breweryREAcode', breweryData.reaCode);
      updateIfEmpty('breweryacciseCode', breweryData.acciseCode);
      
      // Gestione oggetti/array complessi
      if ((!brewery.brewerySocialMedia || Object.keys(brewery.brewerySocialMedia).length === 0) && 
          breweryData.brewerySocialMedia && Object.keys(breweryData.brewerySocialMedia).length > 0) {
        updateFields.brewerySocialMedia = breweryData.brewerySocialMedia;
      }
      
      if ((!brewery.mainProducts || brewery.mainProducts.length === 0) && 
          breweryData.mainProducts && breweryData.mainProducts.length > 0) {
        updateFields.mainProducts = breweryData.mainProducts;
      }
      
      if ((!brewery.awards || brewery.awards.length === 0) && 
          breweryData.awards && breweryData.awards.length > 0) {
        updateFields.awards = breweryData.awards;
      }
      
      // Aggiorna metadati se nuovi dati disponibili
      if (Object.keys(updateFields).length > 0) {
        updateFields.lastAiUpdate = new Date();
        if (breweryData.website) {
          updateFields.dataSource = 'web_search';
          updateFields.validationStatus = 'web_scraped';
        }
        
        await Brewery.updateOne({ _id: brewery._id }, { $set: updateFields });
        
        logger.info(`🔄 Birrificio arricchito con ${Object.keys(updateFields).length} campi:`, {
          breweryName,
          fieldsUpdated: Object.keys(updateFields).join(', ')
        });
        
        // Reload brewery con nuovi dati
        brewery = await Brewery.findById(brewery._id);
      } else {
        logger.info(`ℹ️ Birrificio già completo, nessun arricchimento necessario`);
      }
      
      return brewery;
    }

    logger.info(`🆕 Creo nuovo birrificio: ${breweryName} con dati da web search`);

    // 4. Crea nuovo birrificio con dati da web search
    // 🔥 P1.6: Supporta anche creazione con confidence 0 (dati non verificati)
    // 🔥 FIX: usa 'pending_validation' invece di 'unverified' (7 dic 2025)
    const isUnverified = breweryData.confidence === 0 || breweryData.validationStatus === 'pending_validation';
    
    brewery = await Brewery.create({
      // Campi base obbligatori
      breweryName: breweryName,
      
      // Campi da web search
      breweryDescription: breweryData.description,
      breweryLegalAddress: breweryData.breweryLegalAddress,
      breweryPhoneNumber: breweryData.phone,
      breweryWebsite: breweryData.website,
      breweryEmail: breweryData.email,
      
      // Social media
      brewerySocialMedia: breweryData.brewerySocialMedia || {},
      
      // Campi aggiuntivi
      foundingYear: breweryData.foundingYear,
      brewerySize: breweryData.brewerySize,
      productionVolume: breweryData.productionVolume,
      breweryHistory: breweryData.breweryHistory,
      mainProducts: breweryData.mainProducts || [],
      awards: breweryData.awards || [],
      
      // 🔥 P0.2 FIX: Nuovi campi da HTMLParser (7 dic 2025)
      employeeCount: breweryData.employeeCount,
      masterBrewer: breweryData.masterBrewer,
      breweryFiscalCode: breweryData.breweryFiscalCode,
      breweryREAcode: breweryData.reaCode,
      breweryacciseCode: breweryData.acciseCode,
      
      // 🔥 P1.6 FIX: Metadati con supporto confidence 0 (7 dic 2025)
      // 🔥 FIX: usa solo valori enum validi per dataSource (7 dic 2025)
      aiExtracted: isUnverified, // true se dati solo da AI non verificati
      aiConfidence: breweryData.confidence !== undefined ? breweryData.confidence : (breweryData.website ? 0.8 : 0.5),
      dataSource: breweryData.dataSource || (breweryData.website ? 'web_search' : 'ai_analysis'),
      validationStatus: breweryData.validationStatus || (breweryData.website ? 'web_scraped' : 'pending_validation'),
      lastAiUpdate: new Date(),
      needsManualReview: isUnverified || !breweryData.website, // Flagga se non verificato o no web data
      // 🔥 FIX: Aggiungo motivazione revisione manuale (16 dic 2025)
      reviewReason: (isUnverified || !breweryData.website) 
        ? (breweryData.reviewReason || (isUnverified 
            ? 'Dati non verificati online - confidence bassa' 
            : 'Sito web birrificio non trovato - impossibile verificare dati'))
        : null
    });

    logger.info(`✅ Birrificio creato: ${breweryName}`, {
      dataSource: brewery.dataSource,
      validationStatus: brewery.validationStatus,
      hasWebsite: !!brewery.breweryWebsite,
      hasEmail: !!brewery.breweryEmail,
      hasPhone: !!brewery.breweryPhoneNumber,
      hasAddress: !!brewery.breweryLegalAddress,
      mainProducts: brewery.mainProducts?.length || 0,
      awards: brewery.awards?.length || 0,
      needsManualReview: brewery.needsManualReview
    });

    return brewery;

  } catch (error) {
    logger.error(`❌ Errore trova/crea birrificio per birra "${beerName}":`, error);
    throw error;
  }
}

/**
 * Trova o crea birra dal dato AI/web
 * @param {Object} bottle - Dati bottiglia (include tutti i dati già estratti da web/AI)
 * @param {String} breweryId - ID birrificio MongoDB
 * @param {Object} job - Job Bull per progress tracking
 * @returns {Promise<Object>} Birra MongoDB
 */
async function findOrCreateBeer(bottle, breweryId, job) {
  // I dati sono già stati estratti nella sezione precedente!
  const beerName = bottle.beerName;

  try {
    // 1. Cerca birra esistente per questo birrificio
    let beer = await Beer.findOne({
      beerName: { $regex: new RegExp(`^${beerName}$`, 'i') },
      brewery: breweryId
    });

    if (beer) {
      logger.info(`✅ Birra trovata in DB: ${beerName} - ARRICCHISCO con dati web-scraped`);
      
      // 🆕 ENRICHMENT #1: Aggiorna Beer esistente con TUTTI i dati web-scraped disponibili
      const updateFields = {};
      
      // Helper per aggiornare solo se campo è vuoto/mancante
      const updateIfEmpty = (field, value) => {
        if (!beer[field] && value !== undefined && value !== null && value !== '') {
          updateFields[field] = value;
        }
      };
      
      // Aggiorna TUTTI i campi disponibili da web scraping/AI
      updateIfEmpty('alcoholContent', bottle.alcoholContent);
      updateIfEmpty('beerType', bottle.beerType || bottle.beerStyle);
      updateIfEmpty('beerSubStyle', bottle.beerSubStyle);
      updateIfEmpty('ibu', bottle.ibu);
      updateIfEmpty('volume', bottle.volume);
      updateIfEmpty('color', bottle.color); // 🆕 ENRICHMENT: Colore
      updateIfEmpty('servingTemperature', bottle.servingTemperature); // 🆕 ENRICHMENT: Temperatura
      
      // FIX #7B: Aggiunti 8 enrichment fields mancanti (2 dic 2025)
      updateIfEmpty('fermentation', bottle.fermentation);
      updateIfEmpty('pairing', bottle.pairing);
      updateIfEmpty('glassType', bottle.glassType);
      updateIfEmpty('aroma', bottle.aroma);
      updateIfEmpty('appearance', bottle.appearance);
      updateIfEmpty('mouthfeel', bottle.mouthfeel);
      updateIfEmpty('bitterness', bottle.bitterness);
      updateIfEmpty('carbonation', bottle.carbonation);
      
      updateIfEmpty('description', bottle.description);
      updateIfEmpty('tastingNotes', bottle.tastingNotes);
      updateIfEmpty('nutritionalInfo', bottle.nutritionalInfo);
      updateIfEmpty('price', bottle.price);
      updateIfEmpty('availability', bottle.availability);
      
      // Gestione array ingredients (aggiorna solo se array vuoto)
      if ((!beer.ingredients || beer.ingredients.length === 0) && bottle.ingredients && bottle.ingredients.length > 0) {
        updateFields.ingredients = bottle.ingredients;
      }
      
      // Aggiorna metadati se nuovi dati sono più completi
      if (Object.keys(updateFields).length > 0) {
        updateFields.lastAiUpdate = new Date();
        updateFields.dataSource = 'label+web'; // Upgrade dataSource
        updateFields.validationStatus = 'web_scraped';
        
        await Beer.updateOne({ _id: beer._id }, { $set: updateFields });
        
        logger.info(`🔄 Birra arricchita con ${Object.keys(updateFields).length} campi:`, {
          beerName,
          fieldsUpdated: Object.keys(updateFields).join(', ')
        });
        
        // Reload beer con nuovi dati
        beer = await Beer.findById(beer._id);
      } else {
        logger.info(`ℹ️ Birra già completa, nessun arricchimento necessario`);
      }
      
      return beer;
    }

    // 2. Birra non esiste, USA DATI GIÀ ESTRATTI dal bottle
    logger.info(`🆕 Creo nuova birra: ${beerName} con dati già estratti`);

    // Determina dataSource in base a cosa abbiamo
    const hasWebData = !!(bottle.ibu || bottle.tastingNotes || bottle.ingredients || 
                          bottle.color || bottle.servingTemperature);
    const dataSource = hasWebData ? 'label+web' : 'label';

    // 3. Crea nuova birra mappando TUTTI i campi dello schema Beer
    beer = await Beer.create({
      // Informazioni base obbligatorie
      beerName: beerName,
      brewery: breweryId,
      
      // Caratteristiche tecniche
      alcoholContent: bottle.alcoholContent,
      beerType: bottle.beerType,
      beerSubStyle: bottle.beerSubStyle,
      ibu: bottle.ibu, // International Bitterness Units
      volume: bottle.volume,
      color: bottle.color, // 🆕 ENRICHMENT #2: Colore estratto da web scraping
      servingTemperature: bottle.servingTemperature, // 🆕 ENRICHMENT #3: Temperatura servizio da web scraping
      
      // FIX #7A: Aggiunti 8 enrichment fields mancanti (2 dic 2025)
      fermentation: bottle.fermentation,
      pairing: bottle.pairing,
      glassType: bottle.glassType,
      aroma: bottle.aroma,
      appearance: bottle.appearance,
      mouthfeel: bottle.mouthfeel,
      bitterness: bottle.bitterness,
      carbonation: bottle.carbonation,
      
      // Descrizioni e note
      description: bottle.description,
      ingredients: bottle.ingredients,
      tastingNotes: bottle.tastingNotes,
      nutritionalInfo: bottle.nutritionalInfo,
      
      // Informazioni commerciali
      price: bottle.price,
      availability: bottle.availability,
      
      // Metadati AI
      aiExtracted: true,
      aiConfidence: bottle.confidence || 0.5,
      dataSource: dataSource,
      lastAiUpdate: new Date(),
      // 🔥 FIX 18 dic 2025: breweryName non esiste in questo scope - usare bottle.breweryName
      needsValidation: !hasWebData || !bottle.breweryName, // Flagga per admin se dati limitati o brewery sconosciuto
      validationReason: (!hasWebData || !bottle.breweryName)
        ? (!bottle.breweryName 
            ? 'Nome birrificio non identificato - richiede verifica manuale'
            : 'Dati tecnici limitati (solo da etichetta) - richiede verifica e arricchimento')
        : null,
      validationStatus: hasWebData ? 'web_scraped' : 'ai_extracted',
      needsManualReview: !hasWebData || !bottle.breweryName, // Segnala admin se manca nome birrificio
      reviewReason: (!hasWebData || !bottle.breweryName)
        ? (!bottle.breweryName 
            ? 'Nome birrificio non identificato - richiede associazione manuale'
            : 'Dati tecnici limitati (solo da etichetta) - arricchimento web non riuscito')
        : null
    });

    logger.info(`✅ Birra creata: ${beerName}`, {
      dataSource: beer.dataSource,
      validationStatus: beer.validationStatus,
      hasWebData: hasWebData,
      alcoholContent: beer.alcoholContent,
      beerType: beer.beerType,
      ibu: beer.ibu,
      volume: beer.volume,
      hasDescription: !!beer.description,
      hasIngredients: !!beer.ingredients,
      hasTastingNotes: !!beer.tastingNotes,
      needsManualReview: beer.needsManualReview
    });

    // 4. Aggiungi birra ai prodotti del birrificio
    await Brewery.updateOne(
      { _id: breweryId },
      { $addToSet: { breweryProducts: beer._id } }
    );

    logger.info(`✅ Birra aggiunta ai prodotti del birrificio`);

    return beer;

  } catch (error) {
    logger.error(`❌ Errore trova/crea birra ${beerName}:`, error);
    throw error;
  }
}

/**
 * Notifica admin per validazione manuale
 * @param {String} reviewId - ID recensione
 * @param {Array} errors - Errori riscontrati
 */
async function notifyAdminForValidation(reviewId, errors) {
  try {
    logger.info(`📧 Notifica admin per validazione recensione ${reviewId}`, {
      errors: errors.length
    });

    // TODO: Implementare invio email admin quando sistema email pronto
    // const adminEmail = process.env.ADMIN_EMAIL;
    // await sendEmail({
    //   to: adminEmail,
    //   subject: 'Recensione richiede validazione',
    //   body: `Recensione ${reviewId} necessita validazione manuale. Errori: ${errors.length}`
    // });

    // Per ora solo log
    logger.warn(`⚠️ Admin notification required for review ${reviewId}`);

  } catch (error) {
    logger.error('Errore notifica admin:', error);
    // Non bloccare il processing se la notifica fallisce
  }
}

module.exports = {
  processReviewBackground,
  findOrCreateBrewery,
  findOrCreateBeer
};
