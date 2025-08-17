const Review = require('../models/Review');
const User = require('../models/User');
const Beer = require('../models/Beer');
const Brewery = require('../models/Brewery');
const logWithFileName = require('../utils/logger');
const ValidationService = require('../utils/validationService');
const ErrorHandler = require('../utils/errorHandler');
const cacheService = require('../utils/cacheService');

const logger = logWithFileName(__filename);

/**
 * Service Layer per la gestione delle recensioni
 * Separa la logica business dai controller
 */
class ReviewService {
  /**
   * Crea multiple recensioni da dati AI
   * @param {Object} reviewsData - Dati delle recensioni da creare
   * @param {Object} user - Utente che crea le recensioni
   * @param {string} sessionId - ID sessione per tracking
   * @returns {Promise<Object>} - Risultato della creazione
   */
  static async createMultipleReviews(reviewsData, user, sessionId) {
    // Validazione dati recensioni obbligatori
    if (!reviewsData || !reviewsData.reviews || !Array.isArray(reviewsData.reviews)) {
      throw ErrorHandler.createHttpError(400, 'Dati recensioni non validi', 'Invalid reviews data structure');
    }

    // L'utente può essere null per gli utenti guest
    const userId = user ? user._id : null;
    const isGuestUser = !user;
    
    // Estrai thumbnail/imageUrl dalla prima recensione
    const imageUrl = reviewsData.reviews[0]?.thumbnail || '/placeholder-beer-image.jpg';

    logger.info('[ReviewService] Avvio creazione recensioni multiple', {
      userId: userId || 'guest',
      isGuestUser,
      sessionId,
      reviewsCount: reviewsData.reviews.length,
      hasImageUrl: !!imageUrl
    });

    const { reviews, aiAnalysisData } = reviewsData;
    const createdReviews = [];
    const errors = [];

    // Processa ogni recensione individualmente
    for (let i = 0; i < reviews.length; i++) {
      const reviewData = reviews[i];
      
      try {
        logger.debug('[ReviewService] Processamento recensione', {
          reviewIndex: i,
          beerName: reviewData.beerName,
          beerId: reviewData.beerId,
          hasBeerId: !!reviewData.beerId,
          reviewDataKeys: Object.keys(reviewData),
          userId: userId || 'guest'
        });

        // Verifica che la birra esista o creala se necessario
        const beer = await this.findOrCreateBeer(reviewData, isGuestUser);
        
        // Verifica duplicati recensioni solo per utenti autenticati
        if (userId) {
          await this.checkDuplicateReview(userId, beer._id);
        }

        // Crea la recensione
        const review = await this.createSingleReview({
          ...reviewData,
          userId: userId, // Può essere null per guest
          beer: beer._id,
          brewery: beer.brewery,
          aiAnalysisData: aiAnalysisData,
          sessionId,
          imageUrl: imageUrl // Passa l'imageUrl estratto
        });

        createdReviews.push(review);

        logger.info('[ReviewService] Recensione creata con successo', {
          reviewId: review._id,
          beerName: review.ratings[0]?.bottleLabel || reviewData.beerName,
          userId: userId || 'guest'
        });

      } catch (error) {
        logger.error('[ReviewService] Errore creazione recensione singola', {
          reviewIndex: i,
          beerName: reviewData.beerName,
          error: error.message,
          userId: userId || 'guest'
        });

        errors.push({
          reviewIndex: i,
          beerName: reviewData.beerName,
          error: error.message
        });
      }
    }

    // Aggiorna statistiche utente se ci sono recensioni create E l'utente è autenticato
    if (createdReviews.length > 0 && userId) {
      await this.updateUserStats(userId, createdReviews.length);
      
      // Invalida cache correlate
      cacheService.invalidatePattern(`user_reviews:${userId}`);
    }
    
    // Invalida cache stats per tutte le birre coinvolte (indipendentemente dall'utente)
    if (createdReviews.length > 0) {
      const beerIds = new Set(
        createdReviews.flatMap(r => 
          r.ratings.map(rating => rating.beer?.toString()).filter(Boolean)
        )
      );
      beerIds.forEach(beerId => {
        cacheService.invalidatePattern(`beer_stats:${beerId}`);
      });
      
      logger.info('[ReviewService] Cache invalidated after review creation', {
        userId: userId || 'guest',
        reviewsCreated: createdReviews.length,
        affectedBeers: beerIds.size
      });
    }

    const result = {
      success: true,
      message: `${createdReviews.length} recensioni create con successo`,
      data: {
        created: createdReviews.length,
        errors: errors.length,
        reviews: createdReviews.map(r => ({
          id: r._id,
          beerName: r.ratings[0]?.bottleLabel || 'Unknown',
          rating: r.ratings[0]?.rating || 0
        }))
      }
    };

    if (errors.length > 0) {
      result.errors = errors;
      result.message += `, ${errors.length} errori`;
    }

    logger.info('[ReviewService] Processo completato', {
      created: createdReviews.length,
      errors: errors.length,
      userId: userId || 'guest',
      sessionId
    });

    return result;
  }

