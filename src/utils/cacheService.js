const NodeCache = require('node-cache');
const logWithFileName = require('./logger');
const logger = logWithFileName(__filename);

/**
 * Service di caching multi-layer per performance ottimizzate
 * Supporta in-memory cache, session cache e future Redis integration
 */
class CacheService {
  constructor() {
    // Cache in-memory per dati frequenti
    this.memoryCache = new NodeCache({
      stdTTL: 600, // 10 minuti default
      checkperiod: 120, // Check per expired ogni 2 minuti
      useClones: false, // Performance boost
      deleteOnExpire: true,
      maxKeys: 1000 // Limite memoria
    });

    // Cache per risultati AI (più lunga durata)
    this.aiCache = new NodeCache({
      stdTTL: 3600, // 1 ora
      checkperiod: 300, // Check ogni 5 minuti
      useClones: true, // Sicurezza per dati AI
      maxKeys: 500
    });

    // Cache per query database
    this.dbCache = new NodeCache({
      stdTTL: 1800, // 30 minuti
      checkperiod: 180, // Check ogni 3 minuti
      useClones: true,
      maxKeys: 200
    });

    this.setupEventListeners();
    
    logger.info('[CacheService] Cache service inizializzato', {
      memoryCacheKeys: this.memoryCache.keys().length,
      aiCacheKeys: this.aiCache.keys().length,
      dbCacheKeys: this.dbCache.keys().length
    });
  }

  /**
   * Setup event listeners per monitoring
   */
  setupEventListeners() {
    // Event listeners per memory cache
    this.memoryCache.on('set', (key, value) => {
      logger.debug('[CacheService] Memory cache SET', { key, size: JSON.stringify(value).length });
    });

    this.memoryCache.on('del', (key, value) => {
      logger.debug('[CacheService] Memory cache DEL', { key });
    });

    this.memoryCache.on('expired', (key, value) => {
      logger.debug('[CacheService] Memory cache EXPIRED', { key });
    });

    // Event listeners per AI cache
    this.aiCache.on('set', (key, value) => {
      logger.debug('[CacheService] AI cache SET', { key });
    });

    this.aiCache.on('expired', (key, value) => {
      logger.debug('[CacheService] AI cache EXPIRED', { key });
    });
  }

  /**
   * Cache generico in memoria
   */
  set(key, value, ttl = null) {
    try {
      const success = this.memoryCache.set(key, value, ttl);
      if (success) {
        logger.debug('[CacheService] Set cache success', { key, ttl });
      }
      return success;
    } catch (error) {
      logger.error('[CacheService] Errore set cache', { key, error: error.message });
      return false;
    }
  }

  /**
   * Recupera da cache generico
   */
  get(key) {
    try {
      const value = this.memoryCache.get(key);
      if (value !== undefined) {
        logger.debug('[CacheService] Cache HIT', { key });
      } else {
        logger.debug('[CacheService] Cache MISS', { key });
      }
      return value;
    } catch (error) {
      logger.error('[CacheService] Errore get cache', { key, error: error.message });
      return undefined;
    }
  }

  /**
   * Cache per risultati AI
   */
  setAI(imageHash, analysisResult, ttl = 3600) {
    const key = `ai:${imageHash}`;
    try {
      const success = this.aiCache.set(key, analysisResult, ttl);
      if (success) {
        logger.info('[CacheService] AI result cached', { 
          imageHash: imageHash.substring(0, 8) + '...', 
          ttl,
          bottlesFound: analysisResult.bottles?.length || 0 
        });
      }
      return success;
    } catch (error) {
      logger.error('[CacheService] Errore cache AI', { imageHash, error: error.message });
      return false;
    }
  }

  /**
   * Recupera risultato AI da cache
   */
  getAI(imageHash) {
    const key = `ai:${imageHash}`;
    try {
      const value = this.aiCache.get(key);
      if (value !== undefined) {
        logger.info('[CacheService] AI cache HIT', { 
          imageHash: imageHash.substring(0, 8) + '...',
          bottlesFound: value.bottles?.length || 0
        });
      } else {
        logger.debug('[CacheService] AI cache MISS', { imageHash: imageHash.substring(0, 8) + '...' });
      }
      return value;
    } catch (error) {
      logger.error('[CacheService] Errore get AI cache', { imageHash, error: error.message });
      return undefined;
    }
  }

  /**
   * Cache per query database
   */
  setDB(queryKey, result, ttl = 1800) {
    const key = `db:${queryKey}`;
    try {
      const success = this.dbCache.set(key, result, ttl);
      if (success) {
        logger.debug('[CacheService] DB query cached', { queryKey, ttl });
      }
      return success;
    } catch (error) {
      logger.error('[CacheService] Errore cache DB', { queryKey, error: error.message });
      return false;
    }
  }

  /**
   * Recupera query database da cache
   */
  getDB(queryKey) {
    const key = `db:${queryKey}`;
    try {
      const value = this.dbCache.get(key);
      if (value !== undefined) {
        logger.debug('[CacheService] DB cache HIT', { queryKey });
      } else {
        logger.debug('[CacheService] DB cache MISS', { queryKey });
      }
      return value;
    } catch (error) {
      logger.error('[CacheService] Errore get DB cache', { queryKey, error: error.message });
      return undefined;
    }
  }

  /**
   * Cache per sessioni temporanee
   */
  setSession(sessionId, key, value, ttl = 1800) {
    const sessionKey = `session:${sessionId}:${key}`;
    return this.set(sessionKey, value, ttl);
  }

