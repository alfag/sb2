/**
 * 🌐 WEB SEARCH MODULE - Gestione ricerca web automatica
 * 
 * Questo modulo gestisce la chiamata automatica all'API di ricerca web
 * quando l'AI restituisce dati incompleti per birrifici o birre.
 */

const WebSearchModule = {
  
  /**
   * Cerca un birrificio sul web quando l'AI non trova dati completi
   * @param {Object} partialData - Dati parziali estratti dall'AI
   * @returns {Promise<Object>} Risultato della ricerca web
   */
  async searchBrewery(partialData) {
    console.log('[WebSearch] 🔍 Avvio ricerca automatica birrificio:', partialData);
    
    try {
      const response = await fetch('/api/web-search/brewery', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: partialData.name || partialData.breweryName,
          location: partialData.location || partialData.breweryLegalAddress,
          website: partialData.website || partialData.breweryWebsite
        })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      console.log('[WebSearch] 📡 Risultato ricerca:', result);
      
      return result;
      
    } catch (error) {
      console.error('[WebSearch] ❌ Errore ricerca birrificio:', error);
      return {
        success: false,
        found: false,
        error: error.message
      };
    }
  },
  
  /**
   * Cerca una birra sul web
   * @param {Object} partialData - Dati parziali della birra
   * @param {string} breweryId - ID del birrificio
   * @returns {Promise<Object>} Risultato della ricerca birra
   */
  async searchBeer(partialData, breweryId) {
    console.log('[WebSearch] 🔍 Avvio ricerca automatica birra:', partialData);
    
    try {
      const response = await fetch('/api/web-search/beer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          beerName: partialData.beerName || partialData.name,
          breweryId: breweryId
        })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      console.log('[WebSearch] 📡 Risultato ricerca birra:', result);
      
      return result;
      
    } catch (error) {
      console.error('[WebSearch] ❌ Errore ricerca birra:', error);
      return {
        success: false,
        found: false,
        error: error.message
      };
    }
  },
  
  /**
   * Mostra UI di conferma risultati ricerca web
   * @param {Object} searchResult - Risultato ricerca (brewery o beer)
   * @param {Function} onConfirm - Callback quando utente conferma
   * @param {Function} onReject - Callback quando utente rifiuta
   * @param {Function} onManual - Callback per input manuale
   */
  showConfirmationUI(searchResult, onConfirm, onReject, onManual) {
    console.log('[WebSearch] 🎨 Mostra UI conferma:', searchResult);
    
    const data = searchResult.brewery || searchResult.beer;
    const type = searchResult.brewery ? 'birrificio' : 'birra';
    const confidence = Math.round(searchResult.confidence * 100);
    
    // Crea overlay modale
    const overlayHTML = `
      <div id="webSearchModal" class="web-search-overlay">
        <div class="web-search-modal">
          <div class="modal-header">
            <i class="fas fa-check-circle" style="color: #10b981; font-size: 2rem;"></i>
            <h3>🎉 Ho trovato il ${type}!</h3>
            <span class="confidence-badge" style="background: ${confidence >= 80 ? '#10b981' : confidence >= 60 ? '#f59e0b' : '#ef4444'}">
              Affidabilità: ${confidence}%
            </span>
          </div>
          
          <div class="result-card">
            ${this._renderBreweryCard(data, searchResult)}
          </div>
          
          ${searchResult.sources && searchResult.sources.length > 0 ? `
            <div class="sources-info">
              <small>
                <i class="fas fa-info-circle"></i>
                Fonti: ${searchResult.sources.map(s => s.type).join(', ')}
              </small>
            </div>
          ` : ''}
          
          <div class="action-buttons">
            <button id="wsConfirmBtn" class="btn-confirm">
              <i class="fas fa-check"></i> Sì, è questo
            </button>
            <button id="wsRejectBtn" class="btn-reject">
              <i class="fas fa-times"></i> No, cerca altro
            </button>
            <button id="wsManualBtn" class="btn-manual">
              <i class="fas fa-edit"></i> Inserisci manualmente
            </button>
          </div>
        </div>
      </div>
    `;
    
    // Rimuovi modal esistente se presente
    const existingModal = document.getElementById('webSearchModal');
    if (existingModal) {
      existingModal.remove();
    }
    
    // Inserisci nel DOM
    document.body.insertAdjacentHTML('beforeend', overlayHTML);
    
    // Event listeners
    document.getElementById('wsConfirmBtn').addEventListener('click', () => {
      this._closeModal();
      if (onConfirm) onConfirm(searchResult);
    });
    
    document.getElementById('wsRejectBtn').addEventListener('click', () => {
      this._closeModal();
      if (onReject) onReject(searchResult);
    });
    
    document.getElementById('wsManualBtn').addEventListener('click', () => {
      this._closeModal();
      if (onManual) onManual();
    });
    
    // Chiudi con ESC o click fuori
    const modal = document.getElementById('webSearchModal');
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        this._closeModal();
        if (onReject) onReject(searchResult);
      }
    });
    
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this._closeModal();
        if (onReject) onReject(searchResult);
      }
    });
  },
  
  /**
   * Renderizza card con dati birrificio
   * @private
   */
  _renderBreweryCard(data, searchResult) {
    if (searchResult.brewery) {
      return `
        <h4><i class="fas fa-industry"></i> ${data.breweryName}</h4>
        <p>
          <i class="fas fa-map-marker-alt"></i> 
          ${data.breweryLegalAddress || 'Indirizzo non disponibile'}
        </p>
        ${data.breweryWebsite ? `
          <p>
            <i class="fas fa-globe"></i> 
            <a href="${data.breweryWebsite}" target="_blank" rel="noopener">
              ${data.breweryWebsite}
            </a>
          </p>
        ` : ''}
        ${data.breweryEmail ? `
          <p>
            <i class="fas fa-envelope"></i> 
            ${data.breweryEmail}
          </p>
        ` : ''}
        ${data.breweryDescription ? `
          <p class="description">
            <i class="fas fa-info-circle"></i> 
            ${data.breweryDescription}
          </p>
        ` : ''}
        ${data.foundingYear ? `
          <p>
            <i class="fas fa-calendar"></i> 
            Fondato: ${data.foundingYear}
          </p>
        ` : ''}
      `;
    } else {
      // Card birra
      return `
        <h4><i class="fas fa-beer"></i> ${data.beerName}</h4>
        ${data.beerType ? `
          <p>
            <i class="fas fa-tag"></i> 
            Tipo: ${data.beerType}
          </p>
        ` : ''}
        ${data.alcoholContent ? `
          <p>
            <i class="fas fa-percentage"></i> 
            Gradazione: ${data.alcoholContent}%
          </p>
        ` : ''}
        ${data.beerDescription ? `
          <p class="description">
            <i class="fas fa-info-circle"></i> 
            ${data.beerDescription}
          </p>
        ` : ''}
        ${data.ibu ? `
          <p>
            <i class="fas fa-chart-line"></i> 
            IBU: ${data.ibu}
          </p>
        ` : ''}
        ${data.color ? `
          <p>
            <i class="fas fa-palette"></i> 
            Colore: ${data.color}
          </p>
        ` : ''}
      `;
    }
  },
  
  /**
   * Chiudi modal ricerca web
   * @private
   */
  _closeModal() {
    const modal = document.getElementById('webSearchModal');
    if (modal) {
      modal.classList.add('fade-out');
      setTimeout(() => modal.remove(), 300);
    }
  },
  
  /**
   * Mostra loading durante ricerca web
   */
  showSearchingOverlay(message = 'Ricerca automatica in corso...') {
    const overlayHTML = `
      <div id="webSearchLoading" class="web-search-overlay">
        <div class="web-search-loading">
          <div class="spinner"></div>
          <h3>${message}</h3>
          <p>Sto cercando informazioni sul web...</p>
        </div>
      </div>
    `;
    
    const existingOverlay = document.getElementById('webSearchLoading');
    if (existingOverlay) {
      existingOverlay.remove();
    }
    
    document.body.insertAdjacentHTML('beforeend', overlayHTML);
  },
  
  /**
   * Nasconde loading ricerca web
   */
  hideSearchingOverlay() {
    const overlay = document.getElementById('webSearchLoading');
    if (overlay) {
      overlay.classList.add('fade-out');
      setTimeout(() => overlay.remove(), 300);
    }
  }
};

// Export per utilizzo in altri moduli
if (typeof window !== 'undefined') {
  window.WebSearchModule = WebSearchModule;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = WebSearchModule;
}
