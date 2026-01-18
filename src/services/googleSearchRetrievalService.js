/**
 * GoogleSearchRetrievalService - Servizio per ricerca informazioni birrifici/birre via Google Search Retrieval
 * 
 * Utilizza Gemini AI con la funzionalità googleSearchRetrieval per ottenere informazioni
 * verificate e reali da fonti web autorevoli PRIMA di ricorrere al web scraping.
 * 
 * FLUSSO: DB check → Google Search Retrieval → Web Scraping (fallback)
 * 
 * @module googleSearchRetrievalService
 * @created 23 Gennaio 2025
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');
const { GEMINI_API_KEY } = require('../../config/config');
const { GEMINI_MODEL_CONFIG, ANALYSIS_CONFIG } = require('../../config/aiPrompts');
const logWithFileName = require('../utils/logger');
const logger = logWithFileName(__filename);

// Inizializza Gemini AI
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

// ============================================================================
// RATE LIMITER - 1000 chiamate al giorno per Google Search Retrieval
// ============================================================================
const DAILY_LIMIT = 1000;

// Stato del rate limiter (reset automatico a mezzanotte)
const rateLimiter = {
  count: 0,
  date: new Date().toDateString(),
  
  /**
   * Verifica se una chiamata è permessa e incrementa il contatore
   * @returns {Object} - { allowed: boolean, remaining: number, resetTime: string }
   */
  checkAndIncrement() {
    const today = new Date().toDateString();
    
    // Reset automatico se è un nuovo giorno
    if (this.date !== today) {
      logger.info(`[RateLimiter] 🔄 Reset contatore giornaliero (nuovo giorno: ${today})`);
      this.count = 0;
      this.date = today;
    }
    
    // Calcola ora del prossimo reset (mezzanotte)
    const now = new Date();
    const midnight = new Date(now);
    midnight.setHours(24, 0, 0, 0);
    const resetTime = midnight.toISOString();
    
    // Verifica limite
    if (this.count >= DAILY_LIMIT) {
      logger.warn(`[RateLimiter] ⚠️ Limite giornaliero raggiunto: ${this.count}/${DAILY_LIMIT} chiamate`, {
        resetTime,
        currentDate: today
      });
      return {
        allowed: false,
        remaining: 0,
        resetTime,
        limit: DAILY_LIMIT,
        current: this.count
      };
    }
    
    // Incrementa e permetti
    this.count++;
    const remaining = DAILY_LIMIT - this.count;
    
    // Log ogni 100 chiamate o quando si avvicina al limite
    if (this.count % 100 === 0 || remaining <= 50) {
      logger.info(`[RateLimiter] 📊 Chiamate oggi: ${this.count}/${DAILY_LIMIT} (rimanenti: ${remaining})`);
    }
    
    return {
      allowed: true,
      remaining,
      resetTime,
      limit: DAILY_LIMIT,
      current: this.count
    };
  },
  
  /**
   * Ottieni statistiche correnti senza incrementare
   * @returns {Object} - Statistiche rate limiter
   */
  getStats() {
    const today = new Date().toDateString();
    if (this.date !== today) {
      return { count: 0, date: today, limit: DAILY_LIMIT, remaining: DAILY_LIMIT };
    }
    return { 
      count: this.count, 
      date: this.date, 
      limit: DAILY_LIMIT, 
      remaining: DAILY_LIMIT - this.count 
    };
  }
};

/**
 * Helper per parsing JSON robusto dalla risposta Gemini
 * Gestisce vari formati di risposta e errori comuni
 * @param {string} text - Testo da parsare
 * @returns {Object} - JSON parsato
 */
