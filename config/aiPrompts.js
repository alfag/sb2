/**
 * Configurazione Prompts per Gemini AI
 * Centralizza tutti i prompt usati nel sistema per facilitare manutenzione e modifiche
 * 
 * @module config/aiPrompts
 */

/**
 * Prompt principale per analisi immagini birre - VERSIONE MULTI-BOTTIGLIA/LATTINA
 * Estrae nome birra E nome birrificio (se visibile) dall'etichetta - TUTTO IL RESTO via web scraping
 */
const IMAGE_ANALYSIS_PROMPT = `Analizza questa immagine e rispondi in lingua italiana.

🚨🚨🚨 REGOLA #1 - ASSOLUTAMENTE PRIORITARIA - LEGGERE PRIMA DI TUTTO 🚨🚨🚨

CONTA SOLO I CONTENITORI FISICI, MAI I TESTI SULL'ETICHETTA!

Una fotografia con UNA bottiglia = UNA SOLA birra nel JSON, SEMPRE.
Una fotografia con DUE bottiglie = DUE birre nel JSON.
Una fotografia con TRE bottiglie = TRE birre nel JSON.

⛔ ERRORE FATALE DA EVITARE: Se su UNA SINGOLA etichetta leggi più nomi/testi 
(es: "Dr. Barbanera" e "Sudigiri"), NON sono 2 birre diverse!
Uno è il BIRRIFICIO e l'altro è il NOME della BIRRA → restituisci 1 SOLO oggetto!

ESEMPIO CONCRETO:
- Vedi 1 bottiglia fisica con etichetta che mostra "Dr. Barbanera" + "Sudigiri"
- "Dr. Barbanera" (o "Barbanera") = nome del BIRRIFICIO
- "Sudigiri" = nome della BIRRA
- RISULTATO CORRETTO: 1 oggetto con breweryName="Barbanera", beerName="Sudigiri"
- RISULTATO SBAGLIATO: 2 oggetti separati ❌❌❌

PRIMA DI GENERARE IL JSON: Conta quanti CONTENITORI FISICI (bottiglie/lattine/bicchieri) 
vedi nell'immagine. Quel numero DEVE corrispondere al numero di oggetti nell'array "bottles".

🚨🚨🚨 FINE REGOLA #1 🚨🚨🚨

OBIETTIVO: Identifica TUTTE le birre visibili (bottiglie, lattine, bicchieri con etichetta) ed estrai:
1. Il NOME DELLA BIRRA (prodotto)
2. Il NOME DEL BIRRIFICIO produttore (SE VISIBILE sull'etichetta)

⚠️ REGOLA FONDAMENTALE: SEPARARE BIRRA E BIRRIFICIO ⚠️

Molte etichette mostrano sia il nome del BIRRIFICIO che il nome della BIRRA. DEVI separarli!

ESEMPI DI SEPARAZIONE CORRETTA:
- Etichetta: "Birrificio Viana - Roby's Blonde"
  → breweryName: "Birrificio Viana", beerName: "Roby's Blonde" ✅
  
- Etichetta: "Birrificio Baladin - Isaac"
  → breweryName: "Birrificio Baladin", beerName: "Isaac" ✅
  
- Etichetta: "Birrificio Italiano - Tipopils"
  → breweryName: "Birrificio Italiano", beerName: "Tipopils" ✅

- Etichetta: "PERONI - Non Filtrata"
  → breweryName: "Peroni", beerName: "Peroni Non Filtrata" ✅
  (Peroni è sia il brand che parte del nome birra)

- Etichetta: Solo "ICHNUSA" grande
  → breweryName: "Ichnusa", beerName: "Ichnusa" ✅
  (Quando il nome del brand E della birra coincidono)

- Etichetta: "RAFFO" con nessun altro nome
  → breweryName: "Raffo", beerName: "Raffo" ✅

COME IDENTIFICARE IL BIRRIFICIO:
- Cerca la parola "Birrificio", "Brewery", "Brasserie", "Brauerei"
- Cerca diciture come "Prodotto da...", "Made by...", "Brewed by..."
- Il nome in grande PRIMA del nome della birra è spesso il birrificio
- Il logo o emblema sull'etichetta spesso indica il birrificio

COME IDENTIFICARE IL NOME DELLA BIRRA:
- È il nome del PRODOTTO specifico (non l'azienda)
- Spesso include uno stile o descrizione (es: "Blonde", "IPA", "Lager", "Rossa")
- Può includere il brand se è parte del nome commerciale (es: "Peroni Non Filtrata")

⚠️ ERRORI DA EVITARE:
❌ NON concatenare birrificio e birra: "Birrificio Viana Roby's Blonde" è SBAGLIATO
❌ NON mettere tutto in beerName ignorando il birrificio
❌ NON usare ragioni sociali (S.p.A., S.r.l., S.A.S.)

ISTRUZIONI:
1. Conta quante CONTENITORI FISICI sono visibili (bottiglie, lattine, fusti, bicchieri)
   - Ogni contenitore fisico = 1 birra nel JSON (VEDI REGOLA #1 SOPRA!)
2. Per OGNI CONTENITORE FISICO trovato, identifica SEPARATAMENTE:
   a) Il BIRRIFICIO produttore (se visibile)
   b) Il NOME della BIRRA (prodotto)
3. **ATTENZIONE LETTERE STILIZZATE**: Font artistici con lettere rovesciate o stilizzate
   - Esempio: N rovesciata (ᴎ) letta come M
   - Se vedi font artistico, considera varianti m↔n
4. Genera VARIANTI ORTOGRAFICHE per ricerca web (max 3-5 varianti)
5. Valuta CONFIDENCE della lettura (0.0-1.0)

FORMATO OUTPUT JSON:
{
  "success": true/false,
  "bottles": [
    {
      "beerName": "Nome della BIRRA (prodotto, NON birrificio)",
      "breweryName": "Nome del BIRRIFICIO (se visibile sull'etichetta, altrimenti null)",
      "searchVariants": ["variante1", "variante2", "variante3"],
      "confidence": 0.0-1.0,
      "readingNotes": "Note su lettere stilizzate o problemi lettura"
    }
  ],
  "totalBottlesFound": numero totale di birre identificate (bottiglie + lattine + altri contenitori),
  "message": "Riepilogo analisi"
}

IMPORTANTE: 
- Restituisci SOLO il JSON, senza testo aggiuntivo
- beerName è OBBLIGATORIO - il nome del prodotto birra
- breweryName è OPZIONALE - se non vedi il birrificio, usa null
- NON concatenare birrificio e birra in beerName
- Se birra e birrificio hanno lo stesso nome (es: Ichnusa), ripeti lo stesso nome in entrambi i campi`;

