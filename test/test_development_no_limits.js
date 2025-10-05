/**
 * Test per verificare che in ambiente di sviluppo i rate limits siano disabilitati
 */

const http = require('http');

// Configurazione
const HOST = 'localhost';
const PORT = 8080;
const NUM_REQUESTS = 10; // Numero di richieste da fare rapidamente

console.log(`🚀 Test rate limiting disabilitato in sviluppo`);
console.log(`📍 Endpoint: http://${HOST}:${PORT}/`);
console.log(`🔥 Farò ${NUM_REQUESTS} richieste rapide consecutive`);
console.log(`⏱️  Se i rate limits sono disabilitati, dovrebbero passare tutte\n`);

let successCount = 0;
let errorCount = 0;
let rateLimitCount = 0;

function makeRequest(index) {
    return new Promise((resolve) => {
        const startTime = Date.now();
        
        const req = http.request({
            hostname: HOST,
            port: PORT,
            path: '/',
            method: 'GET',
            headers: {
                'User-Agent': `TestClient-${index}`
            }
        }, (res) => {
            const endTime = Date.now();
            const responseTime = endTime - startTime;
            
            let body = '';
            res.on('data', (chunk) => {
                body += chunk;
            });
            
            res.on('end', () => {
                if (res.statusCode === 200) {
                    successCount++;
                    console.log(`✅ Richiesta ${index}: SUCCESS (${res.statusCode}) - ${responseTime}ms`);
                } else if (res.statusCode === 429) {
                    rateLimitCount++;
                    console.log(`❌ Richiesta ${index}: RATE LIMITED (${res.statusCode}) - ${responseTime}ms`);
                } else {
                    errorCount++;
                    console.log(`⚠️  Richiesta ${index}: ERROR (${res.statusCode}) - ${responseTime}ms`);
                }
                resolve();
            });
        });
        
        req.on('error', (err) => {
            const endTime = Date.now();
            const responseTime = endTime - startTime;
            errorCount++;
            console.log(`💥 Richiesta ${index}: CONNECTION ERROR - ${responseTime}ms - ${err.message}`);
            resolve();
        });
        
        req.end();
    });
}

async function runTest() {
    console.log(`⏳ Inizio test alle ${new Date().toISOString()}\n`);
    
    // Faccio tutte le richieste in parallelo per massimizzare il rate
    const promises = [];
    for (let i = 1; i <= NUM_REQUESTS; i++) {
        promises.push(makeRequest(i));
        // Piccolo delay per evitare di sovraccaricare
        await new Promise(resolve => setTimeout(resolve, 10));
    }
    
    await Promise.all(promises);
    
    console.log(`\n📊 RISULTATI FINALI:`);
    console.log(`✅ Successi: ${successCount}/${NUM_REQUESTS}`);
    console.log(`❌ Rate Limited: ${rateLimitCount}/${NUM_REQUESTS}`);
    console.log(`⚠️  Altri errori: ${errorCount}/${NUM_REQUESTS}`);
    
    if (rateLimitCount === 0) {
        console.log(`\n🎉 PERFETTO! I rate limits sono disabilitati in sviluppo!`);
        console.log(`🛠️  Tutte le richieste sono passate senza limitazioni.`);
    } else {
        console.log(`\n⚠️  ATTENZIONE! Ci sono ancora ${rateLimitCount} richieste rate-limited.`);
        console.log(`🔧 Verifica che NODE_ENV sia 'development' e che il codice sia corretto.`);
    }
    
    console.log(`\n✨ Test completato alle ${new Date().toISOString()}`);
}

runTest().catch(console.error);
