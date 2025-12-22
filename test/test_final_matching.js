// Test finale: simula esattamente il flusso che dovrebbe funzionare
const { setupTestDatabase, cleanupTestDatabase, closeTestDatabase } = require('./testHelper');
const AIService = require('../src/services/aiService');

// Import modelli DOPO setup database per sicurezza
let Brewery;

async function finalTest() {
  try {
    console.log('=== TEST FINALE: SIMULAZIONE FLUSSO COMPLETO ===');

    // Setup database di test sicuro
    await setupTestDatabase();
    console.log('✅ Connesso al database di test sicuro');

    // Import modelli DOPO connessione sicura
    Brewery = require('../src/models/Brewery');
    const allBreweries = await Brewery.find({}, 'breweryName breweryWebsite breweryEmail breweryLegalAddress breweryProductionAddress').lean();

    console.log('Database connesso. Birrifici trovati:', allBreweries.length);

    // Simula esattamente quello che succede quando l'AI estrae 'Birrificio Indipendente Viana'
    const extractedBreweryName = 'Birrificio Indipendente Viana';
    const extractedBreweryData = {
      breweryName: extractedBreweryName,
      breweryWebsite: 'https://www.viana.beer/',
      breweryEmail: 'info@viana.beer'
    };

    console.log('\n=== SIMULAZIONE ESTRAZIONE AI ===');
    console.log('Nome estratto dall\'AI:', extractedBreweryName);
    console.log('Dati completi estratti:', JSON.stringify(extractedBreweryData, null, 2));

    // Chiama la funzione di matching (esattamente come fa il servizio)
    console.log('\n=== CHIAMATA findMatchingBrewery ===');
    const matchingResult = await AIService.findMatchingBrewery(
      extractedBreweryName,
      extractedBreweryData,
      allBreweries
    );

    console.log('\n=== RISULTATO MATCHING ===');
    console.log('Match trovato:', !!matchingResult.match);
    console.log('Richiesta disambiguazione:', matchingResult.needsDisambiguation);
    console.log('Motivo disambiguazione:', matchingResult.disambiguationReason || 'N/A');

    if (matchingResult.match) {
      console.log('SUCCESSO: MATCH CHIARO TROVATO:');
      console.log('  - Nome:', matchingResult.match.breweryName);
      console.log('  - Tipo match:', matchingResult.match.matchType);
      console.log('  - Confidenza:', matchingResult.match.confidence);
    }

    if (matchingResult.ambiguities && matchingResult.ambiguities.length > 0) {
      console.log('AMBIGUITA RILEVATE (' + matchingResult.ambiguities.length + '):');
      matchingResult.ambiguities.forEach((amb, i) => {
        console.log('  ' + (i+1) + '. ' + amb.breweryName + ' (tipo: ' + amb.matchType + ', conf: ' + amb.confidence.toFixed(2) + ')');
      });
    }

    // Verifica finale
    console.log('\n=== VERIFICA FINALE ===');
    if (matchingResult.needsDisambiguation && matchingResult.ambiguities.length >= 2) {
      console.log('SUCCESSO: Il sistema riconosce correttamente l\'ambiguita!');
      console.log('   - Dovrebbe mostrare la pagina di disambiguazione');
      console.log('   - L\'utente dovrebbe poter scegliere tra:');
      matchingResult.ambiguities.forEach((amb, i) => {
        console.log('     ' + (i+1) + '. ' + amb.breweryName);
      });
    } else if (matchingResult.match) {
      console.log('SUCCESSO: Match chiaro trovato, procedi normalmente');
    } else {
      console.log('PROBLEMA: Nessun match trovato, verrebbe creato un nuovo birrificio');
    }

    console.log('\n=== CONCLUSIONI ===');
    console.log('Se questo test mostra ambiguita rilevate, allora:');
    console.log('1. La logica di backend funziona correttamente');
    console.log('2. Il problema potrebbe essere che l\'AI non estrae il nome corretto dall\'immagine');
    console.log('3. Oppure c\'e un problema nella comunicazione frontend-backend');

  } catch (error) {
    console.error('ERRORE durante il test:', error.message);
    console.error(error.stack);
  } finally {
    // Cleanup automatico database test
    await cleanupTestDatabase();
    await closeTestDatabase();
    console.log('\n🔌 Connessione database chiusa');
  }
}

// Esegui test se chiamato direttamente
if (require.main === module) {
  finalTest();
}

module.exports = { finalTest };