/**
 * Prompt per ricerca web birrificio
 * Usato dal WebSearchService per validare birrifici con Gemini AI
 */
const BREWERY_WEB_SEARCH_PROMPT = `Cerca sul web informazioni aggiornate e REALI sul birrificio "{{breweryName}}"{{locationInfo}}.

🎯 PRIORITÀ ASSOLUTA PER L'INDIRIZZO:
1. Cerca PRIMA sul SITO WEB UFFICIALE del birrificio nella pagina "Contatti", "Chi siamo" o "Dove trovarci"
2. L'indirizzo deve essere quello della SEDE LEGALE o PRODUZIONE del birrificio
3. NON usare indirizzi di Google Maps se non confermati dal sito ufficiale
4. Se il sito mostra più indirizzi, usa quello indicato come "Sede", "Produzione" o "Birrificio"
5. Verifica che l'indirizzo sia ATTUALE e non obsoleto

⚠️ ATTENZIONE CRITICA:
- NON inventare indirizzi
- NON usare indirizzi di taproom/pub se diversi dalla sede produttiva
- Se NON trovi l'indirizzo sul sito ufficiale, usa null invece di inventare
- L'indirizzo deve essere COMPLETO: Via/Strada + Numero Civico + CAP + Città + Provincia

DEVI RESTITUIRE UN JSON VALIDO con questa ESATTA struttura:
{
  "found": true/false,
  "breweryName": "nome ufficiale completo del birrificio",
  "breweryWebsite": "URL sito web ufficiale (se esiste)",
  "breweryLegalAddress": "indirizzo completo SEDE/PRODUZIONE (via, numero, CAP, città, provincia) o null se non trovato",
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
8. **ATTENZIONE CRITICA SITO WEB**: 
   - NON costruire URL ipotetici (es. www.birrificio[nome].it)
   - CERCA attivamente il dominio reale e VERIFICALO
   - Esempi ERRORI: "www.birrificioichnusa.it" (inventato) vs "www.birraichnusa.it" (reale)
   - Se NON trovi il sito web reale, lascia null invece di generare URL probabili
9. **ATTENZIONE CRITICA INDIRIZZI**:
   - USA SOLO indirizzo ESATTO trovato sul sito ufficiale o Wikipedia
   - L'indirizzo DEVE essere completo: via/piazza, numero civico, CAP, città, provincia, nazione
   - NON dedurre, ricostruire o inventare parti dell'indirizzo
   - Se trovi solo città/provincia senza via → lascia solo quello, NON inventare la via
   - Se NON trovi indirizzo completo verificato → lascia null
   - Esempi CORRETTI: "Via Molignati 12, 13878 Candelo (BI)", "Via Raffaello Sanzio 13, 20871 Vimercate (MB)"
   - Esempio ERRORE: "Via dei Birrai, Biella" (generico inventato)

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
7. **ATTENZIONE**: NON inventare dati tecnici - se non li trovi, usa null

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
 * Configurazione modello Gemini AI centralizzata
 * Usato da: geminiAi.js, googleSearchRetrievalService.js, webSearchService.js
 */
const GEMINI_MODEL_CONFIG = {
  // Modello principale per analisi immagini e ricerche
  defaultModel: 'gemini-2.5-flash-lite',
  // Modello con supporto Google Search (grounding via googleSearch tool)
  // Usando stesso modello del default per consistenza
  searchRetrievalModel: 'gemini-2.0-flash',
  // Safety settings standard
  safetySettings: [
    { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
    { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
    { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
    { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' }
  ]
};

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
  },
  googleSearchRetrieval: {
    timeout: 20000, // 20 secondi
    maxRetries: 2,
    temperature: 0.1,
    dynamicThreshold: 0.3, // Soglia per attivare grounding
    minConfidence: 0.5 // Soglia minima per accettare risultati
  }
};

module.exports = {
  IMAGE_ANALYSIS_PROMPT,
  BREWERY_WEB_SEARCH_PROMPT,
  BEER_WEB_SEARCH_PROMPT,
  PROMPT_PLACEHOLDERS,
  ANALYSIS_CONFIG,
  GEMINI_MODEL_CONFIG,
  fillPromptTemplate
};
