const http = require('http');

const testData = {
  reviews: [
    {
      beerName: "Birra Test",
      rating: 1,
      notes: "diocane che birra schifosa, mannaggia la madonna"
    }
  ]
};

const postData = JSON.stringify(testData);

const options = {
  hostname: 'localhost',
  port: 8080,
  path: '/create-multiple',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData)
  }
};

console.log('Testando API con imprecazioni...');
console.log('Dati inviati:', JSON.stringify(testData, null, 2));

const req = http.request(options, (res) => {
  console.log(`\nStatus Code: ${res.statusCode}`);
  
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    try {
      const response = JSON.parse(data);
      console.log('\nResponse Body:');
      console.log(JSON.stringify(response, null, 2));
      
      if (res.statusCode === 400 && response.inappropriateContent) {
        console.log('\n✅ SUCCESSO: Imprecazioni bloccate correttamente!');
      } else {
        console.log('\n❌ PROBLEMA: Imprecazioni non bloccate!');
      }
    } catch (e) {
      console.log('\nResponse Body (primi 500 caratteri):');
      console.log(data.substring(0, 500) + (data.length > 500 ? '...' : ''));
    }
  });
});

req.on('error', (e) => {
  console.error(`Request error: ${e.message}`);
});

req.write(postData);
req.end();
