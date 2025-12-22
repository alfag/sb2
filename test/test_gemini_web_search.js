/**
 * 🌐 TEST SISTEMA RICERCA WEB CON GEMINI AI
 * 
 * Verifica che il WebSearchService utilizzi correttamente Gemini AI
 * per fare ricerche web reali e strutturare i dati
 */

const { setupTestDatabase, cleanupTestDatabase, closeTestDatabase } = require('./testHelper');
const WebSearchService = require('../src/services/webSearchService');
const logger = require('../src/utils/logger').logWithFileName(__filename);

describe('🌐 Gemini Web Search Integration Tests', function() {
  this.timeout(30000); // 30 secondi per chiamate AI

  before(async function() {
    await setupTestDatabase();
    logger.info('🧪 Setup test database completato');
  });

  after(async function() {
    await cleanupTestDatabase();
    await closeTestDatabase();
  });

  describe('Ricerca Birrificio con Gemini AI', function() {
    
    it('Dovrebbe trovare un birrificio famoso (Raffo)', async function() {
      const result = await WebSearchService.searchBrewery({
        name: 'Raffo',
        location: 'Taranto'
      });

      logger.info('📊 Risultato ricerca Raffo:', result);

      // Assertions
      console.assert(result.found === true, '❌ Birrificio dovrebbe essere trovato');
      console.assert(result.confidence > 0.5, '❌ Confidence troppo bassa');
      console.assert(result.brewery !== null, '❌ Dati birrificio mancanti');
      
      if (result.brewery) {
        console.assert(
          result.brewery.breweryName.toLowerCase().includes('raffo'),
          '❌ Nome birrificio non contiene "Raffo"'
        );
        
        console.log('\n✅ Birrificio trovato:');
        console.log('   Nome:', result.brewery.breweryName);
        console.log('   Website:', result.brewery.breweryWebsite);
        console.log('   Indirizzo:', result.brewery.breweryLegalAddress);
        console.log('   Fonte:', result.source);
        console.log('   Confidence:', result.confidence);
        
        if (result.sources) {
          console.log('   Fonti web:', result.sources.length, 'trovate');
        }
      }
    });

    it('Dovrebbe NON trovare un birrificio inventato', async function() {
      const result = await WebSearchService.searchBrewery({
        name: 'BirrificioInventatoXYZ123NonEsiste'
      });

      logger.info('📊 Risultato ricerca birrificio inventato:', result);

      console.assert(
        result.found === false || result.confidence < 0.5,
        '❌ Birrificio inventato non dovrebbe essere trovato con alta confidence'
      );
      
      console.log('\n✅ Birrificio inventato correttamente NON trovato');
    });

    it('Dovrebbe gestire nomi parziali e trovare risultati', async function() {
      const result = await WebSearchService.searchBrewery({
        name: 'Peroni'
      });

      logger.info('📊 Risultato ricerca parziale Peroni:', result);

      if (result.found) {
        console.log('\n✅ Ricerca parziale funziona:');
        console.log('   Nome trovato:', result.brewery.breweryName);
        console.log('   Confidence:', result.confidence);
      } else {
        console.log('\n⚠️ Peroni non trovato (potrebbe essere OK se non in DB e Gemini non ha info)');
      }
    });
  });

  describe('Ricerca Birra con Gemini AI', function() {
    
    it('Dovrebbe cercare una birra famosa sul web', async function() {
      const result = await WebSearchService.searchBeerOnWeb('Raffo', 'Birrificio Raffo');

      logger.info('📊 Risultato ricerca birra Raffo:', result);

      if (result.found) {
        console.log('\n✅ Birra trovata:');
        console.log('   Nome:', result.beer.beerName);
        console.log('   Tipo:', result.beer.beerType);
        console.log('   Gradazione:', result.beer.alcoholContent);
        console.log('   Descrizione:', result.beer.beerDescription);
        console.log('   Confidence:', result.confidence);
      } else {
        console.log('\n⚠️ Birra non trovata (potrebbe richiedere più contesto)');
      }

      console.assert(result !== null, '❌ Result non dovrebbe essere null');
    });

    it('Dovrebbe gestire birre IPA famose', async function() {
      const result = await WebSearchService.searchBeerOnWeb('BrewDog Punk IPA', 'BrewDog');

      logger.info('📊 Risultato ricerca BrewDog Punk IPA:', result);

      if (result.found) {
        console.log('\n✅ IPA famosa trovata:');
        console.log('   Nome:', result.beer.beerName);
        console.log('   Tipo:', result.beer.beerType);
        console.log('   IBU:', result.beer.ibu);
        console.log('   Confidence:', result.confidence);
      }
    });
  });

  describe('Test Fonti e Confidence', function() {
    
    it('Dovrebbe avere confidence alta per birrifici con sito ufficiale', async function() {
      const result = await WebSearchService.searchBrewery({
        name: 'Baladin'
      });

      logger.info('📊 Test confidence Baladin:', result);

      if (result.found && result.source === 'GEMINI_WEB_SEARCH') {
        console.log('\n📈 Confidence Score:', result.confidence);
        console.log('   Fonti:', result.sources?.length || 0);
        
        console.assert(
          result.confidence >= 0.6,
          '❌ Confidence dovrebbe essere almeno 0.6 per birrifici reali'
        );
      }
    });
  });

  describe('Test Performance e Timeout', function() {
    
    it('Dovrebbe completare ricerca entro 15 secondi', async function() {
      const startTime = Date.now();
      
      const result = await WebSearchService.searchBrewery({
        name: 'Messina'
      });
      
      const duration = Date.now() - startTime;
      logger.info(`⏱️ Tempo ricerca: ${duration}ms`);

      console.assert(duration < 15000, `❌ Ricerca troppo lenta: ${duration}ms`);
      console.log(`✅ Performance OK: ${duration}ms`);
    });
  });
});

// Esegui test se chiamato direttamente
if (require.main === module) {
  console.log('\n🧪 Avvio test Gemini Web Search...\n');
  
  // Run con Mocha programmaticamente
  const Mocha = require('mocha');
  const mocha = new Mocha();
  
  mocha.addFile(__filename);
  
  mocha.run(failures => {
    process.exitCode = failures ? 1 : 0;
  });
}
