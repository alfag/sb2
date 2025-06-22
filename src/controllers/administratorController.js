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
            logger.info('Creazione di un nuovo cliente'); // Log in italiano
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
            logger.info('Creazione di un nuovo amministratore'); // Log in italiano
            const newAdministrator = new Administrator({
                administratorName: administratorName,
                administratorPermission: administratorPermission
            });
            await newAdministrator.save();
            newUser.administratorDetails = newAdministrator._id;
        } else if (role === 'brewery') {
            logger.info('Creazione di una nuovo birrificio'); // Log in italiano
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
        // Modifica: ora reindirizza alla pagina precedente invece che a una rotta fissa
        const redirectUrl = req.headers.referer || '/';
        res.redirect(redirectUrl);
    }
}

// Get all users
async function getAllUsers(req, res, next) {
    try {
        const users = await User.find();
        logger.info(`Utenti recuperati con successo: ${users.length} utenti trovati compreso l'utente collegato`); // Log con il numero di utenti
        return users; // Restituisci gli utenti
    } catch (error) {
        logger.error('Errore durante il recupero degli utenti', error);
        throw error; // Propaga l'errore al middleware di gestione degli errori
    }
}

// Get a single user by ID (arricchito con populate dettagli in base al ruolo)
async function getUserById(userId) {
    logger.info(`Recupero utente con ID: ${userId}`);
    try {
        // Recupera l'utente e popola i dettagli in base al ruolo
        let user = await User.findById(userId)
            .populate('administratorDetails')
            .populate('breweryDetails');

        if (!user) {
            logger.warn(`Utente non trovato: ${userId}`);
            return null;
        }

        // Converti una sola volta se necessario
        const userObj = user.toObject ? user.toObject() : user;

        if (userObj.role === 'customer' && userObj.customerDetails) {
            userObj.customerName = userObj.customerDetails.customerName;
            userObj.customerSurname = userObj.customerDetails.customerSurname;
            userObj.customerFiscalCode = userObj.customerDetails.customerFiscalCode;
            userObj.customerBillingAddress = userObj.customerDetails.customerAddresses?.billingAddress;
            userObj.customerShippingAddress = userObj.customerDetails.customerAddresses?.shippingAddress;
            userObj.customerPhoneNumber = userObj.customerDetails.customerPhoneNumber;
        }
        if (userObj.role === 'administrator' && userObj.administratorDetails) {
            userObj.administratorName = userObj.administratorDetails.administratorName;
            userObj.administratorPermission = userObj.administratorDetails.administratorPermission;
        }
        if (userObj.role === 'brewery' && userObj.breweryDetails) {
            userObj.breweryName = userObj.breweryDetails.breweryName;
            userObj.breweryDescription = userObj.breweryDetails.breweryDescription;
            userObj.breweryFiscalCode = userObj.breweryDetails.breweryFiscalCode;
        }

        logger.info(`Utente recuperato con successo: ${userId}`);
        return userObj;
    } catch (error) {
        logger.error(`Errore durante il recupero dell'utente: ${userId}`, error);
        throw error;
    }
}

// Update user information (coerente con administratorRoutes)
async function updateUser(userId, updateData) {
    try {
        const user = await User.findByIdAndUpdate(userId, updateData, { new: true });
        if (!user) {
            logger.warn(`Utente non trovato: ${userId}`);
            return null;
        }
        logger.info(`Utente aggiornato con successo: ${userId}`);
        return user;
    } catch (error) {
        logger.error(`Errore durante l'aggiornamento dell'utente: ${userId}`, error);
        throw error;
    }
}

// Delete a user (coerente con administratorRoutes)
async function deleteUser(userId) {
    try {
        const user = await User.findByIdAndDelete(userId);
        if (!user) {
            logger.warn(`Utente non trovato: ${userId}`);
            return null;
        }
        logger.info(`Utente eliminato con successo: ${userId}`);
        return user;
    } catch (error) {
        logger.error(`Errore durante l'eliminazione dell'utente: ${userId}`, error);
        throw error;
    }
}

// Brewery management
async function getBreweryById(breweryId) {
    logger.info(`Recupero brewery con ID: ${breweryId}`);
    try {
        const brewery = await Brewery.findById(breweryId);
        if (!brewery) {
            logger.warn(`Brewery non trovato: ${breweryId}`);
            return null;
        }
        logger.info(`Brewery recuperato con successo: ${breweryId}`);
        return brewery;
    } catch (error) {
        logger.error(`Errore durante il recupero del brewery: ${breweryId}`, error);
        throw error;
    }
}

async function updateBrewery(breweryId, updateData) {
    try {
        const brewery = await Brewery.findByIdAndUpdate(breweryId, updateData, { new: true });
        if (!brewery) {
            logger.warn(`Brewery non trovato: ${breweryId}`);
            return null;
        }
        logger.info(`Brewery aggiornato con successo: ${breweryId}`);
        return brewery;
    } catch (error) {
        logger.error(`Errore durante l'aggiornamento del brewery: ${breweryId}`, error);
        throw error;
    }
}

async function deleteBrewery(breweryId) {
    try {
        const brewery = await Brewery.findByIdAndDelete(breweryId);
        if (!brewery) {
            logger.warn(`Brewery non trovato: ${breweryId}`);
            return null;
        }
        logger.info(`Brewery eliminato con successo: ${breweryId}`);
        return brewery;
    } catch (error) {
        logger.error(`Errore durante l'eliminazione del brewery: ${breweryId}`, error);
        throw error;
    }
}

// Administrator management
async function getAdministratorById(administratorId) {
    logger.info(`Recupero administrator con ID: ${administratorId}`);
    try {
        const administrator = await Administrator.findById(administratorId);
        if (!administrator) {
            logger.warn(`Administrator non trovato: ${administratorId}`);
            return null;
        }
        logger.info(`Administrator recuperato con successo: ${administratorId}`);
        return administrator;
    } catch (error) {
        logger.error(`Errore durante il recupero dell'administrator: ${administratorId}`, error);
        throw error;
    }
}

async function updateAdministrator(administratorId, updateData) {
    try {
        const administrator = await Administrator.findByIdAndUpdate(administratorId, updateData, { new: true });
        if (!administrator) {
            logger.warn(`Administrator non trovato: ${administratorId}`);
            return null;
        }
        logger.info(`Administrator aggiornato con successo: ${administratorId}`);
        return administrator;
    } catch (error) {
        logger.error(`Errore durante l'aggiornamento dell'administrator: ${administratorId}`, error);
        throw error;
    }
}

async function deleteAdministrator(administratorId) {
    try {
        const administrator = await Administrator.findByIdAndDelete(administratorId);
        if (!administrator) {
            logger.warn(`Administrator non trovato: ${administratorId}`);
            return null;
        }
        logger.info(`Administrator eliminato con successo: ${administratorId}`);
        return administrator;
    } catch (error) {
        logger.error(`Errore durante l'eliminazione dell'administrator: ${administratorId}`, error);
        throw error;
    }
}

module.exports = {
    getAllUsers,
    getUserById,
    updateUser,
    deleteUser,
    createUser,
    getBreweryById,
    updateBrewery,
    deleteBrewery,
    getAdministratorById,
    updateAdministrator,
    deleteAdministrator,
};