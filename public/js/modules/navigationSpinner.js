/**
 * 🔄 Navigation Spinner Module
 * Mostra uno spinner durante la navigazione tra pagine per feedback visivo all'utente.
 * 
 * Funzionalità:
 * - Intercetta click su link interni
 * - Intercetta submit di form
 * - Mostra spinner con delay minimo per evitare flash
 * - Si nasconde automaticamente al caricamento della nuova pagina
 * - Esclude link esterni, anchor, target blank, javascript:void
 * 
 * @author SharingBeer2.0 Team
 * @version 1.0.0
 * @date 2025-01-09
 */

(function() {
    'use strict';

    // ========================================
    // CONFIGURAZIONE
    // ========================================
    const CONFIG = {
        // ID dell'overlay spinner
        overlayId: 'nav-loading-overlay',
        // Classe per mostrare lo spinner
        showClass: 'show',
        // Delay minimo prima di mostrare (evita flash per pagine veloci)
        showDelayMs: 50,  // Ridotto per mostrare subito
        // Timeout massimo - nasconde lo spinner se la pagina non carica
        maxTimeoutMs: 15000,
        // Selettori da escludere
        excludeSelectors: [
            '[data-no-spinner]',           // Opt-out esplicito
            '[target="_blank"]',           // Link nuova tab
            '[download]',                  // Link download
            '.no-nav-spinner',             // Classe opt-out
            '[href^="#"]',                 // Anchor links
            '[href^="javascript:"]',       // JavaScript links
            '[href^="mailto:"]',           // Email links
            '[href^="tel:"]',              // Telefono links
            '[data-bs-toggle]',            // Bootstrap toggles
            '[data-toggle]',               // Toggle generici
            '.dropdown-toggle',            // Dropdown
            '.modal-trigger',              // Modal triggers
            'button[type="button"]',       // Pulsanti non-submit
        ]
    };

    // ========================================
    // STATE
    // ========================================
    let overlay = null;
    let showTimeout = null;
    let maxTimeout = null;
    let isShowing = false;

    // ========================================
    // UTILITY FUNCTIONS
    // ========================================

    /**
     * Verifica se un link è interno (stessa origine)
     */
    function isInternalLink(href) {
        if (!href) return false;
        
        try {
            const url = new URL(href, window.location.origin);
            return url.origin === window.location.origin;
        } catch (e) {
            // Href relativo o malformato - consideralo interno
            return !href.startsWith('http://') && !href.startsWith('https://');
        }
    }

    /**
     * Verifica se un elemento deve essere escluso dallo spinner
     */
    function shouldExclude(element) {
        // Verifica tutti i selettori di esclusione
        for (const selector of CONFIG.excludeSelectors) {
            if (element.matches(selector)) {
                return true;
            }
        }
        
        // Verifica anche i parent (per click su elementi interni ai link)
        const link = element.closest('a');
        if (link) {
            for (const selector of CONFIG.excludeSelectors) {
                if (link.matches(selector)) {
                    return true;
                }
            }
        }
        
        return false;
    }

    /**
     * Verifica se il form è AJAX (non deve navigare)
     */
    function isAjaxForm(form) {
        // Form con classe specifica o data attribute
        return form.classList.contains('ajax-form') || 
               form.hasAttribute('data-ajax') ||
               form.hasAttribute('data-no-spinner');
    }

    // ========================================
    // SPINNER CONTROL
    // ========================================

    /**
     * Mostra lo spinner di navigazione
     */
    function showSpinner() {
        console.log('🔄 [NavigationSpinner] showSpinner() chiamata', { isShowing, overlay: !!overlay });
        if (isShowing || !overlay) {
            console.log('🔄 [NavigationSpinner] Skip showSpinner:', isShowing ? 'già visibile' : 'overlay non trovato');
            return;
        }
        
        // Cancella timeout esistenti
        clearTimeouts();
        
        // MOSTRA SUBITO - senza delay
        overlay.classList.add(CONFIG.showClass);
        overlay.setAttribute('aria-hidden', 'false');
        isShowing = true;
        
        console.log('🔄 [NavigationSpinner] ✅ Spinner mostrato IMMEDIATAMENTE');
        
        // Safety timeout - nasconde dopo tempo massimo
        maxTimeout = setTimeout(() => {
            console.warn('⚠️ [NavigationSpinner] Timeout raggiunto, nascondo spinner');
            hideSpinner();
        }, CONFIG.maxTimeoutMs);
    }

    /**
     * Nasconde lo spinner di navigazione
     */
    function hideSpinner() {
        clearTimeouts();
        
        if (overlay) {
            overlay.classList.remove(CONFIG.showClass);
            overlay.setAttribute('aria-hidden', 'true');
        }
        
        if (isShowing) {
            console.log('🔄 [NavigationSpinner] Spinner nascosto');
        }
        
        isShowing = false;
    }

    /**
     * Cancella tutti i timeout attivi
     */
    function clearTimeouts() {
        if (showTimeout) {
            clearTimeout(showTimeout);
            showTimeout = null;
        }
        if (maxTimeout) {
            clearTimeout(maxTimeout);
            maxTimeout = null;
        }
    }

    // ========================================
    // EVENT HANDLERS
    // ========================================

    /**
     * Handler per click sui link
     */
    function handleLinkClick(event) {
        const link = event.target.closest('a');
        if (!link) return;
        
        const href = link.getAttribute('href');
        
        // Skip se non è un link valido
        if (!href || href === '#' || href === '') {
            console.log('🔄 [NavigationSpinner] Skip: link vuoto o #');
            return;
        }
        
        // Skip se deve essere escluso
        if (shouldExclude(link)) {
            console.log('🔄 [NavigationSpinner] Skip: link escluso', href);
            return;
        }
        
        // Skip se è un link esterno
        if (!isInternalLink(href)) {
            console.log('🔄 [NavigationSpinner] Skip: link esterno', href);
            return;
        }
        
        // Skip se è un anchor sulla stessa pagina
        if (href.startsWith('#')) {
            console.log('🔄 [NavigationSpinner] Skip: anchor', href);
            return;
        }
        
        // Skip se ha modificatori (Ctrl, Cmd, etc. per aprire in nuova tab)
        if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) {
            console.log('🔄 [NavigationSpinner] Skip: modificatori', href);
            return;
        }
        
        // Skip se è click destro
        if (event.button !== 0) {
            console.log('🔄 [NavigationSpinner] Skip: non click sinistro');
            return;
        }
        
        // Mostra lo spinner
        console.log('🔄 [NavigationSpinner] ✅ Click valido, mostro spinner per:', href);
        showSpinner();
    }

    /**
     * Handler per submit dei form
     */
    function handleFormSubmit(event) {
        const form = event.target;
        if (!form || form.tagName !== 'FORM') return;
        
        // Skip se è un form AJAX
        if (isAjaxForm(form)) return;
        
        // Skip se ha data-no-spinner
        if (form.hasAttribute('data-no-spinner')) return;
        
        // Mostra lo spinner
        console.log('🔄 [NavigationSpinner] Form submit rilevato:', form.action || 'stesso URL');
        showSpinner();
    }

    // ========================================
    // INITIALIZATION
    // ========================================

    /**
     * Inizializza il modulo
     */
    function init() {
        // Trova l'overlay
        overlay = document.getElementById(CONFIG.overlayId);
        
        if (!overlay) {
            console.warn('⚠️ [NavigationSpinner] Overlay non trovato:', CONFIG.overlayId);
            return;
        }
        
        // Event listeners
        document.addEventListener('click', handleLinkClick, true);
        document.addEventListener('submit', handleFormSubmit, true);
        
        // Nascondi spinner quando la pagina è completamente caricata
        window.addEventListener('load', hideSpinner);
        
        // Nascondi spinner se si torna con back/forward (bfcache)
        window.addEventListener('pageshow', function(event) {
            if (event.persisted) {
                hideSpinner();
            }
        });
        
        // Nascondi se si sta lasciando la pagina ma poi si annulla
        window.addEventListener('beforeunload', function() {
            // Non fare nulla qui - lo spinner è già mostrato
        });
        
        console.log('✅ [NavigationSpinner] Modulo inizializzato');
    }

    // ========================================
    // PUBLIC API
    // ========================================

    // Esponi API pubblica per uso programmatico
    window.NavigationSpinner = {
        show: showSpinner,
        hide: hideSpinner,
        isShowing: function() { return isShowing; }
    };

    // Inizializza quando DOM pronto
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
