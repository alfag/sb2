// Variabili globali per l'immagine (accessibili da tutte le funzioni)
let croppedImageForAI = null;
let originalImageSrc = null;

// Variabili globali per gestione dati birre
let currentBeerData = null;
let validBeers = [];

// Variabile globale per controllo disambiguazione attiva
let isDisambiguationActive = false;

// Variabile globale per controllo analisi AI in corso
let isAIAnalysisActive = false;

// Logging per debug e monitoraggio
function logDebug(message, data = null) {
    if (data) {
        console.log(`[Photo Crop Debug] ${message}:`, data);
    } else {
        console.log(`[Photo Crop Debug] ${message}`);
    }
}

function logWarn(message, data = null) {
    if (data) {
        console.warn(`[Photo Crop Warning] ${message}:`, data);
    } else {
        console.warn(`[Photo Crop Warning] ${message}`);
    }
}

// Funzione per mostrare dialog di scelta sorgente foto su mobile
function showPhotoSourceDialog(reviewPhotoInput) {
  // Crea un dialog per scegliere la sorgente della foto su mobile
  const dialog = document.createElement('div');
  dialog.className = 'photo-source-dialog-overlay';
  dialog.innerHTML = `
    <div class="photo-source-dialog">
      <h3>📷 Come vuoi aggiungere la foto?</h3>
      <div class="photo-source-options">
        <button id="use-camera" class="photo-source-btn camera-btn">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 9a3 3 0 0 0-3 3 3 3 0 0 0 3 3 3 3 0 0 0 3-3 3 3 0 0 0-3-3m0 8a5 5 0 0 1-5-5 5 5 0 0 1 5-5 5 5 0 0 1 5 5 5 5 0 0 1-5 5m0-12.5C9 4.5 9 4.5 9 4.5l-3 1.5H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-2l-3-1.5S15 4.5 12 4.5z" fill="currentColor"/>
          </svg>
          Scatta Foto
        </button>
        <button id="use-gallery" class="photo-source-btn gallery-btn">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M8.5 13.5l2.5 3 3.5-4.5 4.5 6H5m16 1V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2z" fill="currentColor"/>
          </svg>
          Scegli da Galleria
        </button>
      </div>
      <button id="cancel-photo-source" class="photo-source-btn cancel-btn">Annulla</button>
    </div>
  `;
  
  // Aggiungi il CSS per il dialog se non esiste già
  if (!document.getElementById('photo-source-dialog-styles')) {
    const style = document.createElement('style');
    style.id = 'photo-source-dialog-styles';
    style.textContent = `
      .photo-source-dialog-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.6);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        backdrop-filter: blur(4px);
      }
      
      .photo-source-dialog {
        background: white;
        border-radius: 16px;
        padding: 24px;
        box-shadow: 0 20px 40px rgba(0,0,0,0.3);
        max-width: 320px;
        width: 90%;
        text-align: center;
        animation: slideInUp 0.3s ease;
      }
      
      @keyframes slideInUp {
        from { transform: translateY(20px); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
      }
      
      .photo-source-dialog h3 {
        margin: 0 0 20px 0;
        color: #333;
        font-size: 18px;
        font-weight: 600;
      }
      
      .photo-source-options {
        display: flex;
        flex-direction: column;
        gap: 12px;
        margin-bottom: 16px;
      }
      
      .photo-source-btn {
        border: none;
        padding: 16px 20px;
        border-radius: 12px;
        font-size: 16px;
        font-weight: 500;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 12px;
        transition: all 0.2s ease;
      }
      
      .camera-btn {
        background: linear-gradient(135deg, #10b981 0%, #059669 100%);
        color: white;
      }
      
      .camera-btn:hover, .camera-btn:active {
        transform: translateY(-2px);
        box-shadow: 0 8px 20px rgba(16, 185, 129, 0.3);
      }
      
      .gallery-btn {
        background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
        color: white;
      }
      
      .gallery-btn:hover, .gallery-btn:active {
        transform: translateY(-2px);
        box-shadow: 0 8px 20px rgba(59, 130, 246, 0.3);
      }
      
      .cancel-btn {
        background: #f1f5f9;
        color: #64748b;
        border: 1px solid #e2e8f0;
      }
      
      .cancel-btn:hover, .cancel-btn:active {
        background: #e2e8f0;
      }
      
      @media (max-width: 480px) {
        .photo-source-dialog {
          max-width: 280px;
          padding: 20px;
        }
        
        .photo-source-btn {
          padding: 14px 16px;
          font-size: 15px;
        }
      }
    `;
    document.head.appendChild(style);
  }
  
  document.body.appendChild(dialog);
  
  // Event listeners per i pulsanti
  document.getElementById('use-camera').addEventListener('click', () => {
    document.body.removeChild(dialog);
    openFileInputWithMode(reviewPhotoInput, true); // con fotocamera
  });
  
  document.getElementById('use-gallery').addEventListener('click', () => {
    document.body.removeChild(dialog);
    openFileInputWithMode(reviewPhotoInput, false); // senza fotocamera
  });
  
  document.getElementById('cancel-photo-source').addEventListener('click', () => {
    document.body.removeChild(dialog);
  });
  
  // Chiudi se si clicca fuori dal dialog
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) {
      document.body.removeChild(dialog);
    }
  });
}

function openFileInputWithMode(reviewPhotoInput, useCamera = false) {
  if (!reviewPhotoInput) {
    console.error('reviewPhotoInput non disponibile');
    return;
  }
  
  console.log('Apertura file input con modalità:', { useCamera });
  
  // Prepara il file input
  reviewPhotoInput.value = "";
  reviewPhotoInput.setAttribute('accept', 'image/*');
  
  if (useCamera) {
    reviewPhotoInput.setAttribute('capture', 'environment');
  } else {
    reviewPhotoInput.removeAttribute('capture');
  }
  
  console.log('Tentativo di aprire file picker...', { 
    capture: reviewPhotoInput.getAttribute('capture'),
    accept: reviewPhotoInput.getAttribute('accept')
  });
  
  try {
    reviewPhotoInput.click();
    console.log('File picker cliccato con successo');
    logDebug('File picker avviato', { useCamera });
  } catch (error) {
    console.error('Errore nell\'aprire file picker:', error);
    logError('Errore nell\'aprire file picker', error);
  }
}

function logError(message, error = null) {
    console.error(`[Photo Crop Error] ${message}`);
    if (error) console.error(error);
}

// Monitoraggio performance
function logPerformance(operation, startTime) {
    const duration = performance.now() - startTime;
    logDebug(`Performance ${operation}`, { duration: `${duration.toFixed(2)}ms` });
    
    if (duration > 1000) {
        logError(`Performance issue: ${operation} took ${duration.toFixed(2)}ms`);
    }
}

// Funzioni globali per gestione bottone recensione (spostate fuori da DOMContentLoaded)
function initializeReviewButton() {
    console.log('=== INIZIALIZZAZIONE BOTTONE RECENSIONE ===');
    console.log('Timestamp:', new Date().toISOString());
    console.log('URL corrente:', window.location.href);
    console.log('Document ready state:', document.readyState);
    
    // Verifica disponibilità EventManager
    if (typeof window.eventManager === 'undefined') {
        console.error('EventManager non disponibile! Fallback al metodo tradizionale');
        return initializeReviewButtonFallback();
    }
    
    // Verifica il DOM più accuratamente
    const startReviewBtn = document.getElementById('start-review-process');
    const reviewPhotoInput = document.getElementById('reviewPhoto');
    const photoModal = document.getElementById('photo-modal');
    
    console.log('Elementi DOM principali:', {
        startReviewBtn: !!startReviewBtn,
        reviewPhotoInput: !!reviewPhotoInput,
        photoModal: !!photoModal
    });
    
    // Se non ci sono gli elementi necessari, la pagina potrebbe non essere la welcome
    if (!startReviewBtn && !reviewPhotoInput) {
        console.log('Elementi recensione non trovati - probabile pagina diversa da welcome');
        logDebug('Elementi recensione non trovati (normale se non in pagina welcome)');
        return false;
    }
    
    if (startReviewBtn) {
        console.log('Bottone details:', {
            id: startReviewBtn.id,
            className: startReviewBtn.className,
            style: startReviewBtn.style.cssText,
            disabled: startReviewBtn.disabled,
            visible: startReviewBtn.offsetParent !== null,
            hasClickListener: startReviewBtn.onclick !== null,
            parentElement: startReviewBtn.parentElement?.tagName,
            computedDisplay: window.getComputedStyle(startReviewBtn).display
        });
        
        // Verifica se il bottone è veramente interagibile
        const rect = startReviewBtn.getBoundingClientRect();
        console.log('Bottone posizione e dimensioni:', {
            width: rect.width,
            height: rect.height,
            top: rect.top,
            left: rect.left,
            visible: rect.width > 0 && rect.height > 0
        });
        
        // Usa EventManager per gestire il listener in modo sicuro
        window.eventManager.addListener(
            startReviewBtn,
            'click',
            handleReviewButtonClick,
            'review-button-main'
        );
        
        console.log('Event listener collegato tramite EventManager con chiave "review-button-main"');
        logDebug('Event listener collegato al bottone principale recensione (EventManager)');
        
        // Test immediato del listener
        console.log('Test listener con evento simulato...');
        
        // Test asincrono per non interferire con l'inizializzazione
        setTimeout(() => {
            console.log('Verifica stato bottone dopo 2 secondi...');
            const currentButton = document.getElementById('start-review-process');
            if (currentButton) {
                console.log('Bottone ancora presente nel DOM:', {
                    id: currentButton.id,
                    visible: currentButton.offsetParent !== null,
                    listeners: 'managed by EventManager'
                });
            } else {
                console.error('PROBLEMA: Bottone scomparso dal DOM dopo inizializzazione!');
            }
        }, 2000);
        
        return true;
    } else {
        console.log('Bottone start-review-process NON trovato nel DOM');
        console.log('Tutti gli elementi nel body con ID:');
        document.querySelectorAll('[id]').forEach(el => {
            console.log(' - ID:', el.id, 'Tag:', el.tagName, 'Classes:', el.className);
        });
        logDebug('Bottone start-review-process non trovato nel DOM');
        return false;
    }
}

// Fallback per quando EventManager non è disponibile
function initializeReviewButtonFallback() {
    console.log('Utilizzo metodo fallback per inizializzazione bottone');
    
    const startReviewBtn = document.getElementById('start-review-process');
    if (startReviewBtn) {
        // Rimuovi TUTTI i possibili listener precedenti (più sicuro)
        const newButton = startReviewBtn.cloneNode(true);
        startReviewBtn.parentNode.replaceChild(newButton, startReviewBtn);
        console.log('Bottone completamente ricreato per evitare listener duplicati (fallback)');
        
        // Usa il nuovo bottone
        const freshButton = document.getElementById('start-review-process');
        if (freshButton) {
            freshButton.addEventListener('click', handleReviewButtonClick);
            console.log('Nuovo listener aggiunto al bottone ricreato (fallback)');
            return true;
        }
    }
    return false;
}

function handleReviewButtonClick(e) {
    console.log('=== CLICK INTERCETTATO ===');
    console.log('Timestamp:', new Date().toISOString());
    console.log('Event type:', e.type);
    console.log('Event target:', e.target.id, e.target.className);
    
    e.preventDefault();
    console.log('preventDefault() chiamato');
    
    console.log('=== BOTTONE PRINCIPALE CLICCATO ===');
    logDebug('Bottone principale "Pubblica una recensione" cliccato');
    
    // 🔧 FIX 8 Gennaio 2026:
    // Auth check DEVE avvenire PRIMA di aprire il file picker.
    // Uso XMLHttpRequest SINCRONO per mantenere la user gesture attiva.
    // Flusso: 1) Auth check sincrono  2) Se OK → file picker  3) GPS nel change handler
    
    const reviewPhotoInput = document.getElementById('reviewPhoto');
    
    if (!reviewPhotoInput) {
        console.error('reviewPhotoInput non trovato nel DOM');
        logError('Input reviewPhoto non trovato');
        alert('Errore: sistema di caricamento foto non disponibile');
        return;
    }
    
    // Reset flags auth
    window._authFailed = false;
    window._authFailedMessage = null;
    window._authCheckComplete = false;
    window._authUserData = null;
    
    // 🔒 STEP 1: VERIFICA AUTH CON XMLHttpRequest SINCRONO
    // Questo mantiene la user gesture attiva (no async/await/Promise)
    console.log('🔒 Verifica autenticazione (sincrona)...');
    
    let authPassed = false;
    let authErrorMessage = null;
    
    try {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', '/api/user/roles', false); // false = SINCRONO
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.send();
        
        if (xhr.status === 200) {
            const userData = JSON.parse(xhr.responseText);
            console.log('✅ Dati utente ricevuti:', userData);
            
            const hasCustomerRole = userData.roles && userData.roles.includes('customer');
            const isCustomerActive = userData.activeRole === 'customer';
            
            if (!hasCustomerRole) {
                console.log('❌ Utente non ha ruolo customer');
                authErrorMessage = 'Per creare recensioni è necessario il ruolo customer.';
            } else if (!isCustomerActive) {
                console.log('❌ Ruolo customer non attivo');
                authErrorMessage = 'Per creare recensioni devi selezionare il ruolo "Customer" dal menu in alto.';
            } else {
                console.log('✅ Auth check passato - ruolo customer attivo');
                authPassed = true;
                window._authUserData = userData;
            }
        } else if (xhr.status === 401 || xhr.status === 403) {
            console.log('❌ Utente non autenticato (status:', xhr.status, ')');
            sessionStorage.setItem('pendingAction', 'createReview');
            authErrorMessage = 'Per pubblicare una recensione devi prima effettuare il login.';
        } else {
            console.log('❌ Errore auth check (status:', xhr.status, ')');
            authErrorMessage = 'Errore nella verifica. Ricarica la pagina e riprova.';
        }
    } catch (error) {
        console.error('Errore verifica autenticazione:', error);
        authErrorMessage = 'Errore di connessione. Verifica la tua connessione e riprova.';
    }
    
    // Se auth fallita, mostra errore e NON aprire file picker
    if (!authPassed) {
        console.log('🚫 Auth fallita - file picker NON aperto');
        window._authFailed = true;
        window._authFailedMessage = authErrorMessage;
        window._authCheckComplete = true;
        
        // Mostra notifica errore
        if (window.utils && window.utils.showNotification) {
            window.utils.showNotification(authErrorMessage, 'warning', 5000);
        } else {
            alert(authErrorMessage);
        }
        
        // Se non autenticato, redirect al login dopo breve delay
        if (authErrorMessage.includes('login')) {
            setTimeout(() => {
                window.location.href = '/login';
            }, 1500);
        }
        
        return; // STOP - non aprire file picker
    }
    
    // ✅ Auth passata - procedi con apertura file picker
    window._authFailed = false;
    window._authCheckComplete = true;
    
    // Pulisci dati sessione precedente
    clearPreviousSessionData();
    
    // 📸 STEP 2: APRI IL FILE PICKER (user gesture ancora attiva!)
    console.log('📸 Apertura file picker (auth OK, user gesture attiva)...');
    reviewPhotoInput.value = "";
    reviewPhotoInput.setAttribute('accept', 'image/*');
    
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    if (isMobile) {
        showPhotoSourceDialog(reviewPhotoInput);
    } else {
        reviewPhotoInput.removeAttribute('capture');
        try {
            reviewPhotoInput.click();
            console.log('✅ File picker aperto con successo (desktop)');
        } catch (error) {
            console.error('❌ Errore apertura file picker:', error);
            logError('Errore apertura file picker', error);
        }
    }
    
    // NOTE: GPS viene richiesto nel change handler DOPO che l'utente ha selezionato il file
    // Questo evita di mostrare popup GPS prima che l'utente abbia deciso se fare una foto
}