function parseGeminiJsonResponse(text) {
  let cleanedText = text.trim();
  
  // DEBUG: Log input originale
  logger.debug('[GoogleSearchRetrieval] parseGeminiJsonResponse INPUT:', {
    inputLength: cleanedText.length,
    first100chars: cleanedText.substring(0, 100),
    last100chars: cleanedText.substring(Math.max(0, cleanedText.length - 100))
  });
  
  // Rimuovi markdown code blocks iniziali
  if (cleanedText.startsWith('```json')) {
    cleanedText = cleanedText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
  } else if (cleanedText.startsWith('```')) {
    cleanedText = cleanedText.replace(/^```\s*/, '').replace(/\s*```$/, '');
  }
  
  // Rimuovi caratteri di controllo non validi in JSON
  cleanedText = cleanedText.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  
  // IMPORTANTE: Rimuovi citazioni Gemini [cite: X, Y, Z] che rompono il JSON
  // Pattern: [cite: seguito da numeri separati da virgole e spazi, chiuso da ]
  // Es: "foundingYear": 1846 [cite: 1, 3, 4, 5, 24, 30], --> "foundingYear": 1846,
  // Es: "website": "www.example.com [cite: 4, 35]" --> "website": "www.example.com"
  cleanedText = cleanedText.replace(/\s*\[cite:\s*[\d,\s]+\]/g, '');
  
  // FIX CRITICO: Rimuovi l'array "sources" PRIMA del parsing
  // L'array sources contiene URL di Google Grounding che spesso sono TRONCATI
  // e causano errore "Unterminated string in JSON"
  // Dato che rimuoviamo sources dalla risposta finale, possiamo eliminarlo ora
  const sourcesMatch = cleanedText.match(/"sources"\s*:\s*\[/);
  if (sourcesMatch) {
    const sourcesStart = sourcesMatch.index;
    // Prendi tutto PRIMA di "sources":
    let cleanBeforeSources = cleanedText.substring(0, sourcesStart);
    // Rimuovi l'eventuale virgola finale prima di sources
    cleanBeforeSources = cleanBeforeSources.replace(/,\s*$/, '');
    
    // Conta le parentesi graffe per bilanciare il JSON
    let openBraces = 0;
    let closeBraces = 0;
    for (const char of cleanBeforeSources) {
      if (char === '{') openBraces++;
      else if (char === '}') closeBraces++;
    }
    const missingBraces = openBraces - closeBraces;
    
    // Aggiungi le parentesi mancanti
    if (missingBraces > 0) {
      cleanBeforeSources = cleanBeforeSources.trim() + '}'.repeat(missingBraces);
      logger.debug('[GoogleSearchRetrieval] Aggiunte', missingBraces, 'parentesi } mancanti');
    }
    
    logger.debug('[GoogleSearchRetrieval] Rimosso array sources troncato - lunghezza prima:', cleanedText.length, ', dopo:', cleanBeforeSources.length);
    cleanedText = cleanBeforeSources;
  }
  
  // BACKUP FIX: Gemini a volte restituisce JSON duplicato senza marker ```json
  // Il pattern tipico è: URL troncato seguito direttamente da {"found":
  // Cerchiamo se c'è un secondo blocco JSON {"found": dopo il primo
  const duplicateJsonPattern = /\{"found":\s*(?:true|false)/g;
  const jsonMatches = [];
  let match;
  while ((match = duplicateJsonPattern.exec(cleanedText)) !== null) {
    jsonMatches.push(match.index);
  }
  
  // Se ci sono 2+ occorrenze di {"found":, usiamo solo il SECONDO (quello completo)
  if (jsonMatches.length >= 2) {
    logger.debug('[GoogleSearchRetrieval] Rilevato JSON duplicato - trovate', jsonMatches.length, 'occorrenze di {"found":');
    logger.debug('[GoogleSearchRetrieval] Posizioni:', jsonMatches);
    
    // Usa il secondo JSON che è tipicamente quello completo
    const secondJsonStart = jsonMatches[1];
    cleanedText = cleanedText.substring(secondJsonStart).trim();
    
    // Rimuovi eventuale ``` finale
    if (cleanedText.endsWith('```')) {
      cleanedText = cleanedText.slice(0, -3).trim();
    }
    
    logger.debug('[GoogleSearchRetrieval] Usando secondo JSON da posizione', secondJsonStart, '- nuova lunghezza:', cleanedText.length);
  }
  
  // IMPORTANTE: Gestione JSON duplicato di Gemini con marker ```json
  // Gemini a volte restituisce testo introduttivo + ```json{ + JSON completo
  // MA attenzione: gli URL di Google Grounding possono contenere ```json come parte del path!
  // Quindi cerchiamo SOLO se ```json appare:
  // 1. All'inizio della risposta (posizione < 500) - probabile marker di codice
  // 2. Preceduto da newline o spazi (non parte di URL)
  
  // Pattern che cerca ```json NON preceduto da caratteri URL (/, =, -)
  const safeJsonMarkerPattern = /(?<![\/=\-a-zA-Z0-9])```json\s*\{/;
  const duplicateMatch = cleanedText.match(safeJsonMarkerPattern);
  
  // Verifica aggiuntiva: se il match è dentro un URL (grounding-api-redirect), ignora
  if (duplicateMatch && duplicateMatch.index > 0) {
    const contextBefore = cleanedText.substring(Math.max(0, duplicateMatch.index - 100), duplicateMatch.index);
    const isInsideUrl = contextBefore.includes('grounding-api-redirect') || 
                        contextBefore.includes('vertexaisearch') ||
                        contextBefore.includes('://');
    
    if (!isInsideUrl) {
      logger.debug('[GoogleSearchRetrieval] Rilevato JSON duplicato a posizione:', duplicateMatch.index);
      
      // Estrai tutto dal { che segue ```json fino alla fine
      const afterMarkerIndex = cleanedText.indexOf('{', duplicateMatch.index);
      const potentialJson = cleanedText.substring(afterMarkerIndex).trim();
      
      // Rimuovi eventuale ``` finale
      let extractedJson = potentialJson;
      if (extractedJson.endsWith('```')) {
        extractedJson = extractedJson.slice(0, -3).trim();
      }
      
      // Verifica che abbiamo estratto qualcosa di valido (non vuoto, inizia con {)
      if (extractedJson.length > 10 && extractedJson.startsWith('{')) {
        logger.debug('[GoogleSearchRetrieval] Uso JSON estratto dal duplicato, lunghezza:', extractedJson.length);
        cleanedText = extractedJson;
      } else {
        logger.debug('[GoogleSearchRetrieval] JSON estratto non valido, continuo con originale');
      }
    } else {
      logger.debug('[GoogleSearchRetrieval] Ignorato ```json dentro URL di grounding');
    }
  }
  
  // DEBUG: Log dopo pulizia
  logger.debug('[GoogleSearchRetrieval] Dopo pulizia:', {
    cleanedLength: cleanedText.length,
    startsWithBrace: cleanedText.startsWith('{'),
    first50: cleanedText.substring(0, 50)
  });
  
  // IMPORTANTE: Gli URL di Google Grounding a volte contengono ```json come parte del path
  // Questo rompe il parsing JSON. Rimuoviamo questi pattern dagli URL prima del parsing.
  // Pattern: trova URL che contengono ```json e rimuovi la parte ```json
  cleanedText = cleanedText.replace(/(grounding-api-redirect\/[^"]*?)```json([^"]*?")/g, '$1$2');
  
  // Prima prova: parsing diretto
  try {
    return JSON.parse(cleanedText);
  } catch (firstError) {
    logger.debug('[GoogleSearchRetrieval] Primo tentativo parsing fallito, applico pulizia avanzata...');
  }
  
  // Seconda prova: rimuovi trailing commas negli array e oggetti
  let fixedText = cleanedText
    .replace(/,\s*]/g, ']')  // Rimuovi virgole prima di ]
    .replace(/,\s*}/g, '}'); // Rimuovi virgole prima di }
  
  try {
    return JSON.parse(fixedText);
  } catch (secondError) {
    logger.debug('[GoogleSearchRetrieval] Secondo tentativo fallito, provo estrazione JSON...');
  }
  
  // Terza prova: estrai il primo oggetto JSON completo usando bracket matching
  let depth = 0;
  let start = -1;
  let end = -1;
  
  for (let i = 0; i < cleanedText.length; i++) {
    const char = cleanedText[i];
    if (char === '{') {
      if (depth === 0) start = i;
      depth++;
    } else if (char === '}') {
      depth--;
      if (depth === 0 && start !== -1) {
        end = i + 1;
        break;
      }
    }
  }
  
  if (start !== -1 && end !== -1) {
    let extracted = cleanedText.substring(start, end)
      .replace(/,\s*]/g, ']')
      .replace(/,\s*}/g, '}');
    
    try {
      return JSON.parse(extracted);
    } catch (thirdError) {
      logger.debug('[GoogleSearchRetrieval] Terzo tentativo fallito, provo escape newlines...');
    }
  }
  
  // Quarta prova: escape dei newline nelle stringhe
  let escapedText = cleanedText.replace(/"([^"\\]*(\\.[^"\\]*)*)"/g, (match) => {
    return match.replace(/\n/g, ' ').replace(/\r/g, '');
  });
  escapedText = escapedText
    .replace(/,\s*]/g, ']')
    .replace(/,\s*}/g, '}');
  
  try {
    return JSON.parse(escapedText);
  } catch (fourthError) {
    // Trova la posizione esatta dell'errore
    const errorMatch = fourthError.message.match(/position (\d+)/);
    const errorPos = errorMatch ? parseInt(errorMatch[1]) : null;
    
    // Log del testo problematico con contesto attorno all'errore
    logger.error('[GoogleSearchRetrieval] ❌ Impossibile parsare JSON', {
      textPreview: cleanedText.substring(0, 500),
      textLength: cleanedText.length,
      errorPosition: errorPos,
      contextAroundError: errorPos ? cleanedText.substring(Math.max(0, errorPos - 100), errorPos + 100) : 'N/A'
    });
    
    // Scrivi il JSON completo su file per debugging
    const fs = require('fs');
    const debugPath = require('path').join(__dirname, '../../logs/debug-gemini-response.json');
    try {
      fs.writeFileSync(debugPath, cleanedText, 'utf8');
      logger.debug(`[GoogleSearchRetrieval] JSON completo scritto in: ${debugPath}`);
    } catch (writeErr) {
      logger.warn('[GoogleSearchRetrieval] Impossibile scrivere file debug');
    }
    
    throw new Error(`JSON parsing failed: ${fourthError.message}`);
  }
}

