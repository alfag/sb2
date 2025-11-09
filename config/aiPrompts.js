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
const IMAGE_ANALYSIS_PROMPT = `Analizza questa immagine seguendo RIGOROSAMENTE questo processo step-by-step per garantire dati ACCURATI e VERIFICATI e rispondi sempre in lingua italiana:

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

STEP 2 - PREPARAZIONE PER RICERCA WEB:
⚠️ IMPORTANTE: Tu NON puoi fare ricerche web dirette. La ricerca web sarà fatta dal sistema DOPO questa analisi.
Il tuo compito è ESTRARRE ACCURATAMENTE i dati dall'etichetta e indicare VARIANTI ORTOGRAFICHE possibili.

🔍 **ESTRAZIONE ACCURATA DEL NOME**:
- Leggi il nome ESATTO come appare sull'etichetta
- **⚠️ LETTERE STILIZZATE**: Etichette artistiche usano font decorativi con lettere rovesciate o stilizzate
- Esempio: N rovesciata (ᴎ) → OCR la legge come M
- Quindi: un nome potrebbe apparire diverso a causa di lettere stilizzate

**GENERA LISTA VARIANTI per ricerca web futura**:
Per il nome letto dall'etichetta, crea una lista di query che il sistema userà:
- Query base: Nome esatto dall'etichetta
- Varianti ortografiche comuni:
  * m↔n (CRITICO per lettere stilizzate)
  * Accenti: è→e, à→a, ò→o
  * Lettere simili: i↔e, a↔e
  * Maiuscole/minuscole: "DR." → "Dr." → "doctor"
- Esempi di varianti da generare:
  * "[Nome esatto] birrificio"
  * "[Nome con variante m↔n] birrificio"
  * "[Nome minuscolo] brewery"
  * "[Nome] sito ufficiale"
  * "[Variante fonetica]"

**COSA ASPETTARSI DALLA RICERCA WEB**:
Dopo questa analisi, il sistema farà ricerca web per te. Ecco cosa distinguere:

✅ **VARIANTI ORTOGRAFICHE VALIDE** (stessa entità):
- Varianti con max 2-3 lettere diverse → considerare stessa entità
- Accenti diversi, lettere simili foneticamente
- **SEMPRE considera m↔n per lettere stilizzate artistiche**

❌ **NOMI COMPLETAMENTE DIVERSI** (entità diverse):
- Nomi che differiscono per oltre metà delle lettere → BIRRIFICI DIVERSI
- Regola: oltre metà nome diverso → ignora quei risultati

**DATI DA ESTRARRE DALL'ETICHETTA**:
Dal testo visibile nell'immagine estrai:
- Nome birrificio esatto come scritto
- Nome birra esatto come scritto
- Gradazione alcolica (se presente)
- Volume (se presente)
- Stile/tipologia (se indicato)
- Anno/data (se visibile)
- Città/paese (se indicato)
- Ingredienti (se elencati)
- Altri testi leggibili

STEP 3 - VALUTAZIONE CONFIDENZA ESTRAZIONE:
Basandoti SOLO sui dati visibili nell'etichetta, valuta la tua confidenza:

📊 **CONFIDENCE SCORE** (0.0 - 1.0):
- 1.0: Testo chiarissimo, stampato standard, ben leggibile
- 0.8: Testo chiaro ma font artistico/stilizzato
- 0.6: Testo parzialmente leggibile, alcune lettere poco chiare
- 0.4: Testo difficile da leggere, font molto artistico
- 0.2: Testo barely visible, molto stilizzato

🔍 **INDICATORI DI QUALITÀ LETTURA**:
- Font standard/professionale → confidence alta
- Font artistico/calligrafico → confidence media (lettere stilizzate possibili)
- Font gotico/decorativo → confidence bassa (N rovesciate, M stilizzate, etc.)
- Etichetta consumata/sfocata → confidence bassa
- Riflessi/angolazione → riduci confidence

⚠️ **NOTA BENE**:
- Confidence alta (>0.8) = lettura affidabile, il sistema userà nome esatto
- Confidence media (0.5-0.8) = possibili variazioni ortografiche, sistema cercherà varianti
- Confidence bassa (<0.5) = lettura incerta, sistema farà ricerca ampia + richiederà verifica manuale

STEP 4 - STATO FINALE:
Classifica l'analisi come:
- "READY": Dati etichetta chiari e completi (nome birra + nome birrificio leggibili)
- "NEEDS_WEB_SEARCH": Dati etichetta estratti ma necessaria ricerca web per conferma
- "NEEDS_MANUAL_CHECK": Dati etichetta poco chiari, richiesta verifica manuale

STEP 5 - CRITERI COMPLETEZZA:
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
2. Se un campo non è leggibile sull'etichetta → null
3. NON aggiungere informazioni che non vedi fisicamente nell'immagine
4. Se incerto su un campo, lascia null invece di indovinare
5. Restituisci confidence score basato sulla chiarezza della lettura etichetta
6. NON usare conoscenze pregresse sui birrifici - leggi SOLO ciò che vedi
7. **CRITICO**: NON generare URL, indirizzi, email se non visibili sull'etichetta
8. **CRITICO PER LETTERE STILIZZATE**: 
   - ⚠️ Font artistici usano lettere ROVESCIATE o STILIZZATE
   - Esempio comune: N rovesciata (ᴎ) viene letta dall'OCR come M
   - Indica SEMPRE varianti m↔n nella lista searchQueries quando rilevi font artistici
   - Altri esempi: A come Λ, E come Ǝ, S come Ƨ
   - NON fare assunzioni - genera varianti e lascia che ricerca web verifichi
   
9. **CRITICO - VARIANTI ORTOGRAFICHE DA INCLUDERE IN searchQueries**:
   
   ✅ **VARIANTI DA GENERARE** (per ricerca web futura):
   - Accenti/diacritici: rimuovi o sostituisci accenti
   - Lettere simili: varianti con m↔n, i↔e, a↔e
   - **LETTERE STILIZZATE**: SEMPRE variante m↔n quando rilevi font artistici
   - Maiuscole/minuscole: genera varianti con diverse capitalizzazioni
   - Punteggiatura: varianti con/senza punteggiatura
   - Regola: max 2-3 lettere diverse = variante valida
   
   📝 **ESEMPIO PRATICO**:
   - Lettura etichetta: "[NOME_LETTO]"
   - Genera searchQueries:
     * "[NOME_LETTO] birrificio"
     * "[NOME con variante m↔n] birrificio" (se font artistico)
     * "[Nome minuscolo] brewery"
     * "[Nome] sito ufficiale"
     * "[Variante fonetica]"
   - Confidence: valutazione basata su chiarezza font
   - requiresWebSearch: true se confidence < 0.9
10. **CRITICO - COSA PUOI E NON PUOI FARE**:
   ✅ PUOI:
   - Leggere testo dall'etichetta fisicamente presente
   - Generare varianti ortografiche per ricerca futura
   - Valutare chiarezza lettura (confidence)
   
   ❌ NON PUOI:
   - Fare ricerche web (lo farà il sistema dopo)
   - Inventare URL, indirizzi, email non visibili
   - Usare conoscenze pregresse sui birrifici
   - Completare dati basandoti su "pattern comuni"
   
   **REGOLA D'ORO**: Se non lo VEDI fisicamente nell'immagine → null

FORMATO OUTPUT:
Restituisci un JSON con questa struttura ESATTA:

{
  "success": true/false,
  "message": "Messaggio descrittivo",
  "imageQuality": "ottima/buona/media/scarsa",
  "totalBottlesFound": numero,
  "analysisSteps": {
    "step1_labelReading": "Descrizione cosa hai letto dall'etichetta",
    "step2_variantGeneration": "Elenco varianti ortografiche generate",
    "step3_confidenceEvaluation": "Valutazione confidence lettura",
    "step4_finalStatus": "READY/NEEDS_WEB_SEARCH/NEEDS_MANUAL_CHECK"
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
      "searchQueries": {
        "exact": "Nome esatto etichetta per ricerca base",
        "variants": ["variante 1 m↔n", "variante 2 accenti", "variante 3 maiuscole"],
        "explanation": "Spiega perché hai generato queste varianti (es: 'Font artistico, N potrebbe essere M stilizzata')"
      },
      "extractionConfidence": numero 0-1,
      "confidenceReason": "Perché questo confidence? (es: 'Font artistico con lettere stilizzate')",
      "stylisticElements": {
        "hasArtisticFont": true/false,
        "hasStylizedLetters": true/false,
        "lettersProbablyStylized": ["M (potrebbe essere N)", "A (potrebbe essere Lambda)"],
        "readabilityIssues": "Descrizione problemi lettura se presenti"
      },
      "requiresWebSearch": true/false,
      "webSearchReason": "Perché serve ricerca web (es: 'Confidence medio, font artistico, conferma nome necessaria')"
    }
  ],
  "breweries": [
    {
      "id": numero,
      "labelName": "Nome ESATTO dall'etichetta",
      "searchQueries": {
        "exact": "Nome esatto per ricerca",
        "variants": ["variante 1", "variante 2", "variante 3"],
        "explanation": "Motivo varianti"
      },
      "visibleData": {
        "location": "città se visibile" o null,
        "website": "url se visibile" o null,
        "email": "email se visibile" o null,
        "address": "indirizzo se visibile" o null,
        "otherText": "altri testi leggibili"
      },
      "extractionConfidence": numero 0-1,
      "requiresWebSearch": true,
      "webSearchPriority": "high/medium/low"
    }
  ],
  "summary": {
    "totalBreweriesFound": numero,
    "totalBeersFound": numero,
    "allReadable": true/false,
    "averageConfidence": numero 0-1,
    "requiresWebSearch": true/false,
    "webSearchReason": "Motivo ricerca web necessaria",
    "status": "READY/NEEDS_WEB_SEARCH/NEEDS_MANUAL_CHECK",
    "nextSteps": ["Sistema farà ricerca web per X varianti", "Utente dovrà confermare Y"]
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
