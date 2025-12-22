#!/usr/bin/env node

/**
 * Script di test per il nuovo sistema di moderazione con cifratura
 */

const ValidationService = require('../src/utils/validationService');

function testModerationSystem() {
  console.log('=== TEST SISTEMA MODERAZIONE CON CIFRATURA ===\n');
  
  // Test cases per verificare l'efficacia della ricerca
  const testCases = [
    {
      name: 'Parola volgare separata',
      text: 'una merda di birra',
      shouldDetect: true
    },
    {
      name: 'Parola volgare attaccata',
      text: 'unamerdadibirra',
      shouldDetect: true
    },
    {
      name: 'Parola volgare con leet speak',
      text: 'una m3rda di birra',
      shouldDetect: true
    },
    {
      name: 'Parola volgare attaccata con leet',
      text: 'unam3rdadibirra',
      shouldDetect: true
    },
    {
      name: 'Bestemmia classica',
      text: 'porcodio che schifo',
      shouldDetect: true
    },
    {
      name: 'Bestemmia attaccata',
      text: 'porcodioche schifo',
      shouldDetect: true
    },
    {
      name: 'Testo pulito',
      text: 'ottima birra, molto buona',
      shouldDetect: false
    },
    {
      name: 'Falso positivo possibile',
      text: 'mercato delle birre artigianali',
      shouldDetect: false
    },
    {
      name: 'Abbreviazione volgare',
      text: 'pdc che schifezza',
      shouldDetect: true
    },
    {
      name: 'Parola nascosta con caratteri',
      text: 'ca##o di birra',
      shouldDetect: false // Dovrebbe essere rilevata dai pattern
    }
  ];
  
  let passed = 0;
  let total = testCases.length;
  
  console.log('Esecuzione test...\n');
  
  testCases.forEach((testCase, index) => {
    try {
      const result = ValidationService.checkInappropriateLanguage(testCase.text, {
        strict: true,
        context: 'test'
      });
      
      const detected = !result.isClean;
      const success = detected === testCase.shouldDetect;
      
      console.log(`Test ${index + 1}: ${testCase.name}`);
      console.log(`  Testo: "${testCase.text}"`);
      console.log(`  Atteso: ${testCase.shouldDetect ? 'RILEVATO' : 'PULITO'}`);
      console.log(`  Risultato: ${detected ? 'RILEVATO' : 'PULITO'}`);
      console.log(`  Status: ${success ? '✅ PASSATO' : '❌ FALLITO'}`);
      
      if (result.violations.length > 0) {
        console.log(`  Violazioni trovate:`);
        result.violations.forEach(violation => {
          console.log(`    - ${violation.type} (${violation.severity}): ${violation.description}`);
        });
      }
      
      if (result.sanitizedText !== testCase.text) {
        console.log(`  Testo sanificato: "${result.sanitizedText}"`);
      }
      
      console.log(`  Confidenza: ${(result.confidence * 100).toFixed(1)}%`);
      console.log();
      
      if (success) passed++;
      
    } catch (error) {
      console.log(`Test ${index + 1}: ${testCase.name}`);
      console.log(`  ❌ ERRORE: ${error.message}`);
      console.log();
    }
  });
  
  console.log('=== RISULTATI TEST ===');
  console.log(`Passati: ${passed}/${total} (${((passed/total) * 100).toFixed(1)}%)`);
  
  if (passed === total) {
    console.log('🎉 Tutti i test sono passati!');
  } else {
    console.log('⚠️ Alcuni test sono falliti. Verifica la configurazione.');
  }
  
  return passed === total;
}

function testEncryptionSetup() {
  console.log('\n=== TEST CONFIGURAZIONE CIFRATURA ===\n');
  
  try {
    const { getInappropriateWords } = require('../config/contentModeration');
    const words = getInappropriateWords();
    
    console.log(`Parole inappropriate caricate: ${words.length}`);
    
    if (words.length === 0) {
      console.log('❌ Nessuna parola caricata. Possibili problemi:');
      console.log('   1. Variabile CONTENT_MODERATION_KEY non configurata');
      console.log('   2. Chiave di cifratura errata');
      console.log('   3. Parole non ancora cifrate nel file di configurazione');
      return false;
    } else {
      console.log('✅ Parole caricate correttamente');
      console.log('Prime 3 parole (censurate):', words.slice(0, 3).map(w => w.charAt(0) + '*'.repeat(w.length-1)));
      return true;
    }
    
  } catch (error) {
    console.log(`❌ Errore durante il test: ${error.message}`);
    return false;
  }
}

// Esegui i test se chiamato direttamente
if (require.main === module) {
  const encryptionOk = testEncryptionSetup();
  
  if (encryptionOk) {
    testModerationSystem();
  } else {
    console.log('\n🔧 ISTRUZIONI SETUP:');
    console.log('1. Aggiungi al .bashrc: export CONTENT_MODERATION_KEY="tua_chiave_segreta_32_caratteri"');
    console.log('2. Riavvia il terminale o esegui: source ~/.bashrc');
    console.log('3. Esegui: node scripts/generateEncryptedWords.js');
    console.log('4. Sostituisci le parole cifrate nel file config/contentModeration.js');
    console.log('5. Riesegui questo test');
  }
}

module.exports = { testModerationSystem, testEncryptionSetup };
