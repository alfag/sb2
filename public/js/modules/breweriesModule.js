/**
 * Breweries Module - Gestione visualizzazione birrifici nella welcome page
 * Sistema leggero per mostrare birrifici registrati con UI minimal
 */

console.log('🍺 BreweriesModule.js - FILE CARICATO!');

const BreweriesModule = (() => {
    /**
     * Carica e visualizza i birrifici registrati
     */
    async function loadBreweries() {
        const breweryList = document.getElementById('brewery-list');
        
        if (!breweryList) {
            console.error('[BreweriesModule] Container #brewery-list non trovato nella pagina');
            return;
        }

        console.log('[BreweriesModule] Inizio caricamento birrifici...');

        // FORZA lo stile griglia inline per override TOTALE di qualsiasi CSS
        breweryList.setAttribute('style', 'display: grid !important; grid-template-columns: repeat(3, 1fr) !important; gap: 1.25rem !important;');
        
        // Rimuovi eventuali classi Tailwind che potrebbero interferire
        breweryList.className = '';

        try {
            // Mostra loading placeholder
            breweryList.innerHTML = createLoadingPlaceholder();

            // Fetch birrifici dal backend
            const response = await fetch('/api/breweries/all');
            const data = await response.json();

            console.log('[BreweriesModule] Dati ricevuti:', data);

            if (!data.success || !data.breweries || data.breweries.length === 0) {
                console.log('[BreweriesModule] Nessun birrificio trovato');
                breweryList.innerHTML = createEmptyState();
                return;
            }

            // Limita a massimo 6 birrifici per la home page (3 colonne x 2 righe)
            const breweriesDisplay = data.breweries.slice(0, 6);
            
            console.log(`[BreweriesModule] Visualizzo ${breweriesDisplay.length} birrifici su ${data.breweries.length} totali`);
            
            // Renderizza i birrifici con indice per i gradienti
            breweryList.innerHTML = breweriesDisplay
                .map((brewery, index) => createBreweryCard(brewery, index))
                .join('');

            console.log('[BreweriesModule] Birrifici renderizzati, verifica HTML generato');
            
            // FORZA nuovamente la griglia dopo il render (per sicurezza)
            setTimeout(() => {
                breweryList.setAttribute('style', 'display: grid !important; grid-template-columns: repeat(3, 1fr) !important; gap: 1.25rem !important;');
                console.log('[BreweriesModule] Stile griglia ri-applicato dopo render');
            }, 100);

            // Mostra testo "Altri N birrifici" se ci sono più birrifici
            if (data.breweries.length > 6) {
                addViewAllLink(breweryList.parentElement, data.breweries.length);
            }

        } catch (error) {
            console.error('[BreweriesModule] Errore caricamento birrifici:', error);
            breweryList.innerHTML = createErrorState();
        }
    }

    /**
     * Estrae l'iniziale corretta dal nome del birrificio
     * Ignora parole comuni come "Birrificio", "Birra", "Brewery", "Beer"
     */
    function extractInitial(breweryName) {
        if (!breweryName) return '?';
        
        // Parole da ignorare (case insensitive)
        const ignoreWords = ['birrificio', 'birra', 'brewery', 'beer', 'cervecería', 'brasserie'];
        
        // Dividi il nome in parole
        const words = breweryName.trim().split(/\s+/);
        
        // Trova la prima parola valida (non nelle parole da ignorare)
        for (const word of words) {
            if (word && !ignoreWords.includes(word.toLowerCase())) {
                const initial = word.charAt(0).toUpperCase();
                console.log(`[BreweriesModule] "${breweryName}" → Parola valida: "${word}" → Iniziale: "${initial}"`);
                return initial;
            }
        }
        
        // Fallback: usa la prima lettera del nome completo
        return breweryName.charAt(0).toUpperCase();
    }

    /**
     * Crea card con iniziale stilizzata colorata - Card NON cliccabile (solo visualizzazione)
     */
    function createBreweryCard(brewery, index) {
        // Estrai l'iniziale intelligentemente
        const initial = extractInitial(brewery.breweryName);
        
        console.log(`[BreweriesModule] Birrificio ${index + 1}: "${brewery.breweryName}" → Iniziale finale: "${initial}"`);
        
        // Gradienti colorati ciclici
        const gradients = [
            'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', // Viola-Magenta
            'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)', // Rosa-Rosso
            'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)', // Blu-Ciano
            'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)', // Verde-Acqua
            'linear-gradient(135deg, #fa709a 0%, #fee140 100%)', // Rosa-Giallo
            'linear-gradient(135deg, #30cfd0 0%, #330867 100%)'  // Ciano-Viola scuro
        ];
        
        const gradient = gradients[index % gradients.length];
        
        return `
            <div class="brewery-card-wrapper" style="display: block;">
                <div class="brewery-card" style="display: flex !important; align-items: center !important; gap: 1rem !important; padding: 1.5rem !important; background: white !important; border: 2px solid #d1d5db !important; border-radius: 0.75rem !important; margin-bottom: 0 !important;">
                    <div class="brewery-initial" style="width: 56px; height: 56px; min-width: 56px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 1.75rem; font-weight: 700; color: white; text-transform: uppercase; box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1); background: ${gradient};">${initial}</div>
                    <div class="brewery-info" style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 0.5rem;">
                        <h3 class="brewery-name" style="font-size: 1.125rem; font-weight: 600; color: #111827; margin: 0; line-height: 1.3; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(brewery.breweryName)}</h3>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Crea placeholder di caricamento con iniziale skeleton
     */
    function createLoadingPlaceholder() {
        return Array(6).fill(0).map(() => `
            <div class="brewery-card-link">
                <div class="brewery-card skeleton">
                    <div class="brewery-initial skeleton-initial"></div>
                    <div class="brewery-info">
                        <div class="skeleton-text skeleton-title"></div>
                        <div class="skeleton-text skeleton-link"></div>
                    </div>
                </div>
            </div>
        `).join('');
    }

    /**
     * Crea stato vuoto
     */
    function createEmptyState() {
        return `
            <div class="empty-state">
                <div class="empty-state-icon">🏭</div>
                <p class="empty-state-text">Nessun birrificio registrato al momento</p>
            </div>
        `;
    }

    /**
     * Crea stato errore
     */
    function createErrorState() {
        return `
            <div class="empty-state">
                <div class="empty-state-icon">⚠️</div>
                <p class="empty-state-text">Errore nel caricamento dei birrifici</p>
            </div>
        `;
    }

    /**
     * Aggiunge testo "Altri N birrifici" se ce ne sono più di 6
     */
    function addViewAllLink(container, totalCount) {
        const existingText = container.querySelector('.more-breweries-text');
        if (existingText) return;

        const remaining = totalCount - 6;
        const text = document.createElement('p');
        text.className = 'more-breweries-text';
        text.textContent = `+ altri ${remaining} birrifici`;
        container.appendChild(text);
    }

    /**
     * Escape HTML per sicurezza
     */
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Inizializzazione modulo
     */
    function init() {
        // Verifica immediata presenza container
        const container = document.getElementById('brewery-list');
        if (container) {
            console.log('[BreweriesModule] Inizializzazione - Container trovato, carico birrifici...');
            loadBreweries();
        } else {
            // Container non trovato - normale se non siamo nella welcome page
            // Esci silenziosamente senza log per non inquinare la console
            return;
        }
    }

    // API pubblica
    return {
        init,
        loadBreweries
    };
})();

// Auto-inizializzazione con controllo completo dello stato del DOM
// (Log ridotti per evitare rumore in console su pagine che non usano il modulo)

if (typeof window !== 'undefined') {
    window.BreweriesModule = BreweriesModule;
}

// Inizializza immediatamente se il DOM è già pronto
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        BreweriesModule.init();
    });
} else {
    BreweriesModule.init();
}

