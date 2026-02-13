/**
 * adminBeerFilters.js
 * Filtri client-side per la pagina admin gestione birre
 * Implementa filtri per categoria (stats pills) e ricerca testuale
 */

(function() {
    'use strict';

    let activeFilter = 'all';

    // ========================================
    // Inizializzazione
    // ========================================
    document.addEventListener('DOMContentLoaded', function() {
        initFilterCards();
        initSearchBox();
    });

    // ========================================
    // Filtri per categoria (stat pills)
    // ========================================
    function initFilterCards() {
        const filterCards = document.querySelectorAll('.beer-filter-card');
        
        filterCards.forEach(card => {
            card.addEventListener('click', function() {
                const filter = this.dataset.filter;
                
                // Toggle: se clicco lo stesso filtro, resetta a "all"
                if (activeFilter === filter && filter !== 'all') {
                    activeFilter = 'all';
                } else {
                    activeFilter = filter;
                }
                
                // Aggiorna stato attivo delle card
                filterCards.forEach(c => c.classList.remove('active'));
                if (activeFilter === 'all') {
                    document.querySelector('.beer-filter-card[data-filter="all"]').classList.add('active');
                } else {
                    this.classList.add('active');
                }
                
                applyFilters();
            });
        });
    }

    // ========================================
    // Ricerca testuale
    // ========================================
    function initSearchBox() {
        const searchInput = document.getElementById('beerSearchInput');
        const searchBox = document.getElementById('beerSearchBox');
        
        if (!searchInput) return;
        
        searchInput.addEventListener('input', function() {
            // Mostra/nascondi pulsante clear
            if (this.value.trim()) {
                searchBox.classList.add('has-value');
            } else {
                searchBox.classList.remove('has-value');
            }
            applyFilters();
        });
    }

    // ========================================
    // Applicazione filtri combinati
    // ========================================
    function applyFilters() {
        const searchInput = document.getElementById('beerSearchInput');
        const searchTerm = searchInput ? searchInput.value.trim().toLowerCase() : '';
        const rows = document.querySelectorAll('.beer-row');
        const filterIndicator = document.getElementById('filter-indicator');
        const filterMessage = document.getElementById('filter-message');
        
        let visibleCount = 0;
        let totalCount = rows.length;
        
        rows.forEach(row => {
            let showByFilter = true;
            let showBySearch = true;
            
            // Filtro per categoria
            if (activeFilter !== 'all') {
                switch (activeFilter) {
                    case 'with-style':
                        showByFilter = row.dataset.hasStyle === 'true';
                        break;
                    case 'with-abv':
                        showByFilter = row.dataset.hasAbv === 'true';
                        break;
                    case 'incomplete-data':
                        showByFilter = row.dataset.completeData === 'false';
                        break;
                    case 'ai-extracted':
                        showByFilter = row.dataset.aiExtracted === 'true';
                        break;
                }
            }
            
            // Filtro per ricerca testuale
            if (searchTerm) {
                const beerName = row.dataset.beerName || '';
                const breweryName = row.dataset.breweryName || '';
                showBySearch = beerName.includes(searchTerm) || breweryName.includes(searchTerm);
            }
            
            // Combina i filtri
            const visible = showByFilter && showBySearch;
            row.style.display = visible ? '' : 'none';
            if (visible) visibleCount++;
        });
        
        // Aggiorna indicatore filtro
        const isFiltering = activeFilter !== 'all' || searchTerm;
        if (filterIndicator) {
            filterIndicator.style.display = isFiltering ? 'flex' : 'none';
            if (filterMessage) {
                const parts = [];
                if (activeFilter !== 'all') {
                    const filterLabels = {
                        'with-style': 'Con Stile',
                        'with-abv': 'Con ABV',
                        'incomplete-data': 'Dati Incompleti',
                        'ai-extracted': 'Estratte Auto'
                    };
                    parts.push(filterLabels[activeFilter] || activeFilter);
                }
                if (searchTerm) {
                    parts.push(`Ricerca: "${searchTerm}"`);
                }
                filterMessage.textContent = `${parts.join(' + ')} — ${visibleCount}/${totalCount} birre`;
            }
        }
    }

    // ========================================
    // Funzioni globali (chiamate dal template)
    // ========================================
    window.clearBeerSearch = function() {
        const searchInput = document.getElementById('beerSearchInput');
        const searchBox = document.getElementById('beerSearchBox');
        if (searchInput) {
            searchInput.value = '';
            searchBox.classList.remove('has-value');
            applyFilters();
        }
    };
    
    window.clearBeerFilter = function() {
        activeFilter = 'all';
        const filterCards = document.querySelectorAll('.beer-filter-card');
        filterCards.forEach(c => c.classList.remove('active'));
        document.querySelector('.beer-filter-card[data-filter="all"]')?.classList.add('active');
        
        // Reset anche la ricerca
        const searchInput = document.getElementById('beerSearchInput');
        const searchBox = document.getElementById('beerSearchBox');
        if (searchInput) {
            searchInput.value = '';
            searchBox.classList.remove('has-value');
        }
        
        applyFilters();
    };
})();
