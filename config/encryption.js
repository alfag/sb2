/**
 * Configurazione per la cifratura delle parole inappropriate
 * Utilizza AES-256-GCM per cifratura reversibile sicura
 */

const crypto = require('crypto');

/**
 * Ottiene la chiave di cifratura dalla variabile d'ambiente
 * @returns {string} - La chiave di cifratura
 */
function getEncryptionKey() {
  const key = process.env.CONTENT_MODERATION_KEY;
  if (!key) {
    throw new Error('CONTENT_MODERATION_KEY non trovata nelle variabili d\'ambiente. Aggiungila al .bashrc: export CONTENT_MODERATION_KEY="tua_chiave_segreta_32_caratteri"');
  }
  if (key.length !== 32) {
    throw new Error('CONTENT_MODERATION_KEY deve essere esattamente di 32 caratteri');
  }
  return key;
}

/**
 * Cifra una parola usando AES-256-CTR (versione moderna non deprecata)
 * @param {string} text - Il testo da cifrare
 * @returns {string} - Il testo cifrato (hex)
 */
function encryptWord(text) {
  try {
    const key = crypto.scryptSync(getEncryptionKey(), 'salt', 32);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-ctr', key, iv);
    
    let encrypted = cipher.update(text.toLowerCase(), 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    // Combina IV + encrypted
    return iv.toString('hex') + ':' + encrypted;
  } catch (error) {
    console.error('Errore durante la cifratura:', error.message);
    throw error;
  }
}

/**
 * Decifra una parola usando AES-256-CTR (versione moderna non deprecata)
 * @param {string} encryptedText - Il testo cifrato
 * @returns {string} - Il testo in chiaro
 */
function decryptWord(encryptedText) {
  try {
    const key = crypto.scryptSync(getEncryptionKey(), 'salt', 32);
    const parts = encryptedText.split(':');
    
    if (parts.length !== 2) {
      throw new Error('Formato testo cifrato non valido');
    }
    
    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];
    
    const decipher = crypto.createDecipheriv('aes-256-ctr', key, iv);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    console.error('Errore durante la decifratura:', error.message);
    throw error;
  }
}

/**
 * Genera una lista di parole cifrate da un array di parole
 * @param {Array} words - Array di parole da cifrare
 * @returns {Array} - Array di parole cifrate
 */
function encryptWordList(words) {
  return words.map(word => {
    try {
      const encrypted = encryptWord(word);
      return {
        encrypted: encrypted,
        original: word, // Solo per debug, rimuovere in produzione
        comment: `// ${word}`
      };
    } catch (error) {
      console.error(`Errore cifrando "${word}":`, error.message);
      return null;
    }
  }).filter(Boolean);
}

/**
 * Decifra una lista di parole cifrate
 * @param {Array} encryptedWords - Array di parole cifrate
 * @returns {Array} - Array di parole decifrate
 */
function decryptWordList(encryptedWords) {
  return encryptedWords.map(encryptedWord => {
    try {
      return decryptWord(encryptedWord);
    } catch (error) {
      console.error(`Errore decifrando "${encryptedWord}":`, error.message);
      return null;
    }
  }).filter(Boolean);
}

/**
 * Utility per testare la cifratura
 */
function testEncryption() {
  console.log('Test cifratura/decifratura...');
  
  const testWords = ['merda', 'cazzo', 'porcodio'];
  
  testWords.forEach(word => {
    try {
      const encrypted = encryptWord(word);
      const decrypted = decryptWord(encrypted);
      
      console.log(`Parola originale: ${word}`);
      console.log(`Cifrata: ${encrypted}`);
      console.log(`Decifrata: ${decrypted}`);
      console.log(`Test ${word === decrypted ? 'PASSATO' : 'FALLITO'}`);
      console.log('---');
    } catch (error) {
      console.error(`Test fallito per "${word}":`, error.message);
    }
  });
}

module.exports = {
  getEncryptionKey,
  encryptWord,
  decryptWord,
  encryptWordList,
  decryptWordList,
  testEncryption
};
