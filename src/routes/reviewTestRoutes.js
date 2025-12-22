/**
 * ROTTE TEST - ZERO SALVATAGGI DATABASE
 * 
 * Queste rotte eseguono analisi AI + web search
 * ma NON salvano NULLA nel database.
 * 
 * Serve SOLO per test e debug del flusso asincrono.
 */

const express = require('express');
const router = express.Router();
const { aiImageUpload } = require('../middlewares/uploadMiddleware');
const reviewTestController = require('../controllers/reviewTestController');
const logWithFileName = require('../utils/logger');

const logger = logWithFileName(__filename);

logger.info('📋 Route TEST recensioni configurate (NESSUN SALVATAGGIO DB)');

/**
 * POST /review/test-async
 * Analisi completa immagine SENZA salvataggio database
 * 
 * Body: FormData con campo 'image'
 * Response: JSON con tutti i dati AI + web search
 */
router.post(
  '/test-async',
  aiImageUpload,
  reviewTestController.testAnalyzeAsync
);

logger.info('  - POST /test-async - Analisi TEST (NO DB write)');

module.exports = router;
