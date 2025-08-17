const express = require('express');
const router = express.Router();
const cacheService = require('../utils/cacheService');
const { ensureRole } = require('../middlewares/authMiddleware');
const ErrorHandler = require('../utils/errorHandler');

/**
 * Route per gestione e monitoring cache (solo admin)
 */

/**
 * Ottieni statistiche complete cache
 */
router.get('/stats', ensureRole(['administrator']), (req, res) => {
  const stats = cacheService.getStats();
  const health = cacheService.healthCheck();
  
  res.json({
    success: true,
    data: {
      stats,
      health,
      timestamp: new Date().toISOString()
    }
  });
});

/**
 * Flush cache completo
 */
router.delete('/flush', ensureRole(['administrator']), (req, res) => {
  cacheService.flushAll();
  
  res.json({
    success: true,
    message: 'Cache completamente pulita',
    timestamp: new Date().toISOString()
  });
});

/**
 * Invalida cache per pattern
 */
router.delete('/pattern/:pattern', ensureRole(['administrator']), (req, res) => {
  const { pattern } = req.params;
  
  if (!pattern || pattern.length < 3) {
    return res.status(400).json({
      success: false,
      message: 'Pattern deve essere almeno 3 caratteri'
    });
  }
  
  const deleted = cacheService.invalidatePattern(pattern);
  
  res.json({
    success: true,
    message: `Cache invalidata per pattern: ${pattern}`,
    data: {
      pattern,
      deletedKeys: deleted
    }
  });
});

/**
 * Ottieni keys cache con filtro
 */
router.get('/keys', ensureRole(['administrator']), (req, res) => {
  const { filter } = req.query;
  
  // Per sicurezza, non esponiamo tutte le chiavi se non filtrate
  if (!filter || filter.length < 3) {
    return res.status(400).json({
      success: false,
      message: 'Filtro richiesto (min 3 caratteri)'
    });
  }
  
  const memoryKeys = cacheService.memoryCache.keys().filter(key => 
    key.includes(filter)
  ).slice(0, 100); // Limita a 100 risultati
  
  const aiKeys = cacheService.aiCache.keys().filter(key => 
    key.includes(filter)
  ).slice(0, 100);
  
  const dbKeys = cacheService.dbCache.keys().filter(key => 
    key.includes(filter)
  ).slice(0, 100);
  
  res.json({
    success: true,
    data: {
      filter,
      keys: {
        memory: memoryKeys,
        ai: aiKeys,
        db: dbKeys
      },
      total: memoryKeys.length + aiKeys.length + dbKeys.length
    }
  });
});

/**
 * Health check pubblico (limitato)
 */
router.get('/health', (req, res) => {
  const health = cacheService.healthCheck();
  
  // Restituisci solo info di base per sicurezza
  res.json({
    success: true,
    data: {
      status: health.status,
      totalKeys: health.stats.overall.totalKeys,
      hitRate: health.stats.overall.totalHits / 
                (health.stats.overall.totalHits + health.stats.overall.totalMisses) || 0
    }
  });
});

/**
 * Warm cache per endpoint comuni
 */
router.post('/warm', ensureRole(['administrator']), ErrorHandler.asyncWrapper(async (req, res) => {
  const { type } = req.body;
  
  switch (type) {
    case 'homepage':
      // Qui potresti implementare pre-caricamento cache
      break;
    case 'user':
      const { userId } = req.body;
      if (userId) {
        // Pre-carica cache utente
      }
      break;
    default:
      return res.status(400).json({
        success: false,
        message: 'Tipo warm non supportato'
      });
  }
  
  res.json({
    success: true,
    message: `Cache warming completato per: ${type}`
  });
}));

module.exports = router;
