// Middleware per il disclaimer della maggiore età
const logWithFileName = require('../utils/logger');
const logger = logWithFileName(__filename);

module.exports = function disclaimerMiddleware(req, res, next) {
  if (!req.session.disclaimerAccepted && req.path !== '/disclaimer' && req.path !== '/public/js/review.js') {
    res.locals.showDisclaimer = true;
    logger.info('Popup disclaimer maggiore età mostrato');
  } else {
    res.locals.showDisclaimer = false;
    //logger.info('Popup disclaimer maggiore età non necessario');
  }
  next();
};
