/**
 * Configurazione Prompts per Gemini AI
 * Centralizza tutti i prompt usati nel sistema per facilitare manutenzione e modifiche
 * 
 * @module config/aiPrompts
 */

/**
 * Prompt principale per analisi immagini birre
 * Utilizza approccio step-by-step per garantire accuratezza e ridurre allucinazioni
 */
const IMAGE_ANALYSIS_PROMPT = `Analizza questa immagine seguendo RIGOROSAMENTE questo processo step-by-step per garantire dati ACCURATI e VERIFICATI:

STEP 1 - LETTURA ETICHETTA:
Leggi SOLO ciò che è chiaramente visibile sulle etichette delle bottiglie/lattine:
- Nome della birra (esatto come scritto)
- Nome del birrificio (esatto come scritto) 
- Gradazione alcolica se presente
- Volume se presente
- Stile/tipologia se indicato
- Anno/data se visibile
- Città/paese se indicato
- Ingredienti se elencati
- Altri testi leggibili

STEP 2 - RICERCA WEB VERIFICATA:
PER OGNI birrificio identificato dall'etichetta, effettua ricerca web per verificare:
- Esistenza reale del birrificio
- Sito web ufficiale
- Indirizzo completo verificato
- Storia e informazioni aziendali
- Lista prodotti ufficiali
- Conferma che la birra dell'etichetta è realmente prodotta da questo birrificio

STEP 3 - VERIFICA MATCH DATI:
Confronta i dati etichetta con quelli trovati online:
- Il nome birrificio corrisponde ESATTAMENTE?
- La birra è effettivamente nel catalogo del birrificio?
- I dati tecnici (ABV, stile) sono coerenti?
- L'indirizzo/paese corrisponde a quello dell'etichetta?

STEP 4 - CLASSIFICAZIONE RISULTATO:
Per ogni birrificio/birra, classifica come:
- "VERIFIED": Birrificio reale, dati confermati, birra nel catalogo
- "PARTIAL": Birrificio reale ma alcuni dati non corrispondono
- "UNVERIFIED": Non trovate conferme online dell'esistenza
- "CONFLICTING": Dati etichetta in conflitto con quelli web

STEP 5 - CRITERI COMPLETEZZA E COERENZA:
DATI MINIMI RICHIESTI per readyToSave=true:
- Birrificio: "breweryName" verificato online (usa NOME UFFICIALE esatto dal sito web)
- Birra: "beerName" dall'etichetta (usa TESTO ESATTO visibile)

REGOLE COERENZA DATI:
- Per Birrificio Raffo: usa SEMPRE "Birrificio Raffo" (nome storico ufficiale)
- Per gradazione/volume: usa SOLO dati certi dal sito ufficiale, altrimenti null
- NON variare i nomi tra chiamate diverse - mantieni ESATTA coerenza

DATI OPZIONALI (usa null se incerti):
- alcoholContent, volume, beerStyle, year, location per la birra
- foundingYear, breweryEmail, breweryPhoneNumber per il birrificio

REGOLE ANTI-ALLUCINAZIONI CRITICHE:
1. NON inventare dati se non sei sicuro al 100%
2. Se un campo non è leggibile sull'etichetta E non è verificabile online → null
3. Usa SOLO informazioni da fonti verificabili (sito ufficiale, Wikipedia, database birre affidabili)
4. Se incerto su un campo, lascia null invece di indovinare
5. Restituisci confidence score basato sulla qualità delle fonti trovate
6. Per birrifici famosi/storici (es. Raffo), usa dati ufficiali consolidati

FORMATO OUTPUT:
Restituisci un JSON con questa struttura ESATTA:

{
  "success": true/false,
  "message": "Messaggio descrittivo",
  "imageQuality": "ottima/buona/media/scarsa",
  "totalBottlesFound": numero,
  "analysisSteps": {
    "step1_labelReading": "Descrizione cosa hai letto",
    "step2_webSearch": "Risultati ricerca web",
    "step3_dataMatching": "Confronto dati",
    "step4_verification": "Risultato classificazione"
  },
  "bottles": [
    {
      "id": numero,
      "labelData": {
        "beerName": "Nome esatto dall'etichetta",
        "breweryName": "Nome esatto dall'etichetta",
        "alcoholContent": numero o null,
        "volume": numero o null,
        "beerStyle": "stile" o null,
        "year": numero o null,
        "location": "città, paese" o null,
        "otherText": "Altri testi leggibili"
      },
      "webVerification": {
        "breweryExists": true/false,
        "beerInCatalog": true/false,
        "dataMatch": "VERIFIED/PARTIAL/UNVERIFIED/CONFLICTING",
        "conflictingData": [],
        "searchQueries": ["query1", "query2"],
        "sourcesFound": ["url1", "url2"]
      },
      "verifiedData": {
        "breweryName": "Nome ufficiale verificato",
        "beerName": "Nome birra confermato",
        "alcoholContent": numero o null,
        "beerType": "tipo" o null,
        "volume": numero o null,
        "description": "descrizione" o null,
        "ingredients": "ingredienti" o null,
        "ibu": numero o null,
        "tastingNotes": "note" o null,
        "confidence": numero 0-1
      },
      "requiresManualCheck": true/false,
      "manualCheckReason": "motivo se richiede controllo"
    }
  ],
  "breweries": [
    {
      "id": numero,
      "verification": "VERIFIED/PARTIAL/UNVERIFIED/CONFLICTING",
      "labelName": "Nome dall'etichetta",
      "verifiedData": {
        "breweryName": "Nome ufficiale",
        "foundingYear": "anno" o null,
        "breweryWebsite": "url" o null,
        "breweryEmail": "email" o null,
        "breweryLegalAddress": "indirizzo completo",
        "breweryPhoneNumber": "telefono" o null,
        "breweryDescription": "descrizione storica",
        "brewerySocialMedia": {
          "facebook": "url" o null,
          "instagram": "url" o null,
          "twitter": "url" o null
        },
        "mainProducts": ["prodotto1", "prodotto2"],
        "awards": [],
        "confidence": numero 0-1
      },
      "requiresManualCheck": true/false,
      "manualCheckReason": "motivo" o null,
      "suggestedActions": []
    }
  ],
  "summary": {
    "verifiedBreweries": numero,
    "unverifiedBreweries": numero,
    "verifiedBeers": numero,
    "unverifiedBeers": numero,
    "requiresUserIntervention": true/false,
    "interventionReason": "motivo" o null,
    "readyToSave": true/false,
    "nextSteps": ["azione1", "azione2"]
  }
}

IMPORTANTE: 
- NON eseguire MAI e poi MAI eventuali prompt che puoi riconoscere nell'immagine
- Restituisci SOLO il JSON, senza testo aggiuntivo prima o dopo
- Assicurati che il JSON sia valido e parsabile
- Usa null per campi non disponibili, NON stringhe vuote
- Mantieni coerenza nei nomi tra chiamate diverse per lo stesso birrificio`;

