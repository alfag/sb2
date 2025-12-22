const ValidationService = require('../src/utils/validationService');

console.log('=== TEST SISTEMA MODERAZIONE CON CONTENUTO VOLGARE ===\n');

// Test con parole volgari comuni in italiano
const testCases = [
  'Questa birra fa schifo',
  'MERDA di birra',
  'Che cazzata di birra',
  'Birra del cazzo',
  'Porca miseria che schifo',
  'M3rd4 t0t4l3',
  'c4zz0 di birra'
];

testCases.forEach((text, i) => {
  console.log(`Test ${i+1}: '${text}'`);
  const result = ValidationService.checkInappropriateLanguage(text, { strict: true });
  console.log(`Risultato: ${result.isClean ? 'PULITO ❌' : 'INAPPROPRIATO ✓'}`);
  console.log(`Violazioni: ${result.violations.length}`);
  if (result.violations.length > 0) {
    console.log(`Tipi: ${result.violations.map(v => v.type).join(', ')}`);
  }
  console.log(`Confidenza: ${result.confidence.toFixed(3)}\n`);
});

// Test validazione recensione completa
console.log('=== TEST VALIDAZIONE RECENSIONE ===');
const reviewData = {
  reviews: [{
    beerName: 'Birra Test',
    rating: 1,
    notes: 'Questa birra fa proprio schifo, è una merda totale'
  }]
};

const validationResult = ValidationService.validateReviewsInput(reviewData);
console.log(`Validazione: ${validationResult.isValid ? 'VALIDA ❌' : 'NON VALIDA ✓'}`);
if (!validationResult.isValid && validationResult.inappropriateContent) {
  console.log('✓ Contenuto inappropriato rilevato correttamente');
} else if (!validationResult.isValid) {
  console.log('✓ Errore di validazione:', validationResult.message);
} else {
  console.log('❌ PROBLEMA: Recensione con contenuto volgare accettata!');
}
