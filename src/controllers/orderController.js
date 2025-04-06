const Order = require('../models/Order');
const BeerBox = require('../models/BeerBox');
const logWithFileName = require('../utils/logger'); // Importa logWithFileName

const logger = logWithFileName(__filename); // Crea un logger con il nome del file

// Funzione per creare un nuovo ordine
const createOrder = async (req, res) => {
  const order = new Order(req.body);
  try {
    const newOrder = await order.save();
    logger.info(`Ordine creato con successo: ${newOrder._id}`); // Logga il successo della creazione
    res.status(201).json(newOrder);
  } catch (error) {
    logger.error(`Errore durante la creazione dell'ordine: ${error.message}`); // Logga l'errore
    res.status(400).json({ message: error.message });
  }
};

// Funzione per ottenere i dettagli di un ordine tramite ID
const getOrderById = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) {
      logger.warn(`Ordine non trovato: ${req.params.id}`); // Logga l'ordine non trovato
      return res.status(404).json({ message: 'Ordine non trovato' });
    }
    logger.info(`Recuperato ordine: ${req.params.id}`); // Logga il successo del recupero
    res.json(order);
  } catch (error) {
    logger.error(`Errore durante il recupero dell'ordine: ${error.message}`); // Logga l'errore
    res.status(500).json({ message: error.message });
  }
};

// Funzione per ottenere tutti gli ordini per un utente
const getOrdersByUserId = async (req, res) => {
  try {
    const orders = await Order.find({ userId: req.params.userId });
    logger.info(`Recuperati ordini per l'utente: ${req.params.userId}`); // Logga il successo del recupero
    res.json(orders);
  } catch (error) {
    logger.error(`Errore durante il recupero degli ordini per l'utente: ${error.message}`); // Logga l'errore
    res.status(500).json({ message: error.message });
  }
};

// Funzione per aggiornare lo stato di un ordine
const updateOrderStatus = async (req, res) => {
  try {
    const order = await Order.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!order) {
      logger.warn(`Ordine non trovato: ${req.params.id}`); // Logga l'ordine non trovato
      return res.status(404).json({ message: 'Ordine non trovato' });
    }
    logger.info(`Stato dell'ordine aggiornato: ${req.params.id}`); // Logga il successo dell'aggiornamento
    res.json(order);
  } catch (error) {
    logger.error(`Errore durante l'aggiornamento dello stato dell'ordine: ${error.message}`); // Logga l'errore
    res.status(400).json({ message: error.message });
  }
};

// Funzione per eliminare un ordine
const deleteOrder = async (req, res) => {
  try {
    const order = await Order.findByIdAndDelete(req.params.id);
    if (!order) {
      logger.warn(`Ordine non trovato: ${req.params.id}`); // Logga l'ordine non trovato
      return res.status(404).json({ message: 'Ordine non trovato' });
    }
    logger.info(`Ordine eliminato: ${req.params.id}`); // Logga il successo dell'eliminazione
    res.json({ message: 'Ordine eliminato' });
  } catch (error) {
    logger.error(`Errore durante l'eliminazione dell'ordine: ${error.message}`); // Logga l'errore
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  createOrder,
  getOrderById,
  getOrdersByUserId,
  updateOrderStatus,
  deleteOrder,
};