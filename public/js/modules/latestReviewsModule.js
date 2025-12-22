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
     */
    async function loadLatestReviews() {
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
        
        const gradients = [
            'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
            'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
            'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
            'linear-gradient(135deg, #fa709a 0%, #fee140 100%)'
        ];
        
        const gradientBorder = gradients[index % gradients.length];
        
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
        
        return `
            <div class="review-card${isProcessing ? ' processing' : ''}" data-review-index="${index}" role="button" tabindex="0">
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
        }
    }

    // API pubblica
    return {
        init,
        loadLatestReviews,
        openReviewPopup,
        closeReviewPopup,
        attachAllReviewsClickHandlers
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