  /**
   * Valida che una birra esista nel database
   * @param {string} beerId - ID della birra
   * @returns {Promise<Object>} - Oggetto birra
   */
  static async validateBeerExists(beerId) {
    if (!beerId) {
      throw ErrorHandler.createHttpError(400, 'ID birra mancante', 'Beer ID is required');
    }

    const beer = await Beer.findById(beerId).populate('brewery');
    if (!beer) {
      throw ErrorHandler.createHttpError(404, 'Birra non trovata', `Beer with ID ${beerId} not found`);
    }

    return beer;
  }

  /**
   * Verifica che l'utente non abbia già recensito questa birra
   * @param {string} userId - ID utente
   * @param {string} beerId - ID birra
   */
  static async checkDuplicateReview(userId, beerId) {
    const existingReview = await Review.findOne({
      user: userId,
      beer: beerId
    });

    if (existingReview) {
      throw ErrorHandler.createHttpError(409, 'Recensione già esistente', 
        'User has already reviewed this beer');
    }
  }

  /**
   * Crea una singola recensione
   * @param {Object} reviewData - Dati della recensione
   * @returns {Promise<Object>} - Recensione creata
   */
  static async createSingleReview(reviewData) {
    // Adaptiamo i dati al modello Review che usa l'array ratings
    const review = new Review({
      user: reviewData.userId || undefined, // undefined per guest users
      sessionId: reviewData.sessionId,
      imageUrl: reviewData.imageUrl, // URL del thumbnail salvato
      ratings: [{
        bottleLabel: reviewData.beerName,
        rating: reviewData.rating,
        brewery: reviewData.brewery,
        beer: reviewData.beer,
        notes: reviewData.notes || '',
        
        // Valutazioni dettagliate
        detailedRatings: reviewData.detailedRatings ? {
          appearance: reviewData.detailedRatings.appearance ? {
            rating: reviewData.detailedRatings.appearance.rating,
            notes: reviewData.detailedRatings.appearance.notes || ''
          } : undefined,
          aroma: reviewData.detailedRatings.aroma ? {
            rating: reviewData.detailedRatings.aroma.rating,
            notes: reviewData.detailedRatings.aroma.notes || ''
          } : undefined,
          taste: reviewData.detailedRatings.taste ? {
            rating: reviewData.detailedRatings.taste.rating,
            notes: reviewData.detailedRatings.taste.notes || ''
          } : undefined,
          mouthfeel: reviewData.detailedRatings.mouthfeel ? {
            rating: reviewData.detailedRatings.mouthfeel.rating,
            notes: reviewData.detailedRatings.mouthfeel.notes || ''
          } : undefined,
          overall: reviewData.detailedRatings.overall ? {
            rating: reviewData.detailedRatings.overall.rating,
            notes: reviewData.detailedRatings.overall.notes || ''
          } : undefined
        } : undefined,

        // Dati AI
        aiData: reviewData.aiAnalysisData ? {
          alcoholContent: reviewData.aiAnalysisData.alcoholContent,
          beerType: reviewData.aiAnalysisData.beerType,
          beerSubStyle: reviewData.aiAnalysisData.beerSubStyle,
          volume: reviewData.aiAnalysisData.volume,
          description: reviewData.aiAnalysisData.description,
          ingredients: reviewData.aiAnalysisData.ingredients,
          tastingNotes: reviewData.aiAnalysisData.tastingNotes,
          confidence: reviewData.aiAnalysisData.confidence,
          dataSource: reviewData.aiAnalysisData.dataSource,
          ibu: reviewData.aiAnalysisData.ibu,
          nutritionalInfo: reviewData.aiAnalysisData.nutritionalInfo,
          price: reviewData.aiAnalysisData.price,
          availability: reviewData.aiAnalysisData.availability,
          bottleLabel: reviewData.beerName
        } : undefined
      }],
      location: reviewData.location || undefined,
      deviceId: reviewData.deviceId || undefined,
      status: 'pending',
      aiFeedback: reviewData.aiFeedback || undefined,
      aiAnalysis: reviewData.aiAnalysisData ? {
        webSearchPerformed: reviewData.aiAnalysisData.webSearchPerformed || false,
        dataSourceSummary: reviewData.aiAnalysisData.dataSourceSummary || {},
        imageQuality: reviewData.aiAnalysisData.imageQuality || 'buona',
        analysisComplete: true,
        overallConfidence: reviewData.aiAnalysisData.confidence || 0,
        processingTime: reviewData.aiAnalysisData.processingTime || ''
      } : undefined
    });

    return await review.save();
  }

