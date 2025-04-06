const User = require('../models/User');
const Brewery = require('../models/Brewery');
const AdminConfig = require('../models/AdminConfig');
const Order = require('../models/Order');
const Payment = require('../models/Payment');
const Invitation = require('../models/Invitation');
const logWithFileName = require('../utils/logger'); // Importa logWithFileName

const logger = logWithFileName(__filename); // Crea un logger con il nome del file

// Get all users
async function getAllUsers(req, res) {
    try {
        const users = await User.find();
        logger.info('Utenti recuperati con successo');
        res.status(200).json(users);
    } catch (error) {
        logger.error('Errore durante il recupero degli utenti', error);
        res.status(500).json({ message: 'Errore durante il recupero degli utenti', error });
    }
}

// Get a single user by ID
async function getUserById(req, res) {
    try {
        const user = await User.findById(req.params.id);
        if (!user) {
            logger.warn(`Utente non trovato: ${req.params.id}`);
            return res.status(404).json({ message: 'Utente non trovato' });
        }
        logger.info(`Utente recuperato con successo: ${req.params.id}`);
        res.status(200).json(user);
    } catch (error) {
        logger.error(`Errore durante il recupero dell'utente: ${req.params.id}`, error);
        res.status(500).json({ message: 'Errore durante il recupero dell\'utente', error });
    }
}

// Update user information
async function updateUser(req, res) {
    try {
        const user = await User.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!user) {
            logger.warn(`Utente non trovato: ${req.params.id}`);
            return res.status(404).json({ message: 'Utente non trovato' });
        }
        logger.info(`Utente aggiornato con successo: ${req.params.id}`);
        res.status(200).json(user);
    } catch (error) {
        logger.error(`Errore durante l'aggiornamento dell'utente: ${req.params.id}`, error);
        res.status(500).json({ message: 'Errore durante l\'aggiornamento dell\'utente', error });
    }
}

// Delete a user
async function deleteUser(req, res) {
    try {
        const user = await User.findByIdAndDelete(req.params.id);
        if (!user) {
            logger.warn(`Utente non trovato: ${req.params.id}`);
            return res.status(404).json({ message: 'Utente non trovato' });
        }
        logger.info(`Utente eliminato con successo: ${req.params.id}`);
        res.status(204).send();
    } catch (error) {
        logger.error(`Errore durante l'eliminazione dell'utente: ${req.params.id}`, error);
        res.status(500).json({ message: 'Errore durante l\'eliminazione dell\'utente', error });
    }
}

// Get all breweries
async function getAllBreweries(req, res) {
    try {
        const breweries = await Brewery.find();
        logger.info('Birrifici recuperati con successo');
        res.status(200).json(breweries);
    } catch (error) {
        logger.error('Errore durante il recupero dei birrifici', error);
        res.status(500).json({ message: 'Errore durante il recupero dei birrifici', error });
    }
}

// Get a single brewery by ID
async function getBreweryById(req, res) {
    try {
        const brewery = await Brewery.findById(req.params.id);
        if (!brewery) {
            logger.warn(`Birrificio non trovato: ${req.params.id}`);
            return res.status(404).json({ message: 'Birrificio non trovato' });
        }
        logger.info(`Birrificio recuperato con successo: ${req.params.id}`);
        res.status(200).json(brewery);
    } catch (error) {
        logger.error(`Errore durante il recupero del birrificio: ${req.params.id}`, error);
        res.status(500).json({ message: 'Errore durante il recupero del birrificio', error });
    }
}

// Update brewery information
async function updateBrewery(req, res) {
    try {
        const brewery = await Brewery.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!brewery) {
            logger.warn(`Birrificio non trovato: ${req.params.id}`);
            return res.status(404).json({ message: 'Birrificio non trovato' });
        }
        logger.info(`Birrificio aggiornato con successo: ${req.params.id}`);
        res.status(200).json(brewery);
    } catch (error) {
        logger.error(`Errore durante l'aggiornamento del birrificio: ${req.params.id}`, error);
        res.status(500).json({ message: 'Errore durante l\'aggiornamento del birrificio', error });
    }
}

// Delete a brewery
async function deleteBrewery(req, res) {
    try {
        const brewery = await Brewery.findByIdAndDelete(req.params.id);
        if (!brewery) {
            logger.warn(`Birrificio non trovato: ${req.params.id}`);
            return res.status(404).json({ message: 'Birrificio non trovato' });
        }
        logger.info(`Birrificio eliminato con successo: ${req.params.id}`);
        res.status(204).send();
    } catch (error) {
        logger.error(`Errore durante l'eliminazione del birrificio: ${req.params.id}`, error);
        res.status(500).json({ message: 'Errore durante l\'eliminazione del birrificio', error });
    }
}

