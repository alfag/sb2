// Variabili globali per l'immagine (accessibili da tutte le funzioni)
let croppedImageForAI = null;
let originalImageSrc = null;

// --- Gestione caricamento, anteprima e selezione area foto per AI ---
document.addEventListener('DOMContentLoaded', function () {
    // Registrazione Service Worker per PWA (spostato dal template per rispettare CSP)
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', function() {
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
    }
    
    // Reinizializza listener dopo navigazione del browser
    window.addEventListener('popstate', function() {
        setTimeout(() => {
            initializeReviewButton();
        }, 100);
    });
    
    // Listener per cambio di visibilità della pagina (PWA)
    document.addEventListener('visibilitychange', function() {
        if (!document.hidden) {
            // La pagina è tornata visibile, reinizializza
            setTimeout(() => {
                initializeReviewButton();
            }, 100);
        }
    });
    
    // Controlli di compatibilità browser
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const supportsTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    const supportsCanvas = !!document.createElement('canvas').getContext;
    const supportsFileReader = typeof FileReader !== 'undefined';
    
    // NOTA: Rimosso tracking birre duplicate per permettere repository di recensioni multiple
    
    // Logging per debug e monitoraggio
    function logDebug(message, data = null) {
        if (data) {
            console.log(`[Photo Crop Debug] ${message}:`, data);
        } else {
            console.log(`[Photo Crop Debug] ${message}`);
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
    
    // Funzione per iniziare il processo di recensione con i dati AI
    function startReviewProcess(aiData) {
        logDebug('Avvio processo di recensione', {
            success: aiData.success,
            bottlesCount: aiData.bottles?.length || 0,
            breweryData: aiData.brewery
        });
        
        try {
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
            
            // Mostra l'area di rating per le bottiglie
            const bottleRatings = document.getElementById('bottle-ratings');
            if (bottleRatings && aiData.bottles && aiData.bottles.length > 0) {
                let ratingsHtml = '<h3>Valuta le birre:</h3>';
                aiData.bottles.forEach((bottle, index) => {
                    // Genera thumbnail dell'immagine originale per questa birra
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
                            <div class="overall-rating">
                                <label>Valutazione generale:</label>
                                <div class="rating-stars" data-bottle="${index}" data-category="overall">
                                    <span class="star" data-rating="1">★</span>
                                    <span class="star" data-rating="2">★</span>
                                    <span class="star" data-rating="3">★</span>
                                    <span class="star" data-rating="4">★</span>
                                    <span class="star" data-rating="5">★</span>
                                </div>
                            </div>
                            
                            <!-- Toggle per valutazioni dettagliate -->
                            <div class="detailed-ratings-toggle">
                                <button type="button" class="btn-toggle-detailed" data-bottle="${index}">
                                    + Valutazione dettagliata
                                </button>
                            </div>
                            
                            <!-- Valutazioni dettagliate (nascoste di default) -->
                            <div class="detailed-ratings" data-bottle="${index}" style="display: none;">
                                <div class="rating-category">
                                    <label>Aspetto (colore, limpidezza, schiuma):</label>
                                    <div class="rating-stars" data-bottle="${index}" data-category="appearance">
                                        <span class="star" data-rating="1">★</span>
                                        <span class="star" data-rating="2">★</span>
                                        <span class="star" data-rating="3">★</span>
                                        <span class="star" data-rating="4">★</span>
                                        <span class="star" data-rating="5">★</span>
                                    </div>
                                    <textarea placeholder="Note sull'aspetto..." rows="2" data-notes="${index}" data-category="appearance"></textarea>
                                </div>
                                
                                <div class="rating-category">
                                    <label>Aroma (profumi e odori):</label>
                                    <div class="rating-stars" data-bottle="${index}" data-category="aroma">
                                        <span class="star" data-rating="1">★</span>
                                        <span class="star" data-rating="2">★</span>
                                        <span class="star" data-rating="3">★</span>
                                        <span class="star" data-rating="4">★</span>
                                        <span class="star" data-rating="5">★</span>
                                    </div>
                                    <textarea placeholder="Note sull'aroma..." rows="2" data-notes="${index}" data-category="aroma"></textarea>
                                </div>
                                
                                <div class="rating-category">
                                    <label>Gusto (sapore e bilanciamento):</label>
                                    <div class="rating-stars" data-bottle="${index}" data-category="taste">
                                        <span class="star" data-rating="1">★</span>
                                        <span class="star" data-rating="2">★</span>
                                        <span class="star" data-rating="3">★</span>
                                        <span class="star" data-rating="4">★</span>
                                        <span class="star" data-rating="5">★</span>
                                    </div>
                                    <textarea placeholder="Note sul gusto..." rows="2" data-notes="${index}" data-category="taste"></textarea>
                                </div>
                                
                                <div class="rating-category">
                                    <label>Sensazione in bocca (corpo, carbonazione):</label>
                                    <div class="rating-stars" data-bottle="${index}" data-category="mouthfeel">
                                        <span class="star" data-rating="1">★</span>
                                        <span class="star" data-rating="2">★</span>
                                        <span class="star" data-rating="3">★</span>
                                        <span class="star" data-rating="4">★</span>
                                        <span class="star" data-rating="5">★</span>
                                    </div>
                                    <textarea placeholder="Note sulla sensazione in bocca..." rows="2" data-notes="${index}" data-category="mouthfeel"></textarea>
                                </div>
                            </div>
                            
                            <!-- Note generali -->
                            <textarea placeholder="Note generali sulla birra..." rows="3" data-notes="${index}" data-category="general"></textarea>
                        </div>
                    `;
                });
                bottleRatings.innerHTML = ratingsHtml;
                
                // Aggiungi event listeners per le stelle di rating
                addRatingEventListeners();
                logDebug('Interfaccia rating popolata');
            }
            
            // Mostra l'area di review process
            reviewProcess.style.display = 'block';
            reviewProcess.scrollIntoView({ behavior: 'smooth' });
            
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
                
                // Rimuovi eventuali listener precedenti
                publishBtn.replaceWith(publishBtn.cloneNode(true));
                const newPublishBtn = document.getElementById('publish-review');
                
                newPublishBtn.addEventListener('click', function(event) {
                    console.log('=== CLICK BOTTONE PUBBLICA ===');
                    console.log('Event ricevuto:', event);
                    event.preventDefault(); // Previeni comportamenti default
                    publishReviews();
                });
                
                console.log('Event listener collegato al bottone pubblica recensione');
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
        const stars = document.querySelectorAll('.star');
        console.log('Stelle trovate:', stars.length);
        
        stars.forEach((star, starIndex) => {
            star.addEventListener('click', function() {
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
                ratingContainer.querySelectorAll('.star').forEach(s => s.classList.remove('selected'));
                
                // Seleziona le stelle fino al rating cliccato
                for (let i = 1; i <= rating; i++) {
                    const targetStar = ratingContainer.querySelector(`[data-rating="${i}"]`);
                    if (targetStar) {
                        targetStar.classList.add('selected');
                        console.log(`Stella ${i} selezionata`);
                    }
                }
                
                logDebug('Rating selezionato', { bottleIndex, category, rating });
            });
        });
        
        // Event listeners per i toggle delle valutazioni dettagliate
        const toggleButtons = document.querySelectorAll('.btn-toggle-detailed');
        console.log('Toggle buttons trovati:', toggleButtons.length);
        
        toggleButtons.forEach((button, buttonIndex) => {
            button.addEventListener('click', function() {
                const bottleIndex = this.dataset.bottle;
                const detailedRatings = document.querySelector(`.detailed-ratings[data-bottle="${bottleIndex}"]`);
                
                console.log(`=== TOGGLE VALUTAZIONE DETTAGLIATA ===`);
                console.log('Button index:', buttonIndex);
                console.log('Bottle index:', bottleIndex);
                console.log('Detailed ratings element:', detailedRatings);
                
                if (detailedRatings) {
                    const isVisible = detailedRatings.style.display !== 'none';
                    
                    if (isVisible) {
                        detailedRatings.style.display = 'none';
                        this.textContent = '+ Valutazione dettagliata';
                        this.classList.remove('expanded');
                    } else {
                        detailedRatings.style.display = 'block';
                        this.textContent = '- Nascondi valutazione dettagliata';
                        this.classList.add('expanded');
                    }
                    
                    logDebug('Toggle valutazione dettagliata', { bottleIndex, isVisible: !isVisible });
                } else {
                    console.error('Elemento detailed-ratings non trovato per bottiglia:', bottleIndex);
                }
            });
        });
        
        console.log('=== EVENT LISTENERS STELLE INIZIALIZZATI ===');
    }
    
    // Funzione per pubblicare le recensioni
    function publishReviews() {
        logDebug('Tentativo di pubblicazione recensioni');
        
        // Debug più dettagliato
        console.log('=== DEBUG PUBBLICAZIONE RECENSIONI ===');
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
                const selectedStars = overallRatingContainer.querySelectorAll('.star.selected');
                const overallRating = selectedStars.length;
                
                console.log('Stelle selezionate:', selectedStars);
                console.log('Rating generale:', overallRating);
                
                if (overallRating > 0) {
                    // Ottieni il thumbnail per questa birra
                    const thumbnailImg = document.querySelector(`[data-bottle-index="${index}"] .beer-thumbnail`);
                    const thumbnailSrc = thumbnailImg ? thumbnailImg.src : null;
                    
                    // Raccogli note generali
                    const generalNotes = generalNotesTextarea ? generalNotesTextarea.value.trim() : '';
                    
                    // Raccogli valutazioni dettagliate (opzionali)
                    const detailedRatings = {};
                    const categories = ['appearance', 'aroma', 'taste', 'mouthfeel'];
                    
                    categories.forEach(category => {
                        const categoryRatingContainer = document.querySelector(`[data-bottle="${index}"][data-category="${category}"]`);
                        const categoryNotesTextarea = document.querySelector(`[data-notes="${index}"][data-category="${category}"]`);
                        
                        if (categoryRatingContainer) {
                            const categorySelectedStars = categoryRatingContainer.querySelectorAll('.star.selected');
                            const categoryRating = categorySelectedStars.length;
                            const categoryNotes = categoryNotesTextarea ? categoryNotesTextarea.value.trim() : '';
                            
                            if (categoryRating > 0 || categoryNotes) {
                                detailedRatings[category] = {
                                    rating: categoryRating > 0 ? categoryRating : null,
                                    notes: categoryNotes || null
                                };
                            }
                        }
                    });
                    
                    reviews.push({
                        beerId: bottle._id || bottle.id, // ID della birra dal DB
                        beerName: bottle.bottleLabel,
                        breweryName: bottle.breweryName,
                        rating: overallRating, // Rating generale
                        notes: generalNotes, // Note generali
                        detailedRatings: Object.keys(detailedRatings).length > 0 ? detailedRatings : null,
                        aiData: bottle.aiData,
                        thumbnail: thumbnailSrc // Aggiungi il thumbnail
                    });
                    
                    logDebug('Recensione raccolta', {
                        beerName: bottle.bottleLabel,
                        beerId: bottle._id || bottle.id || 'NOT_FOUND',
                        overallRating: overallRating,
                        hasGeneralNotes: generalNotes.length > 0,
                        hasDetailedRatings: Object.keys(detailedRatings).length > 0,
                        detailedCategories: Object.keys(detailedRatings),
                        hasThumbnail: !!thumbnailSrc
                    });
                } else {
                    console.log(`Birra ${index} ignorata - nessun rating generale`, { beerName: bottle.bottleLabel });
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
            alert('Aggiungi almeno una valutazione a stelle prima di pubblicare');
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
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            return response.json();
        })
        .then(result => {
            logDebug('Recensioni pubblicate con successo', result);
            
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
            
            let errorMessage = 'Errore nella pubblicazione delle recensioni';
            if (error.message.includes('401')) {
                errorMessage = 'Devi essere loggato per pubblicare recensioni';
            } else if (error.message.includes('403')) {
                errorMessage = 'Non hai i permessi per pubblicare recensioni';
            }
            
            alert(errorMessage);
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
        
        // Rimuovi eventuali messaggi esistenti
        const existingAlerts = document.querySelectorAll('.dynamic-alert');
        existingAlerts.forEach(alert => {
            alert.remove();
        });
        
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
    
    // Controllo se ci sono dati AI in sessione al caricamento della pagina
    checkForSessionData();
    
    // Inizializza la pulizia dei dati di sessione quando l'utente naviga via
    clearSessionDataOnNavigation();
    
    // Collegamento bottone principale "Pubblica una recensione" al caricamento foto
    function initializeReviewButton() {
        const startReviewBtn = document.getElementById('start-review-process');
        if (startReviewBtn) {
            // Rimuovi eventuali listener precedenti per evitare duplicati
            startReviewBtn.removeEventListener('click', handleReviewButtonClick);
            startReviewBtn.addEventListener('click', handleReviewButtonClick);
            logDebug('Event listener collegato al bottone principale recensione');
            return true;
        } else {
            logDebug('Bottone start-review-process non trovato (normale se non in pagina welcome)');
            return false;
        }
    }
    
    function handleReviewButtonClick(e) {
        e.preventDefault();
        logDebug('=== BOTTONE PRINCIPALE CLICCATO ===');
        logDebug('Bottone principale "Pubblica una recensione" cliccato');
        
        // Pulisci eventuali dati AI precedenti dalla sessione
        clearPreviousSessionData();
        
        // Avvia direttamente il file picker
        const reviewPhotoInput = document.getElementById('reviewPhoto');
        if (reviewPhotoInput) {
            // Prepara il file input
            reviewPhotoInput.value = "";
            reviewPhotoInput.setAttribute('accept', 'image/*');
            reviewPhotoInput.removeAttribute('capture');
            
            // Avvia direttamente il file picker
            reviewPhotoInput.click();
            logDebug('File picker avviato direttamente dal bottone principale');
        } else {
            logError('Input reviewPhoto non trovato');
            alert('Errore: sistema di caricamento foto non disponibile');
        }
    }
    
    // Inizializza il bottone e riprova se non trovato
    if (!initializeReviewButton()) {
        // Riprova dopo un breve delay per gestire contenuto caricato dinamicamente
        setTimeout(() => {
            initializeReviewButton();
        }, 100);
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
            document.body.style.overflow = 'hidden';
        }
    }
    function closeModal() {
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
        
        // Se non è in corso un processo di recensione, ripristina l'interfaccia
        const reviewProcess = document.getElementById('review-process');
        if (!reviewProcess || reviewProcess.style.display === 'none') {
            resetReviewInterface();
            logDebug('Interfaccia ripristinata dopo chiusura modal');
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

        reviewPhotoInput.addEventListener('change', function () {
            // Reset stato crop e preview
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

            const file = reviewPhotoInput.files[0];
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
                    alert(`Il file è troppo grande. Dimensione massima consentita: ${Math.round(maxSize / 1024 / 1024)}MB`);
                    reviewPhotoInput.value = '';
                    return;
                }
                
                if (!isImageType && !isImageExt) {
                    erroreTipo = true;
                    logError('Tipo file non valido', { type: file.type, name: file.name });
                }
                
                // Mostra il bottone "Invia ad AI" per tutte le immagini valide
                const sendToAIBtn = document.getElementById('sendToAI');
                if (sendToAIBtn) sendToAIBtn.style.display = 'block';
                
                const reader = new FileReader();
                reader.onload = function (e) {
                    try {
                        // Salva l'immagine originale immediatamente dal FileReader
                        originalImageSrc = e.target.result;
                        logDebug('Immagine originale salvata dal FileReader');
                        
                        photoPreview.onload = function () {
                            logDebug('Caricamento immagine completato', {
                                naturalWidth: photoPreview.naturalWidth,
                                naturalHeight: photoPreview.naturalHeight
                            });
                            
                            if (erroreTipo && (photoPreview.naturalWidth === 0 || photoPreview.naturalHeight === 0)) {
                                logError('File non è un\'immagine valida');
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
                    photoPreview.onerror = function() {
                        logError('Errore nel caricamento dell\'immagine');
                        alert('Errore nel caricamento dell\'immagine. Prova con un altro file.');
                        reviewPhotoInput.value = '';
                        closeModal();
                    };
                    
                    photoPreview.src = e.target.result;
                    } catch (error) {
                        logError('Errore nel processamento dell\'immagine', error);
                        alert('Errore nel processamento dell\'immagine. Prova con un altro file.');
                        reviewPhotoInput.value = '';
                        closeModal();
                    }
                };
                
                reader.onerror = function() {
                    logError('Errore nella lettura del file');
                    alert('Errore nella lettura del file. Prova con un altro file.');
                    reviewPhotoInput.value = '';
                };
                
                reader.readAsDataURL(file);
            } else {
                //console.log('Nessun file selezionato');
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
        function drawImageOnCanvas() {
            const ctx = photoCanvas.getContext('2d');
            ctx.clearRect(0, 0, photoCanvas.width, photoCanvas.height);
            
            // Se stiamo mostrando un'immagine croppata, non disegnare mai alcun bordo
            if (croppedImageForAI) {
                // Quando è mostrata l'immagine croppata, il canvas resta completamente trasparente
                return;
            }
            
            // Canvas trasparente per vedere l'immagine sottostante
            ctx.save();
            ctx.translate(imgOffsetX, imgOffsetY);
            ctx.scale(imgScale, imgScale);
            // Non disegniamo l'immagine sul canvas, usiamo il canvas solo per l'overlay
            ctx.restore();
            
            // Se c'è una selezione crop attiva, disegnala (solo se non stiamo mostrando immagine croppata)
            if (isDragging || (cropRect && cropRect.w > 0 && cropRect.h > 0)) {
                ctx.save();
                ctx.strokeStyle = '#FFD600';
                ctx.lineWidth = 2;
                ctx.setLineDash([6, 4]);
                
                const rectX = isDragging ? Math.min(startX, endX) : cropRect.x;
                const rectY = isDragging ? Math.min(startY, endY) : cropRect.y;
                const rectW = isDragging ? Math.abs(endX - startX) : cropRect.w;
                const rectH = isDragging ? Math.abs(endY - startY) : cropRect.h;
                
                ctx.strokeRect(rectX, rectY, rectW, rectH);
                ctx.restore();
            }
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

        // Touch events per mobile: drag e pinch-to-zoom
        photoCanvas.addEventListener('touchstart', function (e) {
            if (e.touches.length === 1) {
                draggingImg = true;
                imgStartX = e.touches[0].clientX;
                imgStartY = e.touches[0].clientY;
            } else if (e.touches.length === 2) {
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
            if (draggingImg && e.touches.length === 1) {
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
            draggingImg = false;
            lastDist = null;
        });

        // Funzione per confermare e applicare il crop
        function applyCrop() {
            console.log('Applicazione crop - zoom sull\'area selezionata');
            
            if (!cropRect || cropRect.w < 10 || cropRect.h < 10) {
                console.log('Selezione crop troppo piccola, nessun crop applicato');
                return false;
            }
            
            // Crea un elemento immagine temporaneo dall'immagine originale per ottenere le dimensioni corrette
            const tempImg = new Image();
            tempImg.onload = function() {
                // Usa le dimensioni dell'immagine originale per i calcoli
                const originalWidth = tempImg.naturalWidth;
                const originalHeight = tempImg.naturalHeight;
                
                // Ottieni le dimensioni del canvas renderizzato (quello che vede l'utente)
                const canvasRect = photoCanvas.getBoundingClientRect();
                const canvasDisplayWidth = canvasRect.width;
                const canvasDisplayHeight = canvasRect.height;
                
                // Calcola il rapporto di scala tra canvas interno e canvas visualizzato
                const scaleXCanvas = photoCanvas.width / canvasDisplayWidth;
                const scaleYCanvas = photoCanvas.height / canvasDisplayHeight;
                
                // Calcola il rapporto di scala tra immagine originale e canvas interno
                const scaleXOriginal = originalWidth / photoCanvas.width;
                const scaleYOriginal = originalHeight / photoCanvas.height;
                
                // Converti le coordinate del rettangolo di crop dalle coordinate canvas alle coordinate immagine originale
                const imgX = cropRect.x * scaleXOriginal;
                const imgY = cropRect.y * scaleYOriginal;
                const imgW = cropRect.w * scaleXOriginal;
                const imgH = cropRect.h * scaleYOriginal;
                
                // Assicurati che le coordinate siano entro i limiti dell'immagine originale
                const clampedX = Math.max(0, Math.min(imgX, originalWidth));
                const clampedY = Math.max(0, Math.min(imgY, originalHeight));
                const clampedW = Math.min(imgW, originalWidth - clampedX);
                const clampedH = Math.min(imgH, originalHeight - clampedY);
                
                console.log('Crop coordinates calculation:', { 
                    cropRect,
                    canvasSize: { w: photoCanvas.width, h: photoCanvas.height },
                    canvasDisplay: { w: canvasDisplayWidth, h: canvasDisplayHeight },
                    originalSize: { w: originalWidth, h: originalHeight },
                    scaleCanvas: { x: scaleXCanvas, y: scaleYCanvas },
                    scaleOriginal: { x: scaleXOriginal, y: scaleYOriginal },
                    imageCoords: { x: imgX, y: imgY, w: imgW, h: imgH },
                    clampedCoords: { x: clampedX, y: clampedY, w: clampedW, h: clampedH }
                });
                
                // Crea canvas temporaneo per l'area croppata
                const tempCanvas = document.createElement('canvas');
                tempCanvas.width = clampedW;
                tempCanvas.height = clampedH;
                const tctx = tempCanvas.getContext('2d');
                tctx.fillStyle = '#f2f2f2';
                tctx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
                
                // Disegna l'area croppata dall'immagine originale pulita (senza bordi)
                tctx.drawImage(tempImg, 
                    clampedX, clampedY, clampedW, clampedH,  // area sorgente nell'immagine originale
                    0, 0, clampedW, clampedH                 // area destinazione (dimensioni reali)
                );
                
                // Salva per invio AI e per display
                croppedImageForAI = tempCanvas.toDataURL('image/jpeg', 0.92).split(',')[1];
                
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
                photoPreview.src = tempCanvas.toDataURL('image/jpeg', 0.92);
                
                // Mantieni la classe CSS per il layout responsive fisso
                photoPreview.className = 'photo-preview-image';
                
                // Mostra la freccia di ritorno e il bottone "Invia ad AI"
                const backArrow = document.getElementById('backArrow');
                if (backArrow) backArrow.style.display = 'flex';
                const sendToAIBtn = document.getElementById('sendToAI');
                if (sendToAIBtn) sendToAIBtn.style.display = 'block';
                
                console.log('Crop applicato - dimensioni:', { w: clampedW, h: clampedH });
            };
            
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

        // Gestione del nuovo bottone "Invia ad AI" con controlli robusti
        const sendToAIBtn = document.getElementById('sendToAI');
        if (sendToAIBtn) {
            sendToAIBtn.addEventListener('click', function () {
                logDebug('Invia ad AI premuto');
                
                // Previeni doppi click
                if (sendToAIBtn.disabled) {
                    logDebug('Invio già in corso, ignoro click');
                    return;
                }
                
                let imageToSend = croppedImageForAI;
                
                // Se non c'è un'immagine croppata, usa l'immagine originale
                if (!imageToSend && photoPreview.src && photoPreview.complete) {
                    try {
                        logDebug('Preparazione immagine originale per AI');
                        // Crea canvas temporaneo per l'immagine originale
                        const tempCanvas = document.createElement('canvas');
                        tempCanvas.width = photoPreview.naturalWidth;
                        tempCanvas.height = photoPreview.naturalHeight;
                        const ctx = tempCanvas.getContext('2d');
                        
                        if (!ctx) {
                            throw new Error('Impossibile creare contesto canvas');
                        }
                        
                        ctx.drawImage(photoPreview, 0, 0);
                        imageToSend = tempCanvas.toDataURL('image/jpeg', 0.92).split(',')[1];
                        
                        logDebug('Immagine originale preparata per AI', {
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

                // Mostra overlay spinner a schermo intero
                const loadingOverlay = document.getElementById('ai-loading-overlay');
                if (loadingOverlay) {
                    loadingOverlay.classList.add('show');
                }
                
                // Disabilita il pulsante durante l'invio
                sendToAIBtn.disabled = true;
                
                logDebug('Invio immagine ad AI', { dataSize: imageToSend.length });

                // Invio dell'immagine all'AI con gestione robusta
                logDebug('Invio fetch a /api/gemini/firstcheck');
                
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 30000); // Timeout 30 secondi
                
                fetch('/api/gemini/firstcheck', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ image: imageToSend }),
                    signal: controller.signal
                })
                .then(response => {
                    clearTimeout(timeoutId);
                    
                    logDebug('Ricevuta risposta HTTP', { 
                        status: response.status, 
                        statusText: response.statusText,
                        ok: response.ok 
                    });
                    
                    // MODIFICA: Non lanciare errore per status 200, anche se response.ok è false in certi casi
                    if (response.status !== 200) {
                        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                    }
                    
                    return response.json();
                })
                .then(data => {
                    logDebug('Risposta AI ricevuta (JSON parsato)', data);
                    
                    if (data.error) {
                        logError('Errore presente nella risposta data.error', data.error);
                        throw new Error(data.error);
                    }
                    
                    // Gestione caso: AI non ha rilevato elementi birra
                    if (!data.success || data.errorType === 'NO_BEER_DETECTED') {
                        logDebug('CONDIZIONE MATCH: AI non ha rilevato elementi di birra', {
                            success: data.success,
                            errorType: data.errorType,
                            message: data.message
                        });
                        
                        // Nascondi overlay spinner immediatamente
                        const loadingOverlay = document.getElementById('ai-loading-overlay');
                        if (loadingOverlay) {
                            loadingOverlay.classList.remove('show');
                            logDebug('Overlay spinner nascosto per NO_BEER_DETECTED');
                        }
                        
                        // Chiudi il modal
                        closeModal();
                        logDebug('Modal chiuso per NO_BEER_DETECTED');
                        
                        // Mostra warning nella pagina principale con messaggio specifico
                        const warningMessage = data.message || 'L\'AI non ha rilevato bottiglie di birra nell\'immagine. Carica un\'immagine contenente chiaramente prodotti birrari.';
                        
                        // Piccolo delay per assicurarsi che il modal si sia chiuso
                        setTimeout(() => {
                            logDebug('Esecuzione showWarningMessage per NO_BEER_DETECTED');
                            showWarningMessage(warningMessage);
                        }, 100);
                        
                        return; // IMPORTANTE: esce qui senza mostrare altri alert
                    }
                    
                    // NOTA: Rimosso controllo duplicati per permettere repository di recensioni multiple
                    
                    // Se l'analisi è andata a buon fine, procedi con la recensione
                    if (data.success && data.bottles && data.bottles.length > 0) {
                        logDebug('AI ha riconosciuto birre, procedendo con recensione', {
                            bottlesCount: data.bottles.length,
                            bottles: data.bottles
                        });
                        
                        // Chiudi il modal di anteprima foto
                        closeModal();
                        
                        // NOTA: Rimosso tracking birre recensite per permettere recensioni multiple
                        
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
                    logError('Errore nell\'invio all\'AI', error);
                    
                    let errorMessage = 'Errore nell\'invio all\'AI';
                    
                    if (error.name === 'AbortError') {
                        errorMessage = 'Timeout: l\'analisi sta richiedendo troppo tempo. Riprova.';
                    } else if (error.message.includes('HTTP 413')) {
                        errorMessage = 'Immagine troppo grande. Prova a ridimensionarla.';
                    } else if (error.message.includes('HTTP 429')) {
                        errorMessage = 'Troppe richieste. Attendi un momento e riprova.';
                    } else if (error.message.includes('Failed to fetch')) {
                        errorMessage = 'Problema di connessione. Controlla la tua connessione internet.';
                    }
                    
                    alert(errorMessage);
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
            });
        }
    }
});
// Aggiungi funzionalità per mostrare/nascondere la password

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
            fetch('/disclaimer', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ accepted: true })
            })
            .then(response => {
                if (response.ok) {
                    disclaimerModal.style.display = 'none';
                    location.reload();
                }
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
            const iconSrc = type === 'password' ? '/images/visibility.svg' : '/images/visibility_off.svg';
            togglePassword.setAttribute('src', iconSrc);
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
        
        // Aggiungi listener ai link del menu per reinizializzare dopo la navigazione
        const menuLinks = menu.querySelectorAll('a');
        menuLinks.forEach(link => {
            link.addEventListener('click', function() {
                // Reinizializza i listener dopo un breve delay per permettere il caricamento della pagina
                setTimeout(() => {
                    initializeReviewButton();
                }, 200);
            });
        });
    }

    // Gestione cancellazione utente
    const deleteUserBtn = document.getElementById('deleteUserBtn');
    const deleteUserForm = document.getElementById('deleteUserForm');
    if (deleteUserBtn && deleteUserForm) {
        deleteUserBtn.addEventListener('click', function (e) {
            if (confirm('Sei sicuro di voler cancellare questo utente? L\'operazione è irreversibile.')) {
                deleteUserForm.submit();
            }
        });
    }

    // Gestione cambio ruolo attivo (CSP safe)
    const changeRoleForm = document.getElementById('changeRoleForm');
    const activeRoleSelect = document.getElementById('activeRole');
    if (changeRoleForm && activeRoleSelect) {
        activeRoleSelect.addEventListener('change', function () {
            changeRoleForm.submit();
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

window.onerror = function (message, source, lineno, colno, error) {
    console.error('Errore JavaScript:', message, source, lineno, colno, error);
};

function validatePasswordMatch() {
    var pwd = document.getElementById('password').value;
    var conf = document.getElementById('confirmPassword').value;
    var error = document.getElementById('passwordError');
    if (pwd !== conf) {
        error.style.display = 'inline';
        return false;
    }
    error.style.display = 'none';
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
            `data:image/jpeg;base64,${croppedImageForAI}` : 
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
            console.log('[checkForSessionData] Dati AI trovati in sessione, ripristino interfaccia', {
                bottlesCount: result.data.bottles?.length || 0,
                timestamp: result.timestamp
            });
            
            // Ripristina l'interfaccia con i dati AI
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
        // Nascondi il bottone principale e mostra l'interfaccia di recensione
        const startReviewBtn = document.getElementById('start-review-process');
        if (startReviewBtn) {
            startReviewBtn.style.display = 'none';
        }
        
        // Mostra l'interfaccia di recensione
        const reviewForm = document.getElementById('review-form');
        if (reviewForm) {
            reviewForm.style.display = 'block';
        }
        
        // Se ci sono birre rilevate, mostrale
        if (aiData.bottles && aiData.bottles.length > 0) {
            displayBeersFromSession(aiData);
        } else if (aiData.errorType === 'NO_BEER_DETECTED') {
            // Mostra il messaggio di warning per "nessuna birra rilevata"
            showAlert('warning', 'Attenzione: Non sono state rilevate bottiglie di birra nell\'immagine. Puoi comunque procedere con la recensione manuale.');
        }
        
        console.log('[restoreInterfaceFromSessionData] Interfaccia ripristinata con successo');
        
    } catch (error) {
        console.error('[restoreInterfaceFromSessionData] Errore nel ripristino interfaccia:', error);
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
            navigator.sendBeacon('/review/ai-session-data', JSON.stringify({}));
        }
    });
}

/**
 * Pulisce i dati AI precedenti dalla sessione (chiamata manuale)
 */
async function clearPreviousSessionData() {
    try {
        console.log('[clearPreviousSessionData] Pulizia dati AI precedenti dalla sessione');
        
        const response = await fetch('/review/ai-session-data', {
            method: 'DELETE'
        });
        
        if (response.ok) {
            console.log('[clearPreviousSessionData] Dati AI precedenti puliti con successo');
        }
    } catch (error) {
        console.error('[clearPreviousSessionData] Errore nella pulizia dati precedenti:', error);
    }
}