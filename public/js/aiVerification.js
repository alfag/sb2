/**
 * AI Verification Interface - Interactive Management
 * Gestisce tutte le interazioni utente per la verifica dei dati AI
 */

class AIVerificationManager {
  constructor() {
    this.validationData = window.aiVerificationData?.validation || {};
    this.sessionData = window.aiVerificationData?.sessionData || {};
    this.userCompletions = [];
    this.init();
  }

  init() {
    console.log('🤖 Inizializzazione AI Verification Manager');
    this.bindEvents();
    this.loadSavedData();
    this.showLoadingIfNeeded();
  }

  bindEvents() {
    // Eventi principali
    const confirmSaveBtn = document.getElementById('confirmSaveBtn');
    const saveVerifiedBtn = document.getElementById('saveVerifiedBtn');
    const completeAllBtn = document.getElementById('completeAllBtn');
    const reviewDetailsBtn = document.getElementById('reviewDetailsBtn');

    if (confirmSaveBtn) {
      confirmSaveBtn.addEventListener('click', () => this.confirmSaveAll());
    }

    if (saveVerifiedBtn) {
      saveVerifiedBtn.addEventListener('click', () => this.saveVerifiedOnly());
    }

    if (completeAllBtn) {
      completeAllBtn.addEventListener('click', () => this.showCompleteAllMode());
    }

    if (reviewDetailsBtn) {
      reviewDetailsBtn.addEventListener('click', () => this.showDetailsModal());
    }

    // Eventi per form manuali
    document.addEventListener('click', (e) => {
      if (e.target.matches('[onclick*="saveManualData"]')) {
        e.preventDefault();
        this.saveManualData(e.target.closest('form'));
      }
      
      if (e.target.matches('[onclick*="searchSuggestions"]')) {
        e.preventDefault();
        this.searchSuggestions(e.target.closest('form'));
      }
      
      if (e.target.matches('[onclick*="confirmBrewery"]')) {
        e.preventDefault();
        const [breweryName, exists] = this.extractClickParams(e.target.getAttribute('onclick'));
        this.confirmBrewery(breweryName, exists);
      }
    });

    // Auto-save per form
    document.querySelectorAll('.manual-data-form input, .manual-data-form textarea').forEach(input => {
      input.addEventListener('blur', () => this.autoSaveFormData(input.closest('form')));
    });

    // Validazione real-time
    document.querySelectorAll('.form-control.required').forEach(input => {
      input.addEventListener('input', () => this.validateField(input));
    });
  }

  /**
   * Conferma e salva tutti i dati verificati
   */
  async confirmSaveAll() {
    try {
      this.showLoading('Salvataggio in corso...');

      const result = await this.submitConfirmation({
        confirmVerified: true,
        userCompletions: [],
        sessionData: this.sessionData
      });

      if (result.success) {
        this.showSuccess(result.message);
        
        setTimeout(() => {
          if (result.redirect) {
            window.location.href = result.redirect;
          } else {
            window.location.reload();
          }
        }, 2000);
      } else {
        this.showError(result.message || 'Errore durante il salvataggio');
      }
    } catch (error) {
      console.error('Errore conferma salvataggio:', error);
      this.showError('Si è verificato un errore tecnico. Riprova.');
    } finally {
      this.hideLoading();
    }
  }

  /**
   * Salva solo i dati già verificati
   */
  async saveVerifiedOnly() {
    try {
      this.showLoading('Salvataggio dati verificati...');

      const result = await this.submitConfirmation({
        confirmVerified: true,
        userCompletions: this.userCompletions,
        sessionData: this.sessionData
      });

      if (result.success) {
        this.showSuccess(result.message);
        
        // Se ci sono ancora dati non verificati, mostra opzioni
        if (this.validationData.unverifiedData?.breweries?.length > 0 || 
            this.validationData.unverifiedData?.beers?.length > 0) {
          this.showPartialSaveOptions();
        } else {
          setTimeout(() => {
            window.location.href = result.redirect || '/profile';
          }, 2000);
        }
      } else {
        this.showError(result.message);
      }
    } catch (error) {
      console.error('Errore salvataggio verificati:', error);
      this.showError('Errore nel salvataggio. Riprova.');
    } finally {
      this.hideLoading();
    }
  }