// --- Gestione caricamento, anteprima e selezione area foto per AI ---
document.addEventListener('DOMContentLoaded', function () {
    console.log('=== SCRIPT CARICATO - DOMContentLoaded ===');
    console.log('User agent:', navigator.userAgent);
    console.log('Current page URL:', window.location.href);
    console.log('Current page path:', window.location.pathname);
    
    // Event listener per il pulsante di reload nella pagina di errore
    const reloadPageBtn = document.getElementById('reload-page-btn');
    if (reloadPageBtn) {
        reloadPageBtn.addEventListener('click', function() {
            location.reload();
        });
        console.log('Event listener aggiunto per reload page button');
    }
    
    // Debug: verifica se siamo in modalità PWA/Service Worker
    console.log('=== DEBUG PWA ===');
    console.log('Navigator serviceWorker:', 'serviceWorker' in navigator);
    console.log('Service Worker controller:', navigator.serviceWorker?.controller?.scriptURL || 'none');
    console.log('Scripts.js caricato:', new Date().toISOString());
    console.log('Scripts.js URL:', document.currentScript?.src || 'unknown');
    
    // Verifica se il file è servito dalla cache
    if (navigator.serviceWorker && navigator.serviceWorker.controller) {
        console.log('ATTENZIONE: File probabilmente servito da Service Worker cache');
    } else {
        console.log('File servito direttamente da network');
    }
    
    // Registrazione Service Worker DISABILITATA in development
    // NOTA: Service Worker può causare problemi di cache durante lo sviluppo
    // Riattivare solo in produzione
    const isDevelopment = window.location.hostname === 'localhost' || 
                          window.location.hostname === '127.0.0.1' ||
                          /^192\.168\.\d{1,3}\.\d{1,3}$/.test(window.location.hostname) ||
                          /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(window.location.hostname) ||
                          /^172\.(1[6-9]|2[0-9]|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(window.location.hostname);
    
    if ('serviceWorker' in navigator && !isDevelopment) {
        window.addEventListener('load', function() {
            // 🔄 Issue 2: Controlla se c'è una pendingAction da eseguire dopo il login
            const pendingAction = sessionStorage.getItem('pendingAction');
            if (pendingAction === 'createReview') {
                console.log('🔄 Ripresa automatica flusso recensione dopo login');
                sessionStorage.removeItem('pendingAction'); // Pulisci
                
                // Aspetta che il DOM sia completamente pronto
                setTimeout(() => {
                    const reviewBtn = document.getElementById('reviewButton');
                    if (reviewBtn) {
                        console.log('🔄 Trigger automatico bottone recensione');
                        reviewBtn.click();
                    }
                }, 500); // Piccolo delay per assicurare che tutto sia pronto
            }
            
            navigator.serviceWorker.register('/service-worker.js')
                .then(function(registration) {
                    console.log('[INFO] Service Worker registrato con successo:', registration);
                    
                    // Gestisci aggiornamenti del service worker
                    registration.addEventListener('updatefound', () => {
                        const newWorker = registration.installing;
                        newWorker.addEventListener('statechange', () => {
                            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                                console.log('[INFO] Nuova versione del service worker disponibile');
                                // Forza l'aggiornamento per evitare cache vecchie
                                newWorker.postMessage({ type: 'SKIP_WAITING' });
                            }
                        });
                    });
                })
                .catch(function(error) {
                    console.log('[ERROR] Registrazione Service Worker fallita:', error);
                });
        });
        console.log('[DEBUG] Service Worker attivato con strategie intelligenti');
    } else if (isDevelopment) {
        console.log('[DEV] Service Worker DISABILITATO in development per evitare problemi di cache');
        
        // Disregistra eventuali Service Worker esistenti
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.getRegistrations().then(function(registrations) {
                for (let registration of registrations) {
                    registration.unregister().then(function(success) {
                        if (success) {
                            console.log('[DEV] Service Worker disregistrato:', registration.scope);
                        }
                    });
                }
            });
        }
    }
    
    // Controlli di compatibilità browser
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const supportsTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    const supportsCanvas = !!document.createElement('canvas').getContext;
    const supportsFileReader = typeof FileReader !== 'undefined';
    
    // NOTA: Rimosso tracking birre duplicate per permettere repository di recensioni multiple
    
    // Debouncing utility per evitare troppe chiamate
    function debounce(func, wait) {
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
    
    // NOTA: Rimosse funzioni di tracking duplicati (generateBeerKey, isBeerAlreadyReviewed, 
    // markBeerAsReviewed, showDuplicateReviewAlert) per permettere recensioni multiple
    
    // Funzione per mostrare messaggi di warning dinamicamente
    function showWarningMessage(message) {
        logDebug('Tentativo di mostrare messaggio warning', { message });
        
        // Rimuovi eventuali messaggi esistenti
        const existingAlerts = document.querySelectorAll('.dynamic-alert');
        existingAlerts.forEach(alert => {
            logDebug('Rimozione alert esistente', { alert: alert.textContent });
            alert.remove();
        });
        
        // Crea il nuovo messaggio di warning
        const alertDiv = document.createElement('div');
        alertDiv.className = 'alert alert-warning dynamic-alert';
        alertDiv.style.margin = '20px';
        alertDiv.style.zIndex = '9999';
        alertDiv.style.position = 'relative';
        alertDiv.style.animation = 'fadeIn 0.3s ease-in';
        alertDiv.style.cursor = 'pointer';
        alertDiv.style.userSelect = 'none';
        alertDiv.textContent = message;
        
        // Aggiungi evento click per chiudere il messaggio
        alertDiv.addEventListener('click', function() {
            logDebug('Messaggio warning chiuso dall\'utente');
            alertDiv.style.animation = 'fadeOut 0.3s ease-out';
            setTimeout(() => {
                if (alertDiv && alertDiv.parentNode) {
                    alertDiv.remove();
                }
            }, 300);
        });
        
        // Trova il punto di inserimento migliore
        let insertionPoint = null;
        
        // Strategia 1: Dopo l'header
        const header = document.querySelector('header');
        if (header) {
            insertionPoint = header;
            logDebug('Punto di inserimento: dopo header');
        }
        
        // Strategia 2: All'inizio del main se header non trovato
        if (!insertionPoint) {
            const main = document.querySelector('main');
            if (main) {
                insertionPoint = main;
                logDebug('Punto di inserimento: inizio main');
            }
        }
        
        // Strategia 3: All'inizio del body se tutto il resto fallisce
        if (!insertionPoint) {
            insertionPoint = document.body;
            logDebug('Punto di inserimento: inizio body');
        }
        
        // Inserisci il messaggio
        if (insertionPoint) {
            if (insertionPoint.tagName === 'HEADER') {
                // Inserisci dopo l'header
                insertionPoint.parentNode.insertBefore(alertDiv, insertionPoint.nextSibling);
            } else {
                // Inserisci all'inizio dell'elemento
                insertionPoint.insertBefore(alertDiv, insertionPoint.firstChild);
            }
            
            logDebug('Messaggio warning inserito con successo', { 
                insertionPoint: insertionPoint.tagName,
                message: message 
            });
        } else {
            logError('Impossibile trovare punto di inserimento per il messaggio');
            // Fallback: usa alert browser
            alert('Warning: ' + message);
            return;
        }
    }
    
    // Funzione per mostrare messaggi informativi (blu) - es. per servizio temporaneamente non disponibile
    function showInfoMessage(message) {
        logDebug('Tentativo di mostrare messaggio info', { message });
        
        // Rimuovi eventuali messaggi esistenti
        const existingAlerts = document.querySelectorAll('.dynamic-alert');
        existingAlerts.forEach(alert => {
            alert.remove();
        });
        
        // Crea il nuovo messaggio informativo
        const alertDiv = document.createElement('div');
        alertDiv.className = 'alert alert-info dynamic-alert';
        alertDiv.style.margin = '20px';
        alertDiv.style.zIndex = '9999';
        alertDiv.style.position = 'relative';
        alertDiv.style.animation = 'fadeIn 0.3s ease-in';
        alertDiv.style.cursor = 'pointer';
        alertDiv.style.userSelect = 'none';
        alertDiv.style.backgroundColor = '#d1ecf1';
        alertDiv.style.borderColor = '#bee5eb';
        alertDiv.style.color = '#0c5460';
        alertDiv.style.padding = '1rem';
        alertDiv.style.borderRadius = '0.5rem';
        alertDiv.style.border = '1px solid';
        alertDiv.textContent = message;
        
        // Aggiungi evento click per chiudere il messaggio
        alertDiv.addEventListener('click', function() {
            logDebug('Messaggio info chiuso dall\'utente');
            alertDiv.style.animation = 'fadeOut 0.3s ease-out';
            setTimeout(() => {
                if (alertDiv && alertDiv.parentNode) {
                    alertDiv.remove();
                }
            }, 300);
        });
        
        // Inserisci dopo l'header o all'inizio del body
        const header = document.querySelector('header');
        if (header) {
            header.parentNode.insertBefore(alertDiv, header.nextSibling);
        } else {
            document.body.insertBefore(alertDiv, document.body.firstChild);
        }
        
        logDebug('Messaggio info inserito con successo', { message });
    }

    // Funzione semplice per mostrare alert (compatibilità)
    function showAlert(type, message) {
        if (type === 'success') {
            // Per i messaggi di successo, usa una classe diversa
            const alertDiv = document.createElement('div');
            alertDiv.className = 'alert alert-success dynamic-alert';
            alertDiv.style.margin = '20px';
            alertDiv.style.zIndex = '9999';
            alertDiv.style.position = 'relative';
            alertDiv.style.animation = 'fadeIn 0.3s ease-in';
            alertDiv.style.cursor = 'pointer';
            alertDiv.style.userSelect = 'none';
            alertDiv.textContent = message;
            
            alertDiv.addEventListener('click', function() {
                alertDiv.style.animation = 'fadeOut 0.3s ease-out';
                setTimeout(() => {
                    if (alertDiv && alertDiv.parentNode) {
                        alertDiv.remove();
                    }
                }, 300);
            });
            
            const header = document.querySelector('header');
            if (header) {
                header.parentNode.insertBefore(alertDiv, header.nextSibling);
            } else {
                document.body.insertBefore(alertDiv, document.body.firstChild);
            }
        } else {
            // Per altri tipi, usa showWarningMessage
            showWarningMessage(message);
        }
    }
    
    // ===== NOTA: Polling asincrono rimosso =====
    // L'elaborazione avviene completamente in background sul server.
    // L'utente riceve solo una conferma immediata dell'upload.
    // I dati vengono salvati automaticamente nel database quando pronti.
    
    // Funzione per iniziare il processo di recensione con i dati AI
    function startReviewProcess(aiData) {
        logDebug('Avvio processo di recensione', {
            success: aiData.success,
            bottlesCount: aiData.bottles?.length || 0,
            breweryData: aiData.brewery
        });
        
        try {
            // Registra l'inizio del processo nel SessionCleanupManager
            if (window.sessionCleanupManager) {
                const sessionId = Date.now().toString(); // ID sessione semplice
                window.sessionCleanupManager.startReviewProcess(sessionId);
            }
            
            // Nascondi il bottone principale e la call-to-action
            const startReviewBtn = document.getElementById('start-review-process');
            const callToAction = document.querySelector('.review-call-to-action');
            if (startReviewBtn) {
                startReviewBtn.style.display = 'none';
                logDebug('Bottone principale nascosto durante processo recensione');
            }
            if (callToAction) {
                callToAction.style.display = 'none';
                logDebug('Call-to-action nascosta durante processo recensione');
            }
            
            // Trova o crea l'area del processo di recensione
            let reviewProcess = document.getElementById('review-process');
            if (!reviewProcess) {
                // Se non esiste, creala e inseriscila dopo la sezione review
                const reviewSection = document.querySelector('.review-menu');
                if (reviewSection) {
                    reviewProcess = document.createElement('div');
                    reviewProcess.id = 'review-process';
                    reviewProcess.innerHTML = `
                        <div id="ai-feedback"></div>
                        <div id="image-preview"></div>
                        <div id="bottle-ratings"></div>
                        <button id="publish-review">Pubblica recensione</button>
                    `;
                    reviewSection.parentNode.insertBefore(reviewProcess, reviewSection.nextSibling);
                    logDebug('Creata area review-process');
                } else {
                    logError('Area review-menu non trovata');
                    alert('Errore: impossibile mostrare l\'interfaccia di recensione');
                    return;
                }
            }
            
            // Mostra feedback dell'AI
            const aiFeedback = document.getElementById('ai-feedback');
            if (aiFeedback && aiData.bottles && aiData.bottles.length > 0) {
                let feedbackHtml = '<h3>Birre riconosciute dall\'AI:</h3><ul>';
                aiData.bottles.forEach((bottle, index) => {
                    logDebug(`Dati AI bottiglia ${index}`, {
                        bottleLabel: bottle.bottleLabel,
                        _id: bottle._id,
                        id: bottle.id,
                        breweryId: bottle.breweryId,
                        breweryName: bottle.breweryName
                    });
                    
                    feedbackHtml += `<li><strong>${bottle.bottleLabel || 'Birra sconosciuta'}</strong>`;
                    if (bottle.breweryName) {
                        feedbackHtml += ` - ${bottle.breweryName}`;
                    }
                    if (bottle.aiData?.alcoholContent) {
                        feedbackHtml += ` (${bottle.aiData.alcoholContent}%)`;
                    }
                    feedbackHtml += '</li>';
                });
                feedbackHtml += '</ul>';
                aiFeedback.innerHTML = feedbackHtml;
                logDebug('Feedback AI popolato');
            }
            
            // 🎉 NUOVO: Apri modal recensioni invece di interfaccia inline
            if (aiData.bottles && aiData.bottles.length > 0) {
                logDebug('Apertura modal recensioni', { bottleCount: aiData.bottles.length });
                
                // Usa l'immagine originale o croppata come thumbnail
                const thumbnailImage = croppedImageForAI || originalImageSrc || document.getElementById('photoPreview')?.src;
                
                // Prepara dati bottiglie con thumbnail
                const bottlesWithThumbnails = aiData.bottles.map((bottle, index) => {
                    return {
                        ...bottle,
                        thumbnail: bottle.imageDataUrl || thumbnailImage, // Usa imageDataUrl dal backend o l'immagine locale
                        beerName: bottle.beerName || bottle.bottleLabel || `Birra #${index + 1}`
                    };
                });
                
                logDebug('Bottles preparate con thumbnail', { 
                    bottleCount: bottlesWithThumbnails.length,
                    hasThumbnail: !!bottlesWithThumbnails[0]?.thumbnail 
                });
                
                // Apri il modal di recensione
                if (typeof window.openReviewModal === 'function') {
                    window.openReviewModal(bottlesWithThumbnails);
                    
                    // Nascondi l'area di review process inline (ora usiamo il modal)
                    const reviewProcess = document.getElementById('review-process');
                    if (reviewProcess) {
                        reviewProcess.style.display = 'none';
                    }
                } else {
                    console.error('❌ window.openReviewModal non trovato - fallback al sistema legacy');
                    // Fallback al sistema legacy se il modal non è disponibile
                    const bottleRatings = document.getElementById('bottle-ratings');
                    if (!bottleRatings) return;
                    
                    let ratingsHtml = '<h3>Valuta le birre:</h3>';
                    aiData.bottles.forEach((bottle, index) => {
                        const thumbnailSrc = generateThumbnail(bottle, index);
                    
                    ratingsHtml += `
                        <div class="bottle-rating" data-bottle-index="${index}">
                            <div class="bottle-info">
                                <div class="bottle-thumbnail">
                                    <img src="${thumbnailSrc}" alt="Thumbnail birra ${bottle.bottleLabel || 'sconosciuta'}" class="beer-thumbnail" />
                                </div>
                                <div class="bottle-details">
                                    <h4>${bottle.bottleLabel || 'Birra #' + (index + 1)}</h4>
                                    ${bottle.breweryName ? `<p class="brewery-name">${bottle.breweryName}</p>` : ''}
                                    ${bottle.aiData?.alcoholContent ? `<p class="alcohol-content">${bottle.aiData.alcoholContent}%</p>` : ''}
                                </div>
                            </div>
                            
                            <!-- Rating generale (semplificato) -->
                            <div class="rating-row-sb">
                                <label class="rating-label-sb">Valutazione generale:</label>
                                <div class="star-rating-sb" data-bottle="${index}" data-category="overall">
                                    <span class="star-sb" data-rating="1">★</span>
                                    <span class="star-sb" data-rating="2">★</span>
                                    <span class="star-sb" data-rating="3">★</span>
                                    <span class="star-sb" data-rating="4">★</span>
                                    <span class="star-sb" data-rating="5">★</span>
                                </div>
                                <div class="rating-value-sb" data-bottle="${index}" data-category="overall">0</div>
                            </div>
                            
                            <!-- Impressioni generali -->
                            <div class="rating-row-sb">
                                <label class="rating-label-sb">Impressioni generali:</label>
                                <textarea class="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none" placeholder="Impressioni generali sulla birra..." rows="3" data-notes="${index}" data-category="general"></textarea>
                            </div>
                            
                            <!-- Toggle per valutazioni dettagliate -->
                            <div class="flex justify-center mt-4">
                                <button type="button" class="btn-sb btn-sb-secondary" data-bottle="${index}">
                                    <i class="fas fa-plus mr-2"></i>
                                    Valutazione dettagliata
                                </button>
                            </div>
                            
                            <!-- Valutazioni dettagliate (nascoste di default) -->
                            <div class="rating-container-sb hidden" data-bottle="${index}">
                                <div class="rating-row-sb">
                                    <label class="rating-label-sb">Aspetto (colore, limpidezza, schiuma):</label>
                                    <div class="star-rating-sb" data-bottle="${index}" data-category="appearance">
                                        <span class="star-sb" data-rating="1">★</span>
                                        <span class="star-sb" data-rating="2">★</span>
                                        <span class="star-sb" data-rating="3">★</span>
                                        <span class="star-sb" data-rating="4">★</span>
                                        <span class="star-sb" data-rating="5">★</span>
                                    </div>
                                    <div class="rating-value-sb" data-bottle="${index}" data-category="appearance">0</div>
                                </div>
                                <textarea class="w-full px-3 py-2 mt-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none" placeholder="Note sull'aspetto..." rows="2" data-notes="${index}" data-category="appearance"></textarea>
                                
                                <div class="rating-row-sb">
                                    <label class="rating-label-sb">Aroma (profumi e odori):</label>
                                    <div class="star-rating-sb" data-bottle="${index}" data-category="aroma">
                                        <span class="star-sb" data-rating="1">★</span>
                                        <span class="star-sb" data-rating="2">★</span>
                                        <span class="star-sb" data-rating="3">★</span>
                                        <span class="star-sb" data-rating="4">★</span>
                                        <span class="star-sb" data-rating="5">★</span>
                                    </div>
                                    <div class="rating-value-sb" data-bottle="${index}" data-category="aroma">0</div>
                                </div>
                                <textarea class="w-full px-3 py-2 mt-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none" placeholder="Note sull'aroma..." rows="2" data-notes="${index}" data-category="aroma"></textarea>
                                
                                <div class="rating-row-sb">
                                    <label class="rating-label-sb">Gusto (sapore e bilanciamento):</label>
                                    <div class="star-rating-sb" data-bottle="${index}" data-category="taste">
                                        <span class="star-sb" data-rating="1">★</span>
                                        <span class="star-sb" data-rating="2">★</span>
                                        <span class="star-sb" data-rating="3">★</span>
                                        <span class="star-sb" data-rating="4">★</span>
                                        <span class="star-sb" data-rating="5">★</span>
                                    </div>
                                    <div class="rating-value-sb" data-bottle="${index}" data-category="taste">0</div>
                                </div>
                                <textarea class="w-full px-3 py-2 mt-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none" placeholder="Note sul gusto..." rows="2" data-notes="${index}" data-category="taste"></textarea>
                                
                                <div class="rating-row-sb">
                                    <label class="rating-label-sb">Sensazione in bocca (corpo, carbonazione):</label>
                                    <div class="star-rating-sb" data-bottle="${index}" data-category="mouthfeel">
                                        <span class="star-sb" data-rating="1">★</span>
                                        <span class="star-sb" data-rating="2">★</span>
                                        <span class="star-sb" data-rating="3">★</span>
                                        <span class="star-sb" data-rating="4">★</span>
                                        <span class="star-sb" data-rating="5">★</span>
                                    </div>
                                    <div class="rating-value-sb" data-bottle="${index}" data-category="mouthfeel">0</div>
                                </div>
                                <textarea class="w-full px-3 py-2 mt-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none" placeholder="Note sulla sensazione in bocca..." rows="2" data-notes="${index}" data-category="mouthfeel"></textarea>
                            </div>
                        </div>
                    `;
                    });
                    
                    bottleRatings.innerHTML = ratingsHtml;
                    
                    // Aggiungi event listeners per le stelle di rating
                    addRatingEventListeners();
                    logDebug('Interfaccia rating popolata (legacy)');
                    
                    // Mostra l'area di review process
                    const reviewProcess = document.getElementById('review-process');
                    if (reviewProcess) {
                        reviewProcess.style.display = 'block';
                        reviewProcess.scrollIntoView({ behavior: 'smooth' });
                    }
                }
            }
            
            // Salva i dati AI globalmente per l'invio finale
            window.currentReviewData = aiData;
            
            // Aggiungi event listener al bottone pubblica recensione
            const publishBtn = document.getElementById('publish-review');
            if (publishBtn) {
                // Debug per verificare il bottone
                console.log('=== DEBUG BOTTONE PUBBLICA ===');
                console.log('Bottone trovato:', publishBtn);
                console.log('Bottone visible:', publishBtn.offsetParent !== null);
                console.log('Bottone disabled:', publishBtn.disabled);
                
                // Se il ReviewModule è disponibile, lascia che gestisca lui la pubblicazione
                if (window.ReviewModule && typeof window.ReviewModule === 'function') {
                    console.log('ReviewModule disponibile - delego la gestione del bottone pubblica');
                    // Non registrare event listener qui, lascia che lo faccia il ReviewModule
                } else {
                    // Fallback al sistema legacy solo se ReviewModule non è disponibile
                    console.log('ReviewModule non disponibile - uso sistema legacy');
                    
                    // Verifica disponibilità EventManager
                    const useEventManager = typeof window.eventManager !== 'undefined';
                    console.log('EventManager disponibile per bottone pubblica:', useEventManager);
                    
                    const publishHandler = function(event) {
                        console.log('=== CLICK BOTTONE PUBBLICA (LEGACY) ===');
                        console.log('Event ricevuto:', event);
                        event.preventDefault(); // Previeni comportamenti default
                        publishReviews();
                    };
                    
                    if (useEventManager) {
                        // Rimuovi eventuali listener precedenti e aggiungi nuovo
                        window.eventManager.addListener(publishBtn, 'click', publishHandler, 'publish-reviews-btn-legacy');
                        console.log('Event listener collegato al bottone pubblica recensione tramite EventManager (legacy)');
                    } else {
                        // Fallback: rimuovi listener precedenti clonando l'elemento
                        publishBtn.replaceWith(publishBtn.cloneNode(true));
                        const newPublishBtn = document.getElementById('publish-review');
                        newPublishBtn.addEventListener('click', publishHandler);
                        console.log('Event listener collegato al bottone pubblica recensione (fallback legacy)');
                    }
                }
            } else {
                console.error('ERRORE: Bottone publish-review non trovato!');
            }
            
            logDebug('Processo di recensione avviato con successo');
            
        } catch (error) {
            logError('Errore nell\'avvio processo recensione', error);
            alert('Errore nell\'inizializzazione della recensione: ' + error.message);
        }
    }
    
    // Funzione per aggiungere event listeners alle stelle di rating
    function addRatingEventListeners() {
        console.log('=== INIZIALIZZAZIONE EVENT LISTENERS STELLE ===');
        
        // Event listeners per le stelle di rating
        const stars = document.querySelectorAll('.star-sb');
        console.log('Stelle trovate:', stars.length);
        
        // Verifica disponibilità EventManager
        const useEventManager = typeof window.eventManager !== 'undefined';
        console.log('EventManager disponibile:', useEventManager);
        
        stars.forEach((star, starIndex) => {
            const starHandler = function() {
                const rating = parseInt(this.dataset.rating);
                const bottleIndex = this.parentElement.dataset.bottle;
                const category = this.parentElement.dataset.category || 'overall';
                const ratingContainer = this.parentElement;
                
                console.log(`=== CLICK STELLA ===`);
                console.log('Stella cliccata:', starIndex);
                console.log('Rating:', rating);
                console.log('Bottiglia index:', bottleIndex);
                console.log('Categoria:', category);
                console.log('Container:', ratingContainer);
                
                // Reset tutte le stelle di questo rating
                ratingContainer.querySelectorAll('.star-sb').forEach(s => s.classList.remove('active'));
                
                // Seleziona le stelle fino al rating cliccato
                for (let i = 1; i <= rating; i++) {
                    const targetStar = ratingContainer.querySelector(`[data-rating="${i}"]`);
                    if (targetStar) {
                        targetStar.classList.add('active');
                        console.log(`Stella ${i} selezionata`);
                    }
                }
                
                // Aggiorna il display del valore se esiste
                const ratingDisplay = ratingContainer.parentElement.querySelector('.rating-value-sb');
                if (ratingDisplay) {
                    ratingDisplay.textContent = rating;
                }
                
                logDebug('Rating selezionato', { bottleIndex, category, rating });
            };
            
            if (useEventManager) {
                // Usa EventManager per gestione sicura
                const starKey = `star-${starIndex}-${star.dataset.rating || 'unknown'}-${Date.now()}`;
                window.eventManager.addListener(star, 'click', starHandler, starKey);
            } else {
                // Fallback al metodo tradizionale
                star.addEventListener('click', starHandler);
            }
        });
        
        // Event listeners per i toggle delle valutazioni dettagliate
        const toggleButtons = document.querySelectorAll('.btn-sb[data-bottle]');
        console.log('Toggle buttons trovati:', toggleButtons.length);
        
        toggleButtons.forEach((button, buttonIndex) => {
            const toggleHandler = function() {
                const bottleIndex = this.dataset.bottle;
                const detailedRatings = document.querySelector(`.rating-container-sb[data-bottle="${bottleIndex}"]`);
                
                console.log(`=== TOGGLE VALUTAZIONE DETTAGLIATA ===`);
                console.log('Button index:', buttonIndex);
                console.log('Bottle index:', bottleIndex);
                console.log('Detailed ratings element:', detailedRatings);
                
                if (detailedRatings) {
                    const isVisible = !detailedRatings.classList.contains('hidden');
                    
                    if (isVisible) {
                        detailedRatings.classList.add('hidden');
                        this.innerHTML = '<i class="fas fa-plus mr-2"></i>Valutazione dettagliata';
                        this.classList.remove('expanded');
                    } else {
                        detailedRatings.classList.remove('hidden');
                        this.innerHTML = '<i class="fas fa-minus mr-2"></i>Nascondi dettagli';
                        this.classList.add('expanded');
                    }
                    
                    logDebug('Toggle valutazione dettagliata', { bottleIndex, isVisible: !isVisible });
                } else {
                    console.error('Elemento detailed-ratings non trovato per bottiglia:', bottleIndex);
                }
            };
            
            if (useEventManager) {
                // Usa EventManager per gestione sicura
                const toggleKey = `toggle-${buttonIndex}-${button.dataset.bottle || 'unknown'}-${Date.now()}`;
                window.eventManager.addListener(button, 'click', toggleHandler, toggleKey);
            } else {
                // Fallback al metodo tradizionale
                button.addEventListener('click', toggleHandler);
            }
        });
        
        console.log('=== EVENT LISTENERS STELLE INIZIALIZZATI ===');
        console.log('Metodo utilizzato:', useEventManager ? 'EventManager' : 'addEventListener tradizionale');
    }
    
    // Funzione per pubblicare le recensioni (LEGACY - usata solo se ReviewModule non disponibile)
    /**
     * Funzione globale per submit recensioni dal modal
     * Chiamata da reviewModal.njk quando l'utente clicca "Pubblica"
     * @param {Array} reviews - Array di recensioni da pubblicare
     * @param {Object} callbacks - { onSuccess: Function, onError: Function }
     */
    window.submitReviews = function(reviews, callbacks = {}) {
        console.log('📤 Submit reviews dal modal:', reviews);
        
        if (!reviews || reviews.length === 0) {
            const errorMsg = 'Nessuna recensione da pubblicare';
            if (callbacks.onError) {
                callbacks.onError(errorMsg);
            } else {
                alert(errorMsg);
            }
            return;
        }
        
        // 🔧 FIX SESSIONE: Se reviewId già esiste, salta STEP 1 e vai direttamente a STEP 2
        // Questo previene la perdita di sessione quando l'utente riprova dopo errore di moderazione
        if (window.currentReviewId) {
            console.log('♻️ ReviewId già esistente - SKIP STEP 1, vado direttamente a STEP 2:', window.currentReviewId);
            
            // Mostra loading
            if (window.utils && window.utils.showNotification) {
                window.utils.showNotification('Pubblicazione recensioni in corso...', 'info', 3000);
            }
            
            // Vai direttamente a STEP 2 con confirmData fake
            const fakeConfirmData = {
                success: true,
                data: {
                    reviewId: window.currentReviewId,
                    status: 'existing',
                    isRetry: true
                }
            };
            
            return submitUserReviews(reviews, callbacks, fakeConfirmData);
        }
        
        // Mostra loading
        if (window.utils && window.utils.showNotification) {
            window.utils.showNotification('Creazione recensione in corso...', 'info', 3000);
        }

        // ✨ STEP 1: Chiama /confirm-and-create per creare Review in DB
        // Invia anche le reviews per la moderazione PREVENTIVA (Soluzione B)
        fetch('/review/confirm-and-create', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                reviews: reviews.map(r => ({
                    beerName: r.beerName,
                    breweryName: r.breweryName,
                    tastingNotes: r.tastingNotes,
                    reviewNotes: r.reviewNotes,
                    notes: r.notes,
                    appearance: r.appearance,
                    aroma: r.aroma,
                    taste: r.taste,
                    mouthfeel: r.mouthfeel
                }))
            })
        })
        .then(response => {
            if (!response.ok) {
                return response.json().then(data => {
                    // 🛡️ Gestione errore moderazione da STEP 1
                    if (data.inappropriateContent) {
                        console.log('❌ STEP 1 - Moderazione fallita:', data);
                        
                        // Mostra SOLO notifica toast (no banner duplicato)
                        const errorMsg = data.message || '⚠️ Contenuto inappropriato rilevato. Rivedi le tue note ed evita linguaggio offensivo.';
                        
                        if (window.utils && window.utils.showNotification) {
                            window.utils.showNotification(errorMsg, 'error', 10000);
                        }
                        
                        if (callbacks.onError) {
                            callbacks.onError(errorMsg);
                        }
                        
                        throw new Error(errorMsg);
                    }
                    throw new Error(data.message || 'Errore creazione Review');
                });
            }
            return response.json();
        })
        .then(confirmData => {
            console.log('✅ Step 1 - Review creato:', confirmData);
            
            if (!confirmData.success) {
                throw new Error(confirmData.message || 'Errore creazione Review');
            }

            // 🔧 FIX #2: Salva reviewId globalmente per STEP 2
            if (confirmData.data && confirmData.data.reviewId) {
                window.currentReviewId = confirmData.data.reviewId;
                console.log('📥 ReviewId salvato per STEP 2:', window.currentReviewId);
            } else {
                console.warn('⚠️ ReviewId NON presente in risposta STEP 1');
            }

            // ✨ STEP 2: Ora invia le valutazioni utente a /create-multiple
            return submitUserReviews(reviews, callbacks, confirmData);
        })
        .catch(error => {
            console.error('❌ Errore Step 1 (confirm-and-create):', error);
            
            // Se è errore di moderazione, già gestito nel .then() - non duplicare notifiche
            if (error.message && error.message.includes('Contenuto inappropriato')) {
                return; // Exit early - notifica già mostrata
            }
            
            let errorMessage = 'Si è verificato un problema durante la creazione della recensione.';
            if (error.message && error.message.includes('Sessione scaduta')) {
                errorMessage = 'Sessione scaduta. Ricarica l\'immagine.';
            }
            
            if (window.utils && window.utils.showNotification) {
                window.utils.showNotification(errorMessage, 'error', 5000);
            }
            
            if (callbacks.onError) {
                callbacks.onError(errorMessage);
            }
        });
    };

    /**
     * Step 2: Invia le valutazioni utente dopo che Review è stato creato
     */
    function submitUserReviews(reviews, callbacks, confirmData) {
        // Prepara payload per backend
        const payload = {
            reviews: reviews.map((review, idx) => {
                console.log(`🔍 DEBUG Review ${idx}:`, {
                    overallRating: review.overallRating,
                    beerName: review.beerName,
                    allKeys: Object.keys(review)
                });
                
                const detailedRatings = {};
                
                // Aggiungi solo i rating dettagliati che hanno valore > 0
                if (review.appearanceRating > 0) {
                    detailedRatings.appearance = { 
                        rating: review.appearanceRating, 
                        notes: review.appearanceNotes || '' 
                    };
                }
                if (review.aromaRating > 0) {
                    detailedRatings.aroma = { 
                        rating: review.aromaRating, 
                        notes: review.aromaNotes || '' 
                    };
                }
                if (review.tasteRating > 0) {
                    detailedRatings.taste = { 
                        rating: review.tasteRating, 
                        notes: review.tasteNotes || '' 
                    };
                }
                if (review.mouthfeelRating > 0) {
                    detailedRatings.mouthfeel = { 
                        rating: review.mouthfeelRating, 
                        notes: review.mouthfeelNotes || '' 
                    };
                }
                
                return {
                    // NON inviare beerId - il backend lo recupera da beerIds[index] in sessione
                    beerName: review.beerName,
                    breweryName: review.breweryName,
                    breweryId: review.breweryId,
                    rating: review.overallRating,
                    notes: review.generalNotes || '',
                    detailedRatings: Object.keys(detailedRatings).length > 0 ? detailedRatings : undefined,
                    aiData: review.aiData,
                    thumbnail: review.thumbnail
                };
            })
        };
        
        // 🔧 FIX: Includi aiAnalysisData solo se esiste, altrimenti ometti il campo
        console.log('🔍 DEBUG: Verifica window.currentReviewData prima di payload:', {
            exists: !!window.currentReviewData,
            bottles: window.currentReviewData?.bottles?.length || 0,
            brewery: window.currentReviewData?.brewery,
            breweryId: window.currentReviewData?.breweryId,
            beerIds: window.currentReviewData?.beerIds?.length || 0
        });
        
        if (window.currentReviewData) {
            payload.aiAnalysisData = {
                bottles: window.currentReviewData.bottles,
                brewery: window.currentReviewData.brewery,
                breweryId: window.currentReviewData.breweryId,
                beerIds: window.currentReviewData.beerIds,
                analysisId: window.currentReviewData.analysisId,
                timestamp: window.currentReviewData.timestamp,
                // Include anche i dati grezzi per compatibilità
                ...window.currentReviewData
            };
        } else {
            console.warn('⚠️ WARNING: window.currentReviewData è null - aiAnalysisData non incluso nel payload');
            console.log('🔍 DEBUG: Verifica window.reviewModalState come fallback:', {
                exists: !!window.reviewModalState,
                bottles: window.reviewModalState?.bottles?.length || 0,
                hasBottles: window.reviewModalState?.bottles?.every(b => b.beerName !== 'Birra 1')
            });
            
            // Fallback: usa window.reviewModalState se currentReviewData non esiste
            if (window.reviewModalState && window.reviewModalState.bottles && window.reviewModalState.bottles.length > 0) {
                console.log('🔄 Fallback: uso window.reviewModalState per aiAnalysisData');
                payload.aiAnalysisData = {
                    bottles: window.reviewModalState.bottles,
                    brewery: window.reviewModalState.bottles[0]?.breweryName,
                    breweryId: window.reviewModalState.bottles[0]?.breweryId,
                    beerIds: window.reviewModalState.bottles.map(b => b.beerId).filter(id => id),
                    analysisId: 'fallback_from_modal_state',
                    timestamp: new Date().toISOString()
                };
            }
        }
        
        // ✨ NUOVO: Aggiungi reviewId dal step di conferma
        if (confirmData && confirmData.data && confirmData.data.reviewId) {
            payload.reviewId = confirmData.data.reviewId;
            console.log('✅ ReviewId aggiunto al payload:', confirmData.data.reviewId);
        }
        
        // 📍 NUOVO: Aggiungi dati geolocalizzazione se disponibili
        if (window.currentReviewLocation) {
            payload.locationData = window.currentReviewLocation;
            console.log('📍 Dati geolocalizzazione aggiunti al payload:', {
                consentGiven: window.currentReviewLocation.consentGiven,
                source: window.currentReviewLocation.source,
                hasCoordinates: !!window.currentReviewLocation.coordinates,
                timestamp: window.currentReviewLocation.timestamp
            });
        } else {
            console.log('📍 Nessun dato geolocalizzazione disponibile (consent negato o non richiesto)');
        }
        
        console.log('📦 Payload preparato:', payload);
        console.log('🔍 Payload.reviews[0] dettagliato:', JSON.stringify(payload.reviews[0], null, 2));
        
        // Mostra loading
        if (window.utils && window.utils.showNotification) {
            window.utils.showNotification('Pubblicazione recensioni in corso...', 'info', 3000);
        }
        
        // Invia al backend
        fetch('/review/create-multiple', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        })
        .then(response => response.json())
        .then(data => {
            console.log('✅ Risposta backend:', data);
            
            // 🔍 DEBUG: Log dettagli errore validazione
            if (data.error && data.details) {
                console.error('❌ Dettagli errore validazione:', JSON.stringify(data.details, null, 2));
                data.details.forEach((detail, idx) => {
                    console.error(`   ${idx + 1}. Recensione ${detail.reviewIndex + 1}: ${detail.violatingFields} campo/i inappropriato/i - Campi: ${detail.fieldNames ? detail.fieldNames.join(', ') : 'N/A'}`);
                });
            }
            
            if (data.success) {
                if (window.utils && window.utils.showNotification) {
                    window.utils.showNotification('Recensioni pubblicate con successo!', 'success', 3000);
                }
                
                // Callback di successo
                if (callbacks.onSuccess) {
                    callbacks.onSuccess();
                }
                
                // Redirect alla pagina di successo o reload
                setTimeout(() => {
                    window.location.href = '/';
                }, 1500);
            } else {
                // 🔧 FIX: Backend risponde con data.error quando fallisce
                let errorMessage = data.error || data.message || 'Errore sconosciuto durante il salvataggio';
                
                if (data.inappropriateContent) {
                    errorMessage = '⚠️ Contenuto inappropriato rilevato. Rivedi le tue note ed evita linguaggio offensivo.';
                    
                    // 🎨 EVIDENZIA CAMPI CON ERRORI IN ROSSO
                    if (data.details && Array.isArray(data.details)) {
                        data.details.forEach(violation => {
                            const reviewIndex = violation.reviewIndex;
                            const fieldNames = violation.fieldNames || [];
                            
                            // Itera attraverso tutti i campi inappropriati
                            fieldNames.forEach(field => {
                                // Trova il campo textarea corrispondente
                                let selector = null;
                                if (field === 'tastingNotes' || field === 'reviewNotes' || field === 'notes') {
                                    // Campi note generali
                                    selector = `[data-notes="${reviewIndex}"][data-category="general"]`;
                                } else if (field === 'appearance' || field === 'aroma' || field === 'taste' || field === 'mouthfeel') {
                                    // Campi note dettagliate per categoria
                                    selector = `[data-notes="${reviewIndex}"][data-category="${field}"]`;
                                } else if (field === 'beerName') {
                                    // Campo nome birra (se presente nel form)
                                    selector = `[data-beer-name="${reviewIndex}"]`;
                                } else if (field === 'breweryName') {
                                    // Campo nome birrificio (se presente nel form)
                                    selector = `[data-brewery-name="${reviewIndex}"]`;
                                }
                                
                                if (selector) {
                                    const textarea = document.querySelector(selector);
                                    if (textarea) {
                                        // Aggiungi classe errore e bordo rosso
                                        textarea.classList.add('field-error');
                                        textarea.style.borderColor = '#ef4444';
                                        textarea.style.borderWidth = '2px';
                                        textarea.style.boxShadow = '0 0 0 3px rgba(239, 68, 68, 0.1)';
                                        
                                        // Rimuovi errore quando utente modifica
                                        textarea.addEventListener('input', function clearError() {
                                            textarea.classList.remove('field-error');
                                            textarea.style.borderColor = '';
                                            textarea.style.borderWidth = '';
                                            textarea.style.boxShadow = '';
                                            textarea.removeEventListener('input', clearError);
                                        }, { once: true });
                                        
                                        // Scroll al primo campo con errore
                                        if (!document.querySelector('.field-error-scrolled')) {
                                            textarea.classList.add('field-error-scrolled');
                                            textarea.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                        }
                                    }
                                }
                            });
                        });
                    }
                } else if (data.needsReanalysis) {
                    errorMessage = '⚠️ I dati della recensione sono scaduti. Ricarica la pagina e riprova l\'analisi dell\'immagine.';
                }
                
                // Callback di errore (NON chiude il modal)
                if (callbacks.onError) {
                    callbacks.onError(errorMessage);
                }
                
                // ⚠️ NON mostrare notifica globale per inappropriateContent - usa solo banner nel modal
                // Mostra notifica globale SOLO per altri tipi di errore (non contenuto inappropriato)
                if (!data.inappropriateContent && window.utils && window.utils.showNotification) {
                    window.utils.showNotification(errorMessage, 'error', 10000);
                }
                
                throw new Error(errorMessage);
            }
        })
        .catch(error => {
            console.error('❌ Errore pubblicazione:', error);
            
            const errorMsg = 'Errore durante la pubblicazione delle recensioni: ' + error.message;
            
            // Callback di errore (NON chiude il modal)
            if (callbacks.onError) {
                callbacks.onError(errorMsg);
            }
            
            // Usa notifica moderna invece di alert (solo se non c'è callback)
            if (!callbacks.onError) {
                if (window.utils && window.utils.showNotification) {
                    window.utils.showNotification(errorMsg, 'error', 8000);
                } else {
                    alert(errorMsg);
                }
            }
        });
    } // Fine submitUserReviews
    
    function publishReviews() {
        // Se il ReviewModule è disponibile, non usare questo sistema legacy
        if (window.ReviewModule && typeof window.ReviewModule === 'function') {
            console.log('[LEGACY] ReviewModule disponibile - non uso sistema legacy di pubblicazione');
            return;
        }
        
        console.log('[LEGACY] Uso sistema legacy di pubblicazione');
        logDebug('Tentativo di pubblicazione recensioni (LEGACY)');
        
        // Debug più dettagliato
        console.log('=== DEBUG PUBBLICAZIONE RECENSIONI LEGACY ===');
        console.log('window.currentReviewData:', window.currentReviewData);
        console.log('Bottles disponibili:', window.currentReviewData?.bottles);
        
        if (!window.currentReviewData || !window.currentReviewData.bottles) {
            logError('Nessun dato di recensione disponibile');
            console.error('ERRORE: window.currentReviewData non disponibile');
            alert('Errore: nessun dato di recensione disponibile. Ricarica la pagina e riprova il processo.');
            return;
        }
        
        // Raccogli i dati di rating da ogni birra
        const reviews = [];
        console.log('=== DEBUG RACCOLTA DATI ===');
        console.log('Numero di birre da elaborare:', window.currentReviewData.bottles.length);
        
        window.currentReviewData.bottles.forEach((bottle, index) => {
            console.log(`\n--- Elaborazione birra ${index}: ${bottle.bottleLabel} ---`);
            
            // Rating generale (obbligatorio)
            const overallRatingContainer = document.querySelector(`[data-bottle="${index}"][data-category="overall"]`);
            const generalNotesTextarea = document.querySelector(`[data-notes="${index}"][data-category="general"]`);
            
            console.log('Container rating generale:', overallRatingContainer);
            console.log('Textarea note generali:', generalNotesTextarea);
            
            if (overallRatingContainer) {
                const selectedStars = overallRatingContainer.querySelectorAll('.star-sb.active');
                const overallRating = selectedStars.length;
                
                console.log('Stelle selezionate:', selectedStars);
                console.log('Rating generale:', overallRating);
                
                if (overallRating > 0) {
                    // Ottieni il thumbnail per questa birra
                    const thumbnailImg = document.querySelector(`[data-bottle-index="${index}"] .beer-thumbnail`);
                    const thumbnailSrc = thumbnailImg ? thumbnailImg.src : null;
                    
                    // Raccogli note generali (impressioni generali)
                    const generalNotesTextarea = document.querySelector(`[data-notes="${index}"][data-category="general"]`);
                    const generalNotes = generalNotesTextarea ? generalNotesTextarea.value.trim() : '';
                    
                    // Raccogli valutazioni dettagliate (opzionali)
                    const detailedRatings = {};
                    const categories = ['appearance', 'aroma', 'taste', 'mouthfeel'];
                    
                    categories.forEach(category => {
                        const categoryRatingContainer = document.querySelector(`[data-bottle="${index}"][data-category="${category}"]`);
                        const categoryNotesTextarea = document.querySelector(`[data-notes="${index}"][data-category="${category}"]`);
                        
                        if (categoryRatingContainer) {
                            const categorySelectedStars = categoryRatingContainer.querySelectorAll('.star-sb.active');
                            const categoryRating = categorySelectedStars.length;
                            const categoryNotes = categoryNotesTextarea ? categoryNotesTextarea.value.trim() : '';
                            
                            if (categoryRating > 0 || categoryNotes) {
                                detailedRatings[category] = {
                                    rating: categoryRating > 0 ? categoryRating : null,
                                    notes: categoryNotes || ''  // Usa sempre stringa vuota invece di null
                                };
                            }
                        }
                    });
                    
                    reviews.push({
                        beerId: bottle._id || bottle.id, // ID della birra dal DB
                        beerName: bottle.bottleLabel,
                        breweryName: bottle.breweryName,
                        rating: overallRating, // Rating generale
                        notes: generalNotes, // Impressioni generali
                        detailedRatings: Object.keys(detailedRatings).length > 0 ? detailedRatings : null,
                        aiData: bottle.aiData,
                        thumbnail: thumbnailSrc // Aggiungi il thumbnail
                    });
                    
                    logDebug('Recensione raccolta', {
                        beerName: bottle.bottleLabel,
                        beerId: bottle._id || bottle.id || 'NOT_FOUND',
                        overallRating: overallRating,
                        hasDetailedRatings: Object.keys(detailedRatings).length > 0,
                        detailedCategories: Object.keys(detailedRatings),
                        hasThumbnail: !!thumbnailSrc
                    });
                } else {
                    // Se non c'è rating generale, controlla se ci sono valutazioni dettagliate
                    const categories = ['appearance', 'aroma', 'taste', 'mouthfeel'];
                    let hasAnyDetailedRating = false;
                    const detailedRatings = {};
                    
                    categories.forEach(category => {
                        const categoryRatingContainer = document.querySelector(`[data-bottle="${index}"][data-category="${category}"]`);
                        const categoryNotesTextarea = document.querySelector(`[data-notes="${index}"][data-category="${category}"]`);
                        
                        if (categoryRatingContainer) {
                            const categorySelectedStars = categoryRatingContainer.querySelectorAll('.star-sb.active');
                            const categoryRating = categorySelectedStars.length;
                            const categoryNotes = categoryNotesTextarea ? categoryNotesTextarea.value.trim() : '';
                            
                            if (categoryRating > 0) {
                                hasAnyDetailedRating = true;
                                detailedRatings[category] = {
                                    rating: categoryRating,
                                    notes: categoryNotes || ''
                                };
                            } else if (categoryNotes) {
                                detailedRatings[category] = {
                                    rating: null,
                                    notes: categoryNotes
                                };
                            }
                        }
                    });
                    
                    if (hasAnyDetailedRating) {
                        // Ottieni il thumbnail per questa birra
                        const thumbnailImg = document.querySelector(`[data-bottle-index="${index}"] .beer-thumbnail`);
                        const thumbnailSrc = thumbnailImg ? thumbnailImg.src : null;
                        
                        // Raccogli note generali
                        const generalNotes = generalNotesTextarea ? generalNotesTextarea.value.trim() : '';
                        
                        reviews.push({
                            beerId: bottle._id || bottle.id, // ID della birra dal DB
                            beerName: bottle.bottleLabel,
                            breweryName: bottle.breweryName,
                            rating: 0, // Nessun rating generale
                            notes: generalNotes, // Note generali
                            detailedRatings: Object.keys(detailedRatings).length > 0 ? detailedRatings : null,
                            aiData: bottle.aiData,
                            thumbnail: thumbnailSrc // Aggiungi il thumbnail
                        });
                        
                        logDebug('Recensione con solo valutazioni dettagliate raccolta', {
                            beerName: bottle.bottleLabel,
                            beerId: bottle._id || bottle.id || 'NOT_FOUND',
                            overallRating: 0,
                            hasGeneralNotes: generalNotes.length > 0,
                            hasDetailedRatings: Object.keys(detailedRatings).length > 0,
                            detailedCategories: Object.keys(detailedRatings),
                            hasThumbnail: !!thumbnailSrc
                        });
                    } else {
                        console.log(`Birra ${index} ignorata - nessun rating generale né dettagliato`, { beerName: bottle.bottleLabel });
                    }
                }
            } else {
                console.log(`Birra ${index} ignorata - container rating generale non trovato`, { beerName: bottle.bottleLabel });
                console.log('Selettore utilizzato:', `[data-bottle="${index}"][data-category="overall"]`);
                // Debug: stampa tutti i container rating disponibili
                const allRatingContainers = document.querySelectorAll('[data-category="overall"]');
                console.log('Tutti i container rating trovati:', allRatingContainers);
            }
        });
        
        console.log('=== RISULTATO RACCOLTA DATI ===');
        console.log('Recensioni raccolte:', reviews.length);
        console.log('Dati recensioni:', reviews);
        
        if (reviews.length === 0) {
            console.error('ERRORE: Nessuna recensione valida raccolta');
            
            // Mostra messaggio di errore all'utente
            if (window.utils && window.utils.showNotification) {
                window.utils.showNotification('Aggiungi almeno una valutazione a stelle prima di pubblicare', 'error', 5000);
            } else {
                showWarningMessage('Aggiungi almeno una valutazione a stelle prima di pubblicare');
            }
            
            // Riabilita il bottone se è stato disabilitato
            const publishBtn = document.getElementById('publish-review');
            if (publishBtn) {
                publishBtn.disabled = false;
                publishBtn.textContent = 'Pubblica recensione';
            }
            
            return;
        }
        
        // Disabilita il bottone durante l'invio
        const publishBtn = document.getElementById('publish-review');
        if (publishBtn) {
            publishBtn.disabled = true;
            publishBtn.textContent = 'Pubblicazione in corso...';
        }
        
        logDebug('Invio recensioni al backend', { reviewsCount: reviews.length });
        
        // Invia le recensioni al backend
        fetch('/review/create-multiple', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                reviews: reviews,
                aiAnalysisData: window.currentReviewData
            })
        })
        .then(response => {
            logDebug('Risposta pubblicazione ricevuta', { status: response.status });
            
            if (!response.ok) {
                return response.json().then(errorData => {
                    throw { status: response.status, data: errorData };
                });
            }
            
            return response.json();
        })
        .then(result => {
            logDebug('Recensioni pubblicate con successo', result);
            
            // Notifica completamento al SessionCleanupManager
            if (window.sessionCleanupManager) {
                window.sessionCleanupManager.cleanupOnReviewComplete();
            }
            
            // Nascondi l'area di review process
            const reviewProcess = document.getElementById('review-process');
            if (reviewProcess) {
                reviewProcess.style.display = 'none';
            }
            
            // Mostra messaggio di successo
            showSuccessMessage('Recensioni pubblicate con successo! Grazie per il tuo contributo.');
            
            // Reset dei dati
            window.currentReviewData = null;
            
        })
        .catch(error => {
            logError('Errore nella pubblicazione delle recensioni', error);
            
            // Notifica errore al SessionCleanupManager
            if (window.sessionCleanupManager) {
                window.sessionCleanupManager.cleanupOnReviewError(error);
            }
            
            let errorMessage = 'Errore nella pubblicazione delle recensioni';
            
            // Gestione specifica per contenuto inappropriato
            if (error.data && error.data.inappropriateContent) {
                errorMessage = 'È stato rilevato linguaggio inappropriato nelle tue recensioni. Per favore, rivedi il contenuto ed evita parole volgari o offensive.';
            } else if (error.status === 401) {
                errorMessage = 'Devi essere loggato per pubblicare recensioni';
            } else if (error.status === 403) {
                errorMessage = 'Non hai i permessi per pubblicare recensioni';
            } else if (error.data && error.data.message) {
                errorMessage = error.data.message;
            }
            
            // Utilizza il sistema di notifiche se disponibile
            if (window.utils && window.utils.showNotification) {
                window.utils.showNotification(errorMessage, 'error', 8000);
            } else {
                alert(errorMessage);
            }
        })
        .finally(() => {
            // Riabilita il bottone
            if (publishBtn) {
                publishBtn.disabled = false;
                publishBtn.textContent = 'Pubblica recensione';
            }
        });
    }
    
    // Funzione per mostrare messaggi di successo
    function showSuccessMessage(message) {
        logDebug('Tentativo di mostrare messaggio successo', { message });
        
        // Ripristina l'interfaccia principale
        resetReviewInterface();
        
        // Rimuovi eventuali messaggi di errore/warning esistenti
        const existingAlerts = document.querySelectorAll('.dynamic-alert, .alert-warning, .alert-danger, .error-message, .simple-notification');
        existingAlerts.forEach(alert => {
            logDebug('Rimozione alert esistente per successo', { alert: alert.textContent });
            alert.remove();
        });
        
        // Rimuovi anche eventuali notifiche del nuovo sistema utils
        if (window.utils && window.utils.clearNotifications) {
            window.utils.clearNotifications();
        }
        
        // Crea il nuovo messaggio di successo
        const alertDiv = document.createElement('div');
        alertDiv.className = 'alert alert-info dynamic-alert';
        alertDiv.style.margin = '20px';
        alertDiv.style.zIndex = '9999';
        alertDiv.style.position = 'relative';
        alertDiv.style.animation = 'fadeIn 0.3s ease-in';
        alertDiv.style.cursor = 'pointer';
        alertDiv.style.userSelect = 'none';
        alertDiv.textContent = message;
        
        // Aggiungi evento click per chiudere il messaggio
        alertDiv.addEventListener('click', function() {
            logDebug('Messaggio successo chiuso dall\'utente');
            alertDiv.style.animation = 'fadeOut 0.3s ease-out';
            setTimeout(() => {
                if (alertDiv && alertDiv.parentNode) {
                    alertDiv.remove();
                }
            }, 300);
        });
        
        // Inserisci il messaggio (stesso sistema del warning)
        const header = document.querySelector('header');
        if (header) {
            header.parentNode.insertBefore(alertDiv, header.nextSibling);
        } else {
            const main = document.querySelector('main');
            if (main) {
                main.insertBefore(alertDiv, main.firstChild);
            } else {
                document.body.insertBefore(alertDiv, document.body.firstChild);
            }
        }
        
        logDebug('Messaggio successo inserito con successo');
    }
    
    // Funzione per ripristinare l'interfaccia principale
    function resetReviewInterface() {
        logDebug('Ripristino interfaccia principale');
        
        // Mostra di nuovo il bottone principale e la call-to-action
        const startReviewBtn = document.getElementById('start-review-process');
        const callToAction = document.querySelector('.review-call-to-action');
        
        if (startReviewBtn) {
            startReviewBtn.style.display = 'inline-flex';
            logDebug('Bottone principale ripristinato');
        }
        
        if (callToAction) {
            callToAction.style.display = 'block';
            logDebug('Call-to-action ripristinata');
        }
        
        // Nascondi il contenitore del processo di recensione
        const reviewProcess = document.getElementById('review-process');
        if (reviewProcess) {
            reviewProcess.style.display = 'none';
            logDebug('Contenitore review-process nascosto');
        }
        
        // Nascondi il pulsante ricomincia quando si ripristina l'interfaccia
        const restartReviewBtn = document.getElementById('restart-review');
        if (restartReviewBtn) {
            restartReviewBtn.style.display = 'none';
            logDebug('Pulsante ricomincia nascosto');
        }
        
        // Reset dei dati di recensione
        window.currentReviewData = null;
        
        logDebug('Interfaccia principale ripristinata completamente');
    }

    // Controllo disponibilità funzionalità
    if (!supportsCanvas) {
        logError('Canvas non supportato dal browser');
        alert('Il tuo browser non supporta le funzionalità necessarie per il crop delle immagini.');
        return;
    }
    
    if (!supportsFileReader) {
        logError('FileReader non supportato dal browser');
        alert('Il tuo browser non supporta il caricamento di file.');
        return;
    }
    
    logDebug('Inizializzazione sistema photo crop', {
        mobile: isMobile,
        touch: supportsTouch,
        canvas: supportsCanvas,
        fileReader: supportsFileReader
    });
    
    // Pulizia preventiva di eventuali dati sessione molto vecchi all'avvio
    cleanupOldSessionData();
    
    // Controllo se ci sono dati AI in sessione al caricamento della pagina
    checkForSessionData();
    
    // Inizializza la pulizia dei dati di sessione quando l'utente naviga via
    clearSessionDataOnNavigation();
    
    // Aggiungi listener globale per pulizia dati AI su navigazione
    addGlobalNavigationListeners();
    
    // Inizializza il bottone con retry multipli
    function initWithRetry(attemptNumber = 1, maxAttempts = 5) {
        console.log(`Tentativo inizializzazione bottone: ${attemptNumber}/${maxAttempts}`);
        
        if (initializeReviewButton()) {
            console.log(`Inizializzazione riuscita al tentativo ${attemptNumber}`);
            return;
        }
        
        if (attemptNumber < maxAttempts) {
            const delay = attemptNumber * 200; // Delay incrementale: 200ms, 400ms, 600ms, 800ms
            console.log(`Riprovo inizializzazione tra ${delay}ms...`);
            setTimeout(() => {
                initWithRetry(attemptNumber + 1, maxAttempts);
            }, delay);
        } else {
            console.log('Tutti i tentativi di inizializzazione falliti - probabilmente non siamo nella pagina welcome');
        }
    }
    
    initWithRetry();
    
    // Inizializza il pulsante "Ricomincia"
    const restartReviewBtn = document.getElementById('restart-review');
    if (restartReviewBtn) {
        restartReviewBtn.addEventListener('click', async function() {
            console.log('[restart-review] Pulsante ricomincia cliccato');
            
            // Pulisci i dati AI dalla sessione
            try {
                await clearPreviousSessionData();
                console.log('[restart-review] Dati AI puliti dalla sessione');
            } catch (error) {
                console.error('[restart-review] Errore nella pulizia dati AI:', error);
            }
            
            // Ripristina l'interfaccia principale
            resetReviewInterface();
            
            // Mostra un messaggio di conferma
            showWarningMessage('Perfetto! Ora puoi inserire una nuova recensione.');
        });
        console.log('Event listener aggiunto per pulsante ricomincia');
    }
    
    // Mostra suggerimenti appropriati in base al dispositivo
    const cropNoteDesktop = document.getElementById('crop-note');
    const cropNoteMobile = document.getElementById('crop-note-mobile');
    
    if (isMobile || supportsTouch) {
        if (cropNoteDesktop) cropNoteDesktop.style.display = 'none';
        if (cropNoteMobile) cropNoteMobile.style.display = 'block';
        logDebug('Modalità mobile/touch attivata');
    } else {
        if (cropNoteDesktop) cropNoteDesktop.style.display = 'block';
        if (cropNoteMobile) cropNoteMobile.style.display = 'none';
        logDebug('Modalità desktop attivata');
    }

    const reviewPhotoInput = document.getElementById('reviewPhoto');
    const photoModal = document.getElementById('photo-modal');
    const closePhotoModal = document.getElementById('closePhotoModal');
    const photoPreviewContainer = document.getElementById('photo-preview-container');
    const photoPreview = document.getElementById('photoPreview');
    const photoCanvas = document.getElementById('photoCanvas');
    let cropStart = null;
    let cropEnd = null;
    let cropping = false;
    let cropRect = null;
    let croppedBase64 = null;

    // Mostra il modal quando viene caricata una foto
    let modalReadyForShow = false;
    function openPhotoModal() {
        // Mostra il modal solo se è stato selezionato e caricato un file immagine valido
        if (photoModal && modalReadyForShow) {
            photoModal.style.display = 'flex';
            
            // Fix per iOS: gestisci l'altezza del viewport dinamicamente
            adjustModalHeightForIOS();
            
            document.body.style.overflow = 'hidden';
        }
    }
    function closeModal(eventOrOptions) {
        let options = {};
        if (eventOrOptions && typeof eventOrOptions.preventDefault === 'function') {
            eventOrOptions.preventDefault();
        } else if (eventOrOptions && typeof eventOrOptions === 'object') {
            options = eventOrOptions;
        }

        const preserveSessionData = !!options.preserveSessionData;

        logDebug('=== CHIUSURA MODAL ===', { preserveSessionData });
        
        if (photoModal) {
            photoModal.style.display = 'none';
            document.body.style.overflow = '';
        }
        if (photoCanvas) {
            photoCanvas.style.opacity = '0';
            photoCanvas.style.pointerEvents = 'none';
            photoCanvas.classList.remove('active-crop');
        }
        // Reset bottoni
        const sendToAIBtn = document.getElementById('sendToAI');
        if (sendToAIBtn) {
            sendToAIBtn.style.display = 'none';
            sendToAIBtn.disabled = false;
        }
        
        // Nasconde overlay spinner se attivo
        const loadingOverlay = document.getElementById('ai-loading-overlay');
        if (loadingOverlay) {
            loadingOverlay.classList.remove('show');
        }
        
        if (!preserveSessionData) {
            logDebug('Pulizia dati AI dalla sessione per chiusura modal (nessun processo attivo previsto)');
            if (window.sessionCleanupManager) {
                if (window.sessionCleanupManager.isProcessActive() || window.sessionCleanupManager.isDisambiguationInProgress()) {
                    console.log('[SessionCleanup] Skip pulizia: processo/disambiguazione attiva durante closeModal');
                } else {
                    window.sessionCleanupManager.cleanupManual('modal_close_no_active_process');
                }
            } else {
                clearPreviousSessionData().then(() => {
                    logDebug('Dati AI puliti dalla sessione (fallback)');
                }).catch(error => {
                    logError('Errore nella pulizia dati AI (fallback):', error);
                });
            }

            resetReviewInterface();
            logDebug('Interfaccia principale ripristinata dopo chiusura modal');
        } else {
            logDebug('Pulizia sessione saltata: dati devono restare disponibili per il processo in corso');
        }
    }
    if (closePhotoModal) {
        closePhotoModal.addEventListener('click', closeModal);
    }
    // Chiudi modal con ESC
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') closeModal();
    });

    // Mostra anteprima e canvas per selezione
    if (reviewPhotoInput && photoPreview && photoPreviewContainer && photoCanvas) {
        // Variabili per drag e zoom immagine
        let imgOffsetX = 0, imgOffsetY = 0;
        let imgStartX = 0, imgStartY = 0;
        let draggingImg = false;
        let imgScale = 1;
        let lastDist = null;
        let lastMid = null;

        reviewPhotoInput.addEventListener('change', async function () {
            // 🎯 Mostra spinner durante caricamento immagine
            if (window.NavigationSpinner && this.files && this.files[0]) {
                window.NavigationSpinner.show();
            }
            
            // 🔒 CHECK AUTH: Se auth check fallito durante apertura file picker, blocca ora
            if (window._authFailed) {
                console.log('❌ Auth fallita - blocco processo recensione');
                const errorMessage = window._authFailedMessage || 'Autenticazione richiesta.';
                
                if (window.utils && window.utils.showNotification) {
                    window.utils.showNotification(errorMessage, 'warning', 5000);
                } else {
                    alert(errorMessage);
                }
                
                // Se non autenticato, redirect al login
                if (errorMessage.includes('login') || errorMessage.includes('Accesso richiesto')) {
                    window.location.href = '/login';
                }
                
                reviewPhotoInput.value = '';
                return;
            }
            
            // Aspetta che auth check sia completo (dovrebbe già esserlo, ma per sicurezza)
            let waitCount = 0;
            while (!window._authCheckComplete && waitCount < 50) {
                await new Promise(r => setTimeout(r, 100));
                waitCount++;
            }
            
            if (window._authFailed) {
                console.log('❌ Auth fallita dopo attesa - blocco');
                reviewPhotoInput.value = '';
                return;
            }
            
            // 📍 CATTURA GPS dopo che utente ha selezionato il file
            // (non prima, così non mostriamo popup GPS se poi l'utente annulla)
            const file = reviewPhotoInput.files[0];
            if (file) {
                console.log('📍 Richiesta consenso geolocalizzazione...');
                try {
                    const locationData = await window.GeolocationModule.getLocation(true);
                    window.currentReviewLocation = locationData;
                    
                    if (locationData && locationData.consentGiven && locationData.coordinates) {
                        console.log('📍 ✅ GPS acquisito:', {
                            lat: locationData.coordinates.latitude,
                            lng: locationData.coordinates.longitude,
                            accuracy: locationData.coordinates.accuracy
                        });
                    } else {
                        console.log('📍 ℹ️ GPS non condiviso');
                    }
                } catch (error) {
                    console.log('📍 ℹ️ GPS non disponibile:', error.message);
                    window.currentReviewLocation = null;
                }
            }
            
            // Reset COMPLETO stato crop e preview per evitare invio immagini precedenti
            cropRect = null;
            isDragging = false;
            draggingImg = false;
            imgOffsetX = 0;
            imgOffsetY = 0;
            imgScale = 1;
            lastDist = null;
            lastMid = null;
            startX = undefined;
            startY = undefined;
            endX = undefined;
            endY = undefined;
            croppedImageForAI = null; // Reset immagine croppata
            originalImageSrc = null; // Reset immagine originale
            currentImageOrientation = 1; // Reset orientamento EXIF
            // IMPORTANTE: Rimuovere handler onerror PRIMA di resettare src a vuoto
            // Altrimenti settare src='' può triggerare un falso errore
            photoPreview.onerror = null;
            photoPreview.src = ''; // Reset preview per evitare invio immagine precedente
            photoPreview.className = 'photo-preview-image';
            photoPreview.style.width = '';
            photoPreview.style.height = '';
            photoCanvas.style.display = '';
            photoCanvas.classList.remove('active-crop');
            
            // Reset freccia di ritorno
            const backArrow = document.getElementById('backArrow');
            if (backArrow) backArrow.style.display = 'none';
            
            const sendToAIBtn = document.getElementById('sendToAI');
            if (sendToAIBtn) {
                sendToAIBtn.style.display = 'none';
                sendToAIBtn.disabled = false;
            }

            // file già dichiarato sopra per GPS check
            modalReadyForShow = false;
            
            if (file) {
                logDebug('File selezionato', {
                    name: file.name,
                    type: file.type,
                    size: file.size,
                    lastModified: new Date(file.lastModified)
                });
                
                // Validazione robusta del file
                const maxSize = 10 * 1024 * 1024; // 10MB
                const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/bmp'];
                const allowedExt = ['.jpg','.jpeg','.png','.gif','.bmp','.webp','.jfif','.pjpeg','.pjp'];
                
                const isImageType = file.type && allowedTypes.includes(file.type.toLowerCase());
                const isImageExt = allowedExt.some(ext => file.name.toLowerCase().endsWith(ext));
                const isSizeValid = file.size <= maxSize;
                
                logDebug('Validazione file', {
                    isImageType,
                    isImageExt,
                    isSizeValid,
                    actualSize: file.size,
                    maxSize
                });
                
                let erroreTipo = false;
                
                if (!isSizeValid) {
                    logError('File troppo grande', { size: file.size, maxSize });
                    if (window.NavigationSpinner) window.NavigationSpinner.hide();
                    alert(`Il file è troppo grande. Dimensione massima consentita: ${Math.round(maxSize / 1024 / 1024)}MB`);
                    reviewPhotoInput.value = '';
                    return;
                }
                
                if (!isImageType && !isImageExt) {
                    erroreTipo = true;
                    logError('Tipo file non valido', { type: file.type, name: file.name });
                }
                
                // Mostra il bottone "Usa immagine" per tutte le immagini valide
                const sendToAIBtn = document.getElementById('sendToAI');
                if (sendToAIBtn) sendToAIBtn.style.display = 'block';
                
                const reader = new FileReader();
                reader.onload = function (e) {
                    try {
                        // Salva l'immagine originale immediatamente dal FileReader
                        originalImageSrc = e.target.result;
                        logDebug('Immagine originale salvata dal FileReader');
                        
                        // IMPORTANTE: Definire onerror PRIMA di onload e PRIMA di assegnare src
                        // Altrimenti se l'immagine fallisce velocemente, l'handler potrebbe non essere pronto
                        photoPreview.onerror = function() {
                            logError('Errore nel caricamento dell\'immagine');
                            if (window.NavigationSpinner) window.NavigationSpinner.hide();
                            alert('Errore nel caricamento dell\'immagine. Prova con un altro file.');
                            reviewPhotoInput.value = '';
                            closeModal();
                        };
                        
                        photoPreview.onload = function () {
                            logDebug('Caricamento immagine completato', {
                                naturalWidth: photoPreview.naturalWidth,
                                naturalHeight: photoPreview.naturalHeight
                            });
                            
                            if (erroreTipo && (photoPreview.naturalWidth === 0 || photoPreview.naturalHeight === 0)) {
                                logError('File non è un\'immagine valida');
                                if (window.NavigationSpinner) window.NavigationSpinner.hide();
                                alert('La tipologia del file selezionato non è ammessa');
                                reviewPhotoInput.value = '';
                                photoPreviewContainer.style.display = 'none';
                                photoCanvas.style.display = 'none';
                                photoPreview.style.display = 'none';
                                closeModal();
                                return;
                            }
                            
                            // Modal sempre pronto con la nuova struttura
                            modalReadyForShow = true;
                            logDebug('Apertura modal per anteprima immagine');
                            openPhotoModal();
                            
                            // 🎯 Nascondi spinner - modal pronto
                            if (window.NavigationSpinner) {
                                window.NavigationSpinner.hide();
                            }
                        
                            // Attiva il canvas interattivo con dimensioni fisse
                            setTimeout(() => {
                                if (photoModal.style.display === 'flex') {
                                    if (syncCanvasToPreview()) {
                                        drawImageOnCanvas();
                                    } else {
                                        logError('Sync canvas fallito al caricamento iniziale');
                                    }
                                }
                            }, 200); // Timeout leggermente aumentato per la nuova struttura
                        };
                    
                    photoPreview.src = e.target.result;
                    } catch (error) {
                        logError('Errore nel processamento dell\'immagine', error);
                        if (window.NavigationSpinner) window.NavigationSpinner.hide();
                        alert('Errore nel processamento dell\'immagine. Prova con un altro file.');
                        reviewPhotoInput.value = '';
                        closeModal();
                    }
                };
                
                reader.onerror = function() {
                    logError('Errore nella lettura del file');
                    if (window.NavigationSpinner) window.NavigationSpinner.hide();
                    alert('Errore nella lettura del file. Prova con un altro file.');
                    reviewPhotoInput.value = '';
                };
                
                reader.readAsDataURL(file);
            } else {
                // Nessun file selezionato (utente ha annullato)
                if (window.NavigationSpinner) window.NavigationSpinner.hide();
                photoPreviewContainer.style.display = 'none';
                photoCanvas.style.display = 'none';
                photoPreview.style.display = 'none';
                closeModal();
            }
        });

        // Funzione centralizzata per sincronizzare canvas con immagine - ora con layout fisso
        function syncCanvasToPreview() {
            if (!photoPreview.complete || photoPreview.naturalWidth === 0) {
                logDebug('Immagine non ancora caricata, sync rinviato');
                return false;
            }
            
            // Con la nuova struttura, il canvas si sovrappone sempre perfettamente all'immagine
            const rect = photoPreview.getBoundingClientRect();
            
            // Imposta le dimensioni CSS del canvas per una sovrapposizione perfetta
            photoCanvas.style.width = `${rect.width}px`;
            photoCanvas.style.height = `${rect.height}px`;
            
            // Imposta la risoluzione interna del canvas pari a quella dell'immagine originale
            photoCanvas.width = photoPreview.naturalWidth;
            photoCanvas.height = photoPreview.naturalHeight;
            
            // Il canvas è già posizionato correttamente via CSS, basta renderlo visibile
            photoCanvas.style.opacity = '1';
            photoCanvas.style.pointerEvents = 'auto';
            photoCanvas.style.display = 'block';
            
            logDebug('Canvas sincronizzato con immagine (layout fisso)', {
                canvasRenderWidth: rect.width,
                canvasRenderHeight: rect.height,
                canvasInternalWidth: photoCanvas.width,
                canvasInternalHeight: photoCanvas.height,
                imageNaturalWidth: photoPreview.naturalWidth,
                imageNaturalHeight: photoPreview.naturalHeight
            });
            
            return true;
        }

        // Gestione selezione rettangolo libero sul canvas e drag immagine
        let isDragging = false;
        let startX, startY, endX, endY;
        // Funzione per aggiornare l'overlay crop usando canvas drawing
        function updateCropOverlayHTML() {
            const ctx = photoCanvas.getContext('2d');
            ctx.clearRect(0, 0, photoCanvas.width, photoCanvas.height);

            // Se stiamo mostrando un'immagine croppata, non disegnare mai alcun bordo
            if (croppedImageForAI) {
                return;
            }

            // Canvas trasparente per vedere l'immagine sottostante
            ctx.save();
            ctx.translate(imgOffsetX, imgOffsetY);
            ctx.scale(imgScale, imgScale);
            ctx.restore();

            // Se è attivo il crop mode (touch o desktop), applica l'overlay di trasparenza con finestra di selezione
            if ((touchCropMode || isDragging) && (isDragging || (cropRect && cropRect.w > 0 && cropRect.h > 0))) {
                ctx.save();

                // Disegna overlay di trasparenza su tutta l'immagine
                ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
                ctx.fillRect(0, 0, photoCanvas.width, photoCanvas.height);

                // Calcola area di selezione
                const rectX = isDragging ? Math.min(startX, endX) : cropRect.x;
                const rectY = isDragging ? Math.min(startY, endY) : cropRect.y;
                const rectW = isDragging ? Math.abs(endX - startX) : cropRect.w;
                const rectH = isDragging ? Math.abs(endY - startY) : cropRect.h;

                // Rimuovi l'overlay dall'area selezionata usando globalCompositeOperation
                ctx.globalCompositeOperation = 'destination-out';
                ctx.fillStyle = 'rgba(0, 0, 0, 1)';
                ctx.fillRect(rectX, rectY, rectW, rectH);

                // Ripristina modalità di composizione normale
                ctx.globalCompositeOperation = 'source-over';

                // Disegna il bordo della selezione con gradiente ambra/dorato
                const gradient = ctx.createLinearGradient(rectX, rectY, rectX + rectW, rectY + rectH);
                gradient.addColorStop(0, '#fbbf24');    // Ambra chiaro
                gradient.addColorStop(0.5, '#f59e0b');  // Ambra medio
                gradient.addColorStop(1, '#d97706');    // Ambra scuro
                ctx.strokeStyle = gradient;
                ctx.lineWidth = 3;
                ctx.setLineDash([6, 4]);
                ctx.strokeRect(rectX, rectY, rectW, rectH);

                ctx.restore();
            }
        }

        function drawImageOnCanvas() {
            // Se stiamo mostrando un'immagine croppata, non disegnare mai alcun bordo
            if (croppedImageForAI) {
                return;
            }
            
            // Pulisci e ridisegna il canvas overlay
            const ctx = photoCanvas.getContext('2d');
            ctx.clearRect(0, 0, photoCanvas.width, photoCanvas.height);
            
            // Gestione overlay disegno su canvas
            updateCropOverlayHTML();
        }

        // Crop selection
        // (variabili già dichiarate sopra)

        // Attiva crop solo con Shift+mousedown
        photoCanvas.addEventListener('mousedown', function (e) {
            if (e.button === 0 && e.shiftKey) {
                // Shift+click: crop selection
                isDragging = true;
                photoCanvas.classList.add('active-crop');
                // Coordinate nel canvas (scalate correttamente)
                const rect = photoCanvas.getBoundingClientRect();
                const scaleX = photoCanvas.width / rect.width;
                const scaleY = photoCanvas.height / rect.height;
                
                startX = (e.clientX - rect.left) * scaleX;
                startY = (e.clientY - rect.top) * scaleY;
                endX = startX;
                endY = startY;
                cropRect = null;
                
                drawImageOnCanvas();
                photoCanvas.style.cursor = 'crosshair';
            } else {
                // Drag immagine solo se non si sta croppando
                if (!isDragging) {
                    draggingImg = true;
                    imgStartX = e.clientX;
                    imgStartY = e.clientY;
                    photoCanvas.style.cursor = 'grabbing';
                }
            }
        });

        photoCanvas.addEventListener('mousemove', function (e) {
            // Gestione cursore
            if (e.shiftKey && !isDragging && !draggingImg) {
                photoCanvas.style.cursor = 'crosshair';
            } else if (!isDragging && !draggingImg) {
                photoCanvas.style.cursor = 'grab';
            }

            if (isDragging) {
                const rect = photoCanvas.getBoundingClientRect();
                const scaleX = photoCanvas.width / rect.width;
                const scaleY = photoCanvas.height / rect.height;
                
                endX = (e.clientX - rect.left) * scaleX;
                endY = (e.clientY - rect.top) * scaleY;
                drawImageOnCanvas();
            } else if (draggingImg) {
                let dx = e.clientX - imgStartX;
                let dy = e.clientY - imgStartY;
                imgStartX = e.clientX;
                imgStartY = e.clientY;
                imgOffsetX += dx;
                imgOffsetY += dy;
                drawImageOnCanvas();
            }
        });

        photoCanvas.addEventListener('mouseleave', function () {
            photoCanvas.style.cursor = '';
        });

        window.addEventListener('mouseup', function (e) {
            if (isDragging) {
                isDragging = false;
                const rect = photoCanvas.getBoundingClientRect();
                const scaleX = photoCanvas.width / rect.width;
                const scaleY = photoCanvas.height / rect.height;
                
                endX = (e.clientX - rect.left) * scaleX;
                endY = (e.clientY - rect.top) * scaleY;
                cropRect = {
                    x: Math.min(startX, endX),
                    y: Math.min(startY, endY),
                    w: Math.abs(endX - startX),
                    h: Math.abs(endY - startY)
                };
                photoCanvas.classList.remove('active-crop');
                
                // Applica automaticamente il crop se la selezione è abbastanza grande
                if (cropRect.w > 10 && cropRect.h > 10) {
                    console.log('Selezione completata - applicazione automatica del crop');
                    applyCrop();
                } else {
                    console.log('Selezione troppo piccola - crop non applicato');
                    drawImageOnCanvas();
                }
                
                photoCanvas.style.cursor = 'grab';
            }
            if (draggingImg) {
                draggingImg = false;
                photoCanvas.style.cursor = 'grab';
            }
        });

        // Touch events per mobile: drag, pinch-to-zoom e crop selection
        let touchCropMode = false;
        let touchCropStart = null;
        
        photoCanvas.addEventListener('touchstart', function (e) {
            e.preventDefault(); // Previeni scroll su iOS
            
            if (e.touches.length === 1) {
                const touch = e.touches[0];
                const rect = photoCanvas.getBoundingClientRect();
                const touchX = touch.clientX - rect.left;
                const touchY = touch.clientY - rect.top;
                
                // Se c'è già un'immagine croppata, non permettere ulteriori crop
                if (croppedImageForAI) {
                    return;
                }
                
                // Inizia crop mode se tocco prolungato (long press)
                const longPressTimer = setTimeout(() => {
                    touchCropMode = true;
                    
                    // Converti coordinate touch in coordinate canvas
                    const scaleX = photoCanvas.width / rect.width;
                    const scaleY = photoCanvas.height / rect.height;
                    
                    touchCropStart = {
                        x: touchX * scaleX,
                        y: touchY * scaleY
                    };
                    
                    // Visual feedback per crop mode - ora gestito dal canvas overlay
                    photoCanvas.style.cursor = 'crosshair';
                    photoCanvas.classList.add('active-crop');
                    
                    // Vibrazione tattile se supportata
                    if (navigator.vibrate) {
                        navigator.vibrate(50);
                    }
                    
                    console.log('Touch crop mode attivato');
                }, 500); // 500ms per long press
                
                // Se l'utente muove il dito prima del long press, annulla crop mode
                const cancelCropMode = () => {
                    clearTimeout(longPressTimer);
                    touchCropMode = false;
                };
                
                // Fallback al drag normale se non è crop mode
                setTimeout(() => {
                    if (!touchCropMode) {
                        draggingImg = true;
                        imgStartX = touch.clientX;
                        imgStartY = touch.clientY;
                    }
                }, 100);
                
                // Salva i listener per la pulizia
                photoCanvas._cancelCropMode = cancelCropMode;
                photoCanvas._longPressTimer = longPressTimer;
                
            } else if (e.touches.length === 2) {
                // Reset crop mode su pinch
                touchCropMode = false;
                if (photoCanvas._longPressTimer) {
                    clearTimeout(photoCanvas._longPressTimer);
                }
                
                draggingImg = false;
                // Pinch zoom
                const dx = e.touches[0].clientX - e.touches[1].clientX;
                const dy = e.touches[0].clientY - e.touches[1].clientY;
                lastDist = Math.sqrt(dx*dx + dy*dy);
                lastMid = {
                    x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
                    y: (e.touches[0].clientY + e.touches[1].clientY) / 2
                };
            }
        });
        
        photoCanvas.addEventListener('touchmove', function (e) {
            e.preventDefault();
            
            if (touchCropMode && e.touches.length === 1 && touchCropStart) {
                // Modalità crop: disegna il rettangolo di selezione
                const touch = e.touches[0];
                const rect = photoCanvas.getBoundingClientRect();
                const scaleX = photoCanvas.width / rect.width;
                const scaleY = photoCanvas.height / rect.height;
                
                const currentX = (touch.clientX - rect.left) * scaleX;
                const currentY = (touch.clientY - rect.top) * scaleY;
                
                // Simula il comportamento di isDragging per il crop
                startX = touchCropStart.x;
                startY = touchCropStart.y;
                endX = currentX;
                endY = currentY;
                isDragging = true;
                
                drawImageOnCanvas();
                
            } else if (draggingImg && e.touches.length === 1) {
                // Modalità drag normale
                let dx = e.touches[0].clientX - imgStartX;
                let dy = e.touches[0].clientY - imgStartY;
                imgStartX = e.touches[0].clientX;
                imgStartY = e.touches[0].clientY;
                imgOffsetX += dx;
                imgOffsetY += dy;
                drawImageOnCanvas();
            } else if (e.touches.length === 2) {
                // Pinch zoom
                const dx = e.touches[0].clientX - e.touches[1].clientX;
                const dy = e.touches[0].clientY - e.touches[1].clientY;
                const dist = Math.sqrt(dx*dx + dy*dy);
                if (lastDist) {
                    let scaleChange = dist / lastDist;
                    // Calcola centro pinch rispetto al canvas
                    const rect = photoCanvas.getBoundingClientRect();
                    const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left;
                    const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top;
                    // Aggiorna offset per mantenere il centro
                    imgOffsetX = (imgOffsetX - midX) * scaleChange + midX;
                    imgOffsetY = (imgOffsetY - midY) * scaleChange + midY;
                    imgScale *= scaleChange;
                    // Limiti zoom
                    imgScale = Math.max(0.5, Math.min(imgScale, 5));
                }
                lastDist = dist;
                drawImageOnCanvas();
            }
        });
        
        photoCanvas.addEventListener('touchend', function (e) {
            e.preventDefault();
            
            // Pulisci timer se presente
            if (photoCanvas._longPressTimer) {
                clearTimeout(photoCanvas._longPressTimer);
            }
            
            if (touchCropMode && touchCropStart) {
                // Completa il crop
                isDragging = false;
                
                const rect = photoCanvas.getBoundingClientRect();
                const scaleX = photoCanvas.width / rect.width;
                const scaleY = photoCanvas.height / rect.height;
                
                cropRect = {
                    x: Math.min(startX, endX),
                    y: Math.min(startY, endY),
                    w: Math.abs(endX - startX),
                    h: Math.abs(endY - startY)
                };
                
                photoCanvas.classList.remove('active-crop');
                photoCanvas.style.cursor = '';
                
                // Applica il crop se la selezione è sufficientemente grande
                if (cropRect.w > 20 && cropRect.h > 20) {
                    console.log('Touch crop completato - applicazione automatica');
                    applyCrop();
                    
                    // Vibrazione di conferma
                    if (navigator.vibrate) {
                        navigator.vibrate([50, 100, 50]);
                    }
                } else {
                    console.log('Touch crop troppo piccolo - annullato');
                    drawImageOnCanvas();
                }
                
                // Reset crop mode
                touchCropMode = false;
                touchCropStart = null;
                
            } else {
                // Fine drag normale
                draggingImg = false;
                lastDist = null;
            }
        });

        // Funzione per confermare e applicare il crop
        function applyCrop() {
            console.log('Applicazione crop - zoom sull\'area selezionata');
            
            if (!cropRect || cropRect.w < 10 || cropRect.h < 10) {
                console.log('Selezione crop troppo piccola, nessun crop applicato');
                return false;
            }
            
            // Verifica che originalImageSrc sia valido
            if (!originalImageSrc) {
                console.error('applyCrop: originalImageSrc non disponibile');
                return false;
            }
            
            // Salva cropRect locale per evitare problemi di timing (iOS)
            const savedCropRect = { ...cropRect };
            console.log('applyCrop: savedCropRect =', savedCropRect);
            
            // Funzione interna che esegue il crop effettivo
            function executeCrop(imgElement) {
                try {
                    // Usa le dimensioni dell'immagine originale per i calcoli
                    const originalWidth = imgElement.naturalWidth || imgElement.width;
                    const originalHeight = imgElement.naturalHeight || imgElement.height;
                    
                    console.log('executeCrop: dimensioni immagine =', { originalWidth, originalHeight });
                    
                    // Verifica dimensioni valide
                    if (!originalWidth || !originalHeight || originalWidth <= 0 || originalHeight <= 0) {
                        console.error('executeCrop: dimensioni immagine non valide', { originalWidth, originalHeight });
                        return;
                    }
                    
                    // Ottieni le dimensioni del canvas renderizzato (quello che vede l'utente)
                    const canvasRect = photoCanvas.getBoundingClientRect();
                    const canvasDisplayWidth = canvasRect.width;
                    const canvasDisplayHeight = canvasRect.height;
                    
                    // Verifica dimensioni canvas valide
                    if (!canvasDisplayWidth || !canvasDisplayHeight || canvasDisplayWidth <= 0 || canvasDisplayHeight <= 0) {
                        console.error('executeCrop: dimensioni canvas non valide', { canvasDisplayWidth, canvasDisplayHeight });
                        return;
                    }
                    
                    // Calcola il rapporto di scala tra canvas interno e canvas visualizzato
                    const scaleXCanvas = photoCanvas.width / canvasDisplayWidth;
                    const scaleYCanvas = photoCanvas.height / canvasDisplayHeight;
                    
                    // Calcola il rapporto di scala tra immagine originale e canvas interno
                    const scaleXOriginal = originalWidth / photoCanvas.width;
                    const scaleYOriginal = originalHeight / photoCanvas.height;
                    
                    // Converti le coordinate del rettangolo di crop dalle coordinate canvas alle coordinate immagine originale
                    const imgX = savedCropRect.x * scaleXOriginal;
                    const imgY = savedCropRect.y * scaleYOriginal;
                    const imgW = savedCropRect.w * scaleXOriginal;
                    const imgH = savedCropRect.h * scaleYOriginal;
                    
                    // Assicurati che le coordinate siano entro i limiti dell'immagine originale
                    const clampedX = Math.max(0, Math.min(imgX, originalWidth));
                    const clampedY = Math.max(0, Math.min(imgY, originalHeight));
                    let clampedW = Math.min(imgW, originalWidth - clampedX);
                    let clampedH = Math.min(imgH, originalHeight - clampedY);
                    
                    // Validazione finale delle dimensioni (minimo 1px)
                    clampedW = Math.max(1, Math.round(clampedW));
                    clampedH = Math.max(1, Math.round(clampedH));
                    
                    console.log('Crop coordinates calculation:', { 
                        savedCropRect,
                        canvasSize: { w: photoCanvas.width, h: photoCanvas.height },
                        canvasDisplay: { w: canvasDisplayWidth, h: canvasDisplayHeight },
                        originalSize: { w: originalWidth, h: originalHeight },
                        scaleCanvas: { x: scaleXCanvas, y: scaleYCanvas },
                        scaleOriginal: { x: scaleXOriginal, y: scaleYOriginal },
                        imageCoords: { x: imgX, y: imgY, w: imgW, h: imgH },
                        clampedCoords: { x: clampedX, y: clampedY, w: clampedW, h: clampedH }
                    });
                    
                    // Verifica coordinate valide
                    if (isNaN(clampedW) || isNaN(clampedH) || clampedW <= 0 || clampedH <= 0) {
                        console.error('executeCrop: coordinate clamped non valide', { clampedX, clampedY, clampedW, clampedH });
                        return;
                    }
                    
                    // Crea canvas temporaneo per l'area croppata
                    const tempCanvas = document.createElement('canvas');
                    tempCanvas.width = clampedW;
                    tempCanvas.height = clampedH;
                    const tctx = tempCanvas.getContext('2d');
                    
                    if (!tctx) {
                        console.error('executeCrop: impossibile ottenere context 2d');
                        return;
                    }
                    
                    tctx.fillStyle = '#f2f2f2';
                    tctx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
                    
                    // Disegna l'area croppata dall'immagine originale pulita (senza bordi)
                    tctx.drawImage(imgElement, 
                        clampedX, clampedY, clampedW, clampedH,  // area sorgente nell'immagine originale
                        0, 0, clampedW, clampedH                 // area destinazione (dimensioni reali)
                    );
                    
                    // Salva per invio AI e per display
                    const resultDataUrl = tempCanvas.toDataURL('image/jpeg', 0.92);
                    croppedImageForAI = resultDataUrl;
                    
                    // Reset completo dello stato crop per evitare bordi residui
                    cropRect = null;
                    isDragging = false;
                    startX = undefined;
                    startY = undefined;
                    endX = undefined;
                    endY = undefined;
                    
                    // Nascondi il canvas PRIMA di cambiare l'immagine per evitare sovrapposizioni
                    photoCanvas.style.display = 'none';
                    photoCanvas.style.opacity = '0';
                    photoCanvas.style.pointerEvents = 'none';
                    photoCanvas.classList.remove('active-crop');
                    
                    // Mostra l'immagine zoomata - con la nuova struttura le dimensioni sono gestite dal CSS
                    photoPreview.src = resultDataUrl;
                    
                    // Mantieni la classe CSS per il layout responsive fisso
                    photoPreview.className = 'photo-preview-image';
                    
                    // Mostra la freccia di ritorno e il bottone "Usa immagine"
                    const backArrow = document.getElementById('backArrow');
                    if (backArrow) backArrow.style.display = 'flex';
                    const sendToAIBtn = document.getElementById('sendToAI');
                    if (sendToAIBtn) sendToAIBtn.style.display = 'block';
                    
                    console.log('Crop applicato con successo - dimensioni:', { w: clampedW, h: clampedH });
                } catch (err) {
                    console.error('executeCrop: errore durante esecuzione crop', err);
                }
            }
            
            // Crea un elemento immagine temporaneo dall'immagine originale per ottenere le dimensioni corrette
            const tempImg = new Image();
            
            // Imposta crossOrigin per evitare problemi CORS con canvas tainted
            tempImg.crossOrigin = 'anonymous';
            
            // Flag per evitare doppia esecuzione
            let cropExecuted = false;
            
            tempImg.onload = function() {
                if (!cropExecuted) {
                    cropExecuted = true;
                    console.log('tempImg.onload: immagine caricata correttamente');
                    executeCrop(tempImg);
                }
            };
            
            tempImg.onerror = function(e) {
                console.error('tempImg.onerror: errore caricamento immagine', e);
                // Fallback: prova a usare photoPreview direttamente se già caricata
                if (photoPreview && photoPreview.naturalWidth > 0 && !cropExecuted) {
                    cropExecuted = true;
                    console.log('Fallback: uso photoPreview esistente');
                    executeCrop(photoPreview);
                }
            };
            
            // Timeout di sicurezza per iOS Safari dove onload potrebbe non scattare
            setTimeout(function() {
                if (!cropExecuted) {
                    console.warn('applyCrop: timeout - tentativo fallback');
                    if (tempImg.complete && tempImg.naturalWidth > 0) {
                        cropExecuted = true;
                        console.log('Fallback timeout: tempImg già completa');
                        executeCrop(tempImg);
                    } else if (photoPreview && photoPreview.naturalWidth > 0) {
                        cropExecuted = true;
                        console.log('Fallback timeout: uso photoPreview');
                        executeCrop(photoPreview);
                    } else {
                        console.error('applyCrop: impossibile eseguire crop - nessuna immagine disponibile');
                    }
                }
            }, 500);
            
            // Usa l'immagine originale senza il canvas sovrapposto
            tempImg.src = originalImageSrc;
            
            return true;
        }

        // Gestione della freccia di ritorno per annullare crop
        const backArrow = document.getElementById('backArrow');
        if (backArrow) {
            function restoreOriginalImage() {
                console.log('Freccia di ritorno cliccata - ripristino immagine originale come primo caricamento');
                
                if (originalImageSrc) {
                    // Reset completo dello stato
                    imgOffsetX = 0;
                    imgOffsetY = 0;
                    imgScale = 1;
                    cropRect = null;
                    croppedImageForAI = null;
                    isDragging = false;
                    draggingImg = false;
                    
                    // Ripristina l'immagine e ricrea tutto come al primo caricamento
                    photoPreview.onload = function() {
                        console.log('Immagine ripristinata - ricreazione canvas con layout fisso');
                        
                        // Ripristina la classe CSS dell'immagine per il layout fisso
                        photoPreview.className = 'photo-preview-image';
                        photoPreview.style.maxWidth = '';
                        photoPreview.style.maxHeight = '';
                        photoPreview.style.width = '';
                        photoPreview.style.height = '';
                        photoPreview.style.objectFit = '';
                        
                        // Ricrea il canvas con la nuova struttura di layout fisso
                        setTimeout(() => {
                            if (photoModal.style.display === 'flex') {
                                // Canvas con dimensioni fisse gestite dal CSS
                                const rect = photoPreview.getBoundingClientRect();
                                
                                photoCanvas.style.width = `${rect.width}px`;
                                photoCanvas.style.height = `${rect.height}px`;
                                photoCanvas.width = photoPreview.naturalWidth;
                                photoCanvas.height = photoPreview.naturalHeight;
                                photoCanvas.style.opacity = '1';
                                photoCanvas.style.pointerEvents = 'auto';
                                photoCanvas.style.display = 'block';
                                
                                console.log('Canvas ricreato dopo restore (layout fisso)', {
                                    canvasRenderWidth: rect.width,
                                    canvasRenderHeight: rect.height,
                                    canvasInternalWidth: photoCanvas.width,
                                    canvasInternalHeight: photoCanvas.height
                                });

                                drawImageOnCanvas();
                            }
                        }, 200); // Timeout adeguato per la nuova struttura
                    };
                    
                    photoPreview.src = originalImageSrc;
                    
                    // Nascondi la freccia di ritorno
                    backArrow.style.display = 'none';
                    const sendToAIBtn = document.getElementById('sendToAI');
                    if (sendToAIBtn) sendToAIBtn.style.display = 'block';
                } else {
                    console.log('Nessuna immagine originale salvata');
                }
            }
            
            backArrow.addEventListener('click', restoreOriginalImage);
            
            // Migliore gestione touch con debouncing
            let touchTimeout;
            backArrow.addEventListener('touchstart', function(e) {
                e.preventDefault();
                clearTimeout(touchTimeout);
                backArrow.style.transform = 'scale(0.95)';
            });
            
            backArrow.addEventListener('touchend', function(e) {
                e.preventDefault();
                backArrow.style.transform = 'scale(1)';
                clearTimeout(touchTimeout);
                touchTimeout = setTimeout(() => {
                    restoreOriginalImage();
                }, 50); // Debouncing per evitare doppi tap
            });
            
            // Accessibilità: supporto tastiera
            backArrow.addEventListener('keydown', function(e) {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    restoreOriginalImage();
                }
            });
            
            // Rendi la freccia focusable per accessibilità
            backArrow.setAttribute('tabindex', '0');
            backArrow.setAttribute('role', 'button');
            backArrow.setAttribute('aria-label', 'Torna all\'immagine originale');
        }

        // Gestione del bottone "Usa immagine" con controlli robusti
        const sendToAIBtn = document.getElementById('sendToAI');
        if (sendToAIBtn) {
            sendToAIBtn.addEventListener('click', function () {
                logDebug('Usa immagine premuto');
                
                // Previeni doppi click
                if (sendToAIBtn.disabled) {
                    logDebug('Invio già in corso, ignoro click');
                    return;
                }
                
                let imageToSend = croppedImageForAI;
                
                // Se non c'è un'immagine croppata, usa originalImageSrc (più affidabile di photoPreview.src)
                // originalImageSrc contiene sempre l'ultima immagine caricata dal FileReader
                if (!imageToSend && originalImageSrc) {
                    logDebug('Uso originalImageSrc per invio AI (nessun crop)', {
                        dataSize: originalImageSrc.length
                    });
                    imageToSend = originalImageSrc;
                }
                
                // Fallback: se per qualche motivo originalImageSrc non è disponibile, usa photoPreview
                if (!imageToSend && photoPreview.src && photoPreview.complete) {
                    try {
                        logDebug('Fallback: Preparazione immagine da photoPreview per AI');
                        // Crea canvas temporaneo per l'immagine originale
                        const tempCanvas = document.createElement('canvas');
                        tempCanvas.width = photoPreview.naturalWidth;
                        tempCanvas.height = photoPreview.naturalHeight;
                        const ctx = tempCanvas.getContext('2d');
                        
                        if (!ctx) {
                            throw new Error('Impossibile creare contesto canvas');
                        }
                        
                        ctx.drawImage(photoPreview, 0, 0);
                        imageToSend = tempCanvas.toDataURL('image/jpeg', 0.92); // Mantieni il data URL completo
                        
                        logDebug('Immagine preparata da photoPreview per AI', {
                            width: tempCanvas.width,
                            height: tempCanvas.height,
                            dataSize: imageToSend.length
                        });
                    } catch (error) {
                        logError('Errore nella preparazione immagine per AI', error);
                        alert('Errore nella preparazione dell\'immagine. Riprova.');
                        return;
                    }
                }
                
                if (!imageToSend) {
                    logError('Nessuna immagine disponibile per l\'invio');
                    alert('Carica prima un\'immagine');
                    return;
                }

                // Log dettagliato per debug - quale sorgente immagine è stata usata
                logDebug('🔍 Sorgente immagine per invio AI:', {
                    usaCroppedImage: !!croppedImageForAI,
                    usaOriginalSrc: (imageToSend === originalImageSrc),
                    usaPhotoPreviewFallback: (!croppedImageForAI && imageToSend !== originalImageSrc),
                    imageDataSize: imageToSend.length,
                    originalSrcSize: originalImageSrc ? originalImageSrc.length : 0,
                    imageStartsWith: imageToSend.substring(0, 50)
                });

                // Mostra overlay spinner a schermo intero
                const loadingOverlay = document.getElementById('ai-loading-overlay');
                if (loadingOverlay) {
                    loadingOverlay.classList.add('show');
                }
                
                // Disabilita il pulsante durante l'invio
                sendToAIBtn.disabled = true;
                
                logDebug('Invio immagine ad AI', { dataSize: imageToSend.length });

                // Invio dell'immagine all'AI con gestione ASINCRONA
                logDebug('Invio fetch a /review/async (ASYNC ENDPOINT)');
                
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 30000); // Timeout 30 secondi
                
                // Converti base64 a blob per FormData
                try {
                    // Verifica che imageToSend sia un data URL valido
                    if (!imageToSend.startsWith('data:')) {
                        throw new Error('Formato immagine non valido - non è un data URL');
                    }
                    
                    const base64Data = imageToSend.split(',')[1];
                    if (!base64Data) {
                        throw new Error('Dati base64 mancanti nell\'immagine');
                    }
                    
                    // Decodifica base64 con gestione errori
                    const byteCharacters = atob(base64Data);
                    const byteNumbers = new Array(byteCharacters.length);
                    for (let i = 0; i < byteCharacters.length; i++) {
                        byteNumbers[i] = byteCharacters.charCodeAt(i);
                    }
                    const byteArray = new Uint8Array(byteNumbers);
                    
                    // Determina il tipo MIME dall'header del data URL
                    const mimeMatch = imageToSend.match(/data:([^;]+)/);
                    const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
                    
                    const blob = new Blob([byteArray], { type: mimeType });
                    
                    logDebug('Blob creato', { 
                        size: blob.size, 
                        type: blob.type,
                        originalSize: imageToSend.length 
                    });
                
                    // Crea FormData per upload
                    const formData = new FormData();
                    formData.append('image', blob, 'image.jpg');
                    
                    // Debug: Log del contenuto FormData
                    logDebug('FormData creato', {
                        hasImage: formData.has('image'),
                        blobSize: blob.size,
                        blobType: blob.type
                    });
                    
                    // Log tutte le entries del FormData
                    for (let [key, value] of formData.entries()) {
                        logDebug('FormData entry', {
                            key: key,
                            valueType: typeof value,
                            isBlob: value instanceof Blob,
                            size: value instanceof Blob ? value.size : 'N/A'
                        });
                    }
                    
                    fetch('/review/async', {
                        method: 'POST',
                        body: formData, // Rimuovi Content-Type per permettere a browser di impostare multipart/form-data
                        signal: controller.signal
                    })
                .then(response => {
                    clearTimeout(timeoutId);

                    logDebug('Ricevuta risposta HTTP', {
                        status: response.status,
                        statusText: response.statusText,
                        ok: response.ok,
                        contentType: response.headers.get('content-type')
                    });

                    // Gestione specifica per rate limiting
                    if (response.status === 429) {
                        return response.text().then(text => {
                            try {
                                const data = JSON.parse(text);
                                throw new Error(`RATE_LIMIT_EXCEEDED: ${data.message || 'Troppe richieste'}`);
                            } catch (parseError) {
                                // Se non è JSON, usa il testo grezzo
                                throw new Error(`RATE_LIMIT_EXCEEDED: ${text || 'Troppe richieste'}`);
                            }
                        });
                    }

                    // Gestione redirect HTTP (302) - potrebbe indicare autenticazione richiesta
                    if (response.status === 302 || response.status === 301) {
                        logError('Ricevuto redirect HTTP dal server', {
                            status: response.status,
                            location: response.headers.get('location')
                        });
                        throw new Error('Sessione scaduta o autenticazione richiesta. Ricarica la pagina e riprova.');
                    }

                    // MODIFICA: Non lanciare errore per status 200, anche se response.ok è false in certi casi
                    if (response.status !== 200) {
                        return response.text().then(text => {
                            // 🍺 PRIMA prova a intercettare NO_BEER_DETECTED
                            // Questo DEVE essere fatto PRIMA di qualsiasi throw per evitare che venga catturato dal catch
                            let errorData = null;
                            let isValidJson = false;
                            
                            try {
                                errorData = JSON.parse(text);
                                isValidJson = true;
                            } catch (e) {
                                // JSON non valido - verrà gestito sotto
                                isValidJson = false;
                            }
                            
                            // 🍺 GESTIONE SPECIALE: Nessuna birra rilevata - NON è un errore tecnico!
                            // Mostra messaggio gentile invece di lanciare errore
                            if (isValidJson && errorData && errorData.errorType === 'NO_BEER_DETECTED') {
                                logDebug('Nessuna birra rilevata - mostra messaggio gentile');
                                // Nascondi overlay caricamento
                                const loadingOverlay = document.getElementById('ai-loading-overlay');
                                if (loadingOverlay) {
                                    loadingOverlay.classList.remove('show');
                                }
                                // Chiudi modal e mostra messaggio gentile
                                closeModal();
                                const friendlyMessage = errorData.message || '🔍 Non abbiamo trovato bottiglie di birra in questa immagine. Prova a scattare una foto più ravvicinata dell\'etichetta o scegli un\'altra immagine con birre ben visibili.';
                                showWarningMessage(friendlyMessage);
                                return null; // Termina il flusso SENZA errore
                            }
                            
                            // ⏳ GESTIONE SPECIALE: Servizio AI temporaneamente sovraccarico (503)
                            // Mostra messaggio informativo blu (non errore rosso) - utente può riprovare manualmente
                            if (isValidJson && errorData && errorData.errorType === 'AI_SERVICE_OVERLOADED') {
                                logDebug('Servizio AI sovraccarico - mostra messaggio informativo');
                                // Nascondi overlay caricamento
                                const loadingOverlay = document.getElementById('ai-loading-overlay');
                                if (loadingOverlay) {
                                    loadingOverlay.classList.remove('show');
                                }
                                // Chiudi modal e mostra messaggio informativo
                                closeModal();
                                const infoMessage = errorData.userMessage || '⏳ Il servizio di riconoscimento è temporaneamente sovraccarico. Riprova tra qualche secondo.';
                                showInfoMessage(infoMessage);
                                return null; // Termina il flusso SENZA errore tecnico
                            }
                            
                            // Per tutti gli altri errori, lancia l'eccezione appropriata
                            if (isValidJson && errorData) {
                                if (errorData.message) {
                                    throw new Error(errorData.message);
                                } else if (errorData.error) {
                                    throw new Error(errorData.error);
                                }
                            }
                            
                            // Fallback: testo grezzo o JSON senza messaggio
                            throw new Error(`Errore server: ${text.substring(0, 100)}`);
                        });
                    }

                    // Controlla se la risposta è JSON prima di parsarla
                    const contentType = response.headers.get('content-type');
                    if (contentType && contentType.includes('application/json')) {
                        return response.json();
                    } else {
                        // Se non è JSON, potrebbe essere HTML (redirect o errore)
                        return response.text().then(text => {
                            logError('Risposta non JSON ricevuta dal server', {
                                contentType,
                                textPreview: text.substring(0, 200) + (text.length > 200 ? '...' : ''),
                                isHtml: text.includes('<html') || text.includes('<!DOCTYPE')
                            });
                            
                            if (text.includes('<html') || text.includes('<!DOCTYPE')) {
                                // È una pagina HTML, probabilmente un errore o redirect
                                throw new Error('Risposta HTML ricevuta invece di JSON. Potrebbe essere necessario ricaricare la pagina.');
                            } else {
                                // Testo semplice, potrebbe essere un messaggio di errore
                                throw new Error(`Risposta non valida dal server: ${text.substring(0, 100)}`);
                            }
                        });
                    }
                })
                .then(data => {
                    // 🍺 Se data è null, significa che è stato gestito NO_BEER_DETECTED - termina qui
                    if (data === null) {
                        logDebug('Flusso terminato (NO_BEER_DETECTED gestito)');
                        return;
                    }
                    
                    logDebug('Risposta ASYNC endpoint ricevuta', data);
                    
                    if (data.error) {
                        logError('Errore presente nella risposta data.error', data.error);
                        throw new Error(data.error);
                    }
                    
                    // 🔍 DEBUG: Verifica struttura risposta
                    console.log('🔍 Struttura risposta completa:', {
                        hasReviewId: !!data.reviewId,
                        hasDataReviewId: !!data.data?.reviewId,
                        status: data.status,
                        dataStatus: data.data?.status,
                        fullData: data
                    });
                    
                    // Risposta asincrona: { reviewId, status, jobId, bottlesCount }
                    // 🎯 FIX: I dati possono essere sia in data diretto che in data.data (nested)
                    const reviewData = data.data || data; // Estrai i dati dal livello corretto
                    const reviewId = reviewData.reviewId || data.reviewId;
                    const status = reviewData.status || data.status;
                    const bottlesCount = reviewData.bottlesCount || data.bottlesCount;
                    
                    console.log('🔍 Dati estratti:', { reviewId, status, bottlesCount });
                    
                    if (reviewId && status === 'pending_validation') {
                        logDebug('Job creato - elaborazione in background', {
                            reviewId: reviewId,
                            jobId: reviewData.jobId,
                            bottlesCount: bottlesCount
                        });
                        
                        // Nascondi overlay caricamento iniziale
                        const loadingOverlay = document.getElementById('ai-loading-overlay');
                        if (loadingOverlay) {
                            loadingOverlay.classList.remove('show');
                        }
                        
                        // ✅ APRI MODAL RECENSIONI per permettere all'utente di compilare le valutazioni
                        // I dati sono già salvati sul DB con processingStatus='pending_validation'
                        // Il job asincrono continua in background per arricchimento
                        
                        // 🔍 Controlla se abbiamo i dati delle bottiglie dalla risposta
                        // bottles può essere al top level o in data.bottles
                        const bottlesData = data.bottles || reviewData.bottles;
                        
                        if (bottlesData && bottlesData.length > 0) {
                            logInfo(`📋 Apertura modal recensioni per ${bottlesData.length} birre`);
                            
                            // Apri modal con i dati estratti dall'AI
                            openReviewModalWithEmptyForms(bottlesData, imageDataUrl);
                            
                            // Mostra messaggio info che l'arricchimento continua in background
                            showAlert('info', `📸 Immagine analizzata! Compila le recensioni mentre completiamo i dati in background.`);
                        } else {
                            // Fallback: se non abbiamo i dati delle bottiglie, mostra errore
                            logWarn('⚠️ Risposta asincrona senza dati bottiglie', data);
                            closeModal();
                            showAlert('warning', 'Elaborazione avviata ma impossibile mostrare il form. Controlla il database per i risultati.');
                        }
                        
                        return; // Esce qui - elaborazione continua in background sul server
                    }
                    
                    // Fallback: se non è async response, gestisci come prima (backward compatible)
                    logWarn('Risposta NON asincrona - fallback al flusso vecchio', data);
                    
                    // 🎯 GESTIONE CENTRALIZZATA: Usa AIModule per tutte le risposte AI
                    const handleResult = window.AIModule.handleAIResponse(data, {
                        closeModal: closeModal,
                        showWarningMessage: showWarningMessage,
                        hideLoadingOverlay: () => {
                            const loadingOverlay = document.getElementById('ai-loading-overlay');
                            if (loadingOverlay) {
                                loadingOverlay.classList.remove('show');
                                logDebug('Overlay spinner nascosto tramite AIModule');
                            }
                        }
                    });

                    // Se la risposta è stata gestita centralmente, esci
                    if (handleResult.handled) {
                        logDebug('Risposta AI gestita centralmente da AIModule:', handleResult.action);
                        return; // IMPORTANTE: esce qui senza processare altri dati
                    }

                    // Altrimenti continua con flusso normale per successo
                    logDebug('AIModule indica di continuare con flusso normale:', handleResult.action);
                    
                    // Se l'analisi è andata a buon fine, procedi con la recensione
                    if (data.success && data.bottles && data.bottles.length > 0) {
                        logDebug('AI ha riconosciuto birre, procedendo con recensione', {
                            bottlesCount: data.bottles.length,
                            bottles: data.bottles
                        });
                        
                        // Chiudi il modal mantenendo i dati sessione per il processo recensione
                        closeModal({ preserveSessionData: true });
                        
                        // Procedi con la funzionalità di recensione
                        startReviewProcess(data);
                        
                        return; // Importante: esce qui senza mostrare alert
                    } else {
                        // Caso generico: successo ma nessuna bottiglia trovata (diverso da NO_BEER_DETECTED)
                        alert('Analisi completata ma nessuna bottiglia riconosciuta.');
                    }
                })
                .catch(error => {
                    clearTimeout(timeoutId);
                    logError('Errore nella gestione dell\'upload', error);
                    
                    // 🍺 GESTIONE SPECIALE: Nessuna birra rilevata - messaggio gentile, non è un errore!
                    if (error.message.includes('NO_BEER_DETECTED') || error.message.includes('Nessuna birra rilevata')) {
                        logDebug('Nessuna birra rilevata nell\'immagine - mostra messaggio gentile');
                        
                        // Chiudi eventuali modal aperti
                        closeModal();
                        
                        // Mostra messaggio gentile con showWarningMessage invece di alert
                        showWarningMessage('🔍 Non abbiamo trovato bottiglie di birra in questa immagine. Prova a scattare una foto più ravvicinata dell\'etichetta o scegli un\'altra immagine con birre ben visibili.');
                        return; // Esce senza mostrare alert
                    }
                    
                    // Messaggio generico user-friendly senza riferimenti tecnici
                    let errorMessage = 'Siamo spiacenti, si è verificato un problema durante l\'elaborazione. Riprova tra qualche istante.';
                    
                    // Personalizza il messaggio in base al tipo di errore (senza dettagli tecnici)
                    if (error.name === 'AbortError') {
                        errorMessage = 'L\'elaborazione sta richiedendo più tempo del previsto. Riprova tra qualche minuto.';
                    } else if (error.message.includes('RATE_LIMIT_EXCEEDED')) {
                        // Estrai il messaggio specifico dal server
                        const rateLimitMessage = error.message.replace('RATE_LIMIT_EXCEEDED: ', '');
                        errorMessage = rateLimitMessage + '\n\nSuggerimento: Registrati per avere più analisi disponibili!';
                    } else if (error.message.includes('HTTP 413')) {
                        errorMessage = 'Immagine troppo grande. Prova a ridimensionarla o scegli un\'immagine più piccola.';
                    } else if (error.message.includes('HTTP 429')) {
                        errorMessage = 'Troppe richieste. Attendi un momento prima di riprovare.';
                    } else if (error.message.includes('Sessione scaduta')) {
                        errorMessage = 'La sessione è scaduta. Ricarica la pagina e riprova.';
                    } else if (error.message.includes('Risposta HTML ricevuta')) {
                        errorMessage = 'Si è verificato un problema tecnico. Ricarica la pagina e riprova.';
                    } else if (error.message.includes('Risposta non valida dal server')) {
                        errorMessage = 'Problema di comunicazione con il server. Riprova più tardi.';
                    } else if (error.message.includes('Failed to fetch')) {
                        errorMessage = 'Problema di connessione. Controlla la tua connessione internet e riprova.';
                    } else if (error.message.includes('JSON.parse')) {
                        errorMessage = 'Problema di comunicazione. Riprova tra qualche istante.';
                    }
                    
                    // Usa showWarningMessage invece di alert per un messaggio più gentile
                    showWarningMessage(errorMessage);
                })
                .finally(() => {
                    // Nasconde overlay spinner
                    const loadingOverlay = document.getElementById('ai-loading-overlay');
                    if (loadingOverlay) {
                        loadingOverlay.classList.remove('show');
                    }
                    
                    // Ripristina il pulsante
                    sendToAIBtn.disabled = false;
                    logDebug('Invio AI completato, spinner nascosto');
                });
                
                } catch (conversionError) {
                    // Gestione errori nella conversione dell'immagine
                    clearTimeout(timeoutId);
                    logError('Errore nella conversione dell\'immagine', conversionError);
                    
                    // Nascondi overlay spinner
                    const loadingOverlay = document.getElementById('ai-loading-overlay');
                    if (loadingOverlay) {
                        loadingOverlay.classList.remove('show');
                    }
                    
                    // Ripristina il pulsante
                    sendToAIBtn.disabled = false;
                    
                    alert('Errore nella preparazione dell\'immagine. Riprova con un\'immagine diversa.');
                }
            });
        }
    }
});

