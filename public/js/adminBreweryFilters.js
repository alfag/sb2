/**
 * Gestione filtri per la pagina di amministrazione birrifici
 * Stile uniforme alla pagina di gestione utenti
 */

let currentFilter = 'all';
let currentSearchTerm = '';

document.addEventListener('DOMContentLoaded', function() {
    console.log('Admin Brewery Filters caricato');
    
    // Aggiungi event listeners alle card filtro
    document.querySelectorAll('.brewery-filter-card').forEach(card => {
        card.addEventListener('click', function() {
            const filter = this.getAttribute('data-filter');
            filterBreweries(filter);
        });
    });
    
    // Setup ricerca birrifici
    const searchInput = document.getElementById('brewerySearchInput');
    const searchBox = document.getElementById('brewerySearchBox');
    
    if (searchInput) {
        // Ricerca in tempo reale mentre si digita
        searchInput.addEventListener('input', function() {
            currentSearchTerm = this.value.trim().toLowerCase();
            
            // Toggle classe per mostrare/nascondere pulsante clear
            if (currentSearchTerm) {
                searchBox.classList.add('has-value');
            } else {
                searchBox.classList.remove('has-value');
            }
            
            applyFilters();
        });
        
        // Supporto tasto ESC per cancellare
        searchInput.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') {
                clearBrewerySearch();
            }
        });
    }
});

/**
 * Filtra i birrifici in base al criterio selezionato
 * @param {string} filter - Tipo di filtro da applicare
 */
function filterBreweries(filter) {
    currentFilter = filter;
    
    // Rimuovi classe active da tutte le card
    document.querySelectorAll('.brewery-filter-card').forEach(card => {
        card.classList.remove('active');
    });
    
    // Aggiungi classe active alla card selezionata
    const selectedCard = document.querySelector(`.brewery-filter-card[data-filter="${filter}"]`);
    if (selectedCard) {
        selectedCard.classList.add('active');
    }
    
    applyFilters();
}

/**
 * Applica sia il filtro categoria che la ricerca testuale
 */
function applyFilters() {
    const rows = document.querySelectorAll('.brewery-row');
    const filterIndicator = document.getElementById('filter-indicator');
    const filterMessage = document.getElementById('filter-message');
    
    let visibleCount = 0;
    
    rows.forEach(row => {
        // Verifica filtro categoria
        let matchesFilter = true;
        switch(currentFilter) {
            case 'all':
                matchesFilter = true;
                break;
            case 'with-email':
                matchesFilter = row.getAttribute('data-has-email') === 'true';
                break;
            case 'with-website':
                matchesFilter = row.getAttribute('data-has-website') === 'true';
                break;
            case 'incomplete-data':
                matchesFilter = row.getAttribute('data-complete-data') === 'false';
                break;
            case 'without-logo':
                matchesFilter = row.getAttribute('data-has-logo') === 'false';
                break;
        }
        
        // Verifica ricerca testuale
        let matchesSearch = true;
        if (currentSearchTerm) {
            const breweryName = row.querySelector('.brewery-name');
            const name = breweryName ? breweryName.textContent.toLowerCase() : '';
            matchesSearch = name.includes(currentSearchTerm);
        }
        
        // Mostra solo se entrambi i criteri sono soddisfatti
        if (matchesFilter && matchesSearch) {
            row.classList.remove('filtered-out');
            row.style.display = '';
            visibleCount++;
        } else {
            row.classList.add('filtered-out');
            row.style.display = 'none';
        }
    });
    
    // Aggiorna indicatore filtro
    updateFilterIndicator(visibleCount, filterIndicator, filterMessage);
    
    console.log(`Filtri applicati - Categoria: ${currentFilter}, Ricerca: "${currentSearchTerm}", Risultati: ${visibleCount}`);
}

/**
 * Aggiorna l'indicatore dei filtri attivi
 */
function updateFilterIndicator(visibleCount, filterIndicator, filterMessage) {
    const hasActiveFilter = currentFilter !== 'all';
    const hasSearchTerm = currentSearchTerm !== '';
    
    if (!hasActiveFilter && !hasSearchTerm) {
        if (filterIndicator) {
            filterIndicator.style.display = 'none';
        }
        return;
    }
    
    const filterNames = {
        'with-email': 'con email',
        'with-website': 'con sito web', 
        'incomplete-data': 'con dati incompleti',
        'without-logo': 'senza logo'
    };
    
    let message = '';
    if (hasActiveFilter && hasSearchTerm) {
        message = `Birrifici ${filterNames[currentFilter]} contenenti "${currentSearchTerm}" (${visibleCount})`;
    } else if (hasActiveFilter) {
        message = `Birrifici ${filterNames[currentFilter]} (${visibleCount})`;
    } else if (hasSearchTerm) {
        message = `Ricerca: "${currentSearchTerm}" (${visibleCount} risultati)`;
    }
    
    if (filterMessage) {
        filterMessage.textContent = message;
    }
    if (filterIndicator) {
        filterIndicator.style.display = 'block';
    }
}

/**
 * Rimuove tutti i filtri e mostra tutti i birrifici
 */
function clearBreweryFilter() {
    // Reset anche la ricerca
    clearBrewerySearch();
    filterBreweries('all');
}

/**
 * Cancella la ricerca testuale
 */
function clearBrewerySearch() {
    const searchInput = document.getElementById('brewerySearchInput');
    const searchBox = document.getElementById('brewerySearchBox');
    
    if (searchInput) {
        searchInput.value = '';
        currentSearchTerm = '';
    }
    if (searchBox) {
        searchBox.classList.remove('has-value');
    }
    
    applyFilters();
}

// Esponi le funzioni globalmente per compatibilità con gli onclick
window.filterBreweries = filterBreweries;
window.clearBreweryFilter = clearBreweryFilter;
window.clearBrewerySearch = clearBrewerySearch;