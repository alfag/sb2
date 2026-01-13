/**
 * CONTROLLER TEST - SOLO ANALISI SENZA SALVATAGGIO DATABASE
 * 
 * Questo controller esegue l'intero flusso di analisi AI + web search/scraping
 * ma NON salva NULLA nel database. Serve SOLO per test e debug.
 * 
 * Flusso:
 * 1. Analisi AI immagine (Gemini)
 * 2. Web Search/Scraping birrificio
 * 3. Matching birra
 * 4. Ritorna TUTTI i dati trovati per visualizzazione frontend
 * 5. ZERO scritture database
 */

const GeminiAI = require('../utils/geminiAi');
const Brewery = require('../models/Brewery');
const Beer = require('../models/Beer');
const WebScrapingService = require('../services/webScrapingService');
const WebSearchService = require('../services/webSearchService');
const logWithFileName = require('../utils/logger');

const logger = logWithFileName(__filename);

/**
 * TEST: Analisi completa senza salvataggio
 * POST /review/test-async
 */
exports.testAnalyzeAsync = async (req, res) => {
  try {
    logger.info('[TEST] 🧪 Richiesta TEST analisi (NESSUN SALVATAGGIO DB)');

    // 1. Verifica presenza immagine
    if (!req.file && !req.files) {
      return res.status(400).json({
        success: false,
        message: 'Nessuna immagine caricata'
      });
    }

    const imageFile = req.file || req.files[0];
    const imageBuffer = imageFile.buffer;
    const mimeType = imageFile.mimetype;

    logger.info(`[TEST] 📊 Immagine ricevuta: ${imageFile.originalname} (${imageFile.size} bytes)`);

    // 2. Converti buffer in base64 per Gemini AI
    const imageBase64 = `data:${mimeType};base64,${imageBuffer.toString('base64')}`;

    // 3. Analisi AI immediata (SOLO lettura, nessuna scrittura)
    const aiResult = await GeminiAI.validateImage(imageBase64);

    if (!aiResult.success || !aiResult.bottles || aiResult.bottles.length === 0) {
      return res.status(400).json({
        success: false,
        message: '🔍 Non abbiamo trovato bottiglie di birra in questa immagine. Prova a scattare una foto più ravvicinata dell\'etichetta o scegli un\'altra immagine con birre ben visibili.',
        errorType: 'NO_BEER_DETECTED'
      });
    }

    logger.info(`[TEST] ✅ AI ha rilevato ${aiResult.bottles.length} bottiglia/e`);
    
    // 🔍 Log completo struttura AI
    logger.info('[TEST] 🔍 Struttura completa AI:', JSON.stringify(aiResult.bottles[0], null, 2));

    // 4. Processa ogni bottiglia (SOLO analisi, NO scrittura DB)
    const processedBottles = [];

    for (let i = 0; i < aiResult.bottles.length; i++) {
      const bottle = aiResult.bottles[i];
      
      logger.info(`[TEST] 🍺 Processing bottiglia ${i + 1}/${aiResult.bottles.length}`, {
        beerName: bottle.beerName || bottle.labelData?.beerName,
        breweryName: bottle.breweryName || bottle.labelData?.breweryName
      });

      try {
        // Estrai dati dalla struttura AI
        const beerName = bottle.labelData?.beerName || bottle.beerName || 'Nome sconosciuto';
        const breweryName = bottle.labelData?.breweryName || bottle.labelData?.brewery || bottle.breweryName || 'Birrificio sconosciuto';
        
        logger.info(`[TEST] 📝 Dati estratti da AI:`, {
          beerName,
          breweryName,
          alcoholContent: bottle.labelData?.alcoholContent || bottle.alcoholContent,
          beerStyle: bottle.labelData?.beerStyle || bottle.beerStyle
        });

        // 5. CERCA (NON CREARE) birrificio esistente
        let brewery = null;
        let breweryData = {};
        
        try {
          brewery = await Brewery.findOne({
            breweryName: { $regex: new RegExp(`^${breweryName}$`, 'i') }
          });

          if (brewery) {
            logger.info(`[TEST] ✅ Birrificio trovato in DB: ${breweryName}`);
            breweryData = {
              _id: brewery._id,
              breweryName: brewery.breweryName,
              breweryLegalAddress: brewery.breweryLegalAddress,
              website: brewery.website,
              email: brewery.email,
              phone: brewery.phone,
              foundingYear: brewery.foundingYear,
              brewerySize: brewery.brewerySize,
              productionVolume: brewery.productionVolume,
              description: brewery.description,
              breweryHistory: brewery.breweryHistory,
              mainProducts: brewery.mainProducts,
              awards: brewery.awards,
              brewerySocialMedia: brewery.brewerySocialMedia,
              dataSource: 'existing_db'
            };
          } else {
            logger.info(`[TEST] 🔍 Birrificio NON trovato in DB, provo web search: ${breweryName}`);
            
            // Prova web search (SOLO lettura, nessuna creazione)
            try {
              const searchResult = await WebSearchService.searchBreweryOnWeb(breweryName);
              
              if (searchResult && searchResult.website) {
                logger.info(`[TEST] 🌐 Google search trovato website: ${searchResult.website}`);
                
                // Prova web scraping
                try {
                  const webData = await WebScrapingService.scrapeBreweryWebsite(searchResult.website);
                  breweryData = {
                    breweryName: breweryName,
                    website: searchResult.website,
                    ...webData,
                    dataSource: 'web_search',
                    needsCreation: true // Flag per indicare che andrebbe creato
                  };
                  logger.info(`[TEST] ✅ Web scraping completato per ${breweryName}`);
                } catch (scrapeError) {
                  logger.warn(`[TEST] ⚠️ Web scraping fallito: ${scrapeError.message}`);
                  breweryData = {
                    breweryName: breweryName,
                    website: searchResult.website,
                    dataSource: 'web_search_only',
                    needsCreation: true
                  };
                }
              } else {
                logger.info(`[TEST] ⚠️ Web search non ha trovato risultati per ${breweryName}`);
                breweryData = {
                  breweryName: breweryName,
                  dataSource: 'ai_only',
                  needsCreation: true
                };
              }
            } catch (searchError) {
              logger.error(`[TEST] ❌ Web search fallito: ${searchError.message}`);
              breweryData = {
                breweryName: breweryName,
                dataSource: 'ai_only',
                needsCreation: true,
                error: searchError.message
              };
            }
          }
        } catch (dbError) {
          logger.error(`[TEST] ❌ Errore ricerca birrificio DB: ${dbError.message}`);
          breweryData = {
            breweryName: breweryName,
            dataSource: 'error',
            error: dbError.message
          };
        }

        // 6. CERCA (NON CREARE) birra esistente
        let beer = null;
        let beerData = {};

        if (brewery) {
          try {
            beer = await Beer.findOne({
              beerName: { $regex: new RegExp(`^${beerName}$`, 'i') },
              brewery: brewery._id
            });

            if (beer) {
              logger.info(`[TEST] ✅ Birra trovata in DB: ${beerName}`);
              beerData = {
                _id: beer._id,
                beerName: beer.beerName,
                beerType: beer.beerType,
                alcoholContent: beer.alcoholContent,
                ibu: beer.ibu,
                volume: beer.volume,
                description: beer.description,
                ingredients: beer.ingredients,
                color: beer.color,
                servingTemperature: beer.servingTemperature,
                tastingNotes: beer.tastingNotes,
                dataSource: 'existing_db'
              };
            } else {
              logger.info(`[TEST] ⚠️ Birra NON trovata in DB: ${beerName}`);
              beerData = {
                beerName: beerName,
                beerType: bottle.labelData?.beerStyle || bottle.beerStyle,
                alcoholContent: bottle.labelData?.alcoholContent || bottle.alcoholContent,
                volume: bottle.labelData?.volume || bottle.volume,
                dataSource: 'ai_only',
                needsCreation: true
              };
            }
          } catch (dbError) {
            logger.error(`[TEST] ❌ Errore ricerca birra DB: ${dbError.message}`);
            beerData = {
              beerName: beerName,
              dataSource: 'error',
              error: dbError.message
            };
          }
        } else {
          // Birrificio non esistente, usa solo dati AI
          beerData = {
            beerName: beerName,
            beerType: bottle.labelData?.beerStyle || bottle.beerStyle,
            alcoholContent: bottle.labelData?.alcoholContent || bottle.alcoholContent,
            volume: bottle.labelData?.volume || bottle.volume,
            dataSource: 'ai_only',
            needsCreation: true
          };
        }

        // 7. Compila risultato completo per questa bottiglia
        processedBottles.push({
          // Dati Birra
          beer: beerData,
          
          // Dati Birrificio
          brewery: breweryData,
          
          // Dati Grezzi AI (per debug)
          aiRawData: {
            labelData: bottle.labelData,
            extractionConfidence: bottle.extractionConfidence,
            searchQueries: bottle.searchQueries,
            stylisticElements: bottle.stylisticElements,
            dataSource: bottle.dataSource
          },
          
          // Metadati Processing
          metadata: {
            bottleIndex: i,
            processingTime: new Date(),
            breweryFound: !!brewery,
            beerFound: !!beer,
            webSearchPerformed: breweryData.dataSource?.includes('web'),
            needsDatabaseCreation: breweryData.needsCreation || beerData.needsCreation
          }
        });

        logger.info(`[TEST] ✅ Bottiglia ${i + 1} processata (NESSUN SALVATAGGIO)`);

      } catch (error) {
        logger.error(`[TEST] ❌ Errore processing bottiglia ${i + 1}:`, error);
        
        processedBottles.push({
          error: {
            message: error.message,
            stack: error.stack
          },
          metadata: {
            bottleIndex: i,
            failed: true,
            breweryFound: false,
            beerFound: false,
            webSearchPerformed: false,
            needsDatabaseCreation: false
          }
        });
      }
    }

    // 8. Risposta completa con TUTTI i dati (ZERO scritture DB effettuate)
    const response = {
      success: true,
      test: true, // Flag che indica modalità test
      message: '✅ Analisi completata. NESSUN DATO SALVATO NEL DATABASE.',
      data: {
        // Dati immagine
        image: {
          originalName: imageFile.originalname,
          size: imageFile.size,
          mimeType: mimeType
        },
        
        // Risultati AI
        aiAnalysis: {
          bottlesDetected: aiResult.bottles.length,
          confidence: aiResult.bottles[0]?.extractionConfidence,
          processingTime: aiResult.processingTime
        },
        
        // Bottiglie processate
        bottles: processedBottles,
        
        // Summary
        summary: {
          totalBottles: processedBottles.length,
          breweriesFound: processedBottles.filter(b => b.metadata?.breweryFound).length,
          beersFound: processedBottles.filter(b => b.metadata?.beerFound).length,
          webSearchesPerformed: processedBottles.filter(b => b.metadata?.webSearchPerformed).length,
          needsCreation: processedBottles.filter(b => b.metadata?.needsDatabaseCreation).length,
          errors: processedBottles.filter(b => b.error).length
        }
      }
    };

    logger.info('[TEST] 🎉 Risposta test completa:', {
      bottlesProcessed: processedBottles.length,
      databaseWrites: 0 // ZERO scritture!
    });

    return res.status(200).json(response);

  } catch (error) {
    logger.error('[TEST] ❌ Errore fatale:', error);
    return res.status(500).json({
      success: false,
      test: true,
      message: 'Errore durante l\'analisi test',
      error: error.message,
      stack: error.stack
    });
  }
};

module.exports = {
  testAnalyzeAsync: exports.testAnalyzeAsync
};