  /**
   * Recupera da cache sessione
   */
  getSession(sessionId, key) {
    const sessionKey = `session:${sessionId}:${key}`;
    return this.get(sessionKey);
  }

  /**
   * Rimuove da cache sessione
   */
  deleteSession(sessionId, key = null) {
    if (key) {
      const sessionKey = `session:${sessionId}:${key}`;
      return this.delete(sessionKey);
    } else {
      // Rimuove tutte le chiavi della sessione
      const pattern = `session:${sessionId}:`;
      const keys = this.memoryCache.keys().filter(k => k.startsWith(pattern));
      return this.memoryCache.del(keys);
    }
  }

  /**
   * Rimuove chiave specifica
   */
  delete(key) {
    try {
      const deleted = this.memoryCache.del(key);
      if (deleted > 0) {
        logger.debug('[CacheService] Cache deleted', { key });
      }
      return deleted;
    } catch (error) {
      logger.error('[CacheService] Errore delete cache', { key, error: error.message });
      return 0;
    }
  }

  /**
   * Middleware per cache automatico
   */
  middleware(options = {}) {
    const {
      keyGenerator = (req) => req.originalUrl,
      ttl = 300,
      skip = () => false,
      only = null // Array di status codes da cacheare
    } = options;

    return (req, res, next) => {
      // Salta cache se specificato
      if (skip(req)) {
        return next();
      }

      const key = keyGenerator(req);
      const cached = this.get(key);

      // Cache hit
      if (cached !== undefined) {
        logger.debug('[CacheService] Middleware cache HIT', { key });
        return res.json(cached);
      }

      // Cache miss - intercetta risposta
      const originalSend = res.send;
      res.send = (body) => {
        // Cache solo se status code è OK (o in lista only)
        const shouldCache = only ? 
          only.includes(res.statusCode) : 
          res.statusCode === 200;

        if (shouldCache) {
          try {
            const data = typeof body === 'string' ? JSON.parse(body) : body;
            this.set(key, data, ttl);
            logger.debug('[CacheService] Middleware cached response', { key, ttl });
          } catch (error) {
            logger.warn('[CacheService] Errore cache response', { key, error: error.message });
          }
        }

        originalSend.call(this, body);
      };

      next();
    };
  }

  /**
   * Wrapper per funzioni con cache automatico
   */
  wrap(key, fn, ttl = 600) {
    return async (...args) => {
      // Controlla cache
      const cached = this.get(key);
      if (cached !== undefined) {
        return cached;
      }

      // Esegui funzione e cache risultato
      try {
        const result = await fn(...args);
        this.set(key, result, ttl);
        return result;
      } catch (error) {
        logger.error('[CacheService] Errore wrap function', { key, error: error.message });
        throw error;
      }
    };
  }

  /**
   * Invalidazione cache per pattern
   */
  invalidatePattern(pattern) {
    try {
      const keys = this.memoryCache.keys().filter(key => 
        key.includes(pattern) || key.match(new RegExp(pattern))
      );
      
      const deleted = this.memoryCache.del(keys);
      
      logger.info('[CacheService] Pattern invalidation', { 
        pattern, 
        deletedKeys: deleted,
        keys: keys.slice(0, 5) // Log prime 5 per debug
      });
      
      return deleted;
    } catch (error) {
      logger.error('[CacheService] Errore invalidation pattern', { pattern, error: error.message });
      return 0;
    }
  }

  /**
   * Statistiche cache
   */
  getStats() {
    const memoryStats = this.memoryCache.getStats();
    const aiStats = this.aiCache.getStats();
    const dbStats = this.dbCache.getStats();

    return {
      memory: {
        keys: memoryStats.keys,
        hits: memoryStats.hits,
        misses: memoryStats.misses,
        hitRate: memoryStats.hits / (memoryStats.hits + memoryStats.misses) || 0
      },
      ai: {
        keys: aiStats.keys,
        hits: aiStats.hits,
        misses: aiStats.misses,
        hitRate: aiStats.hits / (aiStats.hits + aiStats.misses) || 0
      },
      db: {
        keys: dbStats.keys,
        hits: dbStats.hits,
        misses: dbStats.misses,
        hitRate: dbStats.hits / (dbStats.hits + dbStats.misses) || 0
      },
      overall: {
        totalKeys: memoryStats.keys + aiStats.keys + dbStats.keys,
        totalHits: memoryStats.hits + aiStats.hits + dbStats.hits,
        totalMisses: memoryStats.misses + aiStats.misses + dbStats.misses
      }
    };
  }

  /**
   * Flush di tutte le cache
   */
  flushAll() {
    this.memoryCache.flushAll();
    this.aiCache.flushAll();
    this.dbCache.flushAll();
    
    logger.info('[CacheService] All caches flushed');
  }

  /**
   * Health check cache
   */
  healthCheck() {
    const stats = this.getStats();
    const isHealthy = stats.overall.totalKeys < 1500; // Threshold
    
    return {
      status: isHealthy ? 'healthy' : 'warning',
      stats,
      recommendations: isHealthy ? [] : [
        'Considera di aumentare la frequenza di cleanup',
        'Verifica pattern di invalidazione cache',
        'Considera migrazione a Redis per production'
      ]
    };
  }
}

// Singleton instance
const cacheService = new CacheService();

module.exports = cacheService;
