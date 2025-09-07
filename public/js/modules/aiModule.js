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

      const formData = new FormData();
      formData.append('image', file);

      const response = await fetch('/review/first-check-ai', {
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
      this.showAnalysisResults(result.data || result);

    } catch (error) {
      console.error('[AIModule] Errore analisi:', error);
      this.showError(`Errore durante l'analisi: ${error.message}`);
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
}

// Export per uso globale
window.AIModule = AIModule;
