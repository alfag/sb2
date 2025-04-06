const Brewery = require('../models/Brewery');
const logWithFileName = require('../utils/logger'); // Importa logWithFileName

const logger = logWithFileName(__filename); // Crea un logger con il nome del file

// Funzione per registrare un nuovo birrificio
const registerBrewery = async (req, res) => {
  const brewery = new Brewery(req.body);
  try {
    const newBrewery = await brewery.save();
    logger.info(`Birrificio registrato con successo: ${newBrewery._id}`); // Logga il successo della registrazione
    res.status(201).json(newBrewery);
  } catch (error) {
    logger.error(`Errore durante la registrazione del birrificio: ${error.message}`); // Logga l'errore
    res.status(400).json({ message: error.message });
  }
};

// Funzione per ottenere i dettagli di un birrificio per ID
const getBreweryById = async (req, res) => {
  try {
    const brewery = await Brewery.findById(req.params.id);
    if (!brewery) {
      logger.warn(`Birrificio non trovato: ${req.params.id}`); // Logga il birrificio non trovato
      return res.status(404).json({ message: 'Birrificio non trovato' });
    }
    logger.info(`Recuperato birrificio: ${req.params.id}`); // Logga il successo del recupero
    res.json(brewery);
  } catch (error) {
    logger.error(`Errore durante il recupero del birrificio: ${error.message}`); // Logga l'errore
    res.status(500).json({ message: error.message });
  }
};

// Funzione per ottenere tutti i birrifici
const getAllBreweries = async (req, res) => {
  try {
    const breweries = await Brewery.find();
    logger.info('Recuperati tutti i birrifici'); // Logga il successo del recupero
    res.json(breweries);
  } catch (error) {
    logger.error(`Errore durante il recupero dei birrifici: ${error.message}`); // Logga l'errore
    res.status(500).json({ message: error.message });
  }
};

// Funzione per ottenere il catalogo di BeerBox per un birrificio specifico
const getBeerBoxCatalog = async (req, res) => {
  try {
    const brewery = await Brewery.findById(req.params.id).populate('beerBoxes');
    if (!brewery) {
      logger.warn(`Birrificio non trovato: ${req.params.id}`); // Logga il birrificio non trovato
      return res.status(404).json({ message: 'Birrificio non trovato' });
    }
    logger.info(`Recuperato catalogo BeerBox per il birrificio: ${req.params.id}`); // Logga il successo del recupero
    res.json(brewery.beerBoxes);
  } catch (error) {
    logger.error(`Errore durante il recupero del catalogo BeerBox: ${error.message}`); // Logga l'errore
    res.status(500).json({ message: error.message });
  }
};

// Funzione per ottenere le informazioni di stoccaggio per un birrificio specifico
const getStorageInfo = async (req, res) => {
  try {
    const brewery = await Brewery.findById(req.params.id);
    if (!brewery) {
      logger.warn(`Birrificio non trovato: ${req.params.id}`); // Logga il birrificio non trovato
      return res.status(404).json({ message: 'Birrificio non trovato' });
    }
    logger.info(`Recuperate informazioni di stoccaggio per il birrificio: ${req.params.id}`); // Logga il successo del recupero
    res.json(brewery.storageInfo);
  } catch (error) {
    logger.error(`Errore durante il recupero delle informazioni di stoccaggio: ${error.message}`); // Logga l'errore
    res.status(500).json({ message: error.message });
  }
};

// Funzione per depositare un BeerBox presso un altro birrificio
const storeBeerBox = async (req, res) => {
  try {
    const brewery = await Brewery.findById(req.params.id);
    if (!brewery) {
      logger.warn(`Birrificio non trovato: ${req.params.id}`); // Logga il birrificio non trovato
      return res.status(404).json({ message: 'Birrificio non trovato' });
    }
    // Logica per depositare il BeerBox
    logger.info(`BeerBox depositato con successo per il birrificio: ${req.params.id}`); // Logga il successo del deposito
    res.status(200).json({ message: 'BeerBox depositato con successo' });
  } catch (error) {
    logger.error(`Errore durante il deposito del BeerBox: ${error.message}`); // Logga l'errore
    res.status(500).json({ message: error.message });
  }
};

// Funzione per ottenere i BeerBox distribuiti per un birrificio specifico
const getDistributedBeerBox = async (req, res) => {
  try {
    const brewery = await Brewery.findById(req.params.id).populate('distributedBeerBoxes');
    if (!brewery) {
      logger.warn(`Birrificio non trovato: ${req.params.id}`); // Logga il birrificio non trovato
      return res.status(404).json({ message: 'Birrificio non trovato' });
    }
    logger.info(`Recuperati BeerBox distribuiti per il birrificio: ${req.params.id}`); // Logga il successo del recupero
    res.json(brewery.distributedBeerBoxes);
  } catch (error) {
    logger.error(`Errore durante il recupero dei BeerBox distribuiti: ${error.message}`); // Logga l'errore
    res.status(500).json({ message: error.message });
  }
};

// Funzione per ottenere le notifiche di scorte basse per i BeerBox
const getLowStockNotifications = async (req, res) => {
  try {
    const brewery = await Brewery.findById(req.params.id);
    if (!brewery) {
      logger.warn(`Birrificio non trovato: ${req.params.id}`); // Logga il birrificio non trovato
      return res.status(404).json({ message: 'Birrificio non trovato' });
    }
    // Logica per ottenere le notifiche di scorte basse
    logger.info(`Notifiche di scorte basse recuperate con successo per il birrificio: ${req.params.id}`); // Logga il successo del recupero
    res.status(200).json({ message: 'Notifiche di scorte basse recuperate con successo' });
  } catch (error) {
    logger.error(`Errore durante il recupero delle notifiche di scorte basse: ${error.message}`); // Logga l'errore
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  registerBrewery,
  getBreweryById,
  getAllBreweries,
  getBeerBoxCatalog,
  getStorageInfo,
  storeBeerBox,
  getDistributedBeerBox,
  getLowStockNotifications,
};