/**
 * Configurazione per la moderazione dei contenuti
 * Contiene le parole inappropriate cifrate per il controllo del linguaggio
 * 
 * NOTA: Le parole sono cifrate usando AES-256-GCM per motivi di privacy
 * ma possono essere decifrate per controlli più accurati
 */

const { decryptWordList } = require('./encryption');

/**
 * Array di parole inappropriate cifrate
 * Le parole effettive sono cifrate e possono essere decifrate solo con la chiave corretta
 */
const encryptedInappropriateWords = [
  // === PAROLE VOLGARI BASE ===
  'eb6190c0be9dab87d9d1f565e7c8f7b0:b5b7815ffb', // merda
  '72348606c5f6551881417b4f85441c81:a37a268f76', // cazzo
  '7eba6dac03acc5da3d81e1c1a2ffd994:444bcefd71d2', // schifo
  '9bdea72103fc9b795789d564825b5dd6:650d542a', // figa
  'f5230f78936c58f5d8decb48de8825fd:db3a842507', // porco
  '9f10c536e59d38b599bef7915086c0ac:430e6b93de2d7a', // cazzata
  '5dba734053fb82f61967bd8e1bd86b6a:0086e75dc84b52', // stronzo
  '459c7bd1d9e26deb1bc69b8d6b19a546:3e56275c14a35907', // bastardo
  '27e7a620469cc108f35b30b13b6e480f:eb6846e012', // troia
  '11085b0f6d53cc71fdfff66a5e9b2835:f41c704155f759', // puttana
  '44ac0824f4ae92d0f52fda0ff65f52fe:f7fe20659f923a', // fanculo
  '33035d66766e5009bb75e0aa9774c6bf:751ce3fe912fbc', // madonna
  'a92c73a554c738ac69fc70370f2e1628:e7abc06ade34', // cristo

  // === BESTEMMIE E IMPRECAZIONI RELIGIOSE ===
  '75b785c59c21c957883e338936b17b2e:315ea584488d484d', // porcodio
  '465c12efaa3878e8706dbf9929f8987c:47c6d1c4e610cc3aacb66f9d', // porcamadonna
  '645ca8efba31c9ce666582b26000e8d0:32d7d3df4bea1e', // diocane
  '6c145899e7a5313dd57128ea48e8cfef:67aef8dd440f7eb3', // dioporco
  'a332d902f079b5d883d81a3e3bb817f5:a62d7d7157623a053d', // santocane
  'e203c2b93de62ec149f1445ea0ad93fa:4bdb27c1900b854312e0e8', // madonnacane
  '051aab0829543ab78b54b2919a12eb61:5b9236914edf0af9', // cristore
  'fd44eb8489a212261ad21f88c2266b70:f3b717f70191fffef278b8', // porcaputana
  '4858dae5078fb8843f8421566abf0166:62a9be05c583042dee', // diocristo
  '1c82f03344715183747ee87d84422fd5:fb3ec72e7805cfa716ff', // madonnamia
  'e22ad1d041076dfb0481eacdad5e68f7:24922ada95e2', // perdio
  'f2cf311d92e6babe8af605e0e4394aba:4fe23abc6e820956', // diomerda
  '4eb6230ec209f4f4d96b2466a16c4484:d47a4c1aa7b19e89dadfea', // cristiandio
  'fa7bc0ba3f95a185e1df16e55de8bfc7:36a252e9b9202e1e221b', // porcatroia
  '707cc7e81aa75fe0106cdc91fb1d0837:7464230d10e0bb6c8979414cec', // sanguedemaria
  
  // === IMPRECAZIONI E INSULTI ===
  'f1efac2f2fdcd09e9613c424d723a3cf:6d5608603d36c6ae787d', // vaffanculo
  'b1b37e3a4d659996ae7f36c2b42d0a4b:5914918f5af770', // fottiti
  'b88ab75884877a38ac3129f0cd0d4293:dd082d334dda4c6fa9', // mannaggia
  '805fb9e22cf16b596be4daac14eef62a:0d47192ba7d82c9948', // merdaccia
  '0d5aab62b2361316ba96069bf823b6ef:25d79e59475c2cabe8', // stronzata
  'cbbc917b36e5cbc704e279493d634873:8859279ddeaead78', // coglione
  'b42c9fded9d65e8c4cde10c058c70c48:8d14f8fbd778d7', // sfigato
  'a7ec233242f93436ca035165e30991e4:7f759ab6e36130', // merdata
  '7c70876476bb7e50d1a010c7b602a7af:d9ac8bdcecf29a', // cazzate
  'd3a8bf727683d18df4df29ffa29fea4b:9f94d937941461c1d67d', // rompicazzo
  '553a431027edf0df7ce5b67e94d9ece4:c710407bc0a405d099', // puttanata
  '2685b441615b8254a44f0164085d219b:500ad8ed1ac4', // figlio
  'f7d794957267b7ea450dea4c86c74f8f:bed617227454', // faccia
  '49ef7e50c90cec88c1dee2ffda7f5619:61beb7d405a07d', // cretino
  'b10f35575e6a5d0d1149fb4354e3e7ae:6b93d142f4e7', // idiota
  'bd3a999d8bc6261d499035b22221820b:beddc0775488ab', // zoccola
  'd6c4ef5a6463604efc04b1f5a4125533:34ec210f', // suca
  
  // === ABBREVIAZIONI COMUNI ===
  '6010df66ed903fffa212d35d266c2616:2a7b8b', // pdc
  '225da3239ea2d02dc7ab904b3a20bf92:d5c612', // pdm
  '9ebea330d60df6c677768d606df862f4:9934b3b2', // vffc
  '708d3ad9b0eefeb94cb316b9eb732533:3003e4fd', // mdnt
  'c28d71745b8afbac84fbc240e1f2f7d9:eadf3fb7f4618cec', // sticazzi
];

