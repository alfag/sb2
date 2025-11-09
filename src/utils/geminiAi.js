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

/**
 * Deduplica bottiglie identiche nella stessa immagine
 * Se l'AI rileva più bottiglie della stessa birra, crea una sola entry con conteggio
 * 
 * @param {Array} bottles - Array di bottiglie rilevate dall'AI
 * @returns {Object} Risultato con bottles deduplicate e info su duplicati trovati
 */
function deduplicateBottles(bottles) {
  if (!bottles || bottles.length === 0) {
    return {
      bottles: [],
      originalCount: 0,
      duplicatesFound: 0,
      duplicateSummary: []
    };
  }

  const originalCount = bottles.length;
  const bottleMap = new Map(); // Key: beerName|breweryName, Value: bottle object
  const duplicateSummary = [];

  for (const bottle of bottles) {
    // Normalizza i nomi per il confronto (case-insensitive, trim whitespace)
    const beerName = (bottle.beerName || bottle.labelData?.beerName || 'Birra Sconosciuta').trim().toLowerCase();
    const breweryName = (bottle.breweryName || bottle.brewery || bottle.labelData?.breweryName || 'Birrificio Sconosciuto').trim().toLowerCase();
    
    // Crea chiave univoca per identificare la combinazione birra+birrificio
    const uniqueKey = `${beerName}|${breweryName}`;
    
    if (bottleMap.has(uniqueKey)) {
      // Bottiglia duplicata trovata - incrementa il conteggio
      const existingBottle = bottleMap.get(uniqueKey);
      existingBottle.bottleCount = (existingBottle.bottleCount || 1) + 1;
      existingBottle.isDuplicated = true;
      
      // Traccia il duplicato per logging
      const duplicateEntry = duplicateSummary.find(d => d.uniqueKey === uniqueKey);
      if (duplicateEntry) {
        duplicateEntry.count++;
      } else {
        duplicateSummary.push({
          uniqueKey,
          beerName: bottle.beerName || bottle.labelData?.beerName || 'Birra Sconosciuta',
          breweryName: bottle.breweryName || bottle.brewery || bottle.labelData?.breweryName || 'Birrificio Sconosciuto',
          count: 2 // Primo duplicato = 2 bottiglie totali
        });
      }
      
      logger.debug('[GeminiAI] 🔄 Duplicato rilevato', {
        beerName: bottle.beerName || bottle.labelData?.beerName,
        breweryName: bottle.breweryName || bottle.brewery || bottle.labelData?.breweryName,
        newCount: existingBottle.bottleCount
      });
    } else {
      // Prima occorrenza di questa combinazione birra+birrificio
      bottleMap.set(uniqueKey, {
        ...bottle,
        bottleCount: 1, // Inizializza conteggio a 1
        isDuplicated: false
      });
    }
  }

  const deduplicatedBottles = Array.from(bottleMap.values());
  const duplicatesFound = originalCount - deduplicatedBottles.length;

  return {
    bottles: deduplicatedBottles,
    originalCount,
    duplicatesFound,
    duplicateSummary
  };
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
    
    logger.info('[GeminiAI] 📤 Invio analisi ad AI...');

    // Usa retry con backoff per gestire sovraccarichi API
    const { result, response, text } = await retryWithBackoff(async () => {
      const result = await model.generateContent([prompt, ...imageParts]);
      const response = await result.response;
      const text = response.text();
      
      return { result, response, text };
    }, 3, 2000, 'Generazione contenuto AI');

    logger.info('[GeminiAI] 📥 Risposta ricevuta, parsing JSON...');
    
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
    
    // Parsing JSON
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

    // Deduplicazione bottiglie identiche
    const deduplicationResult = deduplicateBottles(aiResult.bottles || []);
    aiResult.bottles = deduplicationResult.bottles;
    aiResult.deduplicationApplied = deduplicationResult.duplicatesFound > 0;
    aiResult.deduplicationInfo = {
      originalBottleCount: deduplicationResult.originalCount,
      duplicatesRemoved: deduplicationResult.duplicatesFound,
      finalBottleCount: deduplicationResult.bottles.length,
      duplicateSummary: deduplicationResult.duplicateSummary
    };

    logger.info('[GeminiAI] Analisi completata con successo', {
      bottlesFound: aiResult.bottles?.length || 0,
      duplicatesRemoved: deduplicationResult.duplicatesFound,
      breweryDetected: !!aiResult.brewery,
      analysisComplete: aiResult.analysisComplete
    });

    return aiResult;
    
  } catch (error) {
    logger.error('[GeminiAI] Errore critico durante analisi immagine:', {
      error: error.message,
      errorType: error.constructor?.name || 'Unknown',
      reviewId,
      userId,
      sessionId,
      stack: error.stack?.substring(0, 500)
    });
    
    // Return fallback per errori critici
    return {
      success: false,
      message: 'Errore durante l\'analisi dell\'immagine: ' + error.message,
      bottles: [],
      brewery: null,
      analysisComplete: false,
      error: {
        type: 'analysis_error',
        message: error.message
      }
    };
  }
}

// Export delle funzioni principali
module.exports = {
  validateImage,
  initializeGeminiAI,
  deduplicateBottles
};