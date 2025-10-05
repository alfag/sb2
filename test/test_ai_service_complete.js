// Test del servizio AIService completo con dati reali
const mongoose = require('mongoose');
const AIService = require('../src/services/aiService');

async function testAIServiceComplete() {
  try {
    console.log('=== TEST COMPLETO AISERVICE ===');

    // Connetti al database
    await mongoose.connect(process.env.MONGODB_URL_SB2 || 'mongodb://localhost:27017/sb2');
    console.log('Connessione database riuscita');

    // Recupera birrifici reali
    const Brewery = require('../src/models/Brewery');
    const allBreweries = await Brewery.find({}, 'breweryName breweryWebsite breweryEmail breweryLegalAddress breweryProductionAddress').lean();
    console.log('Birrifici recuperati:', allBreweries.length);

    // Filtra solo quelli che contengono 'viana' per il test
    const vianaBreweries = allBreweries.filter(b =>
      b.breweryName && b.breweryName.toLowerCase().includes('viana')
    );
    console.log('Birrifici Viana trovati:', vianaBreweries.length);
    vianaBreweries.forEach((b, i) => console.log(`  ${i+1}. ${b.breweryName}`));

    // Test case: "Birrificio Indipendente Viana"
    const testBreweryName = 'Birrificio Indipendente Viana';
    const testBreweryData = {
      breweryName: testBreweryName,
      breweryWebsite: 'https://www.viana.beer/',
      breweryEmail: 'info@viana.beer'
    };

    console.log('\n=== TEST MATCHING PER:', testBreweryName, '===');

    const result = await AIService.findMatchingBrewery(testBreweryName, testBreweryData, allBreweries);

    console.log('Risultato matching:');
    console.log('- Match trovato:', !!result.match);
    console.log('- Ambiguità rilevata:', result.needsDisambiguation);
    console.log('- Numero ambiguità:', result.ambiguities?.length || 0);
    console.log('- Ragione disambiguazione:', result.disambiguationReason || 'N/A');

    if (result.match) {
      console.log('Match selezionato:', result.match.breweryName);
      console.log('- Tipo match:', result.match.matchType);
      console.log('- Confidenza:', result.match.confidence);
    }

    if (result.ambiguities && result.ambiguities.length > 0) {
      console.log('Ambiguità trovate:');
      result.ambiguities.forEach((amb, i) => {
        console.log(`  ${i+1}. ${amb.breweryName}`);
        console.log(`     - Tipo: ${amb.matchType}`);
        console.log(`     - Similarità: ${amb.similarity?.toFixed(2) || 'N/A'}`);
        console.log(`     - Keyword match: ${amb.keywordMatch}`);
      });
    }

    // Test con un nome che non dovrebbe creare ambiguità
    console.log('\n=== TEST MATCHING PER: Heineken ===');
    const heinekenResult = await AIService.findMatchingBrewery('Heineken', {}, allBreweries);

    console.log('Risultato per Heineken:');
    console.log('- Match trovato:', !!heinekenResult.match);
    console.log('- Ambiguità rilevata:', heinekenResult.needsDisambiguation);

    if (heinekenResult.match) {
      console.log('Match selezionato:', heinekenResult.match.breweryName);
    }

  } catch (error) {
    console.error('Errore durante il test:', error.message);
    console.error(error.stack);
  } finally {
    await mongoose.disconnect();
    console.log('Connessione database chiusa');
  }
}

testAIServiceComplete();
