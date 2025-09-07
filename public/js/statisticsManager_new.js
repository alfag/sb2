/**
 * Statistics Manager - Gestione dashboard avanzata con grafici interattivi
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
        console.log('📊 StatisticsManager - Inizializzazione dashboard avanzata...');
        this.setupChartDefaults();
        this.createCharts();
        this.setupEventHandlers();
        this.setupBreweryAutocomplete();
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
        if (!ctx) return;

        const data = {
            labels: ['★★★★★', '★★★★☆', '★★★☆☆', '★★☆☆☆', '★☆☆☆☆'],
            datasets: [{
                data: [45, 30, 15, 7, 3],
                backgroundColor: [
                    this.colors.success,
                    this.colors.primary,
                    this.colors.warning,
                    this.colors.secondary,
                    '#95a5a6'
                ],
                borderWidth: 0,
                hoverOffset: 10
            }]
        };

        this.charts.ratings = new Chart(ctx, {
            type: 'doughnut',
            data: data,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            padding: 20,
                            usePointStyle: true,
                            pointStyle: 'circle'
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return context.label + ': ' + context.parsed + '%';
                            }
                        }
                    }
                },
                cutout: '60%'
            }
        });
    }

    // Grafico top birrifici
    createBreweriesChart() {
        const ctx = document.getElementById('breweriesChart');
        if (!ctx) return;

        const data = {
            labels: ['Baladin', 'Italiano', 'Del Borgo', 'Lambrate', 'Toccalmatto'],
            datasets: [{
                data: [85, 72, 68, 55, 42],
                backgroundColor: [
                    this.colors.primary,
                    this.colors.success,
                    this.colors.warning,
                    this.colors.info,
                    this.colors.secondary
                ],
                borderRadius: 8,
                borderSkipped: false
            }]
        };

        this.charts.breweries = new Chart(ctx, {
            type: 'bar',
            data: data,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return 'Recensioni: ' + context.parsed.y;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: 'rgba(0,0,0,0.1)'
                        }
                    },
                    x: {
                        grid: {
                            display: false
                        }
                    }
                }
            }
        });
    }

    // Grafico trend temporale
    createTrendChart() {
        const ctx = document.getElementById('trendChart');
        if (!ctx) return;

        const data = {
            labels: ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu'],
            datasets: [{
                label: 'Nuove Recensioni',
                data: [65, 78, 90, 85, 92, 105],
                borderColor: this.colors.primary,
                backgroundColor: this.colors.primary + '20',
                fill: true,
                tension: 0.4,
                pointRadius: 6,
                pointBackgroundColor: this.colors.primary,
                pointBorderColor: '#fff',
                pointBorderWidth: 2
            }]
        };

        this.charts.trend = new Chart(ctx, {
            type: 'line',
            data: data,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: 'rgba(0,0,0,0.1)'
                        }
                    },
                    x: {
                        grid: {
                            display: false
                        }
                    }
                }
            }
        });
    }

    // Grafico tipologie birre
    createBeerTypesChart() {
        const ctx = document.getElementById('beerTypesChart');
        if (!ctx) return;

        const data = {
            labels: ['IPA', 'Lager', 'Stout', 'Wheat', 'Pilsner'],
            datasets: [{
                label: 'Rating Medio',
                data: [4.2, 3.8, 4.5, 4.0, 3.9],
                backgroundColor: [
                    this.colors.primary,
                    this.colors.success,
                    this.colors.warning,
                    this.colors.info,
                    this.colors.secondary
                ],
                borderRadius: 8,
                borderSkipped: false
            }]
        };

        this.charts.beerTypes = new Chart(ctx, {
            type: 'bar',
            data: data,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return 'Rating: ' + context.parsed.y + '/5';
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 5,
                        grid: {
                            color: 'rgba(0,0,0,0.1)'
                        }
                    },
                    x: {
                        grid: {
                            display: false
                        }
                    }
                }
            }
        });
    }

    // Setup event handlers
    setupEventHandlers() {
        // Gestione resize window
        window.addEventListener('resize', () => {
            Object.values(this.charts).forEach(chart => {
                if (chart) chart.resize();
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

    // Migliora l'UI con animazioni
    enhanceUI() {
        // Aggiungi effetti hover ai grafici
        document.querySelectorAll('.chart-container').forEach(container => {
            container.addEventListener('mouseenter', () => {
                container.style.transform = 'scale(1.02)';
                container.style.transition = 'transform 0.3s ease';
            });
            
            container.addEventListener('mouseleave', () => {
                container.style.transform = 'scale(1)';
            });
        });
    }

    // Anima i contatori numerici
    animateCounters() {
        document.querySelectorAll('.hero-stat-number').forEach(counter => {
            const target = parseInt(counter.textContent);
            if (isNaN(target)) return;
            
            let current = 0;
            const increment = target / 50;
            const timer = setInterval(() => {
                current += increment;
                if (current >= target) {
                    current = target;
                    clearInterval(timer);
                }
                counter.textContent = Math.round(current);
            }, 30);
        });
    }

    // Distruggi i grafici per cleanup
    destroyCharts() {
        Object.values(this.charts).forEach(chart => {
            if (chart) chart.destroy();
        });
        this.charts = {};
    }
}

// Inizializzazione globale
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
