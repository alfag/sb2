/**
 * Modulo per la gestione delle operazioni AI
 * Gestisce upload immagini, analisi AI e preparazione dati
 */
class AIModule {
  constructor() {
    this.isProcessing = false;
    this.currentAnalysisData = null;
    this.maxFileSize = 10 * 1024 * 1024; // 10MB
    this.supportedFormats = ['image/jpeg', 'image/png', 'image/webp'];
  }

  /**
   * Inizializza il modulo AI
   */
  init() {
    this.bindEvents();
    this.setupFileUpload();
    console.log('[AIModule] Modulo AI inizializzato');
  }

  /**
   * Binding degli eventi AI
   */
  bindEvents() {
    // Event listener per bottone analisi
    const analyzeButton = document.getElementById('analyze-btn');
    if (analyzeButton) {
      window.eventManager.addListener(analyzeButton, 'click', 
        this.handleAnalyzeClick.bind(this), 'ai-analyze-btn');
    }

    // Event listener per retry
    const retryButton = document.getElementById('retry-analysis');
    if (retryButton) {
      window.eventManager.addListener(retryButton, 'click', 
        this.handleRetryClick.bind(this), 'ai-retry-btn');
    }
  }

  /**
   * Setup del file upload
   */
  setupFileUpload() {
    const fileInput = document.getElementById('photo-upload');
    if (fileInput) {
      window.eventManager.addListener(fileInput, 'change', 
        this.handleFileSelect.bind(this), 'ai-file-input');
    }

    // Drag & Drop
    const dropZone = document.getElementById('upload-area');
    if (dropZone) {
      window.eventManager.addListener(dropZone, 'dragover', 
        this.handleDragOver.bind(this), 'ai-drag-over');
      window.eventManager.addListener(dropZone, 'drop', 
        this.handleDrop.bind(this), 'ai-drop');
    }
  }

  /**
   * Gestisce selezione file
   */
  async handleFileSelect(event) {
    const file = event.target.files[0];
    if (file) {
      await this.processFile(file);
    }
  }

  /**
   * Gestisce drag over
   */
  handleDragOver(event) {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.classList.add('drag-over');
  }

  /**
   * Gestisce drop file
   */
  async handleDrop(event) {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.classList.remove('drag-over');

    const files = event.dataTransfer.files;
    if (files.length > 0) {
      await this.processFile(files[0]);
    }
  }

  /**
   * Processa file selezionato
   */
  async processFile(file) {
    if (!this.validateFile(file)) {
      return;
    }

    this.showFilePreview(file);
    this.enableAnalyzeButton();
  }

  /**
   * Valida file uploadato
   */
  validateFile(file) {
    // Verifica formato
    if (!this.supportedFormats.includes(file.type)) {
      this.showError('Formato file non supportato. Usa JPEG, PNG o WebP.');
      return false;
    }

    // Verifica dimensione
    if (file.size > this.maxFileSize) {
      this.showError('File troppo grande. Massimo 10MB.');
      return false;
    }

    return true;
  }

