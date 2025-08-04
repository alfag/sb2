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
            role: [role], // sempre array
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

// Get a single user by ID (popola dettagli in base al ruolo, struttura annidata)
async function getUserById(userId) {
    logger.info(`Recupero utente con ID: ${userId}`);
    try {
        // Recupera l'utente e popola i dettagli
        let user = await User.findById(userId)
            .populate('customerDetails')
            .populate('administratorDetails')
            .populate('breweryDetails');

        if (!user) {
            logger.warn(`Utente non trovato: ${userId}`);
            return null;
        }
        // Nessun appiattimento: restituisco la struttura annidata
        return user.toObject ? user.toObject() : user;
    } catch (error) {
        logger.error(`Errore durante il recupero dell'utente: ${userId}`, error);
        throw error;
    }
}

// Update user information (coerente con administratorRoutes)
async function updateUser(userId, updateData) {
    try {
        if (updateData.password) {
            // Hash della nuova password se presente
            updateData.password = await bcrypt.hash(updateData.password, 10);
        }
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

// Delete a user (coerente with administratorRoutes)
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

// Aggiungi un ruolo a un utente e popola i dettagli
async function addRoleToUser(userId, roleToAdd, req, res) {
    try {
        const user = await User.findById(userId).populate('administratorDetails').populate('breweryDetails');
        if (!user) {
            req.flash('error', 'Utente non trovato');
            return res.redirect(`/administrator/users/update?userUpdateId=${userId}`);
        }
        if (!user.role.includes(roleToAdd)) {
            user.role.push(roleToAdd);
            if (roleToAdd === 'customer') {
                user.customerDetails = {
                    customerName: '',
                    customerSurname: '',
                    customerFiscalCode: '',
                    customerAddresses: { billingAddress: '', shippingAddress: '' },
                    customerPhoneNumber: ''
                };
            } else if (roleToAdd === 'administrator') {
                const newAdmin = new Administrator({ administratorName: '', administratorPermission: '' });
                await newAdmin.save();
                user.administratorDetails = newAdmin._id;
            } else if (roleToAdd === 'brewery') {
                const newBrewery = new Brewery({
                    breweryName: '',
                    breweryDescription: '',
                    breweryFiscalCode: '',
                    breweryREAcode: '',
                    breweryacciseCode: '',
                    breweryFund: '',
                    breweryLegalAddress: '',
                    breweryPhoneNumber: ''
                });
                await newBrewery.save();
                user.breweryDetails = newBrewery._id;
            }
            await user.save();
            req.flash('success', `Ruolo ${roleToAdd} aggiunto con successo. Compila i dettagli e salva.`);
        }
        return res.redirect(`/administrator/users/update?userUpdateId=${userId}`);
    } catch (error) {
        req.flash('error', 'Errore durante l\'aggiunta del ruolo');
        return res.redirect(`/administrator/users/update?userUpdateId=${userId}`);
    }
}

// Rimuovi un ruolo da un utente e cancella i dettagli associati
async function removeRoleFromUser(userId, roleToRemove, req, res) {
    try {
        const user = await User.findById(userId);
        if (!user) {
            req.flash('error', 'Utente non trovato');
            return res.redirect(`/administrator/users/update?userUpdateId=${userId}`);
        }
        user.role = user.role.filter(r => r !== roleToRemove);
        if (roleToRemove === 'customer') {
            user.customerDetails = undefined;
        } else if (roleToRemove === 'administrator' && user.administratorDetails) {
            await Administrator.findByIdAndDelete(user.administratorDetails);
            user.administratorDetails = undefined;
        } else if (roleToRemove === 'brewery' && user.breweryDetails) {
            await Brewery.findByIdAndDelete(user.breweryDetails);
            user.breweryDetails = undefined;
        }
        await user.save();
        req.flash('success', `Ruolo ${roleToRemove} rimosso con successo.`);
        return res.redirect(`/administrator/users/update?userUpdateId=${userId}`);
    } catch (error) {
        req.flash('error', 'Errore durante la rimozione del ruolo');
        return res.redirect(`/administrator/users/update?userUpdateId=${userId}`);
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
    addRoleToUser,
    removeRoleFromUser,
};