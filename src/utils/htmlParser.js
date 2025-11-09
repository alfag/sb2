/**
 * HTML Parser per estrazione dati birrifici da siti web
 * Estrae informazioni REALI dai contenuti HTML invece di affidarsi all'AI
 */

const axios = require('axios');
const cheerio = require('cheerio');
const logWithFileName = require('./logger');
const logger = logWithFileName(__filename);

class HTMLParser {
  
  /**
   * Estrae link interni utili da una pagina web
   * Cerca link che potrebbero contenere info contatti/chi-siamo
   * @param {string} websiteUrl - URL base del sito
   * @returns {Promise<Array>} Array di URL promettenti da controllare
   */
  static async extractUsefulLinks(websiteUrl) {
    try {
      logger.info('[HTMLParser] 🔗 Estrazione link dalla homepage', { url: websiteUrl });
      
      const response = await axios.get(websiteUrl, {
        timeout: 5000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'it-IT,it;q=0.9,en;q=0.8'
        }
      });
      
      const $ = cheerio.load(response.data);
      const baseUrl = new URL(websiteUrl);
      const usefulLinks = new Set(); // Usa Set per evitare duplicati
      
      // Keywords che indicano pagine utili (priorità alta)
      const highPriorityKeywords = [
        'contatt', 'contact', 'chi-siamo', 'about', 'dove-siamo', 
        'dove-trovarci', 'location', 'trova', 'find', 'info'
      ];
      
      // Keywords secondarie (priorità media)
      const mediumPriorityKeywords = [
        'azien', 'company', 'storia', 'history', 'team', 'people'
      ];
      
      // Estrai tutti i link dalla pagina
      $('a[href]').each((_, element) => {
        const href = $(element).attr('href');
        const text = $(element).text().toLowerCase().trim();
        
        if (!href) return;
        
        try {
          // Converti link relativi in assoluti
          let fullUrl;
          if (href.startsWith('http')) {
            fullUrl = href;
          } else if (href.startsWith('/')) {
            fullUrl = `${baseUrl.protocol}//${baseUrl.hostname}${href}`;
          } else if (href.startsWith('#')) {
            return; // Skip anchor interni
          } else {
            fullUrl = `${websiteUrl.replace(/\/$/, '')}/${href}`;
          }
          
          const urlObj = new URL(fullUrl);
          
          // Verifica che sia dello stesso dominio
          if (urlObj.hostname !== baseUrl.hostname) {
            return; // Skip link esterni
          }
          
          // Skip file non HTML
          const path = urlObj.pathname.toLowerCase();
          if (path.match(/\.(pdf|jpg|jpeg|png|gif|zip|rar|doc|docx|xls|xlsx)$/)) {
            return;
          }
          
          // 🚫 SKIP pagine privacy/cookie/legali (possono contenere dati fake/esempio)
          if (path.match(/privacy|cookie|legal|terms|condizioni|gdpr|disclaimer/i)) {
            logger.debug('[HTMLParser] ⚠️ Pagina privacy/legale ignorata', { path });
            return;
          }
          
          // Calcola priorità del link
          let priority = 0;
          const fullText = `${path} ${text}`.toLowerCase();
          
          // Alta priorità
          if (highPriorityKeywords.some(kw => fullText.includes(kw))) {
            priority = 3;
          }
          // Media priorità
          else if (mediumPriorityKeywords.some(kw => fullText.includes(kw))) {
            priority = 2;
          }
          // Bassa priorità (link generici)
          else if (path !== '/' && path !== '') {
            priority = 1;
          }
          
          if (priority > 0) {
            usefulLinks.add(JSON.stringify({ url: fullUrl, priority, text }));
          }
          
        } catch (parseError) {
          // Skip link malformati
          logger.debug('[HTMLParser] Link malformato ignorato', { href });
        }
      });
      
      // Converti Set in Array e ordina per priorità
      const linksArray = Array.from(usefulLinks)
        .map(json => JSON.parse(json))
        .sort((a, b) => b.priority - a.priority)
        .slice(0, 15); // Limita a 15 link più promettenti
      
      logger.info('[HTMLParser] 🎯 Link estratti e ordinati', {
        total: usefulLinks.size,
        selected: linksArray.length,
        highPriority: linksArray.filter(l => l.priority === 3).length,
        mediumPriority: linksArray.filter(l => l.priority === 2).length
      });
      
      // Ritorna solo gli URL
      return linksArray.map(l => l.url);
      
    } catch (error) {
      logger.error('[HTMLParser] ❌ Errore estrazione link', {
        url: websiteUrl,
        error: error.message
      });
      
      // Fallback: ritorna array di pagine comuni
      return [
        websiteUrl,
        `${websiteUrl.replace(/\/$/, '')}/contatti`,
        `${websiteUrl.replace(/\/$/, '')}/chi-siamo`,
        `${websiteUrl.replace(/\/$/, '')}/about`,
        `${websiteUrl.replace(/\/$/, '')}/contact`
      ];
    }
  }
  
  /**
   * Estrae indirizzo da HTML del sito web
   * USA LINK REALI estratti dalla homepage invece di URL statici
   */
  static async extractBreweryInfoFromWebsite(websiteUrl) {
    try {
      logger.info('[HTMLParser] 🔍 Tentativo estrazione dati da sito web', { url: websiteUrl });

      // 🔥 STEP 1: Estrai link REALI dalla homepage
      const pagesToCheck = await this.extractUsefulLinks(websiteUrl);

      let extractedData = {
        address: null,
        email: null,
        phone: null,
        fiscalCode: null,
        reaCode: null,
        acciseCode: null,
        foundingYear: null,
        description: null,
        history: null,
        brewerySize: null,
        employeeCount: null,
        productionVolume: null,
        masterBrewer: null,
        socialMedia: null,
        mainProducts: null,
        awards: null,
        confidence: 0,
        source: null
      };

      // 🔥 STEP 2: Cerca su OGNI pagina reale trovata
      const uniquePages = [...new Set(pagesToCheck)];
      logger.info('[HTMLParser] 🔄 Inizio scraping', { totalPages: uniquePages.length });

      for (let i = 0; i < uniquePages.length; i++) {
        const url = uniquePages[i];
        
        logger.info(`[HTMLParser] 📄 Scraping pagina ${i + 1}/${uniquePages.length}`, { url });
        
        try {
          const response = await axios.get(url, {
            timeout: 8000, // Aumentato timeout
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
          });

          const html = response.data;
          const $ = cheerio.load(html);
          
          logger.debug('[HTMLParser] ✅ HTML ricevuto', { 
            url,
            htmlLength: html.length,
            hasAddress: html.toLowerCase().includes('via') || html.toLowerCase().includes('viale')
          });
          
          // Estrai indirizzo con pattern regex
          const address = this.extractAddressFromHTML(html);
          if (address && address.confidence > extractedData.confidence) {
            extractedData.address = address.text;
            extractedData.confidence = address.confidence;
            extractedData.source = url;
          }

          // Estrai email
          const email = this.extractEmailFromHTML(html);
          if (email && !extractedData.email) {
            extractedData.email = email;
          }

          // Estrai telefono
          const phone = this.extractPhoneFromHTML(html);
          if (phone && !extractedData.phone) {
            extractedData.phone = phone;
          }

          // Estrai Codice Fiscale/P.IVA
          const fiscalCode = this.extractFiscalCodeFromHTML(html);
          if (fiscalCode && !extractedData.fiscalCode) {
            extractedData.fiscalCode = fiscalCode;
          }

          // Estrai codice REA
          const reaCode = this.extractREACodeFromHTML(html);
          if (reaCode && !extractedData.reaCode) {
            extractedData.reaCode = reaCode;
          }

          // Estrai codice accise
          const acciseCode = this.extractAcciseCodeFromHTML(html);
          if (acciseCode && !extractedData.acciseCode) {
            extractedData.acciseCode = acciseCode;
          }

          // Estrai anno fondazione
          const foundingYear = this.extractFoundingYearFromHTML(html);
          if (foundingYear && !extractedData.foundingYear) {
            extractedData.foundingYear = foundingYear;
          }

          // Estrai descrizione
          const description = this.extractDescriptionFromHTML(html, $);
          if (description && !extractedData.description) {
            extractedData.description = description;
          }

          // Estrai storia
          const history = this.extractHistoryFromHTML(html, $);
          if (history && !extractedData.history) {
            extractedData.history = history;
          }

          // Estrai dimensione birrificio
          const brewerySize = this.extractBrewerySizeFromHTML(html);
          if (brewerySize && !extractedData.brewerySize) {
            extractedData.brewerySize = brewerySize;
          }

          // Estrai numero dipendenti
          const employeeCount = this.extractEmployeeCountFromHTML(html);
          if (employeeCount && !extractedData.employeeCount) {
            extractedData.employeeCount = employeeCount;
          }

          // Estrai volume produzione
          const productionVolume = this.extractProductionVolumeFromHTML(html);
          if (productionVolume && !extractedData.productionVolume) {
            extractedData.productionVolume = productionVolume;
          }

          // Estrai mastro birraio
          const masterBrewer = this.extractMasterBrewerFromHTML(html, $);
          if (masterBrewer && !extractedData.masterBrewer) {
            extractedData.masterBrewer = masterBrewer;
          }

          // Estrai social media
          const socialMedia = this.extractSocialMediaFromHTML(html, $);
          if (socialMedia && !extractedData.socialMedia) {
            extractedData.socialMedia = socialMedia;
          }

          // Estrai prodotti principali
          const mainProducts = this.extractMainProductsFromHTML(html, $);
          if (mainProducts && !extractedData.mainProducts) {
            extractedData.mainProducts = mainProducts;
          }

          // Estrai premi
          const awards = this.extractAwardsFromHTML(html, $);
          if (awards && !extractedData.awards) {
            extractedData.awards = awards;
          }
          
        } catch (pageError) {
          // Pagina non esiste o errore - continua con la successiva
          logger.warn('[HTMLParser] ⚠️ Errore scraping pagina', { 
            url, 
            error: pageError.message,
            code: pageError.code
          });
        }
      }
      
      logger.info('[HTMLParser] 🏁 Scraping completato', {
        pagesScraped: uniquePages.length,
        dataFound: {
          address: !!extractedData.address,
          email: !!extractedData.email,
          phone: !!extractedData.phone,
          fiscalCode: !!extractedData.fiscalCode,
          reaCode: !!extractedData.reaCode,
          acciseCode: !!extractedData.acciseCode,
          foundingYear: !!extractedData.foundingYear,
          description: !!extractedData.description,
          history: !!extractedData.history,
          brewerySize: !!extractedData.brewerySize,
          employeeCount: !!extractedData.employeeCount,
          productionVolume: !!extractedData.productionVolume,
          masterBrewer: !!extractedData.masterBrewer,
          socialMedia: !!extractedData.socialMedia,
          mainProducts: !!extractedData.mainProducts,
          awards: !!extractedData.awards
        },
        confidence: extractedData.confidence
      });

      if (extractedData.address) {
        logger.info('[HTMLParser] 🎯 Dati estratti con successo dal sito', extractedData);
      } else {
        logger.warn('[HTMLParser] ⚠️ Nessun dato trovato sul sito', { url: websiteUrl });
      }

      return extractedData;

    } catch (error) {
      logger.error('[HTMLParser] ❌ Errore estrazione dati da sito', {
        url: websiteUrl,
        error: error.message
      });
      return { address: null, email: null, phone: null, confidence: 0 };
    }
  }

  /**
   * Estrae indirizzo da HTML usando pattern regex avanzati
   * Migliorato per gestire HTML minificato e case-insensitive
   */
  static extractAddressFromHTML(html) {
    // Rimuovi tag HTML e normalizza spazi
    const text = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');

    // Pattern per indirizzi italiani - CASE INSENSITIVE
    const patterns = [
      // Pattern SPECIALE per formato "CITTÀ (PROVINCIA) – Località/loc. Nome n. numero – CAP xxxxx"
      // Es: "POLLEIN (AO) – Località L'Île-des-Lapins n. 11 – CAP 11020"
      /([a-zàèéìòù\s]+?)\s*\(([A-Z]{2})\)\s*[–-]\s*(?:località|localita|loc\.?)\s+([a-zàèéìòù\s\.''-]+?)\s*(?:n\.\s*)?(\d+(?:[-\/]\d+)?)\s*[–-]\s*(?:cap\s*)?(\d{5})/gi,
      
      // Pattern completo: via/viale/corso/località + nome + numero + CAP + città + provincia
      /(?:via|viale|piazza|corso|strada|contrada|località|localita|loc\.?)\s+([a-zàèéìòù\s\.''-]+?)\s*(?:n\.\s*)?(\d+(?:[-\/]\d+)?)\s*[,\s–-]+(?:cap\s*)?(\d{5})?\s*([a-zàèéìòù\s]+?)\s*\(?([A-Z]{2})\)?/gi,
      
      // Pattern senza CAP ma con provincia
      /(?:via|viale|piazza|corso|strada|località|localita|loc\.?)\s+([a-zàèéìòù\s\.''-]+?)\s*(?:n\.\s*)?(\d+(?:[-\/]\d+)?)\s*[,\s–-]+([a-zàèéìòù\s]+?)\s*\(?([A-Z]{2})\)?/gi,
      
      // Pattern minimalista per HTML minificato (es: "via matteotti 14-22<br>28010 cavallirio (no)")
      /(?:via|viale|piazza|corso|strada)\s+([a-zàèéìòù]+)\s+(\d+(?:[-\/]\d+)?)\s*(?:<br>|<br\/>)?\s*(\d{5})?\s*([a-zàèéìòù]+)\s*\(([a-z]{2})\)/gi
    ];

    let bestMatch = null;
    let bestConfidence = 0;

    for (let patternIndex = 0; patternIndex < patterns.length; patternIndex++) {
      const pattern = patterns[patternIndex];
      const matches = [...text.matchAll(pattern)];
      
      for (const match of matches) {
        let fullMatch = match[0].trim();
        
        // Rimuovi eventuali tag residui
        fullMatch = fullMatch.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
        
        // Normalizza: capitalizza prima lettera di ogni parola
        fullMatch = fullMatch.split(' ').map(word => {
          if (word.length > 2 && !word.match(/^\d/)) {
            return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
          }
          return word;
        }).join(' ');
        
        // Calcola confidence basata su completezza
        let confidence = 0.6; // Base più alta per pattern migliorati
        
        // Bonus per CAP presente
        if (/\d{5}/.test(fullMatch)) confidence += 0.2;
        
        // Bonus per provincia presente
        if (/\([A-Za-z]{2}\)/i.test(fullMatch)) confidence += 0.2;
        
        // Bonus per numero civico con range (es: 14-22)
        if (/\d+-\d+/.test(fullMatch)) confidence += 0.1;
        
        // Bonus per lunghezza ragionevole
        if (fullMatch.length > 25 && fullMatch.length < 100) confidence += 0.1;

        if (confidence > bestConfidence) {
          bestMatch = fullMatch;
          bestConfidence = confidence;
        }
      }
    }

    return bestMatch ? { text: bestMatch, confidence: bestConfidence } : null;
  }

  /**
   * Estrae email da HTML
   */
  static extractEmailFromHTML(html) {
    const emailPattern = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;
    const matches = html.match(emailPattern);
    
    if (matches && matches.length > 0) {
      // Filtra email comuni da escludere
      const excluded = ['example@', 'test@', 'admin@example'];
      const validEmails = matches.filter(email => 
        !excluded.some(ex => email.toLowerCase().includes(ex))
      );
      
      if (validEmails.length > 0) {
        // Preferisci email info/contact
        const priorityEmail = validEmails.find(e => 
          e.toLowerCase().includes('info') || 
          e.toLowerCase().includes('contact')
        );
        return priorityEmail || validEmails[0];
      }
    }
    
    return null;
  }

  /**
   * Estrae telefono da HTML
   */
  static extractPhoneFromHTML(html) {
    // Pattern per numeri italiani
    const phonePatterns = [
      /(?:\+39\s?)?(?:\d{2,4}[\s.-]?)?\d{6,8}/g,
      /(?:tel\.?|telefono|phone)[\s:]+(\+?[\d\s\.-]+)/gi
    ];

    for (const pattern of phonePatterns) {
      const matches = html.match(pattern);
      if (matches && matches.length > 0) {
        // Pulisci e normalizza
        let phone = matches[0].replace(/[^\d+]/g, '');
        if (phone.length >= 9) {
          return phone;
        }
      }
    }

    return null;
  }

  /**
   * Estrae Codice Fiscale / Partita IVA da HTML
   */
  static extractFiscalCodeFromHTML(html) {
    const text = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');
    
    const patterns = [
      // Partita IVA (11 cifre)
      /(?:p\.?\s*iva|partita\s+iva|codice\s+fiscale|c\.?\s*f\.?)[\s:]+([0-9]{11})/gi,
      // Codice Fiscale alfanumerico (16 caratteri)
      /(?:codice\s+fiscale|c\.?\s*f\.?)[\s:]+([A-Z]{6}[0-9]{2}[A-Z][0-9]{2}[A-Z][0-9]{3}[A-Z])/gi
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[0]) {
        return match[0].replace(/[^A-Z0-9]/gi, '');
      }
    }
    return null;
  }

  /**
   * Estrae numero REA da HTML
   */
  static extractREACodeFromHTML(html) {
    const text = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');
    const pattern = /(?:rea|r\.e\.a\.|registro\s+imprese)[\s:]+([A-Z]{2}[\s-]?\d+)/gi;
    const match = text.match(pattern);
    
    if (match && match[0]) {
      return match[0].replace(/^.*?([A-Z]{2}[\s-]?\d+).*$/i, '$1').trim();
    }
    return null;
  }

  /**
   * Estrae codice accise da HTML
   */
  static extractAcciseCodeFromHTML(html) {
    const text = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');
    const pattern = /(?:accis[ei]|codice\s+accis[ei])[\s:]+([A-Z0-9\s-]+)/gi;
    const match = text.match(pattern);
    
    if (match && match[0]) {
      return match[0].replace(/^.*?([A-Z0-9\s-]{5,}).*$/i, '$1').trim();
    }
    return null;
  }

  /**
   * Estrae anno di fondazione da HTML
   */
  static extractFoundingYearFromHTML(html) {
    const text = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');
    
    const patterns = [
      /(?:fondat[oa]|nasc[ita]|dal|since|anno)[\s:]+(\d{4})/gi,
      /(\d{4})[\s-]+(\d{4})/g  // Range di anni (es: "1990-2025")
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        const year = match[0].match(/\d{4}/)[0];
        const yearNum = parseInt(year);
        if (yearNum >= 1800 && yearNum <= new Date().getFullYear()) {
          return year;
        }
      }
    }
    return null;
  }

  /**
   * Estrae descrizione birrificio da HTML
   */
  static extractDescriptionFromHTML(html, $) {
    // Cerca in meta description
    const metaDesc = $('meta[name="description"]').attr('content') || 
                     $('meta[property="og:description"]').attr('content');
    if (metaDesc && metaDesc.length > 50) {
      return metaDesc.trim();
    }

    // Cerca in paragrafi con keywords
    const keywords = ['birrificio', 'brewery', 'storia', 'tradizione', 'produciamo', 'nasce'];
    const paragraphs = $('p');
    
    for (let i = 0; i < paragraphs.length; i++) {
      const text = $(paragraphs[i]).text().trim();
      if (text.length > 100 && keywords.some(kw => text.toLowerCase().includes(kw))) {
        return text.substring(0, 500); // Max 500 caratteri
      }
    }

    return null;
  }

  /**
   * Estrae storia del birrificio da HTML
   */
  static extractHistoryFromHTML(html, $) {
    const keywords = ['storia', 'history', 'nasce', 'fondato', 'tradizione', 'origini'];
    
    // Cerca sezioni con titoli rilevanti
    const headings = $('h1, h2, h3, h4');
    for (let i = 0; i < headings.length; i++) {
      const heading = $(headings[i]).text().toLowerCase();
      if (keywords.some(kw => heading.includes(kw))) {
        const nextElement = $(headings[i]).next();
        if (nextElement.is('p')) {
          const text = nextElement.text().trim();
          if (text.length > 100) {
            return text.substring(0, 1000); // Max 1000 caratteri
          }
        }
      }
    }

    return null;
  }

  /**
   * Estrae dimensione birrificio da HTML
   */
  static extractBrewerySizeFromHTML(html) {
    const text = html.replace(/<[^>]*>/g, ' ').toLowerCase();
    
    if (text.includes('microbirrificio') || text.includes('micro birrificio')) {
      return 'microbirrificio';
    }
    if (text.includes('birrificio artigianale') || text.includes('artigianal')) {
      return 'birrificio artigianale';
    }
    if (text.includes('birrificio industriale') || text.includes('industrial')) {
      return 'industriale';
    }
    
    // Inferisci da volume produzione se presente
    if (/produzione.*?(\d+).*?ettolitri/i.test(text)) {
      const volume = parseInt(text.match(/(\d+).*?ettolitri/i)[1]);
      if (volume < 1000) return 'microbirrificio';
      if (volume < 10000) return 'birrificio artigianale';
      return 'industriale';
    }

    return null;
  }

  /**
   * Estrae numero dipendenti da HTML
   */
  static extractEmployeeCountFromHTML(html) {
    const text = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');
    const pattern = /(?:dipendent[ei]|collaboratori|team|persone)[\s:]+(\d+)/gi;
    const match = text.match(pattern);
    
    if (match && match[0]) {
      return match[0].match(/\d+/)[0];
    }
    return null;
  }

  /**
   * Estrae volume di produzione da HTML
   */
  static extractProductionVolumeFromHTML(html) {
    const text = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');
    const patterns = [
      /(?:produzione|produciamo)[\s:]+(\d+[\.,]?\d*)\s*(?:ettolitri|hl|litri)/gi,
      /(\d+[\.,]?\d*)\s*(?:ettolitri|hl)[\s\/]*(?:anno|annui)/gi
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[0]) {
        return match[0].trim();
      }
    }
    return null;
  }

  /**
   * Estrae mastro birraio da HTML
   */
  static extractMasterBrewerFromHTML(html, $) {
    const text = html.replace(/<[^>]*>/g, ' ').toLowerCase();
    
    const patterns = [
      /(?:mastro\s+birraio|master\s+brewer|brewmaster)[\s:]+([A-Z][a-zà-ù]+\s+[A-Z][a-zà-ù]+)/gi
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }

    return null;
  }

  /**
   * Estrae social media da HTML
   */
  static extractSocialMediaFromHTML(html, $) {
    const socialMedia = {};

    // Cerca nei link
    const links = $('a[href]');
    links.each((i, link) => {
      const href = $(link).attr('href') || '';
      
      if (href.includes('facebook.com/')) {
        socialMedia.facebook = href;
      } else if (href.includes('instagram.com/')) {
        socialMedia.instagram = href;
      } else if (href.includes('twitter.com/') || href.includes('x.com/')) {
        socialMedia.twitter = href;
      } else if (href.includes('linkedin.com/')) {
        socialMedia.linkedin = href;
      } else if (href.includes('youtube.com/')) {
        socialMedia.youtube = href;
      }
    });

    return Object.keys(socialMedia).length > 0 ? socialMedia : null;
  }

  /**
   * Estrae prodotti principali da HTML
   */
  static extractMainProductsFromHTML(html, $) {
    const products = [];
    const text = html.replace(/<[^>]*>/g, ' ').toLowerCase();
    
    // Parole da escludere (indicano frasi, non prodotti)
    const excludeKeywords = [
      'organizzazione', 'mondiale', 'sanità', 'oms', 'who',
      'consiglia', 'raccomanda', 'studio', 'ricerca', 'secondo',
      'importante', 'necessario', 'fondamentale', 'essenziale',
      'governo', 'ministero', 'legge', 'decreto', 'normativa',
      'articolo', 'comma', 'paragrafo', 'sezione'
    ];
    
    // Cerca stili di birra comuni
    const beerStyles = [
      'ipa', 'lager', 'pils', 'pilsner', 'ale', 'stout', 'porter',
      'weizen', 'blanche', 'saison', 'tripel', 'dubbel', 'quadrupel',
      'bock', 'amber', 'red ale', 'pale ale', 'bitter', 'barley wine'
    ];

    beerStyles.forEach(style => {
      if (text.includes(style)) {
        products.push(style.toUpperCase());
      }
    });

    // Cerca in liste
    const lists = $('ul li, ol li');
    lists.each((i, item) => {
      const itemText = $(item).text().trim();
      const itemTextLower = itemText.toLowerCase();
      
      // Filtri di validazione
      if (itemText.length < 3 || itemText.length > 40) return; // Lunghezza ragionevole
      
      // Escludi se contiene parole non-prodotto
      if (excludeKeywords.some(kw => itemTextLower.includes(kw))) return;
      
      // Escludi se sembra una frase (contiene verbi comuni o punteggiatura)
      if (itemTextLower.match(/\b(è|sono|consiglia|raccomanda|dice|afferma|secondo|per|con|del|della)\b/)) return;
      if (itemText.includes(',') || itemText.includes('.') || itemText.includes('(')) return;
      
      // Se contiene "birra" o stili di birra
      if (itemTextLower.includes('birra') || 
          beerStyles.some(style => itemTextLower.includes(style))) {
        products.push(itemText);
      }
    });

    // Rimuovi duplicati e limita
    const uniqueProducts = [...new Set(products)];
    return uniqueProducts.length > 0 ? uniqueProducts.slice(0, 10) : null; // Max 10 prodotti
  }

  /**
   * Estrae premi e riconoscimenti da HTML
   */
  static extractAwardsFromHTML(html, $) {
    const awards = [];
    const keywords = ['premio', 'award', 'medaglia', 'riconoscimento', 'vincitore', 'winner'];
    
    // Cerca in liste
    const lists = $('ul li, ol li');
    lists.each((i, item) => {
      const text = $(item).text().trim();
      if (keywords.some(kw => text.toLowerCase().includes(kw))) {
        if (text.length > 10 && text.length < 200) {
          awards.push(text);
        }
      }
    });

    // Cerca in paragrafi
    const paragraphs = $('p');
    paragraphs.each((i, p) => {
      const text = $(p).text().trim();
      if (keywords.some(kw => text.toLowerCase().includes(kw))) {
        // Estrai frasi specifiche con premi
        const sentences = text.match(/[^.!?]+[.!?]+/g) || [];
        sentences.forEach(sentence => {
          if (keywords.some(kw => sentence.toLowerCase().includes(kw))) {
            awards.push(sentence.trim());
          }
        });
      }
    });

    return awards.length > 0 ? awards.slice(0, 5) : null; // Max 5 premi
  }

  // ===============================================
  // METODI ESTRAZIONE DATI BIRRE
  // ===============================================

  /**
   * Estrae gradazione alcolica (ABV) da HTML
   */
  static extractAlcoholContentFromHTML(html) {
    const text = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');
    
    const patterns = [
      /(?:abv|alc\.?|vol\.?|gradazione|alcol)[\s:]+(\d+(?:[.,]\d+)?)\s*%/gi,
      /(\d+(?:[.,]\d+)?)\s*%\s*(?:abv|alc\.?|vol\.?)/gi
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        const value = match[0].match(/\d+(?:[.,]\d+)?/)[0].replace(',', '.');
        const num = parseFloat(value);
        if (num >= 0 && num <= 20) { // Validazione range realistico per birre
          return value + '%';
        }
      }
    }
    return null;
  }

  /**
   * Estrae IBU (International Bitterness Units) da HTML
   */
  static extractIBUFromHTML(html) {
    const text = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');
    const pattern = /(?:ibu|bitterness)[\s:]+(\d+)/gi;
    const match = text.match(pattern);
    
    if (match) {
      const value = match[0].match(/\d+/)[0];
      const num = parseInt(value);
      if (num >= 0 && num <= 120) { // Validazione range IBU
        return value;
      }
    }
    return null;
  }

  /**
   * Estrae stile birra da HTML
   */
  static extractBeerTypeFromHTML(html, $) {
    const text = html.replace(/<[^>]*>/g, ' ').toLowerCase();
    
    // Cerca pattern espliciti
    const patterns = [
      /(?:stile|style|tipo|type)[\s:]+([a-z\s]+?)(?:\.|,|<|$)/gi,
      /(?:è|is)\s+(?:un[ao]?\s+)?([a-z\s]+?)\s+(?:beer|birra)/gi
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }

    // Cerca stili comuni
    const beerStyles = [
      'ipa', 'pale ale', 'lager', 'pilsner', 'pils', 'ale', 'stout', 'porter',
      'weizen', 'weisse', 'blanche', 'saison', 'tripel', 'dubbel', 'quadrupel',
      'bock', 'amber', 'red ale', 'bitter', 'barley wine', 'sour', 'gose',
      'kolsch', 'marzen', 'dunkel', 'helles', 'rauchbier'
    ];

    for (const style of beerStyles) {
      if (text.includes(style)) {
        return style.charAt(0).toUpperCase() + style.slice(1);
      }
    }

    return null;
  }

  /**
   * Estrae sotto-stile birra da HTML
   */
  static extractBeerSubStyleFromHTML(html) {
    const text = html.replace(/<[^>]*>/g, ' ').toLowerCase();
    
    const subStyles = [
      'double ipa', 'triple ipa', 'session ipa', 'black ipa',
      'imperial stout', 'milk stout', 'oatmeal stout',
      'belgian pale ale', 'american pale ale',
      'german pilsner', 'czech pilsner', 'italian pilsner',
      'dry stout', 'sweet stout', 'export stout'
    ];

    for (const subStyle of subStyles) {
      if (text.includes(subStyle)) {
        return subStyle.charAt(0).toUpperCase() + subStyle.slice(1);
      }
    }

    return null;
  }

  /**
   * Estrae volume bottiglia/lattina da HTML
   */
  static extractVolumeFromHTML(html) {
    const text = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');
    
    const patterns = [
      /(\d+)\s*(?:ml|millilitri)/gi,
      /(\d+(?:[.,]\d+)?)\s*(?:cl|centilitri)/gi,
      /(\d+(?:[.,]\d+)?)\s*(?:l|litri)/gi,
      /bottiglia.*?(\d+)\s*ml/gi,
      /lattina.*?(\d+)\s*ml/gi
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        return match[0].trim();
      }
    }
    return null;
  }

  /**
   * Estrae descrizione birra da HTML
   */
  static extractBeerDescriptionFromHTML(html, $, beerName) {
    // Cerca in meta description se contiene il nome della birra
    const metaDesc = $('meta[name="description"]').attr('content') || 
                     $('meta[property="og:description"]').attr('content');
    if (metaDesc && metaDesc.toLowerCase().includes(beerName.toLowerCase().split(' ')[0])) {
      return metaDesc.trim();
    }

    // Cerca paragrafi vicini al nome della birra
    const paragraphs = $('p');
    for (let i = 0; i < paragraphs.length; i++) {
      const text = $(paragraphs[i]).text().trim();
      if (text.toLowerCase().includes(beerName.toLowerCase().split(' ')[0]) && text.length > 50) {
        return text.substring(0, 500);
      }
    }

    return null;
  }

  /**
   * Estrae ingredienti birra da HTML
   */
  static extractIngredientsFromHTML(html) {
    const text = html.replace(/<[^>]*>/g, ' ').toLowerCase();
    
    const patterns = [
      /(?:ingredienti|ingredients)[\s:]+([^.<]+)/gi,
      /(?:realizzata|prodotta|fatta)\s+con\s+([^.<]+)/gi
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }

    // Cerca ingredienti comuni
    const ingredients = [];
    const commonIngredients = [
      'malto', 'orzo', 'frumento', 'avena', 'segale',
      'luppolo', 'lievito', 'acqua', 'miele', 'spezie'
    ];

    commonIngredients.forEach(ingredient => {
      if (text.includes(ingredient)) {
        ingredients.push(ingredient);
      }
    });

    return ingredients.length > 0 ? ingredients.join(', ') : null;
  }

  /**
   * Estrae note di degustazione da HTML
   */
  static extractTastingNotesFromHTML(html, $) {
    const keywords = ['degustazione', 'tasting', 'note', 'sapore', 'aroma', 'gusto', 'flavor'];
    
    const paragraphs = $('p');
    for (let i = 0; i < paragraphs.length; i++) {
      const text = $(paragraphs[i]).text().trim();
      if (keywords.some(kw => text.toLowerCase().includes(kw)) && text.length > 30) {
        return text.substring(0, 500);
      }
    }

    return null;
  }

  /**
   * Estrae informazioni nutrizionali da HTML
   */
  static extractNutritionalInfoFromHTML(html) {
    const text = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');
    
    const patterns = [
      /(?:calorie|kcal)[\s:]+(\d+)/gi,
      /(?:carboidrati|carbs)[\s:]+(\d+(?:[.,]\d+)?)\s*g/gi,
      /(?:proteine|protein)[\s:]+(\d+(?:[.,]\d+)?)\s*g/gi,
      /(?:grassi|fat)[\s:]+(\d+(?:[.,]\d+)?)\s*g/gi
    ];

    const nutritionalData = [];
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        nutritionalData.push(match[0].trim());
      }
    }

    return nutritionalData.length > 0 ? nutritionalData.join(', ') : null;
  }

  /**
   * Estrae prezzo birra da HTML
   */
  static extractPriceFromHTML(html) {
    const text = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');
    
    const patterns = [
      /€\s*(\d+(?:[.,]\d{2})?)/gi,
      /(\d+(?:[.,]\d{2})?)\s*€/gi,
      /(?:prezzo|price)[\s:]+€?\s*(\d+(?:[.,]\d{2})?)/gi
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        const value = match[0].match(/\d+(?:[.,]\d{2})?/)[0];
        const num = parseFloat(value.replace(',', '.'));
        if (num > 0 && num < 100) { // Validazione range realistico
          return '€' + value;
        }
      }
    }
    return null;
  }

  /**
   * Estrae disponibilità birra da HTML
   */
  static extractAvailabilityFromHTML(html) {
    const text = html.replace(/<[^>]*>/g, ' ').toLowerCase();
    
    const availabilityKeywords = {
      'disponibile': 'Disponibile',
      'in stock': 'Disponibile',
      'esaurito': 'Esaurito',
      'out of stock': 'Esaurito',
      'limitata': 'Edizione Limitata',
      'limited': 'Edizione Limitata',
      'stagionale': 'Stagionale',
      'seasonal': 'Stagionale'
    };

    for (const [keyword, status] of Object.entries(availabilityKeywords)) {
      if (text.includes(keyword)) {
        return status;
      }
    }

    return null;
  }

  /**
   * Estrae tutte le info birra da una pagina web specifica
   * @param {string} websiteUrl - URL della pagina prodotto birra
   * @param {string} beerName - Nome della birra da cercare
   * @returns {Promise<Object>} Dati birra estratti
   */
  static async extractBeerInfoFromWebsite(websiteUrl, beerName) {
    try {
      logger.info('[HTMLParser] 🍺 Estrazione dati birra da sito', { websiteUrl, beerName });

      const response = await axios.get(websiteUrl, {
        timeout: 8000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      const html = response.data;
      const $ = cheerio.load(html);

      const beerData = {
        alcoholContent: this.extractAlcoholContentFromHTML(html),
        beerType: this.extractBeerTypeFromHTML(html, $),
        beerSubStyle: this.extractBeerSubStyleFromHTML(html),
        ibu: this.extractIBUFromHTML(html),
        volume: this.extractVolumeFromHTML(html),
        description: this.extractBeerDescriptionFromHTML(html, $, beerName),
        ingredients: this.extractIngredientsFromHTML(html),
        tastingNotes: this.extractTastingNotesFromHTML(html, $),
        nutritionalInfo: this.extractNutritionalInfoFromHTML(html),
        price: this.extractPriceFromHTML(html),
        availability: this.extractAvailabilityFromHTML(html),
        source: websiteUrl
      };

      // Calcola confidence basato su campi trovati
      const fieldsFound = Object.values(beerData).filter(v => v !== null && v !== websiteUrl).length;
      const totalFields = 11; // Numero totale di campi (escluso source)
      const confidence = fieldsFound / totalFields;

      beerData.confidence = confidence;
      beerData.fieldsFound = fieldsFound;

      logger.info('[HTMLParser] ✅ Dati birra estratti', {
        beerName,
        fieldsFound,
        confidence: confidence.toFixed(2),
        hasAlcohol: !!beerData.alcoholContent,
        hasIBU: !!beerData.ibu,
        hasType: !!beerData.beerType
      });

      return beerData;

    } catch (error) {
      logger.error('[HTMLParser] ❌ Errore estrazione dati birra', {
        url: websiteUrl,
        beerName,
        error: error.message
      });
      return { confidence: 0, error: error.message };
    }
  }
}

module.exports = HTMLParser;
