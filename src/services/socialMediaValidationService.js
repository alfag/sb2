/**
 * Social Media Validation Service
 * 
 * Servizio ROBUSTO per validazione e estrazione link social media ufficiali dei birrifici.
 * 
 * PROBLEMA RISOLTO:
 * GSR (Google Search Retrieval via Gemini) tende a "allucinare" URL social che SEMBRANO
 * plausibili ma NON ESISTONO (es: youtube.com/user/birramenabrea invece del vero 
 * youtube.com/channel/UCrj2WEHGvZW2TIdxlrZVjtw).
 * 
 * SOLUZIONE:
 * 1. NON fidarsi MAI dei social da GSR (sono pattern inventati dall'AI)
 * 2. Estrazione social SOLO via web scraping dal sito ufficiale del birrificio
 * 3. Validazione HTTP dei link estratti per verificare che esistano realmente
 * 
 * @module socialMediaValidationService
 * @created 1 Febbraio 2026
 */

const axios = require('axios');
const cheerio = require('cheerio');
const https = require('https');
const logWithFileName = require('../utils/logger');
const logger = logWithFileName(__filename);

// Agent HTTPS che ignora errori certificati SSL (necessario per alcuni siti)
const httpsAgent = new https.Agent({
  rejectUnauthorized: false
});

// Configurazione axios standard
const axiosConfig = {
  timeout: 10000,
  httpsAgent,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'it-IT,it;q=0.9,en;q=0.8'
  },
  maxRedirects: 5
};

/**
 * 🔍 ESTRAE i link social media dal sito ufficiale del birrificio
 * Questa è l'UNICA fonte affidabile per i social (non GSR!)
 * 
 * @param {string} websiteUrl - URL del sito ufficiale del birrificio
 * @returns {Promise<Object>} - Oggetto con i social trovati { facebook, instagram, youtube, twitter, linkedin }
 */
async function extractSocialFromWebsite(websiteUrl) {
  const startTime = Date.now();
  const result = {
    facebook: null,
    instagram: null,
    youtube: null,
    twitter: null,
    linkedin: null
  };

  try {
    if (!websiteUrl || typeof websiteUrl !== 'string') {
      logger.debug('[SocialValidation] 🔍 URL sito mancante, skip estrazione social');
      return result;
    }

    // Normalizza URL
    let normalizedUrl = websiteUrl.trim();
    if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
      normalizedUrl = 'https://' + normalizedUrl;
    }

    logger.info(`[SocialValidation] 🔍 Estrazione social dal sito: ${normalizedUrl}`);

    // Fetch homepage
    const response = await axios.get(normalizedUrl, {
      ...axiosConfig,
      validateStatus: (status) => status >= 200 && status < 400
    });

    if (!response.data || typeof response.data !== 'string') {
      logger.warn('[SocialValidation] ⚠️ HTML vuoto o invalido');
      return result;
    }

    const $ = cheerio.load(response.data);

    // === ESTRAZIONE SOCIAL CON PATTERN ROBUSTI ===
    
    // 🔵 FACEBOOK
    // Pattern validi: facebook.com/NomePagina, facebook.com/pages/..., fb.com/..., fb.me/...
    $('a[href*="facebook.com"], a[href*="fb.com"], a[href*="fb.me"]').each((i, el) => {
      if (!result.facebook) {
        const href = $(el).attr('href');
        if (href && isValidFacebookUrl(href)) {
          result.facebook = normalizeUrl(href);
        }
      }
    });

    // 📸 INSTAGRAM
    // Pattern validi: instagram.com/username
    $('a[href*="instagram.com"]').each((i, el) => {
      if (!result.instagram) {
        const href = $(el).attr('href');
        if (href && isValidInstagramUrl(href)) {
          result.instagram = normalizeUrl(href);
        }
      }
    });

    // 📺 YOUTUBE
    // Pattern validi: youtube.com/channel/..., youtube.com/c/..., youtube.com/@username, youtube.com/user/...
    $('a[href*="youtube.com"], a[href*="youtu.be"]').each((i, el) => {
      if (!result.youtube) {
        const href = $(el).attr('href');
        if (href && isValidYoutubeUrl(href)) {
          result.youtube = normalizeUrl(href);
        }
      }
    });

    // 🐦 TWITTER/X
    // Pattern validi: twitter.com/username, x.com/username
    $('a[href*="twitter.com"], a[href*="x.com"]').each((i, el) => {
      if (!result.twitter) {
        const href = $(el).attr('href');
        if (href && isValidTwitterUrl(href)) {
          result.twitter = normalizeUrl(href);
        }
      }
    });

    // 💼 LINKEDIN
    // Pattern validi: linkedin.com/company/..., linkedin.com/in/...
    $('a[href*="linkedin.com"]').each((i, el) => {
      if (!result.linkedin) {
        const href = $(el).attr('href');
        if (href && isValidLinkedinUrl(href)) {
          result.linkedin = normalizeUrl(href);
        }
      }
    });

    const duration = Date.now() - startTime;
    const foundCount = Object.values(result).filter(Boolean).length;

    logger.info(`[SocialValidation] ✅ Estrazione completata in ${duration}ms`, {
      website: normalizedUrl,
      foundSocials: foundCount,
      facebook: !!result.facebook,
      instagram: !!result.instagram,
      youtube: !!result.youtube,
      twitter: !!result.twitter,
      linkedin: !!result.linkedin
    });

    return result;

  } catch (error) {
    const duration = Date.now() - startTime;
    logger.warn(`[SocialValidation] ⚠️ Errore estrazione social (${duration}ms)`, {
      website: websiteUrl,
      error: error.message
    });
    return result;
  }
}

