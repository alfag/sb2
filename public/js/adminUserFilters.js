/**
 * Sistema di Filtro Utenti per Amministratori - SB2
 * Implementa il filtro delle card utenti per ruolo
 * 
 * @author GitHub Copilot
 * @version 1.0.0
 * @date 12 Ottobre 2025
 */

class AdminUserFilters {
    constructor() {
        this.currentFilter = 'all';
        this.init();
    }

    init() {
        this.bindEventListeners();
        this.filterUsersByRole('all'); // Inizializza mostrando tutti gli utenti
        logger.info('Sistema di filtro utenti per ruolo inizializzato');
    }

    bindEventListeners() {
        const filterCards = document.querySelectorAll('.role-filter-card');
        
        filterCards.forEach(card => {
            card.addEventListener('click', (e) => {
                const role = card.getAttribute('data-role');
                this.filterUsersByRole(role);
            });
            
            // Effetti hover avanzati
            card.addEventListener('mouseenter', () => {
                if (!card.classList.contains('active')) {
                    card.style.transform = 'translateY(-2px)';
                }
            });
            
            card.addEventListener('mouseleave', () => {
                if (!card.classList.contains('active')) {
                    card.style.transform = 'translateY(0)';
                }
            });
        });
    }

    /**
     * Filtra gli utenti per ruolo specificato
     * @param {string} role - Il ruolo da filtrare ('all', 'customer', 'brewery', 'administrator')
     */
    filterUsersByRole(role) {
        const userRows = document.querySelectorAll('.user-row');
        const filterCards = document.querySelectorAll('.role-filter-card');
        const filterIndicator = document.getElementById('filter-indicator');
        const filterMessage = document.getElementById('filter-message');
        
        // Rimuovi classe active da tutte le card
        filterCards.forEach(card => card.classList.remove('active'));
        
        // Aggiungi classe active alla card selezionata
        const activeCard = document.querySelector(`[data-role="${role}"]`);
        if (activeCard) {
            activeCard.classList.add('active');
        }
        
        // Aggiorna filtro corrente
        this.currentFilter = role;
        
        let visibleCount = 0;
        
        if (role === 'all') {
            this.showAllUsers(userRows, filterIndicator);
            visibleCount = userRows.length;
        } else {
            visibleCount = this.filterBySpecificRole(role, userRows, filterIndicator, filterMessage);
        }
        
        logger.info(`Filtro applicato: ${role}, ${visibleCount} utenti visibili`);
    }

    /**
     * Mostra tutti gli utenti rimuovendo i filtri
     * @param {NodeList} userRows - Lista delle righe utenti
     * @param {HTMLElement} filterIndicator - Elemento indicatore filtro
     */
    showAllUsers(userRows, filterIndicator) {
        userRows.forEach(row => {
            row.classList.remove('filtered-out');
            row.style.display = '';
        });
        
        filterIndicator.style.display = 'none';
    }

    /**
     * Filtra per un ruolo specifico
     * @param {string} role - Ruolo specifico
     * @param {NodeList} userRows - Lista delle righe utenti
     * @param {HTMLElement} filterIndicator - Elemento indicatore filtro
     * @param {HTMLElement} filterMessage - Elemento messaggio filtro
     * @returns {number} Numero di utenti visibili
     */
    filterBySpecificRole(role, userRows, filterIndicator, filterMessage) {
        let visibleCount = 0;
        
        userRows.forEach(row => {
            const userRoles = row.getAttribute('data-user-roles').split(',');
            
            if (userRoles.includes(role)) {
                row.classList.remove('filtered-out');
                row.style.display = '';
                visibleCount++;
            } else {
                row.classList.add('filtered-out');
                row.style.display = 'none';
            }
        });
        
        // Aggiorna indicatore filtro
        const roleNames = {
            'customer': 'Clienti',
            'brewery': 'Birrifici', 
            'administrator': 'Amministratori'
        };
        
        filterMessage.textContent = `Filtro attivo: ${roleNames[role]} (${visibleCount} utenti)`;
        filterIndicator.style.display = 'block';
        
        return visibleCount;
    }

    /**
     * Rimuove il filtro corrente e mostra tutti gli utenti
     */
    clearRoleFilter() {
        this.filterUsersByRole('all');
    }

    /**
     * Ottieni il filtro corrente
     * @returns {string} Il filtro attualmente applicato
     */
    getCurrentFilter() {
        return this.currentFilter;
    }

    /**
     * Logger personalizzato per debug
     * @param {string} message - Messaggio da loggare
     */
    static logger = {
        info: (message) => console.log(`[AdminUserFilters] ${message}`),
        error: (message) => console.error(`[AdminUserFilters] ${message}`)
    };
}

// Alias per retrocompatibilità
const logger = AdminUserFilters.logger;

// Inizializzazione automatica quando il DOM è pronto
document.addEventListener('DOMContentLoaded', function() {
    window.adminUserFilters = new AdminUserFilters();
});

// Funzioni globali per retrocompatibilità e utilizzo dai template
function filterUsersByRole(role) {
    if (window.adminUserFilters) {
        window.adminUserFilters.filterUsersByRole(role);
    }
}

function clearRoleFilter() {
    if (window.adminUserFilters) {
        window.adminUserFilters.clearRoleFilter();
    }
}

// Export per uso in altri moduli (se necessario)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AdminUserFilters;
}