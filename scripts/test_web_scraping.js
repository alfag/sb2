#!/usr/bin/env node

/**
 * Script standalone per testare il web scraping di birrifici
 * Salva i risultati direttamente su MongoDB cloud
 *
 * Uso: node scripts/test_web_scraping.js [url]
 * Esempio: node scripts/test_web_scraping.js https://www.birraichnusa.it
 */

const mongoose = require('mongoose');
const HTMLParser = require('../src/utils/htmlParser');
const logWithFileName = require('../src/utils/logger');
const logger = logWithFileName(__filename);

// Schema per salvare i risultati del test
const TestResultSchema = new mongoose.Schema({
  url: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  extractedData: { type: mongoose.Schema.Types.Mixed },
  duration: { type: Number }, // in millisecondi
  success: { type: Boolean },
  error: { type: String }
});

const TestResult = mongoose.model('WebScrapingTest', TestResultSchema);

async function testWebScraping(url) {
  const startTime = Date.now();

  try {
    logger.info('🚀 Inizio test web scraping', { url });

    // Estrai dati dal sito
    const extractedData = await HTMLParser.extractBreweryInfoFromWebsite(url);

    const duration = Date.now() - startTime;
    const success = extractedData.confidence > 0;

    logger.info('✅ Test completato', {
      url,
      success,
      confidence: extractedData.confidence,
      duration: `${duration}ms`,
      fieldsFound: Object.keys(extractedData).filter(key =>
        extractedData[key] !== null && extractedData[key] !== undefined
      ).length
    });

    // Salva risultato su MongoDB
    const testResult = new TestResult({
      url,
      extractedData,
      duration,
      success,
      error: null
    });

    await testResult.save();
    logger.info('💾 Risultato salvato su MongoDB', { id: testResult._id });

    // Log dettagliato dei dati estratti
    console.log('\n📊 DATI ESTRATTI:');
    console.log('================');
    Object.entries(extractedData).forEach(([key, value]) => {
      if (value !== null && value !== undefined && value !== '') {
        if (Array.isArray(value)) {
          console.log(`${key}: [${value.join(', ')}]`);
        } else if (typeof value === 'string' && value.length > 100) {
          console.log(`${key}: ${value.substring(0, 100)}...`);
        } else {
          console.log(`${key}: ${value}`);
        }
      }
    });

    return { success: true, data: extractedData };

  } catch (error) {
    const duration = Date.now() - startTime;

    logger.error('❌ Test fallito', { url, error: error.message, duration: `${duration}ms` });

    // Salva anche gli errori per analisi
    try {
      const testResult = new TestResult({
        url,
        extractedData: null,
        duration,
        success: false,
        error: error.message
      });
      await testResult.save();
      logger.info('💾 Errore salvato su MongoDB', { id: testResult._id });
    } catch (saveError) {
      logger.error('❌ Impossibile salvare errore su MongoDB', saveError);
    }

    return { success: false, error: error.message };
  }
}

async function main() {
  const url = process.argv[2];

  if (!url) {
    console.error('❌ URL richiesta!');
    console.log('Uso: node scripts/test_web_scraping.js <url>');
    console.log('Esempio: node scripts/test_web_scraping.js https://www.birraichnusa.it');
    process.exit(1);
  }

  // Verifica che l'URL sia valido
  try {
    new URL(url);
  } catch (e) {
    console.error('❌ URL non valido!');
    process.exit(1);
  }

  try {
    // Connetti a MongoDB
    logger.info('🔌 Connessione a MongoDB...');
    await mongoose.connect(process.env.MONGODB_URL_SB2);
    logger.info('✅ Connesso a MongoDB');

    // Esegui test
    const result = await testWebScraping(url);

    if (result.success) {
      console.log('\n🎉 Test completato con successo!');
      process.exit(0);
    } else {
      console.log('\n💥 Test fallito!');
      process.exit(1);
    }

  } catch (error) {
    logger.error('❌ Errore connessione MongoDB', error);
    console.error('❌ Impossibile connettere a MongoDB');
    console.error('Verifica che MONGODB_URL_SB2 sia impostata correttamente');
    process.exit(1);
  } finally {
    // Chiudi connessione
    await mongoose.connection.close();
    logger.info('🔌 Connessione MongoDB chiusa');
  }
}

// Gestione errori non catturati
process.on('unhandledRejection', (reason, promise) => {
  logger.error('❌ Unhandled Rejection', { reason, promise });
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  logger.error('❌ Uncaught Exception', error);
  process.exit(1);
});

// Esegui script
if (require.main === module) {
  main();
}

module.exports = { testWebScraping };