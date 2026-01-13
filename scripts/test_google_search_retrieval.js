/**
 * Test Script per GoogleSearchRetrievalService
 * 
 * Verifica che il servizio funzioni correttamente con Google Search Retrieval
 * tramite Gemini AI con grounding.
 * 
 * Uso: node scripts/test_google_search_retrieval.js [breweryName] [beerName]
 * Esempio: node scripts/test_google_search_retrieval.js "Birrificio Italiano" "Tipopils"
 * 
 * 🆕 4 Gen 2026: Usa SOLO ricerca combinata per risparmiare chiamate API
 */

require('dotenv').config();

// Verifica API key
if (!process.env.GEMINI_API_KEY) {
  console.error('❌ GEMINI_API_KEY non configurata nel file .env');
  process.exit(1);
}

const GoogleSearchRetrievalService = require('../src/services/googleSearchRetrievalService');

async function testGoogleSearchRetrieval() {
  console.log('🧪 Test GoogleSearchRetrievalService - RICERCA COMBINATA\n');
  console.log('=' .repeat(60));
  
  // Parametri da riga di comando o default
  const breweryName = process.argv[2] || 'Birrificio Italiano';
  const beerName = process.argv[3] || 'Tipopils';
  
  console.log(`\n📍 Parametri di test:`);
  console.log(`   - Birrificio: ${breweryName}`);
  console.log(`   - Birra: ${beerName}`);
  console.log('\n' + '=' .repeat(60));
  
  // UNICO TEST: Ricerca combinata (risparmia chiamate!)
  console.log('\n🔎 RICERCA COMBINATA birra + birrificio (1 sola chiamata API)...\n');
  
  try {
    const startTime = Date.now();
    const result = await GoogleSearchRetrievalService.searchBeerAndBreweryInfo(beerName, breweryName);
    const elapsed = Date.now() - startTime;
    
    console.log(`⏱️  Tempo risposta: ${elapsed}ms\n`);
    console.log('📊 Risultato ricerca combinata:');
    console.log(`   - Success: ${result.success}`);
    console.log(`   - Confidence: ${result.confidence}`);
    
    // Dati birrificio
    if (result.brewery) {
      const b = result.brewery;
      console.log('\n🏭 BIRRIFICIO:');
      console.log(`   - Nome: ${b.breweryName || 'N/A'}`);
      console.log(`   - Website: ${b.breweryWebsite || 'N/A'}`);
      console.log(`   - Indirizzo: ${b.breweryLegalAddress || 'N/A'}`);
      console.log(`   - Email: ${b.breweryEmail || 'N/A'}`);
      console.log(`   - Telefono: ${b.breweryPhoneNumber || 'N/A'}`);
      console.log(`   - Anno fondazione: ${b.foundingYear || 'N/A'}`);
      if (b.breweryDescription) {
        console.log(`   - Descrizione: ${b.breweryDescription.substring(0, 150)}...`);
      }
    } else {
      console.log('\n🏭 BIRRIFICIO: Nessun dato trovato');
    }
    
    // Dati birra
    if (result.beer) {
      const beer = result.beer;
      console.log('\n🍺 BIRRA:');
      console.log(`   - Nome: ${beer.beerName || 'N/A'}`);
      console.log(`   - Stile: ${beer.beerType || 'N/A'}`);
      console.log(`   - ABV: ${beer.alcoholContent || 'N/A'}`);
      console.log(`   - IBU: ${beer.ibu || 'N/A'}`);
      console.log(`   - Volume: ${beer.volume || 'N/A'}`);
      console.log(`   - Colore: ${beer.color || 'N/A'}`);
      console.log(`   - Ingredienti: ${beer.ingredients || 'N/A'}`);
      if (beer.description) {
        console.log(`   - Descrizione: ${beer.description.substring(0, 150)}...`);
      }
      if (beer.tastingNotes) {
        // tastingNotes può essere stringa o oggetto con appearance, aroma, taste
        if (typeof beer.tastingNotes === 'string') {
          console.log(`   - Note degustazione: ${beer.tastingNotes.substring(0, 150)}...`);
        } else if (typeof beer.tastingNotes === 'object') {
          console.log(`   - Note degustazione:`);
          if (beer.tastingNotes.appearance) console.log(`      • Aspetto: ${beer.tastingNotes.appearance.substring(0, 80)}...`);
          if (beer.tastingNotes.aroma) console.log(`      • Aroma: ${beer.tastingNotes.aroma.substring(0, 80)}...`);
          if (beer.tastingNotes.taste) console.log(`      • Gusto: ${beer.tastingNotes.taste.substring(0, 80)}...`);
        }
      }
      if (beer.pairing) {
        console.log(`   - Abbinamenti: ${beer.pairing}`);
      }
    } else {
      console.log('\n🍺 BIRRA: Nessun dato trovato');
    }
    
    // Fonti
    if (result.sources && result.sources.length > 0) {
      console.log(`\n📚 Fonti (${result.sources.length}):`);
      result.sources.slice(0, 5).forEach((src, i) => {
        console.log(`   ${i+1}. ${src.title || 'N/A'}`);
        console.log(`      ${src.uri || 'N/A'}`);
      });
    }
    
    console.log('\n✅ Test completato con successo!');
    
  } catch (error) {
    console.error(`\n❌ Test fallito: ${error.message}`);
    if (error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack.split('\n').slice(0, 5).join('\n'));
    }
  }
  
  console.log('\n' + '=' .repeat(60));
  console.log('🏁 Fine test');
  console.log('=' .repeat(60));
}

// Esegui test
testGoogleSearchRetrieval().catch(console.error);
