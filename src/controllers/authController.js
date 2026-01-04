const User = require('../models/User');
const Administrator = require('../models/Administrator');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const passport = require('../../config/passport');
const JWT_SECRET = require('../../config/config').JWT_SECRET;
const logWithFileName = require('../utils/logger'); // Importa logWithFileName

const logger = logWithFileName(__filename); // Crea un logger con il nome del file

// Funzione helper per determinare l'URL di redirect basato sul ruolo
const getRedirectUrlByRole = (role) => {
    switch (role) {
        case 'administrator':
            return '/administrator';
        case 'brewery': 
            return '/brewery/dashboard';
        case 'customer':
        default:
            return '/'; // Home page per customer
    }
};

// Register a new user
exports.postRegister = async (req, res) => {
    // Estrai i dati dal body coerentemente con il model User e i dettagli customerDetails
    const {
        username: rawUsername,
        password,
        customerName,
        customerSurname,
        customerBillingAddress,
        customerShippingAddress,
        customerPhoneNumber,
        termsAccepted,
        newsletterSubscription
    } = req.body;

    // Task 20: Converti email/username in lowercase per evitare duplicati
    const username = rawUsername ? rawUsername.toLowerCase().trim() : '';

    try {
        // Verifica se l'utente esiste già (cerca anche in lowercase per sicurezza)
        const existingUser = await User.findOne({ username: username.toLowerCase() });
        if (existingUser) {
            logger.warn(`Tentativo di registrazione con username già esistente: ${username}`);
            return res.status(400).render('customer/registerUser.njk', {
                message: { error: 'Username già esistente.' }
            });
        }

        // RIMOSSO: const hashedPassword = await bcrypt.hash(password, 10);
        // Il middleware pre-save del modello User si occupa automaticamente dell'hash

        // Crea il nuovo utente con ruolo customer (array) e dettagli customerDetails
        // Task 21: Rimosso customerFiscalCode dalla registrazione
        const newUser = new User({
            username, // già in lowercase
            password, // Password in chiaro - verrà hashata dal middleware pre-save
            role: ['customer'],
            customerDetails: {
                customerName,
                customerSurname,
                customerAddresses: {
                    billingAddress: customerBillingAddress,
                    shippingAddress: customerShippingAddress
                },
                customerPhoneNumber,
                // Salva accettazione termini e privacy
                termsAccepted: {
                    accepted: termsAccepted === 'on' || termsAccepted === true || termsAccepted === 'true',
                    acceptedAt: new Date(),
                    version: '1.0'
                },
                // Salva consenso newsletter (opzionale)
                newsletterSubscription: {
                    subscribed: newsletterSubscription === 'on' || newsletterSubscription === true || newsletterSubscription === 'true',
                    subscribedAt: (newsletterSubscription === 'on' || newsletterSubscription === true || newsletterSubscription === 'true') ? new Date() : null
                }
            }
        });

        await newUser.save();
        logger.info(`Utente customer registrato con successo: ${username}`);

        // Task 22: Auto-login dopo registrazione
        req.logIn(newUser, (loginErr) => {
            if (loginErr) {
                logger.error(`Errore durante auto-login dopo registrazione: ${loginErr.message}`);
                // Fallback: redirect alla pagina di login
                return res.status(201).render('authViews/login.njk', {
                    message: { info: 'Registrazione avvenuta con successo. Ora puoi effettuare il login.' }
                });
            }
            
            // Imposta il ruolo attivo in sessione
            req.session.activeRole = 'customer';
            
            // Redirect alla welcome page con messaggio di benvenuto
            req.flash('success', `Benvenuto/a ${customerName || 'su SharingBeer'}! La tua registrazione è avvenuta con successo.`);
            logger.info(`Auto-login completato per utente: ${username}`);
            return res.redirect('/');
        });
    } catch (error) {
        logger.error(`Errore durante la registrazione: ${error.message}`);
        res.status(500).render('customer/registerUser.njk', {
            message: { error: 'Errore durante la registrazione. Riprova.' }
        });
    }
};

// Funzione per la renderizzazione della pagina di login
exports.getLogin = (req, res) => {
    logger.info('Renderizzazione della pagina di login');
    res.render('authViews/login.njk');
};

// Funzione per la gestione del post del login
const renderView = (req, res, view, options) => {
    res.render(view, {
        ...options,
        message: { info: req.flash('info') }
    });
};