// Get admin configurations
async function getAdminConfigurations(req, res) {
    try {
        const config = await AdminConfig.find();
        logger.info('Configurazioni amministrative recuperate con successo');
        res.status(200).json(config);
    } catch (error) {
        logger.error('Errore durante il recupero delle configurazioni amministrative', error);
        res.status(500).json({ message: 'Errore durante il recupero delle configurazioni amministrative', error });
    }
}

// Update admin configurations
async function updateAdminConfigurations(req, res) {
    try {
        const config = await AdminConfig.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!config) {
            logger.warn(`Configurazione non trovata: ${req.params.id}`);
            return res.status(404).json({ message: 'Configurazione non trovata' });
        }
        logger.info(`Configurazione amministrativa aggiornata con successo: ${req.params.id}`);
        res.status(200).json(config);
    } catch (error) {
        logger.error(`Errore durante l'aggiornamento della configurazione amministrativa: ${req.params.id}`, error);
        res.status(500).json({ message: 'Errore durante l\'aggiornamento della configurazione amministrativa', error });
    }
}

// Delete admin configurations
async function deleteAdminConfigurations(req, res) {
    try {
        const config = await AdminConfig.findByIdAndDelete(req.params.id);
        if (!config) {
            logger.warn(`Configurazione non trovata: ${req.params.id}`);
            return res.status(404).json({ message: 'Configurazione non trovata' });
        }
        logger.info(`Configurazione amministrativa eliminata con successo: ${req.params.id}`);
        res.status(204).send();
    } catch (error) {
        logger.error(`Errore durante l'eliminazione della configurazione amministrativa: ${req.params.id}`, error);
        res.status(500).json({ message: 'Errore durante l\'eliminazione della configurazione amministrativa', error });
    }
}

// Get all orders
async function getAllOrders(req, res) {
    try {
        const orders = await Order.find();
        logger.info('Ordini recuperati con successo');
        res.status(200).json(orders);
    } catch (error) {
        logger.error('Errore durante il recupero degli ordini', error);
        res.status(500).json({ message: 'Errore durante il recupero degli ordini', error });
    }
}

// Get a single order by ID
async function getOrderById(req, res) {
    try {
        const order = await Order.findById(req.params.id);
        if (!order) {
            logger.warn(`Ordine non trovato: ${req.params.id}`);
            return res.status(404).json({ message: 'Ordine non trovato' });
        }
        logger.info(`Ordine recuperato con successo: ${req.params.id}`);
        res.status(200).json(order);
    } catch (error) {
        logger.error(`Errore durante il recupero dell'ordine: ${req.params.id}`, error);
        res.status(500).json({ message: 'Errore durante il recupero dell\'ordine', error });
    }
}

// Update order
async function updateOrder(req, res) {
    try {
        const order = await Order.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!order) {
            logger.warn(`Ordine non trovato: ${req.params.id}`);
            return res.status(404).json({ message: 'Ordine non trovato' });
        }
        logger.info(`Ordine aggiornato con successo: ${req.params.id}`);
        res.status(200).json(order);
    } catch (error) {
        logger.error(`Errore durante l'aggiornamento dell'ordine: ${req.params.id}`, error);
        res.status(500).json({ message: 'Errore durante l\'aggiornamento dell\'ordine', error });
    }
}

// Delete order
async function deleteOrder(req, res) {
    try {
        const order = await Order.findByIdAndDelete(req.params.id);
        if (!order) {
            logger.warn(`Ordine non trovato: ${req.params.id}`);
            return res.status(404).json({ message: 'Ordine non trovato' });
        }
        logger.info(`Ordine eliminato con successo: ${req.params.id}`);
        res.status(204).send();
    } catch (error) {
        logger.error(`Errore durante l'eliminazione dell'ordine: ${req.params.id}`, error);
        res.status(500).json({ message: 'Errore durante l\'eliminazione dell\'ordine', error });
    }
}

// Get all payments
async function getAllPayments(req, res) {
    try {
        const payments = await Payment.find();
        logger.info('Pagamenti recuperati con successo');
        res.status(200).json(payments);
    } catch (error) {
        logger.error('Errore durante il recupero dei pagamenti', error);
        res.status(500).json({ message: 'Errore durante il recupero dei pagamenti', error });
    }
}