  /**
   * Aggiorna le statistiche dell'utente
   * @param {string} userId - ID utente
   * @param {number} reviewsAdded - Numero recensioni aggiunte
   */
  static async updateUserStats(userId, reviewsAdded) {
    try {
      await User.findByIdAndUpdate(userId, {
        $inc: { reviewsCount: reviewsAdded },
        $set: { lastActivity: new Date() }
      });

      logger.debug('[ReviewService] Statistiche utente aggiornate', {
        userId,
        reviewsAdded
      });
    } catch (error) {
      logger.error('[ReviewService] Errore aggiornamento statistiche utente', {
        userId,
        error: error.message
      });
      // Non interrompiamo il processo per questo errore
    }
  }

  /**
   * Ottieni recensioni di un utente con paginazione
   * @param {string} userId - ID utente
   * @param {Object} options - Opzioni paginazione
   * @returns {Promise<Object>} - Recensioni paginate
   */
  static async getUserReviews(userId, options = {}) {
    const {
      page = 1,
      limit = 10,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = options;

    // Cache key basato sui parametri
    const cacheKey = `user_reviews:${userId}:${page}:${limit}:${sortBy}:${sortOrder}`;
    
    // Controllo cache
    const cached = cacheService.getDB(cacheKey);
    if (cached) {
      logger.debug('[ReviewService] Cache hit per user reviews', { userId, page, limit });
      return cached;
    }

    const skip = (page - 1) * limit;
    const sort = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };

    const [reviews, total] = await Promise.all([
      Review.find({ user: userId })
        .populate('beer', 'name style')
        .populate('brewery', 'name')
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean(),
      Review.countDocuments({ user: userId })
    ]);

    const result = {
      reviews,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1
      }
    };

    // Cache per 10 minuti
    cacheService.setDB(cacheKey, result, 600);
    
    logger.debug('[ReviewService] User reviews cached', { userId, page, limit, total });

    return result;
  }

  /**
   * Calcola statistiche recensioni per birra
   * @param {string} beerId - ID birra
   * @returns {Promise<Object>} - Statistiche birra
   */
  static async getBeerStats(beerId) {
    // Cache key per statistiche birra
    const cacheKey = `beer_stats:${beerId}`;
    
    // Controllo cache
    const cached = cacheService.getDB(cacheKey);
    if (cached) {
      logger.debug('[ReviewService] Cache hit per beer stats', { beerId });
      return cached;
    }

    const stats = await Review.aggregate([
      { $match: { beer: beerId } },
      {
        $group: {
          _id: '$beer',
          averageRating: { $avg: '$rating' },
          totalReviews: { $sum: 1 },
          ratings: { $push: '$rating' }
        }
      }
    ]);

    let result;
    if (stats.length === 0) {
      result = {
        averageRating: 0,
        totalReviews: 0,
        distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
      };
    } else {
      const stat = stats[0];
      const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
      
      stat.ratings.forEach(rating => {
        distribution[rating] = (distribution[rating] || 0) + 1;
      });

      result = {
        averageRating: Math.round(stat.averageRating * 10) / 10,
        totalReviews: stat.totalReviews,
        distribution
      };
    }

    // Cache per 30 minuti (le stats cambiano meno frequentemente)
    cacheService.setDB(cacheKey, result, 1800);
    
    logger.debug('[ReviewService] Beer stats cached', { beerId, totalReviews: result.totalReviews });

    return result;
  }
}

module.exports = ReviewService;