/**
 * Apre il modal review con form per le birre analizzate dall'AI
 * @param {Array|number} bottlesDataOrCount - Array di bottiglie con dati AI OPPURE numero di bottiglie (legacy)
 * @param {string} thumbnailImage - Data URL dell'immagine thumbnail reale
 */
function openReviewModalWithEmptyForms(bottlesDataOrCount, thumbnailImage) {
    // Gestisce sia array di bottiglie (con dati AI) che numero (legacy)
    const isArrayData = Array.isArray(bottlesDataOrCount);
    const bottlesCount = isArrayData ? bottlesDataOrCount.length : bottlesDataOrCount;
    
    logDebug('Apertura modal review con form', { 
        isArrayData,
        bottlesCount, 
        thumbnailImage: thumbnailImage ? 'presente (' + thumbnailImage.substring(0, 50) + '...)' : 'mancante'
    });
    
    if (!bottlesCount || bottlesCount <= 0) {
        logError('Nessuna bottiglia da recensire');
        return;
    }
    
    // Crea array di bottiglie con dati AI se disponibili, altrimenti generici
    const emptyBottles = [];
    for (let i = 0; i < bottlesCount; i++) {
        if (isArrayData && bottlesDataOrCount[i]) {
            // USA I DATI AI REALI
            const aiData = bottlesDataOrCount[i];
            emptyBottles.push({
                beerName: aiData.beerName || `Birra ${i + 1}`,
                breweryName: aiData.breweryName || '',
                alcoholContent: aiData.alcoholContent || '',
                volume: aiData.volume || '',
                beerStyle: aiData.beerStyle || aiData.beerType || '',
                thumbnail: aiData.thumbnail || thumbnailImage || '/images/default-beer.svg',
                dataSource: aiData.dataSource || 'ai_analysis',
                confidence: aiData.confidence || 0
            });
        } else {
            // Fallback generico (legacy)
            emptyBottles.push({
                beerName: `Birra ${i + 1}`,
                thumbnail: thumbnailImage || '/images/default-beer.svg',
            });
        }
    }
    
    logDebug('Bottiglie preparate per il modal', emptyBottles.map(b => b.beerName));
    
    // Apre il modal con le bottiglie
    if (typeof window.openReviewModal === 'function') {
        window.openReviewModal(emptyBottles);
        
        // Mostra messaggio di progresso nel modal
        showReviewProgressMessage('Analisi dell\'immagine in corso... I dettagli delle birre verranno popolati automaticamente.');
        
        logDebug('Modal review aperto con dati AI per async processing');
    } else {
        logError('Funzione window.openReviewModal non disponibile');
        alert('Errore tecnico: sistema di recensioni non disponibile. Ricarica la pagina.');
    }
}