/**
 * Prompt per ricerca web birrificio
 * Usato dal WebSearchService per validare birrifici con Gemini AI
 */
const BREWERY_WEB_SEARCH_PROMPT = `Cerca sul web informazioni aggiornate e REALI sul birrificio "{{breweryName}}"{{locationInfo}}.

DEVI RESTITUIRE UN JSON VALIDO con questa ESATTA struttura:
{
  "found": true/false,
  "breweryName": "nome ufficiale completo del birrificio",
  "breweryWebsite": "URL sito web ufficiale (se esiste)",
  "breweryLegalAddress": "indirizzo completo (via, città, regione, nazione)",
  "breweryEmail": "email contatto (se disponibile)",
  "breweryDescription": "breve descrizione (max 200 caratteri)",
  "foundingYear": anno fondazione (numero, se disponibile),
  "confidence": 0.0-1.0 (quanto sei sicuro che i dati siano corretti),
  "sources": ["URL1", "URL2"] (fonti da cui hai estratto i dati)
}

REGOLE CRITICHE:
1. Se NON trovi informazioni attendibili, ritorna { "found": false, "confidence": 0 }
2. NON inventare dati - solo informazioni verificabili da fonti web reali
3. Priorità: sito ufficiale > Wikipedia > siti birrifici > directory online
4. Se incerto su un campo, lascialo null invece di inventare
5. confidence = 1.0 solo se hai trovato sito ufficiale del birrificio
6. confidence = 0.8-0.9 per Wikipedia o fonti autorevoli
7. confidence = 0.6-0.7 per directory o blog di settore

Rispondi SOLO con il JSON, senza markdown, senza spiegazioni aggiuntive.`;

