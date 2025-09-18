/**
 * Script per gestione grafici dashboard birrificio
 * Gestisce errori JSON e apostrofi nei nomi delle birre
 */

// Inizializzazione dashboard
function initBreweryDashboard(timelineJson, advancedStatsJson, stats) {
    console.log('� Inizializzazione dashboard birrificio...');
    console.log('Timeline JSON ricevuto:', timelineJson);
    console.log('Advanced stats JSON ricevuto:', advancedStatsJson);
    console.log('Stats ricevuto:', stats);

    // Inizializza i grafici direttamente (non aspettare DOMContentLoaded)
    initMainChart(timelineJson, stats);

    // Controllo più robusto per i dati advanced stats
    const hasAdvancedStats = advancedStatsJson && 
        ((advancedStatsJson.topBeers && advancedStatsJson.topBeers.length > 0) ||
         (advancedStatsJson.ratingDistribution && advancedStatsJson.ratingDistribution.length > 0) ||
         (advancedStatsJson.weekdayActivity && advancedStatsJson.weekdayActivity.length > 0));

    if (hasAdvancedStats) {
        console.log('📊 Inizializzazione grafici avanzati...');
        console.log('Top beers:', advancedStatsJson.topBeers);
        console.log('Rating distribution:', advancedStatsJson.ratingDistribution);
        console.log('Weekday activity:', advancedStatsJson.weekdayActivity);
        
        initTopBeersChart(advancedStatsJson.topBeers);
        initRatingDistributionChart(advancedStatsJson.ratingDistribution);
        initWeekdayActivityChart(advancedStatsJson.weekdayActivity);
    } else {
        console.warn('⚠️ Dati advanced stats non disponibili o vuoti');
        console.warn('Advanced stats data:', advancedStatsJson);
    }

    console.log('✅ Dashboard inizializzata con successo!');
}

// Grafico principale timeline recensioni
function initMainChart(timelineJson, stats) {
    const ctx = document.getElementById('reviewsChart');
    if (!ctx) {
        console.warn('Canvas reviewsChart non trovato');
        return;
    }
    
    // Distruggi grafico esistente se presente
    if (Chart.getChart(ctx)) {
        Chart.getChart(ctx).destroy();
        console.log('🗑️ Grafico esistente distrutto');
    }
    
    // I dati arrivano già parsati dal template, non serve safeJsonParse
    const timelineData = Array.isArray(timelineJson) ? timelineJson : [];
    
    // Filtra dati validi
    const validData = timelineData.filter(item => 
        item._id && 
        item._id.month !== null && 
        item._id.month !== undefined &&
        item._id.year !== null && 
        item._id.year !== undefined
    );
    
    // Fallback se non ci sono dati
    if (validData.length === 0) {
        const now = new Date();
        validData.push({
            _id: { month: now.getMonth() + 1, year: now.getFullYear() },
            count: stats.totalReviews || 1,
            avgRating: stats.avgRating || 3
        });
    }
    
    // Prepara dati per Chart.js
    const labels = validData.map(item => {
        const month = item._id.month || new Date().getMonth() + 1;
        const year = item._id.year || new Date().getFullYear();
        return `${month.toString().padStart(2, '0')}/${year}`;
    });
    
    const reviewCounts = validData.map(item => item.count || 0);
    const avgRatings = validData.map(item => parseFloat((item.avgRating || 0).toFixed(1)));
    
    new Chart(ctx.getContext('2d'), {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Recensioni',
                data: reviewCounts,
                borderColor: '#3b82f6',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                tension: 0.4,
                yAxisID: 'y'
            }, {
                label: 'Rating Medio',
                data: avgRatings,
                borderColor: '#10b981',
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                tension: 0.4,
                yAxisID: 'y1'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: 'Andamento Recensioni nel Tempo'
                }
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Periodo (MM/YYYY)'
                    }
                },
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    title: {
                        display: true,
                        text: 'Numero Recensioni'
                    },
                    beginAtZero: true
                },
                y1: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    title: {
                        display: true,
                        text: 'Rating Medio'
                    },
                    min: 1,
                    max: 5,
                    grid: {
                        drawOnChartArea: false,
                    }
                }
            }
        }
    });
}

