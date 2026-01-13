/**
 * HTML Parser per estrazione dati birrifici da siti web
 * Estrae informazioni REALI dai contenuti HTML invece di affidarsi all'AI
 * Usa Puppeteer STEALTH per bypassare protezioni anti-bot (Cloudflare, etc.)
 */

// Puppeteer con plugin Stealth per mascherare automazione
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

const cheerio = require('cheerio');
const axios = require('axios'); // 🆕 FIX: Import axios per extractBeerInfoFromWebsite
const logWithFileName = require('./logger');
const logger = logWithFileName(__filename);

// Cache browser per riutilizzo tra chiamate
let browserInstance = null;

// Funzione per ottenere browser singleton con Stealth
async function getBrowser() {
  if (!browserInstance) {
    logger.info('[HTMLParser] 🚀 Avvio browser con configurazione Stealth AGGRESSIVA anti-rilevamento');
    browserInstance = await puppeteer.launch({
      headless: 'new', // Headless mode con flag anti-rilevamento
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-blink-features=AutomationControlled',
        '--disable-features=IsolateOrigins,site-per-process',
        '--disable-web-security',
        '--disable-site-isolation-trials',
        '--disable-features=VizDisplayCompositor',
        '--window-size=1920,1080',
        '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        '--lang=it-IT',
        '--disable-extensions',
        '--disable-background-networking',
        '--disable-sync',
        '--metrics-recording-only',
        '--disable-default-apps',
        '--mute-audio',
        '--no-first-run',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--disable-ipc-flooding-protection'
      ],
      ignoreDefaultArgs: ['--enable-automation'],
      ignoreHTTPSErrors: true,
      defaultViewport: null
    });
    
    // Cleanup quando processo termina
    process.on('exit', async () => {
      if (browserInstance) {
        await browserInstance.close();
      }
    });
  }
  return browserInstance;
}

class HTMLParser {
  
