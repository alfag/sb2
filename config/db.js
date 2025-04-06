const mongoose = require('mongoose');

const logWithFileName = require('../src/utils/logger'); // Importa la funzione logWithFileName
const logger = logWithFileName(__filename); // Crea un logger con il nome del file

mongoose.set('strictQuery', false);

mongoose.connect(process.env.MONGODB_URL_SB2, {
  //useFindAndModify: false,
  //useCreateIndex: true
});

mongoose.connection
  .on("open", () => logger.info('MONGODB OPEN'))
  .on("close", () => logger.info('MONGODB CLOSED'))
  .on("error", (error) => {
    logger.error('MONGODB CONNECTION: ' + error);
    process.exit();
  });

// Funzione per elencare tutte le collezioni
async function listCollections() {
  try {
    if (!mongoose.connection.db) {
      throw new Error('Connessione al database non ancora stabilita.');
    }
    const collections = await mongoose.connection.db.listCollections().toArray();
    logger.info('Collezioni nel database:');
    collections.forEach((collection) => logger.info(`- ${collection.name}`));
  } catch (error) {
    logger.error('Errore durante l\'elenco delle collezioni: ' + error.message);
  }
}

module.exports = mongoose;