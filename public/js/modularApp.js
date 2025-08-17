/**
 * Sistema Modulare SharingBeer2.0
 * Coordina e inizializza tutti i moduli dell'applicazione
 */
class ModularApp {
  constructor() {
    this.modules = new Map();
    this.initialized = false;
    this.config = {
      debug: false,
      features: {
        ai: true,
        reviews: true,
        notifications: true
      }
    };
  }

  /**
   * Inizializza l'applicazione modulare
   */
  async init() {
    if (this.initialized) {
      console.warn('[ModularApp] App già inizializzata');
      return;
    }

    console.log('[ModularApp] Inizializzazione app modulare...');

    try {
      // Inizializza moduli core
      await this.initializeCoreModules();
      
      // Inizializza moduli feature
      await this.initializeFeatureModules();
      
      // Setup comunicazione inter-moduli
      this.setupInterModuleCommunication();
      
      // Bind eventi globali
      this.bindGlobalEvents();

      this.initialized = true;
      console.log('[ModularApp] App modulare inizializzata con successo');
      
      // Notifica inizializzazione completa
      this.dispatchEvent('appInitialized');

    } catch (error) {
      console.error('[ModularApp] Errore inizializzazione:', error);
      throw error;
    }
  }

  /**
   * Inizializza moduli core
   */
  async initializeCoreModules() {
    console.log('[ModularApp] Inizializzazione moduli core...');

    // EventManager (già presente)
    if (window.eventManager) {
      this.registerModule('eventManager', window.eventManager);
    }

    // Utils Module
    if (window.UtilsModule) {
      const utils = new window.UtilsModule();
      await utils.init();
      this.registerModule('utils', utils);
      window.utils = utils; // Global access
    }
  }

  /**
   * Inizializza moduli feature
   */
  async initializeFeatureModules() {
    console.log('[ModularApp] Inizializzazione moduli feature...');

    // AI Module
    if (this.config.features.ai && window.AIModule) {
      const aiModule = new window.AIModule();
      await aiModule.init();
      this.registerModule('ai', aiModule);
    }

    // Review Module
    if (this.config.features.reviews && window.ReviewModule) {
      const reviewModule = new window.ReviewModule();
      await reviewModule.init();
      this.registerModule('reviews', reviewModule);
    }
  }

  /**
   * Registra un modulo
   */
  registerModule(name, module) {
    this.modules.set(name, module);
    console.log(`[ModularApp] Modulo registrato: ${name}`);
  }

  /**
   * Ottieni modulo per nome
   */
  getModule(name) {
    return this.modules.get(name);
  }

  /**
   * Setup comunicazione inter-moduli
   */
  setupInterModuleCommunication() {
    // Event bus per comunicazione moduli
    this.eventBus = new EventTarget();

    // Proxy eventi tra moduli
    this.setupEventProxies();
  }

  /**
   * Setup proxy eventi
   */
  setupEventProxies() {
    // AI -> Reviews communication
    window.addEventListener('aiAnalysisComplete', (event) => {
      this.eventBus.dispatchEvent(new CustomEvent('ai:analysisComplete', {
        detail: event.detail
      }));
    });

    // Reviews -> Utils communication for notifications
    this.eventBus.addEventListener('review:published', (event) => {
      const utils = this.getModule('utils');
      if (utils) {
        utils.showSuccess('Recensioni pubblicate con successo!');
      }
    });

    this.eventBus.addEventListener('review:error', (event) => {
      const utils = this.getModule('utils');
      if (utils) {
        utils.showError(event.detail.message);
      }
    });
  }

  /**
   * Bind eventi globali
   */
  bindGlobalEvents() {
    // Error handling globale
    window.addEventListener('error', (event) => {
      this.handleGlobalError(event.error);
    });

    // Promise rejection handling
    window.addEventListener('unhandledrejection', (event) => {
      this.handleGlobalError(event.reason);
    });

    // Resize handling
    window.addEventListener('resize', this.debounce(() => {
      this.dispatchEvent('windowResized');
    }, 250));

    // Network status
    window.addEventListener('online', () => {
      this.dispatchEvent('networkOnline');
      const utils = this.getModule('utils');
      if (utils) utils.showSuccess('Connessione ripristinata');
    });

    window.addEventListener('offline', () => {
      this.dispatchEvent('networkOffline');
      const utils = this.getModule('utils');
      if (utils) utils.showWarning('Connessione persa');
    });
  }

  /**
   * Gestisce errori globali
   */
  handleGlobalError(error) {
    console.error('[ModularApp] Errore globale:', error);
    
    const utils = this.getModule('utils');
    if (utils && !this.isNetworkError(error)) {
      utils.showError('Si è verificato un errore inaspettato');
    }

    // Log to server in production
    if (this.config.debug === false) {
      this.logErrorToServer(error);
    }
  }

  /**
   * Verifica se è un errore di rete
   */
  isNetworkError(error) {
    return error.name === 'NetworkError' || 
           error.message.includes('fetch') ||
           error.message.includes('network');
  }

  /**
   * Log errore al server
   */
  logErrorToServer(error) {
    try {
      fetch('/api/log-error', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: error.message,
          stack: error.stack,
          url: window.location.href,
          timestamp: new Date().toISOString()
        })
      }).catch(() => {
        // Ignore logging errors
      });
    } catch (e) {
      // Ignore logging errors
    }
  }

  /**
   * Dispatch evento custom
   */
  dispatchEvent(eventName, detail = null) {
    const event = new CustomEvent(eventName, { detail });
    this.eventBus.dispatchEvent(event);
    window.dispatchEvent(event);
  }

  /**
   * Listen eventi moduli
   */
  on(eventName, callback) {
    this.eventBus.addEventListener(eventName, callback);
  }

  /**
   * Remove listener eventi
   */
  off(eventName, callback) {
    this.eventBus.removeEventListener(eventName, callback);
  }

  /**
   * Ottieni stato applicazione
   */
  getState() {
    return {
      initialized: this.initialized,
      modules: Array.from(this.modules.keys()),
      config: this.config
    };
  }

  /**
   * Debounce utility
   */
  debounce(func, wait) {
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

  /**
   * Distruggi app (cleanup)
   */
  destroy() {
    // Cleanup moduli
    this.modules.forEach((module, name) => {
      if (module.destroy && typeof module.destroy === 'function') {
        module.destroy();
      }
    });

    this.modules.clear();
    this.initialized = false;
    
    console.log('[ModularApp] App distrutta');
  }
}

// Inizializzazione automatica quando DOM è pronto
document.addEventListener('DOMContentLoaded', async () => {
  try {
    // Crea istanza app globale
    window.modularApp = new ModularApp();
    
    // Inizializza app
    await window.modularApp.init();
    
    console.log('[ModularApp] Inizializzazione automatica completata');
  } catch (error) {
    console.error('[ModularApp] Errore inizializzazione automatica:', error);
  }
});

// Export per uso manuale
window.ModularApp = ModularApp;
