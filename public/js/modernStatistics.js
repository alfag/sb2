/**
 * 📊 SHARINGBEER2.0 - MODERN STATISTICS PAGE
 * 
 * JavaScript per la gestione della pagina statistiche amministratori
 * Con supporto per i nuovi stili CSS moderni
 * Data: 12 Ottobre 2025
 */

class ModernStatisticsPage {
    constructor() {
        this.animations = {
            fadeInUp: 'animate__fadeInUp',
            slideInLeft: 'animate__slideInLeft',
            pulse: 'animate__pulse'
        };
        
        this.colors = {
            gradients: {
                primary: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
                secondary: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                success: 'linear-gradient(135deg, #56ab2f 0%, #a8e6cf 100%)',
                warning: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                info: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)'
            }
        };
        
        this.init();
    }

    init() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.setup());
        } else {
            this.setup();
        }
    }

    setup() {
        console.log('🎨 ModernStatisticsPage - Inizializzazione stili moderni...');
        
        // Applica animazioni di entrata
        this.applyEntryAnimations();
        
        // Configura interazioni moderne
        this.setupModernInteractions();
        
        // Configura stats cards
        this.setupStatsCards();
        
        // Controlla stato statistiche
        this.checkStatsStatus();
        
        // Setup gestione errori grafici
        this.setupChartErrorHandling();
        
        // Configura filtri avanzati
        this.setupAdvancedFilters();
        
        // Migliora tabelle
        this.enhanceModernTables();
        
        // Configura VU meter
        this.setupVUMeter();
        
        // Migliora progress bars
        this.enhanceProgressBars();
        
        // Setup responsive behavior
        this.setupResponsiveBehavior();
        
        // Anima i contatori numerici del summary
        this.animateSummaryCounters();
        
        // Avvia statistiche manager se disponibile
        this.initializeStatisticsManager();
        
        // Debug: Simula errori se richiesto
        this.simulateStatsErrors();
        
        console.log('✅ ModernStatisticsPage inizializzata con successo!');
    }

    // Applica animazioni di entrata agli elementi
    applyEntryAnimations() {
        const elementsToAnimate = [
            { selector: '.modern-card', delay: 0 },
            { selector: '.chart-card', delay: 100 },
            { selector: '.table-modern', delay: 200 }
        ];

        elementsToAnimate.forEach(({ selector, delay }) => {
            const elements = document.querySelectorAll(selector);
            elements.forEach((element, index) => {
                setTimeout(() => {
                    element.style.opacity = '0';
                    element.style.transform = 'translateY(20px)';
                    element.style.transition = 'all 0.6s ease';
                    
                    // Trigger animation
                    requestAnimationFrame(() => {
                        element.style.opacity = '1';
                        element.style.transform = 'translateY(0)';
                    });
                }, delay + (index * 50));
            });
        });
    }

    // Configura interazioni moderne
    setupModernInteractions() {
        // Effetto hover avanzato per le card
        document.querySelectorAll('.modern-card').forEach(card => {
            this.addAdvancedHoverEffect(card);
        });

        // Effetto hover per chart cards
        document.querySelectorAll('.chart-card').forEach(chartCard => {
            this.addChartHoverEffect(chartCard);
        });

        // Effetto focus migliorato per input
        document.querySelectorAll('.filter-input').forEach(input => {
            this.addModernFocusEffect(input);
        });

        // Effetto click per bottoni moderni
        document.querySelectorAll('.btn-modern').forEach(btn => {
            this.addModernClickEffect(btn);
        });
    }

    // Aggiunge effetto hover avanzato
    addAdvancedHoverEffect(element) {
        element.addEventListener('mouseenter', () => {
            element.style.transform = 'translateY(-4px) scale(1.01)';
            element.style.boxShadow = '0 25px 50px rgba(0,0,0,0.15)';
            element.style.transition = 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
        });

        element.addEventListener('mouseleave', () => {
            element.style.transform = 'translateY(0) scale(1)';
            element.style.boxShadow = '0 20px 40px rgba(0,0,0,0.1)';
        });
    }

    // Effetto hover per chart cards
    addChartHoverEffect(chartCard) {
        chartCard.addEventListener('mouseenter', () => {
            chartCard.style.background = 'var(--color-white)';
            chartCard.style.boxShadow = '0 10px 25px rgba(0,0,0,0.1)';
            chartCard.style.transform = 'translateY(-2px)';
        });

        chartCard.addEventListener('mouseleave', () => {
            chartCard.style.background = 'var(--color-gray-50)';
            chartCard.style.boxShadow = 'none';
            chartCard.style.transform = 'translateY(0)';
        });
    }

    // Effetto focus moderno per input
    addModernFocusEffect(input) {
        input.addEventListener('focus', () => {
            input.style.transform = 'scale(1.02)';
            input.style.borderColor = '#4facfe';
            input.style.boxShadow = '0 0 0 3px rgba(79, 172, 254, 0.1)';
            
            // Aggiunge glow effect
            input.style.background = 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)';
        });

        input.addEventListener('blur', () => {
            input.style.transform = 'scale(1)';
            input.style.background = 'var(--color-gray-50)';
        });
    }

    // Effetto click moderno per bottoni
    addModernClickEffect(button) {
        button.addEventListener('click', (e) => {
            // Crea effetto ripple
            const ripple = document.createElement('span');
            const rect = button.getBoundingClientRect();
            const size = Math.max(rect.width, rect.height);
            const x = e.clientX - rect.left - size / 2;
            const y = e.clientY - rect.top - size / 2;
            
            ripple.style.cssText = `
                position: absolute;
                width: ${size}px;
                height: ${size}px;
                left: ${x}px;
                top: ${y}px;
                background: rgba(255, 255, 255, 0.5);
                border-radius: 50%;
                transform: scale(0);
                animation: ripple 0.6s linear;
                pointer-events: none;
            `;
            
            // Aggiunge CSS animation per ripple se non esiste
            if (!document.querySelector('#ripple-animation')) {
                const style = document.createElement('style');
                style.id = 'ripple-animation';
                style.textContent = `
                    @keyframes ripple {
                        to {
                            transform: scale(4);
                            opacity: 0;
                        }
                    }
                `;
                document.head.appendChild(style);
            }
            
            button.style.position = 'relative';
            button.style.overflow = 'hidden';
            button.appendChild(ripple);
            
            setTimeout(() => ripple.remove(), 600);
        });
    }

    // Setup filtri avanzati
    setupAdvancedFilters() {
        const filterForm = document.querySelector('.modern-form');
        if (!filterForm) return;

        // Aggiunge validation styling in tempo reale
        const requiredInputs = filterForm.querySelectorAll('input[required], select[required]');
        requiredInputs.forEach(input => {
            input.addEventListener('input', () => {
                this.validateInput(input);
            });
        });

        // Aggiunge tooltips informativi
        this.addFilterTooltips();
    }

    // Valida input con styling moderno
    validateInput(input) {
        const isValid = input.value.trim() !== '';
        
        if (isValid) {
            input.style.borderColor = 'var(--color-success)';
            input.style.boxShadow = '0 0 0 3px rgba(16, 185, 129, 0.1)';
        } else {
            input.style.borderColor = 'var(--color-error)';
            input.style.boxShadow = '0 0 0 3px rgba(239, 68, 68, 0.1)';
        }
    }

    // Aggiunge tooltips ai filtri
    addFilterTooltips() {
        const tooltipData = {
            'sortBy': 'Scegli il criterio per ordinare i risultati',
            'sortOrder': 'Seleziona ordine crescente o decrescente',
            'minReviews': 'Filtra birrifici con almeno questo numero di recensioni',
            'brewery': 'Cerca un birrificio specifico per nome',
            'limit': 'Numero massimo di risultati da mostrare'
        };

        Object.entries(tooltipData).forEach(([name, text]) => {
            const input = document.querySelector(`[name="${name}"]`);
            if (input) {
                this.addTooltip(input, text);
            }
        });
    }

    // Aggiunge tooltip a un elemento
    addTooltip(element, text) {
        element.setAttribute('title', text);
        element.addEventListener('mouseenter', (e) => {
            this.showTooltip(e.target, text);
        });
        element.addEventListener('mouseleave', () => {
            this.hideTooltip();
        });
    }

    // Mostra tooltip personalizzato
    showTooltip(element, text) {
        const tooltip = document.createElement('div');
        tooltip.id = 'modern-tooltip';
        tooltip.textContent = text;
        tooltip.style.cssText = `
            position: absolute;
            background: var(--color-gray-800);
            color: white;
            padding: 8px 12px;
            border-radius: 6px;
            font-size: 12px;
            z-index: 10000;
            max-width: 200px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            pointer-events: none;
            opacity: 0;
            transform: translateY(5px);
            transition: all 0.2s ease;
        `;
        
        document.body.appendChild(tooltip);
        
        const rect = element.getBoundingClientRect();
        tooltip.style.left = `${rect.left + rect.width / 2 - tooltip.offsetWidth / 2}px`;
        tooltip.style.top = `${rect.bottom + 8}px`;
        
        // Anima entrata
        requestAnimationFrame(() => {
            tooltip.style.opacity = '1';
            tooltip.style.transform = 'translateY(0)';
        });
    }

    // Nascondi tooltip
    hideTooltip() {
        const tooltip = document.getElementById('modern-tooltip');
        if (tooltip) {
            tooltip.style.opacity = '0';
            tooltip.style.transform = 'translateY(5px)';
            setTimeout(() => tooltip.remove(), 200);
        }
    }

    // Migliora tabelle moderne
    enhanceModernTables() {
        const tables = document.querySelectorAll('.table-modern table');
        
        tables.forEach(table => {
            // Aggiunge effetto zebra dinamico
            this.addZebraEffect(table);
            
            // Aggiunge ordinamento visuale
            this.addSortingVisuals(table);
            
            // Aggiunge responsive behavior
            this.makeTableResponsive(table);
        });
    }

    // Aggiunge effetto zebra alle righe
    addZebraEffect(table) {
        const rows = table.querySelectorAll('tbody tr');
        rows.forEach((row, index) => {
            row.addEventListener('mouseenter', () => {
                row.style.background = 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)';
                row.style.transform = 'scale(1.01)';
                row.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
            });

            row.addEventListener('mouseleave', () => {
                row.style.background = '';
                row.style.transform = 'scale(1)';
                row.style.boxShadow = '';
            });
        });
    }

    // Aggiunge indicatori visivi per ordinamento
    addSortingVisuals(table) {
        const headers = table.querySelectorAll('th');
        headers.forEach(header => {
            if (header.textContent.trim()) {
                header.style.cursor = 'pointer';
                header.addEventListener('click', () => {
                    this.showSortingFeedback(header);
                });
            }
        });
    }

    // Mostra feedback per ordinamento
    showSortingFeedback(header) {
        // Rimuovi indicatori precedenti
        document.querySelectorAll('.sort-indicator').forEach(ind => ind.remove());
        
        // Aggiungi nuovo indicatore
        const indicator = document.createElement('span');
        indicator.className = 'sort-indicator';
        indicator.innerHTML = ' ↕️';
        indicator.style.fontSize = '12px';
        header.appendChild(indicator);
        
        // Anima header
        header.style.background = 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)';
        header.style.color = 'white';
        header.style.transform = 'scale(1.02)';
        
        setTimeout(() => {
            header.style.background = '';
            header.style.color = '';
            header.style.transform = 'scale(1)';
        }, 300);
    }

    // Rende tabella responsive
    makeTableResponsive(table) {
        const wrapper = table.closest('.table-modern');
        if (wrapper && window.innerWidth < 768) {
            wrapper.style.overflowX = 'auto';
            wrapper.style.WebkitOverflowScrolling = 'touch';
            
            // Aggiunge indicatore scroll
            const scrollIndicator = document.createElement('div');
            scrollIndicator.innerHTML = '← Scorri per vedere più colonne →';
            scrollIndicator.style.cssText = `
                text-align: center;
                padding: 8px;
                background: var(--color-gray-100);
                font-size: 12px;
                color: var(--color-gray-600);
                border-top: 1px solid var(--color-gray-200);
            `;
            wrapper.appendChild(scrollIndicator);
        }
    }

    // Setup VU meter animazioni
    setupVUMeter() {
        const vuMeter = document.querySelector('.vu-meter');
        if (!vuMeter) return;

        // Aggiunge animazione pulsante al VU meter
        const needle = vuMeter.querySelector('.vu-needle');
        if (needle) {
            setInterval(() => {
                needle.style.filter = 'drop-shadow(0 2px 8px rgba(0,0,0,0.3))';
                setTimeout(() => {
                    needle.style.filter = 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))';
                }, 500);
            }, 2000);
        }

        // Aggiunge tooltip al VU meter
        vuMeter.addEventListener('mouseenter', () => {
            this.showTooltip(vuMeter, 'VU Meter: Indicatore visivo della crescita mensile delle recensioni');
        });
        vuMeter.addEventListener('mouseleave', () => {
            this.hideTooltip();
        });
    }

    // Migliora progress bars
    enhanceProgressBars() {
        const progressBars = document.querySelectorAll('.progress-bar');
        
        progressBars.forEach(bar => {
            // Anima progress bar all'ingresso
            const targetWidth = bar.style.width;
            bar.style.width = '0%';
            bar.style.transition = 'width 1.5s cubic-bezier(0.4, 0, 0.2, 1)';
            
            // Observer per animare quando visibile
            const observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        setTimeout(() => {
                            bar.style.width = targetWidth;
                        }, 200);
                        observer.unobserve(entry.target);
                    }
                });
            });
            
            observer.observe(bar);

            // Aggiunge effetto glow on hover
            bar.addEventListener('mouseenter', () => {
                bar.style.filter = 'brightness(1.1) saturate(1.2)';
                bar.style.transform = 'scaleY(1.2)';
            });

            bar.addEventListener('mouseleave', () => {
                bar.style.filter = '';
                bar.style.transform = 'scaleY(1)';
            });
        });
    }

    // Setup comportamento responsive
    setupResponsiveBehavior() {
        const mediaQuery = window.matchMedia('(max-width: 768px)');
        
        const handleResponsive = (e) => {
            if (e.matches) {
                // Mobile: compatta hero stats
                this.compactHeroStats();
                // Mobile: semplifica chart grid
                this.simplifyChartGrid();
            } else {
                // Desktop: ripristina layout
                this.restoreDesktopLayout();
            }
        };

        mediaQuery.addListener(handleResponsive);
        handleResponsive(mediaQuery);
    }

    // Compatta stats cards per mobile
    compactHeroStats() {
        const statsGrid = document.querySelector('.grid-cols-4');
        if (statsGrid) {
            if (window.innerWidth <= 480) {
                statsGrid.style.gridTemplateColumns = '1fr';
                statsGrid.style.gap = 'var(--space-2)';
            } else if (window.innerWidth <= 768) {
                statsGrid.style.gridTemplateColumns = 'repeat(2, 1fr)';
                statsGrid.style.gap = 'var(--space-3)';
            }
        }
    }

    // Semplifica grid grafici per mobile
    simplifyChartGrid() {
        const chartGrid = document.querySelector('.charts-grid');
        if (chartGrid) {
            chartGrid.style.gridTemplateColumns = '1fr';
            chartGrid.style.gap = 'var(--space-4)';
        }
    }

    // Ripristina layout desktop
    restoreDesktopLayout() {
        const statsGrid = document.querySelector('.grid-cols-4');
        if (statsGrid) {
            statsGrid.style.gridTemplateColumns = '';
            statsGrid.style.gap = '';
        }

        const chartGrid = document.querySelector('.charts-grid');
        if (chartGrid) {
            chartGrid.style.gridTemplateColumns = '';
            chartGrid.style.gap = '';
        }
    }

    // Configura interazioni avanzate per stats cards
    setupStatsCards() {
        document.querySelectorAll('.stats-card').forEach(card => {
            // Controlla se la card ha errori
            const hasError = card.querySelector('.stats-error');
            const hasNumber = card.querySelector('.stats-number');
            
            if (hasError) {
                card.classList.add('has-error');
                this.setupErrorCard(card);
            } else if (hasNumber) {
                this.setupNormalCard(card);
            } else {
                this.setupLoadingCard(card);
            }
        });
    }

    // Setup per card normali (con dati)
    setupNormalCard(card) {
        // Effetto hover avanzato
        card.addEventListener('mouseenter', () => {
            const icon = card.querySelector('.stats-icon');
            const number = card.querySelector('.stats-number');
            
            if (icon) {
                icon.style.transform = 'scale(1.1) rotate(5deg)';
                icon.style.filter = 'brightness(1.1)';
            }
            
            if (number) {
                number.style.transform = 'scale(1.05)';
                number.style.filter = 'brightness(1.1)';
            }
        });

        card.addEventListener('mouseleave', () => {
            const icon = card.querySelector('.stats-icon');
            const number = card.querySelector('.stats-number');
            
            if (icon) {
                icon.style.transform = 'scale(1) rotate(0deg)';
                icon.style.filter = 'brightness(1)';
            }
            
            if (number) {
                number.style.transform = 'scale(1)';
                number.style.filter = 'brightness(1)';
            }
        });

        // Effetto click/pulse
        card.addEventListener('click', () => {
            card.style.transform = 'scale(0.98)';
            setTimeout(() => {
                card.style.transform = '';
            }, 150);
        });
    }

    // Setup per card con errori
    setupErrorCard(card) {
        const statType = card.dataset.statType;
        
        // Aggiungi pulsante retry se non esiste
        const errorDiv = card.querySelector('.stats-error');
        if (errorDiv && !errorDiv.querySelector('.stats-retry-btn')) {
            const retryBtn = document.createElement('button');
            retryBtn.className = 'stats-retry-btn';
            retryBtn.innerHTML = '<i class="fas fa-redo me-1"></i>Riprova';
            retryBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.retryLoadStats(card, statType);
            });
            errorDiv.appendChild(retryBtn);
        }

        // Tooltip informativo
        card.setAttribute('title', `Errore nel caricamento statistiche ${statType}. Clicca su "Riprova" per ricaricare.`);
    }

    // Setup per card in loading
    setupLoadingCard(card) {
        card.classList.add('loading');
        
        // Sostituisci contenuto con skeleton
        const content = card.querySelector('.stats-content');
        if (content) {
            content.innerHTML = `
                <div class="stats-loading-number"></div>
                <div class="stats-loading-label"></div>
                <div class="stats-loading-sublabel"></div>
            `;
        }
    }

    // Riprova a caricare le statistiche
    retryLoadStats(card, statType) {
        const retryBtn = card.querySelector('.stats-retry-btn');
        const originalText = retryBtn.innerHTML;
        
        // Mostra loading sul pulsante
        retryBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i>Caricamento...';
        retryBtn.disabled = true;
        
        // Simula ricaricamento (in un'app reale faresti una chiamata API)
        setTimeout(() => {
            // Prova a ricaricare la pagina o fare fetch dei dati
            window.location.reload();
        }, 1000);
    }

    // Verifica lo stato delle statistiche e mostra messaggi appropriati
    checkStatsStatus() {
        const cards = document.querySelectorAll('.stats-card');
        let errorCount = 0;
        let loadingCount = 0;
        
        cards.forEach(card => {
            if (card.classList.contains('has-error')) {
                errorCount++;
            } else if (card.classList.contains('loading')) {
                loadingCount++;
            }
        });
        
        // Mostra notifica globale se ci sono troppi errori
        if (errorCount >= 2) {
            this.showGlobalErrorNotification();
        } else if (loadingCount > 0) {
            this.showLoadingNotification();
        }
    }

    // Mostra notifica globale di errore
    showGlobalErrorNotification() {
        const notification = document.createElement('div');
        notification.className = 'alert alert-warning alert-dismissible fade show';
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 9999;
            max-width: 400px;
            box-shadow: var(--shadow-lg);
        `;
        notification.innerHTML = `
            <i class="fas fa-exclamation-triangle me-2"></i>
            <strong>Attenzione:</strong> Alcune statistiche non sono disponibili. 
            Verifica la connessione di rete e riprova.
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;
        
        document.body.appendChild(notification);
        
        // Auto-remove dopo 8 secondi
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 8000);
    }

    // Mostra notifica di caricamento
    showLoadingNotification() {
        console.log('📊 Alcune statistiche sono ancora in caricamento...');
    }

    // Anima i contatori numerici delle stats cards
    animateSummaryCounters() {
        document.querySelectorAll('.stats-number').forEach(counter => {
            const target = parseInt(counter.textContent);
            if (isNaN(target)) return;
            
            // Aggiungi effetto di entrata
            counter.style.opacity = '0';
            counter.style.transform = 'translateY(10px)';
            
            setTimeout(() => {
                counter.style.transition = 'all 0.6s ease';
                counter.style.opacity = '1';
                counter.style.transform = 'translateY(0)';
                
                let current = 0;
                const increment = target / 40; // Più fluido per le card
                const timer = setInterval(() => {
                    current += increment;
                    if (current >= target) {
                        current = target;
                        clearInterval(timer);
                    }
                    counter.textContent = Math.round(current);
                }, 40);
            }, Math.random() * 300 + 100); // Stagger casuale
        });
    }

    // Inizializza StatisticsManager se disponibile
    initializeStatisticsManager() {
        if (typeof StatisticsManager !== 'undefined') {
            setTimeout(() => {
                window.statisticsManager = new StatisticsManager();
                console.log('📊 StatisticsManager integrato con ModernStatisticsPage');
            }, 500);
        }
    }

    // Debug: Simula errori nelle statistiche (solo per test)
    simulateStatsErrors() {
        if (window.location.search.includes('debug=errors')) {
            console.log('🐛 DEBUG: Simulando errori nelle statistiche...');
            
            const cards = document.querySelectorAll('.stats-card');
            cards.forEach((card, index) => {
                if (index % 2 === 0) { // Simula errore su card pari
                    const content = card.querySelector('.stats-content');
                    if (content) {
                        content.innerHTML = `
                            <div class="stats-error">
                                <div class="stats-error-icon">⚠️</div>
                                <div class="stats-error-text">Dati non disponibili</div>
                                <div class="stats-error-subtext">Riprova più tardi</div>
                            </div>
                        `;
                        card.classList.add('has-error');
                    }
                }
            });
            
            // Riavvia setup dopo modifica
            setTimeout(() => {
                this.setupStatsCards();
                this.checkStatsStatus();
            }, 100);
        }
    }

    // ===== GESTIONE ERRORI GRAFICI =====
    
    setupChartErrorHandling() {
        // Controlla tutti i grafici per errori al caricamento
        const chartContainers = document.querySelectorAll('[data-chart-type]');
        
        chartContainers.forEach(container => {
            const chartType = container.dataset.chartType;
            const hasData = this.checkChartData(chartType);
            
            if (!hasData) {
                this.showChartError(container, chartType);
            }
        });
        
        // Setup retry buttons per grafici
        document.querySelectorAll('.chart-retry-btn').forEach(button => {
            button.addEventListener('click', () => {
                this.retryLoadChart(button.dataset.chartType);
            });
        });
    }

    checkChartData(chartType) {
        // Controlla se ci sono dati per ogni tipo di grafico
        switch (chartType) {
            case 'ratings':
                return window.ratingsData && window.ratingsData.length > 0;
            case 'breweries':
                return window.breweriesData && window.breweriesData.length > 0;
            case 'trend':
                return window.trendsData && window.trendsData.length > 0;
            case 'beertypes':
                return window.beerTypesData && window.beerTypesData.length > 0;
            default:
                return false;
        }
    }

    showChartError(container, chartType) {
        const chartCard = container.closest('.chart-card');
        if (chartCard) {
            chartCard.classList.add('has-chart-error');
        }
        
        const errorDiv = container.querySelector('.chart-error');
        if (errorDiv) {
            errorDiv.style.display = 'block';
            
            // Aggiungi animazione fade-in
            setTimeout(() => {
                errorDiv.style.opacity = '1';
            }, 50);
        }
        
        // Nascondi il canvas del grafico se presente
        const canvas = container.querySelector('canvas');
        if (canvas) {
            canvas.style.display = 'none';
        }
    }

    retryLoadChart(chartType) {
        console.log(`🔄 Retry caricamento grafico: ${chartType}`);
        
        const container = document.querySelector(`[data-chart-type="${chartType}"]`);
        if (!container) return;
        
        // Mostra loading state
        this.showChartLoading(container);
        
        // Simula ricaricamento (puoi sostituire con chiamata API reale)
        setTimeout(() => {
            const hasData = this.checkChartData(chartType);
            
            if (hasData) {
                this.hideChartError(container);
                // Qui ricaricheresti il grafico
                console.log(`✅ Grafico ${chartType} ricaricato con successo`);
            } else {
                this.hideChartLoading(container);
                console.log(`❌ Grafico ${chartType} ancora senza dati`);
            }
        }, 1500);
    }

    showChartLoading(container) {
        const errorDiv = container.querySelector('.chart-error');
        if (errorDiv) {
            errorDiv.innerHTML = `
                <div class="chart-loading">
                    <div class="chart-loading-spinner"></div>
                    <div class="chart-loading-text">Caricamento grafico...</div>
                </div>
            `;
        }
    }

    hideChartLoading(container) {
        const errorDiv = container.querySelector('.chart-error');
        if (errorDiv) {
            // Ripristina il contenuto di errore originale
            const chartType = container.dataset.chartType;
            const errorMessages = {
                'ratings': 'Nessun dato disponibile per la distribuzione dei rating',
                'breweries': 'Nessun birrificio trovato per il grafico top 10',
                'trend': 'Dati di trend non sufficienti per il grafico',
                'beertypes': 'Nessun tipo di birra trovato per la distribuzione'
            };
            
            errorDiv.innerHTML = `
                <div class="chart-error-icon">📊</div>
                <div class="chart-error-title">Grafico non disponibile</div>
                <div class="chart-error-message">${errorMessages[chartType] || 'Dati non disponibili'}</div>
                <button class="chart-retry-btn" data-chart-type="${chartType}">
                    <i class="fas fa-redo me-1"></i>Riprova
                </button>
            `;
        }
    }

    hideChartError(container) {
        const chartCard = container.closest('.chart-card');
        if (chartCard) {
            chartCard.classList.remove('has-chart-error');
        }
        
        const errorDiv = container.querySelector('.chart-error');
        if (errorDiv) {
            errorDiv.style.display = 'none';
        }
        
        // Mostra il canvas del grafico
        const canvas = container.querySelector('canvas');
        if (canvas) {
            canvas.style.display = 'block';
        }
    }

    // Cleanup quando si lascia la pagina
    cleanup() {
        // Rimuovi event listeners
        window.removeEventListener('resize', this.handleResize);
        
        // Ferma animazioni attive
        const animations = document.querySelectorAll('[style*="animation"]');
        animations.forEach(el => {
            el.style.animation = 'none';
        });
        
        console.log('🧹 ModernStatisticsPage cleanup completato');
    }
}

// Inizializza la pagina moderna
const modernStatsPage = new ModernStatisticsPage();

// Cleanup al cambio pagina
window.addEventListener('beforeunload', () => {
    if (modernStatsPage) {
        modernStatsPage.cleanup();
    }
});

// Export per uso esterno se necessario
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ModernStatisticsPage;
}