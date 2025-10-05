// File generato dinamicamente dal server - NON MODIFICARE MANUALMENTE
// Rendi i dati analytics disponibili al JavaScript
console.log('📊 Caricamento dati analytics nel frontend...');

try {
    window.analyticsData = {
        ratingDistribution: [],
        monthlyTrend: [],
        beerTypesStats: []
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