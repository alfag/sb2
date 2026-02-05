// File generato dinamicamente dal server - NON MODIFICARE MANUALMENTE
// Rendi i dati analytics disponibili al JavaScript
console.log('📊 Caricamento dati analytics nel frontend...');

try {
    window.analyticsData = {
        ratingDistribution: [{"_id":2,"count":2},{"_id":3,"count":4},{"_id":4,"count":5}],
        monthlyTrend: [{"_id":{"year":2026,"month":2},"count":1},{"_id":{"year":2026,"month":1},"count":8}],
        beerTypesStats: [{"_id":"Lager non filtrata","count":2,"avgRating":4},{"_id":"Belgian Blond Ale","count":1,"avgRating":3},{"_id":"Belgian IPA","count":1,"avgRating":4},{"_id":"Belgian-Style Wheat Ale","count":1,"avgRating":4},{"_id":"West Coast IPA","count":1,"avgRating":2},{"_id":"Lager analcolica","count":1,"avgRating":2},{"_id":"Session IPA","count":1,"avgRating":3},{"_id":"Irish Lager","count":1,"avgRating":3}]
    };
    console.log('✅ Dati analytics caricati nel frontend:', window.analyticsData);
    console.log('🔍 Rating distribution:', window.analyticsData.ratingDistribution);
    console.log('🔍 Monthly trend:', window.analyticsData.monthlyTrend);
    console.log('🔍 Beer types stats:', window.analyticsData.beerTypesStats);
} catch (error) {
    console.error('❌ Errore nel caricamento dati analytics:', error);
    window.analyticsData = {
        ratingDistribution: [],
        monthlyTrend: [],
        beerTypesStats: []
    };
}

// NOTA: StatisticsManager viene inizializzato automaticamente da statisticsManager.js
// Non è necessario inizializzarlo qui per evitare doppia inizializzazione