/**
 * Bull Queue Worker - Processa job dalla coda in background
 * Questo worker può girare in un processo separato o sulla stessa istanza
 */

const { reviewQueue } = require('../services/queueService');
const { processReviewBackground } = require('../services/reviewProcessingService');
const logWithFileName = require('../utils/logger');

const logger = logWithFileName(__filename);

/**
 * Configura il worker per processare i job
 * @param {Number} concurrency - Numero job simultanei (default: 5)
 */
function startWorker(concurrency = 5) {
  logger.info(`🚀 Avvio worker Bull con concurrency ${concurrency}`);

  // Definisci il processor
  reviewQueue.process('process-review', concurrency, async (job) => {
    logger.info(`▶️ Inizio processing job ${job.id}`, {
      reviewId: job.data.reviewId,
      attempt: job.attemptsMade + 1,
      maxAttempts: job.opts.attempts,
      isTest: job.data.isTest,
      bottlesCount: job.data.bottles?.length || 0
    });

    try {
      // Processa la recensione
      const result = await processReviewBackground(job);
      
      logger.info(`✅ Job ${job.id} completato`, {
        reviewId: job.data.reviewId,
        isTest: job.data.isTest,
        bottlesProcessed: result.bottlesProcessed,
        processingTime: result.processingTime
      });
      
      return result;

    } catch (error) {
      logger.error(`❌ Job ${job.id} fallito`, {
        reviewId: job.data.reviewId,
        isTest: job.data.isTest,
        error: error.message,
        stack: error.stack,
        attempt: job.attemptsMade + 1,
        willRetry: job.attemptsMade < job.opts.attempts - 1
      });

      // Rilancia errore per trigger retry di Bull
      throw error;
    }
  });

  logger.info('✅ Worker configurato e in ascolto sulla coda');

  // Gestione graceful shutdown
  process.on('SIGTERM', gracefulShutdown);
  process.on('SIGINT', gracefulShutdown);
}

/**
 * Graceful shutdown del worker
 */
async function gracefulShutdown() {
  logger.info('🛑 Ricevuto segnale shutdown, chiusura worker...');
  
  try {
    await reviewQueue.close();
    logger.info('✅ Worker chiuso correttamente');
    process.exit(0);
  } catch (error) {
    logger.error('❌ Errore durante shutdown worker:', error);
    process.exit(1);
  }
}

module.exports = {
  startWorker
};
