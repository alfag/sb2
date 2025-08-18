const rateLimit = require('express-rate-limit');
const logger = require('./logger');

/**
 * Rate Limiting configurabile per diversi endpoint
 * Protegge l'applicazione da abusi e attacchi DoS
 */
class RateLimitService {
  /**
   * Rate limiting generale per API
   */
  static createGeneralLimiter() {
    return rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minuti
      max: 100, // Max 100 richieste per IP per window
      message: {
        error: 'Troppe richieste da questo IP, riprova più tardi.',
        retryAfter: '15 minuti'
      },
      standardHeaders: true,
      legacyHeaders: false,
      handler: (req, res) => {
        logger.warn('[RateLimit] Limite generale superato', {
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          endpoint: req.path
        });
        
        res.status(429).json({
          error: 'Rate limit exceeded',
          message: 'Troppe richieste da questo IP, riprova più tardi.',
          retryAfter: 15 * 60 // secondi
        });
      }
    });
  }

  /**
   * Rate limiting specifico per operazioni AI
   */
  static createAILimiter() {
    return rateLimit({
      windowMs: 60 * 60 * 1000, // 1 ora
      max: 20, // Max 20 analisi AI per IP per ora
      message: {
        error: 'Limite analisi AI raggiunto per questa ora.',
        retryAfter: '1 ora'
      },
      keyGenerator: (req) => {
        // Usa userId se disponibile, altrimenti IP
        return req.user?.id || req.ip;
      },
      skip: (req) => {
        // Salta rate limiting per admin
        return req.user?.role === 'admin';
      },
      handler: (req, res) => {
        // Log del limite raggiunto spostato qui dal deprecato onLimitReached
        logger.warn('[RateLimit] Limite AI raggiunto', {
          userId: req.user?.id,
          ip: req.ip,
          userAgent: req.get('User-Agent')
        });
        
        res.status(429).json({
          error: 'AI rate limit exceeded',
          message: 'Hai raggiunto il limite di analisi AI per questa ora. Riprova più tardi.',
          retryAfter: 60 * 60,
          suggestion: 'Considera di registrarti per limiti più alti'
        });
      }
    });
  }

  /**
   * Rate limiting per upload immagini
   */
  static createUploadLimiter() {
    return rateLimit({
      windowMs: 10 * 60 * 1000, // 10 minuti
      max: 10, // Max 10 upload per 10 minuti
      message: {
        error: 'Troppe immagini caricate, attendi prima di caricare altre.'
      },
      keyGenerator: (req) => {
        return req.user?.id || req.ip;
      },
      handler: (req, res) => {
        logger.warn('[RateLimit] Limite upload raggiunto', {
          userId: req.user?.id,
          ip: req.ip,
          fileSize: req.body?.size
        });

        res.status(429).json({
          error: 'Upload rate limit exceeded',
          message: 'Troppe immagini caricate, attendi prima di caricare altre.',
          retryAfter: 10 * 60
        });
      }
    });
  }

  /**
   * Rate limiting per autenticazione
   */
  static createAuthLimiter() {
    return rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minuti
      max: 5, // Max 5 tentativi per IP
      skipSuccessfulRequests: true,
      keyGenerator: (req) => {
        return req.ip;
      },
      handler: (req, res) => {
        logger.warn('[RateLimit] Limite autenticazione raggiunto', {
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          endpoint: req.path
        });

        res.status(429).json({
          error: 'Authentication rate limit exceeded',
          message: 'Troppi tentativi di accesso falliti. Riprova tra 15 minuti.',
          retryAfter: 15 * 60
        });
      }
    });
  }

  /**
   * Rate limiting per registrazione
   */
  static createRegistrationLimiter() {
    return rateLimit({
      windowMs: 60 * 60 * 1000, // 1 ora
      max: 3, // Max 3 registrazioni per IP per ora
      message: {
        error: 'Troppe registrazioni da questo IP.'
      },
      handler: (req, res) => {
        logger.warn('[RateLimit] Limite registrazione raggiunto', {
          ip: req.ip,
          userAgent: req.get('User-Agent')
        });

        res.status(429).json({
          error: 'Registration rate limit exceeded',
          message: 'Troppe registrazioni da questo IP. Riprova tra un\'ora.',
          retryAfter: 60 * 60
        });
      }
    });
  }

  /**
   * Rate limiting per operazioni di review
   */
  static createReviewLimiter() {
    return rateLimit({
      windowMs: 60 * 60 * 1000, // 1 ora
      max: 50, // Max 50 recensioni per ora
      keyGenerator: (req) => {
        return req.user?.id || req.ip;
      },
      skip: (req) => {
        // Salta per admin
        return req.user?.role === 'admin';
      },
      handler: (req, res) => {
        logger.warn('[RateLimit] Limite recensioni raggiunto', {
          userId: req.user?.id,
          ip: req.ip
        });

        res.status(429).json({
          error: 'Review rate limit exceeded',
          message: 'Hai raggiunto il limite di recensioni per questa ora.',
          retryAfter: 60 * 60
        });
      }
    });
  }

  /**
   * Rate limiting personalizzato
   */
  static createCustomLimiter(options = {}) {
    const defaultOptions = {
      windowMs: 15 * 60 * 1000,
      max: 100,
      message: 'Rate limit exceeded',
      standardHeaders: true,
      legacyHeaders: false
    };

    const config = { ...defaultOptions, ...options };

    return rateLimit({
      ...config,
      handler: (req, res) => {
        logger.warn('[RateLimit] Limite personalizzato raggiunto', {
          endpoint: req.path,
          ip: req.ip,
          config: config
        });

        res.status(429).json({
          error: 'Rate limit exceeded',
          message: config.message,
          retryAfter: Math.ceil(config.windowMs / 1000)
        });
      }
    });
  }

  /**
   * Middleware per logging rate limit hits
   */
  static createLoggingMiddleware() {
    return (req, res, next) => {
      const originalSend = res.send;
      
      res.send = function(data) {
        // Log solo se è un rate limit hit
        if (res.statusCode === 429) {
          logger.info('[RateLimit] Rate limit hit', {
            ip: req.ip,
            userId: req.user?.id,
            endpoint: req.path,
            method: req.method,
            userAgent: req.get('User-Agent'),
            headers: {
              'x-ratelimit-limit': res.get('X-RateLimit-Limit'),
              'x-ratelimit-remaining': res.get('X-RateLimit-Remaining'),
              'x-ratelimit-reset': res.get('X-RateLimit-Reset')
            }
          });
        }
        
        originalSend.call(this, data);
      };
      
      next();
    };
  }

  /**
   * Ottieni info rate limit per client
   */
  static getRateLimitInfo(req, res, next) {
    res.json({
      limits: {
        general: {
          window: '15 minuti',
          max: 100,
          current: res.get('X-RateLimit-Limit'),
          remaining: res.get('X-RateLimit-Remaining')
        },
        ai: {
          window: '1 ora',
          max: req.user?.role === 'admin' ? 'illimitato' : 20
        },
        upload: {
          window: '10 minuti',
          max: 10
        },
        reviews: {
          window: '1 ora',
          max: req.user?.role === 'admin' ? 'illimitato' : 50
        }
      },
      userType: req.user?.role || 'anonymous',
      recommendations: [
        'Registrati per limiti più alti',
        'Evita richieste multiple simultanee',
        'Usa cache locale quando possibile'
      ]
    });
  }
}

module.exports = RateLimitService;
