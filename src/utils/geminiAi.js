// Modulo GeminiAI: interfaccia per validazione e analisi immagini tramite API Gemini
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { GoogleAuth } = require('google-auth-library');
const { GEMINI_API_KEY } = require('../../config/config');
const { IMAGE_ANALYSIS_PROMPT } = require('../../config/aiPrompts');
const Review = require('../models/Review');
const Brewery = require('../models/Brewery');
const Beer = require('../models/Beer');
const logWithFileName = require('./logger');
const logger = logWithFileName(__filename);

// Utility per retry con backoff exponential migliorato
async function retryWithBackoff(fn, maxRetries = 3, baseDelay = 2000, description = 'Operazione') {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      const isLastAttempt = attempt === maxRetries;
      const errorMessage = error.message || error.toString();
      
      // Categorie di errori retry-able più complete
      const isRetryableError = errorMessage && (
        errorMessage.includes('overloaded') || 
        errorMessage.includes('503') ||
        errorMessage.includes('Service Unavailable') ||
        errorMessage.includes('429') ||
        errorMessage.includes('Too Many Requests') ||
        errorMessage.includes('timeout') ||
        errorMessage.includes('fetch failed') ||
        errorMessage.includes('network') ||
        errorMessage.includes('ECONNRESET') ||
        errorMessage.includes('ETIMEDOUT') ||
        errorMessage.includes('ENOTFOUND') ||
        errorMessage.includes('500') ||
        errorMessage.includes('502') ||
        errorMessage.includes('504') ||
        errorMessage.includes('Gateway') ||
        errorMessage.includes('temporarily unavailable')
      );
      
      if (isRetryableError && !isLastAttempt) {
        // Backoff exponential con jitter più aggressivo per API overload
        const baseDelayAdjusted = errorMessage.includes('overloaded') ? baseDelay * 2 : baseDelay;
        const exponentialDelay = baseDelayAdjusted * Math.pow(2, attempt - 1);
        const jitter = Math.random() * 2000; // Jitter fino a 2 secondi
        const delay = exponentialDelay + jitter;
        
        logger.warn(`[GeminiAI] ⚠️ ${description} - tentativo ${attempt}/${maxRetries} fallito. Retry tra ${Math.round(delay)}ms...`, {
          errorMessage: errorMessage,
          errorType: error.constructor?.name || 'Unknown',
          attempt,
          maxRetries,
          nextRetryIn: `${Math.round(delay)}ms`,
          isOverloadError: errorMessage.includes('overloaded'),
          retryStrategy: errorMessage.includes('overloaded') ? 'aggressive_backoff' : 'standard_backoff'
        });
        
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      } else {
        if (isLastAttempt && isRetryableError) {
          logger.error(`[GeminiAI] ❌ ${description} - tutti i ${maxRetries} tentativi falliti:`, {
            errorMessage: errorMessage,
            errorType: error.constructor?.name || 'Unknown',
            totalAttempts: maxRetries,
            finalErrorCategory: categorizeError(errorMessage),
            suggestedAction: getSuggestedAction(errorMessage)
          });
        }
        throw error;
      }
    }
  }
}

// Categorizza gli errori per debugging e logging
function categorizeError(errorMessage) {
  if (!errorMessage) return 'unknown';
  
  const msg = errorMessage.toLowerCase();
  if (msg.includes('overloaded') || msg.includes('503')) return 'service_overloaded';
  if (msg.includes('429') || msg.includes('too many requests')) return 'rate_limited';
  if (msg.includes('fetch failed') || msg.includes('network')) return 'network_error';
  if (msg.includes('timeout')) return 'timeout_error';
  if (msg.includes('500') || msg.includes('502') || msg.includes('504')) return 'server_error';
  if (msg.includes('quota') || msg.includes('billing')) return 'quota_exceeded';
  if (msg.includes('unauthorized') || msg.includes('api key')) return 'auth_error';
  return 'other_error';
}

// Suggerisce azioni per diversi tipi di errore
function getSuggestedAction(errorMessage) {
  const category = categorizeError(errorMessage);
  
  switch (category) {
    case 'service_overloaded':
      return 'Wait longer before retry, API is experiencing high load';
    case 'rate_limited':
      return 'Implement request queuing or reduce request frequency';
    case 'network_error':
      return 'Check network connectivity and DNS resolution';
    case 'timeout_error':
      return 'Increase timeout duration or reduce image size';
    case 'server_error':
      return 'Google API server issue, monitor status page';
    case 'quota_exceeded':
      return 'Check billing settings and API quotas';
    case 'auth_error':
      return 'Verify API key configuration and permissions';
    default:
      return 'Check error logs for specific resolution steps';
  }
}

// Inizializza autenticazione Google Cloud
let genAI;
let authClient;

async function initializeGeminiAI() {
  try {
    if (GEMINI_API_KEY && GEMINI_API_KEY !== 'YOUR_GEMINI_API_KEY') {
      // Usa API Key se disponibile (metodo semplice)
      genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
      logger.debug('[GeminiAI] Inizializzato con API Key');
    } else {
      // Usa autenticazione Google Cloud (metodo enterprise)
      const auth = new GoogleAuth({
        scopes: 'https://www.googleapis.com/auth/cloud-platform',
      });
      authClient = await auth.getClient();
      
      // Inizializza con autenticazione cloud
      genAI = new GoogleGenerativeAI({
        authClient: authClient,
      });
      logger.debug('[GeminiAI] Inizializzato con Google Cloud Auth');
    }
    return true;
  } catch (error) {
    logger.error('[GeminiAI] Errore inizializzazione:', error);
    return false;
  }
}