/**
 * Cerca informazioni complete su un birrificio usando Google Search Retrieval
 * @param {string} breweryName - Nome del birrificio da cercare
 * @param {string} [beerName] - Nome della birra (opzionale, per contesto)
 * @returns {Promise<Object>} - Dati birrificio o null se non trovato
 */
async function searchBreweryInfo(breweryName, beerName = null) {
  if (!breweryName || typeof breweryName !== 'string' || breweryName.trim().length === 0) {
    logger.warn('[GoogleSearchRetrieval] ❌ Nome birrificio non valido');
    return null;
  }

  // FIX MULTILINGUA: Usa termini in italiano E inglese per trovare birrifici internazionali
  // Es: "Duvel Moortgat" è belga - "birrificio" non funziona, ma "brewery" sì
  const searchContext = beerName 
    ? `brewery birrificio "${breweryName}" beer "${beerName}" official website`
    : `brewery birrificio "${breweryName}" official website sito ufficiale`;

  logger.info(`[GoogleSearchRetrieval] 🔍 Ricerca birrificio (multilingua): ${searchContext}`);

  const prompt = `
Sei un esperto di birrifici italiani e internazionali. Devi trovare informazioni REALI e VERIFICATE sul birrificio/brewery "${breweryName}"${beerName ? ` che produce la birra "${beerName}"` : ''}.

🇮🇹 LINGUA: Rispondi SEMPRE in lingua italiana. Tutte le descrizioni, note e testi devono essere in italiano.

REGOLE CRITICHE ANTI-ALLUCINAZIONI:
1. CERCA SOLO informazioni che puoi VERIFICARE tramite fonti web reali
2. NON inventare MAI dati che non trovi online
3. Se un campo non è trovabile con certezza, usa null
4. Verifica che il sito web sia REALMENTE esistente e appartenga al birrificio
5. L'indirizzo deve essere COMPLETO (via, numero civico, CAP, città, provincia)
6. NON costruire URL basandoti su pattern - cerca il sito REALE

RICERCA DATI FISCALI - DOVE CERCARLI:
- Partita IVA: footer sito, pagina contatti, chi siamo, privacy policy - formato IT + 11 cifre (es. IT12345678901)
- Codice REA: iscrizione Camera Commercio - formato sigla provincia + numero (es. BI-123456)
- Codice Accise: specifico per birrifici, spesso indicato insieme alla P.IVA
- PEC: pagina contatti, dati societari - formato xxx@pec.it
- Forma giuridica: ragione sociale completa (SRL, SPA, SNC, SRLS, Ditta Individuale, Cooperativa)

RICERCA SOCIAL MEDIA - DOVE CERCARLI:
- Cerca icone social nel footer o header del sito ufficiale
- Verifica che i profili siano UFFICIALI del birrificio (non fan page)
- Facebook, Instagram, Twitter/X, LinkedIn, YouTube

RICERCA LOGO BIRRIFICIO - DOVE CERCARLO:
- Header o navbar del sito ufficiale (spesso in alto a sinistra)
- Footer del sito
- Pagina "Chi siamo" / "About"
- Cerca immagini PNG/SVG con il nome del birrificio
- L'URL deve essere DIRETTO all'immagine (terminare con .png, .jpg, .svg, .webp)
- Se il logo è inline/base64 o non hai URL diretto, usa null

Restituisci un JSON con questa struttura esatta:
{
  "found": true/false,
  "confidence": 0.0-1.0,
  "brewery": {
    "breweryName": "Nome ufficiale birrificio",
    "breweryLogo": "URL DIRETTO al logo (.png/.jpg/.svg/.webp) o null",
    "breweryWebsite": "URL sito ufficiale (VERIFICATO) o null",
    "breweryLegalAddress": "Indirizzo COMPLETO o null",
    "breweryEmail": "Email ufficiale o null",
    "breweryPhoneNumber": "Telefono o null",
    "breweryDescription": "Descrizione breve o null",
    "foundingYear": numero o null,
    "brewerySize": "micro/small/medium/large o null",
    "productionVolume": "Volume produzione o null",
    "mainProducts": ["Lista birre principali"] o [],
    "awards": ["Premi ricevuti"] o [],
    "brewerySocialMedia": {
      "facebook": "URL pagina Facebook ufficiale o null",
      "instagram": "URL profilo Instagram ufficiale o null",
      "twitter": "URL profilo Twitter/X ufficiale o null",
      "linkedin": "URL pagina LinkedIn ufficiale o null",
      "youtube": "URL canale YouTube ufficiale o null"
    },
    "breweryHistory": "Storia breve o null",
    "breweryFiscalCode": "Partita IVA/CF formato IT12345678901 o null",
    "reaCode": "Codice REA formato XX-123456 o null",
    "acciseCode": "Codice Accise birrificio o null",
    "pecEmail": "Email PEC certificata o null",
    "legalForm": "Forma giuridica (SRL, SPA, SNC, ecc.) o null",
    "shareCapital": "Capitale sociale (es. 10.000€) o null"
  },
  "sources": ["Lista delle fonti usate"]
}

Se NON trovi informazioni affidabili, restituisci:
{
  "found": false,
  "confidence": 0.0,
  "brewery": null,
  "reason": "Motivo per cui non hai trovato dati"
}
`;

  try {
    const model = genAI.getGenerativeModel({
      model: GEMINI_MODEL_CONFIG.searchRetrievalModel,
      generationConfig: {
        temperature: ANALYSIS_CONFIG.googleSearchRetrieval.temperature,
        maxOutputTokens: 2048,
      },
      tools: [{ googleSearch: {} }]
    });

    logger.info(`[GoogleSearchRetrieval] 📤 Invio query a Gemini ${GEMINI_MODEL_CONFIG.searchRetrievalModel} con Google Search Retrieval...`);

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // Usa helper per parsing JSON robusto
    const data = parseGeminiJsonResponse(text);

    // Estrai metadata grounding se disponibili
    const groundingMetadata = response.candidates?.[0]?.groundingMetadata;
    if (groundingMetadata) {
      logger.info('[GoogleSearchRetrieval] ✅ Grounding metadata ricevuti', {
        hasSearchQueries: !!groundingMetadata.webSearchQueries,
        hasGroundingChunks: !!groundingMetadata.groundingChunks,
        queriesCount: groundingMetadata.webSearchQueries?.length || 0
      });
    }

    if (data.found && data.confidence >= ANALYSIS_CONFIG.googleSearchRetrieval.minConfidence) {
      // 🔧 FIX: Valida che breweryLogo non sia un URL di grounding redirect (allucinazione AI)
      // Gli URL di grounding sono redirect interni di Vertex AI che NON sono immagini valide
      if (data.brewery?.breweryLogo && 
          (data.brewery.breweryLogo.includes('grounding-api-redirect') || 
           data.brewery.breweryLogo.includes('vertexaisearch.cloud.google.com'))) {
        logger.warn('[GoogleSearchRetrieval] ⚠️ Logo URL è un redirect grounding (allucinazione), impostato a null', {
          invalidUrl: data.brewery.breweryLogo.substring(0, 80) + '...',
          breweryName: data.brewery?.breweryName
        });
        data.brewery.breweryLogo = null;
      }
      
      logger.info(`[GoogleSearchRetrieval] ✅ Birrificio trovato: ${data.brewery?.breweryName}`, {
        confidence: data.confidence,
        hasLogo: !!data.brewery?.breweryLogo,
        hasWebsite: !!data.brewery?.breweryWebsite,
        hasAddress: !!data.brewery?.breweryLegalAddress,
        hasEmail: !!data.brewery?.breweryEmail,
        hasFiscalCode: !!data.brewery?.breweryFiscalCode,
        hasREA: !!data.brewery?.reaCode,
        hasAccise: !!data.brewery?.acciseCode,
        hasPEC: !!data.brewery?.pecEmail,
        hasSocial: !!(data.brewery?.brewerySocialMedia?.facebook || data.brewery?.brewerySocialMedia?.instagram),
        sourcesCount: data.sources?.length || 0
      });
      return {
        success: true,
        source: 'google_search_retrieval',
        confidence: data.confidence,
        brewery: data.brewery,
        groundingMetadata
      };
    } else {
      logger.info(`[GoogleSearchRetrieval] ℹ️ Birrificio non trovato o confidence troppo bassa`, {
        found: data.found,
        confidence: data.confidence,
        reason: data.reason || 'Confidence sotto soglia'
      });
      return null;
    }
  } catch (error) {
    logger.error(`[GoogleSearchRetrieval] ❌ Errore ricerca birrificio: ${error.message}`, {
      breweryName,
      errorStack: error.stack
    });
    return null;
  }
}

