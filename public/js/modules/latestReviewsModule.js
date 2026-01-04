/**
 * Latest Reviews Module - Gestione visualizzazione ultime recensioni nella welcome page
 * Sistema per mostrare le ultime 5 recensioni con thumbnail, rating e utente
 * Include popup dettagli al click sulla recensione
 */

console.log('⭐ LatestReviewsModule.js - FILE CARICATO!');

const LatestReviewsModule = (() => {
    // Storage per i dati delle recensioni (per popup)
    let reviewsData = [];

    /**
     * Carica e visualizza le ultime recensioni
     * @param {boolean} skipPollingCheck - Se true, non avvia il polling (usato per evitare loop infiniti)
     */
    async function loadLatestReviews(skipPollingCheck = false) {
        const reviewsList = document.getElementById('latest-reviews-list');
        
        if (!reviewsList) {
            // Container non trovato - normale se non siamo nella welcome page
            return;
        }

        console.log('[LatestReviewsModule] Inizio caricamento ultime recensioni...');

        try {
            // Mostra loading placeholder
            reviewsList.innerHTML = createLoadingPlaceholder();

            // Fetch ultime recensioni dal backend
            const response = await fetch('/api/reviews/latest?limit=5');
            const data = await response.json();

            console.log('[LatestReviewsModule] Dati ricevuti:', data);

            if (!data.success || !data.reviews || data.reviews.length === 0) {
                console.log('[LatestReviewsModule] Nessuna recensione trovata');
                reviewsList.innerHTML = createEmptyState();
                return;
            }

            // Salva i dati per il popup
            reviewsData = data.reviews;

            console.log(`[LatestReviewsModule] Visualizzo ${data.reviews.length} recensioni`);
            
            // Renderizza le recensioni
            reviewsList.innerHTML = data.reviews
                .map((review, index) => createReviewCard(review, index))
                .join('');

            // Aggiungi event listeners per click
            attachClickHandlers();

            // 🔄 Avvia polling automatico per recensioni in elaborazione
            // (solo se non siamo in un reload post-polling per evitare loop infiniti)
            if (!skipPollingCheck) {
                checkAndStartPollingForProcessingReviews();
            }

            console.log('[LatestReviewsModule] Recensioni renderizzate');

        } catch (error) {
            console.error('[LatestReviewsModule] Errore caricamento recensioni:', error);
            reviewsList.innerHTML = createErrorState();
        }
    }

    /**
     * Aggiungi click handlers alle card (welcome page)
     */
    function attachClickHandlers() {
        const cards = document.querySelectorAll('.review-card[data-review-index]');
        cards.forEach(card => {
            card.style.cursor = 'pointer';
            card.addEventListener('click', () => {
                const index = parseInt(card.dataset.reviewIndex);
                if (reviewsData[index]) {
                    openReviewPopup(reviewsData[index]);
                }
            });
        });
    }

    /**
     * Aggiungi click handlers per la pagina allReviews (con fetch dati)
     */
    function attachAllReviewsClickHandlers() {
        const cards = document.querySelectorAll('#reviews-list .review-card');
        cards.forEach((card, index) => {
            card.style.cursor = 'pointer';
            card.setAttribute('tabindex', '0');
            card.setAttribute('role', 'button');
            card.setAttribute('data-review-index', index);
            
            card.addEventListener('click', async () => {
                await fetchAndShowReview(card, index);
            });
            
            card.addEventListener('keydown', async (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    await fetchAndShowReview(card, index);
                }
            });
        });
    }

    /**
     * Fetch dati recensione e mostra popup
     * Legge i dati completi dai data attributes della card
     */
    async function fetchAndShowReview(card, index) {
        // Leggi dati completi dai data attributes
        const imageUrl = card.dataset.reviewImage || '/images/default-beer.svg';
        const beerName = card.dataset.reviewBeer || 'Birra';
        const breweryName = card.dataset.reviewBrewery || '';
        const beerType = card.dataset.reviewType || '';
        const alcoholContent = card.dataset.reviewAlcohol || '';
        const rating = parseFloat(card.dataset.reviewRating) || 0;
        const date = card.dataset.reviewDate || '';
        const notes = card.dataset.reviewNotes || '';
        const userName = card.dataset.reviewUser || 'Utente anonimo';
        
        // Parsing detailedRatings JSON
        let detailedRatings = null;
        try {
            const detailedJson = card.dataset.reviewDetailed;
            if (detailedJson && detailedJson !== 'null') {
                detailedRatings = JSON.parse(detailedJson);
            }
        } catch (e) {
            console.warn('[LatestReviewsModule] Errore parsing detailedRatings:', e);
        }
        
        // Costruisci oggetto review completo
        const review = {
            imageUrl,
            beerName,
            breweryName,
            beerType,
            alcoholContent,
            rating,
            date,
            notes,
            userName,
            detailedRatings
        };
        
        openReviewPopup(review);
    }

    /**
     * Apre il popup con i dettagli della recensione
     */
    function openReviewPopup(review) {
        console.log('[LatestReviewsModule] Apertura popup per:', review.beerName);
        
        // Crea e inserisci il popup nel DOM
        const popupHtml = createPopupHtml(review);
        
        // Rimuovi popup esistente se presente
        const existingPopup = document.getElementById('review-detail-popup');
        if (existingPopup) {
            existingPopup.remove();
        }

        // Inserisci il popup
        document.body.insertAdjacentHTML('beforeend', popupHtml);
        
        // Aggiungi event listeners per chiusura
        const popup = document.getElementById('review-detail-popup');
        const closeBtn = popup.querySelector('.review-popup-close');
        const overlay = popup.querySelector('.review-popup-overlay');
        
        closeBtn.addEventListener('click', closeReviewPopup);
        overlay.addEventListener('click', closeReviewPopup);
        
        // Event listener per immagine cliccabile (zoom)
        const imageContainer = popup.querySelector('.popup-image-clickable');
        const imageOverlay = popup.querySelector('.popup-image-overlay');
        const imageOverlayClose = popup.querySelector('.popup-image-overlay-close');
        const imageOverlayBackdrop = popup.querySelector('.popup-image-overlay-backdrop');
        
        if (imageContainer && imageOverlay) {
            // Click sull'immagine header -> apri overlay
            imageContainer.addEventListener('click', () => {
                imageOverlay.style.display = 'flex';
                requestAnimationFrame(() => {
                    imageOverlay.classList.add('active');
                });
            });
            
            // Chiudi overlay immagine
            const closeImageOverlay = () => {
                imageOverlay.classList.remove('active');
                setTimeout(() => {
                    imageOverlay.style.display = 'none';
                }, 300);
            };
            
            imageOverlayClose.addEventListener('click', closeImageOverlay);
            imageOverlayBackdrop.addEventListener('click', closeImageOverlay);
        }
        
        // Chiudi con ESC
        document.addEventListener('keydown', handleEscKey);
        
        // Previeni scroll body
        document.body.style.overflow = 'hidden';
        
        // Anima apertura
        requestAnimationFrame(() => {
            popup.classList.add('active');
        });
    }

    /**
     * Chiude il popup
     */
    function closeReviewPopup() {
        const popup = document.getElementById('review-detail-popup');
        if (popup) {
            popup.classList.remove('active');
            setTimeout(() => {
                popup.remove();
                document.body.style.overflow = '';
            }, 300);
        }
        document.removeEventListener('keydown', handleEscKey);
    }

    /**
     * Handler per tasto ESC
     */
    function handleEscKey(e) {
        if (e.key === 'Escape') {
            closeReviewPopup();
        }
    }

    /**
     * Crea HTML del popup dettagli
     */
    function createPopupHtml(review) {
        const rating = getRating(review);
        const starsHtml = generateStarsHtml(parseFloat(rating));
        const dateFormatted = formatDateFull(review.date);
        const thumbnail = review.imageUrl || '/images/default-beer.svg';
        const beerName = review.beerName || review.bottleLabel || 'Birra';
        const breweryName = review.breweryName || '';
        const beerType = review.beerType || '';
        const alcoholContent = review.alcoholContent || '';
        const notes = review.notes || '';
        const userName = review.userName || 'Utente anonimo';
        
        // Costruisci sezione valutazioni dettagliate - Design moderno con stelle colorate
        let detailedRatingsHtml = '';
        if (review.detailedRatings) {
            const categories = [
                { key: 'appearance', label: 'Aspetto' },
                { key: 'aroma', label: 'Aroma' },
                { key: 'taste', label: 'Gusto' },
                { key: 'mouthfeel', label: 'Corpo' }
            ];
            
            const detailItems = categories
                .filter(cat => review.detailedRatings[cat.key] && review.detailedRatings[cat.key].rating)
                .map(cat => {
                    const detail = review.detailedRatings[cat.key];
                    const ratingValue = parseFloat(detail.rating) || 0;
                    const detailNotes = detail.notes ? `<div class="detail-notes">"${escapeHtml(detail.notes)}"</div>` : '';
                    
                    // Genera stelle gialle standard
                    const starsHtml = Array.from({length: 5}, (_, i) => {
                        const filled = i < Math.floor(ratingValue);
                        const half = !filled && i < ratingValue;
                        return `<span class="detail-star ${filled ? 'filled' : ''} ${half ? 'half' : ''}">★</span>`;
                    }).join('');
                    
                    return `
                        <div class="detail-rating-item">
                            <div class="detail-rating-header">
                                <span class="detail-label">${cat.label}</span>
                                <div class="detail-stars-row">${starsHtml}</div>
                            </div>
                            ${detailNotes}
                        </div>
                    `;
                }).join('');
            
            if (detailItems) {
                detailedRatingsHtml = `
                    <div class="popup-section detailed-ratings">
                        <h4 class="section-title">Valutazioni Dettagliate</h4>
                        <div class="detailed-ratings-grid">
                            ${detailItems}
                        </div>
                    </div>
                `;
            }
        }
        
        // Info birra
        let beerInfoHtml = '';
        if (breweryName || beerType || alcoholContent) {
            const infoParts = [];
            if (breweryName) infoParts.push(`<span class="info-item"><i class="fas fa-industry"></i> ${escapeHtml(breweryName)}</span>`);
            if (beerType) infoParts.push(`<span class="info-item"><i class="fas fa-beer"></i> ${escapeHtml(beerType)}</span>`);
            if (alcoholContent) infoParts.push(`<span class="info-item"><i class="fas fa-percent"></i> ${alcoholContent}%</span>`);
            
            beerInfoHtml = `<div class="popup-beer-info">${infoParts.join('')}</div>`;
        }
        
        return `
            <div id="review-detail-popup" class="review-popup">
                <div class="review-popup-overlay"></div>
                <div class="review-popup-content">
                    <button class="review-popup-close" aria-label="Chiudi">
                        <i class="fas fa-times"></i>
                    </button>
                    
                    <!-- Header con immagine cliccabile -->
                    <div class="popup-header">
                        <div class="popup-image-container popup-image-clickable" title="Clicca per ingrandire">
                            <img src="${escapeHtml(thumbnail)}" 
                                 alt="${escapeHtml(beerName)}" 
                                 class="popup-image"
                                 onerror="this.src='/images/default-beer.svg'">
                            <div class="popup-image-zoom-hint">
                                <i class="fas fa-search-plus"></i>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Overlay immagine ingrandita -->
                    <div class="popup-image-overlay" style="display: none;">
                        <div class="popup-image-overlay-backdrop"></div>
                        <div class="popup-image-overlay-content">
                            <button class="popup-image-overlay-close" aria-label="Chiudi immagine">
                                <i class="fas fa-times"></i>
                            </button>
                            <img src="${escapeHtml(thumbnail)}" 
                                 alt="Foto originale - ${escapeHtml(beerName)}" 
                                 class="popup-image-fullsize"
                                 onerror="this.src='/images/default-beer.svg'">
                        </div>
                    </div>
                    
                    <!-- Info principale -->
                    <div class="popup-body">
                        <div class="popup-beer-header">
                            <h3 class="popup-beer-name">${escapeHtml(beerName)}</h3>
                            <div class="popup-stars">${starsHtml}</div>
                        </div>
                        ${beerInfoHtml}
                        
                        <!-- Utente e Data -->
                        <div class="popup-meta">
                            <div class="popup-user">
                                ${escapeHtml(userName)}
                            </div>
                            <div class="popup-date">
                                ${dateFormatted}
                            </div>
                        </div>
                        
                        <!-- Note generali -->
                        ${notes ? `
                            <div class="popup-section">
                                <p class="popup-notes"><strong>Commento:</strong> ${escapeHtml(notes)}</p>
                            </div>
                        ` : ''}
                        
                        <!-- Valutazioni dettagliate -->
                        ${detailedRatingsHtml}
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Ottiene il rating dalla recensione
     */
    function getRating(review) {
        if (review.rating !== undefined) {
            return Number(review.rating).toFixed(1);
        }
        if (review.ratings && review.ratings.length > 0 && review.ratings[0].rating) {
            return Number(review.ratings[0].rating).toFixed(1);
        }
        return '0.0';
    }

    /**
     * Genera stelle HTML per il rating
     */
    function generateStarsHtml(rating) {
        const fullStars = Math.floor(rating);
        const hasHalfStar = (rating - fullStars) >= 0.5;
        const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);
        
        let html = '';
        
        for (let i = 0; i < fullStars; i++) {
            html += '<span class="star full">★</span>';
        }
        
        if (hasHalfStar) {
            html += '<span class="star half">★</span>';
        }
        
        for (let i = 0; i < emptyStars; i++) {
            html += '<span class="star empty">☆</span>';
        }
        
        return html;
    }

    /**
     * Formatta la data in modo leggibile (breve)
     */
    function formatDate(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now - date;
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        
        if (diffDays === 0) {
            return 'Oggi';
        } else if (diffDays === 1) {
            return 'Ieri';
        } else if (diffDays < 7) {
            return `${diffDays} giorni fa`;
        } else {
            return date.toLocaleDateString('it-IT', { 
                day: 'numeric', 
                month: 'short'
            });
        }
    }

    /**
     * Formatta la data in modo completo (per popup)
     */
    function formatDateFull(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('it-IT', { 
            weekday: 'long',
            day: 'numeric', 
            month: 'long',
            year: 'numeric'
        });
    }

    /**
     * Crea card recensione con thumbnail e rating
     */
    function createReviewCard(review, index) {
        const rating = getRating(review);
        const starsHtml = generateStarsHtml(parseFloat(rating));
        const dateFormatted = formatDate(review.date);
        
        const thumbnail = review.imageUrl || '/images/default-beer.svg';
        
        let beerName = review.beerName || review.bottleLabel || 'Birra';
        if (!beerName || beerName === 'Birra') {
            if (review.ratings && review.ratings.length > 0) {
                beerName = review.ratings[0].beerName || review.ratings[0].bottleLabel || 'Birra';
            }
        }
        
        // Gradiente uniforme ambra/dorato per il bordo della thumbnail
        const gradientBorder = 'linear-gradient(135deg, #f59e0b 0%, #d97706 50%, #b45309 100%)';
        
        const notes = review.notes || '';
        
        // Determina se mostrare badge AI processing
        const isProcessing = review.isProcessing || review.processingStatus === 'pending_validation' || review.processingStatus === 'processing';
        const processingBadge = isProcessing ? `
            <div class="ai-processing-badge" title="Stiamo arricchendo questa recensione con informazioni aggiuntive">
                <div class="ai-badge-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="10" class="ai-circle"/>
                        <path d="M12 6v6l4 2" class="ai-clock"/>
                    </svg>
                </div>
                <span class="ai-badge-pulse"></span>
            </div>` : '';
        
        // Estrai review ID per targeting aggiornamenti real-time
        const reviewId = review._id || review.id || '';
        
        return `
            <div class="review-card${isProcessing ? ' processing' : ''}" data-review-index="${index}" data-review-id="${reviewId}" role="button" tabindex="0">
                ${processingBadge}
                <div class="review-thumbnail-wrapper" style="background: ${gradientBorder};">
                    <img src="${escapeHtml(thumbnail)}" 
                         alt="Recensione ${beerName}" 
                         class="review-thumbnail"
                         onerror="this.src='/images/default-beer.svg'">
                </div>
                <div class="review-content">
                    <div class="review-header">
                        <span class="review-beer-name">${escapeHtml(beerName)}</span>
                        <div class="review-rating">
                            <span class="stars">${starsHtml}</span>
                        </div>
                    </div>
                    
                    <div class="review-date">${dateFormatted}</div>
                    
                    ${notes ? `<div class="review-notes">${escapeHtml(notes)}</div>` : ''}
                </div>
            </div>
        `;
    }

    /**
     * Crea placeholder di caricamento
     */
    function createLoadingPlaceholder() {
        return Array(5).fill(0).map(() => `
            <div class="review-card skeleton">
                <div class="skeleton-thumbnail"></div>
                <div class="skeleton-content">
                    <div class="skeleton-text skeleton-title"></div>
                    <div class="skeleton-text skeleton-rating"></div>
                    <div class="skeleton-text skeleton-meta"></div>
                </div>
            </div>
        `).join('');
    }

    /**
     * Crea stato vuoto
     */
    function createEmptyState() {
        return `
            <div class="reviews-empty-state">
                <div class="empty-state-icon">📝</div>
                <p class="empty-state-text">Nessuna recensione ancora. Sii il primo!</p>
            </div>
        `;
    }

    /**
     * Crea stato errore
     */
    function createErrorState() {
        return `
            <div class="reviews-empty-state">
                <div class="empty-state-icon">⚠️</div>
                <p class="empty-state-text">Errore nel caricamento delle recensioni</p>
            </div>
        `;
    }

    /**
     * Escape HTML per sicurezza
     */
    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Aggiorna una card recensione quando il processing è completato
     * Chiamata da aiModule.js quando polling rileva status 'completed'
     * @param {string} reviewId - ID della recensione
     * @param {object} reviewData - Dati aggiornati della recensione (da API status)
     */
    function updateReviewCard(reviewId, reviewData) {
        if (!reviewId) {
            console.warn('[LatestReviewsModule] updateReviewCard: reviewId mancante');
            return false;
        }

        // Trova tutte le card con questo review ID (possono essere su welcome e/o allReviews)
        const cards = document.querySelectorAll(`[data-review-id="${reviewId}"]`);
        
        if (cards.length === 0) {
            console.log(`[LatestReviewsModule] updateReviewCard: Nessuna card trovata per reviewId ${reviewId}`);
            return false;
        }

        console.log(`[LatestReviewsModule] 🔄 Aggiornamento ${cards.length} card(s) per reviewId ${reviewId}`);

        cards.forEach(card => {
            // 1. Rimuovi classe processing
            card.classList.remove('processing');

            // 2. Rimuovi badge AI processing
            const processingBadge = card.querySelector('.ai-processing-badge');
            if (processingBadge) {
                processingBadge.remove();
                console.log('[LatestReviewsModule] ✅ Rimosso badge AI processing');
            }

            // 3. Aggiorna il nome della birra se disponibile nei dati
            if (reviewData && reviewData.bottles && reviewData.bottles.length > 0) {
                const firstBottle = reviewData.bottles[0];
                const beerName = firstBottle.beerName || firstBottle.bottleLabel || '';
                
                if (beerName) {
                    const beerNameElement = card.querySelector('.review-beer-name');
                    if (beerNameElement) {
                        beerNameElement.textContent = beerName;
                        console.log(`[LatestReviewsModule] ✅ Aggiornato nome birra: ${beerName}`);
                    }
                }

                // 4. Aggiorna il rating se disponibile
                const rating = firstBottle.rating || 
                              (firstBottle.detailedRatings ? 
                                calculateAverageRating(firstBottle.detailedRatings) : null);
                
                if (rating) {
                    const starsContainer = card.querySelector('.stars');
                    if (starsContainer) {
                        starsContainer.innerHTML = generateStarsHtml(parseFloat(rating));
                        console.log(`[LatestReviewsModule] ✅ Aggiornato rating: ${rating}`);
                    }
                }
            }

            // 5. Aggiungi animazione di completamento
            card.classList.add('review-updated');
            setTimeout(() => {
                card.classList.remove('review-updated');
            }, 2000);
        });

        console.log(`[LatestReviewsModule] ✅ Completato aggiornamento card per reviewId ${reviewId}`);
        return true;
    }

    /**
     * Calcola rating medio dai detailedRatings
     */
    function calculateAverageRating(detailedRatings) {
        if (!detailedRatings) return null;
        
        const categories = ['appearance', 'aroma', 'taste', 'mouthfeel'];
        let sum = 0;
        let count = 0;
        
        categories.forEach(cat => {
            if (detailedRatings[cat] && detailedRatings[cat].rating) {
                sum += detailedRatings[cat].rating;
                count++;
            }
        });
        
        return count > 0 ? (sum / count).toFixed(1) : null;
    }

    // Storage per polling attivi (evita duplicati)
    const activePollings = new Set();

    /**
     * Avvia polling automatico per una recensione in elaborazione
     * Continua a controllare lo status finché non diventa 'completed'
     * @param {string} reviewId - ID della recensione da monitorare
     */
    async function startProcessingPolling(reviewId) {
        if (!reviewId) {
            console.warn('[LatestReviewsModule] startProcessingPolling chiamato senza reviewId');
            return;
        }

        // Evita polling duplicati per la stessa recensione
        if (activePollings.has(reviewId)) {
            console.log(`[LatestReviewsModule] Polling già attivo per reviewId ${reviewId}`);
            return;
        }

        activePollings.add(reviewId);
        console.log(`[LatestReviewsModule] 🔄 Avvio polling automatico per reviewId ${reviewId}`);

        const maxAttempts = 18; // 3 minuti max (18 * 10s)
        const pollInterval = 10000; // 10 secondi
        let attempts = 0;

        const poll = async () => {
            attempts++;
            
            try {
                const response = await fetch(`/review/${reviewId}/status`);
                
                if (!response.ok) {
                    console.warn(`[LatestReviewsModule] Polling status ${response.status} per reviewId ${reviewId}`);
                    if (attempts < maxAttempts) {
                        setTimeout(poll, pollInterval);
                    } else {
                        console.log(`[LatestReviewsModule] ⏱️ Timeout polling per reviewId ${reviewId}`);
                        activePollings.delete(reviewId);
                    }
                    return;
                }

                const result = await response.json();
                // Il backend manda: { success, data: { status, result }, completed, shouldStopPolling }
                const status = result.data?.status || result.status;
                console.log(`[LatestReviewsModule] Polling #${attempts} - Status: ${status} per reviewId ${reviewId}`);

                if (status === 'completed' || result.completed) {
                    console.log(`[LatestReviewsModule] ✅ Job completato per reviewId ${reviewId}!`);
                    activePollings.delete(reviewId);
                    
                    // Aggiorna la card con i nuovi dati
                    const resultData = result.data?.result;
                    if (resultData && resultData.bottles && resultData.bottles.length > 0) {
                        updateReviewCard(reviewId, resultData);
                    } else {
                        // Se non ci sono dati, ricarica le recensioni (con skipPollingCheck=true per evitare loop)
                        console.log('[LatestReviewsModule] Dati non disponibili, ricarico recensioni...');
                        await loadLatestReviews(true);
                    }
                    return;
                }

                if (status === 'failed') {
                    console.error(`[LatestReviewsModule] ❌ Job fallito per reviewId ${reviewId}`);
                    activePollings.delete(reviewId);
                    // Rimuovi badge processing e mostra errore
                    const card = document.querySelector(`.review-card[data-review-id="${reviewId}"]`);
                    if (card) {
                        card.classList.remove('processing');
                        const badge = card.querySelector('.ai-processing-badge');
                        if (badge) badge.remove();
                    }
                    return;
                }

                // Continua polling se pending/processing
                if (attempts < maxAttempts) {
                    setTimeout(poll, pollInterval);
                } else {
                    console.log(`[LatestReviewsModule] ⏱️ Timeout polling per reviewId ${reviewId} dopo ${attempts} tentativi`);
                    activePollings.delete(reviewId);
                }
            } catch (error) {
                console.error(`[LatestReviewsModule] Errore polling per reviewId ${reviewId}:`, error);
                if (attempts < maxAttempts) {
                    setTimeout(poll, pollInterval * 2); // Retry con delay maggiore in caso di errore
                } else {
                    activePollings.delete(reviewId);
                }
            }
        };

        // Avvia primo polling con leggero delay
        setTimeout(poll, 500);
    }

    /**
     * Controlla le recensioni in elaborazione e avvia polling per ciascuna
     * Chiamato dopo il caricamento delle recensioni
     */
    function checkAndStartPollingForProcessingReviews() {
        // Debug: mostra tutti gli stati delle recensioni caricate
        console.log('[LatestReviewsModule] 📊 Stati recensioni caricate:', 
            reviewsData.map(r => ({
                id: r._id,
                processingStatus: r.processingStatus,
                isProcessing: r.isProcessing,
                beerName: r.beerName
            }))
        );
        
        const processingReviews = reviewsData.filter(r => 
            r.isProcessing || 
            r.processingStatus === 'pending_validation' || 
            r.processingStatus === 'processing'
        );

        if (processingReviews.length > 0) {
            console.log(`[LatestReviewsModule] 🔍 Trovate ${processingReviews.length} recensioni in elaborazione - avvio polling`);
            processingReviews.forEach(review => {
                const reviewId = review._id || review.id;
                if (reviewId) {
                    startProcessingPolling(reviewId);
                }
            });
        } else {
            console.log('[LatestReviewsModule] ✅ Nessuna recensione in elaborazione - polling non necessario');
        }
    }

    /**
     * Controlla e avvia polling per le recensioni in elaborazione nella pagina allReviews
     * Usa i data attributes delle card per trovare quelle in processing
     */
    function checkAndStartPollingForAllReviewsPage() {
        const processingCards = document.querySelectorAll('#reviews-list .review-card.processing');
        
        if (processingCards.length > 0) {
            console.log(`[LatestReviewsModule] 🔍 Trovate ${processingCards.length} recensioni in elaborazione (allReviews) - avvio polling`);
            processingCards.forEach(card => {
                const reviewId = card.dataset.reviewId;
                if (reviewId) {
                    startProcessingPolling(reviewId);
                }
            });
        } else {
            console.log('[LatestReviewsModule] ✅ Nessuna recensione in elaborazione (allReviews) - polling non necessario');
        }
    }

    /**
     * Inizializzazione modulo
     */
    function init() {
        // Pagina welcome - container ultime recensioni
        const latestContainer = document.getElementById('latest-reviews-list');
        if (latestContainer) {
            console.log('[LatestReviewsModule] Inizializzazione - Container ultime recensioni trovato');
            loadLatestReviews();
        }
        
        // Pagina allReviews - lista completa recensioni
        const allReviewsContainer = document.getElementById('reviews-list');
        if (allReviewsContainer && !latestContainer) {
            console.log('[LatestReviewsModule] Inizializzazione - Pagina tutte le recensioni');
            attachAllReviewsClickHandlers();
            // 🔄 Avvia polling automatico per recensioni in elaborazione
            checkAndStartPollingForAllReviewsPage();
        }
    }

    // API pubblica
    return {
        init,
        loadLatestReviews,
        openReviewPopup,
        closeReviewPopup,
        attachAllReviewsClickHandlers,
        updateReviewCard,  // Aggiunto per aggiornamento real-time cards
        startProcessingPolling  // Esposto per uso esterno se necessario
    };
})();

// Export globale
if (typeof window !== 'undefined') {
    window.LatestReviewsModule = LatestReviewsModule;
}

// Auto-inizializzazione
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        LatestReviewsModule.init();
    });
} else {
    LatestReviewsModule.init();
}