/**
 * Mostra messaggio di progresso nel modal review
 * @param {string} message - Messaggio da mostrare
 */
function showReviewProgressMessage(message) {
    // Usa la funzione showModalNotification del modal review se disponibile
    if (typeof window.reviewModalState !== 'undefined' && 
        typeof window.showModalNotification === 'function') {
        window.showModalNotification(message, 'info');
    } else {
        // Fallback: cerca il modal e mostra notifica
        const modalBody = document.getElementById('reviewModalBody');
        if (modalBody) {
            // Rimuovi notifiche esistenti
            const existingNotifications = modalBody.querySelectorAll('.modal-notification');
            existingNotifications.forEach(n => n.remove());
            
            // Crea nuova notifica
            const notification = document.createElement('div');
            notification.className = 'modal-notification modal-notification-info';
            notification.innerHTML = `
                <span class="modal-notification-icon">ℹ️</span>
                <span class="modal-notification-message">${message}</span>
            `;
            
            modalBody.insertBefore(notification, modalBody.firstChild);
            
            // Auto-dismiss dopo 10 secondi
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.remove();
                }
            }, 10000);
        }
    }
}

/**
 * Popola il modal review con i dati ricevuti dall'AI dopo il completamento del job asincrono
 * @param {Array} bottles - Array di bottiglie con dati completi dall'AI
 */
