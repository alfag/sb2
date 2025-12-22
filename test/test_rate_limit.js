const AIService = require('../src/services/aiService');

// Test per verificare i nuovi limiti di rate limiting
console.log('=== Test Rate Limiting ===\n');

// Simula una sessione
const mockSession = {
  id: 'test-session-123',
  aiRequestCount: 0
};

console.log('1. Test ambiente sviluppo (NODE_ENV=development):');
process.env.NODE_ENV = 'development';

const devTestGuest = AIService.canMakeRequest(mockSession, null);
console.log('   Guest in sviluppo:', {
  canMakeRequest: devTestGuest.canMakeRequest,
  maxRequests: devTestGuest.maxRequests,
  remainingRequests: devTestGuest.remainingRequests,
  developmentMode: devTestGuest.developmentMode
});

const devTestAuth = AIService.canMakeRequest(mockSession, 'user123');
console.log('   Utente autenticato in sviluppo:', {
  canMakeRequest: devTestAuth.canMakeRequest,
  maxRequests: devTestAuth.maxRequests,
  remainingRequests: devTestAuth.remainingRequests,
  developmentMode: devTestAuth.developmentMode
});

console.log('\n2. Test ambiente produzione (NODE_ENV=production):');
process.env.NODE_ENV = 'production';

const prodTestGuest = AIService.canMakeRequest(mockSession, null);
console.log('   Guest in produzione:', {
  canMakeRequest: prodTestGuest.canMakeRequest,
  maxRequests: prodTestGuest.maxRequests,
  remainingRequests: prodTestGuest.remainingRequests
});

const prodTestAuth = AIService.canMakeRequest(mockSession, 'user123');
console.log('   Utente autenticato in produzione:', {
  canMakeRequest: prodTestAuth.canMakeRequest,
  maxRequests: prodTestAuth.maxRequests,
  remainingRequests: prodTestAuth.remainingRequests
});

console.log('\n3. Test incremento contatore in produzione:');
// Simula 5 richieste guest
mockSession.aiRequestCount = 0;
for (let i = 1; i <= 12; i++) {
  AIService.incrementRequestCount(mockSession);
  const check = AIService.canMakeRequest(mockSession, null);
  if (i <= 10 || i === 11 || i === 12) {
    console.log(`   Richiesta ${i}: canMakeRequest=${check.canMakeRequest}, remaining=${check.remainingRequests}`);
  }
}

console.log('\n4. Test incremento contatore per utente autenticato:');
mockSession.aiRequestCount = 0;
for (let i = 1; i <= 32; i++) {
  AIService.incrementRequestCount(mockSession);
  const check = AIService.canMakeRequest(mockSession, 'user123');
  if (i <= 2 || i === 29 || i === 30 || i === 31 || i === 32) {
    console.log(`   Richiesta ${i}: canMakeRequest=${check.canMakeRequest}, remaining=${check.remainingRequests}`);
  }
}

// Ripristina environment originale
process.env.NODE_ENV = 'development';
console.log('\n=== Test completato ===');