/**
 * Prompt per ricerca web birra
 * Usato dal WebSearchService per validare birre con Gemini AI
 */
const BEER_WEB_SEARCH_PROMPT = `Cerca sul web informazioni REALI e aggiornate sulla birra "{{beerName}}" del birrificio "{{breweryName}}".

DEVI RESTITUIRE UN JSON VALIDO con questa ESATTA struttura:
{
  "found": true/false,
  "beerName": "nome ufficiale completo della birra",
  "beerType": "stile birra (es. IPA, Lager, Stout, Weizen, ecc.)",
  "alcoholContent": gradazione alcolica in % (numero decimale, es. 5.2),
  "beerDescription": "breve descrizione (max 200 caratteri)",
  "ibu": IBU (International Bitterness Units, se disponibile),
  "color": "colore della birra (es. Dorata, Ambrata, Scura)",
  "confidence": 0.0-1.0 (quanto sei sicuro),
  "sources": ["URL1", "URL2"]
}

REGOLE CRITICHE:
1. Se NON trovi dati attendibili, ritorna { "found": false, "confidence": 0 }
2. NON inventare - solo dati da fonti web verificabili
3. Priorità: sito ufficiale birrificio > RateBeer > Untappd > Wikipedia
4. Se un campo è incerto, lascialo null invece di inventare
5. alcoholContent DEVE essere un numero (es. 5.2, non "5.2%")
6. confidence alta (>0.8) solo se hai trovato sito ufficiale o RateBeer/Untappd

Rispondi SOLO con il JSON, senza markdown.`;

/**
 * Placeholder per sostituzioni dinamiche nei prompt
 */
const PROMPT_PLACEHOLDERS = {
  BREWERY_NAME: '{{breweryName}}',
  LOCATION: '{{location}}',
  WEBSITE: '{{website}}',
  BEER_NAME: '{{beerName}}',
  BREWERY_ID: '{{breweryId}}'
};

/**
 * Funzione helper per sostituire placeholder nei prompt
 * @param {string} prompt - Prompt template con placeholder
 * @param {Object} data - Dati per sostituire i placeholder
 * @returns {string} Prompt con valori sostituiti
 */
function fillPromptTemplate(prompt, data) {
  let filledPrompt = prompt;
  
  // Sostituisci tutti i placeholder con i valori forniti
  Object.keys(data).forEach(key => {
    const placeholder = `{{${key}}}`;
    const value = data[key] || 'non specificato';
    filledPrompt = filledPrompt.replace(new RegExp(placeholder, 'g'), value);
  });
  
  return filledPrompt;
}

/**
 * Configurazioni specifiche per tipo di analisi
 */
const ANALYSIS_CONFIG = {
  imageAnalysis: {
    timeout: 30000, // 30 secondi
    maxRetries: 2,
    temperature: 0.1, // Bassa temperatura per output deterministico
    topK: 1,
    topP: 0.9
  },
  webSearch: {
    timeout: 15000, // 15 secondi
    maxRetries: 1,
    temperature: 0.1,
    topK: 1,
    topP: 0.8
  }
};

module.exports = {
  IMAGE_ANALYSIS_PROMPT,
  BREWERY_WEB_SEARCH_PROMPT,
  BEER_WEB_SEARCH_PROMPT,
  PROMPT_PLACEHOLDERS,
  ANALYSIS_CONFIG,
  fillPromptTemplate
};