function populateReviewModalWithAIData(bottles) {
    console.log('🔄 Popolamento modal con dati AI:', bottles);
    console.log('🔍 Struttura prima bottiglia:', bottles[0] ? JSON.stringify(bottles[0], null, 2) : 'N/A');
    
    if (!bottles || bottles.length === 0) {
        console.error('❌ Nessun dato bottiglia da popolare');
        return;
    }
    
    // Aggiorna window.reviewModalState.bottles con i dati reali
    if (window.reviewModalState && window.reviewModalState.bottles) {
        console.log('✅ Aggiornamento window.reviewModalState.bottles');
        console.log('🔍 Stato PRIMA aggiornamento:', JSON.stringify(window.reviewModalState.bottles[0], null, 2));
        
        // Sostituisci i dati generici con quelli reali
        bottles.forEach((bottle, index) => {
            if (window.reviewModalState.bottles[index]) {
                // Mantieni i rating già inseriti dall'utente
                const existingRatings = window.reviewModalState.ratings[index] || {};
                
                // Aggiorna i dati della bottiglia
                window.reviewModalState.bottles[index] = {
                    ...window.reviewModalState.bottles[index],
                    ...bottle,
                    // Preserva campi importanti per il salvataggio
                    beerName: bottle.beerName || bottle.bottleLabel || `Birra ${index + 1}`,
                    breweryName: bottle.breweryName || 'Sconosciuto',
                    thumbnail: bottle.thumbnail || bottle.imageDataUrl || '/images/default-beer.svg',
                    aiData: bottle.aiData || bottle,
                    breweryId: bottle.breweryId,
                    beerId: bottle.beerId
                };
                
                console.log(`✅ Bottiglia ${index} aggiornata:`, {
                    beerName: window.reviewModalState.bottles[index].beerName,
                    breweryName: window.reviewModalState.bottles[index].breweryName,
                    hasAiData: !!window.reviewModalState.bottles[index].aiData,
                    breweryId: window.reviewModalState.bottles[index].breweryId,
                    beerId: window.reviewModalState.bottles[index].beerId
                });
            }
        });
        
        console.log('🔍 Stato DOPO aggiornamento:', JSON.stringify(window.reviewModalState.bottles[0], null, 2));
        
        // Aggiorna anche window.currentReviewData per compatibilità
        if (window.currentReviewData) {
            window.currentReviewData.bottles = window.reviewModalState.bottles;
        }
        
        // 🔧 FIX: Assicurati che window.currentReviewData sia completamente impostato
        window.currentReviewData = {
            bottles: window.reviewModalState.bottles,
            brewery: bottles[0]?.breweryName || 'Birrificio Sconosciuto',
            breweryId: bottles[0]?.breweryId,
            beerIds: bottles.map(b => b.beerId).filter(id => id),
            analysisId: 'populated_from_modal_' + Date.now(),
            timestamp: new Date().toISOString()
        };
        
        console.log('💾 DEBUG: window.currentReviewData impostato completamente:', {
            bottles: window.currentReviewData.bottles.length,
            brewery: window.currentReviewData.brewery,
            breweryId: window.currentReviewData.breweryId,
            beerIds: window.currentReviewData.beerIds.length,
            analysisId: window.currentReviewData.analysisId
        });
        
        // Aggiorna le etichette visibili nel modal (nomi birre/birrifici)
        bottles.forEach((bottle, index) => {
            const beerNameElement = document.querySelector(`[data-bottle-index="${index}"] .bottle-name`);
            if (beerNameElement) {
                beerNameElement.textContent = bottle.beerName || bottle.bottleLabel || `Birra ${index + 1}`;
            }
            
            const breweryNameElement = document.querySelector(`[data-bottle-index="${index}"] .brewery-name`);
            if (breweryNameElement) {
                breweryNameElement.textContent = bottle.breweryName || '';
            }
            
            const thumbnailElement = document.querySelector(`[data-bottle-index="${index}"] .beer-thumbnail`);
            if (thumbnailElement) {
                thumbnailElement.src = bottle.thumbnail || bottle.imageDataUrl || '/images/default-beer.svg';
            }
        });
        
        console.log('✅ Modal popolato con successo con dati AI');
    } else {
        console.error('❌ window.reviewModalState non disponibile');
    }
}

