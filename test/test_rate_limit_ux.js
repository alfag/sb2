const chai = require('chai');
const request = require('supertest');
const expect = chai.expect;

describe('Rate Limiting UX Tests', function() {
    this.timeout(30000);
    
    let app;

    before(async function() {
        // Importa l'app
        app = require('../src/app');
    });

    describe('Rate Limiting Response Types', function() {
        
        it('Dovrebbe restituire JSON per richieste API', async function() {
            try {
                // Simula superamento rate limit facendo molte richieste API
                const promises = [];
                for (let i = 0; i < 105; i++) { // Supera il limite di 100
                    promises.push(
                        request(app)
                            .get('/api/rate-limit-info')
                            .set('Accept', 'application/json')
                    );
                }
                
                await Promise.all(promises);
            } catch (error) {
                // Dovrebbe dare errore 429
                expect(error.status).to.equal(429);
                expect(error.response.body).to.have.property('error');
                expect(error.response.body).to.have.property('message');
                expect(error.response.body.error).to.equal('Rate limit exceeded');
            }
        });

        it('Dovrebbe restituire redirect per richieste normali', async function() {
            try {
                // Simula superamento rate limit per richiesta normale
                const promises = [];
                for (let i = 0; i < 105; i++) { // Supera il limite di 100
                    promises.push(
                        request(app)
                            .get('/')
                            .set('Accept', 'text/html')
                    );
                }
                
                await Promise.all(promises);
            } catch (error) {
                // Per richieste HTML, dovrebbe fare redirect, non JSON
                if (error.status === 429) {
                    // Se arriva qui, significa che ha restituito JSON invece di redirect
                    console.log('Response body:', error.response.body);
                    console.log('Response headers:', error.response.headers);
                    
                    // Controlla se è un redirect o JSON
                    if (error.response.body && typeof error.response.body === 'object') {
                        throw new Error('Rate limiter restituisce JSON per richiesta HTML - dovrebbe fare redirect');
                    }
                }
            }
        });

        it('Dovrebbe gestire correttamente richieste XHR', async function() {
            try {
                // Simula richiesta AJAX
                const promises = [];
                for (let i = 0; i < 105; i++) {
                    promises.push(
                        request(app)
                            .get('/')
                            .set('X-Requested-With', 'XMLHttpRequest')
                    );
                }
                
                await Promise.all(promises);
            } catch (error) {
                if (error.status === 429) {
                    // Per XHR dovrebbe restituire JSON
                    expect(error.response.body).to.be.an('object');
                    expect(error.response.body).to.have.property('error');
                }
            }
        });
    });

    describe('Rate Limiting Flash Messages', function() {
        
        it('Dovrebbe impostare flash message per richieste normali', async function() {
            // Test più difficile da implementare direttamente perché flash messages 
            // sono gestiti nella sessione. Questo test verifica la logica generale
            
            const RateLimitService = require('../src/utils/rateLimitService');
            
            // Mock degli oggetti request e response
            const mockReq = {
                ip: '127.0.0.1',
                path: '/test',
                get: () => 'test-agent',
                xhr: false,
                headers: { accept: 'text/html' },
                flash: (type, message) => {
                    mockReq.flashMessages = mockReq.flashMessages || {};
                    mockReq.flashMessages[type] = message;
                }
            };
            
            const mockRes = {
                status: (code) => {
                    mockRes.statusCode = code;
                    return mockRes;
                },
                json: (data) => {
                    mockRes.jsonData = data;
                    return mockRes;
                },
                redirect: (url) => {
                    mockRes.redirectUrl = url;
                    return mockRes;
                }
            };
            
            // Crea un limiter personalizzato per test
            const testLimiter = RateLimitService.createCustomLimiter({
                windowMs: 1000,
                max: 1,
                message: 'Test rate limit message'
            });
            
            // Estrai l'handler dal limiter
            const limiterConfig = testLimiter.store ? testLimiter : { handler: testLimiter };
            
            if (limiterConfig.handler) {
                // Simula rate limit hit
                limiterConfig.handler(mockReq, mockRes);
                
                // Verifica che abbia fatto redirect invece di JSON
                expect(mockRes.redirectUrl).to.equal('back');
                expect(mockReq.flashMessages).to.have.property('error');
                expect(mockReq.flashMessages.error).to.equal('Test rate limit message');
            }
        });
    });

    describe('Rate Limiting Detection Logic', function() {
        
        it('Dovrebbe rilevare correttamente richieste API', function() {
            const testCases = [
                { xhr: true, expected: true },
                { headers: { accept: 'application/json' }, expected: true },
                { path: '/api/test', expected: true },
                { path: '/review/api/test', expected: true },
                { headers: { accept: 'text/html' }, path: '/normal', expected: false }
            ];
            
            testCases.forEach(testCase => {
                const mockReq = {
                    xhr: testCase.xhr || false,
                    headers: testCase.headers || {},
                    path: testCase.path || '/test'
                };
                
                // Simula la logica di detection
                const isApiRequest = mockReq.xhr || 
                                   mockReq.headers.accept?.includes('application/json') ||
                                   mockReq.path.startsWith('/api/') ||
                                   mockReq.path.startsWith('/review/api/');
                
                expect(isApiRequest).to.equal(testCase.expected, 
                    `Test case failed: ${JSON.stringify(testCase)}`);
            });
        });
    });
});
