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
        console.log('🔍 Verifica window.analyticsData:', window.analyticsData);
        
        this.setupChartDefaults();
        
        // Aggiungi un piccolo delay per assicurarsi che i dati siano caricati
        setTimeout(() => {
            this.createCharts();
            this.setupEventHandlers();
            this.setupBreweryAutocomplete();
            this.enhanceUI();
            this.animateCounters();
            console.log('✅ Dashboard statistiche caricata con successo!');
        }, 200);
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
        console.log('📊 Creazione grafici - Verifica dati analytics:', window.analyticsData);
        
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
            console.warn('⚠️ Canvas #ratingsChart NON trovato nel DOM - controlla condizioni template');
            console.log('Canvas presenti:', Array.from(document.querySelectorAll('canvas')).map(c => c.id));
            return;
        }
        
        // DEBUG: Verifica dimensioni canvas
        console.log('📊 Canvas #ratingsChart trovato');
        console.log('📊 Canvas parent:', ctx.parentElement);
        console.log('📊 Parent dimensions:', ctx.parentElement.offsetWidth, 'x', ctx.parentElement.offsetHeight);
        console.log('📊 Canvas dimensions:', ctx.offsetWidth, 'x', ctx.offsetHeight);

        // Utilizza i dati reali se disponibili
        const realData = this.extractRatingDistribution();

        // Se ci sono errori, mostra comunque il grafico con dati vuoti
        let chartData, hasData = false;
        
        if (realData.hasError || realData.totalRatings === 0) {
            // Mostra un grafico con tutti valori a 0 invece di errore
            chartData = [0, 0, 0, 0, 0];
            console.warn('📊 Mostrando grafico rating vuoto:', realData.errorMessage);
        } else {
            chartData = realData.counts;
            hasData = true;
            console.log('📊 Mostrando grafico rating con dati reali:', chartData);
        }

        const data = {
            labels: ['★★★★★', '★★★★☆', '★★★☆☆', '★★☆☆☆', '★☆☆☆☆'],
            datasets: [{
                data: chartData,
                backgroundColor: [
                    this.colors.success,
                    this.colors.primary,
                    this.colors.warning,
                    this.colors.secondary,
                    '#95a5a6'
                ],
                borderWidth: 2,
                borderColor: '#fff',
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
                            pointStyle: 'circle',
                            generateLabels: function(chart) {
                                const data = chart.data;
                                if (data.labels.length && data.datasets.length) {
                                    const total = data.datasets[0].data.reduce((a, b) => a + b, 0);
                                    return data.labels.map((label, i) => {
                                        const value = data.datasets[0].data[i];
                                        const percentage = total > 0 ? Math.round((value / total) * 100) : 0;
                                        
                                        // Se non ci sono dati, mostra messaggio appropriato
                                        const displayText = total === 0 
                                            ? `${label} (Nessun dato)` 
                                            : `${label} (${value} - ${percentage}%)`;
                                            
                                        return {
                                            text: displayText,
                                            fillStyle: data.datasets[0].backgroundColor[i],
                                            strokeStyle: data.datasets[0].borderColor,
                                            lineWidth: data.datasets[0].borderWidth,
                                            pointStyle: 'circle',
                                            hidden: false, // Mostra sempre le etichette
                                            index: i
                                        };
                                    });
                                }
                                return [];
                            }
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const currentValue = context.parsed;
                                
                                if (total === 0) {
                                    return `${context.label}: Nessun dato disponibile`;
                                }
                                
                                const percentage = Math.round((currentValue / total) * 100);
                                return `${context.label}: ${currentValue} recensioni (${percentage}%)`;
                            }
                        }
                    }
                },
                cutout: '60%',
                // Aggiungi animazione per un effetto più professionale
                animation: {
                    animateRotate: true,
                    animateScale: true,
                    duration: 1500,
                    easing: 'easeOutQuart',
                    // Callback per aggiungere testo al centro quando non ci sono dati
                    onComplete: function(animation) {
                        if (!hasData) {
                            const canvasPosition = Chart.helpers.getRelativePosition(animation.chart.canvas, animation.chart);
                            const ctx = animation.chart.ctx;
                            const centerX = (animation.chart.chartArea.left + animation.chart.chartArea.right) / 2;
                            const centerY = (animation.chart.chartArea.top + animation.chart.chartArea.bottom) / 2;
                            
                            ctx.restore();
                            ctx.font = "bold 16px Inter";
                            ctx.fillStyle = "#7f8c8d";
                            ctx.textAlign = "center";
                            ctx.textBaseline = "middle";
                            ctx.fillText("Nessun dato", centerX, centerY - 10);
                            ctx.font = "12px Inter";
                            ctx.fillText("disponibile", centerX, centerY + 10);
                            ctx.save();
                        }
                    }
                }
            }
        });
        
        console.log('✅ Grafico Rating creato con successo:', {
            chartInstance: !!this.charts.ratings,
            hasData: hasData,
            dataPoints: chartData
        });
    }

    // Grafico top birrifici
    createBreweriesChart() {
        const ctx = document.getElementById('breweriesChart');
        if (!ctx) return;

        // Estrai i dati reali dalla tabella
        const breweryData = this.extractBreweryData();
        
        // Gestisci errori con messaggio user-friendly
        if (breweryData.hasError) {
            this.showChartError(ctx, breweryData.errorMessage, 'Top Birrifici');
            return;
        }
        
        const data = {
            labels: breweryData.names,
            datasets: [{
                data: breweryData.reviews,
                backgroundColor: [
                    this.colors.primary,
                    this.colors.success,
                    this.colors.warning,
                    this.colors.info,
                    this.colors.secondary,
                    '#95a5a6',
                    '#34495e',
                    '#8e44ad'
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

        // Utilizza i dati reali se disponibili
        const trendData = this.extractMonthlyTrend();

        // Gestisci errori con messaggio user-friendly
        if (trendData.hasError) {
            this.showChartError(ctx, trendData.errorMessage, 'Trend Temporale');
            return;
        }

        const data = {
            labels: trendData.labels,
            datasets: [{
                label: 'Nuove Recensioni',
                data: trendData.values,
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

        // Utilizza i dati reali se disponibili
        const beerTypesData = this.extractBeerTypesStats();

        // Gestisci errori con messaggio user-friendly
        if (beerTypesData.hasError) {
            this.showChartError(ctx, beerTypesData.errorMessage, 'Tipologie Birre');
            return;
        }

        const data = {
            labels: beerTypesData.types,
            datasets: [{
                label: 'Rating Medio',
                data: beerTypesData.ratings,
                backgroundColor: [
                    this.colors.primary,
                    this.colors.success,
                    this.colors.warning,
                    this.colors.info,
                    this.colors.secondary,
                    '#95a5a6',
                    '#34495e',
                    '#8e44ad'
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

    // Estrae i dati dei birrifici dalla tabella HTML reale
    extractBreweryData() {
        console.log('📊 Estrazione dati birrifici dalla tabella...');
        
        // Debug: Verifica che la tabella esista (supporta sia .table-modern che .data-table)
        const table = document.querySelector('.table-section .data-table') || document.querySelector('.table-modern table');
        console.log('🔍 Tabella trovata:', table);
        
        if (!table) {
            console.error('❌ Tabella birrifici non trovata nel DOM');
            return {
                names: ['Dati non disponibili'],
                reviews: [0],
                hasError: true,
                errorMessage: 'Tabella dei birrifici non trovata. La pagina potrebbe non essere caricata completamente.'
            };
        }
        
        // Cerca le righe della tabella delle statistiche birrifici
        const breweryRows = table.querySelectorAll('tbody tr');
        const names = [];
        const reviews = [];

        console.log(`🔍 Trovate ${breweryRows.length} righe nella tabella`);

        breweryRows.forEach((row, index) => {
            if (index < 8) { // Prendi solo i primi 8 per il grafico
                console.log(`🔍 Elaborazione riga ${index + 1}:`, row);
                
                // Il nome del birrificio è nella seconda colonna (td:nth-child(2) a)
                const nameCell = row.querySelector('td:nth-child(2) a');
                // Le recensioni sono nella quarta colonna (td:nth-child(4) .role-badge o .badge) 
                const reviewsCell = row.querySelector('td:nth-child(4) .role-badge') || row.querySelector('td:nth-child(4) .badge');
                
                console.log(`   - Nome cell:`, nameCell);
                console.log(`   - Reviews cell:`, reviewsCell);
                
                if (nameCell && reviewsCell) {
                    const breweryName = nameCell.textContent.trim();
                    const reviewCount = parseInt(reviewsCell.textContent.trim()) || 0;
                    
                    names.push(breweryName);
                    reviews.push(reviewCount);
                    
                    console.log(`✅ ${index + 1}. ${breweryName}: ${reviewCount} recensioni`);
                } else {
                    console.warn(`⚠️ Riga ${index + 1}: elementi mancanti - nameCell: ${!!nameCell}, reviewsCell: ${!!reviewsCell}`);
                    
                    // Debug aggiuntivo per capire cosa c'è nella riga
                    const allCells = row.querySelectorAll('td');
                    console.log(`   - Numero celle trovate: ${allCells.length}`);
                    allCells.forEach((cell, cellIndex) => {
                        console.log(`   - Cella ${cellIndex + 1}:`, cell.textContent.trim());
                    });
                }
            }
        });

        // Messaggio di errore user-friendly se non ci sono dati reali
        if (names.length === 0) {
            console.warn('⚠️ Nessun dato birrifici trovato nella tabella');
            return {
                names: ['Dati non disponibili'],
                reviews: [0],
                hasError: true,
                errorMessage: 'Impossibile caricare i dati dei birrifici. Riprova più tardi.'
            };
        }

        console.log(`✅ Estratti ${names.length} birrifici dalla tabella`);
        return { names, reviews, hasError: false };
    }

    // Estrae e processa la distribuzione dei rating dai dati analytics
    extractRatingDistribution() {
        console.log('📊 Estrazione distribuzione rating...');
        
        if (!window.analyticsData || !window.analyticsData.ratingDistribution) {
            console.warn('⚠️ Dati analytics non disponibili');
            return {
                counts: [0, 0, 0, 0, 0], // Array con 5 valori per le 5 stelle
                percentages: [0, 0, 0, 0, 0],
                totalRatings: 0,
                hasError: true,
                errorMessage: 'Dati delle valutazioni temporaneamente non disponibili. Riprova tra qualche minuto.'
            };
        }

        const distribution = window.analyticsData.ratingDistribution;
        console.log('Raw distribution data:', distribution);

        // Inizializza contatori per rating 1-5
        const counts = [0, 0, 0, 0, 0]; // [1-star, 2-star, 3-star, 4-star, 5-star]
        let totalRatings = 0;

        // Processa i dati dal database
        distribution.forEach(item => {
            const rating = item._id; // rating da 1 a 5
            const count = item.count;
            
            if (rating >= 1 && rating <= 5) {
                counts[rating - 1] = count; // Array 0-indexed
                totalRatings += count;
            }
        });

        // Verifica se ci sono dati validi
        if (totalRatings === 0) {
            console.warn('⚠️ Nessuna recensione trovata nel database');
            return {
                counts: [0, 0, 0, 0, 0], // Array con 5 valori per le 5 stelle
                percentages: [0, 0, 0, 0, 0], 
                totalRatings: 0,
                hasError: true,
                errorMessage: 'Non ci sono ancora recensioni nel sistema. Torna quando saranno disponibili!'
            };
        }

        // Calcola percentuali per riferimento
        const percentages = counts.map(count => 
            totalRatings > 0 ? Math.round((count / totalRatings) * 100) : 0
        ).reverse(); // Inverti per avere 5-star per primo

        // Restituisci i counts invertiti (5-star per primo) per il grafico
        const countsReversed = counts.slice().reverse();

        console.log('Rating counts (1-5 stars):', counts);
        console.log('Rating counts (5-1 stars for chart):', countsReversed);
        console.log('Rating percentages:', percentages);
        console.log('Total ratings:', totalRatings);

        return { 
            counts: countsReversed, // Usa i valori assoluti per il grafico
            percentages, 
            totalRatings,
            hasError: false
        };
    }

    // Estrae e processa il trend mensile dai dati analytics
    extractMonthlyTrend() {
        console.log('📊 Estrazione trend mensile...');
        
        if (!window.analyticsData || !window.analyticsData.monthlyTrend) {
            console.warn('⚠️ Dati trend non disponibili');
            return {
                labels: ['Dati non disponibili'],
                values: [0],
                hasError: true,
                errorMessage: 'Impossibile caricare il trend delle recensioni. Riprova più tardi.'
            };
        }

        const trend = window.analyticsData.monthlyTrend;
        console.log('Raw trend data:', trend);

        if (!trend || trend.length === 0) {
            console.warn('⚠️ Nessun dato di trend disponibile');
            return {
                labels: ['Nessun dato'],
                values: [0],
                hasError: true,
                errorMessage: 'Non ci sono ancora abbastanza dati per mostrare il trend. Torna più avanti!'
            };
        }

        const monthNames = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 
                           'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];
        
        const labels = [];
        const values = [];

        // Processa i dati dal più recente al più vecchio e inverti per cronologia
        trend.reverse().forEach(item => {
            const month = item._id.month - 1; // MongoDB month è 1-based
            const year = item._id.year;
            const count = item.count;
            
            // Crea label nel formato "Mese Anno" (es. "Set 2024")
            const label = year === new Date().getFullYear() 
                ? monthNames[month] 
                : `${monthNames[month]} ${year.toString().slice(-2)}`;
            
            labels.push(label);
            values.push(count);
        });

        console.log('Trend labels:', labels);
        console.log('Trend values:', values);

        return { labels, values, hasError: false };
    }

    // Estrae e processa le statistiche per tipologie di birre
    extractBeerTypesStats() {
        console.log('📊 Estrazione statistiche tipologie birre...');
        
        if (!window.analyticsData || !window.analyticsData.beerTypesStats) {
            console.warn('⚠️ Dati tipologie birre non disponibili');
            return {
                types: ['Dati non disponibili'],
                ratings: [0],
                hasError: true,
                errorMessage: 'Impossibile caricare le statistiche delle tipologie di birre. Riprova più tardi.'
            };
        }

        const stats = window.analyticsData.beerTypesStats;
        console.log('Raw beer types data:', stats);

        if (!stats || stats.length === 0) {
            console.warn('⚠️ Nessuna tipologia di birra trovata (beerType non popolato nelle birre)');
            return {
                types: ['Nessun dato'],
                ratings: [0],
                hasError: true,
                errorMessage: 'Nessuna birra con tipologia definita. Le birre devono avere il campo "Tipo Birra" popolato per apparire in questo grafico.'
            };
        }

        const types = [];
        const ratings = [];

        // Processa i dati dal database
        stats.forEach(item => {
            const beerType = item._id || 'Tipo sconosciuto';
            const avgRating = item.avgRating || 0;
            
            // Normalizza il nome del tipo (capitalizza prima lettera)
            const normalizedType = beerType.charAt(0).toUpperCase() + beerType.slice(1).toLowerCase();
            
            types.push(normalizedType);
            ratings.push(Math.round(avgRating * 10) / 10); // Arrotonda a 1 decimale
            
            console.log(`Tipo: ${normalizedType}, Rating: ${avgRating}, Recensioni: ${item.count}`);
        });

        console.log(`✅ Estratti ${types.length} tipi di birra`);
        return { types, ratings, hasError: false };
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

    // Mostra messaggio di errore nel canvas del grafico
    showChartError(ctx, errorMessage, chartTitle) {
        const parentDiv = ctx.parentElement;
        
        // Rimuovi il canvas esistente
        ctx.style.display = 'none';
        
        // Crea un elemento di errore se non esiste già
        let errorDiv = parentDiv.querySelector('.chart-error');
        if (!errorDiv) {
            errorDiv = document.createElement('div');
            errorDiv.className = 'chart-error';
            errorDiv.style.cssText = `
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                height: 300px;
                padding: 20px;
                text-align: center;
                color: #7f8c8d;
                background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
                border-radius: 12px;
                border: 2px dashed #dee2e6;
            `;
            parentDiv.appendChild(errorDiv);
        }
        
        errorDiv.innerHTML = `
            <div style="font-size: 48px; margin-bottom: 16px; opacity: 0.5;">📊</div>
            <h4 style="margin: 0 0 8px 0; color: #495057; font-weight: 600;">${chartTitle}</h4>
            <p style="margin: 0; font-size: 14px; line-height: 1.4;">${errorMessage}</p>
        `;
        
        console.warn(`⚠️ Errore grafico ${chartTitle}:`, errorMessage);
    }

    // Distruggi i grafici per cleanup
    destroyCharts() {
        Object.values(this.charts).forEach(chart => {
            if (chart) chart.destroy();
        });
        this.charts = {};
    }
}

// Rimuoviamo l'inizializzazione automatica per evitare doppia inizializzazione
// Il StatisticsManager sarà inizializzato direttamente dal template

// Cleanup al cambio pagina
window.addEventListener('beforeunload', () => {
    if (window.statisticsManager) {
        window.statisticsManager.destroyCharts();
    }
});
