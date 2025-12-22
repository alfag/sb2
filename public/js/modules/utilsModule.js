/**
 * Modulo per utilità generali
 * Gestisce notifiche, loading states, helpers vari
 */
class UtilsModule {
  constructor() {
    this.notifications = new Map();
    this.loadingStates = new Set();
    
    // Inizializza automaticamente quando il DOM è pronto
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.init());
    } else {
      this.init();
    }
  }

  /**
   * Inizializza il modulo utils
   */
  init() {
    this.createNotificationContainer();
    console.log('[UtilsModule] Modulo utils inizializzato');
  }

  /**
   * Crea container per notifiche
   */
  createNotificationContainer() {
    if (document.getElementById('notifications-container')) return;

    const container = document.createElement('div');
    container.id = 'notifications-container';
    container.className = 'notifications-container';
    document.body.appendChild(container);
  }

  /**
   * Mostra notifica
   */
  showNotification(message, type = 'info', duration = 5000) {
    console.log('[UtilsModule] Creazione notifica:', { message, type, duration });
    
    const id = this.generateId();
    const notification = this.createNotificationElement(message, type, id);
    
    const container = document.getElementById('notifications-container');
    if (!container) {
      console.error('[UtilsModule] Container notifiche non trovato!');
      this.createNotificationContainer();
      const newContainer = document.getElementById('notifications-container');
      if (!newContainer) {
        console.error('[UtilsModule] Impossibile creare container notifiche!');
        return;
      }
      newContainer.appendChild(notification);
    } else {
      container.appendChild(notification);
    }
    
    this.notifications.set(id, notification);
    console.log('[UtilsModule] Notifica aggiunta al DOM:', notification);

    // Auto-rimozione
    if (duration > 0) {
      setTimeout(() => {
        this.removeNotification(id);
      }, duration);
    }

    return id;
  }

  /**
   * Crea elemento notifica
   */
  createNotificationElement(message, type, id) {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.dataset.notificationId = id;
    
    // Icone per tipo
    const icons = {
      success: '✓',
      error: '✕',
      warning: '⚠',
      info: 'ℹ'
    };
    
    notification.innerHTML = `
      <div class="notification-icon">${icons[type] || 'ℹ'}</div>
      <div class="notification-content">
        <p class="notification-message">${message}</p>
      </div>
      <button class="notification-close" data-notification-id="${id}" aria-label="Chiudi">×</button>
    `;

    // Aggiungi event listener per il pulsante di chiusura
    const closeButton = notification.querySelector('.notification-close');
    closeButton.addEventListener('click', () => {
      this.removeNotification(id);
    });

    return notification;
  }

  /**
   * Rimuove notifica
   */
  removeNotification(id) {
    const notification = this.notifications.get(id);
    if (notification) {
      notification.classList.add('removing');
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
        this.notifications.delete(id);
      }, 300);
    }
  }

  /**
   * Mostra successo
   */
  showSuccess(message, duration = 5000) {
    return this.showNotification(message, 'success', duration);
  }

  /**
   * Mostra errore
   */
  showError(message, duration = 7000) {
    return this.showNotification(message, 'error', duration);
  }

  /**
   * Mostra warning
   */
  showWarning(message, duration = 6000) {
    return this.showNotification(message, 'warning', duration);
  }

  /**
   * Mostra info
   */
  showInfo(message, duration = 5000) {
    return this.showNotification(message, 'info', duration);
  }

  /**
   * Pulisce tutte le notifiche esistenti
   */
  clearNotifications() {
    const notifications = document.querySelectorAll('.notification, .dynamic-alert, .alert-warning, .alert-danger, .error-message, .simple-notification');
    notifications.forEach(notification => {
      if (notification.parentNode) {
        notification.remove();
      }
    });
    console.log('[UtilsModule] Tutte le notifiche sono state rimosse');
  }

  /**
   * Mostra loading overlay
   */
  showLoading(message = 'Caricamento...', target = null) {
    const id = this.generateId();
    const overlay = this.createLoadingOverlay(message, id);
    
    const container = target || document.body;
    container.appendChild(overlay);
    
    this.loadingStates.add(id);
    
    return id;
  }

  /**
   * Crea overlay loading
   */
  createLoadingOverlay(message, id) {
    const overlay = document.createElement('div');
    overlay.className = 'loading-overlay';
    overlay.dataset.loadingId = id;
    
    overlay.innerHTML = `
      <div class="loading-content">
        <div class="loading-spinner"></div>
        <div class="loading-message">${message}</div>
      </div>
    `;

    return overlay;
  }

  /**
   * Nascondi loading
   */
  hideLoading(id) {
    const overlay = document.querySelector(`[data-loading-id="${id}"]`);
    if (overlay) {
      overlay.classList.add('loading-fade-out');
      setTimeout(() => {
        if (overlay.parentNode) {
          overlay.parentNode.removeChild(overlay);
        }
        this.loadingStates.delete(id);
      }, 300);
    }
  }

  /**
   * Valida email
   */
  validateEmail(email) {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
  }

  /**
   * Formatta data
   */
  formatDate(date, options = {}) {
    const defaultOptions = {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    };

    const formatOptions = { ...defaultOptions, ...options };
    return new Intl.DateTimeFormat('it-IT', formatOptions).format(new Date(date));
  }

  /**
   * Debounce function
   */
  debounce(func, wait, immediate = false) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        timeout = null;
        if (!immediate) func(...args);
      };
      const callNow = immediate && !timeout;
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
      if (callNow) func(...args);
    };
  }

  /**
   * Throttle function
   */
  throttle(func, limit) {
    let inThrottle;
    return function(...args) {
      if (!inThrottle) {
        func.apply(this, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  }

  /**
   * Formatta dimensione file
   */
  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Copia testo negli appunti
   */
  async copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      this.showSuccess('Copiato negli appunti!', 2000);
      return true;
    } catch (err) {
      console.error('Errore copia:', err);
      this.showError('Impossibile copiare negli appunti');
      return false;
    }
  }

  /**
   * Scroll smooth verso elemento
   */
  scrollToElement(element, offset = 0) {
    const elementPosition = element.offsetTop - offset;
    window.scrollTo({
      top: elementPosition,
      behavior: 'smooth'
    });
  }

  /**
   * Verifica se elemento è visibile
   */
  isElementVisible(element) {
    const rect = element.getBoundingClientRect();
    return (
      rect.top >= 0 &&
      rect.left >= 0 &&
      rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
      rect.right <= (window.innerWidth || document.documentElement.clientWidth)
    );
  }

  /**
   * Storage locale con fallback
   */
  setStorage(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      console.warn('Storage non disponibile:', e);
      return false;
    }
  }

  /**
   * Recupera da storage locale
   */
  getStorage(key, defaultValue = null) {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch (e) {
      console.warn('Errore lettura storage:', e);
      return defaultValue;
    }
  }

  /**
   * Rimuove da storage locale
   */
  removeStorage(key) {
    try {
      localStorage.removeItem(key);
      return true;
    } catch (e) {
      console.warn('Errore rimozione storage:', e);
      return false;
    }
  }

  /**
   * Genera ID univoco
   */
  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  /**
   * Escape HTML
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Parse URL parameters
   */
  getUrlParams() {
    const params = new URLSearchParams(window.location.search);
    const result = {};
    for (const [key, value] of params.entries()) {
      result[key] = value;
    }
    return result;
  }

  /**
   * Format rating per display
   */
  formatRating(rating, maxRating = 5) {
    if (!rating || rating === 0) return '—';
    return `${'★'.repeat(rating)}${'☆'.repeat(maxRating - rating)} (${rating}/${maxRating})`;
  }

  /**
   * Verifica supporto feature
   */
  supportsFeature(feature) {
    switch (feature) {
      case 'clipboard':
        return navigator.clipboard && navigator.clipboard.writeText;
      case 'notifications':
        return 'Notification' in window;
      case 'geolocation':
        return 'geolocation' in navigator;
      case 'camera':
        return navigator.mediaDevices && navigator.mediaDevices.getUserMedia;
      default:
        return false;
    }
  }
}

// Export per uso globale
window.UtilsModule = UtilsModule;

// 🔥 Istanziazione automatica per uso immediato
window.utils = new UtilsModule();
