const mongoose = require('mongoose');
const ReviewService = require('../src/services/reviewService');
const config = require('../config/config');

/**
 * Test semplice per verificare i nuovi metodi di statistiche birrifici
 */
async function testBreweryStats() {
  try {
    console.log('🧪 Test statistiche birrifici...');
    
    // Connetti al database
    await mongoose.connect(config.MONGODB_URL);
    console.log('✅ Connesso al database');
    
    // Test 1: Trova un birrificio con recensioni esistenti
    const Review = require('../src/models/Review');
    const sampleReview = await Review.findOne()
      .populate({
        path: 'ratings.beer',
        populate: { path: 'brewery' }
      });
    
    if (!sampleReview || !sampleReview.ratings[0]?.beer?.brewery) {
      console.log('⚠️  Nessuna recensione con birrificio trovata per il test');
      return;
    }
    
    const testBreweryId = sampleReview.ratings[0].beer.brewery._id;
    const breweryName = sampleReview.ratings[0].beer.brewery.breweryName;
    
    console.log(`🏭 Test su birrificio: ${breweryName} (${testBreweryId})`);
    
    // Test 2: Statistiche singolo birrificio
    console.log('\n📊 Test getBreweryStats...');
    const breweryStats = await ReviewService.getBreweryStats(testBreweryId);
    
    console.log(`✅ Statistiche birrificio:`, {
      totalReviews: breweryStats.totalReviews,
      totalBeers: breweryStats.totalBeers,
      totalUsers: breweryStats.totalUsers,
      averageRating: breweryStats.averageRating,
      beerCount: breweryStats.beerBreakdown.length
    });
    
    // Test 3: Statistiche tutti i birrifici (prime 5)
    console.log('\n📋 Test getAllBreweriesStats...');
    const allStats = await ReviewService.getAllBreweriesStats({
      page: 1,
      limit: 5,
      sortBy: 'totalReviews',
      sortOrder: 'desc'
    });
    
    console.log(`✅ Statistiche generali:`, {
      totalBreweries: allStats.summary.totalBreweries,
      totalReviews: allStats.summary.totalReviews,
      totalBeers: allStats.summary.totalBeers,
      averageRating: allStats.summary.averageRating,
      returnedCount: allStats.breweries.length
    });
    
    // Mostra top 3 birrifici
    console.log('\n🏆 Top 3 birrifici per recensioni:');
    allStats.breweries.slice(0, 3).forEach((brewery, index) => {
      console.log(`${index + 1}. ${brewery.breweryName}: ${brewery.totalReviews} recensioni, rating ${brewery.averageRating}`);
    });
    
    console.log('\n✅ Test completato con successo!');
    
  } catch (error) {
    console.error('❌ Errore durante il test:', error.message);
    console.error(error.stack);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnesso dal database');
  }
}

// Esegui test se chiamato direttamente
if (require.main === module) {
  testBreweryStats();
}

module.exports = { testBreweryStats };
