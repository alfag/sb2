#!/usr/bin/env node

/**
 * Script per generare le parole inappropriate cifrate
 * Eseguire dopo aver configurato la variabile CONTENT_MODERATION_KEY nel .bashrc
 */

const { encryptWordList } = require('../config/encryption');

// Lista delle parole da cifrare
const wordsToEncrypt = [
  // === PAROLE VOLGARI BASE ===
  'merda',
  'cazzo', 
  'schifo',
  'figa',
  'porco',
  'cazzata',
  'stronzo',
  'bastardo',
  'troia',
  'puttana',
  'fanculo',
  'madonna', // in contesto inappropriato
  'cristo', // in contesto inappropriato
  
  // === BESTEMMIE E IMPRECAZIONI RELIGIOSE ===
  'porcodio',
  'porcamadonna',
  'diocane',
  'dioporco',
  'santocane',
  'madonnacane',
  'cristore',
  'porcaputana',
  'diocristo',
  'madonnamia',
  'perdio',
  'diomerda',
  'cristiandio',
  'porcatroia',
  'sanguedemaria',
  
  // === IMPRECAZIONI E INSULTI ===
  'vaffanculo',
  'fottiti',
  'mannaggia',
  'merdaccia',
  'stronzata',
  'coglione',
  'sfigato',
  'merdata',
  'cazzate',
  'rompicazzo',
  'puttanata',
  'figlio', // contesto offensivo
  'faccia', // contesto offensivo
  'cretino',
  'idiota',
  
  // === ABBREVIAZIONI COMUNI ===
  'pdc', // porcodio
  'pdm', // porcamadonna
  'vffc', // vaffanculo
  'mdnt', // madonna
  'sticazzi'
];

function generateEncryptedWords() {
  console.log('=== GENERAZIONE PAROLE CIFRATE ===\n');
  
  try {
    const encryptedList = encryptWordList(wordsToEncrypt);
    
    console.log('// Parole inappropriate cifrate - generato automaticamente');
    console.log('const encryptedInappropriateWords = [');
    
    encryptedList.forEach((item, index) => {
      console.log(`  '${item.encrypted}', ${item.comment}`);
    });
    
    console.log('];');
    console.log('\n=== GENERAZIONE COMPLETATA ===');
    console.log(`Totale parole cifrate: ${encryptedList.length}`);
    
    // Test di decifratura per verificare
    console.log('\n=== TEST DECIFRATURA ===');
    const { decryptWordList } = require('../config/encryption');
    const decryptedWords = decryptWordList(encryptedList.map(item => item.encrypted));
    
    let allMatch = true;
    wordsToEncrypt.forEach((originalWord, index) => {
      const decryptedWord = decryptedWords[index];
      const match = originalWord === decryptedWord;
      console.log(`${originalWord} -> ${decryptedWord} [${match ? 'OK' : 'ERRORE'}]`);
      if (!match) allMatch = false;
    });
    
    console.log(`\nTest decifratura: ${allMatch ? 'SUCCESSO' : 'FALLITO'}`);
    
  } catch (error) {
    console.error('ERRORE durante la generazione:', error.message);
    console.error('\nAssicurati di aver configurato la variabile CONTENT_MODERATION_KEY nel .bashrc:');
    console.error('export CONTENT_MODERATION_KEY="tua_chiave_segreta_32_caratteri"');
    console.error('\nPoi riavvia il terminale o esegui: source ~/.bashrc');
    process.exit(1);
  }
}

// Esegui se chiamato direttamente
if (require.main === module) {
  generateEncryptedWords();
}

module.exports = { generateEncryptedWords, wordsToEncrypt };
