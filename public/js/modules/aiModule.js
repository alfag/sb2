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

      if (!response.ok) {
        throw new Error(result.message || 'Errore durante l\'analisi');
      }

      this.currentAnalysisData = result.data;
      this.showAnalysisResults(result.data);

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
