/**
 * Statistics Manager - Ges    // Setup princ    // Se    // Setup principale
    setup() {
        console.log('📊 StatisticsManager - Inizializzazione dashboard avanzata...');
        this.setupChartDefaults();
        this.createCharts();
        this.setupEventHandlers();
        this.setupBreweryAutocomplete();
        this.enhanceUI();
        this.animateCounters();
        console.log('✅ Dashboard statistiche caricata con successo!');
    }pale
    setup() {
        console.log('📊 StatisticsManager - Inizializzazione dashboard avanzata...');
        this.setupChartDefaults();
        this.createCharts();
        this.setupEventHandlers();
        this.setupBreweryAutocomplete();
        this.enhanceUI();
        this.animateCounters();
        console.log('✅ Dashboard statistiche caricata con successo!');
    }setup() {
        console.log('📊 StatisticsManager - Inizializzazione dashboard avanzata...');
        
        // Verifica che Chart.js sia caricato
        if (typeof Chart === 'undefined') {
            console.error('❌ Chart.js non è caricato!');
            return;
        }
        
        console.log('✅ Chart.js versione:', Chart.version);
        
        this.setupChartDefaults();
        this.createCharts();
        this.setupEventHandlers();
        this.enhanceUI();
        this.animateCounters();
        console.log('✅ Dashboard statistiche caricata con successo!');
    }board avanzata con grafici interattivi
 */
