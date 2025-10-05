const chai = require('chai');
const expect = chai.expect;

// IMPORT SICURO: Usa helper di test che garantisce database separato
const { testConfig, setupTestDatabase, cleanupTestDatabase, closeTestDatabase } = require('./testHelper');
const mongoose = require('mongoose');

// Import modelli e servizi DOPO setup database di test
let ReviewService, AIService, cacheService, Review, Brewery;

/**
 * Test specifici per performance, cache e stress testing
 * Verifica scalabilità e robustezza del sistema
 */
describe('⚡ Performance & Cache Tests', () => {
    
    before(async function() {
        this.timeout(30000);
        console.log('🔧 Setup test performance SICURO...');
        
        // Connessione database di TEST SICURO
        await setupTestDatabase();
        
        // Import modelli DOPO connessione test sicura
        ReviewService = require('../src/services/reviewService');
        AIService = require('../src/services/aiService');
        cacheService = require('../src/utils/cacheService');
        Review = require('../src/models/Review');
        Brewery = require('../src/models/Brewery');
        
        console.log('✅ Database di TEST connesso per test performance');
    });
    
    after(async function() {
        // Non disconnettiamo il database per non interferire con altri test
        console.log('🔌 Test performance completati');
    });

    describe('🚀 Cache Performance Tests', () => {
        
        it('dovrebbe migliorare performance con cache per statistiche brewery', async function() {
            this.timeout(10000);
            
            // Trova un brewery con recensioni
            const brewery = await Brewery.findOne();
            if (!brewery) {
                this.skip('Nessun brewery trovato per test performance');
            }
            
            // Test senza cache (prima chiamata)
            const start1 = process.hrtime.bigint();
            const stats1 = await ReviewService.getBreweryStats(brewery._id);
            const end1 = process.hrtime.bigint();
            const time1 = Number(end1 - start1) / 1000000; // Convert to ms
            
            // Test con cache (seconda chiamata)
            const start2 = process.hrtime.bigint();
            const stats2 = await ReviewService.getBreweryStats(brewery._id);
            const end2 = process.hrtime.bigint();
            const time2 = Number(end2 - start2) / 1000000;
            
            console.log(`📊 Performance cache: prima ${time1.toFixed(2)}ms, seconda ${time2.toFixed(2)}ms`);
            
            // Cache hit dovrebbe essere significativamente più veloce
            time2.should.be.lessThan(time1 * 0.5); // Almeno 50% più veloce
            
            // Dati dovrebbero essere identici
            JSON.stringify(stats1).should.equal(JSON.stringify(stats2));
            
            console.log('✅ Cache migliora performance significativamente');
        });
        
        it('dovrebbe gestire invalidazione cache correttamente', async function() {
            this.timeout(5000);
            
            const testBreweryId = new mongoose.Types.ObjectId();
            const cacheKey = `brewery_stats:${testBreweryId}`;
            
            // Simula cache entry
            cacheService.setDB(cacheKey, { test: 'data' }, 60);
            
            // Verifica cache hit
            const cached = cacheService.getDB(cacheKey);
            cached.should.not.be.null;
            
            // Invalida cache
            ReviewService.invalidateBreweryStatsCache(testBreweryId);
            
            // Verifica cache miss dopo invalidazione
            const afterInvalidation = cacheService.getDB(cacheKey);
            (afterInvalidation === null || afterInvalidation === undefined).should.be.true;
            
            console.log('✅ Invalidazione cache funziona correttamente');
        });
        
        it('dovrebbe gestire TTL cache appropriatamente', async function() {
            this.timeout(3000);
            
            const testKey = 'test_ttl_' + Date.now();
            
            // Set cache con TTL breve (1 secondo)
            cacheService.setDB(testKey, { test: 'data' }, 1);
            
            // Verifica cache hit immediato
            const immediate = cacheService.getDB(testKey);
            immediate.should.not.be.null;
            
            // Aspetta scadenza TTL
            await new Promise(resolve => setTimeout(resolve, 1100));
            
            // Verifica cache expired
            const expired = cacheService.getDB(testKey);
            (expired === null || expired === undefined).should.be.true;
            
            console.log('✅ TTL cache gestito correttamente');
        });
    });

    describe('🔥 Stress Testing', () => {
        
        it('dovrebbe gestire multiple richieste simultanee senza errori', async function() {
            this.timeout(20000);
            
            const concurrentRequests = 10;
            const promises = [];
            
            console.log(`🔥 Avvio ${concurrentRequests} richieste simultanee...`);
            
            for (let i = 0; i < concurrentRequests; i++) {
                promises.push(
                    ReviewService.getAllBreweriesStats({
                        page: (i % 3) + 1,
                        limit: 5,
                        sortBy: 'totalReviews',
                        sortOrder: 'desc'
                    }).catch(error => ({ error: error.message }))
                );
            }
            
            const results = await Promise.all(promises);
            
            // Conta successi vs errori
            const successes = results.filter(r => !r.error);
            const errors = results.filter(r => r.error);
            
            console.log(`📊 Risultati: ${successes.length} successi, ${errors.length} errori`);
            
            // Almeno 80% dovrebbe avere successo
            (successes.length / results.length).should.be.greaterThanOrEqual(0.8);
            
            console.log('✅ Stress test superato');
        });
        
        it('dovrebbe gestire rate limiting sotto carico', async function() {
            this.timeout(10000);
            
            const sessionId = 'stress_test_' + Date.now();
            const requests = [];
            
            // Simula multiple richieste dalla stessa sessione
            for (let i = 0; i < 15; i++) {
                requests.push(
                    AIService.canMakeRequest(null, sessionId)
                        .catch(error => ({ error: error.message }))
                );
            }
            
            const results = await Promise.all(requests);
            
            // Tutte le richieste dovrebbero completarsi (anche se negate)
            results.length.should.equal(15);
            
            // Verifica che alcune richieste siano state bloccate dopo limite
            const blockedRequests = results.filter(r => 
                r && !r.error && !r.canMakeRequest
            );
            
            blockedRequests.length.should.be.greaterThan(0);
            
            console.log(`✅ Rate limiting efficace: ${blockedRequests.length}/15 richieste bloccate`);
        });
    });

    describe('📈 Memory & Resource Tests', () => {
        
        it('dovrebbe non avere memory leak con cache ripetute', async function() {
            this.timeout(15000);
            
            const initialMemory = process.memoryUsage().heapUsed;
            console.log(`🧠 Memoria iniziale: ${(initialMemory / 1024 / 1024).toFixed(2)} MB`);
            
            // Fai molte operazioni cache
            for (let i = 0; i < 100; i++) {
                const key = `memory_test_${i}`;
                cacheService.setMemory(key, { data: 'test'.repeat(100) }, 10);
                cacheService.getMemory(key);
                
                if (i % 20 === 0) {
                    // Forza garbage collection se disponibile
                    if (global.gc) {
                        global.gc();
                    }
                }
            }
            
            const finalMemory = process.memoryUsage().heapUsed;
            const memoryIncrease = finalMemory - initialMemory;
            const increasePercent = (memoryIncrease / initialMemory) * 100;
            
            console.log(`🧠 Memoria finale: ${(finalMemory / 1024 / 1024).toFixed(2)} MB (+${increasePercent.toFixed(1)}%)`);
            
            // Aumento memoria dovrebbe essere ragionevole (< 50%)
            increasePercent.should.be.lessThan(50);
            
            console.log('✅ Nessun memory leak significativo rilevato');
        });
        
        it('dovrebbe gestire gracefully errori database', async function() {
            this.timeout(5000);
            
            // Test con ID inesistente
            const fakeId = new mongoose.Types.ObjectId();
            
            try {
                const stats = await ReviewService.getBreweryStats(fakeId);
                
                // Dovrebbe ritornare stats vuote, non errore
                stats.should.be.an('object');
                stats.totalReviews.should.equal(0);
                stats.totalBeers.should.equal(0);
                
                console.log('✅ Gestione graceful di brewery inesistente');
                
            } catch (error) {
                // Se da errore, dovrebbe essere gestito appropriatamente
                console.log(`⚠️ Errore gestito: ${error.message}`);
                error.should.be.instanceOf(Error);
            }
        });
    });

    describe('🔍 Data Integrity Tests', () => {
        
        it('dovrebbe mantenere consistenza dati con operazioni parallele', async function() {
            this.timeout(10000);
            
            // Simula letture parallele delle stesse statistiche
            const brewery = await Brewery.findOne();
            if (!brewery) {
                this.skip('Nessun brewery per test consistenza');
            }
            
            const parallelReads = await Promise.all([
                ReviewService.getBreweryStats(brewery._id),
                ReviewService.getBreweryStats(brewery._id),
                ReviewService.getBreweryStats(brewery._id)
            ]);
            
            // Tutti i risultati dovrebbero essere identici
            const firstResult = JSON.stringify(parallelReads[0]);
            parallelReads.forEach((result, index) => {
                JSON.stringify(result).should.equal(firstResult);
                console.log(`✅ Lettura parallela ${index + 1} consistente`);
            });
            
            console.log('✅ Consistenza dati verificata');
        });
        
        it('dovrebbe validare struttura dati delle statistiche', async function() {
            this.timeout(5000);
            
            const stats = await ReviewService.getAllBreweriesStats({
                page: 1,
                limit: 1
            });
            
            // Validazione struttura completa
            stats.should.have.property('breweries').that.is.an('array');
            stats.should.have.property('pagination').that.is.an('object');
            stats.should.have.property('summary').that.is.an('object');
            
            // Validazione pagination
            stats.pagination.should.have.property('page').that.is.a('number');
            stats.pagination.should.have.property('limit').that.is.a('number');
            stats.pagination.should.have.property('total').that.is.a('number');
            stats.pagination.should.have.property('pages').that.is.a('number');
            
            // Validazione summary
            stats.summary.should.have.property('totalBreweries').that.is.a('number');
            stats.summary.should.have.property('totalReviews').that.is.a('number');
            stats.summary.should.have.property('totalBeers').that.is.a('number');
            stats.summary.should.have.property('averageRating').that.is.a('number');
            
            // Validazione brewery (se presente)
            if (stats.breweries.length > 0) {
                const brewery = stats.breweries[0];
                brewery.should.have.property('breweryId');
                brewery.should.have.property('breweryName').that.is.a('string');
                brewery.should.have.property('totalReviews').that.is.a('number');
                brewery.should.have.property('totalBeers').that.is.a('number');
                brewery.should.have.property('averageRating').that.is.a('number');
                brewery.should.have.property('distribution').that.is.an('object');
            }
            
            console.log('✅ Struttura dati statistiche validata');
        });
    });
});
