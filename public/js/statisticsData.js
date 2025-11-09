// File generato dinamicamente dal server - NON MODIFICARE MANUALMENTE
// Rendi i dati analytics disponibili al JavaScript
console.log('📊 Caricamento dati analytics nel frontend...');

try {
    window.analyticsData = {
        ratingDistribution: [{"_id":1,"count":1},{"_id":3,"count":1},{"_id":4,"count":1},{"_id":5,"count":1}],
        monthlyTrend: [{"_id":{"year":2025,"month":10},"count":1}],
        beerTypesStats: [{"_id":"Lager","count":4,"avgRating":3.25}]
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