  /**
   * Mostra modalità completamento completo
   */
  showCompleteAllMode() {
    // Espandi tutti i form di completamento
    document.querySelectorAll('.completion-card').forEach(card => {
      card.classList.add('expanded');
      card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });

    // Focus sul primo campo richiesto
    const firstRequired = document.querySelector('.form-control.required');
    if (firstRequired) {
      firstRequired.focus();
    }

    this.showInfo('Completa tutti i campi obbligatori (contrassegnati con *) per procedere.');
  }

  /**
   * Salva dati completati manualmente
   */
  async saveManualData(form) {
    try {
      const formData = new FormData(form);
      const data = Object.fromEntries(formData.entries());
      
      // Validazione lato client
      const validation = this.validateFormData(form, data);
      if (!validation.isValid) {
        this.showValidationErrors(form, validation.errors);
        return;
      }

      this.showLoading('Salvataggio dati...');

      // Aggiungi ai completamenti utente
      const completion = {
        id: form.getAttribute('data-id'),
        type: form.getAttribute('data-type'),
        action: 'complete',
        originalData: this.getOriginalDataForId(form.getAttribute('data-id')),
        userData: data
      };

      this.userCompletions.push(completion);

      // Salva in sessione
      this.saveToSession();

      // Mostra successo locale
      this.showFormSuccess(form, 'Dati salvati! ✅');

      // Verifica se tutti i form sono completati
      if (this.areAllFormsComplete()) {
        this.enableFinalSave();
      }

    } catch (error) {
      console.error('Errore salvataggio manuale:', error);
      this.showFormError(form, 'Errore nel salvataggio: ' + error.message);
    } finally {
      this.hideLoading();
    }
  }

  /**
   * Cerca suggerimenti per completamento automatico
   */
  async searchSuggestions(form) {
    try {
      const formData = new FormData(form);
      const breweryName = formData.get('breweryName');
      const beerName = formData.get('beerName');

      if (!breweryName && !beerName) {
        this.showFormError(form, 'Inserisci almeno il nome del birrificio o della birra per cercare suggerimenti.');
        return;
      }

      this.showLoading('Ricerca suggerimenti...');

      const params = new URLSearchParams({
        searchType: beerName ? 'beer' : 'brewery',
        breweryName: breweryName || '',
        beerName: beerName || ''
      });

      const response = await fetch(`/review/api/suggestions?${params}`);
      const result = await response.json();

      if (result.success && result.suggestions.length > 0) {
        this.showSuggestionsModal(result.suggestions, form);
      } else {
        this.showInfo('Nessun suggerimento trovato. Completa manualmente i dati.');
      }
    } catch (error) {
      console.error('Errore ricerca suggerimenti:', error);
      this.showError('Errore nella ricerca. Riprova.');
    } finally {
      this.hideLoading();
    }
  }

  /**
   * Conferma esistenza birrificio
   */
  confirmBrewery(breweryName, exists) {
    console.log(`Conferma birrificio "${breweryName}": ${exists}`);

    const completion = {
      id: breweryName,
      type: 'brewery',
      action: exists ? 'verify' : 'skip',
      originalData: { labelName: breweryName },
      userData: exists ? { breweryName: breweryName } : {}
    };

    this.userCompletions.push(completion);
    this.saveToSession();

    // Aggiorna UI
    const actionItem = document.querySelector(`[data-brewery="${breweryName}"]`);
    if (actionItem) {
      if (exists) {
        actionItem.classList.add('confirmed');
        this.showElementSuccess(actionItem, 'Birrificio confermato ✅');
      } else {
        actionItem.classList.add('skipped');
        this.showElementWarning(actionItem, 'Birrificio saltato ⏭️');
      }
    }
  }

