#!/usr/bin/env node

/**
 * Utility per gestire il sistema difunction showStats() {
  try {
    const { inappropriateContentHashes } = require('../../config/contentModeration');
    console.log(`\n=== STATISTICHE SISTEMA MODERAZIONE ===`);erazione contenuti
 * Permette di aggiungere, rimuovere e testare hash di parole inappropriate
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const configPath = path.join(__dirname, '../../config/contentModeration.js');

/**
 * Genera hash MD5 di una parola
 */
function generateHash(word) {
  return crypto.createHash('md5').update(word.toLowerCase().trim()).digest('hex');
}

/**
 * Aggiunge una nuova parola al file di configurazione
 */
function addWord(word, category = 'custom', comment = '') {
  const hash = generateHash(word);
  console.log(`\nParola: "${word}"`);
  console.log(`Hash MD5: ${hash}`);
  console.log(`Categoria: ${category}`);
  console.log(`Commento: ${comment}`);
  
  // Riga da aggiungere al file
  const lineToAdd = `  '${hash}', // ${word}${comment ? ' - ' + comment : ''}`;
  console.log(`\nRiga da aggiungere al file di configurazione:`);
  console.log(lineToAdd);
  
  return hash;
}

/**
 * Testa se una parola è già presente nel sistema
 */
function testWord(word) {
  try {
    const { inappropriateContentHashes } = require('../../config/contentModeration');
    const hash = generateHash(word);
    const isPresent = inappropriateContentHashes.has(hash);
    
    console.log(`\nTest parola: "${word}"`);
    console.log(`Hash: ${hash}`);
    console.log(`Presente nel sistema: ${isPresent ? '✓ SÌ' : '❌ NO'}`);
    
    return isPresent;
  } catch (error) {
    console.error('Errore nel test:', error.message);
    return false;
  }
}

/**
 * Mostra statistiche del sistema
 */
function showStats() {
  try {
    const { inappropriateContentHashes } = require('../../config/contentModeration');
    console.log(`\n=== STATISTICHE SISTEMA MODERAZIONE ===`);
    console.log(`Totale hash configurati: ${inappropriateContentHashes.size}`);
    console.log(`File di configurazione: ${configPath}`);
  } catch (error) {
    console.error('Errore nel caricamento statistiche:', error.message);
  }
}

/**
 * Test completo del sistema
 */
function runTests() {
  console.log('\n=== TEST SISTEMA MODERAZIONE ===');
  
  const testCases = [
    { word: 'birra', expected: false, type: 'pulito' },
    { word: 'fantastico', expected: false, type: 'pulito' },
    { word: 'merda', expected: true, type: 'volgare' },
    { word: 'porcodio', expected: true, type: 'bestemmia' },
    { word: 'vaffanculo', expected: true, type: 'imprecazione' },
    { word: 'pdc', expected: true, type: 'abbreviazione' }
  ];
  
  let passed = 0;
  let failed = 0;
  
  testCases.forEach(test => {
    const result = testWord(test.word);
    const success = result === test.expected;
    
    console.log(`${success ? '✓' : '❌'} ${test.word} (${test.type}): ${success ? 'PASS' : 'FAIL'}`);
    
    if (success) passed++;
    else failed++;
  });
  
  console.log(`\n=== RISULTATI TEST ===`);
  console.log(`Passati: ${passed}`);
  console.log(`Falliti: ${failed}`);
  console.log(`Totale: ${passed + failed}`);
}

// Gestione comando da linea di comando
function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  
  switch (command) {
    case 'add':
      const word = args[1];
      const category = args[2] || 'custom';
      const comment = args.slice(3).join(' ');
      
      if (!word) {
        console.log('Uso: node moderate.js add <parola> [categoria] [commento]');
        console.log('Esempio: node moderate.js add "stupido" insulti "insulto generico"');
        return;
      }
      
      addWord(word, category, comment);
      break;
      
    case 'test':
      const testWord_arg = args[1];
      
      if (!testWord_arg) {
        console.log('Uso: node moderate.js test <parola>');
        console.log('Esempio: node moderate.js test "merda"');
        return;
      }
      
      testWord(testWord_arg);
      break;
      
    case 'stats':
      showStats();
      break;
      
    case 'run-tests':
      runTests();
      break;
      
    default:
      console.log(`
=== UTILITY MODERAZIONE CONTENUTI ===

Comandi disponibili:
  add <parola> [categoria] [commento]  - Genera hash per nuova parola
  test <parola>                        - Testa se una parola è nel sistema
  stats                                - Mostra statistiche sistema
  run-tests                            - Esegue test completi

Esempi:
  node src/utils/moderate.js add "idiota" insulti
  node src/utils/moderate.js test "merda"
  node src/utils/moderate.js stats
  node src/utils/moderate.js run-tests
      `);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  generateHash,
  addWord,
  testWord,
  showStats,
  runTests
};