// Grafico top birre
function initTopBeersChart(topBeersJson) {
    const ctx = document.getElementById('topBeersChart');
    if (!ctx) return;
    
    // Distruggi grafico esistente se presente
    if (Chart.getChart(ctx)) {
        Chart.getChart(ctx).destroy();
    }
    
    // I dati arrivano già parsati dal template
    const topBeersData = Array.isArray(topBeersJson) ? topBeersJson : [];
    if (topBeersData.length === 0) return;
    
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: topBeersData.map(beer => beer.beerName || 'Birra sconosciuta'),
            datasets: [{
                label: 'Numero Recensioni',
                data: topBeersData.map(beer => beer.totalReviews),
                backgroundColor: 'rgba(59, 130, 246, 0.8)',
                borderColor: '#3b82f6',
                borderWidth: 1,
                yAxisID: 'y'
            }, {
                label: 'Rating Medio',
                data: topBeersData.map(beer => parseFloat(beer.avgRating.toFixed(1))),
                type: 'line',
                borderColor: '#10b981',
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                tension: 0.4,
                yAxisID: 'y1'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: 'Performance delle Birre Più Recensite'
                }
            },
            scales: {
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Numero Recensioni'
                    }
                },
                y1: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    min: 1,
                    max: 5,
                    title: {
                        display: true,
                        text: 'Rating Medio'
                    },
                    grid: {
                        drawOnChartArea: false,
                    }
                }
            }
        }
    });
}

// Grafico distribuzione rating
function initRatingDistributionChart(ratingJson) {
    const ctx = document.getElementById('ratingDistributionChart');
    if (!ctx) return;
    
    // Distruggi grafico esistente se presente
    if (Chart.getChart(ctx)) {
        Chart.getChart(ctx).destroy();
    }
    
    // I dati arrivano già parsati dal template
    const ratingData = Array.isArray(ratingJson) ? ratingJson : [];
    if (ratingData.length === 0) return;
    
    new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ratingData.map(item => `${item._id} stelle`),
            datasets: [{
                data: ratingData.map(item => item.count),
                backgroundColor: [
                    '#ef4444', // 1 stella - rosso
                    '#f59e0b', // 2 stelle - arancione
                    '#eab308', // 3 stelle - giallo
                    '#22c55e', // 4 stelle - verde
                    '#10b981'  // 5 stelle - verde scuro
                ],
                borderWidth: 2,
                borderColor: '#ffffff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: 'Distribuzione delle Valutazioni'
                },
                legend: {
                    position: 'right'
                }
            }
        }
    });
}

// Grafico attività settimanale
function initWeekdayActivityChart(weekdayJson) {
    const ctx = document.getElementById('weekdayChart');
    if (!ctx) return;
    
    // Distruggi grafico esistente se presente
    if (Chart.getChart(ctx)) {
        Chart.getChart(ctx).destroy();
    }
    
    // I dati arrivano già parsati dal template
    const weekdayData = Array.isArray(weekdayJson) ? weekdayJson : [];
    if (weekdayData.length === 0) return;
    
    new Chart(ctx, {
        type: 'radar',
        data: {
            labels: weekdayData.map(day => day.dayName),
            datasets: [{
                label: 'Recensioni',
                data: weekdayData.map(day => day.count),
                backgroundColor: 'rgba(139, 92, 246, 0.2)',
                borderColor: '#8b5cf6',
                borderWidth: 2,
                pointBackgroundColor: '#8b5cf6',
                pointBorderColor: '#ffffff',
                pointBorderWidth: 2
            }, {
                label: 'Rating Medio',
                data: weekdayData.map(day => day.avgRating),
                backgroundColor: 'rgba(6, 182, 212, 0.2)',
                borderColor: '#06b6d4',
                borderWidth: 2,
                pointBackgroundColor: '#06b6d4',
                pointBorderColor: '#ffffff',
                pointBorderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: 'Distribuzione Attività Settimanale'
                }
            },
            scales: {
                r: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Intensità Attività'
                    }
                }
            }
        }
    });
}

// Funzioni globali per il template
window.initBreweryDashboard = initBreweryDashboard;
