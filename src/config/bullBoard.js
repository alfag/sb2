/**
 * Bull Board Configuration - Dashboard Web per monitoring code
 * Accessibile solo agli amministratori
 */

const { createBullBoard } = require('@bull-board/api');
const { BullAdapter } = require('@bull-board/api/bullAdapter');
const { ExpressAdapter } = require('@bull-board/express');
const { reviewQueue } = require('../services/queueService');
const logWithFileName = require('../utils/logger');

const logger = logWithFileName(__filename);

/**
 * Setup Bull Board per Express app
 * @param {Express} app - Express app instance
 */
function setupBullBoard(app) {
  try {
    const serverAdapter = new ExpressAdapter();
    serverAdapter.setBasePath('/administrator/queues');

    createBullBoard({
      queues: [new BullAdapter(reviewQueue)],
      serverAdapter: serverAdapter,
    });

    // Mount bull-board UI - Solo per admin
    app.use('/administrator/queues', 
      // Middleware autenticazione admin (richiesto)
      (req, res, next) => {
        // Log per debug
        logger.debug('Bull Board access attempt', {
          isAuthenticated: req.isAuthenticated ? req.isAuthenticated() : false,
          hasUser: !!req.user,
          userRole: req.user?.role, // Cambiato da roles a role (campo modello User è singolare)
          sessionID: req.sessionID
        });

        // Verifica autenticazione
        if (!req.isAuthenticated || !req.isAuthenticated()) {
          logger.warn('Bull Board: utente non autenticato, redirect a login');
          return res.redirect('/auth/login');
        }
        
        // Verifica esistenza user e role (singolare - come nel modello User)
        if (!req.user || !req.user.role || !Array.isArray(req.user.role)) {
          logger.warn('Bull Board: dati utente non validi', { 
            hasUser: !!req.user, 
            hasRole: !!req.user?.role,
            userId: req.user?._id 
          });
          return res.status(403).json({ 
            error: 'Accesso negato. Dati utente non validi.' 
          });
        }
        
        // Verifica ruolo administrator
        if (!req.user.role.includes('administrator')) {
          logger.warn('Bull Board: utente non ha ruolo administrator', { 
            userId: req.user._id,
            role: req.user.role 
          });
          return res.status(403).json({ 
            error: 'Accesso negato. Solo amministratori possono accedere al dashboard code.',
            yourRole: req.user.role
          });
        }
        
        logger.info('Bull Board: accesso consentito', { userId: req.user._id });
        next();
      },
      serverAdapter.getRouter()
    );

    logger.info('✅ Bull Board dashboard configurato su /administrator/queues');

  } catch (error) {
    logger.error('❌ Errore setup Bull Board:', error);
    // Non bloccare l'app se Bull Board fallisce
  }
}

module.exports = { setupBullBoard };
