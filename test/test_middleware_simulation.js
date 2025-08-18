const ValidationService = require('../src/utils/validationService');

// Simuliamo esattamente quello che fa il middleware
const reviews = [
  {
    beerName: 'Birra Eccellente',
    rating: 5,
    notes: 'Questa birra ha un sapore fantastico e una schiuma cremosa'
  }
];

console.log('=== SIMULAZIONE MIDDLEWARE ===\n');

reviews.forEach((review, index) => {
  console.log(`Analizzando recensione ${index + 1}:`);
  
  const fields = ['beerName', 'notes'];
  let violationCount = 0;
  
  fields.forEach(field => {
    if (review[field]) {
      console.log(`  Campo ${field}: '${review[field]}'`);
      const check = ValidationService.checkInappropriateLanguage(review[field], { strict: true });
      console.log(`  Risultato: ${check.isClean ? 'PULITO' : 'INAPPROPRIATO'}`);
      if (!check.isClean) {
        violationCount++;
        console.log(`  Violazioni: ${check.violations.length}`);
        console.log(`  Dettagli violazioni:`, check.violations);
      }
    }
  });
  
  console.log(`  Totale violazioni per questa recensione: ${violationCount}\n`);
});
