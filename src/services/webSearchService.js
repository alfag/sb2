const logWithFileName = require('../utils/logger');
const logger = logWithFileName(__filename);
const Brewery = require('../models/Brewery');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { GEMINI_API_KEY } = require('../../config/config');
const { BREWERY_WEB_SEARCH_PROMPT, BEER_WEB_SEARCH_PROMPT, fillPromptTemplate } = require('../../config/aiPrompts');
const axios = require('axios');
const cheerio = require('cheerio');
const https = require('https');
const http = require('http');
const HTMLParser = require('../utils/htmlParser');
const AddressVerificationService = require('./addressVerificationService');

// Inizializza Gemini AI per ricerche web intelligenti
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

/**
 * 🌐 WEB SEARCH SERVICE - Ricerca e Validazione Dati Birrifici/Birre
 * 
 * Questo servizio effettua ricerche web automatiche per:
 * 1. Validare esistenza reale di birrifici/birre
 * 2. Completare dati mancanti da fonti affidabili
 * 3. Evitare input manuale dell'utente (minimizzare errori e contenuti inappropriati)
 * 
 * Strategia:
 * - Ricerca prioritaria nel database interno
 * - Ricerca web su fonti affidabili (Google, siti birrifici)
 * - Proposta dati completi all'utente per semplice conferma
 */

class WebSearchService {