document.addEventListener('DOMContentLoaded', function () {
    // Listener per la selezione del ruolo nella creazione utente
    const roleSelect = document.getElementById('role');
    const customerDetails = document.getElementById('customerDetails');
    const administratorDetails = document.getElementById('administratorDetails');
    const breweryDetails = document.getElementById('breweryDetails');
    if (roleSelect && customerDetails && administratorDetails && breweryDetails) {
        roleSelect.addEventListener('change', function () {
            const selectedRole = roleSelect.value;
            customerDetails.style.display = 'none';
            administratorDetails.style.display = 'none';
            breweryDetails.style.display = 'none';
            if (selectedRole === 'customer') {
                customerDetails.style.display = 'block';
            } else if (selectedRole === 'administrator') {
                administratorDetails.style.display = 'block';
            } else if (selectedRole === 'brewery') {
                breweryDetails.style.display = 'block';
            }
        });
    }

    // Gestione popup disclaimer maggiore età
    const disclaimerModal = document.getElementById('disclaimer-modal');
    const acceptDisclaimerBtn = document.getElementById('accept-disclaimer');
    if (disclaimerModal && acceptDisclaimerBtn) {
        disclaimerModal.style.display = 'block';
        acceptDisclaimerBtn.addEventListener('click', function () {
            // Disabilita il pulsante per evitare click multipli
            acceptDisclaimerBtn.disabled = true;
            acceptDisclaimerBtn.textContent = 'Elaborazione...';
            
            fetch('/disclaimer', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ accepted: true })
            })
            .then(response => {
                if (response.ok) {
                    return response.json();
                } else {
                    throw new Error('Errore nella risposta del server');
                }
            })
            .then(data => {
                if (data.success) {
                    disclaimerModal.style.display = 'none';
                    // Non ricarica la pagina, nasconde semplicemente il popup
                } else {
                    throw new Error(data.error || 'Errore durante accettazione disclaimer');
                }
            })
            .catch(error => {
                console.error('Errore accettazione disclaimer:', error);
                alert('Errore durante l\'accettazione del disclaimer. Riprova.');
                
                // Riabilita il pulsante
                acceptDisclaimerBtn.disabled = false;
                acceptDisclaimerBtn.textContent = 'Accetto';
            });
        });
    }

    // Gestione mostra/nascondi password e login
    const togglePassword = document.getElementById('togglePassword');
    const passwordInput = document.getElementById('password');
    const loginButton = document.getElementById('loginButton');
    const loginForm = document.getElementById('loginForm');
    function submitForm() {
        if (loginForm) loginForm.submit();
    }
    if (loginButton && loginForm) {
        loginButton.addEventListener('click', function (event) {
            event.preventDefault();
            submitForm();
        });
    }
    if (passwordInput && loginForm) {
        passwordInput.addEventListener('keydown', function (event) {
            if (event.key === 'Enter') {
                event.preventDefault();
                submitForm();
            }
        });
    }
    if (togglePassword && passwordInput) {
        togglePassword.addEventListener('click', () => {
            const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
            passwordInput.setAttribute('type', type);
            
            // Toggle SVG icons (non usare più img src)
            const eyeOpen = togglePassword.querySelector('.eye-open');
            const eyeClosed = togglePassword.querySelector('.eye-closed');
            
            if (eyeOpen && eyeClosed) {
                if (type === 'password') {
                    // Password nascosta → mostra occhio aperto
                    eyeOpen.style.display = 'block';
                    eyeClosed.style.display = 'none';
                } else {
                    // Password visibile → mostra occhio barrato
                    eyeOpen.style.display = 'none';
                    eyeClosed.style.display = 'block';
                }
            }
        });
    }

    // Gestione sandwich menu con reinizializzazione
    const toggle = document.getElementById('sandwich-menu-toggle');
    const menu = document.getElementById('sandwich-menu-content');
    if (toggle && menu) {
        toggle.addEventListener('click', function (e) {
            e.stopPropagation();
            menu.style.display = (menu.style.display === 'none' || menu.style.display === '') ? 'block' : 'none';
        });
        document.addEventListener('click', function (e) {
            if (!menu.contains(e.target) && e.target !== toggle) {
                menu.style.display = 'none';
            }
        });
        
        // Aggiungi listener ai link del menu per pulizia dati AI
        const menuLinks = menu.querySelectorAll('a');
        menuLinks.forEach(link => {
            link.addEventListener('click', function() {
                logDebug('Click su link menu, pulizia dati AI');
                
                // Pulisci i dati AI dalla sessione prima della navigazione
                clearPreviousSessionData().then(() => {
                    logDebug('Dati AI puliti per navigazione menu');
                }).catch(error => {
                    logError('Errore pulizia dati AI per navigazione:', error);
                });
                
                // RIMOSSO: La reinizializzazione sarà gestita dal DOMContentLoaded della nuova pagina
            });
        });
    }

    // NOTA: La gestione cancellazione utente è stata spostata in updateUser.js
    // per utilizzare il modal Bootstrap invece del confirm() nativo

    // Gestione cambio ruolo attivo (CSP safe)
    const changeRoleForm = document.getElementById('changeRoleForm');
    const activeRoleSelect = document.getElementById('activeRole');
    if (changeRoleForm && activeRoleSelect) {
        activeRoleSelect.addEventListener('change', function () {
            changeRoleForm.submit();
        });
    }
    
    // Gestione dropdown role selector per menu utente
    const dropdownRoleSelector = document.getElementById('dropdown-role-selector');
    if (dropdownRoleSelector) {
        dropdownRoleSelector.addEventListener('change', function() {
            changeRole(this.value);
        });
    }
    
    // Gestione default role selector per menu utente
    const dropdownDefaultRole = document.getElementById('dropdown-default-role');
    if (dropdownDefaultRole) {
        dropdownDefaultRole.addEventListener('change', function() {
            changeDefaultRole(this.value);
        });
    }
});