  /**
   * Mostra preview del file
   */
  showFilePreview(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const preview = document.getElementById('image-preview');
      if (preview) {
        preview.src = e.target.result;
        preview.style.display = 'block';
      }
    };
    reader.readAsDataURL(file);
  }

  /**
   * Abilita bottone analisi
   */
  enableAnalyzeButton() {
    const button = document.getElementById('analyze-btn');
    if (button) {
      button.disabled = false;
      button.textContent = 'Analizza Immagine';
    }
  }

  /**
   * Gestisce click analisi
   */
  async handleAnalyzeClick(event) {
    if (this.isProcessing) return;

    const fileInput = document.getElementById('photo-upload');
    const file = fileInput.files[0];

    if (!file) {
      this.showError('Seleziona un\'immagine prima di analizzare');
      return;
    }

    await this.performAnalysis(file);
  }

  /**
   * Esegue analisi AI
   */
  async performAnalysis(file) {
    try {
      this.setProcessingState(true);
      this.showLoadingState('Analisi in corso...');

      // Notifica inizio analisi al SessionCleanupManager
      if (window.sessionCleanupManager) {
        const sessionId = Date.now().toString();
        window.sessionCleanupManager.startReviewProcess(sessionId);
      }

      const formData = new FormData();
      formData.append('image', file);

      const response = await fetch('/review/api/gemini/firstcheck', {
        method: 'POST',
        body: formData
      });

      const result = await response.json();

      // Gestione rate limiting
      if (response.status === 429) {
        this.handleRateLimitExceeded(result);
        return;
      }

      if (!response.ok) {
        throw new Error(result.message || 'Errore durante l\'analisi');
      }

      // Gestione warning rate limit
      if (result.rateLimitWarning) {
        this.showRateLimitWarning(result.rateLimitWarning);
      }

      // Mostra info rate limiting rimanenti
      if (result.rateLimitInfo) {
        this.showRemainingRequests(result.rateLimitInfo);
      }

      this.currentAnalysisData = result.data || result;

      // 🔍 DEBUG: Log completo della risposta per debugging
      console.log('[AIModule] DEBUG - Risposta completa ricevuta:', result);
      console.log('[AIModule] DEBUG - Bottles ricevute:', result.bottles || result.data?.bottles);
      console.log('[AIModule] DEBUG - antiHallucinationActive:', result.antiHallucinationActive);
      console.log('[AIModule] DEBUG - needsVerification:', result.needsVerification);
      console.log('[AIModule] DEBUG - redirectUrl:', result.redirectUrl);
      console.log('[AIModule] DEBUG - Condizione anti-allucinazioni:', !!(result.antiHallucinationActive && result.needsVerification));

      // 🎯 USA IL METODO CENTRALIZZATO per gestire tutte le risposte AI
      const handleResult = AIModule.handleAIResponse(result, {
        closeModal: () => {
          // Non c'è modal da chiudere in aiModule, ma manteniamo l'interfaccia
          console.log('[AIModule] Modal close request (N/A)');
        },
        showWarningMessage: (message) => {
          this.showError(message);
        },
        hideLoadingOverlay: () => {
          this.hideLoadingState();
        }
      });

      // Se la risposta è stata gestita (redirect, errore, etc.), esci
      if (handleResult.handled) {
        console.log('[AIModule] Risposta gestita centralmente:', handleResult.action);
        return;
      }

      // Altrimenti continua con flusso normale
      console.log('[AIModule] Continuando con flusso normale:', handleResult.action);
      
      // CRITICO: Gestione disambiguazione con SessionCleanupManager
      const needsDisambiguation = result.data?.needsDisambiguation || result.needsDisambiguation;
      if (needsDisambiguation && window.sessionCleanupManager) {
        console.log('[AIModule] Disambiguazione richiesta - blocco pulizia automatica');
        window.sessionCleanupManager.startDisambiguation();
      }

      // Mostra i risultati normali
      this.showAnalysisResults(handleResult.data || result.data || result);

      // CRITICO: Gestione legacy per compatibilità (se esiste)
      if (typeof isAIAnalysisActive !== 'undefined') {
        if (!needsDisambiguation) {
          isAIAnalysisActive = false;
          console.log('[AIModule] Pulizia automatica sessione riabilitata (legacy) - nessuna disambiguazione necessaria');
        } else {
          console.log('[AIModule] Pulizia automatica sessione MANTENUTA DISABILITATA (legacy) per disambiguazione');
        }
      }

    } catch (error) {
      console.error('[AIModule] Errore analisi:', error);
      this.showError(`Errore durante l'analisi: ${error.message}`);
      
      // Notifica errore al SessionCleanupManager
      if (window.sessionCleanupManager) {
        window.sessionCleanupManager.cleanupOnReviewError(error);
      }
      
      // CRITICO: Riabilita pulizia automatica in caso di errore (legacy)
      if (typeof isAIAnalysisActive !== 'undefined') {
        isAIAnalysisActive = false;
        console.log('[AIModule] Pulizia automatica sessione riabilitata (legacy) dopo errore AI');
      }
    } finally {
      this.setProcessingState(false);
    }
  }

  /**
   * Mostra risultati analisi
   */
  showAnalysisResults(data) {
    if (!data.bottles || data.bottles.length === 0) {
      this.showError('Nessuna birra trovata nell\'immagine');
      return;
    }

    // Notifica altri moduli dei risultati
    window.dispatchEvent(new CustomEvent('aiAnalysisComplete', {
      detail: { data }
    }));

    this.hideLoadingState();
    console.log('[AIModule] Analisi completata:', data);
  }

  /**
   * 🎯 METODO CENTRALIZZATO: Gestione di tutte le risposte AI
   * Gestisce anti-allucinazioni, disambiguazione, web search e flussi normali
   */
  static handleAIResponse(data, options = {}) {
    console.log('[AIModule] 🎯 Gestione centralizzata risposta AI:', data);
    
    // 🌐 PRIORITÀ 0.5: Web Search Automatica (se dati incompleti e flag attivo)
    if (data.requiresWebSearch && data.brewery && window.WebSearchModule) {
      console.log('[AIModule] 🌐 Dati incompleti - avvio ricerca web automatica');
      
      // Avvia ricerca web automatica in background
      setTimeout(() => {
        AIModule.handleAutomaticWebSearch(data, options);
      }, 500);
      
      return { handled: true, action: 'web-search-initiated' };
    }
    
    // 🛡️ PRIORITÀ 1: Sistema Anti-Allucinazioni
    if (data.antiHallucinationActive && data.needsVerification) {
      console.log('[AIModule] 🛡️ Sistema anti-allucinazioni attivo - redirect a verifica');
      
      // Chiudi modal se fornito
      if (options.closeModal) {
        options.closeModal({ preserveSessionData: true });
      }
      
      // Mostra messaggio di avviso
      if (data.message && options.showWarningMessage) {
        options.showWarningMessage(data.message);
      }
      
      // Redirect alla pagina di verifica
      setTimeout(() => {
        window.location.href = data.redirectUrl + '?sessionId=' + encodeURIComponent(Date.now());
      }, 1500);
      
      return { handled: true, action: 'anti-hallucination-redirect' };
    }
    
    // 🔀 PRIORITÀ 2: Disambiguazione
    if (data.needsDisambiguation) {
      console.log('[AIModule] 🔀 Disambiguazione richiesta - redirect');
      
      // Chiudi modal mantenendo i dati
      if (options.closeModal) {
        options.closeModal({ preserveSessionData: true });
      }
      
      // Mostra messaggio di avviso
      if (data.message && options.showWarningMessage) {
        options.showWarningMessage(data.message);
      }
      
      // Redirect alla pagina di disambiguazione
      setTimeout(() => {
        window.location.href = data.redirectUrl || '/review';
      }, 1500);
      
      return { handled: true, action: 'disambiguation-redirect' };
    }
    
    // ❌ PRIORITÀ 3: Nessuna birra rilevata
    if (!data.success || data.errorType === 'NO_BEER_DETECTED') {
      console.log('[AIModule] ❌ Nessuna birra rilevata');
      
      // Nascondi loading overlay
      if (options.hideLoadingOverlay) {
        options.hideLoadingOverlay();
      }
      
      // Chiudi modal
      if (options.closeModal) {
        options.closeModal();
      }
      
      // Mostra warning con messaggio specifico
      const warningMessage = data.message || 'L\'AI non ha rilevato bottiglie di birra nell\'immagine. Carica un\'immagine contenente chiaramente prodotti birrari.';
      
      if (options.showWarningMessage) {
        setTimeout(() => {
          options.showWarningMessage(warningMessage);
        }, 100);
      }
      
      return { handled: true, action: 'no-beer-detected' };
    }
    
    // ✅ PRIORITÀ 4: Successo - Procedi con flusso normale
    if (data.success && data.bottles && data.bottles.length > 0) {
      console.log('[AIModule] ✅ Analisi riuscita - flusso normale', {
        bottlesCount: data.bottles.length,
        bottles: data.bottles
      });
      
      return { 
        handled: false, 
        action: 'success-continue',
        data: data 
      };
    }
    
    // ⚠️ Caso non gestito
    console.warn('[AIModule] ⚠️ Risposta AI non riconosciuta:', data);
    return { 
      handled: false, 
      action: 'unknown',
      data: data 
    };
  }

  /**
   * Gestisce retry analisi
   */
  async handleRetryClick(event) {
    this.resetState();
    const fileInput = document.getElementById('photo-upload');
    if (fileInput.files[0]) {
      await this.performAnalysis(fileInput.files[0]);
    }
  }

  /**
   * Imposta stato processing
   */
  setProcessingState(processing) {
    this.isProcessing = processing;
    const button = document.getElementById('analyze-btn');
    if (button) {
      button.disabled = processing;
    }
  }

  /**
   * Mostra stato loading
   */
  showLoadingState(message) {
    const status = document.getElementById('ai-status');
    if (status) {
      status.innerHTML = `<div class="loading">${message}</div>`;
      status.style.display = 'block';
    }
  }

  /**
   * Nasconde stato loading
   */
  hideLoadingState() {
    const status = document.getElementById('ai-status');
    if (status) {
      status.style.display = 'none';
    }
  }

  /**
   * Mostra errore
   */
  showError(message) {
    const status = document.getElementById('ai-status');
    if (status) {
      status.innerHTML = `<div class="error">${message}</div>`;
      status.style.display = 'block';
    }
    this.setProcessingState(false);
  }

  /**
   * Gestisce rate limit superato
   */
  handleRateLimitExceeded(result) {
    const message = result.message || 'Limite richieste superato';
    const suggestion = result.suggestion || '';
    const details = result.details || {};
    
    let html = `<div class="rate-limit-error">
      <h4><i class="fas fa-exclamation-triangle"></i> Limite Analisi Raggiunto</h4>
      <p><strong>${message}</strong></p>`;
    
    if (suggestion) {
      html += `<p class="suggestion">${suggestion}</p>`;
    }
    
    if (details.authUrl && !details.isUserAuthenticated) {
      html += `<div class="action-buttons">
        <a href="${details.authUrl}" class="btn btn-primary">
          <i class="fas fa-user-plus"></i> Registrati Ora
        </a>
      </div>`;
    }
    
    html += `<div class="limit-details">
      <small>
        <i class="fas fa-info-circle"></i> 
        ${details.requestCount || 0}/${details.maxRequests || 0} analisi utilizzate.
        ${details.resetInfo ? `Reset: ${details.resetInfo.resetMethod}` : ''}
      </small>
    </div></div>`;
    
    const status = document.getElementById('ai-status');
    if (status) {
      status.innerHTML = html;
      status.style.display = 'block';
    }
    
    this.setProcessingState(false);
    console.warn('[AIModule] Rate limit superato:', result);
  }

  /**
   * Gestisce errore di autenticazione richiesta
   */
  handleAuthenticationRequired(result) {
    const message = result.message || 'Autenticazione richiesta per utilizzare questa funzionalità';
    
    const html = `<div class="auth-required-error">
      <h4><i class="fas fa-lock"></i> Accesso Richiesto</h4>
      <p><strong>${message}</strong></p>
      <p>È necessario effettuare il login per utilizzare l'analisi AI delle birre.</p>
      <div class="action-buttons">
        <a href="/login" class="btn btn-primary">
          <i class="fas fa-sign-in-alt"></i> Accedi
        </a>
        <a href="/register" class="btn btn-secondary">
          <i class="fas fa-user-plus"></i> Registrati
        </a>
      </div>
    </div>`;
    
    const status = document.getElementById('ai-status');
    if (status) {
      status.innerHTML = html;
      status.style.display = 'block';
    }
    
    this.setProcessingState(false);
    console.warn('[AIModule] Autenticazione richiesta:', result);
  }

  /**
   * Mostra warning rate limit
   */
  showRateLimitWarning(warning) {
    const warningElement = document.getElementById('rate-limit-warning');
    if (!warningElement) {
      // Crea elemento warning se non esiste
      const container = document.getElementById('ai-status');
      if (container) {
        const warningDiv = document.createElement('div');
        warningDiv.id = 'rate-limit-warning';
        warningDiv.className = 'rate-limit-warning alert alert-warning mt-2';
        container.appendChild(warningDiv);
      }
    }
    
    const element = document.getElementById('rate-limit-warning');
    if (element) {
      let html = `<i class="fas fa-exclamation-triangle"></i> ${warning.message}`;
      
      if (warning.authUrl && warning.remainingRequests <= 1) {
        html += ` <a href="${warning.authUrl}" class="btn btn-sm btn-outline-primary ms-2">
          <i class="fas fa-user-plus"></i> Registrati
        </a>`;
      }
      
      element.innerHTML = html;
      element.style.display = 'block';
      
      // Auto-hide dopo 8 secondi
      setTimeout(() => {
        if (element) {
          element.style.display = 'none';
        }
      }, 8000);
    }
    
    console.info('[AIModule] Rate limit warning:', warning);
  }

  /**
   * Mostra richieste rimanenti
   */
  showRemainingRequests(rateLimitInfo) {
    const infoElement = document.getElementById('rate-limit-info') || 
                       this.createRateLimitInfoElement();
    
    if (infoElement) {
      const remaining = rateLimitInfo.remainingRequests;
      const max = rateLimitInfo.maxRequests;
      const isAuth = rateLimitInfo.isUserAuthenticated;
      
      let html = `<small class="text-muted">
        <i class="fas fa-chart-bar"></i> 
        ${remaining}/${max} analisi rimanenti`;
      
      if (!isAuth && remaining <= 3) {
        html += ` - <a href="/auth/register" class="text-primary">Registrati per averne di più</a>`;
      }
      
      html += `</small>`;
      
      infoElement.innerHTML = html;
      infoElement.style.display = 'block';
    }
  }

  /**
   * Crea elemento per info rate limiting
   */
  createRateLimitInfoElement() {
    const container = document.getElementById('ai-status');
    if (container) {
      const infoDiv = document.createElement('div');
      infoDiv.id = 'rate-limit-info';
      infoDiv.className = 'rate-limit-info mt-2';
      container.appendChild(infoDiv);
      return infoDiv;
    }
    return null;
  }

  /**
   * Reset dello stato
   */
  resetState() {
    this.isProcessing = false;
    this.currentAnalysisData = null;
    this.hideLoadingState();
  }

  /**
   * Ottieni dati analisi corrente
   */
  getCurrentAnalysis() {
    return this.currentAnalysisData;
  }

  /**
   * 🌐 Gestione ricerca web automatica quando AI restituisce dati incompleti
   */
  static async handleAutomaticWebSearch(aiData, options = {}) {
    console.log('[AIModule] 🌐 Avvio ricerca web automatica per:', aiData.brewery);
    
    // Mostra loading overlay
    if (window.WebSearchModule) {
      window.WebSearchModule.showSearchingOverlay('🔍 Ricerca informazioni sul web...');
    }
    
    try {
      // Estrai dati parziali dal risultato AI
      const partialBreweryData = {
        name: aiData.brewery?.name || aiData.brewery?.breweryName,
        location: aiData.brewery?.location || aiData.brewery?.breweryLegalAddress,
        website: aiData.brewery?.website || aiData.brewery?.breweryWebsite
      };
      
      console.log('[AIModule] 📡 Ricerca birrificio con dati:', partialBreweryData);
      
      // Chiama API web search
      const webSearchResult = await window.WebSearchModule.searchBrewery(partialBreweryData);
      
      // Nascondi loading
      window.WebSearchModule.hideSearchingOverlay();
      
      // Gestisci risultato
      if (webSearchResult.found && webSearchResult.confidence >= 0.5) {
        console.log('[AIModule] ✅ Birrificio trovato sul web:', webSearchResult);
        
        // Mostra UI conferma all'utente
        window.WebSearchModule.showConfirmationUI(
          webSearchResult,
          // onConfirm - Utente conferma i dati
          (confirmedResult) => {
            console.log('[AIModule] ✅ Utente ha confermato:', confirmedResult);
            AIModule.saveReviewWithWebData(aiData, confirmedResult, options);
          },
          // onReject - Utente rifiuta, cerca alternative
          (rejectedResult) => {
            console.log('[AIModule] ❌ Utente ha rifiutato, cerca alternative');
            AIModule.searchAlternativeBreweries(partialBreweryData.name);
          },
          // onManual - Fallback input manuale
          () => {
            console.log('[AIModule] ✏️ Utente sceglie input manuale');
            // Chiudi modal e torna al flusso normale (o mostra form)
            if (options.closeModal) {
              options.closeModal();
            }
          }
        );
        
      } else {
        // Non trovato o confidence bassa
        console.warn('[AIModule] ⚠️ Birrificio non trovato o confidence bassa');
        
        // Fallback: continua con sistema anti-allucinazioni esistente
        if (aiData.antiHallucinationActive && aiData.needsVerification) {
          // Redirect a verifica manuale
          setTimeout(() => {
            window.location.href = aiData.redirectUrl + '?sessionId=' + encodeURIComponent(Date.now());
          }, 1500);
        } else {
          // Mostra messaggio e chiudi modal
          if (options.showWarningMessage) {
            options.showWarningMessage('Birrificio non trovato automaticamente. Verifica i dati manualmente.');
          }
          if (options.closeModal) {
            options.closeModal();
          }
        }
      }
      
    } catch (error) {
      console.error('[AIModule] ❌ Errore ricerca web:', error);
      
      // Nascondi loading
      if (window.WebSearchModule) {
        window.WebSearchModule.hideSearchingOverlay();
      }
      
      // Fallback al flusso normale
      if (options.showWarningMessage) {
        options.showWarningMessage('Errore durante la ricerca automatica. Riprova.');
      }
      if (options.closeModal) {
        options.closeModal();
      }
    }
  }

  /**
   * Salva recensione con dati web confermati dall'utente
   */
  static async saveReviewWithWebData(aiData, webSearchResult, options = {}) {
    console.log('[AIModule] 💾 Salvataggio recensione con dati web:', webSearchResult);
    
    try {
      // Combina dati AI + dati web confermati
      const combinedData = {
        ...aiData,
        brewery: {
          ...aiData.brewery,
          ...webSearchResult.brewery,
          source: 'WEB_SEARCH_CONFIRMED',
          confidence: webSearchResult.confidence
        }
      };
      
      // Chiama endpoint di creazione recensione
      const response = await fetch('/review/create-multiple', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(combinedData)
      });
      
      const result = await response.json();
      
      if (result.success) {
        console.log('[AIModule] ✅ Recensione salvata con successo!');
        
        // Mostra messaggio successo
        if (options.showSuccessMessage) {
          options.showSuccessMessage('Recensione pubblicata con successo!');
        }
        
        // Redirect alla pagina recensioni
        setTimeout(() => {
          window.location.href = '/review/my-reviews';
        }, 2000);
        
      } else {
        console.error('[AIModule] ❌ Errore salvataggio:', result.error);
        if (options.showWarningMessage) {
          options.showWarningMessage('Errore durante il salvataggio. Riprova.');
        }
      }
      
    } catch (error) {
      console.error('[AIModule] ❌ Errore salvataggio recensione:', error);
      if (options.showWarningMessage) {
        options.showWarningMessage('Errore di connessione. Riprova.');
      }
    }
  }

  /**
   * Cerca birrifici alternativi nel database
   */
  static async searchAlternativeBreweries(breweryName) {
    console.log('[AIModule] 🔄 Ricerca birrifici alternativi per:', breweryName);
    
    try {
      const response = await fetch('/api/breweries/all');
      const allBreweries = await response.json();
      
      // Filtra birrifici che contengono il nome cercato
      const matches = allBreweries.filter(b => 
        b.breweryName.toLowerCase().includes(breweryName.toLowerCase())
      );
      
      if (matches.length > 0) {
        console.log('[AIModule] 📋 Trovati birrifici alternativi:', matches);
        // TODO: Mostra lista per selezione manuale
        // Per ora redirect a disambiguazione
        window.location.href = '/review';
      } else {
        console.warn('[AIModule] ⚠️ Nessuna alternativa trovata');
        window.location.href = '/review';
      }
      
    } catch (error) {
      console.error('[AIModule] ❌ Errore ricerca alternative:', error);
      window.location.href = '/review';
    }
  }
}

// Export per uso globale
window.AIModule = AIModule;