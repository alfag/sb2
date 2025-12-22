/**
 * Helper per configurazione test sicura
 * Garantisce che i test NON tocchino mai il database di produzione
 */

const mongoose = require('mongoose');

// FORZA l'uso della configurazione di test
process.env.NODE_ENV = 'test';

// Carica configurazione di test
const testConfig = require('../config/test');

// Verifica CRITICA che stiamo usando un database di test
if (!testConfig.MONGODB_URL.includes('test') && !testConfig.IS_TEST) {
    console.error('🚨 ERRORE CRITICO: Test non configurati per database separato!');
    console.error('🚨 RISCHIO: Potrebbero modificare dati di produzione!');
    console.error('🚨 Database URL:', testConfig.MONGODB_URL);
    process.exit(1); // Forza l'uscita per sicurezza
}

// Doppia verifica per NODE_ENV
if (process.env.NODE_ENV !== 'test') {
    console.warn('⚠️ NODE_ENV non è "test", forzando...');
    process.env.NODE_ENV = 'test';
}

console.log('🧪 Test Helper: Configurazione di test caricata');
console.log('🗄️ Database di test:', testConfig.MONGODB_URL.replace(/\/\/.*@/, '//***@')); // Nasconde credenziali

/**
 * Setup database di test sicuro
 */
async function setupTestDatabase() {
    try {
        // Disconnetti connessioni esistenti se presenti
        if (mongoose.connection.readyState !== 0) {
            await mongoose.disconnect();
        }
        
        // Connetti al database di test
        await mongoose.connect(testConfig.MONGODB_URL, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        
        console.log('✅ Database di test connesso in modo sicuro');
        return true;
    } catch (error) {
        console.error('❌ Errore connessione database di test:', error.message);
        throw error;
    }
}

/**
 * Cleanup database di test
 */
async function cleanupTestDatabase() {
    try {
        if (mongoose.connection.readyState !== 0) {
            // Pulisci solo se siamo su database di test
            if (testConfig.IS_TEST) {
                const collections = await mongoose.connection.db.collections();
                
                for (let collection of collections) {
                    // SOLO per test: cancella tutti i dati delle collezioni
                    await collection.deleteMany({});
                }
                
                console.log('🧹 Database di test pulito');
            }
        }
    } catch (error) {
        console.warn('⚠️ Warning durante cleanup test:', error.message);
    }
}

/**
 * Chiudi connessione test
 */
async function closeTestDatabase() {
    try {
        if (mongoose.connection.readyState !== 0) {
            await mongoose.disconnect();
            console.log('🔌 Connessione database di test chiusa');
        }
    } catch (error) {
        console.warn('⚠️ Warning durante chiusura connessione test:', error.message);
    }
}

module.exports = {
    testConfig,
    setupTestDatabase,
    cleanupTestDatabase,
    closeTestDatabase
};