  /**
   * Validazione form in tempo reale
   */
  validateField(input) {
    const value = input.value.trim();
    const isRequired = input.classList.contains('required');
    
    // Rimuovi messaggi di errore precedenti
    this.clearFieldError(input);

    if (isRequired && !value) {
      this.showFieldError(input, 'Campo obbligatorio');
      return false;
    }

    // Validazioni specifiche
    if (input.type === 'email' && value) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(value)) {
        this.showFieldError(input, 'Email non valida');
        return false;
      }
    }

    if (input.type === 'url' && value) {
      try {
        new URL(value);
      } catch {
        this.showFieldError(input, 'URL non valido');
        return false;
      }
    }

    // Mostra successo se valido
    this.showFieldSuccess(input);
    return true;
  }

  /**
   * Sottomissione conferma al server
   */
  async submitConfirmation(data) {
    try {
      const response = await fetch('/review/confirm-ai-analysis', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Errore sottomissione:', error);
      throw new Error('Errore di comunicazione con il server');
    }
  }

  /**
   * Gestione UI feedback
   */
  showLoading(message = 'Elaborazione...') {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
      overlay.querySelector('p').textContent = message;
      overlay.style.display = 'flex';
    }
  }

  hideLoading() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
      overlay.style.display = 'none';
    }
  }

  showSuccess(message) {
    this.showNotification(message, 'success');
  }

  showError(message) {
    this.showNotification(message, 'error');
  }

  showInfo(message) {
    this.showNotification(message, 'info');
  }

  showNotification(message, type = 'info') {
    // Crea notifica moderna
    const notification = document.createElement('div');
    notification.className = `notification notification-${type} slide-up`;
    notification.innerHTML = `
      <div class="notification-content">
        <i class="fas fa-${this.getIconForType(type)}"></i>
        <span>${message}</span>
        <button class="notification-close">&times;</button>
      </div>
    `;

    // Stili inline per posizionamento
    Object.assign(notification.style, {
      position: 'fixed',
      top: '20px',
      right: '20px',
      zIndex: '10000',
      maxWidth: '400px',
      padding: '15px 20px',
      borderRadius: '8px',
      color: 'white',
      fontWeight: '600',
      boxShadow: '0 4px 15px rgba(0,0,0,0.2)',
      background: type === 'success' ? 'linear-gradient(135deg, #28a745, #20c997)' :
                 type === 'error' ? 'linear-gradient(135deg, #dc3545, #c82333)' :
                 'linear-gradient(135deg, #17a2b8, #138496)'
    });

    document.body.appendChild(notification);

    // Rimozione automatica
    const closeBtn = notification.querySelector('.notification-close');
    closeBtn.addEventListener('click', () => notification.remove());

    setTimeout(() => {
      if (notification.parentNode) {
        notification.remove();
      }
    }, 5000);
  }

  getIconForType(type) {
    switch (type) {
      case 'success': return 'check-circle';
      case 'error': return 'exclamation-circle';
      case 'info': return 'info-circle';
      default: return 'bell';
    }
  }

  showFieldError(input, message) {
    input.classList.add('is-invalid');
    
    let errorDiv = input.parentNode.querySelector('.field-error');
    if (!errorDiv) {
      errorDiv = document.createElement('div');
      errorDiv.className = 'field-error';
      errorDiv.style.cssText = 'color: #dc3545; font-size: 0.8rem; margin-top: 5px;';
      input.parentNode.appendChild(errorDiv);
    }
    
    errorDiv.textContent = message;
  }

  clearFieldError(input) {
    input.classList.remove('is-invalid');
    const errorDiv = input.parentNode.querySelector('.field-error');
    if (errorDiv) {
      errorDiv.remove();
    }
  }

  showFieldSuccess(input) {
    input.classList.remove('is-invalid');
    input.classList.add('is-valid');
    this.clearFieldError(input);
  }

  /**
   * Utility functions
   */
  extractClickParams(onclickAttr) {
    // Estrae parametri da attributi onclick
    const matches = onclickAttr.match(/\('([^']+)',\s*(true|false)\)/);
    return matches ? [matches[1], matches[2] === 'true'] : [null, false];
  }

  validateFormData(form, data) {
    const errors = [];
    const requiredFields = form.querySelectorAll('.required');
    
    requiredFields.forEach(field => {
      const name = field.name;
      const value = data[name];
      
      if (!value || value.trim() === '') {
        errors.push({
          field: name,
          message: 'Campo obbligatorio'
        });
      }
    });

    return {
      isValid: errors.length === 0,
      errors: errors
    };
  }

  getOriginalDataForId(id) {
    // Trova i dati originali per l'ID specificato
    const brewery = this.validationData.unverifiedData?.breweries?.find(b => 
      b.originalData?.labelName === id
    );
    
    return brewery?.originalData || { labelName: id };
  }

  areAllFormsComplete() {
    const forms = document.querySelectorAll('.manual-data-form');
    return Array.from(forms).every(form => {
      const requiredFields = form.querySelectorAll('.required');
      return Array.from(requiredFields).every(field => 
        field.value.trim() !== ''
      );
    });
  }

  enableFinalSave() {
    // Abilita pulsante salvataggio finale
    const finalSaveBtn = document.getElementById('finalSaveBtn') || this.createFinalSaveButton();
    finalSaveBtn.disabled = false;
    finalSaveBtn.classList.add('pulse');
  }

  createFinalSaveButton() {
    const button = document.createElement('button');
    button.id = 'finalSaveBtn';
    button.className = 'btn btn-success btn-lg';
    button.innerHTML = '<i class="fas fa-save"></i> Salva Tutto';
    button.addEventListener('click', () => this.saveFinalData());
    
    const actionButtons = document.querySelector('.action-buttons');
    if (actionButtons) {
      actionButtons.appendChild(button);
    }
    
    return button;
  }

  async saveFinalData() {
    try {
      this.showLoading('Salvataggio finale...');

      const result = await this.submitConfirmation({
        confirmVerified: false,
        userCompletions: this.userCompletions,
        sessionData: this.sessionData
      });

      if (result.success) {
        this.showSuccess(result.message);
        setTimeout(() => {
          window.location.href = result.redirect || '/profile';
        }, 2000);
      } else {
        this.showError(result.message);
      }
    } catch (error) {
      this.showError('Errore nel salvataggio finale: ' + error.message);
    } finally {
      this.hideLoading();
    }
  }

  saveToSession() {
    // Salva dati in sessionStorage
    try {
      sessionStorage.setItem('aiVerificationCompletions', JSON.stringify(this.userCompletions));
    } catch (error) {
      console.warn('Impossibile salvare in sessionStorage:', error);
    }
  }

  loadSavedData() {
    // Carica dati salvati
    try {
      const saved = sessionStorage.getItem('aiVerificationCompletions');
      if (saved) {
        this.userCompletions = JSON.parse(saved);
      }
    } catch (error) {
      console.warn('Impossibile caricare da sessionStorage:', error);
    }
  }

  showLoadingIfNeeded() {
    // Mostra loading se ci sono operazioni in corso
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('loading') === 'true') {
      this.showLoading('Elaborazione in corso...');
    }
  }
}

// Global functions per onclick events
window.confirmBrewery = function(breweryName, exists) {
  if (window.aiVerificationManager) {
    window.aiVerificationManager.confirmBrewery(breweryName, exists);
  }
};

window.showManualForm = function(breweryName) {
  const form = document.querySelector(`form[data-id="${breweryName}"]`);
  if (form) {
    form.scrollIntoView({ behavior: 'smooth', block: 'center' });
    form.querySelector('input').focus();
  }
};

window.saveManualData = function(button) {
  if (window.aiVerificationManager) {
    const form = button.closest('form');
    window.aiVerificationManager.saveManualData(form);
  }
};

window.searchSuggestions = function(button) {
  if (window.aiVerificationManager) {
    const form = button.closest('form');
    window.aiVerificationManager.searchSuggestions(form);
  }
};

window.contactSupport = function() {
  alert('Per assistenza, contatta il supporto tecnico all\'indirizzo: support@sharingbeer.it');
};

// Inizializzazione al caricamento pagina
document.addEventListener('DOMContentLoaded', function() {
  console.log('🚀 Inizializzazione AI Verification Interface');
  window.aiVerificationManager = new AIVerificationManager();
});