  /**
   * 🔄 Helper: Attende completamento post-age-gate
   * Gestisce sia redirect JavaScript che semplice rimozione overlay
   * @param {Page} page - Puppeteer page object
   * @returns {Promise<string>} Tipo di completamento ('navigation'|'content-visible'|'timeout')
   */
  static async waitForAgeGateCompletion(page) {
    try {
      const result = await Promise.race([
        // Caso 1: Navigazione JavaScript (es: Ichnusa fa window.location.href = ...)
        page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 10000 })
          .then(() => ({ type: 'navigation' })),
        // Caso 2: Solo overlay nascosto, contenuto già presente
        page.waitForSelector('nav a, .menu a, .navigation a, header a, footer a', { 
          visible: true, timeout: 10000 
        }).then(() => ({ type: 'content-visible' })),
        // Caso 3: Timeout di sicurezza
        new Promise(resolve => setTimeout(() => resolve({ type: 'timeout' }), 8000))
      ]);
      logger.info('[HTMLParser] ✅ Post-age-gate completato', { resultType: result.type });
      return result.type;
    } catch (waitError) {
      logger.debug('[HTMLParser] ⏱️ Attesa post-age-gate fallita, continuo comunque...', { 
        error: waitError.message 
      });
      await new Promise(resolve => setTimeout(resolve, 3000));
      return 'error-fallback';
    }
  }
  
  /**
   * 🔞 GESTIONE AGE-GATE GENERICA per siti birrifici/alcolici
   * Cerca e clicca automaticamente bottoni di conferma maggiore età
   * Funziona con qualsiasi sito usando ricerca testo JavaScript (non selettori CSS)
   * 
   * @param {Page} page - Puppeteer page object
   * @param {string} url - URL del sito (per logging)
   * @returns {Promise<boolean>} true se age-gate gestito, false altrimenti
   */
  static async handleAgeGate(page, url) {
    try {
      // Testi da cercare nei bottoni (case-insensitive)
      // Ordine: più specifici prima, generici dopo
      const buttonTexts = [
        // Italiano - conferma età esplicita
        'ho più di 18 anni',
        'ho 18 anni',
        'sono maggiorenne',
        'maggiorenne',
        'ho compiuto 18',
        'età legale',
        // Italiano - conferma generica (ma nel contesto age-gate)
        'conferma età',
        'verifica età',
        'accedi al sito',
        'entra nel sito',
        'accetto',
        'conferma',
        'continua',
        'entra',
        'accedi',
        'si',   // ⚠️ IMPORTANTE: "Sì" senza accento (comune in form italiani)
        'sì',   // Con accento
        // Inglese - conferma età esplicita
        'i am over 18',
        'i am 18',
        'over 18',
        'of legal age',
        '18 years',
        '21 years',
        'legal drinking age',
        // Inglese - conferma generica
        'confirm age',
        'verify age',
        'enter site',
        'accept',
        'confirm',
        'continue',
        'enter',
        'yes',
        // Tedesco
        'ich bin 18',
        'über 18',
        'volljährig',
        // Francese
        'j\'ai 18 ans',
        'plus de 18',
        'majeur',
        // Spagnolo
        'soy mayor de 18',
        'tengo 18',
        'mayor de edad'
      ];

      // Selettori CSS per elementi age-gate comuni
      const cssSelectors = [
        // ⚠️ PRIORITÀ ALTA: ID specifici italiani (comune in siti birrifici italiani come Ichnusa)
        '#conferma',           // Ichnusa e simili
        '#age-confirm-yes',
        '#btn-conferma',
        // ID comuni internazionali
        '#age-confirm', '#age-gate-confirm', '#age-gate-yes', '#confirm-age',
        '#btn-age-confirm', '#accept-age', '#age-verification-yes', '#agegate-yes',
        '#enter-site', '#age-yes', '#legal-age-yes', '#verify-age-btn',
        // Classi specifiche con suffisso --yes (comune in BEM)
        '.age-gate__submit--yes',  // Ichnusa e simili
        '.age-confirm--yes',
        // Classi comuni
        '.age-confirm', '.age-gate-yes', '.age-gate-button', '.confirm-age',
        '.btn-age-confirm', '.age-verification-btn', '.agegate-btn', '.enter-site-btn',
        // Data attributes
        '[data-age-confirm]', '[data-age-gate="yes"]', '[data-age-verify="true"]',
        '[data-agegate-yes]', '[data-action="age-confirm"]',
        // Classi parziali (contengono parole chiave) - ULTIMO RESORT
        '[class*="age-confirm"]', '[class*="age-gate"]', '[class*="age-verify"]',
        '[class*="agegate"]', '[class*="age-check"]', '[class*="legal-age"]',
        '[id*="age-confirm"]', '[id*="age-gate"]', '[id*="agegate"]'
      ];
      
      // 🔥 STRATEGIA 0 (PRIORITÀ MASSIMA): Click diretto su #conferma con page.click()
      // Questo bypassa problemi di jQuery event handlers che non vengono triggerati da el.click() nel browser
      const prioritySelectors = ['#conferma', '.age-gate__submit--yes', '#age-confirm-yes'];
      for (const selector of prioritySelectors) {
        try {
          const element = await page.$(selector);
          if (element) {
            logger.info('[HTMLParser] 🎯 Trovato selettore prioritario age-gate', { url, selector });
            
            // Usa page.click() nativo di Puppeteer che simula click reale del mouse
            await page.click(selector);
            logger.info('[HTMLParser] ✅ Age-gate superato (click nativo Puppeteer)', { url, selector });
            
            await HTMLParser.waitForAgeGateCompletion(page);
            return true;
          }
        } catch (e) {
          logger.debug('[HTMLParser] Selettore prioritario non trovato o errore click', { selector, error: e.message });
          continue;
        }
      }

      // STRATEGIA 1: Cerca per testo nei bottoni/link usando JavaScript nel browser
      const clickedByText = await page.evaluate((texts) => {
        // Trova tutti gli elementi cliccabili
        const clickables = document.querySelectorAll('button, a, input[type="button"], input[type="submit"], [role="button"], span[onclick], div[onclick]');
        
        for (const text of texts) {
          for (const el of clickables) {
            const elText = (el.textContent || el.value || '').toLowerCase().trim();
            if (elText.includes(text.toLowerCase())) {
              // Verifica che sia visibile
              const rect = el.getBoundingClientRect();
              if (rect.width > 0 && rect.height > 0) {
                el.click();
                return { success: true, text: elText, method: 'text-match' };
              }
            }
          }
        }
        return { success: false };
      }, buttonTexts);

      if (clickedByText.success) {
        logger.info('[HTMLParser] ✅ Age-gate superato (ricerca testo)', { 
          url, 
          buttonText: clickedByText.text,
          method: clickedByText.method
        });
        await HTMLParser.waitForAgeGateCompletion(page);
        return true;
      }

      // STRATEGIA 2: Cerca per selettori CSS
      for (const selector of cssSelectors) {
        try {
          const element = await page.$(selector);
          if (element) {
            // Verifica visibilità
            const isVisible = await page.evaluate(el => {
              const rect = el.getBoundingClientRect();
              return rect.width > 0 && rect.height > 0;
            }, element);
            
            if (isVisible) {
              await element.click();
              logger.info('[HTMLParser] ✅ Age-gate superato (selettore CSS)', { 
                url, 
                selector,
                method: 'css-selector'
              });
              await HTMLParser.waitForAgeGateCompletion(page);
              return true;
            }
          }
        } catch (e) {
          // Selettore non trovato, continua
          continue;
        }
      }

      // STRATEGIA 3: Cerca checkbox "sono maggiorenne" + bottone submit
      const checkboxHandled = await page.evaluate(() => {
        // Cerca checkbox con testo età
        const checkboxes = document.querySelectorAll('input[type="checkbox"]');
        for (const cb of checkboxes) {
          const label = cb.labels?.[0] || cb.closest('label') || cb.parentElement;
          const labelText = (label?.textContent || '').toLowerCase();
          if (labelText.includes('18') || labelText.includes('maggiorenne') || 
              labelText.includes('legal') || labelText.includes('età')) {
            cb.checked = true;
            cb.dispatchEvent(new Event('change', { bubbles: true }));
            
            // Cerca bottone submit vicino
            const form = cb.closest('form');
            const submitBtn = form?.querySelector('button[type="submit"], input[type="submit"]') ||
                             document.querySelector('.age-gate button, .age-verify button, [class*="agegate"] button');
            if (submitBtn) {
              submitBtn.click();
              return { success: true, method: 'checkbox+submit' };
            }
          }
        }
        return { success: false };
      });

      if (checkboxHandled.success) {
        logger.info('[HTMLParser] ✅ Age-gate superato (checkbox + submit)', { url });
        await HTMLParser.waitForAgeGateCompletion(page);
        return true;
      }

      // STRATEGIA 4: Cerca form di verifica anno di nascita
      const birthYearHandled = await page.evaluate(() => {
        // Cerca select per anno di nascita
        const selects = document.querySelectorAll('select');
        for (const select of selects) {
          const name = (select.name || select.id || '').toLowerCase();
          const label = select.closest('label')?.textContent?.toLowerCase() || '';
          
          if (name.includes('year') || name.includes('anno') || name.includes('birth') ||
              label.includes('year') || label.includes('anno') || label.includes('nascita')) {
            // Seleziona anno che rende maggiorenne (es: 1990)
            const option1990 = select.querySelector('option[value="1990"]');
            if (option1990) {
              select.value = '1990';
              select.dispatchEvent(new Event('change', { bubbles: true }));
              
              // Cerca bottone submit
              const form = select.closest('form');
              const submitBtn = form?.querySelector('button[type="submit"], input[type="submit"]');
              if (submitBtn) {
                submitBtn.click();
                return { success: true, method: 'birth-year' };
              }
            }
          }
        }
        return { success: false };
      });

      if (birthYearHandled.success) {
        logger.info('[HTMLParser] ✅ Age-gate superato (selezione anno nascita)', { url });
        await HTMLParser.waitForAgeGateCompletion(page);
        return true;
      }

      // STRATEGIA 5: Gestione cookie consent che potrebbe bloccare age-gate
      const cookieHandled = await page.evaluate(() => {
        const cookieSelectors = [
          '#accept-cookies', '#cookie-accept', '.cookie-accept', '[data-cookie-accept]',
          '#onetrust-accept-btn-handler', '.optanon-allow-all', '#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll',
          'button[aria-label*="cookie"]', 'button[aria-label*="Accept"]'
        ];
        
        for (const sel of cookieSelectors) {
          const btn = document.querySelector(sel);
          if (btn) {
            btn.click();
            return { success: true, type: 'cookie-consent' };
          }
        }
        return { success: false };
      });

      if (cookieHandled.success) {
        logger.info('[HTMLParser] ℹ️ Cookie consent gestito, riprovo age-gate', { url });
        await new Promise(resolve => setTimeout(resolve, 1000));
        // Riprova strategia 1 dopo aver gestito cookies
        return await this.handleAgeGate(page, url);
      }

      logger.info('[HTMLParser] ℹ️ Nessun age-gate rilevato (o già superato)', { url });
      return false;

    } catch (error) {
      logger.warn('[HTMLParser] ⚠️ Errore gestione age-gate', { url, error: error.message });
      return false;
    }
  }

  /**
   * Estrae link interni utili da una pagina web
   * Cerca link che potrebbero contenere info contatti/chi-siamo
   * @param {string} websiteUrl - URL base del sito
   * @returns {Promise<Array>} Array di URL promettenti da controllare
   */
  static async extractUsefulLinks(websiteUrl) {
    try {
      logger.info('[HTMLParser] 🔗 Estrazione link dalla homepage', { url: websiteUrl });
      
      // Usa Puppeteer STEALTH per bypassare protezioni anti-bot (Cloudflare/403)
      const browser = await getBrowser();
      const page = await browser.newPage();
      
      // Configura user-agent realistico (Chrome desktop aggiornato)
      const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
      await page.setUserAgent(userAgent);
      logger.info('[HTMLParser] 🎭 User-Agent configurato:', { userAgent });
      
      // Configura viewport desktop standard
      await page.setViewport({ 
        width: 1920, 
        height: 1080,
        deviceScaleFactor: 1
      });
      
      // Headers HTTP completi per simulare browser reale
      await page.setExtraHTTPHeaders({
        'Accept-Language': 'it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Cache-Control': 'max-age=0'
      });
      
      // Elimina flag webdriver per evasione completa
      await page.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, 'webdriver', {
          get: () => false,
        });
      });
      
      // Naviga alla pagina con timeout 45s
      const response = await page.goto(websiteUrl, { 
        waitUntil: 'domcontentloaded',
        timeout: 45000 
      });
      
      // Log HTTP status code per verificare bypass 403
      const statusCode = response.status();
      logger.info('[HTMLParser] 📡 HTTP Status Code:', { statusCode, url: websiteUrl });
      
      // Attendi completamento challenge Cloudflare (se presente)
      logger.info('[HTMLParser] ⏳ Attesa 5s per completamento challenge anti-bot...');
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Verifica titolo pagina DOPO attesa
      const pageTitle = await page.title();
      logger.info('[HTMLParser] 📄 Titolo pagina:', { title: pageTitle });
      
      if (statusCode === 403 || pageTitle.includes('403') || pageTitle.includes('Forbidden')) {
        logger.error('[HTMLParser] ❌ ERRORE 403 FORBIDDEN - Protezione anti-bot ancora attiva!');
        logger.error('[HTMLParser] 💡 Suggerimento: Cloudflare potrebbe richiedere proxy o metodo alternativo');
      } else if (statusCode === 200) {
        logger.info('[HTMLParser] ✅ Accesso riuscito (200 OK) - Bypass protezione completato!');
      }
      
      // 🔞 GESTIONE DISCLAIMER MAGGIORE ETÀ (comune su siti birrifici/alcolici)
      // Sistema GENERICO che funziona per qualsiasi sito di birra/alcolici
      logger.info(`[HTMLParser] 🔍 Controllo presenza disclaimer maggiore età su URL: ${websiteUrl}`);
      
      // Attendi 2s per rendering completo disclaimer (se presente)
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Gestisci age-gate con funzione dedicata
      const disclaimerHandled = await this.handleAgeGate(page, websiteUrl);
      
      // Attendi rendering completo dopo disclaimer (importante!)
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Ottieni HTML della pagina renderizzata (dopo disclaimer)
      const html = await page.content();
      
      // 🔍 DEBUG: Salva HTML per analisi
      const fs = require('fs');
      const path = require('path');
      const debugPath = path.join(__dirname, '../../logs/debug-html.html');
      fs.writeFileSync(debugPath, html, 'utf8');
      logger.debug('[HTMLParser] 🔍 HTML salvato per debug', { 
        path: debugPath,
        htmlLength: html.length 
      });
      
      await page.close();
      
      const $ = cheerio.load(html);
      const baseUrl = new URL(websiteUrl);
      const usefulLinks = new Set(); // Usa Set per evitare duplicati
      
      // 🔍 DEBUG: Conta tutti i link <a> presenti
      const totalLinksInPage = $('a[href]').length;
      logger.debug('[HTMLParser] 🔍 Link totali nella pagina', { 
        totalLinks: totalLinksInPage,
        websiteUrl 
      });
      
      // Keywords che indicano pagine utili (priorità alta)
      // 🔥 P2.8 FIX: Aggiunte keyword per pagine birre (7 dic 2025)
      const highPriorityKeywords = [
        // Pagine birre (PRIORITÀ MASSIMA per estrazione dati birra)
        'birre', 'beers', 'beer', 'birra', 'le-nostre-birre', 'our-beers',
        'prodotti', 'products', 'catalogo', 'catalog', 'gamma', 'range',
        // Pagine contatto/info
        'contatt', 'contact', 'chi-siamo', 'about', 'dove-siamo', 
        'dove-trovarci', 'location', 'trova', 'find', 'info'
      ];
      
      // Keywords secondarie (priorità media)
      const mediumPriorityKeywords = [
        'azien', 'company', 'storia', 'history', 'team', 'people',
        // 🔥 P2.8: Aggiunti stili birra come keyword media
        'ipa', 'lager', 'pils', 'weiss', 'stout', 'ale', 'porter'
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
            // 🔥 FIX: Evita doppio slash rimuovendo trailing slash dal baseUrl
            const cleanHost = `${baseUrl.protocol}//${baseUrl.hostname}`.replace(/\/$/, '');
            fullUrl = `${cleanHost}${href}`;
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
      
      // 🔥 FALLBACK: Se nessun link trovato, usa pagine comuni
      if (linksArray.length === 0) {
        logger.warn('[HTMLParser] ⚠️ Nessun link trovato nella homepage, uso fallback pagine comuni');
        
        // Rimuovi /intro/ e trailing slash per evitare doppi slash
        const baseUrlClean = websiteUrl
          .replace(/\/(intro|enter|age-gate|disclaimer)\/?$/, '')
          .replace(/\/$/, ''); // 🔥 FIX: Rimuovi trailing slash
        
        // 🔥 P2.8 FIX: Aggiunte pagine birre al fallback (7 dic 2025)
        return [
          baseUrlClean,
          // Pagine birre (PRIORITÀ ALTA)
          `${baseUrlClean}/birre`,
          `${baseUrlClean}/le-nostre-birre`,
          `${baseUrlClean}/beers`,
          `${baseUrlClean}/our-beers`,
          `${baseUrlClean}/prodotti`,
          `${baseUrlClean}/products`,
          // Pagine contatto/info
          `${baseUrlClean}/contatti`,
          `${baseUrlClean}/chi-siamo`,
          `${baseUrlClean}/about`,
          `${baseUrlClean}/contact`,
          `${baseUrlClean}/about-us`,
          `${baseUrlClean}/dove-siamo`,
          `${baseUrlClean}/location`
        ];
      }
      
      // Ritorna solo gli URL
      return linksArray.map(l => l.url);
      
    } catch (error) {
      logger.error('[HTMLParser] ❌ Errore estrazione link', {
        url: websiteUrl,
        error: error.message
      });
      
      // Fallback: ritorna array di pagine comuni
      const cleanUrl = websiteUrl.replace(/\/$/, ''); // 🔥 FIX: Evita doppi slash
      return [
        websiteUrl,
        `${cleanUrl}/contatti`,
        `${cleanUrl}/chi-siamo`,
        `${cleanUrl}/about`,
        `${cleanUrl}/contact`
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
          // Usa Puppeteer per bypassare protezioni anti-bot
          const browser = await getBrowser();
          const page = await browser.newPage();
          
          // Configura headers realistici
          await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
          await page.setExtraHTTPHeaders({
            'Accept-Language': 'it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
          });
          
          // Naviga alla pagina con timeout 30s
          await page.goto(url, { 
            waitUntil: 'networkidle2',
            timeout: 30000 
          });
          
          // 🔞 GESTIONE DISCLAIMER MAGGIORE ETÀ (potrebbe essere su ogni pagina)
          await new Promise(resolve => setTimeout(resolve, 1000)); // Breve attesa per rendering
          await this.handleAgeGate(page, url);
          
          // Ottieni HTML della pagina renderizzata
          const html = await page.content();
          await page.close();
          
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
          logger.info('[HTMLParser] 📝 Estrazione descrizione', { 
            url,
            found: !!description, 
            preview: description?.substring(0, 80) || 'NESSUNA',
            length: description?.length || 0
          });
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
          logger.info('[HTMLParser] 🍺 Estrazione mainProducts', { 
            url,
            found: !!mainProducts, 
            products: mainProducts || 'NESSUNO',
            count: mainProducts?.length || 0
          });
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

      // 🔥 FIX 9 DIC 2025: Calcola confidence basata su TUTTI i campi trovati, non solo indirizzo
      const fieldsFound = [
        extractedData.address,
        extractedData.email,
        extractedData.phone,
        extractedData.fiscalCode,
        extractedData.reaCode,
        extractedData.acciseCode,
        extractedData.foundingYear,
        extractedData.description,
        extractedData.history,
        extractedData.brewerySize,
        extractedData.employeeCount,
        extractedData.productionVolume,
        extractedData.masterBrewer,
        extractedData.socialMedia,
        extractedData.mainProducts && extractedData.mainProducts.length > 0,
        extractedData.awards && extractedData.awards.length > 0
      ].filter(Boolean).length;

      // Se abbiamo trovato almeno qualcosa, calcola confidence
      if (fieldsFound > 0 && extractedData.confidence === 0) {
        // Base: 0.3 + (campi_trovati * 0.05), max 0.8 senza indirizzo
        extractedData.confidence = Math.min(0.3 + (fieldsFound * 0.05), 0.8);
        logger.info('[HTMLParser] 📊 Confidence ricalcolata senza indirizzo', {
          fieldsFound,
          newConfidence: extractedData.confidence
        });
      }

      if (extractedData.address) {
        logger.info('[HTMLParser] 🎯 Dati estratti con successo dal sito', extractedData);
      } else if (fieldsFound > 0) {
        // 🔥 DEBUG 10 DIC 2025: Log dettagliato per verificare contenuto dati
        logger.info('[HTMLParser] 🎯 Dati parziali estratti (senza indirizzo)', {
          fieldsFound,
          hasDescription: !!extractedData.description,
          descriptionLength: extractedData.description?.length || 0,
          descriptionPreview: extractedData.description?.substring(0, 100) || null,
          hasMainProducts: !!(extractedData.mainProducts?.length),
          mainProductsCount: extractedData.mainProducts?.length || 0,
          mainProductsPreview: extractedData.mainProducts?.slice(0, 3) || [],
          confidence: extractedData.confidence
        });
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
   * FIX 22 Dic 2025: Aggiunto pattern per formato "ADDRESS: VIA XXX N.X CAP CITTÀ (PROV)"
   * e corretto troncamento città (es: "Bie" invece di "Biella")
   */
  static extractAddressFromHTML(html) {
    // Rimuovi tag HTML e normalizza spazi
    const text = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');

    // Pattern per indirizzi italiani - CASE INSENSITIVE
    const patterns = [
      // Pattern 0 (PRIORITÀ MASSIMA): Formato "ADDRESS: VIA XXX N.X CAP CITTÀ (PROV) COUNTRY"
      // Es: "ADDRESS: VIA RAMELLA GERMANIN N.4 13900 BIELLA (BI) ITALY"
      // Cattura tutto fino alla provincia tra parentesi inclusa
      /address[\s:]+(?:via|viale|piazza|corso|strada)\s+([a-zàèéìòù\s\.''-]+?)\s*(?:n\.?\s*)?(\d+(?:[-\/]\d+)?)\s*(\d{5})\s+([a-zàèéìòù]+)\s*\(([a-z]{2})\)/gi,
      
      // Pattern SPECIALE per formato "CITTÀ (PROVINCIA) – Località/loc. Nome n. numero – CAP xxxxx"
      // Es: "POLLEIN (AO) – Località L'Île-des-Lapins n. 11 – CAP 11020"
      /([a-zàèéìòù\s]+?)\s*\(([A-Z]{2})\)\s*[–-]\s*(?:località|localita|loc\.?)\s+([a-zàèéìòù\s\.''-]+?)\s*(?:n\.\s*)?(\d+(?:[-\/]\d+)?)\s*[–-]\s*(?:cap\s*)?(\d{5})/gi,
      
      // Pattern completo: via/viale/corso + nome + numero + CAP + città + provincia
      // FIX: città usa [a-zàèéìòù]+ (greedy, non lazy) per catturare nome completo
      /(?:via|viale|piazza|corso|strada|contrada|località|localita|loc\.?)\s+([a-zàèéìòù\s\.''-]{1,100}?)\s*(?:n\.?\s*)?(\d+(?:[-\/]\d+)?)\s*[,\s–-]*(\d{5})\s+([a-zàèéìòù]+)\s*\(?([A-Z]{2})\)?/gi,
      
      // Pattern senza CAP ma con provincia
      /(?:via|viale|piazza|corso|strada|località|localita|loc\.?)\s+([a-zàèéìòù\s\.''-]{1,100}?)\s*(?:n\.?\s*)?(\d+(?:[-\/]\d+)?)\s*[,\s–-]+([a-zàèéìòù]+)\s*\(?([A-Z]{2})\)?/gi,
      
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
        
        // Rimuovi keyword "ADDRESS:" se presente all'inizio
        fullMatch = fullMatch.replace(/^address[\s:]+/i, '');
        
        // Rimuovi "ITALY" o "ITALIA" se presente alla fine
        fullMatch = fullMatch.replace(/\s*(italy|italia)\s*$/i, '');
        
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
        
        // Bonus ALTO per pattern 0 (ADDRESS: keyword)
        if (patternIndex === 0) confidence += 0.3;
        
        // Bonus per CAP presente
        if (/\d{5}/.test(fullMatch)) confidence += 0.2;
        
        // Bonus per provincia presente
        if (/\([A-Za-z]{2}\)/i.test(fullMatch)) confidence += 0.2;
        
        // Bonus per numero civico con range (es: 14-22)
        if (/\d+-\d+/.test(fullMatch)) confidence += 0.1;
        
        // Bonus per lunghezza ragionevole
        if (fullMatch.length > 25 && fullMatch.length < 120) confidence += 0.1;

        if (confidence > bestConfidence) {
          bestMatch = fullMatch;
          bestConfidence = confidence;
          
          // Se trovato con pattern ADDRESS (priorità 0), log e usa questo
          if (patternIndex === 0) {
            logger.info('[HTMLParser] 📍 Indirizzo estratto con keyword ADDRESS', { address: fullMatch });
          }
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
   * FIX 22 Dic 2025: Pattern più specifici per evitare cattura di numeri casuali (P.IVA, ID prodotto, etc.)
   * Il pattern precedente catturava qualsiasi sequenza di 9+ numeri causando falsi positivi
   */
  static extractPhoneFromHTML(html) {
    const text = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');
    
    // Pattern SPECIFICI per numeri telefonici italiani - in ordine di priorità
    const phonePatterns = [
      // Pattern 1 (ALTA PRIORITÀ): Numero con keyword "PHONE:" o "TEL:" davanti
      // Es: "PHONE: +39 (0) 152522320" o "TEL: 0141 123456"
      /(?:phone|tel|telefono)[\s:]+\+?39?\s*\(?0?\)?\s*(\d{2,4})[\s.-]?(\d{5,8})/gi,
      
      // Pattern 2 (ALTA PRIORITÀ): Formato +39 esplicito con prefisso
      // Es: "+39 0141 123456" o "+39 (0) 152522320"
      /\+39\s*\(?0?\)?\s*(\d{2,4})[\s.-]?(\d{5,8})/g,
      
      // Pattern 3 (MEDIA PRIORITÀ): Formato italiano con prefisso 0XX
      // Es: "0141.123456" o "0141-123456" o "0141 123456"
      /\b0(\d{2,3})[\s.-](\d{5,8})\b/g,
      
      // Pattern 4 (BASSA PRIORITÀ): Numero con almeno un separatore (per evitare ID/codici)
      // Es: "141.123456" o "141-123456" - RICHIEDE separatore per distinguere da codici
      /\b(\d{3,4})[\s.-](\d{5,7})\b/g
    ];

    let bestMatch = null;
    let bestPriority = 999;

    for (let priority = 0; priority < phonePatterns.length; priority++) {
      const pattern = phonePatterns[priority];
      const matches = [...text.matchAll(pattern)];
      
      for (const match of matches) {
        // Ricostruisci numero completo
        let phone = match[0].replace(/[^\d+]/g, '');
        
        // Rimuovi prefisso +39 se presente per normalizzazione
        phone = phone.replace(/^\+?39/, '');
        
        // Aggiungi 0 iniziale se mancante per FISSI (prefissi area iniziano con 0)
        // NON aggiungere 0 ai CELLULARI (iniziano con 3)
        if (!phone.startsWith('0') && !phone.startsWith('3') && phone.length >= 9 && phone.length <= 11) {
          phone = '0' + phone;
        }
        
        // Validazione: numero italiano deve essere 9-12 cifre e iniziare con 0 (fisso) o 3 (cellulare)
        // Fissi: 0XX XXXXXXX (9-11 cifre), Cellulari: 3XX XXXXXXX (10 cifre)
        if (phone.length >= 9 && phone.length <= 12 && (phone.startsWith('0') || phone.startsWith('3'))) {
          // Verifica che NON sia una P.IVA (11 cifre senza 0 iniziale non è telefono)
          // e che NON sia un codice REA (6-7 cifre)
          if (priority < bestPriority) {
            bestMatch = phone;
            bestPriority = priority;
            
            // Se trovato con keyword PHONE/TEL (priorità 0), usa questo
            if (priority === 0) {
              logger.info('[HTMLParser] 📞 Telefono estratto con keyword', { phone, pattern: 'PHONE/TEL keyword' });
              return phone;
            }
          }
        }
      }
    }

    if (bestMatch) {
      logger.info('[HTMLParser] 📞 Telefono estratto', { phone: bestMatch, priority: bestPriority });
    }
    
    return bestMatch;
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
   * Estrae numero REA da HTML con validazione formato
   * Formato valido: 2 lettere maiuscole + dash/spazio + 6 cifre (es: MI-1234567, TO 987654)
   * FIX: Previene confusione con nomi birre (es: "La 150" non è un REA code)
   */
  static extractREACodeFromHTML(html) {
    const text = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');
    
    // Pattern più specifico: REA + 2 lettere + dash/spazio opzionale + 6-7 cifre
    const pattern = /(?:rea|r\.e\.a\.|registro\s+imprese)[\s:]+([A-Z]{2}[\s-]?\d{6,7})/gi;
    const match = text.match(pattern);
    
    if (match && match[0]) {
      const extracted = match[0].replace(/^.*?([A-Z]{2}[\s-]?\d{6,7}).*$/i, '$1').trim();
      
      // Validazione formato: XX-123456 o XX 123456 (2 lettere + 6-7 cifre)
      const validFormat = /^[A-Z]{2}[\s-]?\d{6,7}$/i.test(extracted);
      
      if (validFormat) {
        return extracted;
      } else {
        logger.warn(`[HTMLParser] ⚠️ REA code estratto non valido (formato errato): ${extracted}`);
        return null;
      }
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
      const hrefLower = href.toLowerCase();
      
      // Pattern case-insensitive senza slash obbligatorio
      if (hrefLower.includes('facebook.com') && !socialMedia.facebook) {
        socialMedia.facebook = href;
      } else if (hrefLower.includes('instagram.com') && !socialMedia.instagram) {
        socialMedia.instagram = href;
      } else if ((hrefLower.includes('twitter.com') || hrefLower.includes('x.com')) && !socialMedia.twitter) {
        socialMedia.twitter = href;
      } else if (hrefLower.includes('linkedin.com') && !socialMedia.linkedin) {
        socialMedia.linkedin = href;
      } else if (hrefLower.includes('youtube.com') && !socialMedia.youtube) {
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
   * MIGLIORATO: Cerca prima la pagina specifica della birra, poi fallback alla homepage
   * @param {string} websiteUrl - URL base del sito birrificio
   * @param {string} beerName - Nome della birra da cercare
   * @returns {Promise<Object>} Dati birra estratti
   */
  static async extractBeerInfoFromWebsite(websiteUrl, beerName) {
    try {
      logger.info('[HTMLParser] 🍺 Estrazione dati birra da sito', { websiteUrl, beerName });

      // 1. Costruisci possibili URL per pagina specifica birra
      const baseUrl = websiteUrl.replace(/\/$/, ''); // Rimuovi trailing slash
      const beerSlug = beerName
        .toLowerCase()
        .replace(/[àáâãäå]/g, 'a')
        .replace(/[èéêë]/g, 'e')
        .replace(/[ìíîï]/g, 'i')
        .replace(/[òóôõö]/g, 'o')
        .replace(/[ùúûü]/g, 'u')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
      
      // Pattern comuni per pagine birra
      const possibleUrls = [
        `${baseUrl}/birre/${beerSlug}`,
        `${baseUrl}/birra/${beerSlug}`,
        `${baseUrl}/beers/${beerSlug}`,
        `${baseUrl}/prodotti/${beerSlug}`,
        `${baseUrl}/products/${beerSlug}`,
        `${baseUrl}/${beerSlug}`,
        `${baseUrl}/le-nostre-birre/${beerSlug}`,
        `${baseUrl}/our-beers/${beerSlug}`,
        baseUrl // Homepage come fallback finale
      ];

      let html = '';
      let successUrl = '';

      // 2. Prova ogni URL finché uno funziona
      for (const url of possibleUrls) {
        try {
          logger.info(`[HTMLParser] 🔍 Provo URL birra: ${url}`);
          const response = await axios.get(url, {
            timeout: 6000,
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            validateStatus: (status) => status < 400 // Accetta solo 2xx e 3xx
          });
          
          // Verifica che la pagina contenga contenuto rilevante
          if (response.data && response.data.length > 1000) {
            html = response.data;
            successUrl = url;
            logger.info(`[HTMLParser] ✅ URL birra trovato: ${url}`);
            break;
          }
        } catch (urlError) {
          // Continua con prossimo URL
          continue;
        }
      }

      if (!html) {
        logger.warn('[HTMLParser] ⚠️ Nessun URL valido trovato per birra', { beerName });
        return { confidence: 0, error: 'Nessun URL valido' };
      }

      const $ = cheerio.load(html);

      // 3. Estrai dati dalla pagina trovata
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
        source: successUrl
      };

      // Calcola confidence basato su campi trovati
      const fieldsFound = Object.values(beerData).filter(v => v !== null && v !== successUrl).length;
      const totalFields = 11; // Numero totale di campi (escluso source)
      const confidence = fieldsFound / totalFields;

      beerData.confidence = confidence;
      beerData.fieldsFound = fieldsFound;

      logger.info('[HTMLParser] ✅ Dati birra estratti', {
        beerName,
        sourceUrl: successUrl,
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