window.onerror = function (message, source, lineno, colno, error) {
    console.error('Errore JavaScript:', message, source, lineno, colno, error);
};

function validatePasswordMatch() {
    var pwd = document.getElementById('password') ? document.getElementById('password').value : '';
    var conf = document.getElementById('confirmPassword') ? document.getElementById('confirmPassword').value : '';
    var error = document.getElementById('passwordError');
    if (pwd !== conf) {
        if (error) error.style.display = 'inline';
        return false;
    }
    if (error) error.style.display = 'none';
    return true;
}

    // --- Gestione thumbnail delle birre ---

    /**
     * Genera un thumbnail dell'immagine per una specifica birra
     */
    function generateThumbnail(bottle, index) {
        // Usa l'immagine croppata se disponibile, altrimenti quella originale
        const photoPreviewElement = document.getElementById('photoPreview');
        let sourceImage = croppedImageForAI ? 
            croppedImageForAI : // croppedImageForAI è già un data URL completo
            (originalImageSrc || photoPreviewElement?.src);
        
        if (!sourceImage) {
            logDebug('Nessuna immagine disponibile per thumbnail, uso placeholder');
            return 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAiIGhlaWdodD0iODAiIHZpZXdCb3g9IjAgMCA4MCA4MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjgwIiBoZWlnaHQ9IjgwIiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik0yOCAzNkw0MCA0OEw1MiAzNkw2MCA0NEw2MCA2MEwyMCA2MEwyMCA0NEwyOCAzNloiIGZpbGw9IiM5Q0EzQUYiLz4KPGNpcmNsZSBjeD0iMzQiIGN5PSIzMCIgcj0iNCIgZmlsbD0iIzlDQTNBRiIvPgo8L3N2Zz4K';
        }
        
        try {
            // Crea un canvas per generare il thumbnail
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const thumbnailSize = 80; // 80x80 pixel
            
            canvas.width = thumbnailSize;
            canvas.height = thumbnailSize;
            
            // Crea un'immagine temporanea per il ridimensionamento
            const img = new Image();
            img.onload = function() {
                // Calcola le dimensioni per mantenere l'aspect ratio
                const aspectRatio = img.width / img.height;
                let drawWidth, drawHeight, offsetX = 0, offsetY = 0;
                
                if (aspectRatio > 1) {
                    // Immagine orizzontale
                    drawHeight = thumbnailSize;
                    drawWidth = thumbnailSize * aspectRatio;
                    offsetX = -(drawWidth - thumbnailSize) / 2;
                } else {
                    // Immagine verticale o quadrata
                    drawWidth = thumbnailSize;
                    drawHeight = thumbnailSize / aspectRatio;
                    offsetY = -(drawHeight - thumbnailSize) / 2;
                }
                
                // Sfondo grigio chiaro
                ctx.fillStyle = '#f8f9fa';
                ctx.fillRect(0, 0, thumbnailSize, thumbnailSize);
                
                // Disegna l'immagine ridimensionata
                ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);
                
                // Bordo sottile
                ctx.strokeStyle = '#dee2e6';
                ctx.lineWidth = 1;
                ctx.strokeRect(0, 0, thumbnailSize, thumbnailSize);
                
                // Aggiorna il src dell'immagine nel DOM
                const thumbnailImg = document.querySelector(`[data-bottle-index="${index}"] .beer-thumbnail`);
                if (thumbnailImg) {
                    thumbnailImg.src = canvas.toDataURL('image/jpeg', 0.8);
                    logDebug(`Thumbnail aggiornato per birra ${index}`, {
                        originalSize: { width: img.width, height: img.height },
                        thumbnailSize: { width: thumbnailSize, height: thumbnailSize }
                    });
                } else {
                    logDebug(`Elemento thumbnail non trovato per birra ${index} - cercando: [data-bottle-index="${index}"] .beer-thumbnail`);
                }
            };
            
            img.onerror = function() {
                logError(`Errore nel caricamento immagine per thumbnail birra ${index}`);
            };
            
            img.src = sourceImage;
            
            // Ritorna un placeholder temporaneo mentre si carica
            return 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAiIGhlaWdodD0iODAiIHZpZXdCb3g9IjAgMCA4MCA4MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjgwIiBoZWlnaHQ9IjgwIiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik0yOCAzNkw0MCA0OEw1MiAzNkw2MCA0NEw2MCA2MEwyMCA2MEwyMCA0NEwyOCAzNloiIGZpbGw9IiM5Q0EzQUYiLz4KPGNpcmNsZSBjeD0iMzQiIGN5PSIzMCIgcj0iNCIgZmlsbD0iIzlDQTNBRiIvPgo8L3N2Zz4K';
            
        } catch (error) {
            logError('Errore nella generazione del thumbnail', error);
            return 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAiIGhlaWdodD0iODAiIHZpZXdCb3g9IjAgMCA4MCA4MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjgwIiBoZWlnaHQ9IjgwIiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik0yOCAzNkw0MCA0OEw1MiAzNkw2MCA0NEw2MCA2MEwyMCA2MEwyMCA0NEwyOCAzNloiIGZpbGw9IiM5Q0EzQUYiLz4KPGNpcmNsZSBjeD0iMzQiIGN5PSIzMCIgcj0iNCIgZmlsbD0iIzlDQTNBRiIvPgo8L3N2Zz4K';
        }
    }

    // --- Gestione persistenza dati AI in sessione ---

    /**
     * Controlla se ci sono dati AI in sessione e li ripristina
     */
    async function checkForSessionData() {
    try {
        console.log('[checkForSessionData] Controllo dati AI in sessione');
        
        const response = await fetch('/review/ai-session-data');
        const result = await response.json();
        
        if (result.hasData && result.data) {
            // Controlla se i dati sono troppo vecchi (più di 1 ora)
            const sessionTimestamp = new Date(result.timestamp);
            const now = new Date();
            const maxAge = 60 * 60 * 1000; // 1 ora in millisecondi
            const isExpired = (now - sessionTimestamp) > maxAge;
            
            console.log('[checkForSessionData] Dati AI trovati in sessione', {
                bottlesCount: result.data.bottles?.length || 0,
                timestamp: result.timestamp,
                age: Math.round((now - sessionTimestamp) / 60000) + ' minuti',
                needsDisambiguation: result.data.needsDisambiguation || false,
                isExpired: isExpired
            });
            
            // CRITICO: Se ci sono dati di disambiguazione attivi, blocca la pulizia automatica
            if (result.data.needsDisambiguation) {
                isDisambiguationActive = true;
                console.log('[checkForSessionData] Disambiguazione attiva - pulizia automatica disabilitata');
            }
            
            if (isExpired) {
                console.log('[checkForSessionData] Dati sessione scaduti, pulizia automatica');
                // Pulisci i dati scaduti
                try {
                    await fetch('/review/clear-session-data', { method: 'POST' });
                    console.log('[checkForSessionData] Dati sessione scaduti rimossi');
                } catch (cleanupError) {
                    console.error('[checkForSessionData] Errore nella pulizia dati scaduti:', cleanupError);
                }
                // Non ripristinare l'interfaccia, mantieni il pulsante principale visibile
                return;
            }
            
            // Ripristina l'interfaccia con i dati AI (solo se non scaduti)
            restoreInterfaceFromSessionData(result.data);
        } else {
            console.log('[checkForSessionData] Nessun dato AI in sessione');
        }
    } catch (error) {
        console.error('[checkForSessionData] Errore nel controllo dati sessione:', error);
    }
}