exports.postLogin = (req, res, next) => {
    passport.authenticate('local', (err, user, info) => {
        if (err) { return next(err); }
        if (!user) {
            req.flash('error', info.message);
            return res.redirect('/login');
        }

        let populatedUser = user;

        // Scegli il ruolo principale per la sessione (priorità: administrator, brewery, customer)
        let mainRole = 'customer';
        if (user.role.includes('administrator')) mainRole = 'administrator';
        else if (user.role.includes('brewery')) mainRole = 'brewery';

        user.mainRole = mainRole; // aggiungi mainRole all'oggetto utente per le view

        if (user.role.includes('brewery')) {
            User.findById(user._id)
                .populate('breweryDetails')
                .then(populatedUserFromDb => {
                    populatedUser = populatedUserFromDb;
                    req.logIn(populatedUser, (err) => {
                        if (err) { return next(err); }
                        
                        // Se l'utente si è autenticato, significa che ha già accettato il disclaimer
                        // in precedenza nella sessione, quindi lo impostiamo automaticamente
                        req.session.disclaimerAccepted = true;
                        
                        logger.info(`${user.role} - Utente ${populatedUser.username} loggato con successo`);
                        req.flash('info', 'Login effettuato con successo');
                        
                        // NUOVO: Redirect automatico alla home di ruolo basato su mainRole calcolato
                        const redirectUrl = getRedirectUrlByRole(mainRole);
                        logger.info(`Login redirect per ruolo ${mainRole}: ${redirectUrl}`);
                        return res.redirect(redirectUrl);
                    });
                })
                .catch(err => {
                    return next(err);
                });
        } else if (user.role.includes('administrator')) {
            User.findById(user._id)
                .populate('administratorDetails')
                .then(populatedUserFromDb => {
                    populatedUser = populatedUserFromDb;
                    req.logIn(populatedUser, (err) => {
                        if (err) { return next(err); }
                        
                        // Se l'utente si è autenticato, significa che ha già accettato il disclaimer
                        // in precedenza nella sessione, quindi lo impostiamo automaticamente
                        req.session.disclaimerAccepted = true;
                        
                        logger.info(`${user.role} - Utente ${populatedUser.username} loggato con successo`);
                        req.flash('info', 'Login effettuato con successo');
                        
                        // NUOVO: Redirect automatico alla home di ruolo basato su mainRole calcolato  
                        const redirectUrl = getRedirectUrlByRole(mainRole);
                        logger.info(`Login redirect per ruolo ${mainRole}: ${redirectUrl}`);
                        return res.redirect(redirectUrl);
                    });
                })
                .catch(err => {
                    return next(err);
                });
        } else {
            req.logIn(user, (err) => {
                if (err) { return next(err); }
                
                // Se l'utente si è autenticato, significa che ha già accettato il disclaimer
                // in precedenza nella sessione, quindi lo impostiamo automaticamente
                req.session.disclaimerAccepted = true;
                
                logger.info(`${user.role} - Utente ${user.username} loggato con successo`);
                req.flash('info', 'Login effettuato con successo');
                
                // NUOVO: Redirect automatico alla home di ruolo basato su mainRole calcolato
                const redirectUrl = getRedirectUrlByRole(mainRole);
                logger.info(`Login redirect per ruolo ${mainRole}: ${redirectUrl}`);
                return res.redirect(redirectUrl);
            });
        }
    })(req, res, next);
};

// Funzione per la gestione del logout
exports.getLogout = (req, res) => {
    logger.info('Esecuzione del logout');
    req.logout(function (err) {
        if (err) { 
            logger.error('Errore durante il logout:', err);
            return res.redirect('/'); // Reindirizza anche in caso di errore
        }
        req.session.destroy(function (err) {
            if (err) {
                logger.error('Errore durante la distruzione della sessione:', err);
            }
            res.redirect('/');
        });
    });
};

exports.oauthLogin = passport.authenticate('google', {
    scope: ['profile', 'email'],
});

exports.oauthCallback = (req, res) => {
    passport.authenticate('google', { failureRedirect: '/login' }, (err, user) => {
        if (err || !user) {
            logger.error('Errore durante il login OAuth');
            req.flash('error', 'Errore durante il login OAuth');
            return res.redirect('/login');
        }

        req.login(user, (loginErr) => {
            if (loginErr) {
                logger.error('Errore durante la creazione della sessione OAuth');
                req.flash('error', 'Errore durante la creazione della sessione');
                return res.redirect('/login');
            }

            logger.info(`Utente autenticato tramite OAuth: ${user.email}`);
            res.redirect('/'); // Reindirizza alla homepage o a una pagina specifica
        });
    })(req, res);
};