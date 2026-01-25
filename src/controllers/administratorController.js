const User = require('../models/User');
const Administrator = require('../models/Administrator');
const Brewery = require('../models/Brewery');
const Beer = require('../models/Beer');
const Review = require('../models/Review');
const ReviewService = require('../services/reviewService');
const AIService = require('../services/aiService');
const LogoAnalyzerService = require('../services/logoAnalyzerService');
const mongoose = require('mongoose');
const logWithFileName = require('../utils/logger'); // Importa logWithFileName
const bcrypt = require('bcrypt');
const { extractImageFromReview } = require('../utils/imageProcessor');

const logger = logWithFileName(__filename); // Crea logger per questo file

// Crea un nuovo utente
async function createUser({
    username, password, role,
    customerName, customerSurname, customerFiscalCode, customerBillingAddress, customerShippingAddress, customerPhoneNumber,
    administratorName, administratorPermission,
    breweryName, breweryDescription, breweryFiscalCode
}, req, res) {
    try {
        logger.info('Inizio creazione di un nuovo utente'); // Log in italiano

        // RIMOSSO: const hashedPassword = await bcrypt.hash(password, 10);
        // Il middleware pre-save del modello User si occupa automaticamente dell'hash

        let newUser = new User({
            username: username,
            password, // Password in chiaro - verrà hashata dal middleware pre-save
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

// Get all users with proper sorting and populated details
async function getAllUsers(req, res, next) {
    try {
        // Recupera tutti gli utenti con i dettagli popolati e ordinamento personalizzato
        const users = await User.find()
            .populate('customerDetails')
            .populate('administratorDetails') 
            .populate('breweryDetails')
            .lean(); // Usa lean() per performance migliori con dati read-only

        // Ordinamento custom: non-administrator prima, poi administrator, poi per username
        const sortedUsers = users.sort((a, b) => {
            const aIsAdmin = a.role.includes('administrator');
            const bIsAdmin = b.role.includes('administrator');
            
            // Prima i non-administrator
            if (aIsAdmin && !bIsAdmin) return 1;
            if (!aIsAdmin && bIsAdmin) return -1;
            
            // Se entrambi sono dello stesso tipo (admin o non-admin), ordina per username
            return a.username.localeCompare(b.username);
        });

        logger.info(`Utenti recuperati con successo: ${sortedUsers.length} utenti trovati e ordinati`);
        
        // Se ha parametro raw, restituisce solo i dati (per compatibilità)
        if (req && res && next && typeof next === 'object' && next.raw) {
            return sortedUsers;
        }
        
        return sortedUsers;
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
        // RIMOSSO: Hash manuale della password
        // Il middleware pre-save del modello User si occupa automaticamente dell'hash
        // if (updateData.password) {
        //     updateData.password = await bcrypt.hash(updateData.password, 10);
        // }
        
        // SECURITY FIX: Non aggiornare defaultRole per administrator
        const user = await User.findById(userId);
        if (user && user.role.includes('administrator')) {
            // Rimuovi defaultRole dall'aggiornamento per gli administrator
            delete updateData.defaultRole;
            logger.info(`DefaultRole rimosso dall'aggiornamento per utente administrator: ${userId}`);
        }
        
        const updatedUser = await User.findByIdAndUpdate(userId, updateData, { new: true });
        if (!updatedUser) {
            logger.warn(`Utente non trovato: ${userId}`);
            return null;
        }
        logger.info(`Utente aggiornato con successo: ${userId}`);
        return updatedUser;
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
async function getAllBreweries() {
    logger.info('Recupero di tutti i brewery');
    try {
        const breweries = await Brewery.find().sort({ createdAt: -1 });
        logger.info(`Brewery recuperati con successo: ${breweries.length} brewery trovati`);
        return breweries;
    } catch (error) {
        logger.error('Errore durante il recupero dei brewery', error);
        throw error;
    }
}

async function createBrewery(breweryData, req, res) {
    try {
        logger.info('Creazione di un nuovo brewery');
        
        const newBrewery = new Brewery({
            breweryName: breweryData.breweryName,
            breweryDescription: breweryData.breweryDescription,
            breweryFiscalCode: breweryData.breweryFiscalCode,
            breweryREAcode: breweryData.breweryREAcode,
            breweryacciseCode: breweryData.breweryacciseCode,
            breweryFund: breweryData.breweryFund,
            breweryLegalAddress: breweryData.breweryLegalAddress,
            breweryPhoneNumber: breweryData.breweryPhoneNumber,
            breweryWebsite: breweryData.breweryWebsite,
            breweryEmail: breweryData.breweryEmail,
            breweryProductionAddress: breweryData.breweryProductionAddress,
            brewerySize: breweryData.brewerySize,
            employeeCount: breweryData.employeeCount,
            productionVolume: breweryData.productionVolume,
            distributionArea: breweryData.distributionArea,
            breweryHistory: breweryData.breweryHistory,
            masterBrewer: breweryData.masterBrewer,
            foundingYear: breweryData.foundingYear,
            mainProducts: breweryData.mainProducts ? breweryData.mainProducts.split(',').map(p => p.trim()) : [],
            awards: breweryData.awards ? breweryData.awards.split(',').map(a => a.trim()) : [],
            brewerySocialMedia: {
                facebook: breweryData.facebook || '',
                instagram: breweryData.instagram || '',
                twitter: breweryData.twitter || '',
                linkedin: breweryData.linkedin || '',
                youtube: breweryData.youtube || ''
            }
        });
        
        await newBrewery.save();
        
        logger.info(`Brewery creato con successo: ${newBrewery._id}`);
        req.flash('success', 'Birrificio creato con successo');
        res.redirect('/administrator/breweries');
        
    } catch (error) {
        logger.error(`Errore durante la creazione del brewery: ${error.message}`);
        req.flash('error', `Errore durante la creazione del birrificio: ${error.message}`);
        const redirectUrl = req.headers.referer || '/administrator/breweries';
        res.redirect(redirectUrl);
    }
}

async function getBreweryDetailsById(breweryId) {
    logger.info(`Recupero dettagli brewery con ID: ${breweryId}`);
    try {
        const brewery = await Brewery.findById(breweryId);
        if (!brewery) {
            logger.warn(`Brewery non trovato: ${breweryId}`);
            return null;
        }
        
        // Aggiungi statistiche delle birre associate
        const Beer = require('../models/Beer');
        const Review = require('../models/Review');
        
        const beers = await Beer.find({ brewery: breweryId });
        const totalBeers = beers.length;
        
        // Calcola statistiche recensioni
        const reviews = await Review.find({ 'ratings.brewery': breweryId });
        const totalReviews = reviews.reduce((sum, review) => {
            return sum + review.ratings.filter(rating => rating.brewery && rating.brewery.toString() === breweryId).length;
        }, 0);
        
        const breweryDetails = brewery.toObject ? brewery.toObject() : brewery;
        breweryDetails.stats = {
            totalBeers,
            totalReviews,
            beers: beers.map(beer => ({
                _id: beer._id,
                beerName: beer.beerName,
                beerType: beer.beerType,
                alcoholContent: beer.alcoholContent
            }))
        };
        
        logger.info(`Brewery dettagli recuperati con successo: ${breweryId}`);
        return breweryDetails;
    } catch (error) {
        logger.error(`Errore durante il recupero dettagli brewery: ${breweryId}`, error);
        throw error;
    }
}

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
        // Gestione dei social media se presenti nei dati di aggiornamento
        if (updateData.facebook || updateData.instagram || updateData.twitter || updateData.linkedin || updateData.youtube) {
            updateData.brewerySocialMedia = {
                facebook: updateData.facebook || '',
                instagram: updateData.instagram || '',
                twitter: updateData.twitter || '',
                linkedin: updateData.linkedin || '',
                youtube: updateData.youtube || ''
            };
            
            // Rimuovi i campi individuali per evitare errori di schema
            delete updateData.facebook;
            delete updateData.instagram;
            delete updateData.twitter;
            delete updateData.linkedin;
            delete updateData.youtube;
        }
        
        // Gestione array per mainProducts e awards
        if (updateData.mainProducts && typeof updateData.mainProducts === 'string') {
            updateData.mainProducts = updateData.mainProducts.split(',').map(p => p.trim()).filter(p => p);
        }
        if (updateData.awards && typeof updateData.awards === 'string') {
            updateData.awards = updateData.awards.split(',').map(a => a.trim()).filter(a => a);
        }
        
        // Gestione del logo: se campo vuoto, imposta a stringa vuota per permettere rimozione
        // Se logo nuovo o cambiato, analizza se è chiaro per applicare drop-shadow
        let shouldAnalyzeLogo = false;
        if (updateData.breweryLogo !== undefined) {
            updateData.breweryLogo = updateData.breweryLogo.trim() || '';
            if (updateData.breweryLogo === '') {
                // Reset logoIsLight se logo viene rimosso
                updateData.logoIsLight = null;
            } else {
                // Forza reset per ri-analisi del nuovo logo
                updateData.logoIsLight = null;
                shouldAnalyzeLogo = true;
            }
        }
        
        const brewery = await Brewery.findByIdAndUpdate(breweryId, updateData, { new: true });
        if (!brewery) {
            logger.warn(`Brewery non trovato: ${breweryId}`);
            return null;
        }
        
        // Analizza il logo se è stato aggiunto o cambiato
        if (shouldAnalyzeLogo && brewery.breweryLogo) {
            try {
                const isLight = await LogoAnalyzerService.isImageLight(brewery.breweryLogo);
                if (isLight !== null) {
                    brewery.logoIsLight = isLight;
                    await brewery.save();
                    logger.info(`🎨 Logo analizzato per ${brewery.breweryName}: ${isLight ? '☀️ CHIARO' : '🌙 SCURO'}`);
                }
            } catch (logoError) {
                logger.warn(`⚠️ Errore analisi logo per ${brewery.breweryName}: ${logoError.message}`);
            }
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
        logger.info(`addRoleToUser chiamata: userId=${userId}, roleToAdd=${roleToAdd}, breweryId=${req.body.breweryId}`);
        
        const user = await User.findById(userId).populate('administratorDetails').populate('breweryDetails');
        if (!user) {
            req.flash('error', 'Utente non trovato');
            return res.redirect(`/administrator/users/update?userUpdateId=${userId}`);
        }
        // SECURITY FIX: Blocco assegnazione ruolo administrator per conformità specifiche
        if (roleToAdd === 'administrator') {
            req.flash('error', 'Il ruolo administrator non può essere assegnato tramite questa funzione per motivi di sicurezza');
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
            } else if (roleToAdd === 'brewery') {
                const breweryId = req.body.breweryId;
                
                if (!breweryId) {
                    req.flash('error', 'Devi selezionare un birrificio per assegnare il ruolo brewery');
                    return res.redirect(`/administrator/users/update?userUpdateId=${userId}`);
                }

                // Verifica che il birrificio esista
                const existingBrewery = await Brewery.findById(breweryId);
                if (!existingBrewery) {
                    req.flash('error', 'Birrificio selezionato non trovato');
                    return res.redirect(`/administrator/users/update?userUpdateId=${userId}`);
                }

                // Verifica che il birrificio non sia già associato ad un altro utente
                const existingUserWithBrewery = await User.findOne({ breweryDetails: breweryId });
                if (existingUserWithBrewery && existingUserWithBrewery._id.toString() !== userId) {
                    req.flash('error', `Il birrificio "${existingBrewery.breweryName}" è già associato all'utente "${existingUserWithBrewery.username}"`);
                    return res.redirect(`/administrator/users/update?userUpdateId=${userId}`);
                }

                user.breweryDetails = breweryId;
                req.flash('success', `Ruolo brewery aggiunto con successo. Utente associato al birrificio "${existingBrewery.breweryName}".`);
            }
            await user.save();
            if (roleToAdd === 'customer') {
                req.flash('success', `Ruolo ${roleToAdd} aggiunto con successo. Compila i dettagli e salva.`);
            }
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

        // SECURITY FIX: Controllo rimozione ruolo customer
        if (roleToRemove === 'customer') {
            // Un utente deve sempre avere almeno il ruolo customer
            if (user.role.length <= 1) {
                req.flash('error', 'Impossibile rimuovere il ruolo customer: ogni utente deve avere almeno un ruolo');
                return res.redirect(`/administrator/users/update?userUpdateId=${userId}`);
            }
            // Se ha più ruoli, ma customer è il defaultRole, impedisci la rimozione
            if (user.defaultRole === 'customer' && user.role.length > 1) {
                req.flash('error', 'Impossibile rimuovere il ruolo customer: è il ruolo predefinito dell\'utente. Cambia prima il ruolo predefinito.');
                return res.redirect(`/administrator/users/update?userUpdateId=${userId}`);
            }
        }

        // SECURITY FIX: Controllo rimozione ultimo ruolo
        if (user.role.length <= 1) {
            req.flash('error', 'Impossibile rimuovere l\'ultimo ruolo: ogni utente deve avere almeno un ruolo');
            return res.redirect(`/administrator/users/update?userUpdateId=${userId}`);
        }

        logger.info(`Rimozione ruolo ${roleToRemove} da utente ${user.username}`);

        user.role = user.role.filter(r => r !== roleToRemove);
        
        if (roleToRemove === 'customer') {
            user.customerDetails = undefined;
        } else if (roleToRemove === 'administrator' && user.administratorDetails) {
            await Administrator.findByIdAndDelete(user.administratorDetails);
            user.administratorDetails = undefined;
        } else if (roleToRemove === 'brewery' && user.breweryDetails) {
            // IMPORTANTE: Non eliminare il birrificio, solo disassocia l'utente
            user.breweryDetails = undefined;
            logger.info(`Utente ${user.username} disassociato dal birrificio, birrificio non eliminato`);
        }

        // Se il ruolo rimosso era l'activeRole, reset a customer se disponibile
        if (req.session && req.session.activeRole === roleToRemove) {
            req.session.activeRole = user.role.includes('customer') ? 'customer' : user.role[0];
            logger.info(`ActiveRole resettato a ${req.session.activeRole} dopo rimozione ruolo`);
        }

        await user.save();
        req.flash('success', `Ruolo ${roleToRemove} rimosso con successo.`);
        return res.redirect(`/administrator/users/update?userUpdateId=${userId}`);
    } catch (error) {
        logger.error(`Errore rimozione ruolo: ${error.message}`);
        req.flash('error', 'Errore durante la rimozione del ruolo');
        return res.redirect(`/administrator/users/update?userUpdateId=${userId}`);
    }
}

// === GESTIONE STATISTICHE ===

/**
 * Dashboard statistiche principali per admin
 */
async function getStatisticsDashboard(req, res) {
    try {
        logger.info('Caricamento dashboard statistiche admin');

        // Parametri di paginazione e filtri dalla query
        const page = parseInt(req.query.page) || 1;
        let limit = parseInt(req.query.limit) || 10;
        
        // Se limit è 999, significa "Tutte le righe" - impostiamo un numero molto alto
        if (limit === 999) {
            limit = 9999; // Numero sufficientemente alto per mostrare tutti i risultati
        }
        
        const sortBy = req.query.sortBy || 'totalReviews';
        const sortOrder = req.query.sortOrder || 'desc';
        const minReviews = parseInt(req.query.minReviews) || 0;
        const minRating = parseFloat(req.query.minRating) || 0;
        const maxRating = parseFloat(req.query.maxRating) || 5;
        const breweryFilter = req.query.brewery || '';

        // Ottieni statistiche globali dai birrifici (senza cache per admin dashboard)
        const breweriesStats = await ReviewService.getAllBreweriesStats({
            page,
            limit,
            sortBy,
            sortOrder,
            minReviews,
            breweryFilter, // Aggiungiamo il filtro per birrificio
            skipCache: true // Disabilita la cache per le statistiche admin
        });

        // Filtra per rating se specificato
        if (minRating > 0 || maxRating < 5) {
            breweriesStats.breweries = breweriesStats.breweries.filter(brewery => 
                brewery.averageRating >= minRating && brewery.averageRating <= maxRating
            );
        }

        // Statistiche generali aggiuntive
        const [totalUsers, totalBeers, totalBreweriesInDB] = await Promise.all([
            User.countDocuments(),
            Beer.countDocuments(),
            Brewery.countDocuments() // Aggiungiamo il conteggio totale dei birrifici
        ]);

        // Calcola il numero corretto di recensioni totali (count dei ratings, non dei documenti Review)
        const totalReviewsResult = await Review.aggregate([
            { $unwind: '$ratings' },
            { $count: 'total' }
        ]);
        const totalReviews = totalReviewsResult.length > 0 ? totalReviewsResult[0].total : 0;

        // Distribuzioni per analisi
        const ratingDistribution = await Review.aggregate([
            { $unwind: '$ratings' },
            {
                $group: {
                    _id: { $round: '$ratings.rating' },
                    count: { $sum: 1 }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        const monthlyTrend = await Review.aggregate([
            {
                $group: {
                    _id: {
                        year: { $year: '$date' },
                        month: { $month: '$date' }
                    },
                    count: { $sum: 1 }
                }
            },
            { $sort: { '_id.year': -1, '_id.month': -1 } },
            { $limit: 12 }
        ]);

        // Statistiche per tipologie di birre
        const beerTypesStats = await Review.aggregate([
            { $unwind: '$ratings' },
            {
                $lookup: {
                    from: 'beers',
                    localField: 'ratings.beer',
                    foreignField: '_id',
                    as: 'beerInfo'
                }
            },
            { $unwind: '$beerInfo' },
            { $match: { 'beerInfo.beerType': { $exists: true, $ne: null, $ne: '' } } },
            {
                $group: {
                    _id: '$beerInfo.beerType',
                    count: { $sum: 1 },
                    avgRating: { $avg: '$ratings.rating' }
                }
            },
            { $match: { count: { $gte: 1 } } }, // Solo tipi con almeno 1 recensione (ridotto da 2)
            { $sort: { count: -1 } },
            { $limit: 8 } // Top 8 tipi più recensiti
        ]);

        // Calcola statistiche rapide reali
        let globalAverageRating = 0;
        let activeUsersPercentage = 0;
        let monthlyGrowthPercentage = 0;
        let engagementPercentage = 0;

        try {
            // Rating medio globale
            const globalRatingResult = await Review.aggregate([
                { $unwind: '$ratings' },
                {
                    $group: {
                        _id: null,
                        avgRating: { $avg: '$ratings.rating' }
                    }
                }
            ]);
            globalAverageRating = globalRatingResult.length > 0 ? globalRatingResult[0].avgRating : 0;

            // Utenti attivi (utenti che hanno fatto almeno una recensione negli ultimi 30 giorni)
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            
            const activeUsersCount = await Review.distinct('user', {
                createdAt: { $gte: thirtyDaysAgo }
            }).then(users => users.length);
            
            activeUsersPercentage = totalUsers > 0 ? Math.round((activeUsersCount / totalUsers) * 100) : 0;

            // Crescita mensile (confronto ultimo mese con mese precedente)
            const currentMonth = new Date();
            currentMonth.setDate(1); // Primo giorno del mese corrente
            const lastMonth = new Date(currentMonth);
            lastMonth.setMonth(lastMonth.getMonth() - 1);
            const twoMonthsAgo = new Date(lastMonth);
            twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 1);

            const [currentMonthReviews, lastMonthReviews] = await Promise.all([
                Review.countDocuments({ createdAt: { $gte: currentMonth } }),
                Review.countDocuments({ 
                    createdAt: { 
                        $gte: twoMonthsAgo, 
                        $lt: lastMonth 
                    } 
                })
            ]);

            if (lastMonthReviews > 0) {
                monthlyGrowthPercentage = Math.round(((currentMonthReviews - lastMonthReviews) / lastMonthReviews) * 100);
            }

            // Engagement (percentuale di utenti che hanno fatto almeno una recensione)
            const usersWithReviews = await Review.distinct('user').then(users => users.length);
            engagementPercentage = totalUsers > 0 ? Math.round((usersWithReviews / totalUsers) * 100) : 0;

        } catch (statsError) {
            logger.warn('Errore nel calcolo delle statistiche rapide:', statsError);
            // Le variabili rimangono a 0 se c'è un errore
        }

        // Genera dinamicamente il file statisticsData.js con i dati reali
        try {
            const fs = require('fs');
            const path = require('path');
            const statisticsDataPath = path.join(__dirname, '../../public/js/statisticsData.js');
            
            const jsContent = `// File generato dinamicamente dal server - NON MODIFICARE MANUALMENTE
// Rendi i dati analytics disponibili al JavaScript
console.log('📊 Caricamento dati analytics nel frontend...');

try {
    window.analyticsData = {
        ratingDistribution: ${JSON.stringify(ratingDistribution)},
        monthlyTrend: ${JSON.stringify(monthlyTrend)},
        beerTypesStats: ${JSON.stringify(beerTypesStats)}
    };
    console.log('✅ Dati analytics caricati nel frontend:', window.analyticsData);
    console.log('🔍 Rating distribution:', window.analyticsData.ratingDistribution);
    console.log('🔍 Monthly trend:', window.analyticsData.monthlyTrend);
    console.log('🔍 Beer types stats:', window.analyticsData.beerTypesStats);
} catch (error) {
    console.error('❌ Errore nel caricamento dati analytics:', error);
    window.analyticsData = {
        ratingDistribution: [],
        monthlyTrend: [],
        beerTypesStats: []
    };
}

// NOTA: StatisticsManager viene inizializzato automaticamente da statisticsManager.js
// Non è necessario inizializzarlo qui per evitare doppia inizializzazione`;
            
            fs.writeFileSync(statisticsDataPath, jsContent, 'utf8');
            logger.info('File statisticsData.js generato dinamicamente con successo');
            
        } catch (fileError) {
            logger.warn('Errore nella generazione del file statisticsData.js:', fileError);
        }

        res.render('admin/statistics', {
            title: 'Statistiche Piattaforma',
            user: req.user,
            message: req.flash(),
            breweries: breweriesStats.breweries,
            pagination: breweriesStats.pagination,
            summary: {
                totalBreweries: breweriesStats.summary.totalBreweries || 0,
                totalUsers: totalUsers || 0,
                totalBeers: totalBeers || 0,
                totalReviews: totalReviews || 0, // Usa il totale REALE dal database, non quello filtrato
                totalBreweriesInDB: totalBreweriesInDB || 0, // Totale assoluto dei birrifici
                averageRating: breweriesStats.summary.averageRating || 0
            },
            filters: {
                page,
                limit: limit === 9999 ? 999 : limit, // Riconverti 9999 in 999 per il template
                sortBy,
                sortOrder,
                minReviews,
                minRating,
                maxRating,
                brewery: breweryFilter // Aggiungiamo il filtro birrificio
            },
            analytics: {
                ratingDistribution,
                monthlyTrend,
                beerTypesStats,
                // Prepara i dati JSON per il frontend
                ratingDistributionJson: JSON.stringify(ratingDistribution),
                monthlyTrendJson: JSON.stringify(monthlyTrend),
                beerTypesStatsJson: JSON.stringify(beerTypesStats)
            },
            quickStats: {
                globalAverageRating: Math.round(globalAverageRating * 10) / 10, // Arrotonda a 1 decimale
                activeUsersPercentage,
                monthlyGrowthPercentage,
                engagementPercentage
            }
        });

        logger.info('Dashboard statistiche caricata con successo', {
            breweriesCount: breweriesStats.breweries.length,
            totalReviews,
            totalUsers
        });

    } catch (error) {
        logger.error('Errore caricamento dashboard statistiche', error);
        req.flash('error', 'Errore durante il caricamento delle statistiche');
        res.redirect('/administrator');
    }
}

/**
 * API endpoint per statistiche breweries con filtri avanzati
 */
async function getBreweriesStatsAPI(req, res) {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const sortBy = req.query.sortBy || 'totalReviews';
        const sortOrder = req.query.sortOrder || 'desc';
        const minReviews = parseInt(req.query.minReviews) || 0;
        const search = req.query.search || '';

        logger.info('API request breweries stats', { page, limit, sortBy, sortOrder, minReviews, search });

        let stats = await ReviewService.getAllBreweriesStats({
            page: 1, // Prendi tutti per poi filtrare
            limit: 1000, // Limit alto per prendere tutti
            sortBy,
            sortOrder,
            minReviews,
            skipCache: true // Disabilita la cache per le API admin
        });

        // Filtro per ricerca se specificato
        if (search) {
            const searchRegex = new RegExp(search, 'i');
            stats.breweries = stats.breweries.filter(brewery => 
                searchRegex.test(brewery.breweryName)
            );
        }

        // Applica paginazione dopo filtri
        const total = stats.breweries.length;
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + limit;
        
        const result = {
            success: true,
            data: {
                breweries: stats.breweries.slice(startIndex, endIndex),
                pagination: {
                    page,
                    limit,
                    total,
                    pages: Math.ceil(total / limit),
                    hasNext: endIndex < total,
                    hasPrev: page > 1
                },
                summary: stats.summary
            }
        };

        res.json(result);

        logger.info('API breweries stats response sent', { 
            returnedCount: result.data.breweries.length,
            total 
        });

    } catch (error) {
        logger.error('Errore API breweries stats', error);
        res.status(500).json({
            success: false,
            error: 'Errore durante il recupero delle statistiche'
        });
    }
}

/**
 * Dettagli statistiche per singolo brewery
 */
async function getBreweryStatisticsDetail(req, res) {
    try {
        const breweryId = req.params.id;
        logger.info(`Caricamento dettagli statistiche brewery: ${breweryId}`);

        // Verifica che il brewery esista
        const brewery = await Brewery.findById(breweryId);
        if (!brewery) {
            req.flash('error', 'Birrificio non trovato');
            return res.redirect('/administrator/statistics');
        }

        // Ottieni statistiche dettagliate del brewery (senza cache)
        const breweryStats = await ReviewService.getBreweryStats(breweryId, true);
        
        // Aggiungi dettagli per ogni birra del brewery
        const beersWithStats = await Promise.all(
            breweryStats.beerBreakdown.map(async (beerSummary) => {
                const beerStats = await ReviewService.getBeerStats(beerSummary.beerId, true);
                const beerDetails = await Beer.findById(beerSummary.beerId);
                
                return {
                    ...beerSummary,
                    beerDetails: beerDetails ? beerDetails.toObject() : null,
                    fullStats: beerStats
                };
            })
        );

        // Timeline delle recensioni per grafici
        const reviewTimeline = await Review.aggregate([
            { $unwind: '$ratings' },
            {
                $lookup: {
                    from: 'beers',
                    localField: 'ratings.beer',
                    foreignField: '_id',
                    as: 'beerInfo'
                }
            },
            { $unwind: '$beerInfo' },
            { $match: { 'beerInfo.brewery': new mongoose.Types.ObjectId(breweryId) } },
            {
                $group: {
                    _id: {
                        year: { $year: '$createdAt' },
                        month: { $month: '$createdAt' }
                    },
                    count: { $sum: 1 },
                    avgRating: { $avg: '$ratings.rating' }
                }
            },
            { $sort: { '_id.year': 1, '_id.month': 1 } }
        ]);

        logger.info(`🎯 Rendering template admin/breweryStatistics per brewery: ${brewery.breweryName}`);
        
        res.render('brewery/dashboard', {
            user: req.user,
            message: req.flash(),
            brewery: brewery.toObject(),
            stats: breweryStats,
            beersWithStats,
            timeline: reviewTimeline,
            timelineJson: reviewTimeline
        });

        logger.info('Dettagli statistiche brewery caricati', {
            breweryId,
            totalReviews: breweryStats.totalReviews,
            totalBeers: breweryStats.totalBeers
        });

    } catch (error) {
        logger.error('Errore caricamento dettagli statistiche brewery', error);
        req.flash('error', 'Errore durante il caricamento delle statistiche del birrificio');
        res.redirect('/administrator/statistics');
    }
}

// FASE 2: Brewery Dashboard Unificato - Combina statistiche + form modifica
async function getBreweryDashboard(req, res) {
    try {
        const breweryId = req.params.id || (req.user.breweryDetails && req.user.breweryDetails._id);
        
        logger.info(`🔍 Debug getBreweryDashboard - breweryId: ${breweryId}, req.params.id: ${req.params.id}, req.user.breweryDetails: ${JSON.stringify(req.user.breweryDetails)}`);
        
        if (!breweryId) {
            logger.warn('❌ breweryId non trovato, redirect a /profile');
            req.flash('error', 'Dati birrificio non trovati');
            return res.redirect('/profile');
        }

        logger.info(`🏭 Caricamento brewery dashboard unificato: ${breweryId} per utente: ${req.user.username}`);

        // Verifica che il brewery esista e l'utente abbia accesso
        const brewery = await Brewery.findById(breweryId);
        if (!brewery) {
            logger.warn(`❌ Brewery ${breweryId} non trovato nel DB, redirect a /profile`);
            req.flash('error', 'Birrificio non trovato');
            return res.redirect('/profile');
        }

        // Verifica autorizzazioni (admin o owner brewery)
        const isAdmin = req.user.role.includes('administrator');
        
        logger.info(`🔍 Debug breweryDetails - req.user.breweryDetails: ${JSON.stringify(req.user.breweryDetails)}`);
        logger.info(`🔍 Debug comparison - breweryId: ${breweryId}`);
        
        const isOwnerBrewery = req.user.role.includes('brewery') &&
                              req.user.breweryDetails &&
                              (req.user.breweryDetails._id?.toString() === breweryId || 
                               req.user.breweryDetails._id?.toString() === breweryId.toString());

        logger.info(`🔍 Debug autorizzazioni - isAdmin: ${isAdmin}, isOwnerBrewery: ${isOwnerBrewery}, user.role: ${JSON.stringify(req.user.role)}`);
        
        if (req.user.breweryDetails) {
            logger.info(`🔍 Debug comparison details:`);
            logger.info(`  - breweryDetails._id: ${req.user.breweryDetails._id}`);
            logger.info(`  - breweryDetails._id?.toString(): ${req.user.breweryDetails._id?.toString()}`);
            logger.info(`  - breweryId: ${breweryId}`);
            logger.info(`  - Comparison 1 (._id?.toString() === breweryId): ${req.user.breweryDetails._id?.toString() === breweryId}`);
            logger.info(`  - Comparison 2 (._id?.toString() === breweryId.toString()): ${req.user.breweryDetails._id?.toString() === breweryId.toString()}`);
        }

        if (!isAdmin && !isOwnerBrewery) {
            logger.warn('❌ Autorizzazioni insufficienti, redirect a /profile');
            req.flash('error', 'Accesso negato. Non hai i permessi per gestire questo birrificio.');
            return res.redirect('/profile');
        }

        // Ottieni statistiche dettagliate del brewery (riutilizza logica esistente)
        const breweryStats = await ReviewService.getBreweryStats(breweryId, true);
        
        // Ottieni dettagli per ogni birra del brewery
        const beersWithStats = await Promise.all(
            breweryStats.beerBreakdown.map(async (beerSummary) => {
                const beerStats = await ReviewService.getBeerStats(beerSummary.beerId, true);
                const beerDetails = await Beer.findById(beerSummary.beerId);
                
                return {
                    ...beerSummary,
                    beerDetails: beerDetails ? beerDetails.toObject() : null,
                    fullStats: beerStats
                };
            })
        );

        // Timeline delle recensioni per grafici
        const reviewTimeline = await Review.aggregate([
            { $unwind: '$ratings' },
            {
                $lookup: {
                    from: 'beers',
                    localField: 'ratings.beer',
                    foreignField: '_id',
                    as: 'beerInfo'
                }
            },
            { $unwind: '$beerInfo' },
            { $match: { 'beerInfo.brewery': new mongoose.Types.ObjectId(breweryId) } },
            {
                $group: {
                    _id: {
                        year: { $year: '$createdAt' },
                        month: { $month: '$createdAt' }
                    },
                    count: { $sum: 1 },
                    avgRating: { $avg: '$ratings.rating' }
                }
            },
            { $sort: { '_id.year': 1, '_id.month': 1 } }
        ]);

        logger.info(`✅ Brewery dashboard caricato con successo per: ${brewery.breweryName}`);

        // 🚨 LOG CRUCIALE: VERIFICA SE ARRIVA A QUESTO PUNTO
        logger.info('🚨 ARRIVO AL CALCOLO STATISTICHE AVANZATE - CHECKPOINT 1');

        // 🚨 DEBUG: Calcolo statistiche avanzate con try-catch
        logger.info('🔍 Inizio calcolo statistiche avanzate per brewery:', breweryId);
        let advancedStats;
        try {
            // Calcolo statistiche avanzate
            logger.info('📊 Calcolo statistiche crescita...');
            
            // 1. Analisi crescita mese corrente vs precedente
            const currentDate = new Date();
            const currentYear = currentDate.getFullYear();
            const currentMonth = currentDate.getMonth() + 1; // JavaScript mese è 0-based
            const previousDate = new Date(currentYear, currentMonth - 2, 1); // Mese precedente
            const previousYear = previousDate.getFullYear();
            const previousMonth = previousDate.getMonth() + 1;

            const growthAnalysis = await Review.aggregate([
                { $unwind: '$ratings' },
                {
                    $lookup: {
                        from: 'beers',
                        localField: 'ratings.beer',
                        foreignField: '_id',
                        as: 'beerInfo'
                    }
                },
                { $unwind: '$beerInfo' },
                { $match: { 'beerInfo.brewery': new mongoose.Types.ObjectId(breweryId) } },
                {
                    $group: {
                        _id: {
                            year: { $year: '$createdAt' },
                            month: { $month: '$createdAt' }
                        },
                        count: { $sum: 1 },
                        avgRating: { $avg: '$ratings.rating' }
                    }
                },
                {
                    $match: {
                        $or: [
                            { '_id.year': currentYear, '_id.month': currentMonth },
                            { '_id.year': previousYear, '_id.month': previousMonth }
                        ]
                    }
                }
            ]);

            const currentMonthData = growthAnalysis.find(item => 
                item._id.year === currentYear && item._id.month === currentMonth) || { count: 0, avgRating: 0 };
            const previousMonthData = growthAnalysis.find(item => 
                item._id.year === previousYear && item._id.month === previousMonth) || { count: 0, avgRating: 0 };

            const reviewsGrowth = previousMonthData.count > 0 
                ? ((currentMonthData.count - previousMonthData.count) / previousMonthData.count * 100).toFixed(1)
                : currentMonthData.count > 0 ? 100 : 0;

            logger.info('✅ Crescita calcolata:', { currentMonth: currentMonthData, previousMonth: previousMonthData, growth: reviewsGrowth });

            // 2. Top 5 Birre Performance
            logger.info('📊 Calcolo top birre...');
            const topBeersPerformance = await Review.aggregate([
                { $unwind: '$ratings' },
                {
                    $lookup: {
                        from: 'beers',
                        localField: 'ratings.beer',
                        foreignField: '_id',
                        as: 'beerInfo'
                    }
                },
                { $unwind: '$beerInfo' },
                { $match: { 'beerInfo.brewery': new mongoose.Types.ObjectId(breweryId) } },
                {
                    $group: {
                        _id: '$ratings.beer',
                        beerName: { $first: '$beerInfo.beerName' },
                        totalReviews: { $sum: 1 },
                        avgRating: { $avg: '$ratings.rating' },
                        satisfactionIndex: {
                            $avg: {
                                $cond: [{ $gte: ['$ratings.rating', 4] }, 100, 0]
                            }
                        }
                    }
                },
                { $sort: { totalReviews: -1, avgRating: -1 } },
                { $limit: 5 }
            ]);

            logger.info('✅ Top birre calcolate:', topBeersPerformance);

            // 3. Distribuzione Rating (1-5 stelle)
            logger.info('📊 Calcolo distribuzione rating...');
            const ratingDistribution = await Review.aggregate([
                { $unwind: '$ratings' },
                {
                    $lookup: {
                        from: 'beers',
                        localField: 'ratings.beer',
                        foreignField: '_id',
                        as: 'beerInfo'
                    }
                },
                { $unwind: '$beerInfo' },
                { $match: { 'beerInfo.brewery': new mongoose.Types.ObjectId(breweryId) } },
                {
                    $group: {
                        _id: { $round: ['$ratings.rating'] },
                        count: { $sum: 1 }
                    }
                },
                { $sort: { '_id': 1 } }
            ]);

            logger.info('✅ Distribuzione rating calcolata:', ratingDistribution);

            // 4. Coinvolgimento Utenti
            logger.info('📊 Calcolo engagement utenti...');
            const userEngagement = await Review.aggregate([
                { $unwind: '$ratings' },
                {
                    $lookup: {
                        from: 'beers',
                        localField: 'ratings.beer',
                        foreignField: '_id',
                        as: 'beerInfo'
                    }
                },
                { $unwind: '$beerInfo' },
                { $match: { 'beerInfo.brewery': new mongoose.Types.ObjectId(breweryId) } },
                {
                    $group: {
                        _id: '$createdBy',
                        reviewCount: { $sum: 1 },
                        avgUserRating: { $avg: '$ratings.rating' },
                        lastReviewDate: { $max: '$createdAt' }
                    }
                },
                {
                    $group: {
                        _id: null,
                        totalUniqueUsers: { $sum: 1 },
                        multiReviewUsers: {
                            $sum: { $cond: [{ $gt: ['$reviewCount', 1] }, 1, 0] }
                        },
                        avgReviewsPerUser: { $avg: '$reviewCount' },
                        loyalUsers: {
                            $sum: { $cond: [{ $gte: ['$reviewCount', 3] }, 1, 0] }
                        }
                    }
                }
            ]);

            const engagementData = userEngagement[0] || {
                totalUniqueUsers: 0,
                multiReviewUsers: 0,
                avgReviewsPerUser: 0,
                loyalUsers: 0
            };

            logger.info('✅ Engagement calcolato:', engagementData);

            // 5. Indicatori Avanzati
            logger.info('📊 Calcolo indicatori avanzati...');
            const totalReviews = breweryStats.totalReviews || 0;
            const highRatingReviews = await Review.aggregate([
                { $unwind: '$ratings' },
                {
                    $lookup: {
                        from: 'beers',
                        localField: 'ratings.beer',
                        foreignField: '_id',
                        as: 'beerInfo'
                    }
                },
                { $unwind: '$beerInfo' },
                { $match: { 'beerInfo.brewery': new mongoose.Types.ObjectId(breweryId) } },
                { $match: { 'ratings.rating': { $gte: 4 } } },
                { $count: 'highRatingCount' }
            ]);

            const satisfactionIndex = totalReviews > 0 
                ? ((highRatingReviews[0]?.highRatingCount || 0) / totalReviews * 100).toFixed(1)
                : 0;

            // 6. Analisi Giorni della Settimana
            logger.info('📊 Calcolo attività settimanale...');
            const weekdayAnalysis = await Review.aggregate([
                { $unwind: '$ratings' },
                {
                    $lookup: {
                        from: 'beers',
                        localField: 'ratings.beer',
                        foreignField: '_id',
                        as: 'beerInfo'
                    }
                },
                { $unwind: '$beerInfo' },
                { $match: { 'beerInfo.brewery': new mongoose.Types.ObjectId(breweryId) } },
                {
                    $group: {
                        _id: { $dayOfWeek: '$createdAt' },
                        count: { $sum: 1 },
                        avgRating: { $avg: '$ratings.rating' }
                    }
                },
                { $sort: { '_id': 1 } }
            ]);

            // Converti numeri giorni in nomi
            const weekdays = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];
            const weekdayData = weekdayAnalysis.map(day => ({
                dayName: weekdays[day._id - 1],
                count: day.count,
                avgRating: parseFloat(day.avgRating.toFixed(1))
            }));

            logger.info('✅ Attività settimanale calcolata:', weekdayData);

            // Combina tutte le statistiche avanzate
            advancedStats = {
                growth: {
                    reviewsGrowth: parseFloat(reviewsGrowth),
                    currentMonth: currentMonthData,
                    previousMonth: previousMonthData,
                    isPositiveGrowth: parseFloat(reviewsGrowth) > 0
                },
                topBeers: topBeersPerformance,
                ratingDistribution,
                engagement: {
                    ...engagementData,
                    engagementRate: engagementData.totalUniqueUsers > 0 
                        ? (engagementData.multiReviewUsers / engagementData.totalUniqueUsers * 100).toFixed(1)
                        : 0,
                    loyaltyRate: engagementData.totalUniqueUsers > 0
                        ? (engagementData.loyalUsers / engagementData.totalUniqueUsers * 100).toFixed(1)
                        : 0
                },
                indicators: {
                    satisfactionIndex: parseFloat(satisfactionIndex),
                    avgReviewsPerUser: parseFloat((engagementData.avgReviewsPerUser || 0).toFixed(1)),
                    totalUniqueUsers: engagementData.totalUniqueUsers
                },
                weekdayActivity: weekdayData
            };

            logger.info('✅ TUTTE le statistiche avanzate completate con successo!');

        } catch (error) {
            logger.error('❌ ERRORE nel calcolo statistiche avanzate:', error);
            // Fallback per evitare crash della pagina
            advancedStats = {
                growth: { reviewsGrowth: 0, currentMonth: { count: 0 }, previousMonth: { count: 0 }, isPositiveGrowth: false },
                topBeers: [],
                ratingDistribution: [],
                engagement: { engagementRate: 0, loyaltyRate: 0 },
                indicators: { satisfactionIndex: 0, avgReviewsPerUser: 0, totalUniqueUsers: 0 },
                weekdayActivity: []
            };
        }

        // Log delle statistiche avanzate per debug
        logger.info('🔍 Debug advancedStats FINALE', {
            topBeersLength: advancedStats.topBeers?.length || 0,
            ratingDistributionLength: advancedStats.ratingDistribution?.length || 0,
            weekdayActivityLength: advancedStats.weekdayActivity?.length || 0,
            topBeersType: typeof advancedStats.topBeers,
            ratingDistributionType: typeof advancedStats.ratingDistribution,
            weekdayActivityType: typeof advancedStats.weekdayActivity,
            topBeersPreview: advancedStats.topBeers?.slice(0, 2),
            ratingDistributionPreview: advancedStats.ratingDistribution?.slice(0, 2),
            weekdayActivityPreview: advancedStats.weekdayActivity?.slice(0, 2)
        });

        // Assicurati che advancedStats abbia valori di default e siano oggetti JS puliti
        const safeAdvancedStats = {
            topBeers: (advancedStats?.topBeers || []).map(beer => ({
                _id: beer._id?.toString(),
                beerName: beer.beerName,
                totalReviews: beer.totalReviews,
                avgRating: beer.avgRating,
                satisfactionIndex: beer.satisfactionIndex
            })),
            ratingDistribution: (advancedStats?.ratingDistribution || []).map(item => ({
                _id: item._id,
                count: item.count
            })),
            weekdayActivity: (advancedStats?.weekdayActivity || []).map(item => ({
                _id: item._id,
                count: item.count,
                avgRating: item.avgRating
            })),
            growth: advancedStats?.growth || { isPositiveGrowth: false, reviewsGrowth: 0 },
            indicators: advancedStats?.indicators || { satisfactionIndex: 0, avgReviewsPerUser: 0 },
            engagement: advancedStats?.engagement || { engagementRate: 0 }
        };

        // Renderizza la dashboard unificata brewery
        res.render('brewery/dashboard', {
            title: `Dashboard ${brewery.breweryName}`,
            user: req.user,
            message: req.flash(),
            brewery: brewery.toObject(),
            stats: breweryStats,
            beersWithStats,
            timeline: reviewTimeline,
            // Converti in JSON stringificato per evitare problemi di serializzazione
            timelineJson: JSON.stringify(reviewTimeline),
            advancedStats: safeAdvancedStats,
            // Converti in JSON stringificato
            advancedStatsJson: JSON.stringify({
                topBeers: safeAdvancedStats.topBeers,
                ratingDistribution: safeAdvancedStats.ratingDistribution,
                weekdayActivity: safeAdvancedStats.weekdayActivity
            }),
            // Converti in JSON stringificato
            statsJson: JSON.stringify({
                totalReviews: breweryStats.totalReviews || 0,
                avgRating: breweryStats.avgRating || 0
            }),
            isOwner: isOwnerBrewery,
            isAdmin: isAdmin
        });

        logger.info('Brewery dashboard renderizzato', {
            breweryId,
            totalReviews: breweryStats.totalReviews,
            totalBeers: breweryStats.totalBeers,
            userRole: req.user.role,
            isOwner: isOwnerBrewery
        });

    } catch (error) {
        logger.error('Errore nel caricamento brewery dashboard:', error);
        req.flash('error', 'Errore durante il caricamento della dashboard');
        res.redirect('/profile');
    }
}

// =====================================================
// SISTEMA DI TEST MATCHING BIRRIFICI AI
// =====================================================

/**
 * Visualizza la pagina di test per il matching dei birrifici
 */
async function getBreweryMatchingTest(req, res) {
    try {
        logger.info('[getBreweryMatchingTest] Accesso alla pagina di test matching', {
            userId: req.user?._id,
            userRole: req.user?.role
        });

        // Carica tutti i birrifici per avere il dataset completo
        const allBreweries = await Brewery.find({}).select('breweryName breweryWebsite breweryEmail breweryLegalAddress breweryPhoneNumber createdAt').lean();
        
        logger.info('[getBreweryMatchingTest] Dataset birrifici caricato', {
            totalBreweries: allBreweries.length
        });

        res.render('admin/breweryMatchingTest', {
            title: 'Test Matching Birrifici AI',
            user: req.user,
            message: req.flash(),
            totalBreweries: allBreweries.length,
            breweries: allBreweries.slice(0, 10) // Mostra solo i primi 10 per esempio
        });

    } catch (error) {
        logger.error('[getBreweryMatchingTest] Errore nel caricamento pagina:', error);
        req.flash('error', 'Errore durante il caricamento della pagina di test');
        res.redirect('/administrator');
    }
}

/**
 * Testa il matching di un nome birrificio contro il database
 * Applica la stessa logica usata dall'AI per risolvere ambiguità
 */
async function testBreweryMatching(req, res) {
    try {
        const { breweryName, breweryWebsite, breweryEmail, breweryLegalAddress } = req.body;

        if (!breweryName || breweryName.trim() === '') {
            return res.status(400).json({
                success: false,
                error: 'Nome birrificio richiesto'
            });
        }

        logger.info('[testBreweryMatching] Test matching avviato', {
            searchName: breweryName,
            hasWebsite: !!breweryWebsite,
            hasEmail: !!breweryEmail,
            hasAddress: !!breweryLegalAddress,
            userId: req.user?._id
        });

        // Carica tutti i birrifici dal database
        const allBreweries = await Brewery.find({}).lean();

        // Simula i dati che arriverebbero dall'AI
        const mockBreweryData = {
            breweryName: breweryName.trim(),
            breweryWebsite: breweryWebsite || null,
            breweryEmail: breweryEmail || null,
            breweryLegalAddress: breweryLegalAddress || null
        };

        // Applica la stessa logica usata nell'AI per trovare match
        const matchingResult = await AIService.findMatchingBrewery(
            breweryName.trim(), 
            mockBreweryData, 
            allBreweries
        );

        logger.info('[testBreweryMatching] Risultato matching', {
            searchName: breweryName,
            foundMatch: !!matchingResult.match,
            matchType: matchingResult.match?.matchType,
            confidence: matchingResult.match?.confidence,
            hasAmbiguities: matchingResult.needsDisambiguation,
            ambiguitiesCount: matchingResult.ambiguities?.length || 0
        });

        // Prepara la risposta con informazioni dettagliate
        const response = {
            success: true,
            searchData: {
                breweryName: breweryName.trim(),
                breweryWebsite,
                breweryEmail,
                breweryLegalAddress
            },
            result: {
                match: matchingResult.match ? {
                    id: matchingResult.match._id,
                    name: matchingResult.match.breweryName,
                    website: matchingResult.match.breweryWebsite,
                    email: matchingResult.match.breweryEmail,
                    address: matchingResult.match.breweryLegalAddress,
                    matchType: matchingResult.match.matchType,
                    confidence: matchingResult.match.confidence,
                    similarity: matchingResult.match.similarity
                } : null,
                needsDisambiguation: matchingResult.needsDisambiguation,
                ambiguities: (matchingResult.ambiguities || []).map(amb => ({
                    id: amb._id,
                    name: amb.breweryName,
                    website: amb.breweryWebsite,
                    email: amb.breweryEmail,
                    address: amb.breweryLegalAddress,
                    matchType: amb.matchType,
                    confidence: amb.confidence,
                    similarity: amb.similarity,
                    keywordMatch: amb.keywordMatch
                })),
                totalBreweriesInDB: allBreweries.length,
                timestamp: new Date().toISOString()
            }
        };

        res.json(response);

    } catch (error) {
        logger.error('[testBreweryMatching] Errore durante il test:', {
            error: error.message,
            stack: error.stack,
            breweryName: req.body.breweryName
        });

        res.status(500).json({
            success: false,
            error: 'Errore interno durante il test di matching',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
}

// ============================================
// SISTEMA DASHBOARD RECENSIONI ADMIN
// Implementato: 29 Dicembre 2025
// ============================================

/**
 * Dashboard principale per la gestione delle recensioni
 * GET /administrator/reviews
 */
async function getReviewsDashboard(req, res) {
    try {
        logger.info('[getReviewsDashboard] Caricamento dashboard recensioni');
        
        // Parametri di paginazione e filtro
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;
        
        // Parametri di filtro
        const filter = req.query.filter || 'all';  // Filtro dalla dashboard stat boxes
        const statusFilter = req.query.status || '';
        const processingStatusFilter = req.query.processingStatus || '';
        const visibilityFilter = req.query.visibility || '';
        const searchQuery = req.query.search || '';
        const sortField = req.query.sortField || 'createdAt';
        const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;
        
        // Costruisci query di filtro
        let filterQuery = {};
        
        // Pre-fetch utenti bannati per filtro (se necessario)
        let bannedUserIdsForFilter = [];
        if (filter === 'banned_users') {
            const bannedUsersForFilter = await User.find({ isBanned: true }).select('_id');
            bannedUserIdsForFilter = bannedUsersForFilter.map(u => u._id);
        }
        
        // Gestione filtro da stat boxes
        if (filter && filter !== 'all') {
            switch(filter) {
                case 'pending':
                    filterQuery.status = 'pending';
                    break;
                case 'validated':
                    filterQuery.status = 'validated';
                    break;
                case 'completed':
                    filterQuery.status = 'completed';
                    break;
                case 'hidden':
                    filterQuery['moderation.isHidden'] = true;
                    break;
                case 'needs_admin_review':
                case 'needs_admin':
                    filterQuery.processingStatus = 'needs_admin_review';
                    break;
                case 'flagged':
                    filterQuery['moderation.flagged'] = true;
                    break;
                case 'banned_users':
                    // Filtra recensioni di utenti bannati
                    filterQuery.user = { $in: bannedUserIdsForFilter };
                    break;
            }
        }
        
        // Filtri aggiuntivi per query string dirette
        if (statusFilter) {
            // Gestione speciale per filtri che non sono status diretti
            switch(statusFilter) {
                case 'hidden':
                    filterQuery['moderation.isHidden'] = true;
                    break;
                case 'flagged':
                    filterQuery['moderation.flagged'] = true;
                    break;
                case 'needs_admin':
                case 'needs_admin_review':
                    filterQuery.processingStatus = 'needs_admin_review';
                    break;
                case 'banned_users':
                    // Pre-fetch utenti bannati se non già fatto
                    if (bannedUserIdsForFilter.length === 0) {
                        const bannedUsersForStatus = await User.find({ isBanned: true }).select('_id');
                        bannedUserIdsForFilter = bannedUsersForStatus.map(u => u._id);
                    }
                    filterQuery.user = { $in: bannedUserIdsForFilter };
                    break;
                default:
                    // Status standard: pending, validated, completed
                    filterQuery.status = statusFilter;
            }
        }
        
        if (processingStatusFilter) {
            filterQuery.processingStatus = processingStatusFilter;
        }
        
        if (visibilityFilter === 'hidden') {
            filterQuery['moderation.isHidden'] = true;
        } else if (visibilityFilter === 'visible') {
            filterQuery['moderation.isHidden'] = { $ne: true };
        }
        
        // Trova utenti bannati per conteggio statistiche
        const bannedUsers = await User.find({ isBanned: true }).select('_id');
        const bannedUserIds = bannedUsers.map(u => u._id);
        
        // Calcola statistiche (moderazione + AI processing)
        const [
            totalReviews,
            pendingReviews,
            validatedReviews,
            completedReviews,
            hiddenReviews,
            flaggedReviews,
            needsAdminReviews,
            bannedUsersReviews, // Recensioni di utenti bannati
            // Statistiche AI Processing
            aiPendingReviews,
            aiProcessingReviews,
            aiCompletedReviews,
            aiFailedReviews
        ] = await Promise.all([
            Review.countDocuments({}),
            Review.countDocuments({ status: 'pending' }),
            Review.countDocuments({ status: 'validated' }),
            Review.countDocuments({ status: 'completed' }),
            Review.countDocuments({ 'moderation.isHidden': true }),
            Review.countDocuments({ 'moderation.flagged': true }),
            Review.countDocuments({ processingStatus: 'needs_admin_review' }),
            Review.countDocuments({ user: { $in: bannedUserIds } }), // Recensioni utenti bannati
            // AI Processing counts
            Review.countDocuments({ processingStatus: 'pending_validation' }),
            Review.countDocuments({ processingStatus: 'processing' }),
            Review.countDocuments({ processingStatus: 'completed' }),
            Review.countDocuments({ processingStatus: 'failed' })
        ]);
        
        // Query principale con popolazione
        let reviewsQuery = Review.find(filterQuery)
            .populate({
                path: 'user',
                select: 'username email isBanned customerDetails.customerName customerDetails.customerSurname'
            })
            .populate({
                path: 'ratings.beer',
                select: 'beerName beerType alcoholContent'
            })
            .populate({
                path: 'ratings.brewery',
                select: 'breweryName breweryLegalAddress'
            })
            .sort({ [sortField]: sortOrder })
            .skip(skip)
            .limit(limit);
        
        // Applica ricerca testuale se presente
        if (searchQuery) {
            // Prima cerca utenti che matchano (username, email, nome, cognome)
            const matchingUsers = await User.find({
                $or: [
                    { username: { $regex: searchQuery, $options: 'i' } },
                    { email: { $regex: searchQuery, $options: 'i' } },
                    { 'customerDetails.customerName': { $regex: searchQuery, $options: 'i' } },
                    { 'customerDetails.customerSurname': { $regex: searchQuery, $options: 'i' } }
                ]
            }).select('_id');
            
            const userIds = matchingUsers.map(u => u._id);
            
            // Cerca anche birre che matchano
            const matchingBeers = await Beer.find({
                beerName: { $regex: searchQuery, $options: 'i' }
            }).select('_id');
            
            const beerIds = matchingBeers.map(b => b._id);
            
            // Cerca anche birrifici che matchano
            const matchingBreweries = await Brewery.find({
                breweryName: { $regex: searchQuery, $options: 'i' }
            }).select('_id');
            
            const breweryIds = matchingBreweries.map(br => br._id);
            
            filterQuery.$or = [
                { user: { $in: userIds } },
                { 'ratings.beer': { $in: beerIds } },
                { 'ratings.brewery': { $in: breweryIds } },
                { 'reviewNotes': { $regex: searchQuery, $options: 'i' } }
            ];
            
            // Riapplica la query con il filtro di ricerca
            reviewsQuery = Review.find(filterQuery)
                .populate({
                    path: 'user',
                    select: 'username email isBanned customerDetails.customerName customerDetails.customerSurname'
                })
                .populate({
                    path: 'ratings.beer',
                    select: 'beerName beerType alcoholContent'
                })
                .populate({
                    path: 'ratings.brewery',
                    select: 'breweryName breweryLegalAddress'
                })
                .sort({ [sortField]: sortOrder })
                .skip(skip)
                .limit(limit);
        }
        
        const reviews = await reviewsQuery;
        const totalFiltered = await Review.countDocuments(filterQuery);
        const totalPages = Math.ceil(totalFiltered / limit);
        
        logger.info('[getReviewsDashboard] Dashboard caricata', {
            totalReviews,
            filteredReviews: totalFiltered,
            page,
            totalPages
        });
        
        res.render('admin/reviews', {
            title: 'Gestione Recensioni - Admin',
            reviews,
            stats: {
                total: totalReviews,
                pending: pendingReviews,
                validated: validatedReviews,
                completed: completedReviews,
                hidden: hiddenReviews,
                flagged: flaggedReviews,
                needsAdmin: needsAdminReviews,
                bannedUsers: bannedUsersReviews,
                // AI Processing stats
                aiPending: aiPendingReviews,
                aiProcessing: aiProcessingReviews,
                aiCompleted: aiCompletedReviews,
                aiFailed: aiFailedReviews
            },
            pagination: {
                currentPage: page,
                totalPages,
                totalItems: totalFiltered,
                limit,
                hasNext: page < totalPages,
                hasPrev: page > 1
            },
            filters: {
                filter: filter,  // Filtro attivo dalla stat box
                status: statusFilter,
                processingStatus: processingStatusFilter,
                visibility: visibilityFilter,
                search: searchQuery,
                sortField,
                sortOrder: sortOrder === 1 ? 'asc' : 'desc'
            },
            user: req.user,
            activeRole: req.session?.activeRole || 'administrator'
        });
        
    } catch (error) {
        logger.error('[getReviewsDashboard] Errore:', {
            error: error.message,
            stack: error.stack
        });
        
        req.flash('error', 'Errore nel caricamento della dashboard recensioni');
        res.redirect('/administrator');
    }
}

/**
 * Ottieni dettagli completi di una recensione
 * GET /administrator/api/reviews/:id
 */
async function getReviewDetails(req, res) {
    try {
        const reviewId = req.params.id;
        
        if (!mongoose.Types.ObjectId.isValid(reviewId)) {
            return res.status(400).json({
                success: false,
                error: 'ID recensione non valido'
            });
        }
        
        const review = await Review.findById(reviewId)
            .populate({
                path: 'user',
                select: 'username email isBanned banInfo customerDetails createdAt'
            })
            .populate({
                path: 'ratings.beer',
                select: 'beerName beerType alcoholContent description ingredients'
            })
            .populate({
                path: 'ratings.brewery',
                select: 'breweryName breweryLegalAddress breweryWebsite breweryEmail'
            });
        
        if (!review) {
            return res.status(404).json({
                success: false,
                error: 'Recensione non trovata'
            });
        }
        
        logger.info('[getReviewDetails] Dettagli recensione recuperati', {
            reviewId,
            userId: review.user?._id
        });
        
        res.json({
            success: true,
            review: {
                _id: review._id,
                user: review.user,
                ratings: review.ratings,
                reviewNotes: review.reviewNotes,
                imageUrl: extractImageFromReview(review),
                status: review.status,
                processingStatus: review.processingStatus,
                adminReviewReason: review.adminReviewReason,
                moderation: review.moderation,
                aiAnalysis: review.aiAnalysis,
                metadata: review.metadata,
                createdAt: review.createdAt,
                updatedAt: review.updatedAt
            }
        });
        
    } catch (error) {
        logger.error('[getReviewDetails] Errore:', {
            error: error.message,
            reviewId: req.params.id
        });
        
        res.status(500).json({
            success: false,
            error: 'Errore nel recupero dei dettagli della recensione'
        });
    }
}

/**
 * Mostra/Nascondi una recensione
 * POST /administrator/api/reviews/:id/visibility
 */
async function toggleReviewVisibility(req, res) {
    try {
        const reviewId = req.params.id;
        const { isHidden, reason } = req.body;
        
        if (!mongoose.Types.ObjectId.isValid(reviewId)) {
            return res.status(400).json({
                success: false,
                error: 'ID recensione non valido'
            });
        }
        
        const review = await Review.findById(reviewId);
        
        if (!review) {
            return res.status(404).json({
                success: false,
                error: 'Recensione non trovata'
            });
        }
        
        // Inizializza moderation se non esiste
        if (!review.moderation) {
            review.moderation = {};
        }
        
        // Inizializza moderationHistory se non esiste
        if (!review.moderation.moderationHistory) {
            review.moderation.moderationHistory = [];
        }
        
        const previousState = review.moderation.isHidden || false;
        
        // Se isHidden non è specificato nel body, fai il toggle automatico
        const newHiddenState = (isHidden !== undefined) ? isHidden : !previousState;
        const action = newHiddenState ? 'hidden' : 'unhidden';
        
        // Aggiorna stato visibilità (solo moderation.isHidden - unica fonte di verità)
        review.moderation.isHidden = newHiddenState;
        review.moderation.moderatedBy = req.user._id;
        review.moderation.moderatedAt = new Date();
        review.moderation.moderationReason = reason || '';
        
        // Aggiungi alla cronologia
        review.moderation.moderationHistory.push({
            action: action,
            performedBy: req.user._id,
            performedAt: new Date(),
            reason: reason || '',
            previousValue: previousState ? 'hidden' : 'visible',
            newValue: newHiddenState ? 'hidden' : 'visible'
        });
        
        await review.save();
        
        logger.info('[toggleReviewVisibility] Visibilità recensione aggiornata', {
            reviewId,
            newHiddenState,
            action,
            moderatedBy: req.user._id
        });
        
        res.json({
            success: true,
            message: newHiddenState ? 'Recensione nascosta con successo' : 'Recensione resa visibile',
            review: {
                _id: review._id,
                moderation: review.moderation
            }
        });
        
    } catch (error) {
        logger.error('[toggleReviewVisibility] Errore:', {
            error: error.message,
            reviewId: req.params.id
        });
        
        res.status(500).json({
            success: false,
            error: 'Errore nell\'aggiornamento della visibilità'
        });
    }
}

/**
 * Aggiorna lo stato di una recensione
 * POST /administrator/api/reviews/:id/status
 */
async function updateReviewStatus(req, res) {
    try {
        const reviewId = req.params.id;
        const { status, processingStatus, reason } = req.body;
        
        if (!mongoose.Types.ObjectId.isValid(reviewId)) {
            return res.status(400).json({
                success: false,
                error: 'ID recensione non valido'
            });
        }
        
        const review = await Review.findById(reviewId);
        
        if (!review) {
            return res.status(404).json({
                success: false,
                error: 'Recensione non trovata'
            });
        }
        
        // Valida status se fornito
        const validStatuses = ['pending', 'validated', 'completed'];
        if (status && !validStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                error: `Status non valido. Valori ammessi: ${validStatuses.join(', ')}`
            });
        }
        
        // Valida processingStatus se fornito
        const validProcessingStatuses = ['pending_validation', 'processing', 'completed', 'failed', 'needs_admin_review'];
        if (processingStatus && !validProcessingStatuses.includes(processingStatus)) {
            return res.status(400).json({
                success: false,
                error: `Processing status non valido. Valori ammessi: ${validProcessingStatuses.join(', ')}`
            });
        }
        
        // Inizializza moderation se non esiste
        if (!review.moderation) {
            review.moderation = {};
        }
        
        if (!review.moderation.moderationHistory) {
            review.moderation.moderationHistory = [];
        }
        
        const changes = [];
        
        // Aggiorna status se fornito
        if (status && status !== review.status) {
            const previousStatus = review.status;
            review.status = status;
            changes.push(`status: ${previousStatus} → ${status}`);
            
            review.moderation.moderationHistory.push({
                action: 'status_changed',
                performedBy: req.user._id,
                performedAt: new Date(),
                reason: reason || '',
                previousValue: previousStatus,
                newValue: status
            });
        }
        
        // Aggiorna processingStatus se fornito
        if (processingStatus && processingStatus !== review.processingStatus) {
            const previousProcessingStatus = review.processingStatus;
            review.processingStatus = processingStatus;
            changes.push(`processingStatus: ${previousProcessingStatus} → ${processingStatus}`);
            
            // Se risolto da needs_admin_review, pulisci il motivo
            if (previousProcessingStatus === 'needs_admin_review' && processingStatus !== 'needs_admin_review') {
                review.adminReviewReason = '';
            }
        }
        
        if (changes.length === 0) {
            return res.json({
                success: true,
                message: 'Nessuna modifica applicata',
                review: {
                    _id: review._id,
                    status: review.status,
                    processingStatus: review.processingStatus
                }
            });
        }
        
        review.moderation.moderatedBy = req.user._id;
        review.moderation.moderatedAt = new Date();
        
        await review.save();
        
        logger.info('[updateReviewStatus] Stato recensione aggiornato', {
            reviewId,
            changes,
            moderatedBy: req.user._id
        });
        
        res.json({
            success: true,
            message: `Recensione aggiornata: ${changes.join(', ')}`,
            review: {
                _id: review._id,
                status: review.status,
                processingStatus: review.processingStatus,
                moderation: review.moderation
            }
        });
        
    } catch (error) {
        logger.error('[updateReviewStatus] Errore:', {
            error: error.message,
            reviewId: req.params.id
        });
        
        res.status(500).json({
            success: false,
            error: 'Errore nell\'aggiornamento dello stato della recensione'
        });
    }
}

/**
 * Elimina una recensione
 * DELETE /administrator/api/reviews/:id
 */
async function deleteReview(req, res) {
    try {
        const reviewId = req.params.id;
        
        if (!mongoose.Types.ObjectId.isValid(reviewId)) {
            return res.status(400).json({
                success: false,
                error: 'ID recensione non valido'
            });
        }
        
        const review = await Review.findById(reviewId)
            .populate('user', 'username')
            .populate('ratings.beer', 'beerName');
        
        if (!review) {
            return res.status(404).json({
                success: false,
                error: 'Recensione non trovata'
            });
        }
        
        // Log dettagliato prima dell'eliminazione
        logger.warn('[deleteReview] Eliminazione recensione', {
            reviewId,
            userId: review.user?._id,
            username: review.user?.username,
            beerName: review.ratings?.[0]?.beer?.beerName,
            deletedBy: req.user._id
        });
        
        await Review.findByIdAndDelete(reviewId);
        
        res.json({
            success: true,
            message: 'Recensione eliminata con successo',
            deletedReview: {
                _id: reviewId,
                username: review.user?.username,
                beerName: review.ratings?.[0]?.beer?.beerName
            }
        });
        
    } catch (error) {
        logger.error('[deleteReview] Errore:', {
            error: error.message,
            reviewId: req.params.id
        });
        
        res.status(500).json({
            success: false,
            error: 'Errore nell\'eliminazione della recensione'
        });
    }
}

/**
 * Banna un utente
 * POST /administrator/api/users/:id/ban
 */
async function banUser(req, res) {
    try {
        const userId = req.params.id;
        const { reason, duration, hideReviews } = req.body;
        
        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({
                success: false,
                error: 'ID utente non valido'
            });
        }
        
        // Non permettere di bannare se stessi
        if (userId === req.user._id.toString()) {
            return res.status(400).json({
                success: false,
                error: 'Non puoi bannare te stesso'
            });
        }
        
        const user = await User.findById(userId);
        
        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'Utente non trovato'
            });
        }
        
        // Non permettere di bannare altri admin
        if (user.role && user.role.includes('administrator')) {
            return res.status(403).json({
                success: false,
                error: 'Non puoi bannare un amministratore'
            });
        }
        
        // Calcola data di scadenza ban (se specificata durata)
        let banExpires = null;
        if (duration && duration !== 'permanent') {
            const durationMap = {
                '1d': 1,
                '3d': 3,
                '7d': 7,
                '30d': 30,
                '90d': 90
            };
            const days = durationMap[duration];
            if (days) {
                banExpires = new Date();
                banExpires.setDate(banExpires.getDate() + days);
            }
        }
        
        // Inizializza banInfo se non esiste
        if (!user.banInfo) {
            user.banInfo = { banHistory: [] };
        }
        
        if (!user.banInfo.banHistory) {
            user.banInfo.banHistory = [];
        }
        
        // Aggiorna stato ban
        user.isBanned = true;
        user.banInfo.bannedAt = new Date();
        user.banInfo.bannedBy = req.user._id;
        user.banInfo.banReason = reason || 'Violazione regole piattaforma';
        user.banInfo.banExpires = banExpires;
        
        // Aggiungi alla cronologia
        user.banInfo.banHistory.push({
            action: 'banned',
            performedBy: req.user._id,
            performedAt: new Date(),
            reason: reason || 'Violazione regole piattaforma',
            duration: duration || 'permanent',
            expiresAt: banExpires
        });
        
        await user.save();
        
        // Se richiesto, nascondi anche tutte le recensioni dell'utente
        let hiddenReviewsCount = 0;
        if (hideReviews) {
            const result = await Review.updateMany(
                { user: userId },
                {
                    $set: {
                        'moderation.isHidden': true,
                        'moderation.moderatedBy': req.user._id,
                        'moderation.moderatedAt': new Date(),
                        'moderation.moderationReason': `Utente bannato: ${reason || 'Violazione regole'}`,
                        // IMPORTANTE: Sincronizza con campo root per filtro rotte pubbliche
                        'isHidden': true
                    },
                    $push: {
                        'moderation.moderationHistory': {
                            action: 'hidden',
                            performedBy: req.user._id,
                            performedAt: new Date(),
                            reason: `Auto-nascosto per ban utente: ${reason || 'Violazione regole'}`,
                            previousValue: 'visible',
                            newValue: 'hidden'
                        }
                    }
                }
            );
            hiddenReviewsCount = result.modifiedCount;
        }
        
        logger.warn('[banUser] Utente bannato', {
            userId,
            username: user.username,
            reason,
            duration: duration || 'permanent',
            banExpires,
            hiddenReviews: hiddenReviewsCount,
            bannedBy: req.user._id
        });
        
        res.json({
            success: true,
            message: `Utente ${user.username} bannato con successo`,
            user: {
                _id: user._id,
                username: user.username,
                isBanned: user.isBanned,
                banInfo: user.banInfo
            },
            hiddenReviewsCount
        });
        
    } catch (error) {
        logger.error('[banUser] Errore:', {
            error: error.message,
            userId: req.params.id
        });
        
        res.status(500).json({
            success: false,
            error: 'Errore nel ban dell\'utente'
        });
    }
}

/**
 * Rimuovi ban da un utente
 * POST /administrator/api/users/:id/unban
 */
async function unbanUser(req, res) {
    try {
        const userId = req.params.id;
        const { reason, unhideReviews } = req.body;
        
        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({
                success: false,
                error: 'ID utente non valido'
            });
        }
        
        const user = await User.findById(userId);
        
        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'Utente non trovato'
            });
        }
        
        if (!user.isBanned) {
            return res.status(400).json({
                success: false,
                error: 'L\'utente non è attualmente bannato'
            });
        }
        
        // Inizializza banInfo se non esiste
        if (!user.banInfo) {
            user.banInfo = { banHistory: [] };
        }
        
        if (!user.banInfo.banHistory) {
            user.banInfo.banHistory = [];
        }
        
        // Aggiungi alla cronologia prima di resettare
        user.banInfo.banHistory.push({
            action: 'unbanned',
            performedBy: req.user._id,
            performedAt: new Date(),
            reason: reason || 'Ban rimosso',
            previousBanReason: user.banInfo.banReason,
            previousBannedAt: user.banInfo.bannedAt
        });
        
        // Rimuovi ban
        user.isBanned = false;
        user.banInfo.bannedAt = null;
        user.banInfo.bannedBy = null;
        user.banInfo.banReason = null;
        user.banInfo.banExpires = null;
        
        await user.save();
        
        // Se richiesto, rendi visibili le recensioni dell'utente
        let unhiddenReviewsCount = 0;
        if (unhideReviews) {
            const result = await Review.updateMany(
                { 
                    user: userId,
                    'moderation.isHidden': true,
                    'moderation.moderationReason': { $regex: /bannato|ban utente/i }
                },
                {
                    $set: {
                        'moderation.isHidden': false,
                        'moderation.moderatedBy': req.user._id,
                        'moderation.moderatedAt': new Date(),
                        'moderation.moderationReason': '',
                        // IMPORTANTE: Sincronizza con campo root per filtro rotte pubbliche
                        'isHidden': false
                    },
                    $push: {
                        'moderation.moderationHistory': {
                            action: 'unhidden',
                            performedBy: req.user._id,
                            performedAt: new Date(),
                            reason: `Auto-ripristinato per rimozione ban: ${reason || 'Ban rimosso'}`,
                            previousValue: 'hidden',
                            newValue: 'visible'
                        }
                    }
                }
            );
            unhiddenReviewsCount = result.modifiedCount;
        }
        
        logger.info('[unbanUser] Ban utente rimosso', {
            userId,
            username: user.username,
            reason,
            unhiddenReviews: unhiddenReviewsCount,
            unbannedBy: req.user._id
        });
        
        res.json({
            success: true,
            message: `Ban rimosso per utente ${user.username}`,
            user: {
                _id: user._id,
                username: user.username,
                isBanned: user.isBanned,
                banInfo: user.banInfo
            },
            unhiddenReviewsCount
        });
        
    } catch (error) {
        logger.error('[unbanUser] Errore:', {
            error: error.message,
            userId: req.params.id
        });
        
        res.status(500).json({
            success: false,
            error: 'Errore nella rimozione del ban'
        });
    }
}

module.exports = {
    getAllUsers,
    getUserById,
    updateUser,
    deleteUser,
    createUser,
    getAllBreweries,
    createBrewery,
    getBreweryById,
    getBreweryDetailsById,
    updateBrewery,
    deleteBrewery,
    getAdministratorById,
    updateAdministrator,
    deleteAdministrator,
    addRoleToUser,
    removeRoleFromUser,
    // Nuovi metodi per statistiche
    getStatisticsDashboard,
    getBreweriesStatsAPI,
    getBreweryStatisticsDetail,
    // FASE 2: Brewery Dashboard Unificato
    getBreweryDashboard,
    // Sistema Test Matching Birrifici
    getBreweryMatchingTest,
    testBreweryMatching,
    // Sistema Dashboard Recensioni Admin
    getReviewsDashboard,
    getReviewDetails,
    toggleReviewVisibility,
    updateReviewStatus,
    deleteReview,
    banUser,
    unbanUser
};