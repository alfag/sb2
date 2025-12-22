// ==================================================
// FILE: src/routes/reviewAsyncRoutes.js
// SCOPO: Route per gestione asincrona recensioni con Bull+Redis
// AUTORE: Sistema automatico - Implementazione punto 15 task_memo
// DATA: 7 Gennaio 2025
// ==================================================

const express = require('express');
const router = express.Router();
const reviewControllerAsync = require('../controllers/reviewControllerAsync');
const { isAuthenticated, isCustomer, ensureRole } = require('../middlewares/authMiddleware');
const RateLimitService = require('../utils/rateLimitService');
const logWithFileName = require('../utils/logger');
const multer = require('multer');

const logger = logWithFileName(__filename);

// Configurazione multer per upload immagini in memory
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Solo immagini sono permesse'));
    }
  }
});

// ==================================================
// ROTTE PUBBLICHE/CUSTOMER - Creazione recensioni async
// ==================================================

/**
 * POST /review/async
 * NUOVO: Analisi immagine con sistema asincrono
 * - Upload immagine
 * - Analisi AI immediata
 * - Avvia job asincrono per processing completo
 * - Ritorna reviewId per polling
 * 
 * PROTEZIONE: Richiede autenticazione + ruolo customer
 * - isAuthenticated: Verifica login utente
 * - isCustomer: Verifica ruolo customer (obbligatorio per recensioni)
 */
router.post('/async',
    isAuthenticated,          // STEP 1: Verifica autenticazione
    isCustomer,               // STEP 2: Verifica ruolo customer
    upload.single('image'),   // STEP 3: Upload immagine
    RateLimitService.createReviewLimiter(), // STEP 4: Rate limiting
    reviewControllerAsync.analyzeImageAsync  // STEP 5: Processing
);

/**
 * GET /review/:reviewId/status
 * Ottiene stato processing di una recensione
 * - Ritorna processingStatus e dettagli job
 * - Accessibile anche a guest (per polling durante upload)
 */
router.get('/:reviewId/status',
    reviewControllerAsync.getReviewStatus
);

// ==================================================
// ROTTE ADMIN - Gestione coda e validazione
// ==================================================

/**
 * GET /administrator/api/queue/stats
 * Statistiche coda Bull
 * - Job waiting, active, completed, failed, delayed
 * - Solo administrator
 */
router.get('/administrator/queue/stats',
    isAuthenticated,
    ensureRole('administrator'),
    reviewControllerAsync.getQueueStats
);

/**
 * GET /administrator/api/reviews/pending-validation
 * Lista recensioni in attesa validazione
 * - Status: pending_validation, processing, failed, needs_admin_review
 * - Solo administrator
 */
router.get('/administrator/reviews/pending-validation',
    isAuthenticated,
    ensureRole('administrator'),
    reviewControllerAsync.getPendingValidationReviews
);

/**
 * POST /administrator/api/review/:reviewId/retry
 * Riprova processing recensione fallita
 * - Ri-accoda job con retry
 * - Solo administrator
 */
router.post('/administrator/review/:reviewId/retry',
    isAuthenticated,
    ensureRole('administrator'),
    async (req, res) => {
        try {
            const { reviewId } = req.params;
            const Review = require('../models/Review');
            
            const review = await Review.findById(reviewId);
            if (!review) {
                return res.status(404).json({
                    success: false,
                    error: 'Recensione non trovata'
                });
            }
            
            // Reset status
            review.processingStatus = 'pending_validation';
            review.processingError = null;
            review.processingAttempts = 0;
            await review.save();
            
            // Ri-accoda job
            const queueService = require('../services/queueService');
            const job = await queueService.addReviewProcessingJob(review._id.toString(), {
                bottles: review.rawAiData.bottles,
                brewery: review.rawAiData.brewery,
                imageDataUrl: review.rawAiData.imageDataUrl,
                userId: review.user.toString()
            });
            
            review.processingJobId = job.id;
            await review.save();
            
            logger.info(`Admin retry recensione ${reviewId} - Job ${job.id} accodato`);
            
            res.json({
                success: true,
                message: 'Recensione ri-accodata per processing',
                jobId: job.id
            });
        } catch (error) {
            logger.error('Errore retry recensione:', error);
            res.status(500).json({
                success: false,
                error: 'Errore durante retry recensione'
            });
        }
    }
);

/**
 * DELETE /administrator/api/review/:reviewId/cancel
 * Cancella recensione e job associato
 * - Rimuove job dalla coda
 * - Elimina recensione se ancora pending
 * - Solo administrator
 */
router.delete('/administrator/review/:reviewId/cancel',
    isAuthenticated,
    ensureRole('administrator'),
    async (req, res) => {
        try {
            const { reviewId } = req.params;
            const Review = require('../models/Review');
            const queueService = require('../services/queueService');
            
            const review = await Review.findById(reviewId);
            if (!review) {
                return res.status(404).json({
                    success: false,
                    error: 'Recensione non trovata'
                });
            }
            
            // Cancella job se presente
            if (review.processingJobId) {
                const job = await queueService.reviewQueue.getJob(review.processingJobId);
                if (job) {
                    await job.remove();
                    logger.info(`Admin cancellato job ${review.processingJobId} per recensione ${reviewId}`);
                }
            }
            
            // Elimina recensione solo se ancora in processing
            if (['pending_validation', 'processing', 'failed'].includes(review.processingStatus)) {
                await review.deleteOne();
                logger.info(`Admin eliminato recensione ${reviewId} in stato ${review.processingStatus}`);
                
                res.json({
                    success: true,
                    message: 'Recensione e job cancellati con successo'
                });
            } else {
                res.json({
                    success: false,
                    error: 'Impossibile eliminare recensione completata. Usa eliminazione normale.'
                });
            }
        } catch (error) {
            logger.error('Errore cancellazione recensione:', error);
            res.status(500).json({
                success: false,
                error: 'Errore durante cancellazione recensione'
            });
        }
    }
);

// ==================================================
// ROTTE TEST ASINCRONE - ZERO SALVATAGGI DATABASE
// ==================================================

/**
 * POST /review/test-async-worker
 * TEST: Analisi immagine con sistema asincrono SENZA salvataggio database
 * - Upload immagine
 * - Analisi AI immediata
 * - Avvia job asincrono per processing completo (TEST MODE)
 * - Risposta IMMEDIATA con reviewId per polling
 * - ZERO scritture database
 */
router.post('/test-async-worker',
    upload.single('image'),
    reviewControllerAsync.testAnalyzeImageAsync
);

/**
 * GET /review/test-status/:reviewId
 * TEST: Polling stato job test asincrono
 * - Controlla stato job test in background
 * - Ritorna progress e dati completati
 * - ZERO scritture database
 */
router.get('/test-status/:reviewId',
    reviewControllerAsync.getTestJobStatus
);

// ==================================================
// LOGGING & EXPORT
// ==================================================

logger.info('📋 Route async recensioni configurate');
logger.info('  - POST /async - Creazione asincrona');
logger.info('  - GET /:reviewId/status - Stato processing');
logger.info('  - GET /administrator/queue/stats - Statistiche coda');
logger.info('  - GET /administrator/reviews/pending-validation - Recensioni pending');
logger.info('  - POST /administrator/review/:reviewId/retry - Retry recensione');
logger.info('  - DELETE /administrator/review/:reviewId/cancel - Cancella recensione');
logger.info('  - POST /test-async-worker - Test asincrono (NO DB write)');
logger.info('  - GET /test-status/:reviewId - Polling stato job test');

module.exports = router;
