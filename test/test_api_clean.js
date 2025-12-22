const http = require('http');

const testDataClean = {
  reviews: [
    {
      beerName: "Birra Eccellente",
      rating: 5,
      notes: "Questa birra ha un sapore fantastico e una schiuma cremosa"
    }
  ]
};

const postData = JSON.stringify(testDataClean);

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

console.log('Testando API con contenuto pulito...');
console.log('Dati inviati:', JSON.stringify(testDataClean, null, 2));

const req = http.request(options, (res) => {
  console.log(`\nStatus Code: ${res.statusCode}`);
  
  let body = '';
  res.on('data', (chunk) => {
    body += chunk;
  });
  
  res.on('end', () => {
    console.log('\nResponse Body (primi 500 caratteri):');
    try {
      const jsonResponse = JSON.parse(body);
      console.log(JSON.stringify(jsonResponse, null, 2).substring(0, 500) + '...');
      
      if (res.statusCode === 201 && jsonResponse.success) {
        console.log('\n✅ SUCCESSO: Contenuto pulito accettato correttamente!');
      } else if (res.statusCode === 400 && jsonResponse.inappropriateContent) {
        console.log('\n❌ PROBLEMA: Contenuto pulito erroneamente bloccato!');
      } else {
        console.log(`\n⚠️  Risposta inaspettata: ${res.statusCode}`);
      }
    } catch (e) {
      console.log('Raw response (primi 200 caratteri):', body.substring(0, 200));
    }
  });
});

req.on('error', (e) => {
  console.error('Request error:', e.message);
});

req.write(postData);
req.end();