/**
 * Ripristina l'interfaccia delle recensioni con i dati AI dalla sessione
 */
function restoreInterfaceFromSessionData(aiData) {
    console.log('[restoreInterfaceFromSessionData] Ripristino interfaccia con dati AI');
    
    try {
        // Solo se ci sono birre valide da recensire, nascondi il bottone principale
        if (aiData.bottles && aiData.bottles.length > 0) {
            console.log('[restoreInterfaceFromSessionData] Birre trovate, nascondo pulsante principale e mostro interfaccia recensione');
            
            // Nascondi il bottone principale e mostra l'interfaccia di recensione
            const startReviewBtn = document.getElementById('start-review-process');
            if (startReviewBtn) {
                startReviewBtn.style.display = 'none';
            }
            
            // Mostra il contenitore del processo di recensione
            const reviewProcess = document.getElementById('review-process');
            if (reviewProcess) {
                reviewProcess.style.display = 'block';
                console.log('[restoreInterfaceFromSessionData] Contenitore review-process mostrato');
            }
            
            // Mostra l'interfaccia di recensione
            const reviewForm = document.getElementById('review-form');
            if (reviewForm) {
                reviewForm.style.display = 'block';
            }
            
            // Mostra il pulsante ricomincia quando ci sono dati in sessione
            const restartReviewBtn = document.getElementById('restart-review');
            if (restartReviewBtn) {
                restartReviewBtn.style.display = 'inline-flex';
                console.log('[restoreInterfaceFromSessionData] Pulsante ricomincia mostrato');
            } else {
                console.log('[restoreInterfaceFromSessionData] ATTENZIONE: Pulsante ricomincia non trovato nel DOM');
            }
            
            // Mostra le birre rilevate
            displayBeersFromSession(aiData);
            
        } else {
            console.log('[restoreInterfaceFromSessionData] Nessuna birra valida trovata, mantengo pulsante principale visibile');
            
            // Mantieni il pulsante principale visibile
            const startReviewBtn = document.getElementById('start-review-process');
            if (startReviewBtn) {
                startReviewBtn.style.display = 'inline-flex';
            }
            
            // Se è esplicitamente "NO_BEER_DETECTED", mostra un warning
            if (aiData.errorType === 'NO_BEER_DETECTED') {
                showWarningMessage('L\'AI non ha rilevato bottiglie di birra nell\'ultima immagine analizzata. Carica una nuova immagine per procedere.');
            }
        }
        
        console.log('[restoreInterfaceFromSessionData] Interfaccia ripristinata con successo');
        
    } catch (error) {
        console.error('[restoreInterfaceFromSessionData] Errore nel ripristino interfaccia:', error);
        
        // In caso di errore, assicurati che il pulsante sia visibile
        const startReviewBtn = document.getElementById('start-review-process');
        if (startReviewBtn) {
            startReviewBtn.style.display = 'inline-flex';
        }
    }
}

/**
 * Mostra le birre dai dati di sessione
 */
function displayBeersFromSession(aiData) {
    const beerList = document.getElementById('beerList');
    if (!beerList) return;
    
    console.log('[displayBeersFromSession] Visualizzazione birre da sessione');
    
    beerList.innerHTML = '';
    
    if (aiData.bottles && aiData.bottles.length > 0) {
        aiData.bottles.forEach((beer, index) => {
            const beerItem = createBeerReviewItem(beer, index, aiData.brewery);
            beerList.appendChild(beerItem);
        });
        
        beerList.style.display = 'block';
        
        // Mostra messaggio di successo
        showAlert('success', `Perfetto! Abbiamo rilevato ${aiData.bottles.length} birra/e. Compila le recensioni e pubblica!`);
    }
}

/**
 * Pulisce i dati AI dalla sessione quando l'utente naviga via
 */
function clearSessionDataOnNavigation() {
    // Pulisci quando l'utente naviga via (beforeunload)
    window.addEventListener('beforeunload', function() {
        // Solo se l'utente sta navigando via dalla pagina di review
        if (window.location.pathname.includes('/review')) {
            // sendBeacon usa sempre POST, quindi usa la route dedicata
            navigator.sendBeacon('/review/clear-session-data', JSON.stringify({}));
        }
    });
}

/**
 * Pulisce i dati AI precedenti dalla sessione (chiamata manuale)
 * Usa SessionCleanupManager quando disponibile
 */
async function clearPreviousSessionData() {
    try {
        console.log('[clearPreviousSessionData] Pulizia dati AI precedenti dalla sessione');
        
        // Usa SessionCleanupManager se disponibile
        if (window.sessionCleanupManager) {
            return await window.sessionCleanupManager.cleanupManual('clearPreviousSessionData chiamata');
        }
        
        // Fallback al sistema tradizionale
        // Prova prima con sendBeacon se disponibile (più affidabile durante navigazione)
        if (navigator.sendBeacon) {
            try {
                const success = navigator.sendBeacon('/review/clear-session-data', JSON.stringify({}));
                if (success) {
                    console.log('[clearPreviousSessionData] Dati AI precedenti puliti con sendBeacon (fallback)');
                    return;
                } else {
                    console.log('[clearPreviousSessionData] sendBeacon fallito, fallback a fetch');
                }
            } catch (beaconError) {
                console.log('[clearPreviousSessionData] sendBeacon non disponibile, fallback a fetch');
            }
        }
        
        // Fallback con fetch normale (solo se sendBeacon non disponibile o fallito)
        const response = await fetch('/review/ai-session-data', {
            method: 'DELETE'
        });
        
        if (response.ok) {
            console.log('[clearPreviousSessionData] Dati AI precedenti puliti con fetch (fallback)');
        }
    } catch (error) {
        console.error('[clearPreviousSessionData] Errore nella pulizia dati precedenti:', error);
    }
}

/**
 * Pulizia preventiva di dati sessione molto vecchi all'avvio dell'applicazione
 */
async function cleanupOldSessionData() {
    try {
        console.log('[cleanupOldSessionData] Controllo pulizia dati sessione vecchi');
        
        const response = await fetch('/review/ai-session-data');
        if (!response.ok) {
            return; // Nessun dato o errore di connessione
        }
        
        const result = await response.json();
        
        if (result.hasData && result.timestamp) {
            const sessionTimestamp = new Date(result.timestamp);
            const now = new Date();
            const maxAge = 60 * 60 * 1000; // 1 ora in millisecondi
            const isVeryOld = (now - sessionTimestamp) > maxAge;
            
            if (isVeryOld) {
                console.log('[cleanupOldSessionData] Rilevati dati sessione molto vecchi, pulizia automatica', {
                    timestamp: result.timestamp,
                    age: Math.round((now - sessionTimestamp) / 60000) + ' minuti'
                });
                
                // Pulisci i dati molto vecchi
                const cleanupResponse = await fetch('/review/clear-session-data', { method: 'POST' });
                
                if (cleanupResponse.ok) {
                    console.log('[cleanupOldSessionData] Dati sessione vecchi rimossi con successo');
                } else {
                    console.error('[cleanupOldSessionData] Errore nella pulizia:', cleanupResponse.status);
                }
            } else {
                console.log('[cleanupOldSessionData] Dati sessione ancora validi, nessuna pulizia necessaria');
            }
        } else {
            console.log('[cleanupOldSessionData] Nessun dato sessione da pulire');
        }
    } catch (error) {
        console.error('[cleanupOldSessionData] Errore nella pulizia preventiva:', error);
    }
}

/**
 * Aggiunge listener globali per pulire i dati AI su navigazione usando SessionCleanupManager
 */
function addGlobalNavigationListeners() {
    // Assicurati che il SessionCleanupManager sia disponibile
    if (!window.sessionCleanupManager) {
        console.error('[Navigation] SessionCleanupManager non disponibile');
        return;
    }

    // Listener per tutti i link della pagina (eccetto quelli del modal)
    document.addEventListener('click', function(e) {
        const clickedElement = e.target;
        
        // Se è un link (a, button che naviga, o elemento con data-href)
        const isNavigationElement = 
            clickedElement.tagName === 'A' ||
            (clickedElement.tagName === 'BUTTON' && clickedElement.type === 'submit') ||
            clickedElement.hasAttribute('data-href') ||
            clickedElement.closest('form') ||
            (clickedElement.tagName === 'BUTTON' && clickedElement.onclick);
        
        // Escludi elementi del modal e del sistema di recensione
        const isModalElement = 
            clickedElement.closest('#photo-modal') ||
            clickedElement.closest('#review-process') ||
            clickedElement.id === 'start-review-process' ||
            clickedElement.classList.contains('star') ||
            clickedElement.classList.contains('btn-sb');
        
        if (isNavigationElement && !isModalElement) {
            const targetUrl = clickedElement.href || clickedElement.action || 'unknown';
            
            logDebug('Navigazione rilevata - controllo se necessaria pulizia', {
                element: clickedElement.tagName,
                id: clickedElement.id,
                targetUrl: targetUrl,
                isProcessActive: window.sessionCleanupManager.isProcessActive(),
                isDisambiguationActive: window.sessionCleanupManager.isDisambiguationInProgress()
            });
            
            // Usa SessionCleanupManager per gestire la pulizia intelligente
            if (window.sessionCleanupManager.isProcessActive()) {
                // Se navigazione verso pagina diversa da review, pulisci
                if (!targetUrl.includes('/review')) {
                    console.log('[Navigation] Navigazione fuori da review - pulizia sessione');
                    window.sessionCleanupManager.cleanupOnNavigation(targetUrl);
                } else {
                    console.log('[Navigation] Navigazione interna review - mantieni sessione');
                }
            }
        }
    });
    
    // Listener per cambio ruolo (se presente form di cambio ruolo)
    const roleChangeForm = document.querySelector('form[action*="profile"]');
    if (roleChangeForm) {
        roleChangeForm.addEventListener('submit', function(e) {
            console.log('[Navigation] Cambio ruolo rilevato - pulizia sessione');
            window.sessionCleanupManager.cleanupOnRoleChange('current', 'new');
        });
    }

    // Listener per logout
    const logoutLinks = document.querySelectorAll('a[href*="logout"], button[onclick*="logout"]');
    logoutLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            console.log('[Navigation] Logout rilevato - pulizia sessione');
            window.sessionCleanupManager.cleanupOnLogout();
        });
    });
    
    logDebug('Listener globali per pulizia navigazione attivati (SessionCleanupManager)');
}

// === FUNZIONI PER FIX iOS MODAL ===

// Funzione per gestire l'altezza del modal su iOS
function adjustModalHeightForIOS() {
    // Controlla se siamo su iOS
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    
    if (isIOS) {
        // Calcola l'altezza reale del viewport considerando la UI del browser
        const realViewportHeight = window.innerHeight;
        const documentHeight = document.documentElement.clientHeight;
        
        console.log('[iOS Fix] Viewport heights:', {
            innerHeight: realViewportHeight,
            documentHeight: documentHeight,
            visualViewport: window.visualViewport?.height
        });
        
        // Usa l'altezza più piccola per assicurarsi che il contenuto sia visibile
        const safeHeight = Math.min(realViewportHeight, documentHeight);
        
        // Applica l'altezza al modal
        const photoModal = document.getElementById('photo-modal');
        const modalContainer = photoModal?.querySelector('.photo-modal-container');
        
        if (modalContainer && window.innerWidth <= 480) {
            // Solo su mobile, imposta un'altezza fissa che tiene conto della UI iOS
            modalContainer.style.height = `${safeHeight}px`;
            modalContainer.style.maxHeight = `${safeHeight}px`;
            
            console.log('[iOS Fix] Modal height adjusted to:', safeHeight + 'px');
            
            // Assicurati che il footer sia sempre visibile
            const footer = modalContainer.querySelector('.photo-modal-footer');
            if (footer) {
                footer.style.position = 'sticky';
                footer.style.bottom = '0';
                footer.style.zIndex = '100';
                footer.style.backgroundColor = '#ffffff';
            }
        }
        
        // Ascolta i cambiamenti del Visual Viewport (iOS 13+)
        if (window.visualViewport) {
            const handleViewportResize = function() {
                const newHeight = Math.min(window.visualViewport.height, window.innerHeight);
                if (modalContainer && window.innerWidth <= 480) {
                    modalContainer.style.height = `${newHeight}px`;
                    modalContainer.style.maxHeight = `${newHeight}px`;
                    console.log('[iOS Fix] Modal height updated to:', newHeight + 'px');
                }
            };
            
            // Rimuovi listener esistenti per evitare duplicati
            window.visualViewport.removeEventListener('resize', handleViewportResize);
            window.visualViewport.addEventListener('resize', handleViewportResize);
        }
    }
}

// Gestione orientamento dispositivo per iOS
function handleOrientationChange() {
    // Su iOS, ritarda la regolazione per permettere al browser di aggiornare la UI
    setTimeout(adjustModalHeightForIOS, 150);
}

// Aggiungi listener per i cambiamenti di orientamento solo una volta
if (!window.iosFixListenersAdded) {
    window.addEventListener('orientationchange', handleOrientationChange);
    window.addEventListener('resize', function() {
        // Solo su mobile
        if (window.innerWidth <= 480) {
            adjustModalHeightForIOS();
        }
    });
    
    window.iosFixListenersAdded = true;
    console.log('[iOS Fix] Event listeners registered');
}

// Funzione per cambiare il ruolo attivo
function changeRole(newRole) {
    if (!newRole) return;
    
    // Invia richiesta POST per cambiare il ruolo attivo
    fetch('/profile', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            activeRole: newRole
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            // Ricarica la pagina per applicare il nuovo ruolo
            window.location.reload();
        } else {
            console.error('Errore nel cambio ruolo:', data.message);
            alert('Errore nel cambio ruolo: ' + data.message);
        }
    })
    .catch(error => {
        console.error('Errore nel cambio ruolo:', error);
        alert('Errore nel cambio ruolo. Riprova.');
    });
}

// Funzione per cambiare il ruolo predefinito
function changeDefaultRole(newDefaultRole) {
    if (!newDefaultRole) return;
    
    // Invia richiesta POST per cambiare il ruolo predefinito
    fetch('/profile', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            defaultRole: newDefaultRole
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            // Mostra messaggio di successo
            console.log('Ruolo predefinito aggiornato con successo');
            // Opzionalmente potresti mostrare un toast o un messaggio
        } else {
            console.error('Errore nel cambio ruolo predefinito:', data.message);
            alert('Errore nel cambio ruolo predefinito: ' + data.message);
        }
    })
    .catch(error => {
        console.error('Errore nel cambio ruolo predefinito:', error);
        alert('Errore nel cambio ruolo predefinito. Riprova.');
    });
}