/**
 * ✅ VALIDA i link social verificando che esistano realmente via HTTP
 * 
 * NOTA IMPORTANTE:
 * - I social network restituiscono spesso HTTP 200 anche per pagine inesistenti
 * - Dobbiamo analizzare il contenuto HTML per pattern di errore
 * 
 * @param {Object} socialMedia - Oggetto con link social da validare
 * @returns {Promise<Object>} - Oggetto con solo i link validati
 */
async function validateSocialLinks(socialMedia) {
  if (!socialMedia || typeof socialMedia !== 'object') {
    return {};
  }

  const validated = {};
  
  // Valida ogni link in parallelo per efficienza
  const validationPromises = Object.entries(socialMedia).map(async ([platform, url]) => {
    if (!url || typeof url !== 'string' || url.trim() === '') {
      return { platform, valid: false, url: null };
    }

    const isValid = await validateSingleSocialLink(platform, url.trim());
    return { platform, valid: isValid, url: isValid ? url.trim() : null };
  });

  const results = await Promise.all(validationPromises);

  for (const { platform, valid, url } of results) {
    if (valid && url) {
      validated[platform] = url;
    }
  }

  return validated;
}

/**
 * 🔎 Valida un singolo link social
 * @private
 */
async function validateSingleSocialLink(platform, url) {
  try {
    const response = await axios.get(url, {
      ...axiosConfig,
      timeout: 8000,
      validateStatus: () => true // Accetta qualsiasi status per analizzare contenuto
    });

    // 🔧 FIX: Facebook/Instagram spesso restituiscono 400/403 senza cookie ma URL è valido
    // Se l'URL ha un pattern valido e viene dal sito ufficiale, lo accettiamo
    if (response.status >= 400 && response.status < 500) {
      // Per alcuni social, 4xx può essere un falso negativo (bloccano scraper)
      if (['facebook', 'instagram'].includes(platform)) {
        logger.debug(`[SocialValidation] ⚠️ ${platform}: HTTP ${response.status} - accettato comunque (falso negativo comune)`, { url });
        return true; // Accetta comunque se estratto da sito ufficiale
      }
      logger.debug(`[SocialValidation] ❌ ${platform}: HTTP ${response.status}`, { url });
      return false;
    }
    
    // Status 5xx = errore server, non valido
    if (response.status >= 500) {
      logger.debug(`[SocialValidation] ❌ ${platform}: HTTP ${response.status} (server error)`, { url });
      return false;
    }

    // Analizza contenuto per errori "soft" (200 ma pagina non esiste)
    const htmlContent = (response.data || '').toString().toLowerCase();
    
    // Pattern specifici per ogni piattaforma che indicano pagina non esistente
    const errorPatterns = getErrorPatternsForPlatform(platform);
    const hasError = errorPatterns.some(pattern => htmlContent.includes(pattern.toLowerCase()));

    if (hasError) {
      logger.debug(`[SocialValidation] ❌ ${platform}: Pagina non esistente (pattern errore rilevato)`, { url });
      return false;
    }

    // Verifica presenza di contenuto valido
    const validContentPatterns = getValidContentPatternsForPlatform(platform);
    const hasValidContent = validContentPatterns.length === 0 || 
                           validContentPatterns.some(pattern => htmlContent.includes(pattern.toLowerCase()));

    if (!hasValidContent && validContentPatterns.length > 0) {
      logger.debug(`[SocialValidation] ⚠️ ${platform}: Contenuto valido non trovato`, { url });
      // Non invalidiamo completamente, potrebbe essere un falso negativo
    }

    logger.info(`[SocialValidation] ✅ ${platform}: Link validato`, { url });
    return true;

  } catch (error) {
    // Errore di rete o timeout
    logger.warn(`[SocialValidation] ⚠️ ${platform}: Errore verifica HTTP`, { 
      url, 
      error: error.message 
    });
    // In caso di errore di rete, non invalidiamo (potrebbe essere temporaneo)
    // Ma non lo consideriamo validato al 100%
    return false;
  }
}