/**
 * Cerca informazioni complete su una birra usando Google Search Retrieval
 * @param {string} beerName - Nome della birra da cercare
 * @param {string} [breweryName] - Nome del birrificio (opzionale, per contesto)
 * @returns {Promise<Object>} - Dati birra o null se non trovata
 */
async function searchBeerInfo(beerName, breweryName = null) {
  if (!beerName || typeof beerName !== 'string' || beerName.trim().length === 0) {
    logger.warn('[GoogleSearchRetrieval] ❌ Nome birra non valido');
    return null;
  }

  const searchContext = breweryName 
    ? `birra "${beerName}" del birrificio "${breweryName}"`
    : `birra "${beerName}"`;

  logger.info(`[GoogleSearchRetrieval] 🍺 Ricerca birra: ${searchContext}`);

  const prompt = `
Sei un esperto di birre artigianali. Devi trovare informazioni REALI e VERIFICATE sulla ${searchContext}.

🇮🇹 LINGUA: Rispondi SEMPRE in lingua italiana. Tutte le descrizioni, note di degustazione e testi devono essere in italiano.

REGOLE CRITICHE ANTI-ALLUCINAZIONI:
1. CERCA SOLO informazioni che puoi VERIFICARE tramite fonti web reali
2. NON inventare MAI dati che non trovi online (ABV, IBU, ingredienti, ecc.)
3. Se un campo non è trovabile con certezza, usa null
4. La gradazione alcolica DEVE essere un numero verificato dal produttore
5. Gli ingredienti devono essere quelli DICHIARATI dal birrificio

Restituisci un JSON con questa struttura esatta:
{
  "found": true/false,
  "confidence": 0.0-1.0,
  "beer": {
    "beerName": "Nome ufficiale birra",
    "beerType": "Stile birra (es: IPA, Lager, Stout)",
    "beerSubType": "Sottostile specifico o null",
    "alcoholContent": numero (es: 5.2) o null,
    "ibu": numero o null,
    "volume": "Volume standard (es: 330ml, 750ml) o null",
    "ingredients": ["Lista ingredienti"] o [],
    "description": "Descrizione ufficiale o null",
    "tastingNotes": {
      "appearance": "Note aspetto o null",
      "aroma": "Note aroma o null",
      "taste": "Note gusto o null"
    },
    "servingTemperature": "Temperatura servizio o null",
    "pairings": ["Abbinamenti consigliati"] o [],
    "awards": ["Premi ricevuti"] o []
  },
  "sources": ["Lista delle fonti usate"]
}

Se NON trovi informazioni affidabili, restituisci:
{
  "found": false,
  "confidence": 0.0,
  "beer": null,
  "reason": "Motivo per cui non hai trovato dati"
}
`;

  try {
    const model = genAI.getGenerativeModel({
      model: GEMINI_MODEL_CONFIG.searchRetrievalModel,
      generationConfig: {
        temperature: ANALYSIS_CONFIG.googleSearchRetrieval.temperature,
        maxOutputTokens: 2048,
      },
      tools: [{ googleSearch: {} }]
    });

    logger.info(`[GoogleSearchRetrieval] 📤 Invio query birra a Gemini con Google Search...`);

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // Usa helper per parsing JSON robusto
    const data = parseGeminiJsonResponse(text);

    // Estrai metadata grounding
    const groundingMetadata = response.candidates?.[0]?.groundingMetadata;

    if (data.found && data.confidence >= ANALYSIS_CONFIG.googleSearchRetrieval.minConfidence) {
      logger.info(`[GoogleSearchRetrieval] ✅ Birra trovata: ${data.beer?.beerName}`, {
        confidence: data.confidence,
        beerType: data.beer?.beerType,
        abv: data.beer?.alcoholContent,
        sourcesCount: data.sources?.length || 0
      });
      return {
        success: true,
        source: 'google_search_retrieval',
        confidence: data.confidence,
        beer: data.beer,
        groundingMetadata
      };
    } else {
      logger.info(`[GoogleSearchRetrieval] ℹ️ Birra non trovata o confidence troppo bassa`, {
        found: data.found,
        confidence: data.confidence,
        reason: data.reason || 'Confidence sotto soglia'
      });
      return null;
    }
  } catch (error) {
    logger.error(`[GoogleSearchRetrieval] ❌ Errore ricerca birra: ${error.message}`, {
      beerName,
      breweryName,
      errorStack: error.stack
    });
    return null;
  }
}

