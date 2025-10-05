// Test della logica di matching senza database
const AIService = require('../src/services/aiService');

console.log('Testing AIService matching logic...');

// Simula alcuni birrifici nel database
const mockBreweries = [
  { _id: '1', breweryName: 'Birrificio Viana' },
  { _id: '2', breweryName: 'Birrificio Viana S.r.l.' },
  { _id: '3', breweryName: 'Birrificio Indipendente' },
  { _id: '4', breweryName: 'Brewery Viana' },
  { _id: '5', breweryName: 'Birra Viana' },
  { _id: '6', breweryName: 'Heineken' }
];

const searchName = 'Birrificio Indipendente Viana';
const breweryData = { breweryWebsite: 'https://www.viana.beer/' };

console.log('Search name:', searchName);
console.log('Available breweries:', mockBreweries.map(b => b.breweryName));

// Test similarity calculation
console.log('\nSimilarity calculations:');
mockBreweries.forEach(b => {
  const similarity = AIService.calculateNameSimilarity(searchName, b.breweryName);
  const hasKeywords = AIService.hasCommonKeywords(searchName, b.breweryName);
  console.log(`${b.breweryName}: similarity=${similarity.toFixed(2)}, keywords=${hasKeywords}`);
});

// Test matching logic
console.log('\nTesting findMatchingBrewery...');
AIService.findMatchingBrewery(searchName, breweryData, mockBreweries).then(result => {
  console.log('Matching result:');
  console.log('- Match found:', !!result.match);
  if (result.match) {
    console.log('- Matched brewery:', result.match.breweryName);
    console.log('- Match type:', result.match.matchType);
    console.log('- Confidence:', result.match.confidence);
  }
  console.log('- Needs disambiguation:', result.needsDisambiguation);
  console.log('- Ambiguities count:', result.ambiguities.length);
  if (result.ambiguities.length > 0) {
    console.log('- Ambiguities:');
    result.ambiguities.forEach((a, i) => {
      console.log(`  ${i+1}. ${a.breweryName} (confidence: ${a.confidence ? a.confidence.toFixed(2) : 'N/A'})`);
    });
  }
  console.log('- Disambiguation reason:', result.disambiguationReason);
}).catch(err => {
  console.error('Error:', err.message);
});
