const Payment = require('../models/Payment');
const Order = require('../models/Order');
const logWithFileName = require('../utils/logger'); // Importa logWithFileName

const logger = logWithFileName(__filename); // Crea un logger con il nome del file

// Funzione per elaborare un pagamento
const processPayment = async (req, res) => {
    const { orderId, amount, paymentMethod } = req.body;

    try {
        // Trova l'ordine
        const order = await Order.findById(orderId);
        if (!order) {
            logger.warn(`Ordine non trovato: ${orderId}`); // Logga l'ordine non trovato
            return res.status(404).json({ message: 'Ordine non trovato' });
        }

        // Crea un nuovo pagamento
        const payment = new Payment({
            orderId: order._id,
            amount,
            paymentMethod,
            status: 'in sospeso',
        });

        // Salva il pagamento
        await payment.save();

        // Aggiorna lo stato dell'ordine
        order.status = 'pagato';
        await order.save();

        logger.info(`Pagamento elaborato con successo: ${payment._id}`); // Logga il successo del pagamento
        res.status(201).json({ message: 'Pagamento elaborato con successo', payment });
    } catch (error) {
        logger.error(`Errore durante l'elaborazione del pagamento: ${error.message}`); // Logga l'errore
        res.status(500).json({ message: 'Errore durante l\'elaborazione del pagamento', error });
    }
};

// Funzione per ottenere lo stato di un pagamento
const getPaymentStatus = async (req, res) => {
    const { paymentId } = req.params;

    try {
        const payment = await Payment.findById(paymentId);
        if (!payment) {
            logger.warn(`Pagamento non trovato: ${paymentId}`); // Logga il pagamento non trovato
            return res.status(404).json({ message: 'Pagamento non trovato' });
        }

        logger.info(`Stato del pagamento recuperato: ${paymentId}`); // Logga il successo del recupero
        res.status(200).json({ payment });
    } catch (error) {
        logger.error(`Errore durante il recupero dello stato del pagamento: ${error.message}`); // Logga l'errore
        res.status(500).json({ message: 'Errore durante il recupero dello stato del pagamento', error });
    }
};

// Funzione per creare un nuovo pagamento
const createPayment = async (req, res) => {
    const payment = new Payment(req.body);
    try {
        const newPayment = await payment.save();
        logger.info(`Pagamento creato con successo: ${newPayment._id}`); // Logga il successo della creazione
        res.status(201).json(newPayment);
    } catch (error) {
        logger.error(`Errore durante la creazione del pagamento: ${error.message}`); // Logga l'errore
        res.status(400).json({ message: error.message });
    }
};

// Funzione per ottenere i dettagli di un pagamento tramite ID
const getPaymentDetails = async (req, res) => {
    try {
        const payment = await Payment.findById(req.params.id);
        if (!payment) {
            logger.warn(`Pagamento non trovato: ${req.params.id}`); // Logga il pagamento non trovato
            return res.status(404).json({ message: 'Pagamento non trovato' });
        }
        logger.info(`Dettagli del pagamento recuperati: ${req.params.id}`); // Logga il successo del recupero
        res.json(payment);
    } catch (error) {
        logger.error(`Errore durante il recupero dei dettagli del pagamento: ${error.message}`); // Logga l'errore
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    processPayment,
    getPaymentStatus,
    createPayment,
    getPaymentDetails,
};