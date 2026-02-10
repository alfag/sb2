/**
 * Bull Queue Service - Sistema di code asincrone per processing recensioni
 * Implementazione Punto 15: Disaccoppiamento creazione recensione da processing dati
 */

const Bull = require('bull');
const logWithFileName = require('../utils/logger');

const logger = logWithFileName(__filename);

// Configurazione Redis connection
const REDIS_CONFIG = {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
    // Per Fly.io con Upstash Redis
    ...(process.env.REDIS_URL && {
      redis: process.env.REDIS_URL
    })
  },
  // 🔧 CONFIGURAZIONE ANTI-STALL per gestire restart server durante development
  settings: {
    lockDuration: 60000, // 60s - Tempo massimo prima che job sia considerato stalled
    stalledInterval: 30000, // 30s - Frequenza check job stalled
    maxStalledCount: 2, // Numero max volte che un job può essere stalled prima di fallire
    guardInterval: 5000 // 5s - Frequenza heartbeat worker
  },
  defaultJobOptions: {
    attempts: 3, // 3 tentativi prima di fallire
    backoff: {
      type: 'exponential',
      delay: 5000 // 5s, 10s, 20s
    },
    timeout: 300000, // 5 minuti max per job (AI + web scraping multi-bottle)
    removeOnComplete: 100, // Mantieni ultimi 100 job completati
    removeOnFail: 500 // Mantieni ultimi 500 job falliti per debugging
  }
};

/**
 * Review Processing Queue
 * Gestisce il processing asincrono delle recensioni con AI e web scraping
 */
const reviewQueue = new Bull('review-processing', REDIS_CONFIG);

// Gestione errori di connessione Redis (non blocca l'app se Redis è offline)
reviewQueue.on('error', (error) => {
  logger.warn('⚠️ Bull Queue errore connessione Redis', { error: error.message });
});

// Event Handlers per logging e monitoring
reviewQueue.on('completed', (job, result) => {
  logger.info(`✅ Job ${job.id} completato con successo`, {
    reviewId: result.reviewId,
    processingTime: result.processingTime,
    dataSource: result.dataSource
  });
});

reviewQueue.on('failed', (job, err) => {
  logger.error(`❌ Job ${job.id} fallito`, {
    reviewId: job.data.reviewId,
    error: err.message,
    attempts: job.attemptsMade,
    stack: err.stack
  });
});

reviewQueue.on('stalled', (job) => {
  logger.warn(`⚠️ Job ${job.id} stalled (worker probabilmente morto)`, {
    reviewId: job.data.reviewId
  });
});

reviewQueue.on('progress', (job, progress) => {
  logger.debug(`🔄 Job ${job.id} progress: ${progress}%`, {
    reviewId: job.data.reviewId
  });
});

reviewQueue.on('active', (job) => {
  logger.info(`🔄 Job ${job.id} iniziato`, {
    reviewId: job.data.reviewId
  });
});

/**
 * Aggiunge un job di processing recensione alla coda
 * @param {Object} reviewData - Dati recensione e AI
 * @param {String} reviewData.reviewId - ID MongoDB della recensione
 * @param {Object} reviewData.bottles - Dati bottiglie estratti da AI
 * @param {String} reviewData.imageDataUrl - Immagine base64
 * @param {String} reviewData.userId - ID utente (opzionale)
 * @returns {Promise<Object>} Job Bull creato
 */
async function addReviewProcessingJob(reviewData) {
  try {
    // Timeout di 5 secondi per evitare blocco se Redis non è raggiungibile
    const QUEUE_TIMEOUT_MS = 5000;
    
    const jobPromise = reviewQueue.add('process-review', reviewData, {
      priority: reviewData.priority || 5, // Default medium priority
      jobId: `review-${reviewData.reviewId}` // ID unico per evitare duplicati
    });
    
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Redis/Bull timeout - coda non raggiungibile')), QUEUE_TIMEOUT_MS);
    });
    
    const job = await Promise.race([jobPromise, timeoutPromise]);

    logger.info(`📥 Job processing aggiunto alla coda`, {
      jobId: job.id,
      reviewId: reviewData.reviewId,
      queuePosition: await reviewQueue.count()
    });

    return job;
  } catch (error) {
    logger.error(`❌ Errore aggiunta job alla coda (Redis potrebbe essere offline)`, {
      reviewId: reviewData.reviewId,
      error: error.message
    });
    // Restituisci un job fittizio per non bloccare il flusso utente
    // La review è già salvata nel DB, il processing potrà essere ritentato
    return {
      id: `fallback-${reviewData.reviewId}`,
      isFallback: true,
      data: reviewData
    };
  }
}

/**
 * Ottiene lo stato di un job dalla coda
 * @param {String} jobId - ID del job Bull
 * @returns {Promise<Object>} Stato del job
 */
async function getJobStatus(jobId) {
  try {
    const job = await reviewQueue.getJob(jobId);
    if (!job) {
      return { status: 'not_found' };
    }

    const state = await job.getState();
    const progress = job._progress;
    
    return {
      status: state,
      progress,
      data: job.data,
      result: job.returnvalue,
      failedReason: job.failedReason,
      attempts: job.attemptsMade,
      timestamp: job.timestamp
    };
  } catch (error) {
    logger.error(`Errore recupero stato job ${jobId}:`, error);
    throw error;
  }
}

/**
 * Ottiene statistiche della coda
 * @returns {Promise<Object>} Statistiche
 */
async function getQueueStats() {
  try {
    const [
      waiting,
      active,
      completed,
      failed,
      delayed
    ] = await Promise.all([
      reviewQueue.getWaitingCount(),
      reviewQueue.getActiveCount(),
      reviewQueue.getCompletedCount(),
      reviewQueue.getFailedCount(),
      reviewQueue.getDelayedCount()
    ]);

    return {
      waiting,
      active,
      completed,
      failed,
      delayed,
      total: waiting + active + completed + failed + delayed
    };
  } catch (error) {
    logger.error('Errore recupero statistiche coda:', error);
    throw error;
  }
}

/**
 * Pulisce job vecchi completati/falliti
 * @param {Number} grace - Millisecondi di grace period
 * @returns {Promise<Object>} Numero job rimossi
 */
async function cleanQueue(grace = 3600000) { // Default 1 ora
  try {
    const removed = await reviewQueue.clean(grace, 'completed');
    const removedFailed = await reviewQueue.clean(grace * 24, 'failed'); // 24 ore per failed
    
    logger.info(`🧹 Coda pulita`, {
      completedRemoved: removed.length,
      failedRemoved: removedFailed.length
    });

    return {
      completed: removed.length,
      failed: removedFailed.length
    };
  } catch (error) {
    logger.error('Errore pulizia coda:', error);
    throw error;
  }
}

/**
 * Pausa la coda (per manutenzione)
 */
async function pauseQueue() {
  await reviewQueue.pause();
  logger.warn('⏸️ Coda messa in pausa');
}

/**
 * Riprende la coda
 */
async function resumeQueue() {
  await reviewQueue.resume();
  logger.info('▶️ Coda ripresa');
}

/**
 * Chiude la connessione alla coda (per graceful shutdown)
 */
async function closeQueue() {
  await reviewQueue.close();
  logger.info('🔌 Connessione coda chiusa');
}

module.exports = {
  reviewQueue,
  addReviewProcessingJob,
  getJobStatus,
  getQueueStats,
  cleanQueue,
  pauseQueue,
  resumeQueue,
  closeQueue
};
