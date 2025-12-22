/**
 * Test manuale del sistema di rate limiting UX
 * Questo script testa che il rate limiter non causi più loop di redirect
 */

const https = require('http');

async function testRateLimitFix() {
    console.log('🧪 Test Rate Limiting UX Fix');
    console.log('==============================\n');

    // Test 1: Pagina normale
    console.log('1️⃣ Test pagina normale...');
    try {
        const response = await makeRequest('GET', '/', {
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'User-Agent': 'Mozilla/5.0 (Test Browser)'
        });
        
        if (response.statusCode === 200 && response.data.includes('SharingBeer')) {
            console.log('✅ Pagina normale carica correttamente');
        } else {
            console.log('❌ Problema con pagina normale');
        }
    } catch (error) {
        console.log('❌ Errore nel test pagina normale:', error.message);
    }

    // Test 2: Pagina rate limit exceeded
    console.log('\n2️⃣ Test pagina rate-limit-exceeded...');
    try {
        const response = await makeRequest('GET', '/rate-limit-exceeded', {
            'Accept': 'text/html',
            'User-Agent': 'Mozilla/5.0 (Test Browser)'
        });
        
        if (response.statusCode === 200 && response.data.includes('Limite Richieste Superato')) {
            console.log('✅ Pagina rate-limit-exceeded funziona correttamente');
        } else {
            console.log('❌ Problema con pagina rate-limit-exceeded');
        }
    } catch (error) {
        console.log('❌ Errore nel test rate-limit-exceeded:', error.message);
    }

    // Test 3: API endpoint
    console.log('\n3️⃣ Test API endpoint...');
    try {
        const response = await makeRequest('GET', '/api/rate-limit-info', {
            'Accept': 'application/json',
            'User-Agent': 'API Test Client'
        });
        
        if (response.statusCode === 200) {
            const data = JSON.parse(response.data);
            if (data.limits) {
                console.log('✅ API endpoint funziona correttamente');
                console.log(`   Limiti generali: ${data.limits.general.max} richieste ogni ${data.limits.general.window}`);
            } else {
                console.log('❌ Risposta API malformata');
            }
        } else {
            console.log('❌ Problema con API endpoint');
        }
    } catch (error) {
        console.log('❌ Errore nel test API:', error.message);
    }

    console.log('\n🏁 Test completati!');
}

function makeRequest(method, path, headers = {}) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'localhost',
            port: 8080,
            path: path,
            method: method,
            headers: headers
        };

        const req = https.request(options, (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                resolve({
                    statusCode: res.statusCode,
                    headers: res.headers,
                    data: data
                });
            });
        });

        req.on('error', (error) => {
            reject(error);
        });

        req.setTimeout(5000, () => {
            req.destroy();
            reject(new Error('Request timeout'));
        });

        req.end();
    });
}

// Esegui i test
testRateLimitFix().catch(console.error);