/**
 * Cerca informazioni complete su birra E birrificio in una singola chiamata
 * Più efficiente quando servono entrambi i dati
 * @param {string} beerName - Nome della birra
 * @param {string} [breweryName] - Nome del birrificio (se noto)
 * @returns {Promise<Object>} - Dati birra + birrificio o null
 */
async function searchBeerAndBreweryInfo(beerName, breweryName = null) {
  // ===== RATE LIMITER CHECK =====
  const rateCheck = rateLimiter.checkAndIncrement();
  if (!rateCheck.allowed) {
    logger.warn(`[GoogleSearchRetrieval] 🚫 Chiamata bloccata - Limite giornaliero raggiunto (${rateCheck.current}/${rateCheck.limit})`, {
      beerName,
      breweryName,
      resetTime: rateCheck.resetTime
    });
    return {
      success: false,
      rateLimited: true,
      reason: `Limite giornaliero di ${rateCheck.limit} chiamate raggiunto. Reset: ${rateCheck.resetTime}`,
      remaining: 0,
      resetTime: rateCheck.resetTime
    };
  }
  // ===== END RATE LIMITER CHECK =====

  if (!beerName || typeof beerName !== 'string' || beerName.trim().length === 0) {
    logger.warn('[GoogleSearchRetrieval] ❌ Nome birra non valido per ricerca combinata');
    return null;
  }

  const searchContext = breweryName 
    ? `birra "${beerName}" prodotta dal birrificio "${breweryName}"`
    : `birra "${beerName}" e il suo birrificio produttore`;

  logger.info(`[GoogleSearchRetrieval] 🍺🏭 Ricerca combinata: ${searchContext} (chiamate oggi: ${rateCheck.current}/${rateCheck.limit})`);

  const prompt = `
Sei un esperto di birre artigianali italiane e internazionali. Devi trovare informazioni REALI e VERIFICATE sulla ${searchContext}.

🇮🇹 LINGUA: Rispondi SEMPRE in lingua italiana. Tutte le descrizioni, note di degustazione e testi devono essere in italiano.

REGOLE CRITICHE ANTI-ALLUCINAZIONI:
1. CERCA SOLO informazioni che puoi VERIFICARE tramite fonti web reali
2. NON inventare MAI dati che non trovi online
3. Se un campo non è trovabile con certezza, usa null
4. Verifica che i siti web siano REALMENTE esistenti
5. Gli indirizzi devono essere COMPLETI e VERIFICATI
6. I dati tecnici (ABV, IBU) devono provenire dal produttore

RICERCA DATI FISCALI BIRRIFICIO - DOVE CERCARLI:
- Partita IVA: footer sito, pagina contatti, chi siamo, privacy policy - formato IT + 11 cifre (es. IT12345678901)
- Codice REA: iscrizione Camera Commercio - formato sigla provincia + numero (es. BI-123456)
- Codice Accise: specifico per birrifici, autorizzazione produzione birra, spesso indicato con dati fiscali
- PEC: pagina contatti, dati societari - formato xxx@pec.it
- Forma giuridica: ragione sociale completa (SRL, SPA, SNC, SRLS, Ditta Individuale, Cooperativa)
- Capitale sociale: dati societari, visura camerale online

RICERCA SOCIAL MEDIA - DOVE CERCARLI:
- Cerca icone social nel footer o header del sito ufficiale
- Verifica che i profili siano UFFICIALI del birrificio (non fan page)
- Facebook, Instagram, Twitter/X, LinkedIn, YouTube

RICERCA LOGO BIRRIFICIO - DOVE CERCARLO:
- Header o navbar del sito ufficiale (spesso in alto a sinistra)
- Footer del sito
- L'URL deve essere DIRETTO all'immagine (.png, .jpg, .svg, .webp)
- Se il logo è inline/base64 o non hai URL diretto, usa null

Restituisci un JSON con questa struttura esatta:
{
  "found": true/false,
  "confidence": 0.0-1.0,
  "brewery": {
    "breweryName": "Nome ufficiale birrificio",
    "breweryLogo": "URL DIRETTO al logo o null",
    "breweryWebsite": "URL sito ufficiale o null",
    "breweryLegalAddress": "Indirizzo COMPLETO o null",
    "breweryEmail": "Email o null",
    "breweryPhoneNumber": "Telefono o null",
    "breweryDescription": "Descrizione o null",
    "foundingYear": numero o null,
    "brewerySize": "micro/small/medium/large o null",
    "mainProducts": ["Lista birre principali"] o [],
    "brewerySocialMedia": {
      "facebook": "URL pagina Facebook ufficiale o null",
      "instagram": "URL profilo Instagram ufficiale o null",
      "twitter": "URL profilo Twitter/X ufficiale o null",
      "linkedin": "URL pagina LinkedIn ufficiale o null",
      "youtube": "URL canale YouTube ufficiale o null"
    },
    "breweryFiscalCode": "Partita IVA/Codice Fiscale (formato IT12345678901) o null",
    "reaCode": "Codice REA (es. BI-123456) o null",
    "acciseCode": "Codice Accise birrificio o null",
    "pecEmail": "Email PEC o null",
    "legalForm": "Forma giuridica (SRL, SPA, SNC, ecc.) o null",
    "shareCapital": "Capitale sociale (es. 10.000€) o null"
  },
  "beer": {
    "beerName": "Nome ufficiale birra",
    "beerType": "Stile birra",
    "alcoholContent": numero o null,
    "ibu": numero o null,
    "volume": "Volume o null",
    "ingredients": [] o [],
    "description": "Descrizione o null",
    "tastingNotes": {"appearance": null, "aroma": null, "taste": null}
  },
  "sources": ["Lista delle fonti usate"]
}

Se NON trovi informazioni affidabili, restituisci:
{
  "found": false,
  "confidence": 0.0,
  "brewery": null,
  "beer": null,
  "reason": "Motivo"
}
`;

  try {
    const model = genAI.getGenerativeModel({
      model: GEMINI_MODEL_CONFIG.searchRetrievalModel,
      generationConfig: {
        temperature: ANALYSIS_CONFIG.googleSearchRetrieval.temperature,
        maxOutputTokens: 3000,
      },
      tools: [{ googleSearch: {} }]
    });

    logger.info(`[GoogleSearchRetrieval] 📤 Invio query combinata a Gemini con Google Search...`);

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // Usa helper per parsing JSON robusto
    const data = parseGeminiJsonResponse(text);

    // Estrai metadata grounding
    const groundingMetadata = response.candidates?.[0]?.groundingMetadata;
    if (groundingMetadata) {
      logger.info('[GoogleSearchRetrieval] ✅ Grounding metadata per ricerca combinata', {
        queriesCount: groundingMetadata.webSearchQueries?.length || 0,
        chunksCount: groundingMetadata.groundingChunks?.length || 0
      });
    }

    if (data.found && data.confidence >= ANALYSIS_CONFIG.googleSearchRetrieval.minConfidence) {
      logger.info(`[GoogleSearchRetrieval] ✅ Ricerca combinata completata`, {
        confidence: data.confidence,
        breweryFound: !!data.brewery?.breweryName,
        beerFound: !!data.beer?.beerName,
        hasFiscalCode: !!data.brewery?.breweryFiscalCode,
        hasREA: !!data.brewery?.reaCode,
        hasPEC: !!data.brewery?.pecEmail,
        hasSocial: !!(data.brewery?.brewerySocialMedia?.facebook || data.brewery?.brewerySocialMedia?.instagram),
        sourcesCount: data.sources?.length || 0
      });
      return {
        success: true,
        source: 'google_search_retrieval',
        confidence: data.confidence,
        brewery: data.brewery,
        beer: data.beer,
        groundingMetadata
      };
    } else {
      logger.info(`[GoogleSearchRetrieval] ℹ️ Ricerca combinata non ha prodotto risultati sufficienti`, {
        found: data.found,
        confidence: data.confidence,
        reason: data.reason || 'Confidence sotto soglia'
      });
      return null;
    }
  } catch (error) {
    logger.error(`[GoogleSearchRetrieval] ❌ Errore ricerca combinata: ${error.message}`, {
      beerName,
      breweryName,
      errorStack: error.stack
    });
    return null;
  }
}

module.exports = {
  // Funzione principale - ricerca combinata (1 sola chiamata API)
  search: searchBeerAndBreweryInfo,
  searchBeerAndBreweryInfo,
  // Legacy exports (deprecati - usare search per risparmiare chiamate)
  searchBreweryInfo,
  searchBeerInfo,
  // Rate limiter stats (per monitoring)
  getRateLimitStats: () => rateLimiter.getStats()
};
