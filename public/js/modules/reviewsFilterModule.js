/**
 * Reviews Filter Module - JavaScript
 * Gestione filtri dinamici per la pagina delle recensioni
 * Con autocomplete per ricerca birra/birrificio/utente
 */

(function() {
    'use strict';

    // Stato dei filtri
    let filtersState = {
        search: '',      // Ricerca generale (birra, birrificio, utente)
        searchType: '',  // Tipo selezionato (beer, brewery, user)
        rating: 0,
        user: ''         // Utente specifico
    };

    let originalReviews = []; // Cache delle recensioni originali
    let allSearchableItems = []; // Tutti gli elementi ricercabili
    let allUsers = []; // Tutti gli utenti
    let isFiltersOpen = false;

    /**
     * Inizializza il modulo filtri
     */
    function init() {
        const filtersWrapper = document.querySelector('.filters-wrapper');
        if (!filtersWrapper) return;

        console.log('[ReviewsFilter] Inizializzazione modulo filtri');

        // Salva le recensioni originali
        cacheOriginalReviews();

        // Costruisci indice ricercabile
        buildSearchIndex();

        // Bind eventi
        bindToggleButton();
        bindSearchAutocomplete();
        bindStarRating();
        bindActionButtons();

        // Ripristina filtri da URL
        restoreFiltersFromUrl();
    }

    /**
     * Cache delle recensioni originali dal DOM
     */
    function cacheOriginalReviews() {
        const reviewCards = document.querySelectorAll('.review-card');
        originalReviews = Array.from(reviewCards).map(card => ({
            element: card.cloneNode(true),
            data: {
                reviewId: card.dataset.reviewId,
                beer: (card.dataset.reviewBeer || '').toLowerCase(),
                brewery: (card.dataset.reviewBrewery || '').toLowerCase(),
                rating: parseInt(card.dataset.reviewRating) || 0,
                date: card.dataset.reviewDate,
                user: (card.dataset.reviewUser || '').toLowerCase()
            }
        }));
        console.log(`[ReviewsFilter] Cached ${originalReviews.length} recensioni`);
    }

    /**
     * Costruisce l'indice di elementi ricercabili (birre, birrifici, utenti)
     */
    function buildSearchIndex() {
        const beersSet = new Set();
        const breweriesSet = new Set();
        const usersSet = new Set();

        originalReviews.forEach(review => {
            if (review.data.beer) beersSet.add(review.data.beer);
            if (review.data.brewery) breweriesSet.add(review.data.brewery);
            if (review.data.user) usersSet.add(review.data.user);
        });

        allSearchableItems = [
            ...Array.from(beersSet).map(name => ({ name, type: 'beer', label: 'Birra' })),
            ...Array.from(breweriesSet).map(name => ({ name, type: 'brewery', label: 'Birrificio' })),
            ...Array.from(usersSet).map(name => ({ name, type: 'user', label: 'Utente' }))
        ];

        allUsers = Array.from(usersSet).map(name => ({ name, type: 'user', label: 'Utente' }));

        console.log(`[ReviewsFilter] Indice costruito: ${beersSet.size} birre, ${breweriesSet.size} birrifici, ${usersSet.size} utenti`);
    }

    /**
     * Toggle pannello filtri
     */
    function bindToggleButton() {
        const toggleBtn = document.getElementById('filters-toggle');
        const panel = document.getElementById('filters-panel');
        const closeBtn = document.getElementById('filters-close');

        if (!toggleBtn || !panel) return;

        // Funzione per aprire il pannello
        const openPanel = () => {
            isFiltersOpen = true;
            toggleBtn.classList.add('active');
            panel.classList.remove('closing');
            panel.classList.add('open');
        };

        // Funzione per chiudere il pannello con animazione
        const closePanel = () => {
            isFiltersOpen = false;
            toggleBtn.classList.remove('active');
            panel.classList.add('closing');
            
            // Rimuovi la classe open dopo l'animazione
            setTimeout(() => {
                panel.classList.remove('open', 'closing');
            }, 250);
        };

        // Toggle button
        toggleBtn.addEventListener('click', () => {
            if (isFiltersOpen) {
                closePanel();
            } else {
                openPanel();
            }
        });

        // Close button
        if (closeBtn) {
            closeBtn.addEventListener('click', closePanel);
        }

        // Chiudi cliccando fuori dal pannello
        document.addEventListener('click', (e) => {
            if (isFiltersOpen && 
                !panel.contains(e.target) && 
                !toggleBtn.contains(e.target)) {
                closePanel();
            }
        });

        // Chiudi con ESC
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && isFiltersOpen) {
                closePanel();
            }
        });
    }

    /**
     * Autocomplete per ricerca generale
     */
    function bindSearchAutocomplete() {
        const input = document.getElementById('filter-search');
        const dropdown = document.getElementById('search-dropdown');
        if (!input || !dropdown) return;

        let highlightedIndex = -1;

        input.addEventListener('input', debounce((e) => {
            const query = e.target.value.toLowerCase().trim();
            highlightedIndex = -1;

            if (query.length < 3) {
                dropdown.classList.remove('show');
                dropdown.innerHTML = '';
                return;
            }

            // Cerca match
            const matches = allSearchableItems.filter(item => 
                item.name.includes(query)
            ).slice(0, 10);

            if (matches.length === 0) {
                dropdown.innerHTML = '<div class="filter-autocomplete-empty">Nessun risultato trovato</div>';
                dropdown.classList.add('show');
                return;
            }

            // Render risultati
            dropdown.innerHTML = matches.map((item, idx) => `
                <div class="filter-autocomplete-item" data-index="${idx}" data-value="${escapeHtml(item.name)}" data-type="${item.type}">
                    <span class="item-type ${item.type}">${item.label}</span>
                    <span class="item-name">${highlightMatch(item.name, query)}</span>
                </div>
            `).join('');

            dropdown.classList.add('show');

            // Bind click su items
            dropdown.querySelectorAll('.filter-autocomplete-item').forEach(item => {
                item.addEventListener('click', () => {
                    selectSearchItem(item.dataset.value, item.dataset.type);
                    dropdown.classList.remove('show');
                });
            });
        }, 200));

        // Navigazione tastiera
        input.addEventListener('keydown', (e) => {
            const items = dropdown.querySelectorAll('.filter-autocomplete-item');
            if (!items.length) return;

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                highlightedIndex = Math.min(highlightedIndex + 1, items.length - 1);
                updateHighlight(items, highlightedIndex);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                highlightedIndex = Math.max(highlightedIndex - 1, 0);
                updateHighlight(items, highlightedIndex);
            } else if (e.key === 'Enter' && highlightedIndex >= 0) {
                e.preventDefault();
                const item = items[highlightedIndex];
                selectSearchItem(item.dataset.value, item.dataset.type);
                dropdown.classList.remove('show');
            } else if (e.key === 'Escape') {
                dropdown.classList.remove('show');
            }
        });

        // Chiudi dropdown quando si clicca fuori
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.filter-autocomplete-wrapper')) {
                dropdown.classList.remove('show');
            }
        });
    }

    /**
     * Seleziona un elemento dalla ricerca
     */
    function selectSearchItem(value, type) {
        const input = document.getElementById('filter-search');
        if (input) {
            // Mostra con capitalizzazione corretta
            input.value = capitalizeFirst(value);
        }
        filtersState.search = value;
        filtersState.searchType = type;
    }

    /**
     * Autocomplete per utente specifico
     */
    function bindUserAutocomplete() {
        const input = document.getElementById('filter-user');
        const dropdown = document.getElementById('user-dropdown');
        if (!input || !dropdown) return;

        let highlightedIndex = -1;

        input.addEventListener('input', debounce((e) => {
            const query = e.target.value.toLowerCase().trim();
            highlightedIndex = -1;

            if (query.length < 3) {
                dropdown.classList.remove('show');
                dropdown.innerHTML = '';
                return;
            }

            // Cerca match tra utenti
            const matches = allUsers.filter(item => 
                item.name.includes(query)
            ).slice(0, 8);

            if (matches.length === 0) {
                dropdown.innerHTML = '<div class="filter-autocomplete-empty">Nessun utente trovato</div>';
                dropdown.classList.add('show');
                return;
            }

            // Render risultati
            dropdown.innerHTML = matches.map((item, idx) => `
                <div class="filter-autocomplete-item" data-index="${idx}" data-value="${escapeHtml(item.name)}">
                    <span class="item-type user">Utente</span>
                    <span class="item-name">${highlightMatch(item.name, query)}</span>
                </div>
            `).join('');

            dropdown.classList.add('show');

            // Bind click su items
            dropdown.querySelectorAll('.filter-autocomplete-item').forEach(item => {
                item.addEventListener('click', () => {
                    input.value = capitalizeFirst(item.dataset.value);
                    filtersState.user = item.dataset.value;
                    dropdown.classList.remove('show');
                });
            });
        }, 200));

        // Navigazione tastiera
        input.addEventListener('keydown', (e) => {
            const items = dropdown.querySelectorAll('.filter-autocomplete-item');
            if (!items.length) return;

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                highlightedIndex = Math.min(highlightedIndex + 1, items.length - 1);
                updateHighlight(items, highlightedIndex);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                highlightedIndex = Math.max(highlightedIndex - 1, 0);
                updateHighlight(items, highlightedIndex);
            } else if (e.key === 'Enter' && highlightedIndex >= 0) {
                e.preventDefault();
                const item = items[highlightedIndex];
                input.value = capitalizeFirst(item.dataset.value);
                filtersState.user = item.dataset.value;
                dropdown.classList.remove('show');
            } else if (e.key === 'Escape') {
                dropdown.classList.remove('show');
            }
        });

        // Chiudi dropdown quando si clicca fuori
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.filter-autocomplete-wrapper')) {
                dropdown.classList.remove('show');
            }
        });
    }

    /**
     * Evidenzia la corrispondenza nel testo
     */
    function highlightMatch(text, query) {
        const idx = text.indexOf(query);
        if (idx === -1) return escapeHtml(text);
        
        const before = text.substring(0, idx);
        const match = text.substring(idx, idx + query.length);
        const after = text.substring(idx + query.length);
        
        return `${escapeHtml(before)}<mark>${escapeHtml(match)}</mark>${escapeHtml(after)}`;
    }

    /**
     * Aggiorna highlight della lista
     */
    function updateHighlight(items, index) {
        items.forEach((item, i) => {
            item.classList.toggle('highlighted', i === index);
        });
    }

    /**
     * Gestione rating stelle interattivo
     */
    function bindStarRating() {
        const starButtons = document.querySelectorAll('.star-filter-btn');
        if (!starButtons.length) return;

        starButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const value = parseInt(btn.dataset.value);
                
                // Toggle: se già selezionato, deseleziona
                if (filtersState.rating === value) {
                    filtersState.rating = 0;
                    starButtons.forEach(b => b.classList.remove('selected', 'active'));
                } else {
                    filtersState.rating = value;
                    starButtons.forEach((b, i) => {
                        const bValue = parseInt(b.dataset.value);
                        b.classList.remove('selected', 'active');
                        if (bValue <= value) {
                            b.classList.add('active');
                        }
                        if (bValue === value) {
                            b.classList.add('selected');
                        }
                    });
                }
            });

            // Hover effect
            btn.addEventListener('mouseenter', () => {
                const value = parseInt(btn.dataset.value);
                starButtons.forEach(b => {
                    if (parseInt(b.dataset.value) <= value) {
                        b.classList.add('active');
                    }
                });
            });

            btn.addEventListener('mouseleave', () => {
                starButtons.forEach(b => {
                    if (!b.classList.contains('selected')) {
                        const bValue = parseInt(b.dataset.value);
                        if (bValue > filtersState.rating) {
                            b.classList.remove('active');
                        }
                    }
                });
            });
        });
    }

    /**
     * Bind pulsanti azione (Applica, Reset)
     */
    function bindActionButtons() {
        // Applica Filtri
        const applyBtn = document.getElementById('filters-apply');
        if (applyBtn) {
            applyBtn.addEventListener('click', applyFilters);
        }

        // Reset Filtri
        const resetBtn = document.getElementById('filters-reset');
        if (resetBtn) {
            resetBtn.addEventListener('click', resetFilters);
        }
    }

    /**
     * Applica i filtri alle recensioni
     */
    function applyFilters() {
        console.log('[ReviewsFilter] Applicazione filtri:', filtersState);

        const reviewsList = document.getElementById('reviews-list');
        if (!reviewsList) return;

        // Filtra le recensioni
        const filtered = originalReviews.filter(review => {
            // Filtro Ricerca generale
            if (filtersState.search) {
                const searchTerm = filtersState.search.toLowerCase();
                let matchFound = false;

                if (filtersState.searchType === 'beer') {
                    matchFound = review.data.beer.includes(searchTerm);
                } else if (filtersState.searchType === 'brewery') {
                    matchFound = review.data.brewery.includes(searchTerm);
                } else if (filtersState.searchType === 'user') {
                    matchFound = review.data.user.includes(searchTerm);
                } else {
                    // Cerca in tutti
                    matchFound = review.data.beer.includes(searchTerm) ||
                                 review.data.brewery.includes(searchTerm) ||
                                 review.data.user.includes(searchTerm);
                }

                if (!matchFound) return false;
            }

            // Filtro Rating (minimo)
            if (filtersState.rating > 0 && review.data.rating < filtersState.rating) {
                return false;
            }

            // Filtro Utente specifico
            if (filtersState.user && !review.data.user.includes(filtersState.user.toLowerCase())) {
                return false;
            }

            return true;
        });

        // Aggiorna il DOM
        updateReviewsList(filtered);
        updateActiveFiltersChips();
        updateResultsCount(filtered.length);
        updateUrl();

        // Chiudi pannello su mobile
        if (window.innerWidth < 768) {
            const panel = document.getElementById('filters-panel');
            const toggleBtn = document.getElementById('filters-toggle');
            if (panel && toggleBtn) {
                panel.classList.remove('open');
                toggleBtn.classList.remove('active');
                isFiltersOpen = false;
            }
        }
    }

    /**
     * Aggiorna la lista delle recensioni nel DOM
     */
    function updateReviewsList(filteredReviews) {
        const reviewsList = document.getElementById('reviews-list');
        if (!reviewsList) return;

        // Pulisci lista
        reviewsList.innerHTML = '';

        if (filteredReviews.length === 0) {
            reviewsList.innerHTML = `
                <div class="reviews-empty-state">
                    <div class="empty-state-icon">🔍</div>
                    <p class="empty-state-text">Nessuna recensione corrisponde ai filtri selezionati.</p>
                    <button type="button" class="filter-btn filter-btn-cancel" onclick="window.ReviewsFilter.resetFilters()">
                        Rimuovi filtri
                    </button>
                </div>
            `;
            return;
        }

        // Aggiungi recensioni filtrate
        filteredReviews.forEach(review => {
            reviewsList.appendChild(review.element.cloneNode(true));
        });

        // Re-attach click handlers per le card
        if (window.LatestReviewsModule && window.LatestReviewsModule.attachAllReviewsClickHandlers) {
            window.LatestReviewsModule.attachAllReviewsClickHandlers();
        }
    }

    /**
     * Aggiorna i chip dei filtri attivi
     */
    function updateActiveFiltersChips() {
        const container = document.getElementById('active-filters');
        if (!container) return;

        container.innerHTML = '';
        let hasFilters = false;

        // Chip ricerca
        if (filtersState.search) {
            hasFilters = true;
            const typeLabel = filtersState.searchType === 'beer' ? 'Birra' :
                              filtersState.searchType === 'brewery' ? 'Birrificio' :
                              filtersState.searchType === 'user' ? 'Utente' : 'Cerca';
            container.appendChild(createFilterChip(typeLabel, filtersState.search, 'search'));
        }

        // Chip rating
        if (filtersState.rating > 0) {
            hasFilters = true;
            container.appendChild(createFilterChip('Valutazione', '≥ ' + filtersState.rating + ' ★', 'rating'));
        }

        // Chip utente
        if (filtersState.user) {
            hasFilters = true;
            container.appendChild(createFilterChip('Utente', filtersState.user, 'user'));
        }
    }

    /**
     * Crea un chip filtro
     */
    function createFilterChip(label, value, type) {
        const chip = document.createElement('div');
        chip.className = 'filter-chip';
        chip.innerHTML = `
            <span>${label}: ${escapeHtml(capitalizeFirst(value))}</span>
            <button type="button" class="filter-chip-remove" data-filter="${type}" aria-label="Rimuovi filtro">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
            </button>
        `;

        // Bind rimozione
        chip.querySelector('.filter-chip-remove').addEventListener('click', () => {
            removeFilter(type);
        });

        return chip;
    }

    /**
     * Rimuove un singolo filtro
     */
    function removeFilter(type) {
        switch(type) {
            case 'search':
                filtersState.search = '';
                filtersState.searchType = '';
                const searchInput = document.getElementById('filter-search');
                if (searchInput) searchInput.value = '';
                break;
            case 'rating':
                filtersState.rating = 0;
                document.querySelectorAll('.star-filter-btn').forEach(b => {
                    b.classList.remove('selected', 'active');
                });
                break;
            case 'user':
                filtersState.user = '';
                const userInput = document.getElementById('filter-user');
                if (userInput) userInput.value = '';
                break;
        }
        applyFilters();
    }

    /**
     * Reset di tutti i filtri
     */
    function resetFilters() {
        console.log('[ReviewsFilter] Reset filtri');

        filtersState = {
            search: '',
            searchType: '',
            rating: 0,
            user: ''
        };

        // Reset inputs
        const searchInput = document.getElementById('filter-search');
        const userInput = document.getElementById('filter-user');
        if (searchInput) searchInput.value = '';
        if (userInput) userInput.value = '';

        // Reset stelle
        document.querySelectorAll('.star-filter-btn').forEach(b => {
            b.classList.remove('selected', 'active');
        });

        // Applica (mostra tutte)
        applyFilters();
    }

    /**
     * Aggiorna conteggio risultati
     */
    function updateResultsCount(count) {
        const statsNumber = document.querySelector('.reviews-stats-number');
        const statsText = document.querySelector('.reviews-stats-text');
        if (statsNumber && statsText) {
            statsNumber.textContent = count;
            const suffix = count !== originalReviews.length ? ' filtrate' : ' pubblicate';
            statsText.innerHTML = `<span class="reviews-stats-number">${count}</span> recensioni${suffix}`;
        }
    }

    /**
     * Salva filtri nell'URL
     */
    function updateUrl() {
        const params = new URLSearchParams();
        
        if (filtersState.search) {
            params.set('q', filtersState.search);
            if (filtersState.searchType) params.set('type', filtersState.searchType);
        }
        if (filtersState.rating > 0) params.set('rating', filtersState.rating);
        if (filtersState.user) params.set('user', filtersState.user);

        const newUrl = params.toString() 
            ? `${window.location.pathname}?${params.toString()}`
            : window.location.pathname;

        window.history.replaceState({}, '', newUrl);
    }

    /**
     * Ripristina filtri dall'URL
     */
    function restoreFiltersFromUrl() {
        const params = new URLSearchParams(window.location.search);

        if (params.has('q')) {
            filtersState.search = params.get('q');
            filtersState.searchType = params.get('type') || '';
            const el = document.getElementById('filter-search');
            if (el) el.value = capitalizeFirst(filtersState.search);
        }

        if (params.has('rating')) {
            filtersState.rating = parseInt(params.get('rating')) || 0;
            if (filtersState.rating > 0) {
                document.querySelectorAll('.star-filter-btn').forEach(btn => {
                    const value = parseInt(btn.dataset.value);
                    if (value <= filtersState.rating) btn.classList.add('active');
                    if (value === filtersState.rating) btn.classList.add('selected');
                });
            }
        }

        if (params.has('user')) {
            filtersState.user = params.get('user');
            const el = document.getElementById('filter-user');
            if (el) el.value = capitalizeFirst(filtersState.user);
        }

        // Se ci sono filtri, applicali
        const hasFilters = filtersState.search || filtersState.rating > 0 || filtersState.user;
        if (hasFilters) {
            // Apri pannello se ci sono filtri attivi
            const panel = document.getElementById('filters-panel');
            const toggleBtn = document.getElementById('filters-toggle');
            if (panel && toggleBtn) {
                panel.classList.add('open');
                toggleBtn.classList.add('active');
                isFiltersOpen = true;
            }
            applyFilters();
        }
    }

    // ================================
    // Utility Functions
    // ================================

    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function capitalizeFirst(str) {
        if (!str) return '';
        return str.charAt(0).toUpperCase() + str.slice(1);
    }

    // ================================
    // Esporta API pubblica
    // ================================
    window.ReviewsFilter = {
        init,
        applyFilters,
        resetFilters,
        getState: () => ({ ...filtersState })
    };

    // Auto-init quando DOM è pronto
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
