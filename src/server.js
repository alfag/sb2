const express = require('express');
const config = require('../config/config');
const db = require('../config/db');
const app = require('./app');
const logWithFileName = require('./utils/logger');

const logger = logWithFileName(__filename);

// ==================================================
// ASYNC QUEUE SYSTEM - Bull+Redis
// ==================================================
const { startWorker } = require('./workers/reviewWorker');
const queueService = require('./services/queueService');
const { setupBullBoard } = require('./config/bullBoard');

// Setup Bull Board Dashboard per admin
setupBullBoard(app);
logger.info('🎯 Bull Board dashboard configurata su /administrator/queues');

// Avvia worker per processing asincrono recensioni
// Concurrency: 5 job in parallelo (configura secondo risorse server)
const WORKER_CONCURRENCY = parseInt(process.env.WORKER_CONCURRENCY) || 5;
startWorker(WORKER_CONCURRENCY);
logger.info(`🚀 Worker recensioni avviato con concorrenza ${WORKER_CONCURRENCY}`);

// ==================================================
// SERVER STARTUP
// ==================================================
const PORT = process.env.PORT || 8080;

const os = require('os');
const server = app.listen(PORT, '0.0.0.0', () => {
    logger.info(`Il server è in esecuzione sulla porta ${PORT}`);
    const ifaces = os.networkInterfaces();
    Object.keys(ifaces).forEach((ifname) => {
        ifaces[ifname].forEach((iface) => {
            if (iface.family === 'IPv4' && !iface.internal) {
                logger.info(`Accessibile da rete locale: http://${iface.address}:${PORT}`);
            }
        });
    });
});

// ==================================================
// GRACEFUL SHUTDOWN
// ==================================================
const gracefulShutdown = async (signal) => {
    logger.info(`\n${signal} ricevuto, chiusura graceful in corso...`);
    
    // Chiudi server HTTP
    server.close(async () => {
        logger.info('Server HTTP chiuso');
        
        try {
            // Chiudi coda Bull
            await queueService.closeQueue();
            logger.info('Coda Bull chiusa');
            
            // Chiudi connessione MongoDB
            await db.connection.close();
            logger.info('Connessione MongoDB chiusa');
            
            logger.info('Shutdown completato con successo');
            process.exit(0);
        } catch (error) {
            logger.error('Errore durante shutdown:', error);
            process.exit(1);
        }
    });
    
    // Forza chiusura dopo 30 secondi
    setTimeout(() => {
        logger.error('Shutdown forzato dopo 30 secondi');
        process.exit(1);
    }, 30000);
};

// Gestisci segnali di terminazione
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Gestisci errori non catturati
process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception:', error);
    gracefulShutdown('UNCAUGHT_EXCEPTION');
});