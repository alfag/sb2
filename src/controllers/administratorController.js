const User = require('../models/User');
const Administrator = require('../models/Administrator');
const Brewery = require('../models/Brewery');
const logWithFileName = require('../utils/logger'); // Importa logWithFileName
const bcrypt = require('bcrypt');

const logger = logWithFileName(__filename); // Crea un logger con il nome del file

// Crea un nuovo utente
async function createUser({ 
    username, password, role, 
    customerName, customerSurname, customerFiscalCode, customerBillingAddress, customerShippingAddress, customerPhoneNumber,
    administratorName, administratorPermission,
    breweryName, breweryDescription, breweryFiscalCode 
}, req, res) {
    try {
        logger.info('Inizio creazione di un nuovo utente'); // Log in italiano

        const hashedPassword = await bcrypt.hash(password, 10);

        let newUser = new User({
            username: username,
            password: hashedPassword,
            role: role,
            // Inizializza gli altri campi a null o a valori di default appropriati
        });

        if (role === 'customer') {
            newUser.customerDetails = {
                customerName: customerName,
                customerSurname: customerSurname,
                customerFiscalCode: customerFiscalCode,
                customerAddresses: {
                    billingAddress: customerBillingAddress,
                    shippingAddress: customerShippingAddress
                },
                customerPhoneNumber: customerPhoneNumber
            };
        } else if (role === 'administrator') {
            const newAdministrator = new Administrator({
                administratorName: administratorName,
                administratorPermission: administratorPermission
            });
            await newAdministrator.save();
            newUser.administratorDetails = newAdministrator._id;
        } else if (role === 'brewery') {
            const newBrewery = new Brewery({
                breweryName: breweryName,
                breweryDescription: breweryDescription,
                breweryFiscalCode: breweryFiscalCode
            });
            await newBrewery.save();
            newUser.breweryDetails = newBrewery._id;
        }

        await newUser.save();

        logger.info(`Utente creato con successo: ${newUser._id}`); // Log con ID utente
        req.flash('success', 'Utente creato con successo');
        res.redirect('/');

    } catch (error) {
        logger.error(`Errore durante la creazione dell'utente: ${error.message}`); // Log errore
        req.flash('error', `Errore durante la creazione dell'utente: ${error.message}`);
        res.redirect('/login');
    }
}

// Get all users
async function getAllUsers(req, res, next) {
    try {
        if (!res || typeof res.render !== 'function') {
            throw new TypeError('L\'oggetto res non è definito o non è valido');
        }

        const users = await User.find({ role: 'user' }); // Filtra solo gli utenti con ruolo 'user'
        logger.info(`Utenti recuperati con successo: ${users.length} utenti trovati`); // Log con il numero di utenti
        return users; // Restituisci gli utenti
    } catch (error) {
        logger.error('Errore durante il recupero degli utenti', error);
        throw error; // Propaga l'errore al middleware di gestione degli errori
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

    } catch (error) {
        logger.error(`Errore durante il recupero dell'utente: ${req.params.id}`, error);        
        throw error; // Propaga l'errore al middleware di gestione degli errori
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
        
    } catch (error) {
        logger.error(`Errore durante l'aggiornamento dell'utente: ${req.params.id}`, error);
        throw error; // Propaga l'errore al middleware di gestione degli errori
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
        
    } catch (error) {
        logger.error(`Errore durante l'eliminazione dell'utente: ${req.params.id}`, error);
        throw error; // Propaga l'errore al middleware di gestione degli errori
    }
}

module.exports = {
    getAllUsers,
    getUserById,
    updateUser,
    deleteUser,
    createUser,
};