// ============================================================================
// HELPER FUNCTIONS - VALIDAZIONE URL PATTERN
// ============================================================================

/**
 * Verifica se un URL Facebook è valido (non un link generico)
 */
function isValidFacebookUrl(url) {
  if (!url) return false;
  const lower = url.toLowerCase();
  
  // Escudi link generici alla homepage
  if (lower === 'https://www.facebook.com/' || lower === 'https://facebook.com/') {
    return false;
  }
  
  // Escudi link a policy/help/etc
  if (/facebook\.com\/(policies|help|privacy|terms|about|settings)/i.test(url)) {
    return false;
  }
  
  // Deve contenere un nome pagina/profilo
  return /facebook\.com\/[a-zA-Z0-9._-]+/i.test(url) || /fb\.com\/[a-zA-Z0-9._-]+/i.test(url);
}

/**
 * Verifica se un URL Instagram è valido
 */
function isValidInstagramUrl(url) {
  if (!url) return false;
  const lower = url.toLowerCase();
  
  // Escudi link generici
  if (lower === 'https://www.instagram.com/' || lower === 'https://instagram.com/') {
    return false;
  }
  
  // Escudi link a policy/help/etc
  if (/instagram\.com\/(about|legal|privacy|terms|help)/i.test(url)) {
    return false;
  }
  
  // Deve contenere un username (no /p/ che sono post, no /explore/)
  return /instagram\.com\/[a-zA-Z0-9._]+\/?$/i.test(url) && 
         !/instagram\.com\/(p|explore|reels|tv)\//i.test(url);
}

/**
 * Verifica se un URL YouTube è valido (canale, non video singolo)
 */
function isValidYoutubeUrl(url) {
  if (!url) return false;
  const lower = url.toLowerCase();
  
  // Escudi link generici
  if (lower === 'https://www.youtube.com/' || lower === 'https://youtube.com/') {
    return false;
  }
  
  // Escudi link a video singoli (watch?v=)
  if (/youtube\.com\/watch\?/i.test(url)) {
    return false;
  }
  
  // Escudi shorts
  if (/youtube\.com\/shorts\//i.test(url)) {
    return false;
  }
  
  // Pattern validi per canali
  // /channel/UC... (ID canale)
  // /c/NomeCanale (URL custom)
  // /@username (nuovo formato handle)
  // /user/username (formato legacy)
  return /youtube\.com\/(channel\/UC|c\/|@|user\/)[a-zA-Z0-9._-]+/i.test(url);
}

/**
 * Verifica se un URL Twitter/X è valido
 */
function isValidTwitterUrl(url) {
  if (!url) return false;
  const lower = url.toLowerCase();
  
  // Escudi link generici
  if (lower === 'https://twitter.com/' || lower === 'https://x.com/') {
    return false;
  }
  
  // Escudi link a policy/help/etc
  if (/(twitter|x)\.com\/(tos|privacy|about|help|settings)/i.test(url)) {
    return false;
  }
  
  // Escudi link a tweet singoli
  if (/(twitter|x)\.com\/[^\/]+\/status\//i.test(url)) {
    return false;
  }
  
  // Deve contenere un username
  return /(twitter|x)\.com\/[a-zA-Z0-9_]+\/?$/i.test(url);
}

/**
 * Verifica se un URL LinkedIn è valido
 */
function isValidLinkedinUrl(url) {
  if (!url) return false;
  const lower = url.toLowerCase();
  
  // Escudi link generici
  if (lower === 'https://www.linkedin.com/' || lower === 'https://linkedin.com/') {
    return false;
  }
  
  // Pattern validi: /company/nome o /in/nome
  return /linkedin\.com\/(company|in)\/[a-zA-Z0-9_-]+/i.test(url);
}

// ============================================================================
// ERROR PATTERNS - Per rilevare pagine inesistenti con HTTP 200
// ============================================================================

