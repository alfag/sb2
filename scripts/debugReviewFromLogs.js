#!/usr/bin/env node

/**
 * FUNZIONE DEBUG: Correlazione MongoDB + Server Logs per Review Problematiche
 * 
 * Analizza recensioni problematiche correlando:
 * - Dati MongoDB (Review, Beer, Brewery)
 * - Log server (AI detection, processing, errors)
 * - Timeline completa del flusso
 * 
 * Uso: node scripts/debugReviewFromLogs.js <reviewId>
 * Esempio: node scripts/debugReviewFromLogs.js 693549975afad2c61a8219df
 */

const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

// Configurazione
const LOG_FILE = path.join(__dirname, '../server.log');
const DB_URL = process.env.MONGODB_URL_SB2 || 'mongodb://localhost:27017/sb2_data';

// Colori per output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(msg, color = 'reset') {
  console.log(`${colors[color]}${msg}${colors.reset}`);
}

function section(title) {
  console.log('\n' + '='.repeat(80));
  log(title, 'bright');
  console.log('='.repeat(80));
}

/**
 * Estrae tutte le righe del log correlate al reviewId
 */
function extractLogsForReview(reviewId) {
  try {
    const logContent = fs.readFileSync(LOG_FILE, 'utf8');
    const lines = logContent.split('\n');
    
    const relevantLogs = {
      upload: [],
      aiAnalysis: [],
      moderation: [],
      creation: [],
      processing: [],
      webSearch: [],
      htmlParser: [],
      errors: [],
      admin: [],
      all: []
    };
    
    lines.forEach(line => {
      if (!line.includes(reviewId)) return;
      
      relevantLogs.all.push(line);
      
      // Categorizza i log
      if (line.includes('image.jpg') && line.includes('bytes')) {
        relevantLogs.upload.push(line);
      }
      if (line.includes('Gemini AI') || line.includes('analyzeImageWithGemini') || line.includes('productsFound')) {
        relevantLogs.aiAnalysis.push(line);
      }
      if (line.includes('ContentModeration') || line.includes('moderazione')) {
        relevantLogs.moderation.push(line);
      }
      if (line.includes('Review creato') || line.includes('reviewId')) {
        relevantLogs.creation.push(line);
      }
      if (line.includes('Processing') || line.includes('processing') || line.includes('bottiglia')) {
        relevantLogs.processing.push(line);
      }
      if (line.includes('WebSearch') || line.includes('DuckDuckGo') || line.includes('Google search')) {
        relevantLogs.webSearch.push(line);
      }
      if (line.includes('HTMLParser') || line.includes('Scraping pagina')) {
        relevantLogs.htmlParser.push(line);
      }
      if (line.includes('ERROR') || line.includes('WARN') || line.includes('validation failed')) {
        relevantLogs.errors.push(line);
      }
      if (line.includes('admin') || line.includes('Admin') || line.includes('notifica')) {
        relevantLogs.admin.push(line);
      }
    });
    
    return relevantLogs;
  } catch (error) {
    log(`❌ Errore lettura log: ${error.message}`, 'red');
    return null;
  }
}

/**
 * Estrae dati AI analysis dai log
 */
function extractAiAnalysisData(logs) {
  const aiData = {
    bottlesDetected: 0,
    bottles: [],
    confidence: null,
    timestamp: null
  };
  
  logs.aiAnalysis.forEach(line => {
    // Cerca productsFound/bottlesFound
    const productsMatch = line.match(/"productsFound":\s*(\d+)/);
    const bottlesMatch = line.match(/"bottlesFound":\s*(\d+)/);
    
    if (productsMatch) {
      aiData.bottlesDetected = parseInt(productsMatch[1]);
    }
    if (bottlesMatch && bottlesMatch[1]) {
      aiData.bottlesDetected = parseInt(bottlesMatch[1]);
    }
    
    // Cerca beerName
    const beerNameMatch = line.match(/"beerName":\s*"([^"]+)"/);
    if (beerNameMatch) {
      const beerName = beerNameMatch[1];
      if (!aiData.bottles.find(b => b.beerName === beerName)) {
        aiData.bottles.push({
          beerName,
          searchVariants: extractSearchVariants(line)
        });
      }
    }
    
    // Timestamp
    const timestampMatch = line.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z)/);
    if (timestampMatch && !aiData.timestamp) {
      aiData.timestamp = timestampMatch[1];
    }
  });
  
  return aiData;
}