  /**
   * 🔍 P0.1 FIX: Estrae il VERO nome del birrificio dai risultati di ricerca
   * NON usa più "beerName birrificio produttore" come nome
   * Estrae da: title DuckDuckGo, URL, snippet
   * @param {Array} searchResults - Risultati DuckDuckGo [{title, url, snippet}]
   * @param {string} beerName - Nome birra per context (es: "Ichnusa Non Filtrata")
   * @returns {string|null} Nome reale birrificio estratto o null
   */
  static extractRealBreweryName(searchResults, beerName) {
    try {
      if (!searchResults || searchResults.length === 0) {
        return null;
      }

      // Pulisci beerName per matching
      const beerNameClean = beerName.toLowerCase()
        .replace(/birrificio produttore$/i, '')
        .replace(/birrificio$/i, '')
        .trim();
      
      // Pattern per riconoscere nomi birrificio nei titoli
      const breweryPatterns = [
        /^(Birrificio|Brewery)\s+([A-Z][a-zA-Zàèéìòù\s&'.,-]+)/i,  // "Birrificio Menabrea"
        /^(Birra)\s+([A-Z][a-zA-Zàèéìòù\s&'.,-]+)/i,              // "Birra Ichnusa"
        /^([A-Z][a-zA-Zàèéìòù\s&'.,-]+)\s*[-–|]\s*(Birrificio|Brewery|Sito|Home)/i, // "Menabrea - Sito Ufficiale"
        /^([A-Z][a-zA-Zàèéìòù\s&'.,-]+)\s+(Birrificio|Brewery)/i, // "Peroni Birrificio"
      ];
      
      // Parole da rimuovere dal nome finale
      const wordsToStrip = [
        'sito ufficiale', 'official site', 'home', 'homepage',
        'birre artigianali', 'craft beer', 'dal', 'since',
        'birrificio', 'brewery', 'birra', 'beer'
      ];

      for (const result of searchResults.slice(0, 3)) { // Analizza primi 3 risultati
        const title = result.title || '';
        
        // Prova ogni pattern
        for (const pattern of breweryPatterns) {
          const match = title.match(pattern);
          if (match) {
            // Estrai il nome dal gruppo catturato (gruppo 2 per i primi pattern)
            let extractedName = match[2] || match[1];
            
            // Pulisci il nome estratto
            for (const word of wordsToStrip) {
              extractedName = extractedName.replace(new RegExp(`\\s*[-–|]?\\s*${word}.*$`, 'i'), '');
            }
            
            extractedName = extractedName.trim();
            
            // Valida: deve essere almeno 2 caratteri e non contenere solo il nome della birra
            if (extractedName.length >= 2 && !beerNameClean.includes(extractedName.toLowerCase())) {
              // Formatta: "MENABREA" → "Menabrea", "g. menabrea e figli" → "G. Menabrea e figli"
              const formattedName = this.formatBreweryName(extractedName);
              
              logger.info('[WebSearch] 🎯 P0.1: Nome birrificio REALE estratto', {
                originalTitle: title,
                extractedName: formattedName,
                pattern: pattern.toString().substring(0, 50),
                beerName: beerName
              });
              
              return formattedName;
            }
          }
        }
        
        // Fallback: estrai dal dominio URL
        if (result.url) {
          try {
            const urlObj = new URL(result.url);
            const hostname = urlObj.hostname.replace(/^www\./, '');
            // Es: "birraichnusa.it" → "Ichnusa", "birramenabrea.com" → "Menabrea"
            const domainName = hostname.split('.')[0]
              .replace(/^birra/, '')
              .replace(/^birrificio/, '')
              .replace(/^brewery/, '');
            
            if (domainName.length >= 3) {
              const formattedDomainName = this.formatBreweryName(domainName);
              logger.info('[WebSearch] 🎯 P0.1: Nome birrificio estratto da dominio', {
                url: result.url,
                domainName: formattedDomainName
              });
              return formattedDomainName;
            }
          } catch (e) {
            // Ignora errori URL
          }
        }
      }
      
      return null;
    } catch (error) {
      logger.warn('[WebSearch] ⚠️ P0.1: Errore estrazione nome birrificio', { 
        error: error.message,
        beerName 
      });
      return null;
    }
  }

  /**
   * Formatta nome birrificio con capitalizzazione corretta
   * "MENABREA" → "Menabrea", "g. menabrea e figli" → "G. Menabrea E Figli"
   */
  static formatBreweryName(name) {
    if (!name) return name;
    
    // Se tutto maiuscolo, converti a Title Case
    if (name === name.toUpperCase()) {
      return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
    }
    
    // Title Case per parole separate
    return name.split(' ')
      .map(word => {
        // Preserva acronimi corti (es: "S.p.A.", "G.")
        if (word.length <= 2 || word.includes('.')) {
          return word.toUpperCase();
        }
        // Parole minori in minuscolo
        if (['e', 'di', 'del', 'della', 'dei', 'degli', 'and', 'of'].includes(word.toLowerCase())) {
          return word.toLowerCase();
        }
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      })
      .join(' ');
  }

  /**
   * Normalizza un URL al dominio base (senza path specifici)
   * Esempio: https://www.birraichnusa.it/intro/storia → https://www.birraichnusa.it/
   * @param {string} url - URL da normalizzare
   * @returns {string} URL base normalizzato
   */
  static normalizeToBaseUrl(url) {
    try {
      const urlObj = new URL(url);
      // Ricostruisci URL con solo protocol + hostname (no path)
      return `${urlObj.protocol}//${urlObj.hostname}${urlObj.port ? ':' + urlObj.port : ''}/`;
    } catch (parseError) {
      logger.warn('[WebSearch] ⚠️ Errore normalizzazione URL, ritorno originale', { 
        url, 
        error: parseError.message 
      });
      // Se parsing fallisce, ritorna URL originale
      return url;
    }
  }
  
  /**
   * 🦆 SCRAPING DUCKDUCKGO - PIÙ AFFIDABILE DI GOOGLE
   * HTML stabile, nessun JavaScript, layout consistente, meno blocchi
   * @param {string} query - Query di ricerca
   * @returns {Promise<Array>} Array di risultati { title, url, snippet }
   */
  static async scrapeDuckDuckGo(query) {
    try {
      logger.info('[WebSearch] 🦆 DuckDuckGo scraping (axios+cheerio)', { query });
      
      // ⏱️ Delay casuale anti-pattern detection (200-500ms)
      const delay = Math.floor(Math.random() * 300) + 200;
      await new Promise(resolve => setTimeout(resolve, delay));
      
      // URL DuckDuckGo HTML (senza JavaScript)
      const encodedQuery = encodeURIComponent(query);
      const ddgUrl = `https://html.duckduckgo.com/html/?q=${encodedQuery}`;
      
      logger.info('[WebSearch] 🌐 URL DuckDuckGo completo', { 
        query, 
        encodedQuery,
        fullUrl: ddgUrl,
        delayMs: delay
      });
      
      // 🍪 Cookie di sessione realistico
      const sessionId = 'ddg_' + Math.random().toString(36).substring(2, 15);
      const cookieValue = `l=it-it; kl=it-it; s=${sessionId}; v=1`;
      
      // Richiesta con axios (timeout ridotto per performance)
      // DuckDuckGo richiede headers completi per non bloccare lo scraping
      const response = await axios.get(ddgUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
          'Accept-Language': 'it-IT,it;q=0.9,en;q=0.8',
          'Accept-Encoding': 'gzip, deflate, br',
          'Referer': 'https://duckduckgo.com/',
          'Cookie': cookieValue,
          'DNT': '1',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'same-origin',
          'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
          'Sec-Ch-Ua-Mobile': '?0',
          'Sec-Ch-Ua-Platform': '"Windows"'
        },
        timeout: 8000, // Aumentato a 8s per maggiore affidabilità
        maxRedirects: 5
      });
      
      const html = response.data;
      
      logger.debug('[WebSearch] 📄 HTML DuckDuckGo ricevuto', { 
        htmlLength: html.length,
        htmlPreview: html.substring(0, 300),
        containsResults: html.includes('result__a'),
        containsSnippet: html.includes('result__snippet'),
        containsNoscript: html.includes('<noscript'),
        containsRedirect: html.includes('redirect'),
        containsCaptcha: html.includes('captcha')
      });
      
      // Se HTML è troppo corto o sembra una pagina di blocco
      if (html.length < 5000) {
        logger.warn('[WebSearch] ⚠️ HTML DuckDuckGo sospetto (troppo corto)', {
          htmlLength: html.length,
          possibleBlock: true,
          htmlStart: html.substring(0, 500)
        });
      }
      
      // Parsing con Cheerio
      const $ = cheerio.load(html);
      const results = [];
      
      // DuckDuckGo ha struttura HTML molto stabile: div.result
      $('.result').each((index, element) => {
        if (results.length >= 5) return false; // Max 5 risultati (ridotto per performance)
        
        const $el = $(element);
        
        // Titolo
        const title = $el.find('.result__a').text().trim();
        
        // URL con decodifica redirect DDG
        let url = $el.find('.result__a').attr('href');
        if (url) {
          try {
            // DDG usa formato: //duckduckgo.com/l/?uddg=https%3A%2F%2F...
            if (url.includes('duckduckgo.com/l/?uddg=')) {
              const urlObj = new URL('https:' + url);
              url = decodeURIComponent(urlObj.searchParams.get('uddg') || url);
            }
            if (url.startsWith('//')) url = 'https:' + url;
          } catch (e) {
            logger.debug('[WebSearch] ⚠️ Errore parsing URL DDG', { url, error: e.message });
          }
        }
        
        // Snippet
        const snippet = $el.find('.result__snippet').text().trim();
        
        // Aggiungi risultato valido
        if (title && url && url.startsWith('http') && !url.includes('duckduckgo.com')) {
          results.push({ title, url, snippet });
          logger.debug('[WebSearch] ✅ Risultato DDG', { 
            index: results.length, 
            title: title.substring(0, 50),
            url 
          });
        }
      });
      
      // 📊 Log dettagliato per debugging
      if (results.length === 0) {
        logger.warn('[WebSearch] ⚠️ DuckDuckGo: nessun risultato trovato', { 
          query,
          htmlLength: html.length,
          htmlHasContent: html.length > 5000,
          containsResultClass: html.includes('result__a'),
          possibleBlock: html.includes('captcha') || html.includes('blocked'),
          htmlSnippet: html.substring(0, 500)
        });
      } else {
        logger.info('[WebSearch] ✅ DuckDuckGo scraping completato', { 
          query, 
          resultsFound: results.length,
          firstResultTitle: results[0]?.title?.substring(0, 50)
        });
      }
      
      return results;
      
    } catch (error) {
      logger.error('[WebSearch] ❌ Errore DuckDuckGo scraping', { 
        query, 
        error: error.message 
      });
      return [];
    }
  }

  /**
   * 🌐 SCRAPING GOOGLE SEARCH (DEPRECATO - usare DuckDuckGo)
   * Mantenuto come fallback ma Google cambia spesso i selettori
   * @param {string} query - Query di ricerca
   * @returns {Promise<Array>} Array di risultati { title, url, snippet }
   */
  static async scrapeGoogleSearch(query) {
    try {
      logger.info('[WebSearch] 🔍 Google Search scraping (axios+cheerio)', { query });
      
      // ⏱️ Delay casuale anti-pattern detection (300-700ms)
      const delay = Math.floor(Math.random() * 400) + 300;
      await new Promise(resolve => setTimeout(resolve, delay));
      
      // Costruisci URL Google Search
      const encodedQuery = encodeURIComponent(query);
      const googleUrl = `https://www.google.com/search?q=${encodedQuery}&hl=it&num=10`;
      
      // LOG QUERY URL PER DEBUG
      logger.info('[WebSearch] 🌐 URL Google completo', { 
        query, 
        encodedQuery,
        fullUrl: googleUrl,
        delayMs: delay
      });
      
      // 🍪 Cookie di sessione Google realistico
      const sessionId = 'GOOGLE_' + Math.random().toString(36).substring(2, 15);
      const consent = Math.random().toString(36).substring(2, 10);
      const cookieValue = `CONSENT=YES+cb.${Date.now()}-14-p0.it+FX+${consent}; NID=${sessionId}; 1P_JAR=${Date.now()}`;
      
      // Fai richiesta con axios (gestisce automaticamente gzip/deflate)
      const response = await axios.get(googleUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7',
          'Accept-Encoding': 'gzip, deflate, br',
          'Connection': 'keep-alive',
          'Cookie': cookieValue,
          'Referer': 'https://www.google.com/',
          'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
          'Sec-Ch-Ua-Mobile': '?0',
          'Sec-Ch-Ua-Platform': '"Windows"',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'same-origin',
          'Sec-Fetch-User': '?1',
          'Upgrade-Insecure-Requests': '1'
        },
        timeout: 8000, // Aumentato a 8s per maggiore affidabilità
        maxRedirects: 5
      });
      
      const html = response.data;
      
      // LOG HTML RICEVUTO PER DEBUG
      logger.debug('[WebSearch] 📄 HTML ricevuto', { 
        htmlLength: html.length,
        htmlPreview: html.substring(0, 300),
        containsResults: html.includes('class="g"') || html.includes('id="search"'),
        containsH3: html.includes('<h3')
      });
      
      // Parsing con Cheerio (jQuery-like per server)
      const $ = cheerio.load(html);
      const results = [];
      
      // Selettori Google Search (multipli per robustezza)
      // Google cambia spesso la struttura HTML, usiamo più selettori
      // Aggiornati per layout 2024-2025
      const selectors = [
        'div.g',                          // Classico (ancora in uso)
        'div[data-sokoban-container]',    // Layout 2023-2024
        'div.Gx5Zad',                     // Alternativo mobile
        'div[jscontroller][data-hveid]',  // Nuovo layout 2024
        'div.MjjYud',                     // Layout organico moderno
        'div[data-async-context]',        // Risultati dinamici
        'div.tF2Cxc',                     // Container risultato standard
        'div.hlcw0c',                     // Featured snippets
        '#search div.g',                  // Fallback con context
        '#rso > div'                      // Results container diretto
      ];
      
      for (const selector of selectors) {
        const elements = $(selector);
        
        if (elements.length > 0) {
          logger.debug('[WebSearch] 🎯 Selettore funzionante', { 
            selector, 
            elementsFound: elements.length 
          });
          
          elements.each((index, element) => {
            if (results.length >= 10) return false; // Max 10 risultati
            
            const $element = $(element);
            
            // Estrai link con selettori multipli (Google cambia spesso)
            let $link = $element.find('a[href^="http"]').first();
            if (!$link.length) {
              $link = $element.find('a[href^="/url"]').first();
            }
            if (!$link.length) {
              $link = $element.find('a[jsname]').first(); // Nuovo pattern 2024
            }
            if (!$link.length) return;
            
            let url = $link.attr('href');
            if (!url) return;
            
            // Decodifica URL di redirect Google (più robusto)
            if (url.startsWith('/url?')) {
              try {
                const urlParams = new URLSearchParams(url.substring(5));
                url = urlParams.get('q') || urlParams.get('url') || url;
              } catch (e) {
                logger.debug('[WebSearch] ⚠️ Errore parsing redirect URL', { url });
                return;
              }
            }
            
            // Skip link interni Google e non validi (più completo)
            const skipDomains = ['google.com', 'youtube.com', 'maps.google', 'translate.google', 'support.google'];
            if (skipDomains.some(domain => url.includes(domain)) || 
                url.startsWith('/') || 
                !url.startsWith('http')) {
              return;
            }
            
            // Estrai titolo con selettori multipli (h3 prioritario)
            let title = '';
            const titleSelectors = ['h3', 'h2', 'div[role="heading"]', 'span[role="heading"]'];
            for (const sel of titleSelectors) {
              const $title = $element.find(sel).first();
              if ($title.length) {
                title = $title.text().trim();
                break;
              }
            }
            if (!title) {
              title = $link.text().trim();
            }
            if (!title) return;
            
            // Estrai snippet con selettori multipli (layout 2024-2025)
            const snippetSelectors = ['div[data-sncf]', 'div.VwiC3b', 'span.st', 'div.yDYNvb', 'div[style*="line-clamp"]'];
            let snippet = '';
            for (const sel of snippetSelectors) {
              const $snippet = $element.find(sel).first();
              if ($snippet.length) {
                snippet = $snippet.text().trim();
                break;
              }
            }
            
            results.push({ title, url, snippet });
          });
          
          // Se abbiamo trovato risultati, usciamo dal loop selettori
          if (results.length > 0) break;
        }
      }
      
      // 📊 Log dettagliato per debugging
      if (results.length === 0) {
        logger.warn('[WebSearch] ⚠️ Google Search: nessun risultato trovato', { 
          query,
          htmlLength: html.length,
          htmlHasContent: html.length > 1000,
          checkedSelectors: selectors.length,
          possibleBlock: html.includes('unusual traffic') || html.includes('captcha'),
          htmlSnippet: html.substring(0, 500)
        });
      } else {
        logger.info('[WebSearch] ✅ Google Search scraping completato', { 
          query,
          resultsFound: results.length,
          firstResultTitle: results[0]?.title?.substring(0, 50)
        });
      }
      
      return results;
      
    } catch (error) {
      // Google potrebbe bloccare o dare captcha
      if (error.response && error.response.status === 429) {
        logger.warn('[WebSearch] ⚠️ Google rate limit - troppi requests', {
          query,
          statusCode: error.response.status
        });
      } else {
        logger.error('[WebSearch] ❌ Errore Google Search scraping', {
          query,
          error: error.message,
          statusCode: error.response?.status
        });
      }
      
      return [];
    }
  }
  
  /**
   * Valida se un URL esiste realmente facendo una richiesta HEAD
   * Nota: Valida SOLO il dominio base per evitare 404 su pagine specifiche
   * @param {string} url - URL da validare
   * @returns {Promise<boolean>} True se l'URL esiste e risponde
   */
  static async validateUrlExists(url) {
    try {
      // 🔥 ESTRAI SOLO DOMINIO BASE (no path/pagine specifiche)
      // Esempio: https://www.birraichnusa.it/intro/ → https://www.birraichnusa.it/
      let baseUrl = url;
      try {
        const urlObj = new URL(url);
        // Ricostruisci URL con solo protocol + hostname (no path)
        baseUrl = `${urlObj.protocol}//${urlObj.hostname}${urlObj.port ? ':' + urlObj.port : ''}/`;
        
        if (baseUrl !== url) {
          logger.debug('[WebSearch] 🎯 URL normalizzato per validazione', { 
            original: url,
            base: baseUrl,
            reason: 'Evita 404 su pagine specifiche'
          });
        }
      } catch (parseError) {
        logger.warn('[WebSearch] ⚠️ Errore parsing URL, uso originale', { 
          url, 
          error: parseError.message 
        });
        // Se parsing fallisce, usa URL originale come fallback
      }
      
      // Usa axios con timeout ridotto (2 secondi) per performance
      const response = await axios.get(baseUrl, {
        timeout: 2000,
        maxRedirects: 3,
        validateStatus: (status) => status >= 200 && status < 400,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'it-IT,it;q=0.9,en;q=0.8',
          // Cookie per bypassare disclaimer età comuni
          'Cookie': 'age_verified=1; age_gate=true; age_check=yes; over18=true'
        }
      });
      
      const html = response.data;
      
      // Verifica presenza disclaimer età
      const hasAgeDisclaimer = html.toLowerCase().includes('età') ||
                               html.toLowerCase().includes('maggiorenne') ||
                               html.toLowerCase().includes('age verification') ||
                               html.toLowerCase().includes('18+') ||
                               html.toLowerCase().includes('21+');
      
      if (hasAgeDisclaimer) {
        logger.debug('[WebSearch] ⚠️ Sito con disclaimer età rilevato', { 
          url: baseUrl,
          note: 'Cookie age_verified inviato per bypass'
        });
      }
      
      logger.debug('[WebSearch] ✅ URL valido', { 
        url: baseUrl, 
        statusCode: response.status,
        hasAgeDisclaimer
      });
      
      return true;
      
    } catch (error) {
      if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
        logger.debug('[WebSearch] ⏱️ URL timeout', { url, timeout: '2s' });
      } else {
        logger.debug('[WebSearch] ❌ URL non valido', { 
          url, 
          error: error.message 
        });
      }
      return false;
    }
  }

  /**
   * Valida che le birre appartengano realmente al birrificio controllando fonti affidabili
   * @param {Array} beers - Lista birre da validare
   * @param {string} breweryName - Nome del birrificio
   * @returns {Promise<Object>} Risultato validazione con birre confermate
   */
  static async validateBreweryBeers(beers, breweryName) {
    try {
      logger.info('[WebSearch] 🔍 Validazione birre del birrificio', {
        breweryName,
        beersToValidate: beers.length
      });

      // Crea prompt per verificare quali birre sono realmente prodotte dal birrificio
      const validationPrompt = `Verifica quali delle seguenti birre sono effettivamente prodotte dal birrificio "${breweryName}":

BIRRE DA VERIFICARE:
${beers.map((beer, index) => `${index + 1}. ${beer.beerName} (${beer.beerType || 'Tipo sconosciuto'})`).join('\n')}

ISTRUZIONI CRITICHE:
1. Cerca SOLO su fonti ufficiali e affidabili (sito web birrificio, Wikipedia, RateBeer, Untappd)
2. Per ogni birra, indica se è confermata o no
3. NON accettare birre che non trovi nelle fonti ufficiali
4. Se una birra non è confermata, NON inventare dettagli

OUTPUT JSON RICHIESTO:
{
  "breweryName": "${breweryName}",
  "validatedBeers": [
    {
      "beerName": "Nome birra confermato",
      "beerType": "Tipo confermato",
      "alcoholContent": 5.5,
      "confirmed": true,
      "source": "URL fonte"
    }
  ],
  "rejectedBeers": [
    {
      "beerName": "Nome birra non confermata",
      "reason": "Non trovata nelle fonti ufficiali"
    }
  ],
  "confidence": 0.9
}`;

      const model = genAI.getGenerativeModel({ 
        model: 'gemini-2.0-flash-exp',
        generationConfig: {
          temperature: 0.1,
          topK: 1,
          topP: 0.8,
          maxOutputTokens: 2048,
        }
      });

      const result = await model.generateContent(validationPrompt);
      const response = await result.response;
      const text = response.text();

      // Parse JSON - Migliorato per gestire risposte AI con testo aggiuntivo
      let validationResult;
      try {
        // Prima prova: estrai solo il blocco JSON tra ```json e ```
        let jsonText = text.match(/```json\s*(\{[\s\S]*?\})\s*```/);
        if (jsonText && jsonText[1]) {
          jsonText = jsonText[1];
        } else {
          // Fallback: rimuovi markdown e cerca primo oggetto JSON
          jsonText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
          // Trova il primo oggetto JSON valido
          const jsonMatch = jsonText.match(/\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/);
          if (jsonMatch) {
            jsonText = jsonMatch[0];
          }
        }

        validationResult = JSON.parse(jsonText);
      } catch (parseError) {
        logger.error('[WebSearch] ❌ Errore parsing validazione birre', { 
          error: parseError.message,
          breweryName
        });
        // In caso di errore parsing, rifiuta tutte le birre
        return {
          validatedBeers: [],
          rejectedBeers: beers.map(beer => ({
            beerName: beer.beerName,
            reason: 'Errore validazione'
          })),
          confidence: 0
        };
      }

      logger.info('[WebSearch] ✅ Validazione birre completata', {
        breweryName,
        validatedCount: validationResult.validatedBeers?.length || 0,
        rejectedCount: validationResult.rejectedBeers?.length || 0,
        confidence: validationResult.confidence
      });

      return {
        validatedBeers: validationResult.validatedBeers || [],
        rejectedBeers: validationResult.rejectedBeers || [],
        confidence: validationResult.confidence || 0
      };

    } catch (error) {
      logger.error('[WebSearch] ❌ Errore validazione birre', {
        error: error.message,
        breweryName
      });
      // In caso di errore, rifiuta tutte le birre
      return {
        validatedBeers: [],
        rejectedBeers: beers.map(beer => ({
          beerName: beer.beerName,
          reason: 'Errore validazione'
        })),
        confidence: 0
      };
    }
  }
  /**
   * Ricerca completa di un birrificio basata su dati parziali
   * @param {Object} partialData - Dati parziali estratti dall'AI
   * @param {string} partialData.name - Nome parziale o completo del birrificio
   * @param {string} [partialData.location] - Località se disponibile
   * @param {string} [partialData.website] - Sito web se disponibile
   * @returns {Promise<Object>} Dati completi del birrificio con fonte
   */
  static async searchBrewery(partialData) {
    try {
      logger.info('[WebSearch] 🔍 Ricerca birrificio avviata', { 
        name: partialData.name,
        location: partialData.location 
      });

      // STEP 1: Ricerca nel database interno (prioritaria)
      const dbResult = await this.searchBreweryInDatabase(partialData.name);
      if (dbResult.found) {
        logger.info('[WebSearch] ✅ Birrificio trovato nel database', { 
          breweryId: dbResult.brewery._id,
          name: dbResult.brewery.breweryName 
        });
        
        return {
          found: true,
          source: 'DATABASE',
          confidence: 1.0,
          brewery: {
            breweryName: dbResult.brewery.breweryName,
            breweryWebsite: dbResult.brewery.breweryWebsite,
            breweryLegalAddress: dbResult.brewery.breweryLegalAddress,
            breweryEmail: dbResult.brewery.breweryEmail,
            breweryPhoneNumber: dbResult.brewery.breweryPhoneNumber,
            breweryDescription: dbResult.brewery.breweryDescription,
            foundingYear: dbResult.brewery.foundingYear,
            _id: dbResult.brewery._id,
            verified: true,
            existsInDb: true
          },
          matchType: dbResult.matchType
        };
      }

      // STEP 2: Ricerca web con API Google (se configurata)
      // TODO: Implementare quando si attiva API Google Custom Search
      const webResult = await this.searchBreweryOnWeb(partialData.name, partialData.location);
      
      if (webResult.found) {
        logger.info('[WebSearch] ✅ Birrificio trovato sul web', { 
          name: webResult.brewery.breweryName,
          source: webResult.source 
        });
        
        return {
          found: true,
          source: 'WEB',
          confidence: webResult.confidence,
          brewery: webResult.brewery,
          verified: true,
          existsInDb: false,
          webSources: webResult.sources
        };
      }

      // STEP 3: Nessun risultato trovato
      logger.warn('[WebSearch] ⚠️ Nessun risultato trovato per il birrificio', { 
        name: partialData.name 
      });
      
      return {
        found: false,
        source: 'NONE',
        confidence: 0,
        brewery: null,
        suggestion: {
          message: 'Birrificio non trovato. Potrebbe essere un birrificio nuovo o il nome potrebbe essere incompleto.',
          action: 'USER_CONFIRMATION_REQUIRED'
        }
      };

    } catch (error) {
      logger.error('[WebSearch] ❌ Errore durante la ricerca birrificio', error);
      throw error;
    }
  }

  /**
   * Ricerca birrificio nel database interno
   * @param {string} name - Nome del birrificio da cercare
   * @returns {Promise<Object>} Risultato della ricerca
   */
  static async searchBreweryInDatabase(name) {
    try {
      if (!name || name.trim().length === 0) {
        return { found: false };
      }

      const searchName = name.trim();

      // Ricerca EXACT match (case-insensitive)
      let brewery = await Brewery.findOne({
        breweryName: { $regex: new RegExp(`^${searchName}$`, 'i') }
      });

      if (brewery) {
        return { 
          found: true, 
          brewery, 
          matchType: 'EXACT' 
        };
      }

      // Ricerca PARTIAL match (contiene il nome)
      brewery = await Brewery.findOne({
        breweryName: { $regex: new RegExp(searchName.replace(/\s+/g, '\\s*'), 'i') }
      });

      if (brewery) {
        return { 
          found: true, 
          brewery, 
          matchType: 'PARTIAL' 
        };
      }

      // Ricerca FUZZY (nome simile)
      const allBreweries = await Brewery.find({}).limit(100);
      const fuzzyMatch = allBreweries.find(b => {
        const similarity = this.calculateStringSimilarity(
          searchName.toLowerCase(),
          b.breweryName.toLowerCase()
        );
        return similarity > 0.7; // 70% similarità
      });

      if (fuzzyMatch) {
        return { 
          found: true, 
          brewery: fuzzyMatch, 
          matchType: 'FUZZY' 
        };
      }

      return { found: false };

    } catch (error) {
      logger.error('[WebSearch] Errore ricerca database', error);
      return { found: false };
    }
  }

  /**
   * Ricerca birrificio sul web usando SISTEMA MULTI-STRATEGIA INTELLIGENTE
   * Combina: DuckDuckGo scraping + HTMLParser + Database fuzzy matching
   * NON USA PIÙ GEMINI AI - Se non trova dati, salva con needsValidation per admin
   * 
   * 🔥 P0.1 FIX (7 dic 2025): Estrae il VERO nome birrificio dai risultati
   * NON usa più il searchTerm "beerName birrificio produttore" come nome
   * 
   * @param {string} name - Nome/query di ricerca (es: "Ichnusa Non Filtrata birrificio produttore")
   * @param {string} [location] - Località opzionale
   * @returns {Promise<Object>} Risultato della ricerca web
   */
  static async searchBreweryOnWeb(name, location = '') {
    try {
      logger.info('[WebSearch] 🌐 Ricerca web con Google Search scraping', { name, location });

      // STEP 1: Trova il sito web ufficiale con Google Search SCRAPING (GRATIS)
      logger.info('[WebSearch] 🔍 STEP 1: Google Search scraping per sito web', { name });
      
      // Costruisci query di ricerca
      const searchQuery = `${name} birrificio${location ? ` ${location}` : ''} sito ufficiale`;
      
      // Scraping DuckDuckGo (più affidabile)
      let searchResults = await this.scrapeDuckDuckGo(searchQuery);
      
      // Fallback a Google se DDG non trova nulla
      if (!searchResults || searchResults.length === 0) {
        logger.warn('[WebSearch] ⚠️ DuckDuckGo senza risultati, provo Google', { searchQuery });
        searchResults = await this.scrapeGoogleSearch(searchQuery);
      }
      
      const googleResults = searchResults; // Compatibilità con codice esistente
      
      // 🔥 P0.1 FIX: Estrai il VERO nome del birrificio dai risultati
      let realBreweryName = this.extractRealBreweryName(googleResults, name);
      
      // Se non estratto, pulisci almeno "birrificio produttore" dal nome
      if (!realBreweryName) {
        realBreweryName = name
          .replace(/\s*birrificio\s*produttore\s*$/i, '')
          .replace(/\s*birrificio\s*$/i, '')
          .trim();
        logger.warn('[WebSearch] ⚠️ P0.1: Nome birrificio non estratto, uso fallback pulito', {
          original: name,
          cleaned: realBreweryName
        });
      }
      
      logger.info('[WebSearch] 🎯 P0.1: Nome birrificio FINALE', {
        searchQuery: name,
        realBreweryName: realBreweryName
      });
      
      let websiteData = { websiteUrl: null, confidence: 0 };
      
      if (googleResults && googleResults.length > 0) {
        // Analizza i primi risultati per trovare il sito ufficiale
        for (const result of googleResults.slice(0, 3)) { // Ridotto a 3 per timeout
          const url = result.url;
          const title = result.title.toLowerCase();
          const snippet = result.snippet.toLowerCase();
          
          // Verifica se è probabile il sito ufficiale
          const nameWords = name.toLowerCase().split(' ').filter(w => w.length > 2);
          const hasNameInUrl = nameWords.some(word => url.toLowerCase().includes(word));
          const hasNameInTitle = nameWords.some(word => title.includes(word));
          
          // Esclusioni (directory, social, marketplace)
          const isExcluded = url.includes('untappd.com') || 
                            url.includes('ratebeer.com') ||
                            url.includes('facebook.com') ||
                            url.includes('instagram.com') ||
                            url.includes('tripadvisor') ||
                            url.includes('wikipedia.org');
          
          if (!isExcluded && (hasNameInUrl || hasNameInTitle)) {
            websiteData = {
              websiteUrl: this.normalizeToBaseUrl(url),  // 🔥 Normalizza subito al dominio base
              confidence: hasNameInUrl ? 0.9 : 0.7
            };
            logger.info('[WebSearch] ✅ Sito web probabile trovato', {
              originalUrl: url,
              baseUrl: websiteData.websiteUrl,
              title: result.title,
              confidence: websiteData.confidence
            });
            break;
          }
        }
      }

      if (!websiteData.websiteUrl) {
        logger.warn('[WebSearch] ⚠️ STEP 1: Nessun sito web trovato nei risultati Google', { name });
      }

      logger.info('[WebSearch] 📡 STEP 1 completato', { 
        websiteFound: !!websiteData.websiteUrl,
        url: websiteData.websiteUrl,
        confidence: websiteData.confidence
      });

      // STEP 2: USA SISTEMA MULTI-STRATEGIA per verificare indirizzo
      logger.info('[WebSearch] 🎯 STEP 2: Verifica multi-strategia indirizzo (HTMLParser + DB)');
      
      const verificationResult = await AddressVerificationService.verifyBreweryAddress({
        name: name,
        website: websiteData.websiteUrl,
        currentAddress: null // Non abbiamo indirizzo corrente qui
      });

      // STEP 3: Se verifica multi-strategia ha successo con alta confidence, USA QUEI DATI
      if (verificationResult.found && verificationResult.confidence >= 0.7) {
        logger.info('[WebSearch] ✅ Indirizzo VERIFICATO con alta confidence', {
          source: verificationResult.source,
          confidence: verificationResult.confidence,
          address: verificationResult.address,
          // 🔥 P0.2: Log nuovi campi estratti
          foundingYear: verificationResult.foundingYear,
          hasDescription: !!verificationResult.description,
          hasHistory: !!verificationResult.history,
          hasSocialMedia: !!verificationResult.socialMedia,
          verificationMethod: verificationResult.verificationMethod
        });

        return {
          found: true,
          confidence: verificationResult.confidence,
          source: verificationResult.source,
          brewery: {
            breweryName: realBreweryName, // 🔥 P0.1 FIX: Usa nome REALE estratto
            breweryWebsite: this.normalizeToBaseUrl(websiteData.websiteUrl || verificationResult.sourceUrl),
            breweryLegalAddress: verificationResult.address,
            breweryEmail: verificationResult.email || null,
            breweryPhoneNumber: verificationResult.phone || null,
            // 🔥 P0.2 FIX: Mappa TUTTI i dati da HTMLParser
            breweryDescription: verificationResult.description || null,
            foundingYear: verificationResult.foundingYear || null,
            history: verificationResult.history || null,
            brewerySize: verificationResult.brewerySize || null,
            employeeCount: verificationResult.employeeCount || null,
            productionVolume: verificationResult.productionVolume || null,
            masterBrewer: verificationResult.masterBrewer || null,
            // 🔥 FIX 1 FEB 2026: NON passare social da HTMLParser - spesso link errati/inesistenti
            // I social verranno popolati SOLO da GSR (Google Search Retrieval)
            // brewerySocialMedia: verificationResult.socialMedia || {},
            brewerySocialMedia: {},
            mainProducts: verificationResult.mainProducts || [],
            awards: verificationResult.awards || [],
            breweryFiscalCode: verificationResult.fiscalCode || null,
            breweryREAcode: verificationResult.reaCode || null,
            breweryacciseCode: verificationResult.acciseCode || null
          },
          sources: verificationResult.sourceUrl ? [verificationResult.sourceUrl] : [],
          dataQuality: 'VERIFIED_' + verificationResult.source,
          verificationMethod: verificationResult.verificationMethod
        };
      }

      // STEP 4 RIMOSSO: Non usiamo più Gemini AI per ricerca web
      // Se arriviamo qui, non abbiamo trovato dati sufficienti
      // Restituiamo found: false per permettere salvataggio con needsValidation
      
      logger.warn('[WebSearch] ⚠️ Nessun dato trovato con metodi diretti', {
        breweryName: realBreweryName, // 🔥 P0.1 FIX: Usa nome REALE
        originalSearch: name,
        location: location,
        multiStrategyFound: verificationResult.found,
        multiStrategyConfidence: verificationResult.confidence
      });

      // Se abbiamo almeno qualche dato dalla verifica multi-strategia, usiamo quello
      if (verificationResult.found && verificationResult.confidence > 0) {
        logger.info('[WebSearch] ✅ Uso dati da verifica multi-strategia', {
          confidence: verificationResult.confidence,
          hasAddress: !!verificationResult.address,
          source: verificationResult.source
        });

        return {
          found: true,
          confidence: verificationResult.confidence,
          source: verificationResult.source,
          brewery: {
            breweryName: realBreweryName, // 🔥 P0.1 FIX: Usa nome REALE estratto
            breweryWebsite: this.normalizeToBaseUrl(websiteData.websiteUrl || null),
            breweryLegalAddress: verificationResult.address || null,
            breweryEmail: verificationResult.email || null,
            breweryPhoneNumber: verificationResult.phone || null,
            // 🔥 P0.2 FIX: Mappa TUTTI i dati da HTMLParser
            breweryDescription: verificationResult.description || null,
            foundingYear: verificationResult.foundingYear || null,
            history: verificationResult.history || null,
            brewerySize: verificationResult.brewerySize || null,
            employeeCount: verificationResult.employeeCount || null,
            productionVolume: verificationResult.productionVolume || null,
            masterBrewer: verificationResult.masterBrewer || null,
            // 🔥 FIX 1 FEB 2026: NON passare social da HTMLParser - spesso link errati/inesistenti
            // I social verranno popolati SOLO da GSR (Google Search Retrieval)
            // brewerySocialMedia: verificationResult.socialMedia || {},
            brewerySocialMedia: {},
            mainProducts: verificationResult.mainProducts || [],
            awards: verificationResult.awards || [],
            breweryFiscalCode: verificationResult.fiscalCode || null,
            breweryREAcode: verificationResult.reaCode || null,
            breweryacciseCode: verificationResult.acciseCode || null
          },
          sources: verificationResult.sourceUrl ? [verificationResult.sourceUrl] : [],
          dataQuality: 'VERIFIED_' + verificationResult.source,
          verificationMethod: verificationResult.verificationMethod
        };
      }

      // Nessun dato trovato - restituisci found: false per salvataggio con needsValidation
      logger.info('[WebSearch] 📝 Salvataggio con needsValidation - admin dovrà completare', {
        breweryName: realBreweryName, // 🔥 P0.1 FIX: Usa nome REALE
        originalSearch: name,
        reason: 'Nessun dato trovato da metodi diretti'
      });

      return { 
        found: false, 
        confidence: 0, 
        brewery: null,
        needsValidation: true,
        validationReason: 'Nessun dato trovato con metodi diretti (DuckDuckGo, HTMLParser, Database)',
        reason: 'Nessun dato trovato con metodi diretti (DuckDuckGo, HTMLParser, Database)'
      };

    } catch (error) {
      logger.error('[WebSearch] ❌ Errore ricerca web', {
        error: error.message,
        stack: error.stack
      });
      return { 
        found: false, 
        confidence: 0, 
        brewery: null,
        needsValidation: true,
        validationReason: 'Errore durante ricerca web: ' + error.message,
        reason: 'Errore durante ricerca web: ' + error.message
      };
    }
  }

  /**
   * Calcola similarità tra due stringhe (algoritmo Levenshtein semplificato)
   * @param {string} str1 - Prima stringa
   * @param {string} str2 - Seconda stringa
   * @returns {number} Similarità tra 0 e 1
   */
  static calculateStringSimilarity(str1, str2) {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) {
      return 1.0;
    }
    
    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  /**
   * Calcola distanza di Levenshtein tra due stringhe
   * @param {string} str1 - Prima stringa
   * @param {string} str2 - Seconda stringa
   * @returns {number} Distanza di editing
   */
  static levenshteinDistance(str1, str2) {
    const matrix = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }

  /**
   * Ricerca birra nel database o web con Gemini AI
   * @param {Object} partialData - Dati parziali della birra
   * @param {string} breweryId - ID del birrificio a cui appartiene
   * @returns {Promise<Object>} Risultato della ricerca birra
   */
  static async searchBeer(partialData, breweryId) {
    try {
      logger.info('[WebSearch] 🔍 Ricerca birra avviata', { 
        beerName: partialData.beerName,
        breweryId 
      });

      // STEP 1: Ricerca nel database (prioritaria)
      const brewery = await Brewery.findById(breweryId);
      
      if (brewery && brewery.breweryProducts) {
        const beer = brewery.breweryProducts.find(p => 
          p.beerName.toLowerCase().includes(partialData.beerName.toLowerCase())
        );

        if (beer) {
          logger.info('[WebSearch] ✅ Birra trovata nel database', { 
            beerId: beer._id,
            name: beer.beerName 
          });
          
          return {
            found: true,
            source: 'DATABASE',
            confidence: 1.0,
            beer: beer,
            verified: true
          };
        }
      }

      // STEP 2: Ricerca web con Gemini AI
      const breweryName = brewery ? brewery.breweryName : 'birrificio sconosciuto';
      const webResult = await this.searchBeerOnWeb(partialData.beerName, breweryName);
      
      if (webResult.found) {
        logger.info('[WebSearch] ✅ Birra trovata sul web', {
          name: webResult.beer.beerName,
          confidence: webResult.confidence
        });
        
        return {
          found: true,
          source: 'WEB',
          confidence: webResult.confidence,
          beer: webResult.beer,
          verified: false,
          webSources: webResult.sources
        };
      }
      
      return {
        found: false,
        source: 'NONE',
        confidence: 0,
        beer: null
      };

    } catch (error) {
      logger.error('[WebSearch] Errore ricerca birra', error);
      throw error;
    }
  }

  /**
   * Ottiene lista completa birre del birrificio e trova la migliore corrispondenza
   * @param {string} beerNameFromLabel - Nome birra estratto dall'etichetta (potenzialmente errato)
   * @param {string} verifiedBreweryName - Nome VERIFICATO del birrificio
   * @param {string} [beerTypeFromLabel] - Tipo birra dall'etichetta (opzionale)
   * @returns {Promise<Object>} Birra più simile tra quelle del birrificio
   */
  static async findBestMatchingBeer(beerNameFromLabel, verifiedBreweryName, beerTypeFromLabel = null) {
    try {
      logger.info('[WebSearch] 🎯 Ricerca birra migliore match per birrificio', { 
        beerNameFromLabel, 
        verifiedBreweryName,
        beerTypeFromLabel 
      });

      // Crea prompt per ottenere LISTA COMPLETA birre del birrificio
      const prompt = `Cerca sul web e restituisci la lista ESATTA delle birre prodotte dal birrificio "${verifiedBreweryName}".

CRITICO: NON INVENTARE birre che non esistono. Usa SOLO informazioni da fonti ufficiali verificate.

ISTRUZIONI CRITICHE:
1. Cerca informazioni SOLO da fonti ufficiali e affidabili (sito web birrificio, Wikipedia, RateBeer, Untappd)
2. Restituisci SOLO le birre che trovi effettivamente in queste fonti
3. NON inventare nomi di birre, tipi, o descrizioni
4. Se non trovi informazioni sufficienti, restituisci array beers vuoto
5. Verifica che ogni birra sia effettivamente prodotta da questo birrificio specifico
6. NON copiare birre da birrifici simili o con nomi simili

OUTPUT JSON RICHIESTO:
{
  "found": true/false,
  "breweryName": "${verifiedBreweryName}",
  "beers": [
    {
      "beerName": "Nome esatto trovato nella fonte",
      "beerType": "Tipo esatto trovato nella fonte",
      "alcoholContent": 5.5,
      "beerDescription": "Descrizione esatta dalla fonte",
      "ibu": 40,
      "color": "Colore dalla fonte"
    }
  ],
  "sources": ["url1", "url2"],
  "confidence": 0.9
}

IMPORTANTE: Se non sei sicuro che una birra appartenga al birrificio, NON includerla nella lista.`;

      const model = genAI.getGenerativeModel({ 
        model: 'gemini-2.0-flash-exp',
        generationConfig: {
          temperature: 0.1,
          topK: 1,
          topP: 0.8,
          maxOutputTokens: 2048, // Aumentato per lista completa
        }
      });

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      logger.info('[WebSearch] 📡 Lista birre ricevuta', { 
        responseLength: text.length 
      });

      // Parse JSON - Migliorato per gestire risposte AI con testo aggiuntivo
      let breweryBeersData;
      try {
        // Prima prova: estrai solo il blocco JSON tra ```json e ```
        let jsonText = text.match(/```json\s*(\{[\s\S]*?\})\s*```/);
        if (jsonText && jsonText[1]) {
          jsonText = jsonText[1];
        } else {
          // Fallback: rimuovi markdown e cerca primo oggetto JSON
          jsonText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
          // Trova il primo oggetto JSON valido
          const jsonMatch = jsonText.match(/\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/);
          if (jsonMatch) {
            jsonText = jsonMatch[0];
          }
        }

        breweryBeersData = JSON.parse(jsonText);
      } catch (parseError) {
        logger.error('[WebSearch] ❌ Errore parsing JSON lista birre', {
          error: parseError.message,
          rawText: text.substring(0, 1000) // Mostra più contesto per debug
        });
        return { found: false, confidence: 0, beer: null };
      }

      // Validazione base
      if (!breweryBeersData.found || !breweryBeersData.beers || breweryBeersData.beers.length === 0) {
        logger.warn('[WebSearch] ⚠️ Nessuna birra trovata per il birrificio', {
          breweryName: verifiedBreweryName,
          found: breweryBeersData.found
        });
        return { found: false, confidence: 0, beer: null };
      }

      logger.info('[WebSearch] 📋 Birre trovate per birrificio', {
        breweryName: verifiedBreweryName,
        totalBeers: breweryBeersData.beers.length,
        beerNames: breweryBeersData.beers.map(b => b.beerName)
      });

      // � NUOVO: Valida che le birre appartengano realmente al birrificio
      if (breweryBeersData.beers && breweryBeersData.beers.length > 0) {
        logger.info('[WebSearch] 🔍 Validazione birre appartenenza al birrificio', {
          breweryName: verifiedBreweryName,
          beersFound: breweryBeersData.beers.length
        });

        const validationResult = await this.validateBreweryBeers(breweryBeersData.beers, verifiedBreweryName);
        
        // Usa solo le birre validate
        const validatedBeers = validationResult.validatedBeers || [];
        
        logger.info('[WebSearch] ✅ Validazione birre completata', {
          breweryName: verifiedBreweryName,
          originalBeers: breweryBeersData.beers.length,
          validatedBeers: validatedBeers.length,
          rejectedBeers: validationResult.rejectedBeers?.length || 0,
          validatedBeerNames: validatedBeers.map(b => b.beerName),
          rejectedBeerNames: validationResult.rejectedBeers?.map(b => b.beerName) || []
        });

        // Se nessuna birra validata, considera fallimento
        if (validatedBeers.length === 0) {
          logger.warn('[WebSearch] ❌ Nessuna birra validata per il birrificio', {
            breweryName: verifiedBreweryName,
            rejectedCount: validationResult.rejectedBeers?.length || 0
          });
          return { found: false, confidence: 0, beer: null };
        }

        // Aggiorna i dati con solo le birre validate
        breweryBeersData.beers = validatedBeers;
        breweryBeersData.confidence *= validationResult.confidence;
      }

      // �🔍 LOG DETTAGLIATO DI TUTTE LE BIRRE TROVATE E VALIDATE
      logger.info('[WebSearch] 📋 === DETTAGLIO COMPLETO BIRRE VALIDATE ===', {
        breweryName: verifiedBreweryName,
        totalBeers: breweryBeersData.beers.length,
        confidence: breweryBeersData.confidence,
        sources: breweryBeersData.sources
      });

      breweryBeersData.beers.forEach((beer, index) => {
        logger.info(`[WebSearch] 🍺 Birra #${index + 1}:`, {
          beerName: beer.beerName,
          beerType: beer.beerType || 'N/A',
          alcoholContent: beer.alcoholContent || 'N/A',
          beerDescription: beer.beerDescription || 'N/A',
          ibu: beer.ibu || 'N/A',
          color: beer.color || 'N/A'
        });
      });

      logger.info('[WebSearch] 📋 === FINE DETTAGLIO BIRRE VALIDATE ===');

      // 🎯 MATCHING INTELLIGENTE: Trova la birra più simile al nome dall'etichetta
      const matchingResult = this.findBestBeerMatch(beerNameFromLabel, breweryBeersData.beers, beerTypeFromLabel);
      
      if (!matchingResult.found) {
        logger.warn('[WebSearch] ❌ Nessun match sufficiente trovato', {
          beerNameFromLabel,
          beerTypeFromLabel,
          totalBeersChecked: breweryBeersData.beers.length,
          bestSimilarity: matchingResult.bestSimilarity,
          threshold: matchingResult.threshold
        });
        return { found: false, confidence: 0, beer: null };
      }

      logger.info('[WebSearch] ✅ Birra migliore match trovata!', {
        beerNameFromLabel,
        beerTypeFromLabel,
        matchedBeerName: matchingResult.beer.beerName,
        matchType: matchingResult.matchType,
        similarity: matchingResult.similarity.toFixed(3),
        typeMatch: matchingResult.typeMatch,
        totalBeersChecked: breweryBeersData.beers.length
      });

      return {
        found: true,
        confidence: Math.min(matchingResult.similarity * breweryBeersData.confidence, 1.0), // Combina similarità con confidence ricerca
        source: 'GEMINI_WEB_SEARCH_BEST_MATCH',
        beer: matchingResult.beer,
        sources: breweryBeersData.sources || [],
        matchingInfo: {
          beerNameFromLabel,
          beerTypeFromLabel,
          totalBeersChecked: breweryBeersData.beers.length,
          matchType: matchingResult.matchType,
          similarity: matchingResult.similarity,
          typeMatch: matchingResult.typeMatch,
          allBeersFound: breweryBeersData.beers.map(b => b.beerName)
        }
      };

    } catch (error) {
      logger.error('[WebSearch] ❌ Errore ricerca best matching beer', {
        error: error.message,
        beerNameFromLabel,
        verifiedBreweryName
      });
      return { found: false, confidence: 0, beer: null };
    }
  }

  /**
   * Algoritmo intelligente di matching birre con logica multi-step
   * @param {string} beerNameFromLabel - Nome dalla etichetta
   * @param {Array} breweryBeers - Lista birre del birrificio
   * @param {string} [beerTypeFromLabel] - Tipo dalla etichetta
   * @returns {Object} Risultato matching con dettagli
   */
  static findBestBeerMatch(beerNameFromLabel, breweryBeers, beerTypeFromLabel = null) {
    const normalizedLabelName = this.normalizeBeerName(beerNameFromLabel);
    const normalizedLabelType = beerTypeFromLabel ? this.normalizeBeerType(beerTypeFromLabel) : null;
    
    logger.debug('[WebSearch] 🔍 Inizio matching intelligente', {
      labelName: beerNameFromLabel,
      normalizedLabelName,
      labelType: beerTypeFromLabel,
      normalizedLabelType,
      totalBeers: breweryBeers.length
    });

    let bestMatch = null;
    let bestSimilarity = 0;
    let bestMatchType = 'NONE';
    let bestTypeMatch = false;

    // FASE 1: CORRISPONDENZA ESATTA (ignorando case, spazi, punteggiatura)
    for (const beer of breweryBeers) {
      const normalizedBeerName = this.normalizeBeerName(beer.beerName);
      
      if (normalizedLabelName === normalizedBeerName) {
        logger.debug('[WebSearch] 🎯 CORRISPONDENZA ESATTA trovata', {
          labelName: beerNameFromLabel,
          beerName: beer.beerName,
          normalizedMatch: normalizedLabelName
        });
        
        return {
          found: true,
          beer: beer,
          similarity: 1.0,
          matchType: 'EXACT_MATCH',
          typeMatch: this.checkTypeMatch(normalizedLabelType, beer.beerType),
          threshold: 1.0
        };
      }
    }

    // FASE 2: CORRISPONDENZA PARZIALE (una contiene l'altra completamente)
    for (const beer of breweryBeers) {
      const normalizedBeerName = this.normalizeBeerName(beer.beerName);
      
      if (normalizedLabelName.includes(normalizedBeerName) || normalizedBeerName.includes(normalizedLabelName)) {
        const typeMatch = this.checkTypeMatch(normalizedLabelType, beer.beerType);
        const similarity = Math.max(
          normalizedBeerName.length / normalizedLabelName.length,
          normalizedLabelName.length / normalizedBeerName.length
        );
        
        logger.debug('[WebSearch] � CORRISPONDENZA PARZIALE trovata', {
          labelName: beerNameFromLabel,
          beerName: beer.beerName,
          similarity: similarity.toFixed(3),
          typeMatch
        });
        
        if (similarity > bestSimilarity) {
          bestMatch = beer;
          bestSimilarity = similarity;
          bestMatchType = 'PARTIAL_CONTAINS';
          bestTypeMatch = typeMatch;
        }
      }
    }

    // Se abbiamo una corrispondenza parziale buona (>= 0.8), usala
    if (bestMatch && bestSimilarity >= 0.8) {
      logger.debug('[WebSearch] ✅ CORRISPONDENZA PARZIALE accettata', {
        labelName: beerNameFromLabel,
        beerName: bestMatch.beerName,
        similarity: bestSimilarity.toFixed(3),
        typeMatch: bestTypeMatch
      });
      
      return {
        found: true,
        beer: bestMatch,
        similarity: bestSimilarity,
        matchType: bestMatchType,
        typeMatch: bestTypeMatch,
        threshold: 0.8
      };
    }

    // FASE 3: MATCHING FUZZY con algoritmo Levenshtein
    for (const beer of breweryBeers) {
      const normalizedBeerName = this.normalizeBeerName(beer.beerName);
      const similarity = this.calculateStringSimilarity(normalizedLabelName, normalizedBeerName);
      const typeMatch = this.checkTypeMatch(normalizedLabelType, beer.beerType);
      
      // Bonus per match di tipo (+0.1 alla similarità)
      const adjustedSimilarity = typeMatch ? Math.min(similarity + 0.1, 1.0) : similarity;
      
      logger.debug('[WebSearch] 🔍 Calcolo similarità fuzzy', {
        labelName: beerNameFromLabel,
        beerName: beer.beerName,
        normalizedLabel: normalizedLabelName,
        normalizedBeer: normalizedBeerName,
        rawSimilarity: similarity.toFixed(3),
        adjustedSimilarity: adjustedSimilarity.toFixed(3),
        typeMatch,
        levenshteinDistance: this.levenshteinDistance(normalizedLabelName, normalizedBeerName)
      });

      if (adjustedSimilarity > bestSimilarity) {
        bestMatch = beer;
        bestSimilarity = adjustedSimilarity;
        bestMatchType = 'FUZZY_MATCH';
        bestTypeMatch = typeMatch;
      }
    }

    // FASE 4: DETERMINAZIONE SOGLIA ADATTIVA
    // La soglia dipende dalla lunghezza del nome: nomi più lunghi possono avere similarità più bassa
    const nameLength = normalizedLabelName.length;
    let threshold;
    
    if (nameLength <= 5) {
      // Nomi molto corti (es: "IPA", "Lager") - soglia alta
      threshold = 0.9;
    } else if (nameLength <= 10) {
      // Nomi corti (es: "Heineken") - soglia media-alta
      threshold = 0.7; // RIDOTTO da 0.75 a 0.7 per casi come SUDIGIR vs SUDIGIRI
    } else if (nameLength <= 20) {
      // Nomi medi (es: "Peroni Nastro Azzurro") - soglia media
      threshold = 0.6;
    } else {
      // Nomi lunghi (es: "Birra Moretti La Rossa Doppio Malto") - soglia più bassa
      threshold = 0.5;
    }

    // Bonus per match di tipo (-0.1 alla soglia)
    if (bestTypeMatch) {
      threshold = Math.max(threshold - 0.1, 0.3);
    }

    logger.debug('[WebSearch] 📊 Determinazione soglia adattiva', {
      labelName: beerNameFromLabel,
      nameLength,
      baseThreshold: threshold + (bestTypeMatch ? 0.1 : 0),
      finalThreshold: threshold,
      bestSimilarity: bestSimilarity.toFixed(3),
      typeMatch: bestTypeMatch
    });

    // Valutazione finale
    if (bestMatch && bestSimilarity >= threshold) {
      logger.debug('[WebSearch] ✅ MATCHING SUCCESSO', {
        labelName: beerNameFromLabel,
        beerName: bestMatch.beerName,
        matchType: bestMatchType,
        similarity: bestSimilarity.toFixed(3),
        threshold: threshold.toFixed(3),
        typeMatch: bestTypeMatch
      });
      
      return {
        found: true,
        beer: bestMatch,
        similarity: bestSimilarity,
        matchType: bestMatchType,
        typeMatch: bestTypeMatch,
        threshold: threshold
      };
    }

    // Nessun match sufficiente trovato
    logger.debug('[WebSearch] ❌ NESSUN MATCH SUFFICIENTE', {
      labelName: beerNameFromLabel,
      bestSimilarity: bestSimilarity.toFixed(3),
      threshold: threshold.toFixed(3),
      bestMatchName: bestMatch?.beerName
    });

    return {
      found: false,
      beer: null,
      similarity: bestSimilarity,
      matchType: 'NO_MATCH',
      typeMatch: false,
      threshold: threshold
    };
  }

  /**
   * Normalizza nome birra per confronto (rimuove spazi extra, punteggiatura, case)
   * @param {string} name - Nome da normalizzare
   * @returns {string} Nome normalizzato
   */
  static normalizeBeerName(name) {
    if (!name) return '';
    return name
      .toLowerCase()
      .trim()
      .replace(/\s+/g, ' ') // spazi multipli -> singolo spazio
      .replace(/[^\w\s]/g, '') // rimuovi punteggiatura
      .trim();
  }

  /**
   * Normalizza tipo birra per confronto
   * @param {string} type - Tipo da normalizzare
   * @returns {string} Tipo normalizzato
   */
  static normalizeBeerType(type) {
    if (!type) return '';
    return type
      .toLowerCase()
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/[^\w\s]/g, '')
      .trim();
  }

  /**
   * Verifica se due tipi di birra corrispondono
   * @param {string} type1 - Primo tipo
   * @param {string} type2 - Secondo tipo
   * @returns {boolean} True se corrispondono
   */
  static checkTypeMatch(type1, type2) {
    if (!type1 || !type2) return false;
    
    const t1 = this.normalizeBeerType(type1);
    const t2 = this.normalizeBeerType(type2);
    
    // Corrispondenza esatta
    if (t1 === t2) return true;
    
    // Una contiene l'altra
    if (t1.includes(t2) || t2.includes(t1)) return true;
    
    // Mappature comuni di tipi simili
    const typeMappings = {
      'lager': ['pilsner', 'pils', 'helles'],
      'pilsner': ['lager', 'pils', 'helles'],
      'ipa': ['india pale ale', 'american ipa'],
      'stout': ['dry stout', 'sweet stout', 'imperial stout'],
      'weizen': ['weissbier', 'hefeweizen', 'weiss'],
      'witbier': ['white ale', 'wit beer'],
      'porter': ['brown porter', 'robust porter']
    };
    
    // Controlla mappature
    const t1Mappings = typeMappings[t1] || [];
    const t2Mappings = typeMappings[t2] || [];
    
    return t1Mappings.includes(t2) || t2Mappings.includes(t1);
  }

  /**
   * Ricerca birra specifica su web con scraping completo
   * @param {string} beerName - Nome della birra
   * @param {string} breweryName - Nome del birrificio
   * @param {string} breweryWebsite - Sito web del birrificio (opzionale)
   * @returns {Promise<Object>} Risultato della ricerca web
   */
  static async searchBeerOnWeb(beerName, breweryName, breweryWebsite = null) {
    try {
      logger.info('[WebSearch] � === RICERCA BIRRA WEB INIZIATA ===', { 
        beerName, 
        breweryName,
        breweryWebsite 
      });

      // STEP 1: Trova il sito del birrificio se non fornito
      let websiteUrl = breweryWebsite;
      
      if (!websiteUrl) {
        logger.info('[WebSearch] 🔍 STEP 1 - Ricerca sito birrificio');
        
        // 🌍 FIX 11 GEN 2026: Termini BILINGUE italiano+inglese per birrifici internazionali (es: Duvel)
        // Usa DuckDuckGo per trovare il sito ufficiale
        const breweryQuery = `${breweryName} birrificio brewery sito ufficiale official website`;
        const duckResults = await this.scrapeDuckDuckGo(breweryQuery);
        
        if (duckResults.length > 0) {
          websiteUrl = duckResults[0].url;
          logger.info('[WebSearch] ✅ Sito birrificio trovato', { websiteUrl });
        } else {
          logger.warn('[WebSearch] ⚠️ Sito birrificio non trovato');
          return { found: false, confidence: 0, beer: null };
        }
      }

      // STEP 2: Cerca pagina prodotto specifica per la birra
      logger.info('[WebSearch] 🔍 STEP 2 - Ricerca pagina prodotto birra');
      
      const beerSearchQueries = [
        `site:${new URL(websiteUrl).hostname} ${beerName}`,
        `${breweryName} ${beerName} scheda prodotto`,
        `${beerName} ${breweryName}`
      ];

      let beerPageUrl = null;
      
      for (const query of beerSearchQueries) {
        logger.info('[WebSearch] � Query ricerca birra', { query });
        
        const results = await this.scrapeDuckDuckGo(query);
        
        if (results.length > 0) {
          // Cerca risultato che contiene il nome birra nell'URL o title
          const beerResult = results.find(r => 
            r.url.toLowerCase().includes(beerName.toLowerCase().split(' ')[0]) ||
            r.title.toLowerCase().includes(beerName.toLowerCase())
          );
          
          if (beerResult) {
            beerPageUrl = beerResult.url;
            logger.info('[WebSearch] ✅ Pagina birra trovata', { 
              beerPageUrl,
              title: beerResult.title 
            });
            break;
          }
        }
        
        await new Promise(resolve => setTimeout(resolve, 500)); // Anti-bot delay
      }

      // Fallback: usa homepage del birrificio
      if (!beerPageUrl) {
        logger.warn('[WebSearch] ⚠️ Pagina specifica non trovata, uso homepage birrificio');
        beerPageUrl = websiteUrl;
      }

      // STEP 3: Estrai dati birra dalla pagina usando HTMLParser
      logger.info('[WebSearch] 📄 STEP 3 - Scraping dati birra', { beerPageUrl });
      
      const beerData = await HTMLParser.extractBeerInfoFromWebsite(beerPageUrl, beerName);

      // Validazione risultati
      if (beerData.confidence === 0 || beerData.error) {
        logger.warn('[WebSearch] ⚠️ Nessun dato birra estratto', {
          confidence: beerData.confidence,
          error: beerData.error
        });
        return { 
          found: false, 
          confidence: 0, 
          beer: null,
          attemptedUrl: beerPageUrl
        };
      }

      // STEP 4: Componi risultato finale
      logger.info('[WebSearch] ✅ RICERCA BIRRA COMPLETATA', {
        beerName,
        confidence: beerData.confidence,
        fieldsFound: beerData.fieldsFound,
        hasAlcohol: !!beerData.alcoholContent,
        hasIBU: !!beerData.ibu,
        hasType: !!beerData.beerType
      });

      return {
        found: true,
        confidence: beerData.confidence,
        source: 'WEB_SCRAPING',
        beer: {
          beerName: beerName, // Mantieni nome originale dall'etichetta
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
          availability: beerData.availability
        },
        scrapedFrom: beerData.source,
        fieldsFound: beerData.fieldsFound
      };

    } catch (error) {
      logger.error('[WebSearch] ❌ Errore ricerca birra web', {
        beerName,
        breweryName,
        error: error.message,
        stack: error.stack
      });
      return { 
        found: false, 
        confidence: 0, 
        beer: null,
        error: error.message
      };
    }
  }
}

module.exports = WebSearchService;
