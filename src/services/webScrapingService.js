const axios = require('axios');
const cheerio = require('cheerio');
const logWithFileName = require('../utils/logger');
const logger = logWithFileName(__filename);

/**
 * 🌐 WEB SCRAPING SERVICE - Estrazione Dati da Siti Ufficiali Birrifici
 * 
 * Questo servizio effettua scraping di siti web ufficiali di birrifici per:
 * 1. Estrarre informazioni ufficiali (nome, indirizzo, contatti, descrizione)
 * 2. Recuperare logo/immagini del birrificio
 * 3. Ottenere lista delle birre prodotte
 * 4. Validare che le birre riconosciute dall'AI appartengano al birrificio
 * 
 * Strategia:
 * - Uso di user-agent realistico per evitare blocchi
 * - Parsing HTML con cheerio (veloce e affidabile)
 * - Timeout brevi per non bloccare l'utente
 * - Fallback a GeminiAI se scraping fallisce
 */

class WebScrapingService {
  
  /**
   * Configurazione axios per richieste HTTP
   */
  static getAxiosConfig() {
    return {
      timeout: 10000, // 10 secondi max
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
      },
      validateStatus: function (status) {
        return status >= 200 && status < 400; // Accetta redirect
      },
      maxRedirects: 5
    };
  }

  /**
   * Valida se un URL è raggiungibile e risponde correttamente
   * @param {string} url - URL da validare
   * @returns {Promise<boolean>} True se l'URL è valido e raggiungibile
   */
  static async validateUrl(url) {
    try {
      logger.debug('[WebScraping] 🔍 Validazione URL', { url });
      
      // Normalizza URL
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url;
      }

      const response = await axios.head(url, {
        ...this.getAxiosConfig(),
        timeout: 5000 // Timeout più breve per validazione
      });

      const isValid = response.status >= 200 && response.status < 400;
      logger.info(`[WebScraping] ${isValid ? '✅' : '❌'} URL validation`, {
        url,
        status: response.status,
        isValid
      });

      return isValid;

    } catch (error) {
      logger.warn('[WebScraping] ⚠️ URL non raggiungibile', {
        url,
        error: error.message
      });
      return false;
    }
  }

  /**
   * Estrae tutte le informazioni possibili dal sito del birrificio
   * @param {string} websiteUrl - URL del sito ufficiale del birrificio
   * @param {string} breweryNameFromAI - Nome birrificio riconosciuto da AI (per matching)
   * @returns {Promise<Object>} Oggetto con dati estratti dal sito
   */
  static async scrapeBreweryWebsite(websiteUrl, breweryNameFromAI) {
    try {
      logger.info('[WebScraping] 🕷️ Inizio scraping sito birrificio', {
        url: websiteUrl,
        breweryName: breweryNameFromAI
      });

      // Normalizza URL
      if (!websiteUrl.startsWith('http://') && !websiteUrl.startsWith('https://')) {
        websiteUrl = 'https://' + websiteUrl;
      }

      // Scarica HTML
      const response = await axios.get(websiteUrl, this.getAxiosConfig());
      const html = response.data;
      const $ = cheerio.load(html);

      // Inizializza oggetto risultato
      const scrapedData = {
        success: true,
        source: 'web_scraping',
        websiteUrl: websiteUrl,
        scrapedAt: new Date(),
        data: {}
      };

      // 1. NOME BIRRIFICIO
      scrapedData.data.breweryName = this.extractBreweryName($, breweryNameFromAI);

      // 2. DESCRIZIONE
      scrapedData.data.breweryDescription = this.extractDescription($);

      // 3. INDIRIZZO
      scrapedData.data.breweryLegalAddress = this.extractAddress($);

      // 4. CONTATTI
      const contacts = this.extractContacts($);
      scrapedData.data.breweryEmail = contacts.email;
      scrapedData.data.breweryPhoneNumber = contacts.phone;

      // 5. SOCIAL MEDIA
      scrapedData.data.brewerySocialMedia = this.extractSocialMedia($);

      // 6. LOGO
      scrapedData.data.breweryLogo = this.extractLogo($, websiteUrl);

      // 7. IMMAGINI
      scrapedData.data.breweryImages = this.extractImages($, websiteUrl);

      // 8. LISTA BIRRE
      scrapedData.data.beers = this.extractBeers($);

      // 9. ANNO FONDAZIONE
      scrapedData.data.foundingYear = this.extractFoundingYear($);

      // 10. ALTRE INFO
      scrapedData.data.breweryHistory = this.extractHistory($);
      scrapedData.data.awards = this.extractAwards($);

      // Calcola confidence score basato su quanti dati sono stati estratti
      const fieldsExtracted = Object.values(scrapedData.data).filter(v => {
        if (Array.isArray(v)) return v.length > 0;
        if (typeof v === 'object' && v !== null) return Object.keys(v).length > 0;
        return v && v !== '';
      }).length;
      
      scrapedData.confidence = Math.min(fieldsExtracted / 10, 1.0); // Max 1.0

      logger.info('[WebScraping] ✅ Scraping completato con successo', {
        url: websiteUrl,
        fieldsExtracted,
        confidence: scrapedData.confidence,
        hasBeers: scrapedData.data.beers?.length > 0,
        beersCount: scrapedData.data.beers?.length || 0
      });

      return scrapedData;

    } catch (error) {
      logger.error('[WebScraping] ❌ Errore durante scraping', {
        url: websiteUrl,
        error: error.message,
        errorType: error.constructor?.name
      });

      return {
        success: false,
        source: 'web_scraping',
        websiteUrl: websiteUrl,
        error: error.message,
        scrapedAt: new Date()
      };
    }
  }

  /**
   * Estrae il nome del birrificio dal sito
   * @private
   */
  static extractBreweryName($, fallbackName) {
    try {
      // Cerca in title, h1, meta tags
      const title = $('title').text().trim();
      const h1 = $('h1').first().text().trim();
      const metaTitle = $('meta[property="og:title"]').attr('content') || $('meta[name="title"]').attr('content');

      // Filtra e pulisci
      const candidates = [title, h1, metaTitle, fallbackName].filter(Boolean);
      
      for (const candidate of candidates) {
        const cleaned = candidate
          .replace(/\s*[-|–]\s*Home.*/i, '')
          .replace(/\s*[-|–]\s*Sito Ufficiale.*/i, '')
          .replace(/^(Birrificio|Brewery)\s+/i, '')
          .trim();
        
        if (cleaned.length >= 3 && cleaned.length <= 100) {
          return cleaned;
        }
      }

      return fallbackName || '';
    } catch (error) {
      logger.debug('[WebScraping] Errore estrazione nome', { error: error.message });
      return fallbackName || '';
    }
  }

  /**
   * Estrae la descrizione del birrificio
   * @private
   */
  static extractDescription($) {
    try {
      // Cerca meta description, about section, paragrafi
      const metaDesc = $('meta[name="description"]').attr('content') || $('meta[property="og:description"]').attr('content');
      
      if (metaDesc && metaDesc.length > 50) {
        return metaDesc.trim();
      }

      // Cerca sezioni "Chi siamo", "About", "Storia" - Cheerio NON supporta :contains()
      const aboutSelectors = [
        '.about p',
        '#about p',
        '.description',
        '.intro p'
      ];
      
      // Filtra section per contenuto testo
      $('section').each((i, el) => {
        const $el = $(el);
        const text = $el.text().toLowerCase();
        if (text.includes('chi siamo') || text.includes('about') || text.includes('storia')) {
          $el.find('p').each((j, p) => {
            aboutSelectors.push(p);
          });
        }
      });

      for (const selector of aboutSelectors) {
        const text = $(selector).first().text().trim();
        if (text.length > 50 && text.length < 1000) {
          return text;
        }
      }

      // Fallback: primo paragrafo lungo
      const paragraphs = $('p').map((i, el) => $(el).text().trim()).get();
      const longParagraph = paragraphs.find(p => p.length > 100 && p.length < 1000);
      
      return longParagraph || '';
    } catch (error) {
      logger.debug('[WebScraping] Errore estrazione descrizione', { error: error.message });
      return '';
    }
  }

  /**
   * Estrae l'indirizzo del birrificio
   * @private
   */
  static extractAddress($) {
    try {
      // Cerca pattern comuni di indirizzi
      const addressSelectors = [
        '[itemprop="address"]',
        '.address',
        '#address',
        'address',
        '[class*="indirizzo"]',
        '[class*="address"]'
      ];
      
      // Filtra footer per contenuto testo "Via", "Piazza" - Cheerio NON supporta :contains()
      $('footer').each((i, el) => {
        const $el = $(el);
        const text = $el.text();
        if (text.includes('Via') || text.includes('Piazza') || text.includes('Corso') || text.includes('Viale')) {
          $el.find('p').each((j, p) => {
            addressSelectors.push(p);
          });
        }
      });

      for (const selector of addressSelectors) {
        const text = $(selector).text().trim();
        if (text && this.looksLikeAddress(text)) {
          return text;
        }
      }

      // Cerca nel testo libero
      const allText = $('body').text();
      const addressRegex = /(Via|Viale|Piazza|Corso|Strada|Località|Loc\.)\s+[A-Za-zÀ-ÿ\s]+\d+[,\s]*\d{5}\s+[A-Za-zÀ-ÿ\s]+(?:\([A-Z]{2}\))?/i;
      const match = allText.match(addressRegex);
      
      return match ? match[0].trim() : '';
    } catch (error) {
      logger.debug('[WebScraping] Errore estrazione indirizzo', { error: error.message });
      return '';
    }
  }

  /**
   * Verifica se un testo sembra un indirizzo
   * @private
   */
  static looksLikeAddress(text) {
    const hasStreetType = /\b(via|viale|piazza|corso|strada|località|loc\.)\b/i.test(text);
    const hasNumber = /\d+/.test(text);
    const hasCity = text.length > 10; // Indirizzo minimale
    return hasStreetType && hasNumber && hasCity;
  }

  /**
   * Estrae contatti (email, telefono)
   * @private
   */
  static extractContacts($) {
    const contacts = { email: '', phone: '' };

    try {
      // EMAIL
      const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
      const bodyText = $('body').text();
      const emails = bodyText.match(emailRegex) || [];
      
      // Filtra email info/contact
      contacts.email = emails.find(e => 
        e.includes('info') || e.includes('contact') || e.includes('birr')
      ) || emails[0] || '';

      // TELEFONO
      const phoneRegex = /(\+39[\s]?)?(\d{2,4}[\s\-]?\d{6,8})/g;
      const phones = bodyText.match(phoneRegex) || [];
      contacts.phone = phones[0]?.replace(/\s+/g, ' ').trim() || '';

    } catch (error) {
      logger.debug('[WebScraping] Errore estrazione contatti', { error: error.message });
    }

    return contacts;
  }

  /**
   * Estrae link social media
   * @private
   */
  static extractSocialMedia($) {
    const social = {};

    try {
      $('a[href*="facebook"], a[href*="fb.com"]').each((i, el) => {
        if (!social.facebook) social.facebook = $(el).attr('href');
      });

      $('a[href*="instagram"]').each((i, el) => {
        if (!social.instagram) social.instagram = $(el).attr('href');
      });

      $('a[href*="twitter"]').each((i, el) => {
        if (!social.twitter) social.twitter = $(el).attr('href');
      });

      $('a[href*="linkedin"]').each((i, el) => {
        if (!social.linkedin) social.linkedin = $(el).attr('href');
      });

      $('a[href*="youtube"]').each((i, el) => {
        if (!social.youtube) social.youtube = $(el).attr('href');
      });
    } catch (error) {
      logger.debug('[WebScraping] Errore estrazione social', { error: error.message });
    }

    return social;
  }

  /**
   * Estrae URL logo del birrificio
   * @private
   */
  static extractLogo($, baseUrl) {
    try {
      // Cerca logo in posizioni comuni
      const logoSelectors = [
        'img.logo',
        '#logo img',
        '.logo img',
        '[class*="logo"] img',
        'header img:first',
        '.navbar-brand img'
      ];

      for (const selector of logoSelectors) {
        const src = $(selector).attr('src');
        if (src) {
          return this.resolveUrl(src, baseUrl);
        }
      }

      return '';
    } catch (error) {
      logger.debug('[WebScraping] Errore estrazione logo', { error: error.message });
      return '';
    }
  }

  /**
   * Estrae immagini del birrificio
   * @private
   */
  static extractImages($, baseUrl) {
    try {
      const images = [];
      const seen = new Set();

      $('img').each((i, el) => {
        const src = $(el).attr('src');
        const alt = $(el).attr('alt') || '';
        
        if (src && !seen.has(src)) {
          // Filtra logo, icone, banner piccoli
          const isValid = !src.includes('logo') && 
                         !src.includes('icon') && 
                         !alt.toLowerCase().includes('logo');
          
          if (isValid) {
            images.push(this.resolveUrl(src, baseUrl));
            seen.add(src);
          }
        }
      });

      return images.slice(0, 10); // Max 10 immagini
    } catch (error) {
      logger.debug('[WebScraping] Errore estrazione immagini', { error: error.message });
      return [];
    }
  }

  /**
   * Estrae lista birre dal sito con DETTAGLI COMPLETI
   * @private
   */
  static extractBeers($) {
    try {
      const beers = [];
      const seen = new Set();

      // Cerca sezioni che contengono testo relativo alle birre
      // NOTA: Cheerio NON supporta :contains(), usiamo .filter()
      const keywords = ['birre', 'le nostre birre', 'products', 'prodotti', 'menu', 'catalogo'];
      
      const beerSections = [];
      
      // 🔍 DEBUG: Conta elementi totali per diagnostica
      const totalSections = $('section').length;
      const totalDivs = $('div[class*="product"], div[class*="beer"]').length;
      logger.debug('[WebScraping] 🔍 Elementi HTML trovati', { 
        totalSections, 
        totalDivs
      });
      
      // Cerca tutte le section e filtra per contenuto testo
      $('section, div[class*="product"], div[class*="beer"]').each((i, el) => {
        const $el = $(el);
        const text = $el.text().toLowerCase();
        const hasId = $el.attr('id') && ($el.attr('id').includes('product') || $el.attr('id').includes('beer'));
        const hasClass = $el.attr('class') && ($el.attr('class').includes('product') || $el.attr('class').includes('beer'));
        
        // Aggiungi se contiene keyword O ha id/class rilevante
        if (hasId || hasClass || keywords.some(kw => text.includes(kw))) {
          beerSections.push($el);
          logger.debug('[WebScraping] 🔍 Sezione birre trovata', { 
            hasId, 
            hasClass, 
            matchedKeywords: keywords.filter(kw => text.includes(kw)),
            textPreview: text.substring(0, 100)
          });
        }
      });
      
      // Aggiungi anche selettori diretti per id e classi comuni
      $('#products, .products, .menu, [class*="beer"], [class*="product"]').each((i, el) => {
        beerSections.push($(el));
      });
      
      logger.debug('[WebScraping] 🔍 Totale sezioni birre identificate', { 
        count: beerSections.length 
      });

      for (const section of beerSections) {
        
        // STRATEGIA 1: Cerca elementi con attributi data-product, data-beer (più affidabili)
        const dataElements = section.find('[data-product], [data-beer], [data-item]');
        logger.debug('[WebScraping] 🔍 STRATEGIA 1 - Elementi data-*', { 
          count: dataElements.length 
        });
        
        dataElements.each((i, el) => {
          const $el = $(el);
          const beerData = this.extractBeerDetails($el);
          
          if (beerData.beerName && !seen.has(beerData.beerName.toLowerCase())) {
            beers.push(beerData);
            seen.add(beerData.beerName.toLowerCase());
            logger.debug('[WebScraping] ✅ Birra trovata (STRATEGIA 1)', { 
              beerName: beerData.beerName 
            });
          }
        });
        
        // STRATEGIA 2: Cerca elementi birra con classi specifiche (card, item, product)
        const classElements = section.find('.product, .beer, .item, .card, article');
        logger.debug('[WebScraping] 🔍 STRATEGIA 2 - Elementi con classi', { 
          count: classElements.length 
        });
        
        classElements.each((i, el) => {
          const $el = $(el);
          const beerData = this.extractBeerDetails($el);
          
          if (beerData.beerName && !seen.has(beerData.beerName.toLowerCase())) {
            beers.push(beerData);
            seen.add(beerData.beerName.toLowerCase());
            logger.debug('[WebScraping] ✅ Birra trovata (STRATEGIA 2)', { 
              beerName: beerData.beerName 
            });
          }
        });

        // STRATEGIA 3: Se non trova card, cerca titoli h2, h3, h4 (meno affidabile)
        if (beers.length === 0) {
          const titleElements = section.find('h2, h3, h4, .product-name, .beer-name');
          logger.debug('[WebScraping] 🔍 STRATEGIA 3 - Elementi titolo', { 
            count: titleElements.length 
          });
          
          titleElements.each((i, el) => {
            const $el = $(el);
            const parent = $el.parent();
            const beerData = this.extractBeerDetails(parent, $el);
            
            // 🔍 DEBUG: Log cosa ha estratto (anche se scartato)
            logger.debug('[WebScraping] 🔍 Elemento titolo estratto', { 
              titleText: $el.text().trim().substring(0, 80),
              beerName: beerData.beerName,
              isValid: !!beerData.beerName,
              isDuplicate: beerData.beerName ? seen.has(beerData.beerName.toLowerCase()) : false
            });
            
            if (beerData.beerName && !seen.has(beerData.beerName.toLowerCase())) {
              beers.push(beerData);
              seen.add(beerData.beerName.toLowerCase());
              logger.debug('[WebScraping] ✅ Birra trovata (STRATEGIA 3)', { 
                beerName: beerData.beerName 
              });
            }
          });
        }
      }

      logger.info('[WebScraping] Birre estratte dal sito', { count: beers.length, sample: beers[0] });
      return beers;

    } catch (error) {
      logger.debug('[WebScraping] Errore estrazione birre', { error: error.message });
      return [];
    }
  }

  /**
   * Valida se un testo sembra essere un nome di birra
   * @private
   */
  static isValidBeerName(name) {
    if (!name || name.length < 2) return false;
    
    // Troppo lungo = probabilmente uno slogan o paragrafo
    if (name.length > 80) return false;
    
    // Scarta slogan comuni e frasi generiche
    const invalidPatterns = [
      /prodott[ao]\s+in/i,           // "Prodotta in Sardegna"
      /da\s+sempre/i,                // "Da sempre"
      /bevi\s+responsabile/i,        // "Bevi responsabilmente"
      /scopri\s+la/i,                // "Scopri la nostra"
      /le\s+nostre\s+birre/i,        // "Le nostre birre"
      /birre\s+artigianali/i,        // "Birre artigianali"
      /benvenut[io]/i,               // "Benvenuto"
      /chi\s+siamo/i,                // "Chi siamo"
      /contatt[ai]/i,                // "Contatti", "Contatta"
      /^[a-z\s]+\.\s*$/i,            // Frasi con punto finale (es: "Testo generico.")
      /\n/,                          // Contiene a capo (non è un nome)
      /[.!?]{2,}/                    // Punteggiatura multipla
    ];
    
    for (const pattern of invalidPatterns) {
      if (pattern.test(name)) {
        return false;
      }
    }
    
    // Conta parole - troppo poche o troppe sono sospette
    const words = name.trim().split(/\s+/);
    if (words.length > 10) return false; // Più di 10 parole = frase
    
    return true;
  }

  /**
   * Estrae dettagli completi di una singola birra
   * @private
   */
  static extractBeerDetails($container, $title = null) {
    try {
      const beer = {};
      
      // Nome birra
      const nameEl = $title || $container.find('h2, h3, h4, .name, .title, .product-name, .beer-name').first();
      beer.beerName = nameEl.text().trim();
      
      // Valida nome birra con filtri anti-slogan
      if (!this.isValidBeerName(beer.beerName)) {
        return {}; // Skip se non sembra un nome di birra valido
      }

      // Descrizione
      const descEl = $container.find('p, .description, .desc, .text').first();
      beer.beerDescription = descEl.text().trim().substring(0, 500) || '';

      // ABV (Alcohol by Volume)
      const text = $container.text();
      const abvMatch = text.match(/(\d+(?:[.,]\d+)?)\s*%\s*(?:ABV|alc|vol)/i) || 
                      text.match(/(?:ABV|alc|vol)\s*[:\s]*(\d+(?:[.,]\d+)?)\s*%/i) ||
                      text.match(/(\d+(?:[.,]\d+)?)\s*%/);
      if (abvMatch) {
        beer.alcoholContent = abvMatch[1].replace(',', '.') + '%';
      }

      // IBU (International Bitterness Units)
      const ibuMatch = text.match(/(\d+)\s*IBU/i) || text.match(/IBU\s*[:\s]*(\d+)/i);
      if (ibuMatch) {
        beer.ibu = ibuMatch[1];
      }

      // Stile birra (cerca pattern comuni)
      const styleMatch = text.match(/(?:Stile|Style|Tipo|Type)[:\s]*([A-Za-z\s]+?)(?:\.|,|ABV|IBU|\d|\n|$)/i);
      if (styleMatch) {
        beer.beerType = styleMatch[1].trim();
      } else {
        // Cerca stili noti nel testo
        const knownStyles = ['IPA', 'Lager', 'Ale', 'Stout', 'Porter', 'Weiss', 'Pils', 'Bitter', 'Bock', 'Saison'];
        for (const style of knownStyles) {
          if (new RegExp(`\\b${style}\\b`, 'i').test(text)) {
            beer.beerType = style;
            break;
          }
        }
      }

      // Ingredienti
      const ingredientsMatch = text.match(/(?:Ingredienti|Ingredients)[:\s]*([^.]+)/i);
      if (ingredientsMatch) {
        beer.ingredients = ingredientsMatch[1].trim().split(/[,;]/).map(i => i.trim()).filter(i => i);
      }

      // Volume (formato bottiglia)
      const volumeMatch = text.match(/(\d+(?:[.,]\d+)?)\s*(?:ml|cl|l)\b/i);
      if (volumeMatch) {
        beer.volume = volumeMatch[0];
      }

      // Colore
      const colorMatch = text.match(/(?:Colore|Color)[:\s]*([A-Za-z\s]+?)(?:\.|,|\n|$)/i);
      if (colorMatch) {
        beer.color = colorMatch[1].trim();
      }

      // Temperatura servizio
      const tempMatch = text.match(/(\d+)[°\s]*(?:C|gradi)/i);
      if (tempMatch && parseInt(tempMatch[1]) < 20) {
        beer.servingTemperature = tempMatch[0];
      }

      // Note degustazione
      const tastingSelectors = ['.tasting-notes', '.notes', '.taste'];
      for (const sel of tastingSelectors) {
        const tastingText = $container.find(sel).text().trim();
        if (tastingText.length > 20) {
          beer.tastingNotes = tastingText.substring(0, 500);
          break;
        }
      }

      logger.debug('[WebScraping] Dettagli birra estratti', { 
        beerName: beer.beerName,
        hasABV: !!beer.alcoholContent,
        hasIBU: !!beer.ibu,
        hasStyle: !!beer.beerType
      });

      return beer;

    } catch (error) {
      logger.debug('[WebScraping] Errore estrazione dettagli birra', { error: error.message });
      return {};
    }
  }

  /**
   * Estrae anno di fondazione
   * @private
   */
  static extractFoundingYear($) {
    try {
      const bodyText = $('body').text();
      const yearRegex = /(?:fondat[oa]\s+nel|dal|since)\s+(\d{4})/i;
      const match = bodyText.match(yearRegex);
      
      if (match && match[1]) {
        const year = parseInt(match[1]);
        const currentYear = new Date().getFullYear();
        if (year >= 1900 && year <= currentYear) {
          return year.toString();
        }
      }

      return '';
    } catch (error) {
      logger.debug('[WebScraping] Errore estrazione anno fondazione', { error: error.message });
      return '';
    }
  }

  /**
   * Estrae storia del birrificio
   * @private
   */
  static extractHistory($) {
    try {
      const historySelectors = [
        '#storia p',
        '.storia p',
        '#history p',
        '.history p'
      ];
      
      // Filtra section per contenuto "Storia" o "History" - Cheerio NON supporta :contains()
      $('section').each((i, el) => {
        const $el = $(el);
        const text = $el.text().toLowerCase();
        if (text.includes('storia') || text.includes('history')) {
          $el.find('p').each((j, p) => {
            historySelectors.push(p);
          });
        }
      });

      for (const selector of historySelectors) {
        const text = $(selector).text().trim();
        if (text.length > 100 && text.length < 2000) {
          return text;
        }
      }

      return '';
    } catch (error) {
      logger.debug('[WebScraping] Errore estrazione storia', { error: error.message });
      return '';
    }
  }

  /**
   * Estrae premi e riconoscimenti
   * @private
   */
  static extractAwards($) {
    try {
      const awards = [];
      
      const awardSelectors = [
        '#premi',
        '.awards',
        '[class*="award"]'
      ];
      
      // Filtra section per contenuto "Premi" o "Awards" - Cheerio NON supporta :contains()
      $('section').each((i, el) => {
        const $el = $(el);
        const text = $el.text().toLowerCase();
        if (text.includes('premi') || text.includes('awards') || text.includes('riconoscimenti')) {
          awardSelectors.push(el);
        }
      });

      for (const selector of awardSelectors) {
        $(selector).find('li, p, .award-item').each((i, el) => {
          const text = $(el).text().trim();
          if (text.length > 10 && text.length < 200) {
            awards.push(text);
          }
        });
      }

      return awards.slice(0, 10); // Max 10 premi
    } catch (error) {
      logger.debug('[WebScraping] Errore estrazione premi', { error: error.message });
      return [];
    }
  }

  /**
   * Risolve URL relativo in assoluto
   * @private
   */
  static resolveUrl(url, baseUrl) {
    try {
      if (!url) return '';
      if (url.startsWith('http://') || url.startsWith('https://')) {
        return url;
      }
      if (url.startsWith('//')) {
        return 'https:' + url;
      }
      
      const base = new URL(baseUrl);
      if (url.startsWith('/')) {
        return `${base.protocol}//${base.host}${url}`;
      }
      
      return `${base.protocol}//${base.host}/${url}`;
    } catch (error) {
      return url;
    }
  }

  /**
   * Verifica se una birra riconosciuta da AI è presente nel sito del birrificio
   * @param {string} beerName - Nome birra da AI
   * @param {Array} scrapedBeers - Lista birre estratte dal sito
   * @returns {boolean} True se la birra è presente nel sito
   */
  static verifyBeerBelongsToBrewery(beerName, scrapedBeers) {
    if (!scrapedBeers || scrapedBeers.length === 0) {
      return false; // Non possiamo verificare
    }

    const normalizedBeerName = beerName.toLowerCase().trim();
    
    return scrapedBeers.some(beer => {
      const normalizedScrapedName = beer.beerName.toLowerCase().trim();
      
      // Match esatto
      if (normalizedScrapedName === normalizedBeerName) {
        return true;
      }
      
      // Match parziale (una stringa contiene l'altra)
      if (normalizedScrapedName.includes(normalizedBeerName) || 
          normalizedBeerName.includes(normalizedScrapedName)) {
        return true;
      }
      
      return false;
    });
  }
}

module.exports = WebScrapingService;
