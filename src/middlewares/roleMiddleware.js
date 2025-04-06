const User = require('../models/User'); // Importa il modello User
const passport = require('../../config/passport');

// Middleware per determinare il ruolo dell'utente
const roleMiddleware = (requiredRole) => {
    return (req, res, next) => {
        // Usa Passport per verificare l'utente autenticato
        passport.authenticate('session', (err, user, info) => {
            if (err) {
                console.error('Errore durante l\'autenticazione:', err);
                return res.status(500).send('Errore del server');
            }

            if (!user) {
                return res.render('index.njk'); // Utente non autenticato
            }

            // Verifica se l'utente ha il ruolo richiesto
            if (user.role !== requiredRole) {
                return res.status(403).send('Ruolo utente non ammesso. Accesso negato'); // Ruolo non autorizzato
            }

            // Aggiungi l'utente alla richiesta
            req.user = user;
            next();
        })(req, res, next);
    };
};

module.exports = roleMiddleware;