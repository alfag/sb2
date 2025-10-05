/**
 * Configurazione specifica per ambiente di TEST
 * USA SEMPRE UN DATABASE SEPARATO PER I TEST
 */

module.exports = {
    PORT: process.env.PORT || 3001, // Porta diversa per test
    
    // DATABASE DI TEST SEPARATO - CRITICO!
    MONGODB_URL: process.env.MONGODB_TEST_URL || 
                 (process.env.MONGODB_URL_SB2 ? 
                  process.env.MONGODB_URL_SB2.replace('sb2_data', 'sb2_data_test') : 
                  'mongodb://localhost:27017/sb2_data_test'),
    
    // Altre configurazioni per test
    JWT_SECRET: process.env.JWT_SECRET || 'test_jwt_secret',
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY || 'test_stripe_key',
    EMAIL_SERVICE: 'test',
    EMAIL_USER: 'test@example.com',
    EMAIL_PASS: 'test_password',
    NODE_ENV: 'test',
    
    // API Keys per test (disabilitate o mock)
    GEMINI_API_KEY: 'TEST_GEMINI_KEY',
    GEMINI_ENDPOINT: 'https://api.gemini.com/v1/image',
    
    // Flag per identificare ambiente test
    IS_TEST: true
};