const ValidationService = require('../src/utils/validationService');

const fields = {
  beerName: 'Birra Eccellente',
  notes: 'Questa birra ha un sapore fantastico e una schiuma cremosa'
};

console.log('=== TEST checkMultipleFieldsForInappropriateContent ===\n');

const result = ValidationService.checkMultipleFieldsForInappropriateContent(fields, {
  strict: true,
  context: 'review_0'
});

console.log('Risultato completo:');
console.log(JSON.stringify(result, null, 2));

console.log('\nAnalisi per singoli campi:');
Object.entries(result.fields).forEach(([fieldName, fieldResult]) => {
  console.log(`\nCampo ${fieldName}:`);
  console.log(`  isClean: ${fieldResult.isClean}`);
  console.log(`  violations: ${fieldResult.violations.length}`);
  if (fieldResult.violations.length > 0) {
    console.log(`  dettagli violazioni:`, fieldResult.violations);
  }
});
