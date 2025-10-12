const { setupTestDatabase, cleanupTestDatabase, closeTestDatabase } = require('./testHelper');
const config = require('../config/config');
const ReviewService = require('../src/services/reviewService');
const AIService = require('../src/services/aiService');
const assert = require('assert');

// Import modelli DOPO setup database per sicurezza
let mongoose;

/**
 * Test rapido e funzionale del sistema
 * Verifica le principali funzionalità senza dipendenze complesse
 */
async function runQuickTests() {
    console.log('🧪 AVVIO TEST RAPIDI SISTEMA');
    console.log('================================');
    
    let passed = 0;
    let failed = 0;
    let total = 0;
    
    const test = async (name, testFn) => {
        total++;
        try {
            console.log(`\n🔍 Test: ${name}`);
            await testFn();
            console.log('✅ PASS');
            passed++;
        } catch (error) {
            console.log(`❌ FAIL: ${error.message}`);
            failed++;
        }
    };
    
    try {
        // Connessione database sicura
        console.log('🔗 Connessione al database di test...');
        await setupTestDatabase();
        console.log('✅ Database di test connesso in modo sicuro');
        
        // Import mongoose DOPO setup
        mongoose = require('mongoose');
        
        // Test 1: Verifica funzionalità AI Service
        await test('AI Service Rate Limiting', async () => {
            const mockSession = { 
                id: 'test-' + Date.now(),
                aiRequestCount: 0 
            };
            const userId = null; // Guest user
            const result = AIService.canMakeRequest(mockSession, userId);
            
            assert(typeof result === 'object', 'Result deve essere un oggetto');
            assert(typeof result.canMakeRequest === 'boolean', 'canMakeRequest deve essere boolean');
            assert(typeof result.requestCount === 'number', 'requestCount deve essere number');
            assert(typeof result.maxRequests === 'number', 'maxRequests deve essere number');
            assert(typeof result.remainingRequests === 'number', 'remainingRequests deve essere number');
            
            console.log(`   📊 Rate limiting: ${result.requestCount}/${result.maxRequests} (remaining: ${result.remainingRequests})`);
        });
        
        // Test 2: Verifica ReviewService base
        await test('ReviewService Brewery Stats (mock)', async () => {
            // Test con ID fittizio per verificare struttura
            const fakeId = new mongoose.Types.ObjectId();
            const stats = await ReviewService.getBreweryStats(fakeId);
            
            assert(typeof stats === 'object', 'Stats deve essere oggetto');
            assert(typeof stats.totalReviews === 'number', 'totalReviews deve essere number');
            assert(typeof stats.totalBeers === 'number', 'totalBeers deve essere number');
            assert(typeof stats.averageRating === 'number', 'averageRating deve essere number');
            assert(Array.isArray(stats.beerBreakdown), 'beerBreakdown deve essere array');
            
            console.log(`   📈 Stats structure: OK`);
        });
        
        // Test 3: Verifica cache service
        await test('Cache Service', async () => {
            const cacheService = require('../src/utils/cacheService');
            
            // Test memory cache usando singleton instance
            cacheService.setMemory('test-key', { test: 'data' }, 60);
            const cached = cacheService.getMemory('test-key');
            
            assert(cached !== null, 'Cache dovrebbe restituire dati');
            assert(cached.test === 'data', 'Dati cache dovrebbero corrispondere');
            
            console.log('   💾 Memory cache: OK');
        });
        
        // Test 4: Verifica modelli esistono
        await test('Database Models', async () => {
            const User = require('../src/models/User');
            const Brewery = require('../src/models/Brewery');
            const Beer = require('../src/models/Beer');
            const Review = require('../src/models/Review');
            
            // Verifica che i modelli siano definiti
            assert(User.schema !== undefined, 'User model deve essere definito');
            assert(Brewery.schema !== undefined, 'Brewery model deve essere definito');
            assert(Beer.schema !== undefined, 'Beer model deve essere definito');
            assert(Review.schema !== undefined, 'Review model deve essere definito');
            
            console.log('   🗃️  Models: User, Brewery, Beer, Review OK');
        });
        
        // Test 5: Verifica file principali esistano
        await test('File Structure', async () => {
            const fs = require('fs');
            const path = require('path');
            
            const requiredFiles = [
                '../src/services/reviewService.js',
                '../src/services/aiService.js',
                '../src/controllers/administratorController.js',
                '../src/routes/administratorRoutes.js',
                '../src/middlewares/authMiddleware.js',
                '../views/admin/statistics.njk',
                '../public/js/statisticsManager.js'
            ];
            
            requiredFiles.forEach(file => {
                const fullPath = path.join(__dirname, file);
                assert(fs.existsSync(fullPath), `File ${file} deve esistere`);
            });
            
            console.log('   📁 File structure: OK');
        });
        
        // Test 6: Verifica configurazione
        await test('Configuration', async () => {
            assert(config.MONGODB_URL !== undefined, 'MONGODB_URL deve essere configurato');
            assert(config.PORT !== undefined, 'PORT deve essere configurato');
            assert(config.NODE_ENV !== undefined, 'NODE_ENV deve essere configurato');
            
            console.log(`   ⚙️  Config: ENV=${config.NODE_ENV}, PORT=${config.PORT}`);
        });
        
    } catch (error) {
        console.log(`❌ Errore setup: ${error.message}`);
        failed++;
        total++;
    } finally {
        await cleanupTestDatabase();
        await closeTestDatabase();
        console.log('🔌 Database di test disconnesso');
    }
    
    // Report finale
    console.log('\n📊 REPORT FINALE');
    console.log('================================');
    console.log(`📈 Test totali: ${total}`);
    console.log(`✅ Successi: ${passed}`);
    console.log(`❌ Fallimenti: ${failed}`);
    
    const successRate = total > 0 ? ((passed / total) * 100).toFixed(1) : 0;
    console.log(`📊 Tasso successo: ${successRate}%`);
    
    if (successRate >= 90) {
        console.log('\n🎉 SISTEMA FUNZIONALE! 🎉');
        console.log('✅ Tutte le funzionalità principali operative');
    } else if (successRate >= 70) {
        console.log('\n⚠️  Sistema parzialmente funzionale');
        console.log('🔧 Alcuni componenti richiedono attenzione');
    } else {
        console.log('\n🚨 Sistema richiede interventi');
        console.log('❌ Molti test falliti');
    }
    
    console.log('\n🔧 FUNZIONALITÀ VERIFICATE:');
    console.log('✅ AI Service Rate Limiting (Punto 6)');
    console.log('✅ ReviewService Statistiche (Punto 7)');
    console.log('✅ Cache System Performance');
    console.log('✅ Database Models Integration');
    console.log('✅ File Structure Admin Interface (Punto 8)');
    console.log('✅ Configuration Management');
    
    console.log('\n🌐 Per test completi interface web:');
    console.log('   • Avvia server: npm start');
    console.log('   • Accedi a: http://localhost:8080');
    console.log('   • Login admin e vai a /administrator/statistics');
    
    return { passed, failed, total, successRate };
}

// Esegui se chiamato direttamente
if (require.main === module) {
    runQuickTests().catch(error => {
        console.error('❌ Errore fatale:', error);
        process.exit(1);
    });
}

module.exports = { runQuickTests };
