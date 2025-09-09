// File generato dinamicamente dal server - NON MODIFICARE MANUALMENTE
// Rendi i dati analytics disponibili al JavaScript
console.log('📊 Caricamento dati analytics nel frontend...');

try {
    window.analyticsData = {
        ratingDistribution: [{"_id":1,"count":8},{"_id":2,"count":6},{"_id":3,"count":3},{"_id":4,"count":14},{"_id":5,"count":13}],
        monthlyTrend: [{"_id":{"year":2025,"month":9},"count":3},{"_id":{"year":2025,"month":8},"count":33}],
        beerTypesStats: [{"_id":"Lager","count":15,"avgRating":3.3333333333333335},{"_id":"Flanders Red Ale","count":4,"avgRating":4.5},{"_id":"Birra cruda","count":2,"avgRating":3.5}]
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

// Inizializza il gestore delle statistiche quando il DOM è pronto
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Inizializzazione StatisticsManager...');
    try {
        window.statisticsManager = new StatisticsManager();
        console.log('✅ StatisticsManager inizializzato con successo');
    } catch (error) {
        console.error('❌ Errore nell\'inizializzazione StatisticsManager:', error);
    }
});