// Validazione e analisi completa: contenuto immagine + estrazione dettagli
async function validateImage(image, reviewId = null, userId = null, sessionId = null) {
  logger.info('[GeminiAI] Avvio analisi immagine', { reviewId, userId, sessionId });

  // Inizializza Gemini AI se non ancora fatto
  if (!genAI) {
    const initialized = await initializeGeminiAI();
    if (!initialized) {
      logger.warn('[GeminiAI] Inizializzazione fallita, simulazione attiva');
      return { 
        success: true, 
        message: 'Validazione simulata - errore inizializzazione Gemini', 
        bottles: [],
        brewery: null,
        analysisComplete: false
      };
    }
  }

  // Controllo autenticazione
  if (!GEMINI_API_KEY && !authClient) {
    logger.warn('[GeminiAI] Autenticazione non configurata, simulazione attiva'); 
    return { 
      success: true, 
      message: 'Validazione simulata - configurare autenticazione Gemini', 
      bottles: [],
      brewery: null,
      analysisComplete: false
    };
  }
  
  try {    
    // Converti l'immagine base64 nel formato richiesto da Gemini
    const imageParts = [
      {
        inlineData: {
          data: image.replace(/^data:image\/[a-z]+;base64,/, ''), // Rimuovi il prefisso data:image
          mimeType: "image/jpeg"
        }
      }
    ];
    
    // Usa il prompt centralizzato dal file di configurazione
    const prompt = IMAGE_ANALYSIS_PROMPT;
    
    logger.info('[GeminiAI] Avvio analisi con Gemini AI');
    
    // Aggiungi configurazioni di sicurezza per evitare blocchi su contenuti borderline
    const { HarmBlockThreshold, HarmCategory } = require("@google/generative-ai");
    const safetySettings = [
      {
        category: HarmCategory.HARM_CATEGORY_HARASSMENT,
        threshold: HarmBlockThreshold.BLOCK_NONE,
      },
      {
        category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
        threshold: HarmBlockThreshold.BLOCK_NONE,
      },
      {
        category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
        threshold: HarmBlockThreshold.BLOCK_NONE,
      },
      {
        category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
        threshold: HarmBlockThreshold.BLOCK_NONE,
      },
    ];

    // Usa il modello gemini-2.5-flash per analisi immagini con le nuove configurazioni
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.5-flash-lite",
      safetySettings,
    });
    
    // 🔧 DEBUG: Log completo prompt e risposta per debugging
    logger.info('[GeminiAI] 📤 PROMPT COMPLETO INVIATO AD AI:', {
      prompt: prompt.substring(0, 2000) + (prompt.length > 2000 ? '...[TRONCATO]' : ''),
      promptLength: prompt.length,
      imagePartsCount: imageParts.length
    });
    
    logger.info('[GeminiAI] Generazione contenuto in corso...');

    // Usa retry con backoff per gestire sovraccarichi API
    const { result, response, text } = await retryWithBackoff(async () => {
      const result = await model.generateContent([prompt, ...imageParts]);
      const response = await result.response;
      const text = response.text();
      
      return { result, response, text };
    }, 3, 2000, 'Generazione contenuto AI');

    // 🔧 DEBUG: Log completo risposta AI per debugging
    logger.info('[GeminiAI] 📥 RISPOSTA COMPLETA RICEVUTA DA AI:', {
      response: text,
      responseLength: text.length,
      startsWith: text.substring(0, 100),
      endsWith: text.substring(Math.max(0, text.length - 100))
    });

    logger.info('[GeminiAI] Risposta ricevuta, parsing JSON...');
    
    // Pulisci la risposta da eventuali delimitatori markdown
    let cleanedText = text.trim();
    
    // Rimuovi blocchi di codice markdown se presenti
    if (cleanedText.startsWith('```json')) {
      cleanedText = cleanedText.replace(/^```json\s*/, '');
    }
    if (cleanedText.startsWith('```')) {
      cleanedText = cleanedText.replace(/^```\s*/, '');
    }
    if (cleanedText.endsWith('```')) {
      cleanedText = cleanedText.replace(/\s*```$/, '');
    }
    
    logger.debug('[GeminiAI] Risposta pulita per parsing', { 
      originalLength: text.length, 
      cleanedLength: cleanedText.length,
      preview: cleanedText.substring(0, 200) + '...'
    });
    
    // Prova a parsare la risposta JSON
    let aiResult;
    try {
      aiResult = JSON.parse(cleanedText);
      logger.info('[GeminiAI] Analisi completata', { 
        success: aiResult.success, 
        productsFound: aiResult.bottles?.length || 0,
        webSearchPerformed: aiResult.webSearchPerformed 
      });
    } catch (parseErr) {
      logger.error('[GeminiAI] Errore parsing JSON', { 
        error: parseErr.message,
        textPreview: cleanedText.substring(0, 500) + '...'
      });
      aiResult = { 
        success: true, 
        message: 'Immagine analizzata ma formato risposta non standard: ' + cleanedText.substring(0, 100),
        bottles: [],
        brewery: null,
        analysisComplete: false
      };
    }

    // NON salvare i risultati su MongoDB qui - il salvataggio avviene nel controller dopo controllo ambiguità
    // Questa funzione ora restituisce solo i risultati dell'analisi AI senza salvare su DB
    
    return aiResult;
    
  } catch (err) {
    // Gestione specifica per diversi tipi di errori con fallback migliorati
    const errorType = err.constructor?.name || 'UnknownError';
    const errorMessage = err.message || err.toString() || 'Errore sconosciuto';
    const errorCategory = categorizeError(errorMessage);
    
    // Classifica il tipo di errore per messaggi utente più chiari e azioni appropriate
    let userMessage = 'Errore durante l\'analisi dell\'immagine';
    let logLevel = 'error';
    let shouldReturnFallback = false;
    let fallbackResponse = null;
    
    switch (errorCategory) {
      case 'service_overloaded':
        userMessage = '🔄 Il servizio AI è temporaneamente sovraccarico. La tua immagine è stata salvata e verrà analizzata appena possibile.';
        logLevel = 'warn';
        shouldReturnFallback = true;
        break;
        
      case 'rate_limited':
        userMessage = '⏱️ Troppe richieste simultanee. Attendi 30 secondi prima di riprovare.';
        logLevel = 'warn';
        break;
        
      case 'network_error':
        userMessage = '🌐 Problema di connessione. Verifica la tua connessione internet e riprova.';
        logLevel = 'warn';
        shouldReturnFallback = true;  
        break;
        
      case 'timeout_error':
        userMessage = '⏰ Timeout nell\'analisi. L\'immagine potrebbe essere troppo grande o complessa. Prova con un\'immagine più piccola.';
        logLevel = 'warn';
        break;
        
      case 'server_error':
        userMessage = '🔧 Problema temporaneo del servizio AI. Riprova tra qualche minuto.';
        logLevel = 'warn';
        shouldReturnFallback = true;
        break;
        
      case 'quota_exceeded':
        userMessage = '💳 Quota AI giornaliera esaurita. Contatta l\'amministratore o riprova domani.';
        logLevel = 'error';
        break;
        
      case 'auth_error':
        userMessage = '🔑 Errore di configurazione del servizio AI. Contatta l\'amministratore.';
        logLevel = 'error';
        break;
        
      default:
        if (errorMessage.includes('image') || errorMessage.includes('format')) {
          userMessage = '📷 Formato immagine non supportato. Usa JPG, PNG o WebP.';
        } else if (errorMessage.includes('fetch failed')) {
          userMessage = '🌐 Errore di connessione al servizio AI. Riprova tra qualche minuto.';
          logLevel = 'warn';
          shouldReturnFallback = true;
        }
        break;
    }
    
    // Crea risposta di fallback per errori temporanei
    if (shouldReturnFallback) {
      fallbackResponse = {
        success: true,
        message: 'Immagine salvata - analisi AI temporaneamente non disponibile',
        fallbackMode: true,
        bottles: [{
          id: 1,
          bottleLabel: 'Birra non identificata',
          needsManualReview: true,
          aiData: {
            bottleLabel: 'Birra non identificata',
            confidence: 0.1,
            analysisStatus: 'fallback_mode',
            fallbackReason: errorCategory
          }
        }],
        brewery: {
          id: 1,
          breweryName: 'Birrificio non identificato',
          needsManualReview: true,
          confidence: 0.1
        },
        summary: {
          verifiedBreweries: 0,
          unverifiedBreweries: 1,
          verifiedBeers: 0,
          unverifiedBeers: 1,
          requiresUserIntervention: true,
          interventionReason: 'Analisi AI fallita - inserimento manuale richiesto',
          readyToSave: false,
          nextSteps: ['Compila manualmente i dati della birra e del birrificio']
        }
      };
    }
    
    // Log con livello appropriato e dettagli per debugging
    logger[logLevel]('[GeminiAI] Errore durante analisi', { 
      error: errorMessage,
      type: errorType,
      category: errorCategory,
      reviewId,
      sessionId,
      userMessage,
      isRetryable: logLevel === 'warn',
      suggestedAction: getSuggestedAction(errorMessage),
      hasFallback: shouldReturnFallback,
      fallbackActivated: !!fallbackResponse
    });
    
    // Ritorna fallback se disponibile, altrimenti errore standard
    if (fallbackResponse) {
      logger.info('[GeminiAI] Modalità fallback attivata', {
        reason: errorCategory,
        fallbackType: 'manual_review_required'
      });
      return fallbackResponse;
    }
    
    return { 
      success: false, 
      message: userMessage,
      errorType: errorType,
      errorCategory: errorCategory,
      isRetryable: logLevel === 'warn',
      suggestedRetryDelay: logLevel === 'warn' ? (errorCategory === 'rate_limited' ? 30000 : 60000) : null
    };
  }
};

// Funzione per salvare i risultati dell'analisi AI su MongoDB
async function saveAnalysisResults(aiResult, reviewId, userId, sessionId) {
  try {
    let breweryId = null;
    const beerIds = [];

    // 1. Gestisci il birrificio se presente
    if (aiResult.brewery && aiResult.brewery.breweryName) {
      breweryId = await findOrCreateBrewery(aiResult.brewery);
      logger.info('[GeminiAI] Birrificio gestito', { breweryId, name: aiResult.brewery.breweryName });
    }

    // 2. Gestisci le birre se il birrificio è stato creato/trovato
    if (breweryId && aiResult.bottles && aiResult.bottles.length > 0) {
      for (let i = 0; i < aiResult.bottles.length; i++) {
        const bottle = aiResult.bottles[i];
        if (bottle.bottleLabel || bottle.aiData?.bottleLabel) {
          const beerData = {
            beerName: bottle.bottleLabel || bottle.aiData?.bottleLabel,
            alcoholContent: bottle.aiData?.alcoholContent,
            beerType: bottle.aiData?.beerType,
            beerSubStyle: bottle.aiData?.beerSubStyle,
            volume: bottle.aiData?.volume,
            description: bottle.aiData?.description,
            ingredients: bottle.aiData?.ingredients,
            tastingNotes: bottle.aiData?.tastingNotes,
            ibu: bottle.aiData?.ibu,
            nutritionalInfo: bottle.aiData?.nutritionalInfo,
            price: bottle.aiData?.price,
            availability: bottle.aiData?.availability,
            confidence: bottle.aiData?.confidence,
            dataSource: bottle.aiData?.dataSource
          };

          const beerId = await findOrCreateBeer(beerData, breweryId);
          if (beerId) {
            beerIds.push(beerId);
            // Aggiungi l'ID della birra alla bottiglia per il frontend
            aiResult.bottles[i]._id = beerId;
            aiResult.bottles[i].breweryId = breweryId;
            
            logger.info('[GeminiAI] Birra gestita', { 
              beerId, 
              beerName: beerData.beerName, 
              breweryId 
            });
          }
        }
      }
    }

    // 3. Aggiorna la review se reviewId è fornito
    if (reviewId) {
      await updateReview(reviewId, aiResult, breweryId, userId, sessionId, beerIds);
    }

    return { 
      breweryId, 
      beerIds, 
      reviewUpdated: !!reviewId,
      beersProcessed: beerIds.length
    };
  } catch (error) {
    logger.error('[GeminiAI] Errore nel salvataggio', { error: error.message });
    throw error;
  }
}

// Trova o crea un birrificio basato sui dati AI con controlli duplicati avanzati
async function findOrCreateBrewery(breweryData) {
  try {
    const breweryName = breweryData.breweryName.trim();
    
    logger.info('[GeminiAI] Ricerca birrificio esistente', { 
      searchName: breweryName,
      hasWebsite: !!breweryData.breweryWebsite,
      hasEmail: !!breweryData.breweryEmail,
      hasAddress: !!breweryData.breweryLegalAddress
    });
    
    // FASE 1: Ricerca per nome esatto (case insensitive)
    let brewery = await Brewery.findOne({ 
      breweryName: { $regex: new RegExp(`^${breweryName}$`, 'i') } 
    });

    if (brewery) {
      logger.info('[GeminiAI] DUPLICATO BIRRIFICIO - Match nome esatto', { 
        searchType: 'EXACT_NAME_MATCH',
        searchName: breweryName,
        foundBreweryId: brewery._id,
        foundBreweryName: brewery.breweryName,
        aiExtracted: brewery.aiExtracted,
        lastAiUpdate: brewery.lastAiUpdate,
        existingData: {
          hasWebsite: !!brewery.breweryWebsite,
          hasEmail: !!brewery.breweryEmail,
          hasAddress: !!brewery.breweryLegalAddress,
          hasPhone: !!brewery.breweryPhoneNumber,
          hasSocial: !!(brewery.brewerySocialMedia && Object.keys(brewery.brewerySocialMedia).length > 0)
        }
      });
      
      const updatedBrewery = await updateExistingBrewery(brewery, breweryData);
      return updatedBrewery._id;
    }

    // FASE 2: Ricerca per nome simile (fuzzy matching)
    const breweries = await Brewery.find({ 
      breweryName: { $regex: new RegExp(breweryName.replace(/\s+/g, '\\s*'), 'i') } 
    });

    if (breweries.length > 0) {
      logger.info('[GeminiAI] DUPLICATO BIRRIFICIO - Match nome simile', { 
        searchType: 'FUZZY_NAME_MATCH',
        searchName: breweryName,
        candidatesFound: breweries.length,
        candidates: breweries.map(b => ({
          id: b._id,
          name: b.breweryName,
          similarity: calculateNameSimilarity(breweryName, b.breweryName),
          hasWebsite: !!b.breweryWebsite,
          hasEmail: !!b.breweryEmail,
          aiExtracted: b.aiExtracted
        }))
      });
      
      // Verifica ulteriore tramite website o email
      for (const existingBrewery of breweries) {
        if (await isMatchingBrewery(existingBrewery, breweryData)) {
          const updatedBrewery = await updateExistingBrewery(existingBrewery, breweryData);
          
          logger.info('[GeminiAI] DUPLICATO BIRRIFICIO CONFERMATO - Match dati aggiuntivi', { 
            searchType: 'CONFIRMED_FUZZY_MATCH',
            confirmedBreweryId: existingBrewery._id,
            confirmedBreweryName: existingBrewery.breweryName,
            newBreweryName: breweryData.breweryName,
            similarity: similarity,
            matchingCriteria: await getMatchingCriteria(existingBrewery, breweryData),
            fieldsUpdated: updatedBrewery.updatedFields || [],
            totalFieldsUpdated: (updatedBrewery.updatedFields || []).length
          });
          
          return updatedBrewery._id;
        }
      }
      
      logger.warn('[GeminiAI] Nome simile trovato ma dati aggiuntivi non corrispondono', {
        searchType: 'FUZZY_MATCH_NO_CONFIRMATION',
        searchName: breweryName,
        rejectedCandidates: breweries.map(b => ({
          id: b._id,
          name: b.breweryName,
          website: b.breweryWebsite,
          email: b.breweryEmail
        }))
      });
    }

    // FASE 3: Ricerca per website se disponibile
    if (breweryData.breweryWebsite) {
      const cleanWebsite = cleanUrl(breweryData.breweryWebsite);
      brewery = await Brewery.findOne({
        breweryWebsite: { $regex: new RegExp(cleanWebsite, 'i') }
      });

      if (brewery) {
        logger.info('[GeminiAI] DUPLICATO BIRRIFICIO - Match website', { 
          searchType: 'WEBSITE_MATCH',
          searchWebsite: breweryData.breweryWebsite,
          cleanedWebsite: cleanWebsite,
          foundBreweryId: brewery._id,
          foundBreweryName: brewery.breweryName,
          foundWebsite: brewery.breweryWebsite,
          namesSimilar: brewery.breweryName.toLowerCase().includes(breweryName.toLowerCase()) || 
                       breweryName.toLowerCase().includes(brewery.breweryName.toLowerCase())
        });
        return (await updateExistingBrewery(brewery, breweryData))._id;
      } else {
        logger.debug('[GeminiAI] Nessun match per website', {
          searchWebsite: breweryData.breweryWebsite,
          cleanedWebsite: cleanWebsite
        });
      }
    }

    // FASE 4: Ricerca per email se disponibile
    if (breweryData.breweryEmail) {
      brewery = await Brewery.findOne({
        breweryEmail: { $regex: new RegExp(`^${breweryData.breweryEmail}$`, 'i') }
      });

      if (brewery) {
        logger.info('[GeminiAI] DUPLICATO BIRRIFICIO - Match email', { 
          searchType: 'EMAIL_MATCH',
          searchEmail: breweryData.breweryEmail,
          foundBreweryId: brewery._id,
          foundBreweryName: brewery.breweryName,
          foundEmail: brewery.breweryEmail,
          namesSimilar: brewery.breweryName.toLowerCase().includes(breweryName.toLowerCase()) || 
                       breweryName.toLowerCase().includes(brewery.breweryName.toLowerCase())
        });
        return (await updateExistingBrewery(brewery, breweryData))._id;
      } else {
        logger.debug('[GeminiAI] Nessun match per email', {
          searchEmail: breweryData.breweryEmail
        });
      }
    }

    // FASE 5: Ricerca per indirizzo se disponibile
    if (breweryData.breweryLegalAddress) {
      const normalizedAddress = normalizeAddress(breweryData.breweryLegalAddress);
      brewery = await Brewery.findOne({
        $or: [
          { breweryLegalAddress: { $regex: new RegExp(normalizedAddress, 'i') } },
          { breweryProductionAddress: { $regex: new RegExp(normalizedAddress, 'i') } }
        ]
      });

      if (brewery) {
        logger.info('[GeminiAI] DUPLICATO BIRRIFICIO - Match indirizzo', { 
          searchType: 'ADDRESS_MATCH',
          searchAddress: breweryData.breweryLegalAddress,
          normalizedAddress: normalizedAddress,
          foundBreweryId: brewery._id,
          foundBreweryName: brewery.breweryName,
          foundLegalAddress: brewery.breweryLegalAddress,
          foundProductionAddress: brewery.breweryProductionAddress,
          matchedField: brewery.breweryLegalAddress?.toLowerCase().includes(normalizedAddress) ? 
                       'legal' : 'production'
        });
        return (await updateExistingBrewery(brewery, breweryData))._id;
      } else {
        logger.debug('[GeminiAI] Nessun match per indirizzo', {
          searchAddress: breweryData.breweryLegalAddress,
          normalizedAddress: normalizedAddress
        });
      }
    }

    // FASE 6: Nessun match trovato, crea nuovo birrificio
    logger.info('[GeminiAI] NUOVO BIRRIFICIO - Nessun duplicato trovato', { 
      searchType: 'NEW_BREWERY_CREATION',
      breweryName: breweryName,
      searchCriteria: {
        hasWebsite: !!breweryData.breweryWebsite,
        hasEmail: !!breweryData.breweryEmail,
        hasAddress: !!breweryData.breweryLegalAddress,
        hasPhone: !!breweryData.breweryPhoneNumber,
        hasSocial: !!(breweryData.brewerySocialMedia && Object.keys(breweryData.brewerySocialMedia).length > 0)
      },
      allSearchesConducted: {
        exactName: true,
        fuzzyName: true,
        website: !!breweryData.breweryWebsite,
        email: !!breweryData.breweryEmail,
        address: !!breweryData.breweryLegalAddress
      }
    });
    return await createNewBrewery(breweryData);

  } catch (error) {
    logger.error('[GeminiAI] Errore gestione birrificio', { 
      error: error.message, 
      breweryName: breweryData.breweryName 
    });
    throw error;
  }
}

// Verifica se due birrifici corrispondono basandosi su dati aggiuntivi
async function isMatchingBrewery(existingBrewery, newBreweryData) {
  const matches = [];
  const detailedMatches = [];

  // Match per website
  if (existingBrewery.breweryWebsite && newBreweryData.breweryWebsite) {
    const existingUrl = cleanUrl(existingBrewery.breweryWebsite);
    const newUrl = cleanUrl(newBreweryData.breweryWebsite);
    if (existingUrl === newUrl) {
      matches.push('website');
      detailedMatches.push({
        type: 'website',
        existing: existingBrewery.breweryWebsite,
        new: newBreweryData.breweryWebsite,
        confidence: 1.0
      });
    }
  }

  // Match per email
  if (existingBrewery.breweryEmail && newBreweryData.breweryEmail) {
    if (existingBrewery.breweryEmail.toLowerCase() === newBreweryData.breweryEmail.toLowerCase()) {
      matches.push('email');
      detailedMatches.push({
        type: 'email',
        existing: existingBrewery.breweryEmail,
        new: newBreweryData.breweryEmail,
        confidence: 1.0
      });
    }
  }

  // Match per indirizzo normalizzato
  if (existingBrewery.breweryLegalAddress && newBreweryData.breweryLegalAddress) {
    const existingAddr = normalizeAddress(existingBrewery.breweryLegalAddress);
    const newAddr = normalizeAddress(newBreweryData.breweryLegalAddress);
    
    let addressConfidence = 0;
    if (existingAddr === newAddr) {
      addressConfidence = 1.0;
    } else if (existingAddr.includes(newAddr) || newAddr.includes(existingAddr)) {
      addressConfidence = 0.8;
    }
    
    if (addressConfidence > 0) {
      matches.push('address');
      detailedMatches.push({
        type: 'address',
        existing: existingBrewery.breweryLegalAddress,
        new: newBreweryData.breweryLegalAddress,
        confidence: addressConfidence
      });
    }
  }

  // Match per social media
  if (existingBrewery.brewerySocialMedia && newBreweryData.brewerySocialMedia) {
    const platforms = ['facebook', 'instagram', 'twitter'];
    for (const platform of platforms) {
      if (existingBrewery.brewerySocialMedia[platform] && 
          newBreweryData.brewerySocialMedia[platform]) {
        const existingSocial = cleanUrl(existingBrewery.brewerySocialMedia[platform]);
        const newSocial = cleanUrl(newBreweryData.brewerySocialMedia[platform]);
        if (existingSocial === newSocial) {
          matches.push(`social_${platform}`);
          detailedMatches.push({
            type: `social_${platform}`,
            existing: existingBrewery.brewerySocialMedia[platform],
            new: newBreweryData.brewerySocialMedia[platform],
            confidence: 0.9
          });
        }
      }
    }
  }

  const isMatch = matches.length >= 1;
  
  logger.info('[GeminiAI] Verifica matching birrificio', {
    existingBreweryId: existingBrewery._id,
    existingBreweryName: existingBrewery.breweryName,
    newBreweryName: newBreweryData.breweryName,
    matchTypes: matches,
    detailedMatches: detailedMatches,
    totalMatches: matches.length,
    isConfirmedMatch: isMatch,
    confidence: detailedMatches.length > 0 ? 
      (detailedMatches.reduce((sum, m) => sum + m.confidence, 0) / detailedMatches.length) : 0
  });

  return isMatch;
}

// Aggiorna un birrificio esistente con nuovi dati
async function updateExistingBrewery(existingBrewery, newBreweryData) {
  try {
    const updateData = {};
    const updatedFields = [];

    // Aggiorna solo i campi mancanti o vuoti
    const fieldsToUpdate = [
      'foundingYear', 'breweryDescription', 'breweryWebsite', 'breweryEmail',
      'breweryLegalAddress', 'breweryProductionAddress', 'breweryPhoneNumber',
      'brewerySize', 'employeeCount', 'productionVolume', 'distributionArea',
      'breweryHistory', 'masterBrewer'
    ];

    for (const field of fieldsToUpdate) {
      if (newBreweryData[field] && 
          (!existingBrewery[field] || existingBrewery[field] === '' || existingBrewery[field] === 'Da completare')) {
        updateData[field] = newBreweryData[field];
        updatedFields.push(field);
      }
    }

    // Gestione array (mainProducts, awards)
    if (newBreweryData.mainProducts && Array.isArray(newBreweryData.mainProducts)) {
      const existingProducts = existingBrewery.mainProducts || [];
      const newProducts = newBreweryData.mainProducts.filter(p => !existingProducts.includes(p));
      if (newProducts.length > 0) {
        updateData.mainProducts = [...existingProducts, ...newProducts];
        updatedFields.push('mainProducts');
      }
    }

    if (newBreweryData.awards && Array.isArray(newBreweryData.awards)) {
      const existingAwards = existingBrewery.awards || [];
      const newAwards = newBreweryData.awards.filter(a => !existingAwards.includes(a));
      if (newAwards.length > 0) {
        updateData.awards = [...existingAwards, ...newAwards];
        updatedFields.push('awards');
      }
    }

    // Gestione social media
    if (newBreweryData.brewerySocialMedia) {
      const existingSocial = existingBrewery.brewerySocialMedia || {};
      const updatedSocial = { ...existingSocial };
      let socialUpdated = false;

      for (const [platform, url] of Object.entries(newBreweryData.brewerySocialMedia)) {
        if (url && (!existingSocial[platform] || existingSocial[platform] === '')) {
          updatedSocial[platform] = url;
          socialUpdated = true;
        }
      }

      if (socialUpdated) {
        updateData.brewerySocialMedia = updatedSocial;
        updatedFields.push('brewerySocialMedia');
      }
    }

    // Aggiorna metadati AI sempre
    updateData.aiExtracted = true;
    updateData.aiConfidence = Math.max(existingBrewery.aiConfidence || 0, newBreweryData.confidence || 0);
    updateData.lastAiUpdate = new Date();

    if (updatedFields.length > 0) {
      await Brewery.findByIdAndUpdate(existingBrewery._id, updateData);
      logger.info('[GeminiAI] Birrificio esistente aggiornato', { 
        type: 'BREWERY_UPDATE_SUCCESS',
        breweryId: existingBrewery._id, 
        breweryName: existingBrewery.breweryName,
        updatedFields: updatedFields,
        totalFieldsUpdated: updatedFields.length,
        updateData: Object.keys(updateData).reduce((obj, key) => {
          if (key !== 'lastAiUpdate') obj[key] = updateData[key];
          return obj;
        }, {}),
        previousAiConfidence: existingBrewery.aiConfidence,
        newAiConfidence: updateData.aiConfidence
      });
    } else {
      logger.info('[GeminiAI] Birrificio esistente confermato, nessun aggiornamento necessario', { 
        type: 'BREWERY_UPDATE_SKIPPED',
        breweryId: existingBrewery._id,
        breweryName: existingBrewery.breweryName,
        reason: 'all_fields_already_complete'
      });
    }

    return { 
      _id: existingBrewery._id,
      updatedFields: updatedFields
    };
  } catch (error) {
    logger.error('[GeminiAI] Errore aggiornamento birrificio esistente', { 
      error: error.message, 
      breweryId: existingBrewery._id 
    });
    throw error;
  }
}

// Crea un nuovo birrificio
async function createNewBrewery(breweryData) {
  try {
    const newBrewery = new Brewery({
      breweryName: breweryData.breweryName.trim(),
      breweryDescription: breweryData.breweryDescription || '',
      breweryFiscalCode: breweryData.fiscalCodes || '', // Non impostiamo placeholder
      breweryREAcode: breweryData.reaCode || '', // Solo se estratto dall'AI
      breweryacciseCode: breweryData.acciseCode || '', // Solo se estratto dall'AI
      breweryFund: breweryData.fund || '', // Solo se estratto dall'AI
      breweryLegalAddress: breweryData.breweryLegalAddress || '',
      breweryPhoneNumber: breweryData.breweryPhoneNumber || '',
      breweryWebsite: breweryData.breweryWebsite || '',
      breweryLogo: breweryData.breweryLogo || '',
      brewerySocialMedia: breweryData.brewerySocialMedia || {},
      
      // Campi AI aggiuntivi
      foundingYear: breweryData.foundingYear,
      breweryEmail: breweryData.breweryEmail,
      breweryProductionAddress: breweryData.breweryProductionAddress,
      brewerySize: breweryData.brewerySize,
      employeeCount: breweryData.employeeCount,
      productionVolume: breweryData.productionVolume,
      distributionArea: breweryData.distributionArea,
      breweryHistory: breweryData.breweryHistory,
      masterBrewer: breweryData.masterBrewer,
      mainProducts: breweryData.mainProducts || [],
      awards: breweryData.awards || [],
      
      // Metadati AI
      aiExtracted: true,
      aiConfidence: breweryData.confidence,
      lastAiUpdate: new Date()
    });

    const savedBrewery = await newBrewery.save();
    logger.info('[GeminiAI] Nuovo birrificio creato con successo', { 
      breweryId: savedBrewery._id, 
      name: breweryData.breweryName,
      hasWebsite: !!breweryData.breweryWebsite,
      hasEmail: !!breweryData.breweryEmail,
      confidence: breweryData.confidence
    });
    
    return savedBrewery._id;
  } catch (error) {
    logger.error('[GeminiAI] Errore creazione nuovo birrificio', { 
      error: error.message, 
      breweryName: breweryData.breweryName 
    });
    throw error;
  }
}

// Utility per pulire e normalizzare URL
function cleanUrl(url) {
  if (!url) return '';
  return url.toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/$/, '')
    .trim();
}

// Utility per normalizzare indirizzi
/**
 * Escape dei caratteri speciali regex per ricerche sicure
 */
function escapeRegex(string) {
  if (!string) return '';
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Normalizza il testo per confronti
 */
function normalizeText(text) {
  if (!text) return '';
  return text.toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, '') // Rimuove punteggiatura
    .replace(/\s+/g, ' '); // Normalizza spazi
}

/**
 * Calcola similarità tra due testi (algoritmo Levenshtein semplificato)
 */
function calculateTextSimilarity(str1, str2) {
  if (!str1 || !str2) return 0;
  if (str1 === str2) return 1;
  
  const len1 = str1.length;
  const len2 = str2.length;
  
  // Matrice per distanza Levenshtein
  const matrix = Array(len2 + 1).fill(null).map(() => Array(len1 + 1).fill(null));
  
  for (let i = 0; i <= len1; ++i) {
    matrix[0][i] = i;
  }
  
  for (let j = 0; j <= len2; ++j) {
    matrix[j][0] = j;
  }
  
  for (let j = 1; j <= len2; ++j) {
    for (let i = 1; i <= len1; ++i) {
      const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1, // insertion
        matrix[j - 1][i] + 1, // deletion
        matrix[j - 1][i - 1] + indicator // substitution
      );
    }
  }
  
  const distance = matrix[len2][len1];
  const maxLen = Math.max(len1, len2);
  return maxLen === 0 ? 1 : (maxLen - distance) / maxLen;
}

function normalizeAddress(address) {
  if (!address) return '';
  return address.toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s]/g, '')
    .trim();
}

// Calcola similarità tra nomi (per logging)
function calculateNameSimilarity(name1, name2) {
  if (!name1 || !name2) return 0;
  
  const normalize = (str) => str.toLowerCase().replace(/[^\w]/g, '');
  const n1 = normalize(name1);
  const n2 = normalize(name2);
  
  if (n1 === n2) return 1.0;
  
  // Calcolo distanza Levenshtein semplificato
  const longer = n1.length > n2.length ? n1 : n2;
  const shorter = n1.length > n2.length ? n2 : n1;
  
  if (longer.length === 0) return 1.0;
  
  const editDistance = levenshteinDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

// Distanza Levenshtein semplificata
function levenshteinDistance(str1, str2) {
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

// Ottiene criteri di matching dettagliati
async function getMatchingCriteria(existingBrewery, newBreweryData) {
  const criteria = [];
  
  // Match per website
  if (existingBrewery.breweryWebsite && newBreweryData.breweryWebsite) {
    const existingUrl = cleanUrl(existingBrewery.breweryWebsite);
    const newUrl = cleanUrl(newBreweryData.breweryWebsite);
    if (existingUrl === newUrl) {
      criteria.push({
        type: 'website',
        existing: existingBrewery.breweryWebsite,
        new: newBreweryData.breweryWebsite,
        normalized: { existing: existingUrl, new: newUrl }
      });
    }
  }

  // Match per email
  if (existingBrewery.breweryEmail && newBreweryData.breweryEmail) {
    if (existingBrewery.breweryEmail.toLowerCase() === newBreweryData.breweryEmail.toLowerCase()) {
      criteria.push({
        type: 'email',
        existing: existingBrewery.breweryEmail,
        new: newBreweryData.breweryEmail
      });
    }
  }

  // Match per indirizzo
  if (existingBrewery.breweryLegalAddress && newBreweryData.breweryLegalAddress) {
    const existingAddr = normalizeAddress(existingBrewery.breweryLegalAddress);
    const newAddr = normalizeAddress(newBreweryData.breweryLegalAddress);
    if (existingAddr.includes(newAddr) || newAddr.includes(existingAddr)) {
      criteria.push({
        type: 'address',
        existing: existingBrewery.breweryLegalAddress,
        new: newBreweryData.breweryLegalAddress,
        normalized: { existing: existingAddr, new: newAddr }
      });
    }
  }

  // Match per social media
  if (existingBrewery.brewerySocialMedia && newBreweryData.brewerySocialMedia) {
    const platforms = ['facebook', 'instagram', 'twitter'];
    for (const platform of platforms) {
      if (existingBrewery.brewerySocialMedia[platform] && 
          newBreweryData.brewerySocialMedia[platform]) {
        const existingSocial = cleanUrl(existingBrewery.brewerySocialMedia[platform]);
        const newSocial = cleanUrl(newBreweryData.brewerySocialMedia[platform]);
        if (existingSocial === newSocial) {
          criteria.push({
            type: `social_${platform}`,
            existing: existingBrewery.brewerySocialMedia[platform],
            new: newBreweryData.brewerySocialMedia[platform],
            normalized: { existing: existingSocial, new: newSocial }
          });
        }
      }
    }
  }

  return criteria;
}

// Aggiorna la review con i risultati dell'analisi AI
async function updateReview(reviewId, aiResult, breweryId, userId, sessionId, beerIds = []) {
  try {
    const updateData = {
      status: 'validated',
      aiFeedback: aiResult.message,
      aiAnalysis: {
        webSearchPerformed: aiResult.webSearchPerformed || false,
        dataSourceSummary: aiResult.dataSourceSummary || {},
        imageQuality: aiResult.imageQuality,
        analysisComplete: aiResult.analysisComplete || false,
        overallConfidence: aiResult.overallConfidence,
        processingTime: aiResult.extractionDetails?.processingTime
      }
    };

    // Assicura che sessionId sia salvato
    if (sessionId) {
      updateData.sessionId = sessionId;
    }

    // Aggiungi ratings per ogni bottiglia trovata
    if (aiResult.bottles && aiResult.bottles.length > 0) {
      updateData.ratings = aiResult.bottles.map((bottle, index) => ({
        bottleLabel: bottle.bottleLabel,
        rating: null, // Sarà compilato dall'utente
        brewery: breweryId,
        beer: beerIds[index] || null, // Riferimento alla birra nel database Beer
        aiData: {
          bottleLabel: bottle.bottleLabel, // Nome dalla AI per i controlli duplicati
          alcoholContent: bottle.alcoholContent,
          beerType: bottle.beerType,
          beerSubStyle: bottle.beerSubStyle,
          volume: bottle.volume,
          description: bottle.description,
          ingredients: bottle.ingredients,
          tastingNotes: bottle.tastingNotes,
          confidence: bottle.confidence,
          dataSource: bottle.dataSource,
          ibu: bottle.ibu,
          nutritionalInfo: bottle.nutritionalInfo,
          price: bottle.price,
          availability: bottle.availability
        }
      }));
    }

    await Review.findByIdAndUpdate(reviewId, updateData);
    logger.info('[GeminiAI] Review aggiornata', { 
      type: 'REVIEW_UPDATED_SUCCESS',
      reviewId, 
      sessionId,
      bottlesFound: aiResult.bottles?.length || 0,
      beersLinked: beerIds.length,
      breweryLinked: !!breweryId,
      beerIds: beerIds,
      breweryId: breweryId,
      status: updateData.status,
      analysisComplete: updateData.aiAnalysis?.analysisComplete
    });

  } catch (error) {
    logger.error('[GeminiAI] Errore aggiornamento review', { error: error.message, reviewId });
    throw error;
  }
};

// ================================
// GESTIONE DUPLICATI BIRRE
// ================================

/**
 * Cerca o crea una birra nel database con controllo duplicati
 * @param {Object} beerData - Dati della birra estratti dall'AI
 * @param {String} breweryId - ID del birrificio della birra
 * @returns {String} - ID della birra (esistente o nuova)
 */
async function findOrCreateBeer(beerData, breweryId) {
  try {
    if (!beerData.beerName || !breweryId) {
      logger.warn('[GeminiAI] Dati birra incompleti', { beerData, breweryId });
      return null;
    }

    const beerName = beerData.beerName.trim();
    
    logger.info('[GeminiAI] Ricerca birra esistente', { 
      searchName: beerName,
      breweryId: breweryId,
      searchCriteria: {
        hasAlcoholContent: !!beerData.alcoholContent,
        hasBeerType: !!beerData.beerType,
        hasVolume: !!beerData.volume,
        hasDescription: !!beerData.description
      }
    });

    // FASE 1: Ricerca per nome esatto + brewery
    let beer = await Beer.findOne({
      beerName: { $regex: new RegExp(`^${escapeRegex(beerName)}$`, 'i') },
      brewery: breweryId
    });

    if (beer) {
      logger.info('[GeminiAI] DUPLICATO BIRRA - Match nome esatto', { 
        searchType: 'EXACT_NAME_MATCH',
        searchName: beerName,
        foundBeerId: beer._id,
        foundBeerName: beer.beerName,
        breweryId: breweryId,
        aiExtracted: beer.aiExtracted,
        lastAiUpdate: beer.lastAiUpdate,
        existingData: {
          hasAlcoholContent: !!beer.alcoholContent,
          hasBeerType: !!beer.beerType,
          hasVolume: !!beer.volume,
          hasDescription: !!beer.description,
          hasIngredients: !!beer.ingredients
        }
      });
      
      const updatedBeer = await updateExistingBeer(beer, beerData);
      return updatedBeer._id;
    }

    // FASE 2: Ricerca fuzzy per nome simile + brewery
    const similarBeers = await Beer.find({
      brewery: breweryId,
      normalizedName: { $regex: new RegExp(normalizeText(beerName).replace(/\s+/g, '\\s*'), 'i') }
    });

    if (similarBeers.length > 0) {
      logger.info('[GeminiAI] DUPLICATO BIRRA - Trovati nomi simili', {
        searchType: 'FUZZY_NAME_MATCH',
        searchName: beerName,
        breweryId: breweryId,
        foundCandidates: similarBeers.map(b => ({
          id: b._id,
          name: b.beerName,
          normalizedName: b.normalizedName,
          similarity: calculateTextSimilarity(normalizeText(beerName), b.normalizedName)
        }))
      });

      // Verifica match per caratteristiche tecniche (alcoholContent, beerType, volume)
      for (const existingBeer of similarBeers) {
        const similarity = calculateTextSimilarity(normalizeText(beerName), existingBeer.normalizedName);
        
        if (similarity > 0.8 && await isSameBeer(existingBeer, beerData)) {
          const updatedBeer = await updateExistingBeer(existingBeer, beerData);
          
          logger.info('[GeminiAI] DUPLICATO BIRRA CONFERMATO - Match caratteristiche', { 
            searchType: 'CONFIRMED_FUZZY_MATCH',
            confirmedBeerId: existingBeer._id,
            confirmedBeerName: existingBeer.beerName,
            newBeerName: beerData.beerName,
            similarity: similarity,
            breweryId: breweryId,
            matchingCriteria: await getBeerMatchingCriteria(existingBeer, beerData),
            fieldsUpdated: updatedBeer.updatedFields || [],
            totalFieldsUpdated: (updatedBeer.updatedFields || []).length
          });
          
          return updatedBeer._id;
        }
      }
      
      logger.warn('[GeminiAI] Nome birra simile trovato ma caratteristiche non corrispondono', {
        searchType: 'FUZZY_MATCH_NO_CONFIRMATION',
        searchName: beerName,
        breweryId: breweryId,
        rejectedCandidates: similarBeers.map(b => ({
          id: b._id,
          name: b.beerName,
          alcoholContent: b.alcoholContent,
          beerType: b.beerType,
          volume: b.volume
        }))
      });
    }

    // FASE 3: Ricerca per caratteristiche tecniche simili (alcol + tipo + volume)
    if (beerData.alcoholContent || beerData.beerType || beerData.volume) {
      const query = { brewery: breweryId };
      
      if (beerData.alcoholContent) {
        query.alcoholContent = { $regex: new RegExp(escapeRegex(beerData.alcoholContent), 'i') };
      }
      if (beerData.beerType) {
        query.beerType = { $regex: new RegExp(escapeRegex(beerData.beerType), 'i') };
      }
      if (beerData.volume) {
        query.volume = { $regex: new RegExp(escapeRegex(beerData.volume), 'i') };
      }

      const technicalMatches = await Beer.find(query);
      
      if (technicalMatches.length > 0) {
        logger.info('[GeminiAI] DUPLICATO BIRRA - Match caratteristiche tecniche', {
          searchType: 'TECHNICAL_MATCH',
          searchName: beerName,
          breweryId: breweryId,
          searchCriteria: {
            alcoholContent: beerData.alcoholContent,
            beerType: beerData.beerType,
            volume: beerData.volume
          },
          foundMatches: technicalMatches.map(b => ({
            id: b._id,
            name: b.beerName,
            alcoholContent: b.alcoholContent,
            beerType: b.beerType,
            volume: b.volume,
            nameSimilarity: calculateTextSimilarity(normalizeText(beerName), b.normalizedName)
          }))
        });

        // Prendi il match con maggiore similarità del nome
        const bestMatch = technicalMatches.reduce((best, current) => {
          const currentSim = calculateTextSimilarity(normalizeText(beerName), current.normalizedName);
          const bestSim = calculateTextSimilarity(normalizeText(beerName), best.normalizedName);
          return currentSim > bestSim ? current : best;
        });

        const updatedBeer = await updateExistingBeer(bestMatch, beerData);
        return updatedBeer._id;
      }
    }

    // FASE 4: Nessun match trovato, crea nuova birra
    logger.info('[GeminiAI] NUOVA BIRRA - Nessun duplicato trovato', { 
      searchType: 'NEW_BEER_CREATION',
      newBeerName: beerName,
      breweryId: breweryId,
      beerData: {
        alcoholContent: beerData.alcoholContent,
        beerType: beerData.beerType,
        volume: beerData.volume,
        description: beerData.description,
        confidence: beerData.confidence
      }
    });

    const newBeer = new Beer({
      beerName: beerName,
      brewery: breweryId,
      alcoholContent: beerData.alcoholContent,
      beerType: beerData.beerType,
      beerSubStyle: beerData.beerSubStyle,
      ibu: beerData.ibu,
      volume: beerData.volume,
      description: beerData.description,
      ingredients: beerData.ingredients,
      tastingNotes: beerData.tastingNotes,
      nutritionalInfo: beerData.nutritionalInfo,
      price: beerData.price,
      availability: beerData.availability,
      aiExtracted: true,
      aiConfidence: beerData.confidence || 0.5,
      dataSource: beerData.dataSource || 'label',
      lastAiUpdate: new Date()
    });

    await newBeer.save();

    logger.info('[GeminiAI] Nuova birra creata', {
      type: 'BEER_CREATED_SUCCESS',
      beerId: newBeer._id,
      beerName: newBeer.beerName,
      breweryId: breweryId,
      aiConfidence: newBeer.aiConfidence,
      dataSource: newBeer.dataSource
    });

    return newBeer._id;

  } catch (error) {
    logger.error('[GeminiAI] Errore nella gestione birra', { 
      error: error.message, 
      beerName: beerData?.beerName,
      breweryId: breweryId 
    });
    throw error;
  }
}

/**
 * Verifica se due birre sono la stessa basandosi su caratteristiche tecniche
 */
async function isSameBeer(existingBeer, newBeerData) {
  const matches = [];
  const detailedMatches = [];

  // Match per gradazione alcolica
  if (existingBeer.alcoholContent && newBeerData.alcoholContent) {
    const existingAlc = normalizeAlcoholContent(existingBeer.alcoholContent);
    const newAlc = normalizeAlcoholContent(newBeerData.alcoholContent);
    if (Math.abs(existingAlc - newAlc) <= 0.5) { // Tolleranza 0.5%
      matches.push('alcohol');
      detailedMatches.push({
        type: 'alcohol',
        existing: existingBeer.alcoholContent,
        new: newBeerData.alcoholContent,
        confidence: 0.9
      });
    }
  }

  // Match per tipo birra
  if (existingBeer.beerType && newBeerData.beerType) {
    const similarity = calculateTextSimilarity(
      normalizeText(existingBeer.beerType), 
      normalizeText(newBeerData.beerType)
    );
    if (similarity > 0.7) {
      matches.push('type');
      detailedMatches.push({
        type: 'beer_type',
        existing: existingBeer.beerType,
        new: newBeerData.beerType,
        confidence: similarity
      });
    }
  }

  // Match per volume
  if (existingBeer.volume && newBeerData.volume) {
    const existingVol = normalizeVolume(existingBeer.volume);
    const newVol = normalizeVolume(newBeerData.volume);
    if (existingVol === newVol) {
      matches.push('volume');
      detailedMatches.push({
        type: 'volume',
        existing: existingBeer.volume,
        new: newBeerData.volume,
        confidence: 1.0
      });
    }
  }

  const isMatch = matches.length >= 2; // Almeno 2 match confermano l'identità
  
  logger.info('[GeminiAI] Verifica identità birra', {
    existingBeerId: existingBeer._id,
    existingBeerName: existingBeer.beerName,
    newBeerName: newBeerData.beerName,
    matchTypes: matches,
    detailedMatches: detailedMatches,
    totalMatches: matches.length,
    isConfirmedMatch: isMatch,
    confidence: detailedMatches.length > 0 ? 
      (detailedMatches.reduce((sum, m) => sum + m.confidence, 0) / detailedMatches.length) : 0
  });

  return isMatch;
}

/**
 * Aggiorna una birra esistente con nuovi dati
 */
async function updateExistingBeer(existingBeer, newBeerData) {
  try {
    const updateData = {};
    const updatedFields = [];

    // Campi da aggiornare se mancanti
    const fieldsToUpdate = [
      'alcoholContent', 'beerType', 'beerSubStyle', 'ibu', 'volume',
      'description', 'ingredients', 'tastingNotes', 'nutritionalInfo',
      'price', 'availability'
    ];

    for (const field of fieldsToUpdate) {
      if (newBeerData[field] && 
          (!existingBeer[field] || existingBeer[field] === '' || existingBeer[field] === 'Da completare')) {
        updateData[field] = newBeerData[field];
        updatedFields.push(field);
      }
    }

    // Aggiorna metadati AI sempre
    updateData.aiExtracted = true;
    updateData.aiConfidence = Math.max(existingBeer.aiConfidence || 0, newBeerData.confidence || 0);
    updateData.lastAiUpdate = new Date();

    if (updatedFields.length > 0) {
      await Beer.findByIdAndUpdate(existingBeer._id, updateData);
      logger.info('[GeminiAI] Birra esistente aggiornata', { 
        type: 'BEER_UPDATE_SUCCESS',
        beerId: existingBeer._id, 
        beerName: existingBeer.beerName,
        breweryId: existingBeer.brewery,
        updatedFields: updatedFields,
        totalFieldsUpdated: updatedFields.length,
        updateData: Object.keys(updateData).reduce((obj, key) => {
          if (key !== 'lastAiUpdate') obj[key] = updateData[key];
          return obj;
        }, {}),
        previousAiConfidence: existingBeer.aiConfidence,
        newAiConfidence: updateData.aiConfidence
      });
    } else {
      logger.info('[GeminiAI] Birra esistente confermata, nessun aggiornamento necessario', { 
        type: 'BEER_UPDATE_SKIPPED',
        beerId: existingBeer._id,
        beerName: existingBeer.beerName,
        breweryId: existingBeer.brewery,
        reason: 'all_fields_already_complete'
      });
    }

    return { 
      _id: existingBeer._id,
      updatedFields: updatedFields
    };
  } catch (error) {
    logger.error('[GeminiAI] Errore aggiornamento birra esistente', { 
      error: error.message, 
      beerId: existingBeer._id 
    });
    throw error;
  }
}

// ================================
// FUNZIONI UTILITY PER BIRRE
// ================================

/**
 * Normalizza il contenuto alcolico per confronti
 */
function normalizeAlcoholContent(alcoholStr) {
  if (!alcoholStr) return 0;
  const match = alcoholStr.match(/(\d+(?:\.\d+)?)/);
  return match ? parseFloat(match[1]) : 0;
}

/**
 * Normalizza il volume per confronti
 */
function normalizeVolume(volumeStr) {
  if (!volumeStr) return '';
  return volumeStr.toLowerCase()
    .replace(/\s+/g, '')
    .replace(/ml/g, 'ml')
    .replace(/cl/g, 'cl')
    .replace(/l/g, 'l');
}

/**
 * Ottiene i criteri di matching per il log
 */
async function getBeerMatchingCriteria(existingBeer, newBeerData) {
  const criteria = [];
  
  if (existingBeer.alcoholContent && newBeerData.alcoholContent) {
    criteria.push({
      field: 'alcoholContent',
      existing: existingBeer.alcoholContent,
      new: newBeerData.alcoholContent,
      match: Math.abs(normalizeAlcoholContent(existingBeer.alcoholContent) - normalizeAlcoholContent(newBeerData.alcoholContent)) <= 0.5
    });
  }
  
  if (existingBeer.beerType && newBeerData.beerType) {
    criteria.push({
      field: 'beerType',
      existing: existingBeer.beerType,
      new: newBeerData.beerType,
      similarity: calculateTextSimilarity(normalizeText(existingBeer.beerType), normalizeText(newBeerData.beerType))
    });
  }
  
  if (existingBeer.volume && newBeerData.volume) {
    criteria.push({
      field: 'volume',
      existing: existingBeer.volume,
      new: newBeerData.volume,
      match: normalizeVolume(existingBeer.volume) === normalizeVolume(newBeerData.volume)
    });
  }
  
  return criteria;
}

module.exports = {
  validateImage,
  findOrCreateBrewery,
  findOrCreateBeer
};