// Get a single payment by ID
async function getPaymentById(req, res) {
    try {
        const payment = await Payment.findById(req.params.id);
        if (!payment) {
            logger.warn(`Pagamento non trovato: ${req.params.id}`);
            return res.status(404).json({ message: 'Pagamento non trovato' });
        }
        logger.info(`Pagamento recuperato con successo: ${req.params.id}`);
        res.status(200).json(payment);
    } catch (error) {
        logger.error(`Errore durante il recupero del pagamento: ${req.params.id}`, error);
        res.status(500).json({ message: 'Errore durante il recupero del pagamento', error });
    }
}

// Update payment
async function updatePayment(req, res) {
    try {
        const payment = await Payment.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!payment) {
            logger.warn(`Pagamento non trovato: ${req.params.id}`);
            return res.status(404).json({ message: 'Pagamento non trovato' });
        }
        logger.info(`Pagamento aggiornato con successo: ${req.params.id}`);
        res.status(200).json(payment);
    } catch (error) {
        logger.error(`Errore durante l'aggiornamento del pagamento: ${req.params.id}`, error);
        res.status(500).json({ message: 'Errore durante l\'aggiornamento del pagamento', error });
    }
}

// Delete payment
async function deletePayment(req, res) {
    try {
        const payment = await Payment.findByIdAndDelete(req.params.id);
        if (!payment) {
            logger.warn(`Pagamento non trovato: ${req.params.id}`);
            return res.status(404).json({ message: 'Pagamento non trovato' });
        }
        logger.info(`Pagamento eliminato con successo: ${req.params.id}`);
        res.status(204).send();
    } catch (error) {
        logger.error(`Errore durante l'eliminazione del pagamento: ${req.params.id}`, error);
        res.status(500).json({ message: 'Errore durante l\'eliminazione del pagamento', error });
    }
}

// Get all invitations
async function getAllInvitations(req, res) {
    try {
        const invitations = await Invitation.find();
        logger.info('Inviti recuperati con successo');
        res.status(200).json(invitations);
    } catch (error) {
        logger.error('Errore durante il recupero degli inviti', error);
        res.status(500).json({ message: 'Errore durante il recupero degli inviti', error });
    }
}

// Get a single invitation by ID
async function getInvitationById(req, res) {
    try {
        const invitation = await Invitation.findById(req.params.id);
        if (!invitation) {
            logger.warn(`Invito non trovato: ${req.params.id}`);
            return res.status(404).json({ message: 'Invito non trovato' });
        }
        logger.info(`Invito recuperato con successo: ${req.params.id}`);
        res.status(200).json(invitation);
    } catch (error) {
        logger.error(`Errore durante il recupero dell'invito: ${req.params.id}`, error);
        res.status(500).json({ message: 'Errore durante il recupero dell\'invito', error });
    }
}

// Update invitation
async function updateInvitation(req, res) {
    try {
        const invitation = await Invitation.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!invitation) {
            logger.warn(`Invito non trovato: ${req.params.id}`);
            return res.status(404).json({ message: 'Invito non trovato' });
        }
        logger.info(`Invito aggiornato con successo: ${req.params.id}`);
        res.status(200).json(invitation);
    } catch (error) {
        logger.error(`Errore durante l'aggiornamento dell'invito: ${req.params.id}`, error);
        res.status(500).json({ message: 'Errore durante l\'aggiornamento dell\'invito', error });
    }
}

// Delete invitation
async function deleteInvitation(req, res) {
    try {
        const invitation = await Invitation.findByIdAndDelete(req.params.id);
        if (!invitation) {
            logger.warn(`Invito non trovato: ${req.params.id}`);
            return res.status(404).json({ message: 'Invito non trovato' });
        }
        logger.info(`Invito eliminato con successo: ${req.params.id}`);
        res.status(204).send();
    } catch (error) {
        logger.error(`Errore durante l'eliminazione dell'invito: ${req.params.id}`, error);
        res.status(500).json({ message: 'Errore durante l\'eliminazione dell\'invito', error });
    }
}

module.exports = {
    getAllUsers,
    getUserById,
    updateUser,
    deleteUser,
    getAllBreweries,
    getBreweryById,
    updateBrewery,
    deleteBrewery,
    getAdminConfigurations,
    updateAdminConfigurations,
    deleteAdminConfigurations,
    getAllOrders,
    getOrderById,
    updateOrder,
    deleteOrder,
    getAllPayments,
    getPaymentById,
    updatePayment,
    deletePayment,
    getAllInvitations,
    getInvitationById,
    updateInvitation,
    deleteInvitation,
};