/**
 * Cache per le parole decifrate (per evitare decifrature ripetute)
 */
let decryptedWordsCache = null;

/**
 * Ottiene la lista delle parole inappropriate decifrate
 * @returns {Array} - Array di parole decifrate
 */
function getInappropriateWords() {
  if (!decryptedWordsCache) {
    try {
      decryptedWordsCache = decryptWordList(encryptedInappropriateWords);
    } catch (error) {
      console.error('Errore decifrando le parole inappropriate:', error.message);
      console.error('Assicurati che la variabile CONTENT_MODERATION_KEY sia configurata correttamente nel .bashrc');
      decryptedWordsCache = []; // Fallback a lista vuota
    }
  }
  return decryptedWordsCache;
}

/**
 * Resetta la cache delle parole decifrate (utile per test o aggiornamenti)
 */
function resetWordsCache() {
  decryptedWordsCache = null;
}

/**
 * Configurazione per i pattern di rilevamento
 */
const moderationPatterns = {
  // Pattern per rilevare sostituzioni di caratteri
  character_substitution: /[4@]|[3e]|[1i!]|[0o]|[5s\$]|[7t]/gi,
  
  // Pattern per rilevare ripetizioni eccessive
  excessive_repetition: /(.)\1{3,}/gi,
  
  // Pattern per rilevare interruzioni di parole
  word_breaking: /[a-z]\s*[^\w\s]\s*[a-z]/gi,
  
  // Pattern per clustering consonanti (tipico di bestemmie)
  consonant_clustering: /[bcdfghjklmnpqrstvwxyz]{4,}/gi,
  
  // Pattern per alternanza maiuscole/minuscole sospetta
  case_alternation: /[a-z][A-Z][a-z][A-Z]|[A-Z][a-z][A-Z][a-z]/g
};

/**
 * Configurazione livelli di severità
 */
const severityLevels = {
  LOW: 'low',
  MEDIUM: 'medium', 
  HIGH: 'high'
};

/**
 * Configurazione contesti di moderazione
 */
const moderationContexts = {
  REVIEW: 'review',
  GENERAL: 'general',
  USER_CONTENT: 'user_content'
};

/**
 * Utility per aggiungere nuove parole cifrate
 * @param {string} word - La parola da cifrare e aggiungere
 * @param {string} comment - Commento descrittivo (opzionale)
 */
function addInappropriateWord(word, comment = '') {
  const { encryptWord } = require('./encryption');
  try {
    const encrypted = encryptWord(word);
    encryptedInappropriateWords.push(encrypted);
    console.log(`Parola cifrata aggiunta: '${encrypted}', // ${word} ${comment}`);
    resetWordsCache(); // Resetta la cache per includere la nuova parola
    return encrypted;
  } catch (error) {
    console.error(`Errore cifrando "${word}":`, error.message);
    throw error;
  }
}

module.exports = {
  encryptedInappropriateWords,
  getInappropriateWords,
  resetWordsCache,
  moderationPatterns,
  severityLevels,
  moderationContexts,
  addInappropriateWord
};
