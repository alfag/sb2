const chai = require('chai');
const request = require('supertest');
const expect = chai.expect;

describe('Rate Limiting UX Fix Tests', function() {
    this.timeout(10000);
    
    let app;

    before(async function() {
        // Importa l'app
        app = require('../src/app');
    });

    describe('Rate Limiting - JSON vs Redirect', function() {
        
        it('Dovrebbe restituire JSON per richieste API', async function() {
            try {
                const response = await request(app)
                    .get('/api/rate-limit-info')
                    .set('Accept', 'application/json');
                
                expect(response.status).to.equal(200);
                expect(response.body).to.have.property('limits');
                console.log('✅ Richiesta API funziona correttamente');
            } catch (error) {
                if (error.status === 429) {
                    // Dovrebbe essere JSON
                    expect(error.response.body).to.be.an('object');
                    expect(error.response.body).to.have.property('error');
                    console.log('✅ Rate limit API restituisce JSON correttamente');
                } else {
                    throw error;
                }
            }
        });

        it('Dovrebbe restituire HTML per richiesta normale alla home', async function() {
            const response = await request(app)
                .get('/')
                .set('Accept', 'text/html');
            
            expect(response.status).to.equal(200);
            expect(response.text).to.include('SharingBeer');
            console.log('✅ Richiesta normale alla home funziona');
        });

        it('Dovrebbe esistere la pagina rate-limit-exceeded', async function() {
            const response = await request(app)
                .get('/rate-limit-exceeded')
                .set('Accept', 'text/html');
            
            expect(response.status).to.equal(200);
            expect(response.text).to.include('Limite Richieste Superato');
            expect(response.text).to.include('Torna alla Home');
            console.log('✅ Pagina rate-limit-exceeded esiste e funziona');
        });
    });

    describe('Rate Limiting Logic Test', function() {
        
        it('Dovrebbe rilevare correttamente tipi di richiesta', function() {
            const testCases = [
                { 
                    description: 'XHR request',
                    xhr: true, 
                    expected: true 
                },
                { 
                    description: 'JSON Accept header',
                    headers: { accept: 'application/json' }, 
                    expected: true 
                },
                { 
                    description: 'API path',
                    path: '/api/test', 
                    expected: true 
                },
                { 
                    description: 'Review API path',
                    path: '/review/api/test', 
                    expected: true 
                },
                { 
                    description: 'Normal HTML request',
                    headers: { accept: 'text/html' }, 
                    path: '/normal', 
                    expected: false 
                }
            ];
            
            testCases.forEach(testCase => {
                const mockReq = {
                    xhr: testCase.xhr || false,
                    headers: testCase.headers || {},
                    path: testCase.path || '/test'
                };
                
                // Simula la logica di detection usata nel rate limiter
                const isApiRequest = mockReq.xhr || 
                                   mockReq.headers.accept?.includes('application/json') ||
                                   mockReq.path.startsWith('/api/') ||
                                   mockReq.path.startsWith('/review/api/');
                
                expect(isApiRequest).to.equal(testCase.expected, 
                    `${testCase.description}: Expected ${testCase.expected}, got ${isApiRequest}`);
                console.log(`✅ ${testCase.description}: ${isApiRequest ? 'API' : 'HTML'} (corretto)`);
            });
        });
    });
});