function getErrorPatternsForPlatform(platform) {
  const patterns = {
    youtube: [
      'this channel does not exist',
      'questo canale non esiste',
      'channel isn\'t available',
      'canale non disponibile',
      'this page isn\'t available',
      'questa pagina non è disponibile',
      '"error":{"code":404',
      'page not found',
      'pagina non trovata'
    ],
    facebook: [
      'this page isn\'t available',
      'questa pagina non è disponibile',
      'this content isn\'t available',
      'questo contenuto non è disponibile',
      'the link you followed may be broken',
      'il link che hai seguito potrebbe essere stato rimosso',
      'page not found',
      'pagina non trovata',
      'sorry, this content isn\'t available'
    ],
    instagram: [
      'this page isn\'t available',
      'questa pagina non è disponibile',
      'sorry, this page isn\'t available',
      'spiacenti, questa pagina non è disponibile',
      'the link you followed may be broken',
      'page not found',
      'pagina non trovata'
    ],
    twitter: [
      'this account doesn\'t exist',
      'questo account non esiste',
      'account suspended',
      'account sospeso',
      'this page doesn\'t exist',
      'questa pagina non esiste',
      'hmm...this page doesn\'t exist',
      'page not found'
    ],
    linkedin: [
      'page not found',
      'pagina non trovata',
      'this page doesn\'t exist',
      'questa pagina non esiste',
      'profile not found',
      'profilo non trovato'
    ]
  };
  
  return patterns[platform] || ['page not found', 'pagina non trovata', '404'];
}

function getValidContentPatternsForPlatform(platform) {
  // Pattern che indicano contenuto valido (pagina esistente con contenuto reale)
  const patterns = {
    youtube: ['subscribercount', 'channelmetadatarenderer', '"@type":"videoobject"'],
    facebook: ['content="facebook"', 'fb://profile', 'og:title'],
    instagram: ['og:title', 'instagram.com', 'profile_pic'],
    twitter: ['twitter:title', 'og:title', '@'],
    linkedin: ['linkedin.com', 'og:title']
  };
  
  return patterns[platform] || [];
}

// ============================================================================
// UTILITY
// ============================================================================

/**
 * Normalizza un URL social (rimuove trailing slash, converte http->https)
 */
function normalizeUrl(url) {
  if (!url) return null;
  
  let normalized = url.trim();
  
  // Converti http a https
  if (normalized.startsWith('http://')) {
    normalized = normalized.replace('http://', 'https://');
  }
  
  // Aggiungi https se manca
  if (!normalized.startsWith('https://')) {
    normalized = 'https://' + normalized;
  }
  
  // Rimuovi trailing slash
  normalized = normalized.replace(/\/+$/, '');
  
  return normalized;
}

/**
 * 🎯 FUNZIONE PRINCIPALE: Ottiene social media validati per un birrificio
 * 
 * FLUSSO:
 * 1. Estrae social dal sito ufficiale (UNICA fonte affidabile)
 * 2. Valida i link estratti via HTTP
 * 3. Restituisce solo i link validati
 * 
 * @param {string} websiteUrl - URL del sito ufficiale del birrificio
 * @param {Object} [gsrSocial] - Social da GSR (IGNORATI - solo per logging)
 * @returns {Promise<Object>} - Social media validati
 */
async function getValidatedSocialMedia(websiteUrl, gsrSocial = null) {
  const startTime = Date.now();
  
  // Log se GSR aveva social (per debugging)
  if (gsrSocial && Object.values(gsrSocial).some(Boolean)) {
    logger.info('[SocialValidation] ⚠️ GSR aveva social - verranno IGNORATI (possibile allucinazione)', {
      gsrFacebook: gsrSocial.facebook?.substring(0, 50),
      gsrInstagram: gsrSocial.instagram?.substring(0, 50),
      gsrYoutube: gsrSocial.youtube?.substring(0, 50)
    });
  }
  
  // STEP 1: Estrai social dal sito ufficiale
  const extractedSocial = await extractSocialFromWebsite(websiteUrl);
  
  // STEP 2: Valida i link estratti
  const validatedSocial = await validateSocialLinks(extractedSocial);
  
  const duration = Date.now() - startTime;
  const validCount = Object.values(validatedSocial).filter(Boolean).length;
  
  logger.info(`[SocialValidation] 🎯 Social media finali (${duration}ms)`, {
    website: websiteUrl,
    totalValidated: validCount,
    facebook: validatedSocial.facebook || null,
    instagram: validatedSocial.instagram || null,
    youtube: validatedSocial.youtube || null,
    twitter: validatedSocial.twitter || null,
    linkedin: validatedSocial.linkedin || null
  });
  
  return validatedSocial;
}

module.exports = {
  extractSocialFromWebsite,
  validateSocialLinks,
  getValidatedSocialMedia,
  // Esporta anche singole funzioni di validazione per testing
  isValidFacebookUrl,
  isValidInstagramUrl,
  isValidYoutubeUrl,
  isValidTwitterUrl,
  isValidLinkedinUrl
};