function extractSearchVariants(line) {
  const match = line.match(/"searchVariants":\s*\[(.*?)\]/);
  if (match) {
    return match[1].split(',').map(v => v.replace(/"/g, '').trim());
  }
  return [];
}

/**
 * Analizza errori dal log
 */
function extractErrors(logs) {
  const errors = [];
  
  logs.errors.forEach(line => {
    const timestampMatch = line.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z)/);
    const timestamp = timestampMatch ? timestampMatch[1] : 'Unknown';
    
    // Errori brewery validation
    if (line.includes('Brewery validation failed')) {
      errors.push({
        type: 'BREWERY_VALIDATION_ERROR',
        timestamp,
        message: 'breweryName is required - NULL value from web scraping',
        critical: true
      });
    }
    
    // Errori nessuna bottiglia processata
    if (line.includes('Nessuna bottiglia processata con successo')) {
      errors.push({
        type: 'NO_BOTTLES_PROCESSED',
        timestamp,
        message: 'All bottles failed during brewery lookup/validation',
        critical: true
      });
    }
    
    // Errori web search
    if (line.includes('BLOCCO CREAZIONE') || line.includes('Nessun birrificio REALE trovato')) {
      const beerMatch = line.match(/per\s+"([^"]+)"/);
      errors.push({
        type: 'BREWERY_NOT_FOUND',
        timestamp,
        beer: beerMatch ? beerMatch[1] : 'Unknown',
        message: 'No brewery found via web search or database',
        critical: true
      });
    }
    
    // HTMLParser failures
    if (line.includes('Nessun dato trovato sul sito')) {
      errors.push({
        type: 'HTMLPARSER_NO_DATA',
        timestamp,
        message: 'HTMLParser could not extract data from brewery website',
        critical: false
      });
    }
  });
  
  return errors;
}

/**
 * Analizza web search attempts
 */
function extractWebSearchAttempts(logs) {
  const attempts = [];
  
  logs.webSearch.forEach(line => {
    if (line.includes('DuckDuckGo scraping') || line.includes('Google search')) {
      const timestampMatch = line.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z)/);
      const queryMatch = line.match(/"query":\s*"([^"]+)"/);
      
      attempts.push({
        timestamp: timestampMatch ? timestampMatch[1] : 'Unknown',
        query: queryMatch ? queryMatch[1] : 'Unknown',
        type: line.includes('DuckDuckGo') ? 'DuckDuckGo' : 'Google'
      });
    }
  });
  
  return attempts;
}

/**
 * Query MongoDB per Review data
 */
async function queryMongoDBForReview(reviewId) {
  try {
    await mongoose.connect(DB_URL);
    log('✅ Connesso a MongoDB', 'green');
    
    const Review = require('../src/models/Review');
    const Beer = require('../src/models/Beer');
    const Brewery = require('../src/models/Brewery');
    
    const review = await Review.findById(reviewId).lean();
    
    if (!review) {
      return { found: false, review: null };
    }
    
    // Query correlate per ogni beer/brewery nei ratings
    const beers = [];
    const breweries = [];
    
    if (review.ratings && review.ratings.length > 0) {
      for (const rating of review.ratings) {
        if (rating.beer) {
          const beer = await Beer.findById(rating.beer).populate('brewery').lean();
          if (beer) beers.push(beer);
        }
        if (rating.brewery) {
          const brewery = await Brewery.findById(rating.brewery).lean();
          if (brewery) breweries.push(brewery);
        }
      }
    }
    
    return {
      found: true,
      review,
      beers,
      breweries
    };
  } catch (error) {
    log(`❌ Errore query MongoDB: ${error.message}`, 'red');
    return { found: false, error: error.message };
  }
}

/**
 * Genera report completo
 */
