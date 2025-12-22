const cacheService = require('../utils/cacheService');
const logger = require('../utils/logger');

/**
 * Middleware di caching per Express routes
 * Fornisce caching automatico per endpoint specifici
 */

/**
 * Cache middleware generico per API routes
 */
const apiCache = (options = {}) => {
  const {
    ttl = 300, // 5 minuti default
    keyGenerator = (req) => `api:${req.method}:${req.originalUrl}:${JSON.stringify(req.query)}`,
    skip = (req) => req.method !== 'GET',
    successOnly = true
  } = options;

  return (req, res, next) => {
    // Salta cache per non-GET requests
    if (skip(req)) {
      return next();
    }

    const key = keyGenerator(req);
    
    // Controlla cache
    const cached = cacheService.get(key);
    if (cached !== undefined) {
      logger.debug('[CacheMiddleware] API cache hit', { 
        method: req.method, 
        url: req.originalUrl,
        key: key.substring(0, 50) + '...'
      });
      return res.json(cached);
    }

    // Intercetta risposta per caching
    const originalJson = res.json;
    res.json = function(data) {
      // Cache solo risposte di successo
      if (!successOnly || (res.statusCode >= 200 && res.statusCode < 300)) {
        cacheService.set(key, data, ttl);
        logger.debug('[CacheMiddleware] Response cached', { 
          method: req.method, 
          url: req.originalUrl,
          statusCode: res.statusCode,
          ttl
        });
      }

      originalJson.call(this, data);
    };

    next();
  };
};

/**
 * Cache per user reviews con invalidazione intelligente
 */
const userReviewsCache = (ttl = 600) => {
  return apiCache({
    ttl,
    keyGenerator: (req) => {
      const userId = req.params.userId || req.user?.id;
      const query = JSON.stringify(req.query);
      return `user_reviews:${userId}:${query}`;
    },
    skip: (req) => req.method !== 'GET' || !req.params.userId
  });
};

/**
 * Cache per beer statistics
 */
const beerStatsCache = (ttl = 1800) => {
  return apiCache({
    ttl,
    keyGenerator: (req) => {
      const beerId = req.params.beerId;
      return `beer_stats:${beerId}`;
    },
    skip: (req) => req.method !== 'GET' || !req.params.beerId
  });
};

/**
 * Cache per brewery information
 */
const breweryCache = (ttl = 3600) => {
  return apiCache({
    ttl,
    keyGenerator: (req) => {
      const breweryId = req.params.breweryId;
      const query = JSON.stringify(req.query);
      return `brewery:${breweryId}:${query}`;
    },
    skip: (req) => req.method !== 'GET' || !req.params.breweryId
  });
};

/**
 * Cache per search results
 */
const searchCache = (ttl = 900) => {
  return apiCache({
    ttl,
    keyGenerator: (req) => {
      const searchTerm = req.query.q || req.query.search || '';
      const filters = { ...req.query };
      delete filters.q;
      delete filters.search;
      return `search:${searchTerm}:${JSON.stringify(filters)}`;
    },
    skip: (req) => {
      return req.method !== 'GET' || 
             (!req.query.q && !req.query.search) ||
             (req.query.q && req.query.q.length < 3);
    }
  });
};

/**
 * Invalidazione cache automatica per operazioni di scrittura
 */
const cacheInvalidator = {
  /**
   * Invalida cache dopo creazione review
   */
  onReviewCreate: (userId, beerIds = []) => {
    // Invalida user reviews
    cacheService.invalidatePattern(`user_reviews:${userId}`);
    
    // Invalida beer stats
    beerIds.forEach(beerId => {
      cacheService.invalidatePattern(`beer_stats:${beerId}`);
    });
    
    // Invalida search cache (può essere influenzata da nuove reviews)
    cacheService.invalidatePattern('search:');
    
    logger.info('[CacheInvalidator] Cache invalidated after review creation', {
      userId,
      affectedBeers: beerIds.length
    });
  },

  /**
   * Invalida cache dopo update brewery
   */
  onBreweryUpdate: (breweryId) => {
    cacheService.invalidatePattern(`brewery:${breweryId}`);
    cacheService.invalidatePattern('search:');
    
    logger.info('[CacheInvalidator] Cache invalidated after brewery update', {
      breweryId
    });
  },

  /**
   * Invalida cache dopo update beer
   */
  onBeerUpdate: (beerId) => {
    cacheService.invalidatePattern(`beer_stats:${beerId}`);
    cacheService.invalidatePattern('search:');
    
    logger.info('[CacheInvalidator] Cache invalidated after beer update', {
      beerId
    });
  },

  /**
   * Invalida cache utente
   */
  onUserUpdate: (userId) => {
    cacheService.invalidatePattern(`user_reviews:${userId}`);
    
    logger.info('[CacheInvalidator] Cache invalidated after user update', {
      userId
    });
  }
};

/**
 * Cache warming - preriscalda cache per endpoint comuni
 */
const cacheWarmer = {
  /**
   * Preriscalda cache per home page
   */
  async warmHomePage() {
    try {
      // Qui potresti pre-caricare statistiche globali, top reviews, etc.
      logger.info('[CacheWarmer] Home page cache warming completed');
    } catch (error) {
      logger.error('[CacheWarmer] Error warming home page cache', { error: error.message });
    }
  },

  /**
   * Preriscalda cache per user dashboard
   */
  async warmUserDashboard(userId) {
    try {
      // Pre-carica user reviews, stats, etc.
      logger.debug('[CacheWarmer] User dashboard cache warming completed', { userId });
    } catch (error) {
      logger.error('[CacheWarmer] Error warming user dashboard cache', { 
        userId, 
        error: error.message 
      });
    }
  }
};

/**
 * Health check per cache
 */
const cacheHealthCheck = (req, res, next) => {
  const health = cacheService.healthCheck();
  
  if (health.status === 'warning') {
    logger.warn('[CacheMiddleware] Cache health warning', {
      stats: health.stats,
      recommendations: health.recommendations
    });
  }

  // Aggiungi header con cache stats per debugging
  if (process.env.NODE_ENV === 'development') {
    res.set('X-Cache-Stats', JSON.stringify(health.stats.overall));
  }

  next();
};

module.exports = {
  apiCache,
  userReviewsCache,
  beerStatsCache,
  breweryCache,
  searchCache,
  cacheInvalidator,
  cacheWarmer,
  cacheHealthCheck
};
