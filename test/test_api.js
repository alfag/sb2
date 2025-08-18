const http = require('http');

const testData = {
  reviews: [
    {
      beerName: "Birra Test",
      rating: 1,
      notes: "Questa birra fa schifo, è una merda totale"
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

console.log('Testando API con contenuto volgare...');
console.log('Dati inviati:', JSON.stringify(testData, null, 2));

const req = http.request(options, (res) => {
  console.log(`\nStatus Code: ${res.statusCode}`);
  console.log('Headers:', res.headers);
  
  let body = '';
  res.on('data', (chunk) => {
    body += chunk;
  });
  
  res.on('end', () => {
    console.log('\nResponse Body:');
    try {
      const jsonResponse = JSON.parse(body);
      console.log(JSON.stringify(jsonResponse, null, 2));
      
      if (res.statusCode === 400 && jsonResponse.inappropriateContent) {
        console.log('\n✅ SUCCESSO: Contenuto inappropriato bloccato correttamente!');
      } else if (res.statusCode === 201) {
        console.log('\n❌ PROBLEMA: Contenuto volgare accettato!');
      } else {
        console.log(`\n⚠️  Risposta inaspettata: ${res.statusCode}`);
      }
    } catch (e) {
      console.log('Raw response:', body);
    }
  });
});

req.on('error', (e) => {
  console.error('Request error:', e.message);
});

req.write(postData);
req.end();
