// Modulo GeminiAI: interfaccia per validazione e analisi immagini tramite API Gemini
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { GoogleAuth } = require('google-auth-library');
const { GEMINI_API_KEY } = require('../../config/config');
const Review = require('../models/Review');
const Brewery = require('../models/Brewery');
const Beer = require('../models/Beer');
const logWithFileName = require('./logger');
const logger = logWithFileName(__filename);

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
exports.validateImage = async function(image, reviewId = null, userId = null, sessionId = null) {
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
    
    const prompt = `Analizza COMPLETAMENTE questa immagine per determinare se contiene prodotti birrari e estrarre TUTTE le informazioni possibili. Se le informazioni dall'etichetta sono incomplete, effettua ricerche web per completare i dati mancanti.

FASE 1 - VALIDAZIONE CONTENUTO:
Determina se l'immagine contiene bottiglie di birra, lattine, o altri prodotti birrari chiaramente identificabili.

FASE 2 - ESTRAZIONE INFORMAZIONI PRODOTTI:
Per ogni prodotto birrario identificato, estrai dall'etichetta:
- Nome completo della birra (dall'etichetta)
- Nome del birrificio/brewery
- Gradazione alcolica (% vol, ABV)
- Tipologia/stile birrario (IPA, Lager, Stout, Weizen, Pilsner, etc.)
- Volume della confezione (ml, cl, l)
- Anno di produzione/scadenza se visibile
- Descrizioni o claim presenti sulle etichette
- Colore della birra se visibile
- Ingredienti se elencati
- Certificazioni (biologico, artigianale, DOP, etc.)
- Note di degustazione se presenti
- Prezzo se visibile

FASE 3 - RICERCA WEB INTEGRATIVA:
Se hai identificato il nome della birra e/o del birrificio ma alcune informazioni sono mancanti o illeggibili, effettua una ricerca web per completare:
- Dati tecnici della birra (ABV, IBU, stile, ingredienti specifici)
- Informazioni complete del birrificio (indirizzo, contatti, storia)
- Note di degustazione ufficiali o recensioni
- Certificazioni e premi ricevuti
- Informazioni nutrizionali se disponibili
- Prezzo medio di mercato
- Disponibilità geografica

FASE 4 - ESTRAZIONE INFORMAZIONI BIRRIFICIO:
Identifica dall'etichetta e integra con ricerca web:
- Nome completo del birrificio
- Logo o caratteristiche distintive del brand
- Indirizzo completo (via, città, provincia, CAP, nazione)
- Sito web ufficiale
- Social media ufficiali (Facebook, Instagram, Twitter)
- Contatti (email, telefono)
- Anno di fondazione
- Descrizione o mission aziendale
- Numero di dipendenti se disponibile
- Codici fiscali o partite IVA se leggibili
- Storia e background del birrificio
- Altri prodotti principali

FASE 5 - ANALISI QUALITATIVA E VERIFICA:
- Qualità dell'immagine (ottima/buona/discreta/scarsa)
- Leggibilità delle etichette
- Completezza delle informazioni estratte
- Livello di confidenza per ogni informazione
- Distinzione tra informazioni dall'etichetta vs ricerca web
- Verifica coerenza tra dati etichetta e dati web

Rispondi ESCLUSIVAMENTE in formato JSON valido con questa struttura completa:
{
  "success": true/false,
  "message": "descrizione dettagliata del risultato dell'analisi completa",
  "imageQuality": "ottima/buona/discreta/scarsa",
  "analysisComplete": true/false,
  "overallConfidence": 0.95,
  "webSearchPerformed": true/false,
  "dataSourceSummary": {
    "fromLabel": ["campo1", "campo2"],
    "fromWebSearch": ["campo3", "campo4"],
    "notAvailable": ["campo5"]
  },
  
  "bottles": [
    {
      "bottleLabel": "nome completo della birra dall'etichetta",
      "breweryName": "nome del birrificio/brewery",
      "alcoholContent": "gradazione alcolica con unità (es: 5.2% vol)",
      "ibu": "International Bitterness Units se disponibile",
      "beerType": "tipologia specifica (es: American IPA, Czech Pilsner, Imperial Stout)",
      "beerSubStyle": "sottocategoria più specifica se disponibile",
      "volume": "volume con unità (es: 330ml, 0.5l)",
      "productionYear": "anno se visibile",
      "description": "descrizione completa o claim dall'etichetta e web",
      "beerColor": "colore della birra (chiaro/ambrato/scuro/nero)",
      "ingredients": "ingredienti principali e speciali",
      "certifications": ["biologico", "artigianale", "DOP", "premi ricevuti"],
      "tastingNotes": "note di degustazione ufficiali o da recensioni",
      "nutritionalInfo": "informazioni nutrizionali se disponibili",
      "price": "prezzo se visibile o prezzo medio di mercato",
      "availability": "disponibilità geografica se nota",
      "confidence": 0.95,
      "dataSource": "label+web/label/web",
      "additionalInfo": "altre informazioni rilevanti dal packaging o web"
    }
  ],
  
  "brewery": {
    "breweryName": "nome completo birrificio",
    "foundingYear": "anno di fondazione se disponibile",
    "breweryDescription": "descrizione completa o mission aziendale",
    "breweryLegalAddress": "indirizzo completo sede legale",
    "breweryProductionAddress": "indirizzo stabilimento produttivo se diverso",
    "breweryPhoneNumber": "telefono principale",
    "breweryEmail": "email principale se disponibile",
    "breweryWebsite": "sito web ufficiale",
    "breweryLogo": "descrizione dettagliata del logo/brand",
    "brewerySocialMedia": {
      "facebook": "pagina Facebook ufficiale",
      "instagram": "account Instagram ufficiale",
      "twitter": "account Twitter ufficiale",
      "linkedin": "profilo LinkedIn aziendale",
      "youtube": "canale YouTube se presente"
    },
    "fiscalCodes": "codici fiscali/partite IVA/numeri registrazione",
    "brewerySize": "dimensione (microbirrificio/birrificio artigianale/industriale)",
    "employeeCount": "numero approssimativo dipendenti se disponibile",
    "productionVolume": "volume produzione annuo se disponibile",
    "mainProducts": ["lista dei prodotti principali"],
    "awards": ["premi e riconoscimenti ricevuti"],
    "distributionArea": "area di distribuzione principale",
    "breweryHistory": "breve storia e background",
    "masterBrewer": "nome mastro birraio se disponibile",
    "confidence": 0.90,
    "dataSource": "label+web/label/web"
  },
  
  "extractionDetails": {
    "totalProductsFound": 2,
    "readabilityScore": "alta/media/bassa",
    "webSearchQueries": ["query utilizzate per ricerca web"],
    "missingInformation": ["informazioni non disponibili neanche via web"],
    "technicalNotes": "note tecniche sull'estrazione e ricerca",
    "processingTime": "tempo stimato per analisi completa"
  }
}

REGOLE CRITICHE:
- Se l'immagine NON contiene chiaramente prodotti birrari: success = false, bottles = [], brewery = null
- Se contiene birre: success = true e compila tutti i campi possibili
- UTILIZZA LA RICERCA WEB solo se hai identificato almeno il nome della birra o del birrificio
- Non inventare MAI informazioni: usa null per campi non disponibili
- Distingui chiaramente tra informazioni dall'etichetta e dalla ricerca web
- La confidence deve riflettere la fonte: etichetta=alta, web=media-alta, inferenza=bassa
- Sii preciso nel riconoscimento di marchi, nomi e dettagli specifici
- analysisComplete = true solo se hai estratto informazioni sostanziali
- webSearchPerformed = true solo se hai effettivamente fatto ricerche
- Per ogni informazione, indica chiaramente la fonte nel campo dataSource
- Verifica sempre la coerenza tra dati dell'etichetta e dati web
- Se trovi discrepanze, privilegia i dati dell'etichetta e annota le differenze`;
    
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
    
    logger.info('[GeminiAI] Generazione contenuto in corso...');

    const result = await model.generateContent([prompt, ...imageParts]);
    const response = await result.response;
    const text = response.text();

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

    // Salva i risultati su MongoDB se l'analisi ha avuto successo
    if (aiResult.success && (aiResult.bottles?.length > 0 || aiResult.brewery)) {
      try {
        await saveAnalysisResults(aiResult, reviewId, userId, sessionId);
        logger.info('[GeminiAI] Risultati salvati su MongoDB', { reviewId, sessionId });
      } catch (saveError) {
        logger.error('[GeminiAI] Errore salvataggio MongoDB', { error: saveError.message, reviewId });
      }
    }
    
    return aiResult;
    
  } catch (err) {
    logger.error('[GeminiAI] Errore durante analisi', { 
      error: err.message || 'Errore sconosciuto',
      type: err.constructor?.name,
      reviewId
    });
    
    return { 
      success: false, 
      message: 'Errore durante l\'analisi dell\'immagine: ' + (err.message || 'Errore sconosciuto') 
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
      for (const bottle of aiResult.bottles) {
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
  validateImage: exports.validateImage,
  findOrCreateBrewery,
  findOrCreateBeer
};

// Aggiungiamo le funzioni anche come exports per compatibilità
exports.validateImage = async function(image, reviewId = null, userId = null, sessionId = null) {
  try {
    return await analyzeImage(image, reviewId, userId, sessionId);
  } catch (error) {
    logger.error('[GeminiAI] Errore validateImage wrapper', { error: error.message });
    throw error;
  }
};

exports.findOrCreateBeer = findOrCreateBeer;
exports.findOrCreateBrewery = findOrCreateBrewery;
