/**
 * 📱 Mobile Zoom Control Module
 * 
 * Previene e gestisce lo zoom automatico di iOS/Safari
 * quando l'utente interagisce con i campi di input.
 * 
 * Problema: iOS zoom automaticamente quando il font-size < 16px
 * Soluzione: Combinazione di CSS (font-size: 16px) e JS (reset viewport)
 * 
 * @author SharingBeer 2.0
 * @version 1.0.0
 */

const MobileZoomControl = {
  // Stato interno
  state: {
    initialized: false,
    isIOS: false,
    isMobile: false,
    activeInput: null,
    viewportMeta: null
  },

  /**
   * Inizializza il modulo
   */
  init() {
    if (this.state.initialized) {
      console.warn('[MobileZoomControl] Già inizializzato');
      return;
    }

    // Rileva dispositivo
    this.detectDevice();

    // Se non è mobile, non serve fare nulla
    if (!this.state.isMobile) {
      console.log('[MobileZoomControl] Non mobile, skip');
      return;
    }

    console.log('[MobileZoomControl] Inizializzazione per mobile...');

    // Trova meta viewport
    this.state.viewportMeta = document.querySelector('meta[name="viewport"]');

    // Bind eventi
    this.bindEvents();

    this.state.initialized = true;
    console.log('[MobileZoomControl] Inizializzato', {
      isIOS: this.state.isIOS,
      isMobile: this.state.isMobile
    });
  },

  /**
   * Rileva se siamo su mobile/iOS
   */
  detectDevice() {
    const ua = navigator.userAgent || navigator.vendor || window.opera;
    
    // Rileva iOS
    this.state.isIOS = /iPad|iPhone|iPod/.test(ua) && !window.MSStream;
    
    // Rileva mobile (include Android)
    this.state.isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua) ||
                          (navigator.maxTouchPoints > 0 && window.matchMedia('(max-width: 768px)').matches);
  },

  /**
   * Bind eventi ai campi input
   */
  bindEvents() {
    // Usa event delegation per performance
    document.addEventListener('focusin', this.handleFocusIn.bind(this), true);
    document.addEventListener('focusout', this.handleFocusOut.bind(this), true);
    
    // Gestisci anche submit form per reset
    document.addEventListener('submit', this.handleFormSubmit.bind(this), true);

    // Gestisci resize/orientation change
    window.addEventListener('orientationchange', this.handleOrientationChange.bind(this));
  },

  /**
   * Gestisce focus su input
   */
  handleFocusIn(event) {
    const target = event.target;
    
    // Verifica se è un campo input
    if (!this.isInputField(target)) {
      return;
    }

    this.state.activeInput = target;
    
    // Su iOS, forza viewport a non zoomare
    if (this.state.isIOS) {
      this.preventIOSZoom();
    }
  },

  /**
   * Gestisce blur da input
   */
  handleFocusOut(event) {
    const target = event.target;
    
    // Verifica se è un campo input
    if (!this.isInputField(target)) {
      return;
    }

    // Piccolo delay per permettere tap su altri elementi
    setTimeout(() => {
      // Se non c'è altro input attivo, reset zoom
      if (document.activeElement === document.body || 
          !this.isInputField(document.activeElement)) {
        this.resetZoom();
        this.state.activeInput = null;
      }
    }, 100);
  },

  /**
   * Gestisce submit form
   */
  handleFormSubmit() {
    // Reset zoom dopo submit
    this.resetZoom();
    this.state.activeInput = null;
  },

  /**
   * Gestisce cambio orientamento
   */
  handleOrientationChange() {
    // Reset zoom su orientamento cambio
    setTimeout(() => {
      this.resetZoom();
    }, 300);
  },

  /**
   * Verifica se elemento è un campo input
   */
  isInputField(element) {
    if (!element || !element.tagName) {
      return false;
    }

    const tagName = element.tagName.toLowerCase();
    const type = (element.type || '').toLowerCase();
    
    // Campi che causano zoom
    if (tagName === 'textarea' || tagName === 'select') {
      return true;
    }
    
    if (tagName === 'input') {
      // Tipi che mostrano tastiera/picker
      const inputTypes = [
        'text', 'email', 'password', 'number', 'tel', 'url',
        'search', 'date', 'time', 'datetime-local', 'month', 'week'
      ];
      return inputTypes.includes(type) || !type;
    }

    // Elementi con contenteditable
    if (element.isContentEditable) {
      return true;
    }

    return false;
  },

  /**
   * Previene zoom iOS impostando viewport
   */
  preventIOSZoom() {
    if (this.state.viewportMeta) {
      // Già impostato correttamente nel meta tag
      return;
    }
  },

  /**
   * Reset zoom al livello originale
   */
  resetZoom() {
    // Metodo 1: Scroll trick per iOS Safari
    if (this.state.isIOS) {
      // Forza reflow del viewport
      window.scrollTo(0, window.scrollY);
    }

    // Metodo 2: Per Android e altri browser
    // Visual viewport API se disponibile
    if (window.visualViewport) {
      const currentScale = window.visualViewport.scale;
      
      if (currentScale > 1.01) {
        // C'è zoom attivo, proviamo a resettarlo
        this.forceViewportReset();
      }
    }
  },

  /**
   * Forza reset viewport (ultimo resort)
   */
  forceViewportReset() {
    if (!this.state.viewportMeta) {
      return;
    }

    // Salva contenuto attuale
    const currentContent = this.state.viewportMeta.getAttribute('content');
    
    // Trick: modifica temporaneamente e ripristina
    // Questo forza il browser a ri-valutare il viewport
    this.state.viewportMeta.setAttribute('content', 
      'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=0');
    
    // Su alcuni browser serve questo trick aggiuntivo
    requestAnimationFrame(() => {
      // Già impostato correttamente, non serve fare altro
    });
  },

  /**
   * Utility: blur input attivo
   */
  blurActiveInput() {
    if (this.state.activeInput) {
      this.state.activeInput.blur();
    } else if (document.activeElement && this.isInputField(document.activeElement)) {
      document.activeElement.blur();
    }
  },

  /**
   * Distrugge il modulo
   */
  destroy() {
    document.removeEventListener('focusin', this.handleFocusIn, true);
    document.removeEventListener('focusout', this.handleFocusOut, true);
    document.removeEventListener('submit', this.handleFormSubmit, true);
    window.removeEventListener('orientationchange', this.handleOrientationChange);
    
    this.state.initialized = false;
    console.log('[MobileZoomControl] Distrutto');
  }
};

// Auto-init quando DOM è pronto
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => MobileZoomControl.init());
} else {
  MobileZoomControl.init();
}

// Export per uso globale
window.MobileZoomControl = MobileZoomControl;
