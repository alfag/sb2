const winston = require('winston');
const path = require('path');

/**
 * Livelli di log di Winston:
 * 
 * error:   Indica un errore grave che ha causato il fallimento dell'applicazione o di una parte critica di essa.
 * warn:    Indica un problema che potrebbe causare errori in futuro o che richiede attenzione.
 * info:    Indica informazioni generali sull'esecuzione dell'applicazione, come l'avvio del server o l'accesso di un utente.
 * http:    Indica informazioni dettagliate sulle richieste HTTP, come i metodi, gli URL e i codici di stato.
 * verbose: Indica informazioni dettagliate sull'esecuzione dell'applicazione, utili per il debug.
 * debug:   Indica informazioni di debug dettagliate, utili per tracciare il flusso dell'applicazione e identificare problemi.
 * silly:   Indica informazioni estremamente dettagliate, generalmente non necessarie per la maggior parte degli scenari.
 */

const logger = winston.createLogger({
  level: 'debug',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
      // Gestisce oggetti complessi e metadati aggiuntivi
      let logMessage = `${timestamp} [${level.toUpperCase()}]: ${message}`;
      
      // Se ci sono metadati aggiuntivi, li aggiungiamo al messaggio
      if (Object.keys(meta).length > 0) {
        const metaString = JSON.stringify(meta, null, 2);
        logMessage += ` ${metaString}`;
      }
      
      return logMessage;
    })
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/app.log' })
  ]
});

function logWithFileName(fileName) {
  const baseFileName = path.basename(fileName);
  
  return {
    debug: (message, meta = {}) => {
      if (typeof meta === 'object' && meta !== null) {
        logger.debug(`[${baseFileName}] ${message}`, meta);
      } else if (meta !== undefined) {
        logger.debug(`[${baseFileName}] ${message} ${meta}`);
      } else {
        logger.debug(`[${baseFileName}] ${message}`);
      }
    },
    verbose: (message, meta = {}) => {
      if (typeof meta === 'object' && meta !== null) {
        logger.verbose(`[${baseFileName}] ${message}`, meta);
      } else if (meta !== undefined) {
        logger.verbose(`[${baseFileName}] ${message} ${meta}`);
      } else {
        logger.verbose(`[${baseFileName}] ${message}`);
      }
    },
    http: (message, meta = {}) => {
      if (typeof meta === 'object' && meta !== null) {
        logger.http(`[${baseFileName}] ${message}`, meta);
      } else if (meta !== undefined) {
        logger.http(`[${baseFileName}] ${message} ${meta}`);
      } else {
        logger.http(`[${baseFileName}] ${message}`);
      }
    },
    info: (message, meta = {}) => {
      if (typeof meta === 'object' && meta !== null) {
        logger.info(`[${baseFileName}] ${message}`, meta);
      } else if (meta !== undefined) {
        logger.info(`[${baseFileName}] ${message} ${meta}`);
      } else {
        logger.info(`[${baseFileName}] ${message}`);
      }
    },
    warn: (message, meta = {}) => {
      if (typeof meta === 'object' && meta !== null) {
        logger.warn(`[${baseFileName}] ${message}`, meta);
      } else if (meta !== undefined) {
        logger.warn(`[${baseFileName}] ${message} ${meta}`);
      } else {
        logger.warn(`[${baseFileName}] ${message}`);
      }
    },
    error: (message, meta = {}) => {
      if (typeof meta === 'object' && meta !== null) {
        logger.error(`[${baseFileName}] ${message}`, meta);
      } else if (meta !== undefined) {
        logger.error(`[${baseFileName}] ${message} ${meta}`);
      } else {
        logger.error(`[${baseFileName}] ${message}`);
      }
    }
  };
}

module.exports = logWithFileName;