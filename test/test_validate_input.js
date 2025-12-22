const ValidationService = require('../src/utils/validationService');

const data = {
  reviews: [
    {
      beerName: 'Birra Eccellente',
      rating: 5,
      notes: 'Questa birra ha un sapore fantastico e una schiuma cremosa'
    }
  ]
};

console.log('=== TEST validateReviewsInput ===\n');

const result = ValidationService.validateReviewsInput(data);

console.log('Risultato validateReviewsInput:');
console.log(JSON.stringify(result, null, 2));
