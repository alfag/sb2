const Review = require('../models/Review');
const User = require('../models/User');
const Beer = require('../models/Beer');
const Brewery = require('../models/Brewery');
const mongoose = require('mongoose');
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
      
      // Invalida cache birre
      beerIds.forEach(beerId => {
        cacheService.invalidatePattern(`beer_stats:${beerId}`);
      });
      
      // Ottieni IDs dei birrifici coinvolti per invalidare anche le loro cache
      const breweryIds = new Set(
        createdReviews.flatMap(r => 
          r.ratings.map(rating => rating.brewery?.toString()).filter(Boolean)
        )
      );
      
      // Invalida cache birrifici
      breweryIds.forEach(breweryId => {
        this.invalidateBreweryStatsCache(breweryId);
      });
      
      logger.info('[ReviewService] Cache invalidated after review creation', {
        userId: userId || 'guest',
        reviewsCreated: createdReviews.length,
        affectedBeers: beerIds.size,
        affectedBreweries: breweryIds.size
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
   * Trova una birra esistente o la crea se non esiste
   * @param {Object} reviewData - Dati della recensione contenenti info sulla birra
   * @param {boolean} isGuestUser - Se l'utente è guest
   * @returns {Promise<Object>} - Oggetto birra
   */
  static async findOrCreateBeer(reviewData, isGuestUser = false) {
    const { beerName, beerId } = reviewData;
    
    // Se abbiamo un beerId, verifica che la birra esista
    if (beerId) {
      const beer = await Beer.findById(beerId).populate('brewery');
      if (beer) {
        logger.debug('[ReviewService] Birra trovata per ID', { beerId, beerName: beer.beerName });
        return beer;
      } else {
        logger.warn('[ReviewService] Birra non trovata per ID fornito', { beerId, fallbackName: beerName });
      }
    }
    
    // Cerca per nome se non abbiamo ID o se l'ID non è valido
    if (beerName) {
      const normalizedName = beerName.toLowerCase().trim();
      const existingBeer = await Beer.findOne({
        $or: [
          { beerName: new RegExp('^' + beerName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i') },
          { normalizedName: normalizedName }
        ]
      }).populate('brewery');
      
      if (existingBeer) {
        logger.debug('[ReviewService] Birra trovata per nome', { 
          beerName, 
          foundId: existingBeer._id,
          foundName: existingBeer.beerName 
        });
        return existingBeer;
      }
    }
    
    // Se la birra non esiste, creala (solo per utenti autenticati o con dati sufficienti)
    if (!beerName) {
      throw ErrorHandler.createHttpError(400, 'Nome birra mancante per creazione', 'Beer name required for creation');
    }
    
    // Per utenti guest, crea sempre nuove birre (potrebbero essere temporanee)
    // Per utenti autenticati, verifica se creare effettivamente la birra
    logger.info('[ReviewService] Creazione nuova birra', { 
      beerName, 
      isGuestUser,
      hasBreweryData: !!reviewData.brewery || !!reviewData.breweryName
    });
    
    // Cerca o crea birrificio se non fornito
    let breweryId = reviewData.brewery;
    if (!breweryId && reviewData.breweryName) {
      const brewery = await this.findOrCreateBrewery(reviewData.breweryName);
      breweryId = brewery._id;
    }
    
    if (!breweryId) {
      throw ErrorHandler.createHttpError(400, 'Birrificio mancante per creazione birra', 'Brewery required for beer creation');
    }
    
    // Crea la birra
    const newBeer = new Beer({
      beerName: beerName,
      brewery: breweryId,
      alcoholContent: reviewData.aiData?.alcoholContent || '',
      beerType: reviewData.aiData?.beerType || '',
      beerSubStyle: reviewData.aiData?.beerSubStyle || '',
      ibu: reviewData.aiData?.ibu || '',
      volume: reviewData.aiData?.volume || '',
      description: reviewData.aiData?.description || '',
      ingredients: reviewData.aiData?.ingredients || '',
      tastingNotes: reviewData.notes || reviewData.aiData?.tastingNotes || '',
      nutritionalInfo: reviewData.aiData?.nutritionalInfo || '',
      price: reviewData.aiData?.price || '',
      availability: reviewData.aiData?.availability || '',
      aiExtracted: !!reviewData.aiData,
      aiConfidence: reviewData.aiData?.confidence || 0,
      dataSource: reviewData.aiData?.dataSource || 'manual',
      lastAiUpdate: new Date()
    });
    
    const savedBeer = await newBeer.save();
    const populatedBeer = await Beer.findById(savedBeer._id).populate('brewery');
    
    logger.info('[ReviewService] Birra creata con successo', {
      beerId: savedBeer._id,
      beerName: savedBeer.beerName,
      breweryId: breweryId,
      isGuestUser
    });
    
    return populatedBeer;
  }

  /**
   * Trova un birrificio esistente o lo crea se non esiste
   * @param {string} breweryName - Nome del birrificio
   * @returns {Promise<Object>} - Oggetto birrificio
   */
  static async findOrCreateBrewery(breweryName) {
    if (!breweryName) {
      throw ErrorHandler.createHttpError(400, 'Nome birrificio mancante', 'Brewery name required');
    }
    
    // Cerca birrificio esistente
    const normalizedName = breweryName.toLowerCase().trim();
    let brewery = await Brewery.findOne({
      $or: [
        { breweryName: new RegExp('^' + breweryName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i') },
        { breweryName: normalizedName }
      ]
    });
    
    if (brewery) {
      logger.debug('[ReviewService] Birrificio trovato', { 
        breweryName, 
        foundId: brewery._id,
        foundName: brewery.breweryName 
      });
      return brewery;
    }
    
    // Crea nuovo birrificio
    brewery = new Brewery({
      breweryName: breweryName,
      aiExtracted: false,
      lastAiUpdate: new Date()
    });
    
    const savedBrewery = await brewery.save();
    
    logger.info('[ReviewService] Birrificio creato con successo', {
      breweryId: savedBrewery._id,
      breweryName: savedBrewery.breweryName
    });
    
    return savedBrewery;
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
   * Controllo senza limiti temporali sui dati salvati nei Model
   * @param {string} userId - ID utente
   * @param {string} beerId - ID birra
   */
  static async checkDuplicateReview(userId, beerId) {
    // Cerca recensioni esistenti dell'utente per questa birra
    const existingReview = await Review.findOne({
      user: userId,
      'ratings.beer': beerId
    });

    if (existingReview) {
      logger.warn('[ReviewService] Recensione duplicata rilevata', {
        userId,
        beerId,
        existingReviewId: existingReview._id,
        existingReviewDate: existingReview.createdAt
      });
      
      throw ErrorHandler.createHttpError(409, 
        'Hai già recensito questa birra', 
        `User ${userId} has already reviewed beer ${beerId} in review ${existingReview._id}`
      );
    }
    
    logger.debug('[ReviewService] Nessuna recensione duplicata trovata', { userId, beerId });
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
  static async getBeerStats(beerId, skipCache = false) {
    // Cache key per statistiche birra
    const cacheKey = `beer_stats:${beerId}`;
    
    // Controllo cache solo se non richiesto di saltarla
    if (!skipCache) {
      const cached = cacheService.getDB(cacheKey);
      if (cached) {
        logger.debug('[ReviewService] Cache hit per beer stats', { beerId });
        return cached;
      }
    } else {
      logger.debug('[ReviewService] Cache bypassata per beer stats (admin dashboard)', { beerId });
    }

    const stats = await Review.aggregate([
      { $unwind: '$ratings' },
      { $match: { 'ratings.beer': new mongoose.Types.ObjectId(beerId) } },
      {
        $group: {
          _id: '$ratings.beer',
          averageRating: { $avg: '$ratings.rating' },
          totalReviews: { $sum: 1 },
          ratings: { $push: '$ratings.rating' },
          // Statistiche dettagliate se presenti
          avgAppearance: { $avg: '$ratings.detailedRatings.appearance.rating' },
          avgAroma: { $avg: '$ratings.detailedRatings.aroma.rating' },
          avgTaste: { $avg: '$ratings.detailedRatings.taste.rating' },
          avgMouthfeel: { $avg: '$ratings.detailedRatings.mouthfeel.rating' },
          avgOverall: { $avg: '$ratings.detailedRatings.overall.rating' }
        }
      }
    ]);

    let result;
    if (stats.length === 0) {
      result = {
        averageRating: 0,
        totalReviews: 0,
        distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
        detailedRatings: {
          appearance: 0,
          aroma: 0,
          taste: 0,
          mouthfeel: 0,
          overall: 0
        }
      };
    } else {
      const stat = stats[0];
      const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
      
      stat.ratings.forEach(rating => {
        const roundedRating = Math.round(rating);
        distribution[roundedRating] = (distribution[roundedRating] || 0) + 1;
      });

      result = {
        averageRating: Math.round(stat.averageRating * 10) / 10,
        totalReviews: stat.totalReviews,
        distribution,
        detailedRatings: {
          appearance: stat.avgAppearance ? Math.round(stat.avgAppearance * 10) / 10 : 0,
          aroma: stat.avgAroma ? Math.round(stat.avgAroma * 10) / 10 : 0,
          taste: stat.avgTaste ? Math.round(stat.avgTaste * 10) / 10 : 0,
          mouthfeel: stat.avgMouthfeel ? Math.round(stat.avgMouthfeel * 10) / 10 : 0,
          overall: stat.avgOverall ? Math.round(stat.avgOverall * 10) / 10 : 0
        }
      };
    }

    // Cache solo se non richiesto di saltarla (non per admin dashboard)
    if (!skipCache) {
      cacheService.setDB(cacheKey, result, 1800);
      logger.debug('[ReviewService] Beer stats cached', { beerId, totalReviews: result.totalReviews });
    } else {
      logger.debug('[ReviewService] Cache saltata per beer stats (admin dashboard)', { beerId, totalReviews: result.totalReviews });
    }

    return result;
  }

  /**
   * Calcola statistiche aggregate per birrificio
   * @param {string} breweryId - ID birrificio
   * @returns {Promise<Object>} - Statistiche aggregate del birrificio
   */
  static async getBreweryStats(breweryId, skipCache = false) {
    // Cache key per statistiche birrificio
    const cacheKey = `brewery_stats:${breweryId}`;
    
    // Controllo cache solo se non richiesto di saltarla
    if (!skipCache) {
      const cached = cacheService.getDB(cacheKey);
      if (cached) {
        logger.debug('[ReviewService] Cache hit per brewery stats', { breweryId });
        return cached;
      }
    } else {
      logger.debug('[ReviewService] Cache bypassata per brewery stats (admin dashboard)', { breweryId });
    }

    logger.info('[ReviewService] Calcolo statistiche birrificio', { breweryId });

    // Pipeline per calcolare statistiche aggregate del birrificio
    const stats = await Review.aggregate([
      { $unwind: '$ratings' },
      {
        $lookup: {
          from: 'beers',
          localField: 'ratings.beer',
          foreignField: '_id',
          as: 'beerInfo'
        }
      },
      { $unwind: '$beerInfo' },
      { $match: { 'beerInfo.brewery': new mongoose.Types.ObjectId(breweryId) } },
      {
        $group: {
          _id: '$beerInfo.brewery',
          totalReviews: { $sum: 1 },
          averageRating: { $avg: '$ratings.rating' },
          ratings: { $push: '$ratings.rating' },
          uniqueBeers: { $addToSet: '$beerInfo._id' },
          uniqueUsers: { $addToSet: '$user' },
          beerRatings: {
            $push: {
              beerId: '$beerInfo._id',
              beerName: '$beerInfo.beerName',
              rating: '$ratings.rating',
              detailedRatings: '$ratings.detailedRatings'
            }
          },
          // Statistiche dettagliate aggregate
          avgAppearance: { $avg: '$ratings.detailedRatings.appearance.rating' },
          avgAroma: { $avg: '$ratings.detailedRatings.aroma.rating' },
          avgTaste: { $avg: '$ratings.detailedRatings.taste.rating' },
          avgMouthfeel: { $avg: '$ratings.detailedRatings.mouthfeel.rating' },
          avgOverall: { $avg: '$ratings.detailedRatings.overall.rating' },
          // Date per trend analysis
          firstReview: { $min: '$createdAt' },
          lastReview: { $max: '$createdAt' }
        }
      }
    ]);

    let result;
    if (stats.length === 0) {
      result = {
        averageRating: 0,
        totalReviews: 0,
        totalBeers: 0,
        totalUsers: 0,
        distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
        detailedRatings: {
          appearance: 0,
          aroma: 0,
          taste: 0,
          mouthfeel: 0,
          overall: 0
        },
        beerBreakdown: [],
        reviewPeriod: null
      };
    } else {
      const stat = stats[0];
      const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
      
      // Calcola distribuzione ratings
      stat.ratings.forEach(rating => {
        const roundedRating = Math.round(rating);
        distribution[roundedRating] = (distribution[roundedRating] || 0) + 1;
      });

      // Raggruppa statistiche per birra
      const beerBreakdown = {};
      stat.beerRatings.forEach(beerRating => {
        const beerId = beerRating.beerId.toString();
        if (!beerBreakdown[beerId]) {
          beerBreakdown[beerId] = {
            beerId: beerRating.beerId,
            beerName: beerRating.beerName,
            ratings: [],
            totalReviews: 0,
            averageRating: 0
          };
        }
        beerBreakdown[beerId].ratings.push(beerRating.rating);
        beerBreakdown[beerId].totalReviews++;
      });

      // Calcola medie per ogni birra
      const beerStats = Object.values(beerBreakdown).map(beer => ({
        beerId: beer.beerId,
        beerName: beer.beerName,
        totalReviews: beer.totalReviews,
        averageRating: Math.round((beer.ratings.reduce((sum, r) => sum + r, 0) / beer.ratings.length) * 10) / 10,
        distribution: beer.ratings.reduce((dist, rating) => {
          const rounded = Math.round(rating);
          dist[rounded] = (dist[rounded] || 0) + 1;
          return dist;
        }, { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 })
      })).sort((a, b) => b.averageRating - a.averageRating);

      result = {
        averageRating: Math.round(stat.averageRating * 10) / 10,
        totalReviews: stat.totalReviews,
        totalBeers: stat.uniqueBeers.length,
        totalUsers: stat.uniqueUsers.filter(u => u !== null).length, // Escludi guest users
        distribution,
        detailedRatings: {
          appearance: stat.avgAppearance ? Math.round(stat.avgAppearance * 10) / 10 : 0,
          aroma: stat.avgAroma ? Math.round(stat.avgAroma * 10) / 10 : 0,
          taste: stat.avgTaste ? Math.round(stat.avgTaste * 10) / 10 : 0,
          mouthfeel: stat.avgMouthfeel ? Math.round(stat.avgMouthfeel * 10) / 10 : 0,
          overall: stat.avgOverall ? Math.round(stat.avgOverall * 10) / 10 : 0
        },
        beerBreakdown: beerStats,
        reviewPeriod: {
          firstReview: stat.firstReview,
          lastReview: stat.lastReview,
          daysActive: stat.firstReview && stat.lastReview ? 
            Math.ceil((stat.lastReview - stat.firstReview) / (1000 * 60 * 60 * 24)) : 0
        }
      };
    }

    // Cache solo se non richiesto di saltarla (non per admin dashboard)
    if (!skipCache) {
      cacheService.setDB(cacheKey, result, 3600);
      logger.info('[ReviewService] Brewery stats cached', { 
        breweryId, 
        totalReviews: result.totalReviews,
        totalBeers: result.totalBeers,
        averageRating: result.averageRating
      });
    } else {
      logger.info('[ReviewService] Cache saltata per brewery stats (admin dashboard)', {
        breweryId, 
        totalReviews: result.totalReviews,
        totalBeers: result.totalBeers,
        averageRating: result.averageRating
      });
    }

    return result;
  }

  /**
   * Ottieni statistiche complete di tutti i birrifici per admin
   * @param {Object} options - Opzioni per filtri e paginazione
   * @returns {Promise<Object>} - Statistiche di tutti i birrifici
   */
  static async getAllBreweriesStats(options = {}) {
    const {
      page = 1,
      limit = 20,
      sortBy = 'averageRating',
      sortOrder = 'desc',
      minReviews = 0,
      breweryFilter = '',
      skipCache = false // Nuovo parametro per saltare la cache
    } = options;

    // Cache key basato sui parametri (incluso filtro birrificio)
    const cacheKey = `all_breweries_stats:${page}:${limit}:${sortBy}:${sortOrder}:${minReviews}:${breweryFilter}`;
    
    // Controllo cache solo se non richiesto di saltarla
    if (!skipCache) {
      const cached = cacheService.getDB(cacheKey);
      if (cached) {
        logger.debug('[ReviewService] Cache hit per all breweries stats', { page, limit, breweryFilter });
        return cached;
      }
    } else {
      logger.info('[ReviewService] Cache bypassata per all breweries stats (admin dashboard)', { page, limit, breweryFilter });
    }

    logger.info('[ReviewService] Calcolo statistiche tutti i birrifici', { page, limit, sortBy, sortOrder, breweryFilter });

    // Aggiungi filtro per nome birrificio se specificato
    const breweryMatch = breweryFilter ? 
      { breweryName: { $regex: breweryFilter, $options: 'i' } } : 
      {};

    // Prima ottieni tutti i birrifici che hanno recensioni
    const breweriesWithReviews = await Review.aggregate([
      { $unwind: '$ratings' },
      {
        $lookup: {
          from: 'beers',
          localField: 'ratings.beer',
          foreignField: '_id',
          as: 'beerInfo'
        }
      },
      { $unwind: '$beerInfo' },
      {
        $group: {
          _id: '$beerInfo.brewery',
          reviewCount: { $sum: 1 }
        }
      },
      { $match: { reviewCount: { $gte: minReviews } } },
      {
        $lookup: {
          from: 'breweries',
          localField: '_id',
          foreignField: '_id',
          as: 'breweryInfo'
        }
      },
      { $unwind: '$breweryInfo' },
      // Aggiungi il filtro per nome birrificio
      ...(Object.keys(breweryMatch).length > 0 ? [{ $match: { 'breweryInfo.breweryName': breweryMatch.breweryName } }] : []),
      {
        $project: {
          _id: 1,
          breweryName: '$breweryInfo.breweryName',
          reviewCount: 1
        }
      }
    ]);

    const skip = (page - 1) * limit;
    const breweryStats = [];

    // Calcola statistiche per ogni birrificio (batch processing per performance)
    for (const brewery of breweriesWithReviews) {
      const stats = await this.getBreweryStats(brewery._id, skipCache);
      breweryStats.push({
        breweryId: brewery._id,
        breweryName: brewery.breweryName,
        ...stats
      });
    }

    // Ordinamento
    breweryStats.sort((a, b) => {
      const aVal = a[sortBy] || 0;
      const bVal = b[sortBy] || 0;
      return sortOrder === 'desc' ? bVal - aVal : aVal - bVal;
    });

    // Paginazione
    const paginatedStats = breweryStats.slice(skip, skip + limit);
    
    const result = {
      breweries: paginatedStats,
      pagination: {
        page,
        limit,
        total: breweryStats.length,
        pages: Math.ceil(breweryStats.length / limit),
        hasNext: page < Math.ceil(breweryStats.length / limit),
        hasPrev: page > 1
      },
      summary: {
        totalBreweries: breweryStats.length,
        totalReviews: breweryStats.reduce((sum, b) => sum + b.totalReviews, 0),
        totalBeers: breweryStats.reduce((sum, b) => sum + b.totalBeers, 0),
        averageRating: breweryStats.length > 0 ? 
          Math.round((breweryStats.reduce((sum, b) => sum + b.averageRating, 0) / breweryStats.length) * 10) / 10 : 0
      }
    };

    // Cache solo se non richiesto di saltarla (non per admin dashboard)
    if (!skipCache) {
      cacheService.setDB(cacheKey, result, 7200);
      logger.info('[ReviewService] All breweries stats cached', { 
        totalBreweries: result.summary.totalBreweries,
        totalReviews: result.summary.totalReviews
      });
    } else {
      logger.info('[ReviewService] Cache saltata per all breweries stats (admin dashboard)', {
        totalBreweries: result.summary.totalBreweries,
        totalReviews: result.summary.totalReviews
      });
    }

    return result;
  }

  /**
   * Invalida cache delle statistiche birrificio quando vengono aggiunte recensioni
   * @param {string} breweryId - ID birrificio
   */
  static invalidateBreweryStatsCache(breweryId) {
    cacheService.invalidatePattern(`brewery_stats:${breweryId}`);
    cacheService.invalidatePattern('all_breweries_stats:*');
    logger.debug('[ReviewService] Brewery stats cache invalidated', { breweryId });
  }
}

module.exports = ReviewService;
