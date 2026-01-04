// File generato dinamicamente dal server - NON MODIFICARE MANUALMENTE
// Rendi i dati analytics disponibili al JavaScript
console.log('📊 Caricamento dati analytics nel frontend...');

try {
    window.analyticsData = {
        ratingDistribution: [{"_id":null,"count":1},{"_id":2,"count":3},{"_id":3,"count":4},{"_id":4,"count":4},{"_id":5,"count":2}],
        monthlyTrend: [{"_id":{"year":2025,"month":12},"count":11}],
        beerTypesStats: [{"_id":"Ale","count":2,"avgRating":3.5},{"_id":"è animata dal sapere e dalla passione di tutti coloro che lavorano alla creazione di birra","count":2,"avgRating":4.5},{"_id":"tipo di birra\n \t\t\t\t \n\t\t\t\t \n\t\t\t\t \n\t\t\t\t \n\t\t\t\t\t\t\t\t\tlager non filtrata \t\t\t\t\t\t\t\t \n\t\t\t\t \n\t\t\t\t\t \n\t\t \n\t\t\t\t \n\t\t\t \n\t\t\t\t\t\t \n\t\t\t\t \n\t\t\t\t\t aroma \t\t\t\t \n\t\t\t\t \n\t\t\t\t \n\t\t\t\t \n\t\t\t\t\t\t\t\t\tfruttato con un leggero sentore di luppolo \t\t\t\t\t\t\t\t \n\t\t\t\t \n\t\t\t\t\t \n\t\t \n\t\t\t\t\t \n\t\t \n\t\t\t\t \n\t\t\t\t\t\t \n\t\t\t\t\t \n\t\t\t \n\t\t\t\t\t\t \n\t\t\t\t \n\t\t\t\t\t gusto\n \t\t\t\t \n\t\t\t\t \n\t\t\t\t \n\t\t\t\t \n\t\t\t\t\t\t\t\t\tintenso e rotondo,","count":2,"avgRating":3},{"_id":"stile classico,","count":1,"avgRating":3},{"_id":"type:layoutchilddisplaydropdown,","count":1,"avgRating":2},{"_id":"Ipa","count":1,"avgRating":4},{"_id":"stile birrificio italiano.","count":1,"avgRating":2}]
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