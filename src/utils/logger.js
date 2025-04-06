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
    winston.format.printf(({ timestamp, level, message }) => {
      return `${timestamp} [${level.toUpperCase()}]: ${message}`;
    })
  ),
  transports: [
    new winston.transports.Console(),
    //new winston.transports.File({ filename: 'combined.log' })
  ]
});

function logWithFileName(fileName) {
  return {
    debug: (message) => logger.debug(`[${path.basename(fileName)}] ${message}`),
    verbose: (message) => logger.verbose(`[${path.basename(fileName)}] ${message}`),
    http: (message) => logger.http(`[${path.basename(fileName)}] ${message}`),
    info: (message) => logger.info(`[${path.basename(fileName)}] ${message}`),
    warn: (message) => logger.warn(`[${path.basename(fileName)}] ${message}`),
    error: (message) => logger.error(`[${path.basename(fileName)}] ${message}`)
  };
}

module.exports = logWithFileName;