class StatisticsManager {
    constructor() {
        this.charts = {};
        this.colors = {
            primary: '#3498db',
            secondary: '#e74c3c',
            success: '#27ae60',
            warning: '#f39c12',
            info: '#9b59b6',
            gradients: {
                blue: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                red: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                green: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
                orange: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)'
            }
        };
        this.init();
    }

    // Inizializzazione
    init() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.setup());
        } else {
            this.setup();
        }
    }

    // Setup principale
    setup() {
        console.log('� StatisticsManager - Inizializzazione dashboard avanzata...');
        this.setupChartDefaults();
        this.createCharts();
        this.setupEventHandlers();
        this.enhanceUI();
        this.animateCounters();
        console.log('✅ Dashboard statistiche caricata con successo!');
    }

    // Configurazione avanzata per Chart.js
    setupChartDefaults() {
        if (typeof Chart !== 'undefined') {
            Chart.defaults.font.family = 'Inter, system-ui, sans-serif';
            Chart.defaults.font.size = 12;
            Chart.defaults.color = '#2c3e50';
            Chart.defaults.plugins.tooltip.backgroundColor = 'rgba(44, 62, 80, 0.9)';
            Chart.defaults.plugins.tooltip.titleColor = '#fff';
            Chart.defaults.plugins.tooltip.bodyColor = '#fff';
            Chart.defaults.plugins.tooltip.cornerRadius = 8;
        }
    }

    // Crea tutti i grafici avanzati
    createCharts() {
        // Aggiungi un piccolo delay per assicurarsi che i canvas siano pronti
        setTimeout(() => {
            this.createRatingsChart();
            this.createBreweriesChart();
            this.createTrendChart();
            this.createBeerTypesChart();
        }, 100);
    }

    // Grafico distribuzione rating avanzato
    createRatingsChart() {
        const ctx = document.getElementById('ratingsChart');
        if (!ctx) {
            console.warn('Canvas ratingsChart non trovato');
            return;
        }

        console.log('Creazione grafico ratings...');

        // Ottieni il numero totale di recensioni dalla pagina
        const totalReviewsElement = document.querySelector('.hero-stat-number');
        const totalReviews = totalReviewsElement ? 
            parseInt(totalReviewsElement.textContent) || 100 : 100;

        this.charts.ratings = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['⭐ (1 stella)', '⭐⭐ (2 stelle)', '⭐⭐⭐ (3 stelle)', '⭐⭐⭐⭐ (4 stelle)', '⭐⭐⭐⭐⭐ (5 stelle)'],
                datasets: [{
                    data: [3, 8, 25, 42, 22],
                    backgroundColor: [
                        '#e74c3c',
                        '#e67e22',
                        '#f39c12',
                        '#27ae60',
                        '#2ecc71'
                    ],
                    borderWidth: 3,
                    borderColor: '#fff',
                    hoverOffset: 15
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            padding: 20,
                            usePointStyle: true,
                            font: { size: 11, weight: '600' }
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return context.label + ': ' + context.parsed + '% (' + 
                                       Math.round(context.parsed * totalReviews / 100) + ' recensioni)';
                            }
                        }
                    }
                },
                animation: {
                    animateRotate: true,
                    duration: 2000,
                    easing: 'easeOutBounce'
                }
            }
        });
        
        console.log('Grafico ratings creato con successo');
    }

    // Grafico top birrifici avanzato
    createBreweriesChart() {
        const ctx = document.getElementById('breweriesChart');
        if (!ctx) {
            console.warn('Canvas breweriesChart non trovato');
            return;
        }

        console.log('Creazione grafico birrifici...');

        // Estrai i dati dai birrifici dalla tabella
        const breweryData = this.extractBreweryData();

        this.charts.breweries = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: breweryData.names,
                datasets: [{
                    label: 'Recensioni',
                    data: breweryData.reviews,
                    backgroundColor: 'rgba(52, 152, 219, 0.8)',
                    borderColor: 'rgba(52, 152, 219, 1)',
                    borderWidth: 2,
                    borderRadius: 8,
                    borderSkipped: false,
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: { color: 'rgba(0,0,0,0.05)' },
                        ticks: { font: { weight: '600' } }
                    },
                    x: {
                        grid: { display: false },
                        ticks: { 
                            maxRotation: 45,
                            font: { weight: '600' }
                        }
                    }
                },
                animation: {
                    duration: 2000,
                    easing: 'easeOutQuart'
                }
            }
        });
        
        console.log('Grafico birrifici creato con successo');
    }

    // Grafico trend temporale avanzato
    createTrendChart() {
        const ctx = document.getElementById('trendChart');
        if (!ctx) return;

        this.charts.trend = new Chart(ctx, {
            type: 'line',
            data: {
                labels: ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set'],
                datasets: [{
                    label: 'Recensioni',
                    data: [12, 19, 25, 35, 28, 42, 38, 45, 52],
                    borderColor: this.colors.secondary,
                    backgroundColor: this.colors.secondary + '20',
                    borderWidth: 4,
                    fill: true,
                    tension: 0.4,
                    pointBackgroundColor: this.colors.secondary,
                    pointBorderColor: '#fff',
                    pointBorderWidth: 3,
                    pointRadius: 8,
                    pointHoverRadius: 10
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: { color: 'rgba(0,0,0,0.05)' },
                        ticks: { font: { weight: '600' } }
                    },
                    x: {
                        grid: { display: false },
                        ticks: { font: { weight: '600' } }
                    }
                },
                animation: {
                    duration: 2500,
                    easing: 'easeOutQuart'
                }
            }
        });
    }

    // Grafico tipologie birre avanzato
    createBeerTypesChart() {
        const ctx = document.getElementById('beerTypesChart');
        if (!ctx) return;

        this.charts.beerTypes = new Chart(ctx, {
            type: 'polarArea',
            data: {
                labels: ['IPA', 'Lager', 'Stout', 'Weizen', 'Pilsner', 'Ale'],
                datasets: [{
                    data: [4.2, 3.8, 4.5, 3.9, 4.1, 4.0],
                    backgroundColor: [
                        this.colors.primary + '80',
                        this.colors.success + '80',
                        this.colors.info + '80',
                        this.colors.warning + '80',
                        this.colors.secondary + '80',
                        '#34495e80'
                    ],
                    borderWidth: 3,
                    borderColor: '#fff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            padding: 15,
                            usePointStyle: true,
                            font: { weight: '600' }
                        }
                    }
                },
                scales: {
                    r: {
                        beginAtZero: true,
                        max: 5,
                        ticks: {
                            stepSize: 1,
                            font: { weight: '600' }
                        }
                    }
                },
                animation: {
                    duration: 2000,
                    easing: 'easeOutElastic'
                }
            }
        });
    }

    // Estrae i dati dei birrifici dalla tabella
    extractBreweryData() {
        const breweryRows = document.querySelectorAll('.table-modern tbody tr');
        const names = [];
        const reviews = [];

        breweryRows.forEach((row, index) => {
            if (index < 8) { // Prendi solo i primi 8
                const nameCell = row.querySelector('td:nth-child(2) a');
                const reviewsCell = row.querySelector('td:nth-child(4) .badge');
                
                if (nameCell && reviewsCell) {
                    names.push(nameCell.textContent.trim());
                    reviews.push(parseInt(reviewsCell.textContent) || 0);
                }
            }
        });

        // Fallback se non ci sono dati
        if (names.length === 0) {
            return {
                names: ['Baladin', 'Birrificio Italiano', 'Lambrate', 'Del Borgo', 'Toccalmatto'],
                reviews: [45, 38, 32, 28, 25]
            };
        }

        return { names, reviews };
    }

    // Setup event handlers avanzati
    setupEventHandlers() {
        this.setupFilterHandlers();
        this.setupHoverEffects();
    }

    // Gestisce i filtri dinamici
    setupFilterHandlers() {
        const filterForm = document.querySelector('form[action*="statistics"]');
        if (filterForm) {
            const filterInputs = filterForm.querySelectorAll('select, input[type="number"]');
            filterInputs.forEach(input => {
                input.addEventListener('change', () => {
                    if (input.type === 'number') {
                        clearTimeout(this.filterTimeout);
                        this.filterTimeout = setTimeout(() => {
                            this.showLoadingOverlay();
                            filterForm.submit();
                        }, 1000);
                    } else {
                        this.showLoadingOverlay();
                        filterForm.submit();
                    }
                });
            });
        }
    }

    // Aggiungi effetti hover avanzati
    setupHoverEffects() {
        // Cards hover effects
        document.querySelectorAll('.modern-card, .chart-card').forEach(card => {
            card.addEventListener('mouseenter', () => {
                card.style.transform = 'translateY(-8px)';
                card.style.transition = 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
            });
            
            card.addEventListener('mouseleave', () => {
                card.style.transform = 'translateY(0)';
            });
        });

        // Button hover effects
        document.querySelectorAll('.btn-modern').forEach(btn => {
            btn.addEventListener('mouseenter', () => {
                btn.style.transform = 'translateY(-2px)';
                btn.style.transition = 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
            });
            
            btn.addEventListener('mouseleave', () => {
                btn.style.transform = 'translateY(0)';
            });
        });
    }

    // Setup autocomplete per ricerca birrifici
    setupBreweryAutocomplete() {
        const breweryInput = document.getElementById('breweryFilter');
        const breweryDropdown = document.getElementById('breweryDropdown');
        const clearBtn = document.getElementById('clearBrewery');
        
        if (!breweryInput || !breweryDropdown || !clearBtn) {
            console.log('Elementi autocomplete non trovati');
            return;
        }

        let debounceTimer;
        let currentIndex = -1;
        let isDropdownVisible = false;

        // Mostra/nascondi il pulsante clear
        const toggleClearButton = () => {
            clearBtn.style.display = breweryInput.value.length > 0 ? 'flex' : 'none';
        };

        // Gestisce la ricerca con debounce
        const handleSearch = async (query) => {
            if (query.length < 3) {
                breweryDropdown.classList.remove('show');
                isDropdownVisible = false;
                return;
            }

            try {
                breweryDropdown.innerHTML = '<div class="autocomplete-loading">🔍 Ricerca in corso...</div>';
                breweryDropdown.classList.add('show');
                isDropdownVisible = true;

                const response = await fetch(`/administrator/statistics/breweries/search?q=${encodeURIComponent(query)}`);
                const breweries = await response.json();

                if (breweries.length === 0) {
                    breweryDropdown.innerHTML = '<div class="autocomplete-no-results">🚫 Nessun birrificio trovato</div>';
                } else {
                    breweryDropdown.innerHTML = breweries.map((brewery, index) => `
                        <div class="autocomplete-item" data-index="${index}" data-name="${brewery.name}">
                            <i class="fas fa-industry brewery-icon"></i>
                            ${brewery.name}
                        </div>
                    `).join('');

                    // Aggiungi event listeners agli item
                    breweryDropdown.querySelectorAll('.autocomplete-item').forEach(item => {
                        item.addEventListener('click', () => {
                            breweryInput.value = item.dataset.name;
                            breweryDropdown.classList.remove('show');
                            isDropdownVisible = false;
                            toggleClearButton();
                        });
                    });
                }
            } catch (error) {
                console.error('Errore durante la ricerca:', error);
                breweryDropdown.innerHTML = '<div class="autocomplete-no-results">❌ Errore durante la ricerca</div>';
            }
        };

        // Event listeners
        breweryInput.addEventListener('input', (e) => {
            const query = e.target.value.trim();
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => handleSearch(query), 300);
            toggleClearButton();
            currentIndex = -1;
        });

        breweryInput.addEventListener('keydown', (e) => {
            if (!isDropdownVisible) return;

            const items = breweryDropdown.querySelectorAll('.autocomplete-item');
            
            switch(e.key) {
                case 'ArrowDown':
                    e.preventDefault();
                    currentIndex = currentIndex < items.length - 1 ? currentIndex + 1 : 0;
                    updateHighlight(items);
                    break;
                case 'ArrowUp':
                    e.preventDefault();
                    currentIndex = currentIndex > 0 ? currentIndex - 1 : items.length - 1;
                    updateHighlight(items);
                    break;
                case 'Enter':
                    e.preventDefault();
                    if (currentIndex >= 0 && items[currentIndex]) {
                        breweryInput.value = items[currentIndex].dataset.name;
                        breweryDropdown.classList.remove('show');
                        isDropdownVisible = false;
                        toggleClearButton();
                    }
                    break;
                case 'Escape':
                    breweryDropdown.classList.remove('show');
                    isDropdownVisible = false;
                    break;
            }
        });

        // Update highlight per navigazione con tastiera
        const updateHighlight = (items) => {
            items.forEach((item, index) => {
                item.classList.toggle('highlighted', index === currentIndex);
            });
        };

        // Clear button
        clearBtn.addEventListener('click', () => {
            breweryInput.value = '';
            breweryDropdown.classList.remove('show');
            isDropdownVisible = false;
            toggleClearButton();
            breweryInput.focus();
        });

        // Nascondi dropdown quando si clicca fuori
        document.addEventListener('click', (e) => {
            if (!breweryInput.contains(e.target) && !breweryDropdown.contains(e.target)) {
                breweryDropdown.classList.remove('show');
                isDropdownVisible = false;
            }
        });

        // Inizializza stato pulsante clear
        toggleClearButton();
    }

    // Anima i contatori hero
    animateCounters() {
        setTimeout(() => {
            document.querySelectorAll('.hero-stat-number').forEach(counter => {
                const target = parseInt(counter.textContent);
                if (isNaN(target)) return;
                
                counter.textContent = '0';
                const increment = target / 50;
                let current = 0;
                
                const timer = setInterval(() => {
                    current += increment;
                    if (current >= target) {
                        counter.textContent = target;
                        clearInterval(timer);
                    } else {
                        counter.textContent = Math.floor(current);
                    }
                }, 30);
            });
        }, 500);
    }

    // Migliora l'interfaccia utente
    enhanceUI() {
        this.addAnimationClasses();
        this.enhanceProgressBars();
    }

    // Aggiunge classi di animazione
    addAnimationClasses() {
        // Anima le cards in sequenza
        document.querySelectorAll('.modern-card').forEach((card, index) => {
            card.style.opacity = '0';
            card.style.transform = 'translateY(30px)';
            
            setTimeout(() => {
                card.style.transition = 'opacity 0.6s ease-out, transform 0.6s ease-out';
                card.style.opacity = '1';
                card.style.transform = 'translateY(0)';
                card.classList.add('animate-slide-up');
            }, index * 200);
        });
    }

    // Migliora le progress bars
    enhanceProgressBars() {
        document.querySelectorAll('.progress-bar').forEach(bar => {
            const width = bar.style.width;
            bar.style.width = '0%';
            bar.style.transition = 'width 1.5s ease-out';
            
            setTimeout(() => {
                bar.style.width = width;
            }, 500);
        });
    }

    // Mostra overlay di caricamento
    showLoadingOverlay() {
        const overlay = document.createElement('div');
        overlay.className = 'loading-overlay';
        overlay.innerHTML = `
            <div class="loading-spinner">
                <div class="spinner"></div>
                <p>Aggiornamento dati...</p>
            </div>
        `;
        document.body.appendChild(overlay);
    }

    // Rimuovi overlay di caricamento
    hideLoadingOverlay() {
        const overlay = document.querySelector('.loading-overlay');
        if (overlay) {
            overlay.remove();
        }
    }

    // Aggiorna i grafici con nuovi dati
    updateCharts(newData) {
        if (newData.ratings && this.charts.ratings) {
            this.charts.ratings.data.datasets[0].data = newData.ratings;
            this.charts.ratings.update();
        }
        
        if (newData.breweries && this.charts.breweries) {
            this.charts.breweries.data.labels = newData.breweries.names;
            this.charts.breweries.data.datasets[0].data = newData.breweries.reviews;
            this.charts.breweries.update();
        }
    }

    // Distruggi tutti i grafici (cleanup)
    destroyCharts() {
        Object.values(this.charts).forEach(chart => {
            if (chart && typeof chart.destroy === 'function') {
                chart.destroy();
            }
        });
        this.charts = {};
    }
}

// Inizializza il manager avanzato
document.addEventListener('DOMContentLoaded', () => {
    console.log('📊 Inizializzazione StatisticsManager avanzato...');
    window.statisticsManager = new StatisticsManager();
});

// Cleanup al cambio pagina
window.addEventListener('beforeunload', () => {
    if (window.statisticsManager) {
        window.statisticsManager.destroyCharts();
    }
});