const CleanupService = require('../src/services/cleanupService');

// Test 1: Dati che richiedono disambiguazione appena creati - NON dovrebbero essere puliti
const session1 = {
  aiReviewData: {
    data: {
      tempData: true,
      processed: false,
      needsDisambiguation: true
    },
    timestamp: new Date().toISOString()
  }
};

const cleaned1 = CleanupService.cleanupUnresolvedSessionData(session1);
console.log('Test 1 - Dati disambiguazione appena creati:');
console.log('Pulito:', cleaned1);
console.log('Dati ancora presenti:', !!session1.aiReviewData);
console.log();

// Test 2: Dati che richiedono disambiguazione vecchi (35 minuti) - DOVREBBERO essere puliti
const session2 = {
  aiReviewData: {
    data: {
      tempData: true,
      processed: false,
      needsDisambiguation: true
    },
    timestamp: new Date(Date.now() - 35 * 60 * 1000).toISOString() // 35 minuti fa
  }
};

const cleaned2 = CleanupService.cleanupUnresolvedSessionData(session2);
console.log('Test 2 - Dati disambiguazione vecchi (35 min):');
console.log('Pulito:', cleaned2);
console.log('Dati ancora presenti:', !!session2.aiReviewData);
