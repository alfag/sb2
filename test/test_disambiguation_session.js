/**
 * Test rapido per verificare che i dati di sessione per la disambiguazione
 * non vengano puliti prematuramente dal CleanupService
 */

const { setupTestDatabase, cleanupTestDatabase, closeTestDatabase } = require('./testHelper');
const CleanupService = require('../src/services/cleanupService');

// Import modelli DOPO setup database per sicurezza
let User, Brewery, Beer;

// Mock della sessione con dati di disambiguazione
const createMockSession = () => {
  return {
    id: 'test-session-123',
    aiReviewData: {
      data: {
        // Dati AI risultanti dall'analisi
        breweries: [
          { name: 'Birrificio Test 1', confidence: 0.7 },
          { name: 'Birrificio Test 2', confidence: 0.8 }
        ],
        disambiguationReason: 'Trovati più birrifici con nomi simili'
      },
      timestamp: new Date().toISOString(), // Appena creato
      needsDisambiguation: true, // FLAG CRITICO
      tempData: true, // FLAG CRITICO
      processed: false
    }
  };
};

async function runDisambiguationTests() {
  try {
    // Setup database di test sicuro (anche se non lo usiamo direttamente)
    await setupTestDatabase();
    
    // Import modelli DOPO connessione sicura
    User = require('../src/models/User');
    Brewery = require('../src/models/Brewery');
    Beer = require('../src/models/Beer');
    
    console.log('🔍 Test Disambiguazione - Sessione Non Deve Essere Pulita');
    console.log('=' .repeat(60));

    // Test 1: Sessione appena creata con disambiguazione NON deve essere pulita
    const sessionFresh = createMockSession();
    console.log('\n1️⃣  Sessione fresca con disambiguazione attiva:');
    console.log('   - needsDisambiguation:', sessionFresh.aiReviewData.needsDisambiguation);
    console.log('   - tempData:', sessionFresh.aiReviewData.tempData);
    console.log('   - timestamp:', sessionFresh.aiReviewData.timestamp);

    const wasCleanedFresh = CleanupService.cleanupUnresolvedSessionData(sessionFresh);
    console.log('   ✅ Sessione pulita?', wasCleanedFresh ? '❌ SÌ (ERRORE!)' : '✅ NO (CORRETTO!)');

    // Test 2: Sessione vecchia di 5 minuti con disambiguazione NON deve essere pulita
    const sessionRecent = createMockSession();
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    sessionRecent.aiReviewData.timestamp = fiveMinutesAgo.toISOString();

    console.log('\n2️⃣  Sessione 5 minuti fa con disambiguazione attiva:');
    console.log('   - needsDisambiguation:', sessionRecent.aiReviewData.needsDisambiguation);
    console.log('   - tempData:', sessionRecent.aiReviewData.tempData);
    console.log('   - età: 5 minuti');

    const wasCleanedRecent = CleanupService.cleanupUnresolvedSessionData(sessionRecent);
    console.log('   ✅ Sessione pulita?', wasCleanedRecent ? '❌ SÌ (ERRORE!)' : '✅ NO (CORRETTO!)');

    // Test 3: Sessione vecchia di 15 minuti con disambiguazione DEVE essere pulita
    const sessionOld = createMockSession();
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
    sessionOld.aiReviewData.timestamp = fifteenMinutesAgo.toISOString();

    console.log('\n3️⃣  Sessione 15 minuti fa con disambiguazione scaduta:');
    console.log('   - needsDisambiguation:', sessionOld.aiReviewData.needsDisambiguation);
    console.log('   - tempData:', sessionOld.aiReviewData.tempData);
    console.log('   - età: 15 minuti (oltre soglia 10 min)');

    const wasCleanedOld = CleanupService.cleanupUnresolvedSessionData(sessionOld);
    console.log('   ✅ Sessione pulita?', wasCleanedOld ? '✅ SÌ (CORRETTO!)' : '❌ NO (ERRORE!)');

    // Test 4: Sessione senza disambiguazione ma dati temporanei vecchi DEVE essere pulita
    const sessionNoDisambiguation = {
      id: 'test-session-no-disamb',
      aiReviewData: {
        data: {
          breweries: [{ name: 'Birrificio Singolo', confidence: 0.95 }]
        },
        timestamp: new Date(Date.now() - 35 * 60 * 1000).toISOString(), // 35 minuti fa
        needsDisambiguation: false, // Non serve disambiguazione
        tempData: true, // Ma sono dati temporanei
        processed: false
      }
    };

    console.log('\n4️⃣  Sessione vecchia SENZA disambiguazione:');
    console.log('   - needsDisambiguation:', sessionNoDisambiguation.aiReviewData.needsDisambiguation);
    console.log('   - tempData:', sessionNoDisambiguation.aiReviewData.tempData);
    console.log('   - età: 35 minuti (oltre soglia 30 min)');

    const wasCleanedNoDisamb = CleanupService.cleanupUnresolvedSessionData(sessionNoDisambiguation);
    console.log('   ✅ Sessione pulita?', wasCleanedNoDisamb ? '✅ SÌ (CORRETTO!)' : '❌ NO (ERRORE!)');

    console.log('\n' + '=' .repeat(60));
    console.log('🎯 RISULTATO TEST:');

    const allTestsPassed = (
      !wasCleanedFresh &&      // Non deve pulire sessione fresca con disambiguazione
      !wasCleanedRecent &&     // Non deve pulire sessione recente con disambiguazione
      wasCleanedOld &&         // Deve pulire sessione vecchia anche con disambiguazione scaduta
      wasCleanedNoDisamb       // Deve pulire sessione senza disambiguazione e scaduta
    );

    if (allTestsPassed) {
      console.log('✅ TUTTI I TEST SUPERATI! Il CleanupService funziona correttamente.');
    } else {
      console.log('❌ ALCUNI TEST FALLITI! Verificare la logica del CleanupService.');
    }

    console.log('\n📋 Verifica che ora nell\'UI:');
    console.log('   1. Fai upload immagine con birrifici ambigui');
    console.log('   2. Appare il pannello di disambiguazione');
    console.log('   3. I dati restano in sessione fino alla risoluzione');
    console.log('   4. Dopo disambiguazione appaiono le stelle di rating');
    
  } catch (error) {
    console.error('❌ Errore durante il test:', error);
  } finally {
    // Cleanup automatico database test
    await cleanupTestDatabase();
    await closeTestDatabase();
    console.log('\n🔌 Connessione database chiusa');
  }
}

// Esegui test se chiamato direttamente
if (require.main === module) {
  runDisambiguationTests();
}

module.exports = { runDisambiguationTests };