async function generateDebugReport(reviewId) {
  section(`🔍 DEBUG REPORT - Review: ${reviewId}`);
  
  // 1. Estrai log
  log('\n📋 Fase 1: Estrazione log dal file server.log...', 'cyan');
  const logs = extractLogsForReview(reviewId);
  
  if (!logs || logs.all.length === 0) {
    log(`❌ Nessun log trovato per review ${reviewId}`, 'red');
    return;
  }
  
  log(`✅ Trovate ${logs.all.length} righe di log correlate`, 'green');
  
  // 2. Analizza AI detection
  section('🤖 AI DETECTION ANALYSIS');
  const aiData = extractAiAnalysisData(logs);
  
  if (aiData.bottlesDetected > 0) {
    log(`✅ AI ha rilevato ${aiData.bottlesDetected} bottiglie`, 'green');
    log(`   Timestamp: ${aiData.timestamp}`, 'blue');
    
    if (aiData.bottles.length > 0) {
      log('\n   Bottiglie rilevate:', 'cyan');
      aiData.bottles.forEach((bottle, idx) => {
        log(`   ${idx + 1}. ${bottle.beerName}`, 'yellow');
        if (bottle.searchVariants.length > 0) {
          log(`      Varianti: [${bottle.searchVariants.join(', ')}]`, 'blue');
        }
      });
    }
  } else {
    log('❌ PROBLEMA: AI non ha rilevato bottiglie (FALSE NEGATIVE)', 'red');
  }
  
  // 3. Analizza errori
  section('❌ ERROR ANALYSIS');
  const errors = extractErrors(logs);
  
  if (errors.length === 0) {
    log('✅ Nessun errore rilevato nei log', 'green');
  } else {
    log(`⚠️  Trovati ${errors.length} errori:`, 'yellow');
    errors.forEach((error, idx) => {
      const color = error.critical ? 'red' : 'yellow';
      log(`\n   ${idx + 1}. [${error.type}] ${error.critical ? '🔥 CRITICAL' : '⚠️  WARNING'}`, color);
      log(`      Time: ${error.timestamp}`, 'blue');
      log(`      Message: ${error.message}`, color);
      if (error.beer) {
        log(`      Beer: ${error.beer}`, 'magenta');
      }
    });
  }
  
  // 4. Analizza web search
  section('🌐 WEB SEARCH ATTEMPTS');
  const webSearches = extractWebSearchAttempts(logs);
  
  if (webSearches.length === 0) {
    log('ℹ️  Nessun tentativo web search registrato', 'blue');
  } else {
    log(`🔍 Trovati ${webSearches.length} tentativi di web search:`, 'cyan');
    webSearches.forEach((attempt, idx) => {
      log(`\n   ${idx + 1}. [${attempt.type}]`, 'yellow');
      log(`      Query: ${attempt.query}`, 'blue');
      log(`      Time: ${attempt.timestamp}`, 'blue');
    });
  }
  
  // 5. HTMLParser analysis
  section('🕷️  HTMLPARSER SCRAPING');
  const htmlParserLogs = logs.htmlParser.filter(l => 
    l.includes('Scraping pagina') || l.includes('completato') || l.includes('Nessun dato')
  );
  
  if (htmlParserLogs.length > 0) {
    log(`📄 HTMLParser ha eseguito ${htmlParserLogs.filter(l => l.includes('Scraping pagina')).length} tentativi scraping`, 'cyan');
    
    const noDataLogs = htmlParserLogs.filter(l => l.includes('Nessun dato trovato'));
    if (noDataLogs.length > 0) {
      log(`⚠️  HTMLParser: ${noDataLogs.length} siti senza dati estratti`, 'yellow');
      noDataLogs.forEach(line => {
        const urlMatch = line.match(/"url":\s*"([^"]+)"/);
        if (urlMatch) {
          log(`   - ${urlMatch[1]}`, 'red');
        }
      });
    }
  }
  
  // 6. Query MongoDB
  section('💾 MONGODB DATABASE STATE');
  log('🔍 Interrogazione database...', 'cyan');
  
  const mongoData = await queryMongoDBForReview(reviewId);
  
  if (!mongoData.found) {
    log(`❌ Review ${reviewId} NON trovata nel database`, 'red');
    if (mongoData.error) {
      log(`   Errore: ${mongoData.error}`, 'red');
    }
  } else {
    const { review, beer, brewery } = mongoData;
    
    log('✅ Review trovata nel database', 'green');
    log(`\n📝 Review Data:`, 'cyan');
    log(`   ID: ${review._id}`, 'blue');
    log(`   User: ${review.userDetails?.username || 'Unknown'}`, 'blue');
    log(`   Created: ${review.createdAt}`, 'blue');
    log(`   Status: ${review.processingStatus || 'unknown'}`, review.processingStatus === 'completed' ? 'green' : 'yellow');
    log(`   Overall Rating: ${review.overallRating || 'N/A'} ⭐`, 'yellow');
    log(`   Notes: ${review.notes || 'N/A'}`, 'blue');
    log(`   Needs Validation: ${review.needsValidation ? '⚠️  YES' : '✅ NO'}`, review.needsValidation ? 'yellow' : 'green');
    
    if (review.metadata) {
      log(`\n📊 Metadata:`, 'cyan');
      if (review.metadata.bottlesCount) {
        log(`   Bottles Count: ${review.metadata.bottlesCount}`, 'blue');
      }
      if (review.metadata.extractedBottles) {
        log(`   Extracted Bottles: ${review.metadata.extractedBottles.length}`, 'blue');
      }
      if (review.metadata.processingErrors) {
        log(`   Processing Errors: ${review.metadata.processingErrors.length}`, 'red');
      }
    }
    
    if (beer) {
      log(`\n🍺 Beer Data:`, 'cyan');
      log(`   Name: ${beer.beerName}`, 'yellow');
      log(`   Type: ${beer.beerType || 'Unknown'}`, 'blue');
      log(`   Alcohol: ${beer.alcoholContent ? beer.alcoholContent + '%' : 'Unknown'}`, 'blue');
      log(`   Brewery: ${beer.brewery?.breweryName || 'Unknown'}`, 'magenta');
    } else {
      log(`\n⚠️  Beer Details: NOT FOUND`, 'yellow');
    }
    
    if (brewery) {
      log(`\n🏭 Brewery Data:`, 'cyan');
      log(`   Name: ${brewery.breweryName}`, 'yellow');
      log(`   Address: ${brewery.breweryLegalAddress || 'Unknown'}`, 'blue');
      log(`   Website: ${brewery.website || 'Unknown'}`, 'blue');
      log(`   Email: ${brewery.email || 'Unknown'}`, 'blue');
      log(`   Needs Validation: ${brewery.needsValidation ? '⚠️  YES' : '✅ NO'}`, brewery.needsValidation ? 'yellow' : 'green');
    } else {
      log(`\n⚠️  Brewery Details: NOT FOUND`, 'yellow');
    }
  }
  
  // 7. Correlazione e diagnosi
  section('🔬 CORRELATION & DIAGNOSIS');
  
  log('\n🎯 Confronto AI Detection vs Database State:', 'cyan');
  
  if (aiData.bottlesDetected > 0 && !mongoData.found) {
    log('❌ PROBLEMA CRITICO: AI ha rilevato bottiglie ma Review NON è nel database!', 'red');
    log('   Possibile causa: Processing fallito completamente prima del salvataggio', 'yellow');
  } else if (aiData.bottlesDetected > 0 && mongoData.found) {
    log('✅ AI detection riuscito E Review salvata nel database', 'green');
    
    const dbBottlesCount = mongoData.review.metadata?.bottlesCount || 
                          mongoData.review.metadata?.extractedBottles?.length || 
                          0;
    
    if (aiData.bottlesDetected !== dbBottlesCount && dbBottlesCount > 0) {
      log(`⚠️  DISCREPANZA: AI ha rilevato ${aiData.bottlesDetected} bottiglie, DB ne ha ${dbBottlesCount}`, 'yellow');
      log(`   Possibile causa: Alcune bottiglie fallite durante brewery lookup`, 'yellow');
    }
  } else if (aiData.bottlesDetected === 0 && mongoData.found) {
    log('❌ ANOMALIA: Nessuna bottiglia rilevata da AI ma Review esiste nel DB', 'red');
  }
  
  // 8. Root cause analysis
  section('🎯 ROOT CAUSE ANALYSIS');
  
  const hasBreweryValidationError = errors.some(e => e.type === 'BREWERY_VALIDATION_ERROR');
  const hasBreweryNotFound = errors.some(e => e.type === 'BREWERY_NOT_FOUND');
  const hasHTMLParserFailure = errors.some(e => e.type === 'HTMLPARSER_NO_DATA');
  const hasNoBottlesProcessed = errors.some(e => e.type === 'NO_BOTTLES_PROCESSED');
  
  if (hasBreweryValidationError) {
    log('🔴 ROOT CAUSE: BREWERY VALIDATION FAILURE', 'red');
    log('   ├─ Web search found brewery website', 'yellow');
    log('   ├─ HTMLParser could NOT extract breweryName from website', 'yellow');
    log('   ├─ Database check failed (brewery not in DB)', 'yellow');
    log('   ├─ Gemini AI fallback NOT executed (or failed)', 'yellow');
    log('   ├─ NULL breweryName triggered Mongoose validation error', 'red');
    log('   └─ Entire review processing FAILED', 'red');
    
    log('\n💡 SUGGERIMENTI FIX:', 'cyan');
    log('   1. Migliorare HTMLParser selectors per siti moderni', 'green');
    log('   2. Implementare Gemini AI fallback come strategia primaria', 'green');
    log('   3. Rendere breweryName opzionale con needsValidation flag', 'green');
    log('   4. Permettere salvataggio parziale (alcune bottiglie OK, altre failed)', 'green');
    log('   5. Creare database birrifici comuni pre-popolato', 'green');
  } else if (hasHTMLParserFailure && hasBreweryNotFound) {
    log('🟡 ROOT CAUSE: WEB SCRAPING LIMITATION', 'yellow');
    log('   ├─ HTMLParser cannot extract data from modern age-gated websites', 'yellow');
    log('   ├─ Database does not contain brewery', 'yellow');
    log('   └─ System has no fallback strategy', 'red');
  } else if (aiData.bottlesDetected === 0) {
    log('🔴 ROOT CAUSE: AI DETECTION FAILURE (FALSE NEGATIVE)', 'red');
    log('   ├─ Gemini AI failed to detect bottles in image', 'red');
    log('   └─ Possible causes: Poor image quality, unusual bottle shape, label obscured', 'yellow');
  } else if (hasNoBottlesProcessed) {
    log('🔴 ROOT CAUSE: ALL BOTTLES FAILED PROCESSING', 'red');
    log('   ├─ AI detected bottles correctly', 'green');
    log('   ├─ BUT all bottles failed during brewery lookup/validation', 'red');
    log('   └─ Likely multiple breweries not found or web scraping failures', 'yellow');
  } else {
    log('✅ No critical issues identified in logs', 'green');
  }
  
  // 9. Timeline
  section('⏱️  PROCESSING TIMELINE');
  
  const timeline = [];
  
  logs.upload.forEach(line => {
    const match = line.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z)/);
    if (match) timeline.push({ time: match[1], event: '📤 Image Upload', color: 'blue' });
  });
  
  if (aiData.timestamp) {
    timeline.push({ time: aiData.timestamp, event: '🤖 AI Analysis Complete', color: 'green' });
  }
  
  logs.creation.forEach(line => {
    const match = line.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z)/);
    if (match && line.includes('Review creato')) {
      timeline.push({ time: match[1], event: '💾 Review Created in DB', color: 'green' });
    }
  });
  
  errors.forEach(error => {
    timeline.push({ 
      time: error.timestamp, 
      event: `❌ Error: ${error.type}`, 
      color: 'red' 
    });
  });
  
  timeline.sort((a, b) => new Date(a.time) - new Date(b.time));
  
  timeline.forEach(item => {
    log(`${item.time} - ${item.event}`, item.color);
  });
  
  section('✅ DEBUG REPORT COMPLETE');
  
  await mongoose.disconnect();
}

// Main execution
async function main() {
  const reviewId = process.argv[2];
  
  if (!reviewId) {
    console.log('Uso: node scripts/debugReviewFromLogs.js <reviewId>');
    console.log('');
    console.log('Esempi:');
    console.log('  node scripts/debugReviewFromLogs.js 693549975afad2c61a8219df');
    console.log('  node scripts/debugReviewFromLogs.js 69354a315afad2c61a821a1c');
    process.exit(1);
  }
  
  await generateDebugReport(reviewId);
  process.exit(0);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
