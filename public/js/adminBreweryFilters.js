/**
 * Gestione filtri per la pagina di amministrazione birrifici
 * Stile uniforme alla pagina di gestione utenti
 */

let currentFilter = 'all';

document.addEventListener('DOMContentLoaded', function() {
    console.log('Admin Brewery Filters caricato');
    
    // Aggiungi event listeners alle card filtro
    document.querySelectorAll('.brewery-filter-card').forEach(card => {
        card.addEventListener('click', function() {
            const filter = this.getAttribute('data-filter');
            filterBreweries(filter);
        });
    });
});

/**
 * Filtra i birrifici in base al criterio selezionato
 * @param {string} filter - Tipo di filtro da applicare
 */
function filterBreweries(filter) {
    currentFilter = filter;
    const rows = document.querySelectorAll('.brewery-row');
    const filterIndicator = document.getElementById('filter-indicator');
    const filterMessage = document.getElementById('filter-message');
    
    // Rimuovi classe active da tutte le card
    document.querySelectorAll('.brewery-filter-card').forEach(card => {
        card.classList.remove('active');
    });
    
    // Aggiungi classe active alla card selezionata
    const selectedCard = document.querySelector(`.brewery-filter-card[data-filter="${filter}"]`);
    if (selectedCard) {
        selectedCard.classList.add('active');
    }
    
    // Applica il filtro
    let visibleCount = 0;
    rows.forEach(row => {
        let shouldShow = true;
        
        switch(filter) {
            case 'all':
                shouldShow = true;
                break;
            case 'with-email':
                shouldShow = row.getAttribute('data-has-email') === 'true';
                break;
            case 'with-website':
                shouldShow = row.getAttribute('data-has-website') === 'true';
                break;
            case 'incomplete-data':
                shouldShow = row.getAttribute('data-complete-data') === 'false';
                break;
            default:
                shouldShow = true;
        }
        
        if (shouldShow) {
            row.classList.remove('filtered-out');
            row.style.display = '';
            visibleCount++;
        } else {
            row.classList.add('filtered-out');
        }
    });
    
    // Mostra/nascondi indicatore filtro
    if (filter === 'all') {
        if (filterIndicator) {
            filterIndicator.style.display = 'none';
        }
    } else {
        const filterNames = {
            'with-email': 'Birrifici con email',
            'with-website': 'Birrifici con sito web', 
            'incomplete-data': 'Birrifici con dati incompleti'
        };
        
        if (filterMessage) {
            filterMessage.textContent = `${filterNames[filter]} (${visibleCount} risultati)`;
        }
        if (filterIndicator) {
            filterIndicator.style.display = 'block';
        }
    }
    
    console.log(`Filtro applicato: ${filter}, risultati visibili: ${visibleCount}`);
}

/**
 * Rimuove tutti i filtri e mostra tutti i birrifici
 */
function clearBreweryFilter() {
    filterBreweries('all');
}

// Esponi le funzioni globalmente per compatibilità con gli onclick
window.filterBreweries = filterBreweries;
window.clearBreweryFilter = clearBreweryFilter;