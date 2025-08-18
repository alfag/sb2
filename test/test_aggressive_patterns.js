const ValidationService = require('../src/utils/validationService');

console.log('=== TEST SISTEMA MODERAZIONE - PATTERN AGGRESSIVI ===\n');

// Test con pattern più aggressivi per verificare detection
const testCases = [
  {
    name: "Testo normale",
    text: "Questa birra ha un sapore eccellente",
    expected: "PULITO"
  },
  {
    name: "Molti caratteri speciali",
    text: "Birra @#$%@#$%@#$% terribile!!!!!!",
    expected: "SOSPETTO"
  },
  {
    name: "Clustering consonanti",
    text: "Questa rbbr è strng",
    expected: "SOSPETTO"
  },
  {
    name: "Entropy alta (text casuale)",
    text: "xkjf4h3k2j4hf9k2j3h4fk2j3h4fk",
    expected: "SOSPETTO"
  },
  {
    name: "Combinazione pattern",
    text: "CH3 SCH1F0!!!!!! @#$%",
    expected: "SOSPETTO"
  },
  {
    name: "CAPS eccessivo",
    text: "QUESTA BIRRA SCHIFAAAAAA",
    expected: "SOSPETTO"
  }
];

testCases.forEach((testCase, index) => {
  console.log(`Test ${index + 1} - ${testCase.name}:`);
  console.log(`Testo: "${testCase.text}"`);
  
  const result = ValidationService.checkInappropriateLanguage(testCase.text, { strict: true });
  const actualResult = result.isClean ? "PULITO" : "INAPPROPRIATO";
  
  console.log(`Risultato: ${actualResult}`);
  console.log(`Violazioni: ${result.violations.length}`);
  if (result.violations.length > 0) {
    console.log(`Tipi: ${result.violations.map(v => `${v.type}(${v.severity})`).join(', ')}`);
  }
  console.log(`Confidenza: ${result.confidence.toFixed(3)}`);
  console.log(`Match atteso: ${testCase.expected}, Match ottenuto: ${actualResult}`);
  
  // Analisi dettagliata
  if (result.analysis) {
    console.log(`Analisi - CAPS: ${(result.analysis.capsRatio * 100).toFixed(1)}%, Speciali: ${(result.analysis.specialCharsRatio * 100).toFixed(1)}%, Entropia: ${result.analysis.entropy.toFixed(2)}`);
  }
  
  console.log('---');
});

// Test validazione recensione con contenuto problematico
console.log('\nTest validazione recensione con contenuto problematico:');
const problematicReview = {
  reviews: [
    {
      beerName: "Birra N0rm4l3",
      rating: 1,
      notes: "QUESTA BIRRA È UNA @#$%@#$% DI BIRRA!!!!!!!",
      detailedRatings: {
        taste: {
          rating: 1,
          notes: "S4p0r3 t3rr1b1l3!!!!"
        },
        aroma: {
          rating: 1,
          notes: "xkjf4h3k2j4hf9k2j3h4fk puzzle text"
        }
      }
    }
  ]
};

const validationResult = ValidationService.validateReviewsInput(problematicReview);
console.log(`Validazione: ${validationResult.isValid ? 'VALIDA' : 'NON VALIDA'}`);
if (!validationResult.isValid) {
  if (validationResult.inappropriateContent) {
    console.log('✓ Contenuto inappropriato rilevato correttamente');
    console.log(`Numero violazioni: ${validationResult.details?.length || 0}`);
  } else {
    console.log('Errore di validazione generico:', validationResult.message);
  }
}

console.log('\n=== TEST COMPLETATI ===');
