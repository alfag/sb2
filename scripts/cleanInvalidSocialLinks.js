/**
 * Script per pulire i social media links non validi dal database
 * Verifica che ogni link social esista realmente (non solo HTTP 200)
 * 
 * Eseguire con: node scripts/cleanInvalidSocialLinks.js
 * 
 * @created 1 feb 2026
 */

const mongoose = require('mongoose');
const axios = require('axios');
const config = require('../config/config');

// Pattern che indicano pagina/profilo non esistente
const errorPatterns = {
  youtube: [
    'questo canale non esiste',
    'this channel doesn\'t exist',
    'canale non disponibile',
    'channel isn\'t available',
    'pagina non trovata',
    'page not found',
    '404',
    'video non disponibile'
  ],
  facebook: [
    'pagina non trovata',
    'page not found',
    'non è disponibile',
    'isn\'t available',
    'contenuto non disponibile',
    'content isn\'t available',
    'questo contenuto non è al momento disponibile',
    'the link you followed may be broken'
  ],
  instagram: [
    'pagina non trovata',
    'page not found',
    'questa pagina non è disponibile',
    'this page isn\'t available',
    'spiacenti, questa pagina non è disponibile',
    'sorry, this page isn\'t available'
  ],
  twitter: [
    'account sospeso',
    'account suspended',
    'questa pagina non esiste',
    'this page doesn\'t exist',
    'pagina non trovata',
    'page not found',
    'doesn\'t exist'
  ],
  linkedin: [
    'pagina non trovata',
    'page not found',
    'profilo non disponibile',
    'page not found'
  ]
};

/**
 * Valida un singolo link social
 */
async function validateSocialLink(platform, url) {
  if (!url || typeof url !== 'string' || url.trim() === '') {
    return { valid: false, reason: 'URL vuoto' };
  }

  try {
    const response = await axios.get(url.trim(), {
      timeout: 15000,
      maxRedirects: 5,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'it-IT,it;q=0.9,en;q=0.8'
      },
      validateStatus: (status) => status < 500
    });

    // Se 4xx, link non valido
    if (response.status >= 400) {
      return { valid: false, reason: `HTTP ${response.status}` };
    }

    // Verifica contenuto per errori "soft"
    const htmlLower = (response.data || '').toString().toLowerCase();
    const patterns = errorPatterns[platform] || [];

    for (const pattern of patterns) {
      if (htmlLower.includes(pattern.toLowerCase())) {
        return { valid: false, reason: `Contenuto: "${pattern}"` };
      }
    }

    return { valid: true };

  } catch (error) {
    return { valid: false, reason: `Errore: ${error.message}` };
  }
}

/**
 * Main: pulisce tutti i social links non validi
 */
async function cleanInvalidSocialLinks() {
  console.log('🔧 Pulizia Social Links Non Validi\n');
  console.log('=' .repeat(60));

  try {
    // Connessione MongoDB
    await mongoose.connect(config.MONGODB_URL);
    console.log('✅ Connesso a MongoDB\n');

    const Brewery = require('../src/models/Brewery');

    // Trova tutti i birrifici con social media
    const breweries = await Brewery.find({
      $or: [
        { 'brewerySocialMedia.facebook': { $exists: true, $ne: null, $ne: '' } },
        { 'brewerySocialMedia.instagram': { $exists: true, $ne: null, $ne: '' } },
        { 'brewerySocialMedia.twitter': { $exists: true, $ne: null, $ne: '' } },
        { 'brewerySocialMedia.youtube': { $exists: true, $ne: null, $ne: '' } },
        { 'brewerySocialMedia.linkedin': { $exists: true, $ne: null, $ne: '' } }
      ]
    });

    console.log(`📊 Trovati ${breweries.length} birrifici con social media\n`);

    let totalChecked = 0;
    let totalInvalid = 0;
    let totalRemoved = 0;

    for (const brewery of breweries) {
      const social = brewery.brewerySocialMedia || {};
      const invalidLinks = [];
      const validLinks = {};

      console.log(`\n📍 ${brewery.breweryName}`);

      for (const [platform, url] of Object.entries(social)) {
        if (!url || url === 'null' || url.trim() === '') continue;

        totalChecked++;
        process.stdout.write(`   ${platform}: ${url.substring(0, 50)}... `);

        const result = await validateSocialLink(platform, url);

        if (result.valid) {
          console.log('✅');
          validLinks[platform] = url;
        } else {
          console.log(`❌ (${result.reason})`);
          invalidLinks.push({ platform, url, reason: result.reason });
          totalInvalid++;
        }

        // Pausa per evitare rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // Aggiorna il birrificio se ci sono link non validi
      if (invalidLinks.length > 0) {
        console.log(`   🔧 Rimuovo ${invalidLinks.length} link non validi...`);
        
        await Brewery.updateOne(
          { _id: brewery._id },
          { $set: { brewerySocialMedia: validLinks } }
        );
        
        totalRemoved += invalidLinks.length;
        console.log(`   ✅ Aggiornato!`);
      }
    }

    console.log('\n' + '=' .repeat(60));
    console.log('📊 RIEPILOGO:');
    console.log(`   - Link verificati: ${totalChecked}`);
    console.log(`   - Link non validi trovati: ${totalInvalid}`);
    console.log(`   - Link rimossi: ${totalRemoved}`);
    console.log('=' .repeat(60));

  } catch (error) {
    console.error('❌ Errore:', error.message);
  } finally {
    await mongoose.connection.close();
    console.log('\n✅ Disconnesso da MongoDB');
  }
}

// Esegui
cleanInvalidSocialLinks();
