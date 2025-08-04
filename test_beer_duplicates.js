// Test per verificare la gestione duplicati birre
const mongoose = require('mongoose');
const { findOrCreateBeer } = require('./src/utils/geminiAi');
const Beer = require('./src/models/Beer');
const Brewery = require('./src/models/Brewery');

async function testBeerDuplicates() {
  try {
    // Connetti al database (usa le configurazioni del progetto)
    const { DB_URI } = require('./config/config');
    await mongoose.connect(DB_URI);
    console.log('✓ Connesso al database');

    // Crea un birrificio di test se non esiste
    let testBrewery = await Brewery.findOne({ breweryName: 'Test Brewery AI' });
    if (!testBrewery) {
      testBrewery = new Brewery({
        breweryName: 'Test Brewery AI',
        breweryEmail: 'test@brewery.ai',
        aiExtracted: true,
        aiConfidence: 1.0
      });
      await testBrewery.save();
      console.log('✓ Birrificio di test creato:', testBrewery._id);
    } else {
      console.log('✓ Birrificio di test trovato:', testBrewery._id);
    }

    // Test 1: Crea nuova birra
    console.log('\n=== TEST 1: Creazione nuova birra ===');
    const beerData1 = {
      beerName: 'IPA Test AI',
      alcoholContent: '6.5% vol',
      beerType: 'India Pale Ale',
      volume: '330ml',
      description: 'Una IPA test per AI',
      confidence: 0.9
    };

    const beerId1 = await findOrCreateBeer(beerData1, testBrewery._id);
    console.log('Beer ID creata:', beerId1);

    // Test 2: Cerca stessa birra (dovrebbe trovare duplicato)
    console.log('\n=== TEST 2: Ricerca duplicato nome esatto ===');
    const beerData2 = {
      beerName: 'IPA Test AI', // Stesso nome
      alcoholContent: '6.5% vol',
      beerType: 'India Pale Ale',
      volume: '330ml',
      description: 'Una descrizione aggiornata',
      confidence: 0.8
    };

    const beerId2 = await findOrCreateBeer(beerData2, testBrewery._id);
    console.log('Beer ID (dovrebbe essere uguale):', beerId2);
    console.log('Match esatto:', beerId1 === beerId2 ? '✓ SUCCESS' : '✗ FAIL');

    // Test 3: Nome simile con caratteristiche uguali
    console.log('\n=== TEST 3: Ricerca fuzzy con match caratteristiche ===');
    const beerData3 = {
      beerName: 'I.P.A. Test AI', // Nome simile con punteggiatura
      alcoholContent: '6.5% vol',
      beerType: 'India Pale Ale',
      volume: '330ml',
      confidence: 0.7
    };

    const beerId3 = await findOrCreateBeer(beerData3, testBrewery._id);
    console.log('Beer ID fuzzy match:', beerId3);
    console.log('Fuzzy match:', beerId1 === beerId3 ? '✓ SUCCESS' : '✗ FAIL');

    // Test 4: Nome diverso ma caratteristiche tecniche identiche
    console.log('\n=== TEST 4: Match per caratteristiche tecniche ===');
    const beerData4 = {
      beerName: 'Hop Bomb', // Nome completamente diverso
      alcoholContent: '6.5% vol', // Stessi parametri tecnici
      beerType: 'India Pale Ale',
      volume: '330ml',
      confidence: 0.6
    };

    const beerId4 = await findOrCreateBeer(beerData4, testBrewery._id);
    console.log('Beer ID technical match:', beerId4);
    console.log('Technical match:', beerId1 === beerId4 ? '✓ SUCCESS' : '✗ FAIL');

    // Test 5: Birra completamente diversa (dovrebbe creare nuova)
    console.log('\n=== TEST 5: Nuova birra completamente diversa ===');
    const beerData5 = {
      beerName: 'Stout Scura AI',
      alcoholContent: '4.2% vol',
      beerType: 'Imperial Stout',
      volume: '500ml',
      confidence: 0.85
    };

    const beerId5 = await findOrCreateBeer(beerData5, testBrewery._id);
    console.log('Beer ID nuova birra:', beerId5);
    console.log('Nuova birra:', beerId1 !== beerId5 ? '✓ SUCCESS' : '✗ FAIL');

    // Mostra risultati finali
    console.log('\n=== RISULTATI FINALI ===');
    const allBeers = await Beer.find({ brewery: testBrewery._id });
    console.log(`Birre totali create per il birrificio: ${allBeers.length}`);
    allBeers.forEach((beer, index) => {
      console.log(`${index + 1}. ${beer.beerName} (${beer.alcoholContent}, ${beer.beerType})`);
    });

    process.exit(0);
  } catch (error) {
    console.error('Errore durante il test:', error.message);
    process.exit(1);
  }
}

// Esegui test solo se chiamato direttamente
if (require.main === module) {
  testBeerDuplicates();
}

module.exports = { testBeerDuplicates };
