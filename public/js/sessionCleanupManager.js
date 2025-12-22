/**
 * Session Cleanup Manager - Gestione intelligente pulizia cache
 * Centralizza tutte le logiche di pulizia sessione AI
 */
class SessionCleanupManager {
  constructor() {
    this.isReviewProcessActive = false;
    this.isDisambiguationActive = false;
    this.currentSessionId = null;
    this.cleanupReasons = {
      REVIEW_COMPLETED: 'review_completed',
      REVIEW_ERROR: 'review_error', 
      USER_NAVIGATION: 'user_navigation',
      ROLE_CHANGE: 'role_change',
      LOGOUT: 'logout',
      TIMEOUT: 'timeout',
      MANUAL: 'manual'
    };
  }

  /**
   * Inizializza il processo di recensione
   */
  startReviewProcess(sessionId) {
    this.isReviewProcessActive = true;
    this.currentSessionId = sessionId;
    console.log('[SessionCleanup] Processo recensione AVVIATO:', sessionId);
  }

  /**
   * Avvia fase di disambiguazione
   */
  startDisambiguation() {
    this.isDisambiguationActive = true;
    console.log('[SessionCleanup] Disambiguazione ATTIVA - pulizia automatica BLOCCATA');
  }

  /**
   * Termina fase di disambiguazione
   */
  endDisambiguation() {
    this.isDisambiguationActive = false;
    console.log('[SessionCleanup] Disambiguazione COMPLETATA - pulizia automatica riabilitata');
  }

  /**
   * Controlla se è sicuro pulire la cache
   */
  canCleanup(reason) {
    // Durante disambiguazione attiva, non pulire MAI (eccetto logout/role change)
    if (this.isDisambiguationActive) {
      const allowedDuringDisambiguation = [
        this.cleanupReasons.LOGOUT,
        this.cleanupReasons.ROLE_CHANGE,
        this.cleanupReasons.MANUAL
      ];
      
      if (!allowedDuringDisambiguation.includes(reason)) {
        console.log('[SessionCleanup] Pulizia BLOCCATA - disambiguazione attiva:', reason);
        return false;
      }
    }

    return true;
  }

  /**
   * Pulisce la sessione per un motivo specifico
   */
  async cleanupSession(reason, additionalData = {}) {
    if (!this.canCleanup(reason)) {
      return false;
    }

    try {
      console.log('[SessionCleanup] Avvio pulizia sessione:', {
        reason,
        sessionId: this.currentSessionId,
        isReviewActive: this.isReviewProcessActive,
        isDisambiguationActive: this.isDisambiguationActive,
        ...additionalData
      });

      const response = await fetch('/review/clear-session-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          reason,
          sessionId: this.currentSessionId,
          ...additionalData
        })
      });

      if (response.ok) {
        this._resetState();
        console.log('[SessionCleanup] Pulizia completata con successo:', reason);
        return true;
      } else {
        console.error('[SessionCleanup] Errore pulizia sessione:', response.status);
        return false;
      }

    } catch (error) {
      console.error('[SessionCleanup] Errore durante pulizia:', error);
      return false;
    }
  }

  /**
   * Reset stato interno
   */
  _resetState() {
    this.isReviewProcessActive = false;
    this.isDisambiguationActive = false; 
    this.currentSessionId = null;
  }

  /**
   * Pulizia per completamento recensione (successo)
   */
  async cleanupOnReviewComplete() {
    return this.cleanupSession(this.cleanupReasons.REVIEW_COMPLETED);
  }

  /**
   * Pulizia per errore recensione
   */
  async cleanupOnReviewError(error) {
    return this.cleanupSession(this.cleanupReasons.REVIEW_ERROR, { error: error.message });
  }

  /**
   * Pulizia per navigazione utente (abbandono)
   */
  async cleanupOnNavigation(targetUrl) {
    return this.cleanupSession(this.cleanupReasons.USER_NAVIGATION, { targetUrl });
  }

  /**
   * Pulizia per cambio ruolo
   */
  async cleanupOnRoleChange(oldRole, newRole) {
    return this.cleanupSession(this.cleanupReasons.ROLE_CHANGE, { 
      oldRole, 
      newRole 
    });
  }

  /**
   * Pulizia per logout
   */
  async cleanupOnLogout() {
    return this.cleanupSession(this.cleanupReasons.LOGOUT);
  }

  /**
   * Pulizia manuale (admin, debug)
   */
  async cleanupManual(adminReason) {
    return this.cleanupSession(this.cleanupReasons.MANUAL, { adminReason });
  }

  /**
   * Controlla se processo recensione è attivo
   */
  isProcessActive() {
    return this.isReviewProcessActive;
  }

  /**
   * Controlla se disambiguazione è attiva
   */
  isDisambiguationInProgress() {
    return this.isDisambiguationActive;
  }

  /**
   * Ottieni stato attuale
   */
  getStatus() {
    return {
      isReviewActive: this.isReviewProcessActive,
      isDisambiguationActive: this.isDisambiguationActive,
      sessionId: this.currentSessionId,
      canCleanup: this.canCleanup(this.cleanupReasons.MANUAL)
    };
  }
}

// Istanza globale
window.sessionCleanupManager = new SessionCleanupManager();

// Export per uso nei moduli
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SessionCleanupManager;
}

console.log('[SessionCleanup] SessionCleanupManager inizializzato');