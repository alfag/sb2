const User = require('../models/User');
const Administrator = require('../models/Administrator');
const Brewery = require('../models/Brewery');
const Beer = require('../models/Beer');
const Review = require('../models/Review');
const ReviewService = require('../services/reviewService');
const mongoose = require('mongoose');
const logWithFileName = require('../utils/logger'); // Importa logWithFileName
const bcrypt = require('bcrypt');

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
            { $match: { count: { $gte: 2 } } }, // Solo tipi con almeno 2 recensioni
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

// Inizializza il gestore delle statistiche quando il DOM è pronto
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Inizializzazione StatisticsManager...');
    try {
        window.statisticsManager = new StatisticsManager();
        console.log('✅ StatisticsManager inizializzato con successo');
    } catch (error) {
        console.error('❌ Errore nell\\'inizializzazione StatisticsManager:', error);
    }
});`;
            
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
                ...breweriesStats.summary,
                totalUsers,
                totalBeers: totalBeers,
                totalReviews: totalReviews,
                totalBreweriesInDB // Aggiungiamo il totale assoluto dei birrifici
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

        res.render('admin/breweryStatistics', {
            title: `Statistiche ${brewery.breweryName}`,
            user: req.user,
            message: req.flash(),
            brewery: brewery.toObject(),
            stats: breweryStats,
            beersWithStats,
            timeline: reviewTimeline
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
    getBreweryStatisticsDetail
};