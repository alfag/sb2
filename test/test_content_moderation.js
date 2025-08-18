const ValidationService = require('../src/utils/validationService');

console.log('=== TEST SISTEMA MODERAZIONE CONTENUTI ===\n');

// Test 1: Testo pulito
console.log('Test 1 - Testo pulito:');
const cleanText = "Questa birra ha un sapore eccellente e una schiuma cremosa";
const cleanResult = ValidationService.checkInappropriateLanguage(cleanText);
console.log(`Risultato: ${cleanResult.isClean ? 'PULITO' : 'INAPPROPRIATO'}`);
console.log(`Violazioni: ${cleanResult.violations.length}`);
console.log(`Confidenza: ${cleanResult.confidence}\n`);

// Test 2: Pattern sospetto (caratteri sostituiti)
console.log('Test 2 - Pattern sospetto (caratteri sostituiti):');
const suspiciousText = "Qu3st4 b1rr4 f4 sch1f0";
const suspiciousResult = ValidationService.checkInappropriateLanguage(suspiciousText, { strict: true });
console.log(`Risultato: ${suspiciousResult.isClean ? 'PULITO' : 'INAPPROPRIATO'}`);
console.log(`Violazioni: ${suspiciousResult.violations.length}`);
console.log(`Tipi violazioni: ${suspiciousResult.violations.map(v => v.type).join(', ')}`);
console.log(`Confidenza: ${suspiciousResult.confidence}\n`);

// Test 3: CAPS eccessivo
console.log('Test 3 - CAPS eccessivo:');
const capsText = "QUESTA BIRRA È TERRIBILE E FA SCHIFO";
const capsResult = ValidationService.checkInappropriateLanguage(capsText);
console.log(`Risultato: ${capsResult.isClean ? 'PULITO' : 'INAPPROPRIATO'}`);
console.log(`Violazioni: ${capsResult.violations.length}`);
console.log(`Analisi CAPS ratio: ${capsResult.analysis?.capsRatio}`);
console.log(`Confidenza: ${capsResult.confidence}\n`);

// Test 4: Caratteri ripetuti
console.log('Test 4 - Caratteri ripetuti eccessivi:');
const repeatedText = "Nooooooo questa birra è terrrrrribile";
const repeatedResult = ValidationService.checkInappropriateLanguage(repeatedText);
console.log(`Risultato: ${repeatedResult.isClean ? 'PULITO' : 'INAPPROPRIATO'}`);
console.log(`Violazioni: ${repeatedResult.violations.length}`);
console.log(`Confidenza: ${repeatedResult.confidence}\n`);

// Test 5: Controllo multipli campi (simulazione recensione)
console.log('Test 5 - Controllo multipli campi (recensione simulata):');
const reviewFields = {
  beerName: "Birra Ottima",
  notes: "Sapore eccellente, molto bilanciata",
  appearance: "Colore dorato, schiuma persistente",
  aroma: "Profumo intenso di luppolo e malto"
};
const multipleResult = ValidationService.checkMultipleFieldsForInappropriateContent(reviewFields);
console.log(`Risultato: ${multipleResult.isClean ? 'PULITO' : 'INAPPROPRIATO'}`);
console.log(`Campi totali: ${multipleResult.summary.totalFields}`);
console.log(`Campi con violazioni: ${multipleResult.summary.violatingFields}`);

// Test 6: Validazione recensioni complete
console.log('\nTest 6 - Validazione recensioni complete:');
const reviewData = {
  reviews: [
    {
      beerName: "IPA Eccellente",
      rating: 5,
      notes: "Ottima birra con sapore bilanciato",
      detailedRatings: {
        taste: {
          rating: 5,
          notes: "Sapore fantastico"
        }
      }
    }
  ]
};
const validationResult = ValidationService.validateReviewsInput(reviewData);
console.log(`Validazione: ${validationResult.isValid ? 'VALIDA' : 'NON VALIDA'}`);
if (!validationResult.isValid && validationResult.inappropriateContent) {
  console.log('Contenuto inappropriato rilevato');
  console.log(`Dettagli: ${JSON.stringify(validationResult.details, null, 2)}`);
}

console.log('\n=== TEST COMPLETATI ===');
