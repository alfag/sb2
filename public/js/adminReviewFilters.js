/**
 * Admin Review Filters - Dashboard Recensioni
 * Gestisce filtri, ordinamento, modali e azioni di moderazione
 * @version 1.0.0
 * @date 29 Dicembre 2025
 */

(function() {
    'use strict';

    // ============================================
    // INIZIALIZZAZIONE
    // ============================================
    
    document.addEventListener('DOMContentLoaded', function() {
        initSearchFilters();
        initStatBoxFilters();
        initKeyboardShortcuts();
        console.log('📋 Admin Review Filters initialized');
    });

    // ============================================
    // FILTRI E RICERCA
    // ============================================
    
    /**
     * Inizializza la ricerca con debounce
     */
    function initSearchFilters() {
        const searchInput = document.getElementById('searchReviews');
        const sortSelect = document.getElementById('sortOrder');
        
        if (searchInput) {
            let debounceTimer;
            searchInput.addEventListener('input', function() {
                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(() => {
                    applyFilters();
                }, 300);
            });
        }
        
        if (sortSelect) {
            sortSelect.addEventListener('change', function() {
                applyFilters();
            });
        }
    }

    /**
     * Inizializza i click sui box statistiche per filtrare (client-side)
     */
    function initStatBoxFilters() {
        const statBoxes = document.querySelectorAll('.stat-box[data-filter]');
        statBoxes.forEach(box => {
            box.style.cursor = 'pointer';
            box.addEventListener('click', function() {
                const filter = this.dataset.filter;
                if (filter) {
                    filterReviewsByStatus(filter, this);
                }
            });
        });
    }

    /**
     * Filtro attivo corrente
     */
    let currentFilter = 'all';

    /**
     * Filtra le recensioni per stato (client-side senza ricaricare la pagina)
     */
    function filterReviewsByStatus(filter, clickedBox) {
        const rows = document.querySelectorAll('.review-row');
        const statBoxes = document.querySelectorAll('.stat-box[data-filter]');
        
        // Rimuovi classe active da tutti i box
        statBoxes.forEach(box => box.classList.remove('active'));
        
        // Se clicco lo stesso filtro, reset a tutti
        if (currentFilter === filter) {
            filter = 'all';
        }
        
        currentFilter = filter;
        
        // Aggiungi classe active al box selezionato
        if (filter !== 'all' && clickedBox) {
            clickedBox.classList.add('active');
        }
        
        let visibleCount = 0;
        
        rows.forEach(row => {
            const status = row.dataset.status || '';
            const processing = row.dataset.processing || '';
            const isHidden = row.dataset.hidden === 'true';
            const isFlagged = row.dataset.flagged === 'true';
            
            let shouldShow = false;
            
            if (filter === 'all') {
                shouldShow = true;
            } else if (filter === 'pending') {
                shouldShow = status === 'pending' || processing === 'pending';
            } else if (filter === 'validated') {
                shouldShow = status === 'validated';
            } else if (filter === 'completed') {
                shouldShow = status === 'completed' || processing === 'completed';
            } else if (filter === 'hidden') {
                shouldShow = isHidden;
            } else if (filter === 'needs_admin_review') {
                shouldShow = status === 'needs_admin_review' || processing === 'needs_review';
            } else if (filter === 'flagged') {
                shouldShow = isFlagged;
            }
            
            if (shouldShow) {
                row.classList.remove('filtered-out');
                visibleCount++;
            } else {
                row.classList.add('filtered-out');
            }
        });
        
        // Aggiorna indicatore filtro
        updateFilterIndicator(filter, visibleCount);
    }

    /**
     * Aggiorna l'indicatore del filtro attivo
     */
    function updateFilterIndicator(filter, count) {
        let indicator = document.querySelector('.filter-indicator');
        
        if (filter === 'all') {
            // Rimuovi indicatore se presente
            if (indicator) {
                indicator.remove();
            }
            return;
        }
        
        // Mappa filtri a etichette
        const filterLabels = {
            'pending': 'In Attesa',
            'validated': 'Validate',
            'completed': 'Complete',
            'hidden': 'Nascoste',
            'needs_admin_review': 'Da Verificare',
            'flagged': 'Segnalate'
        };
        
        const label = filterLabels[filter] || filter;
        
        // Crea o aggiorna indicatore
        if (!indicator) {
            indicator = document.createElement('div');
            indicator.className = 'filter-indicator';
            const statsRow = document.querySelector('.stats-row');
            if (statsRow) {
                statsRow.parentNode.insertBefore(indicator, statsRow.nextSibling);
            }
        }
        
        indicator.innerHTML = `
            <span class="filter-badge">
                <i class="fas fa-filter"></i>
                Filtro attivo: ${label} (${count} risultati)
            </span>
            <button class="btn-clear-filter" onclick="clearClientFilter()">
                <i class="fas fa-times"></i> Rimuovi filtro
            </button>
        `;
    }

    /**
     * Rimuove il filtro client-side
     */
    window.clearClientFilter = function() {
        const rows = document.querySelectorAll('.review-row');
        const statBoxes = document.querySelectorAll('.stat-box[data-filter]');
        
        // Rimuovi classe active da tutti i box
        statBoxes.forEach(box => box.classList.remove('active'));
        
        // Mostra tutte le righe
        rows.forEach(row => row.classList.remove('filtered-out'));
        
        // Reset filtro corrente
        currentFilter = 'all';
        
        // Rimuovi indicatore
        const indicator = document.querySelector('.filter-indicator');
        if (indicator) {
            indicator.remove();
        }
    };

    /**
     * Inizializza scorciatoie da tastiera
     */
    function initKeyboardShortcuts() {
        document.addEventListener('keydown', function(e) {
            // ESC chiude tutti i modal
            if (e.key === 'Escape') {
                closeAllModals();
            }
            // Ctrl+F focus sulla ricerca
            if (e.ctrlKey && e.key === 'f') {
                e.preventDefault();
                const searchInput = document.getElementById('searchReviews');
                if (searchInput) {
                    searchInput.focus();
                }
            }
        });
    }

    /**
     * Applica i filtri attuali
     */
    function applyFilters() {
        const searchInput = document.getElementById('searchReviews');
        const sortSelect = document.getElementById('sortOrder');
        
        const params = new URLSearchParams(window.location.search);
        
        if (searchInput && searchInput.value.trim()) {
            params.set('search', searchInput.value.trim());
        } else {
            params.delete('search');
        }
        
        if (sortSelect && sortSelect.value) {
            params.set('sort', sortSelect.value);
        }
        
        window.location.href = `/administrator/reviews?${params.toString()}`;
    }

    /**
     * Rimuove tutti i filtri
     */
    window.clearFilters = function() {
        window.location.href = '/administrator/reviews';
    };

    // ============================================
    // MODAL IMMAGINE
    // ============================================
    
    /**
     * Mostra il modal con l'immagine della recensione
     */
    window.showImageModal = function(imageUrl) {
        const modal = document.getElementById('imageModal');
        const modalImage = document.getElementById('modalImage');
        
        if (modal && modalImage) {
            modalImage.src = imageUrl;
            modal.style.display = 'flex';
            document.body.style.overflow = 'hidden';
        }
    };

    /**
     * Chiude il modal immagine
     */
    window.closeImageModal = function() {
        const modal = document.getElementById('imageModal');
        if (modal) {
            modal.style.display = 'none';
            document.body.style.overflow = 'auto';
        }
    };

    // ============================================
    // MODAL DETTAGLI RECENSIONE
    // ============================================
    
    /**
     * Mostra i dettagli completi della recensione
     */
    window.showReviewDetails = async function(reviewId) {
        const modal = document.getElementById('detailsModal');
        const content = document.getElementById('detailsContent');
        
        if (!modal || !content) return;
        
        // Mostra loading
        content.innerHTML = `
            <div class="text-center p-4">
                <div class="spinner-border text-primary" role="status">
                    <span class="visually-hidden">Caricamento...</span>
                </div>
            </div>
        `;
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
        
        try {
            const response = await fetch(`/administrator/api/reviews/${reviewId}`);
            if (!response.ok) throw new Error('Errore nel caricamento');
            
            const data = await response.json();
            if (data.success) {
                renderReviewDetails(data.review);
            } else {
                throw new Error(data.message || 'Errore sconosciuto');
            }
        } catch (error) {
            content.innerHTML = `
                <div class="alert alert-danger">
                    <i class="fas fa-exclamation-circle me-2"></i>
                    Errore nel caricamento dei dettagli: ${error.message}
                </div>
            `;
        }
    };

    /**
     * Renderizza i dettagli della recensione
     */
    function renderReviewDetails(review) {
        const content = document.getElementById('detailsContent');
        if (!content) return;
        
        const ratings = review.ratings || {};
        const user = review.user || {};
        const beer = review.beerDetails || {};
        const brewery = review.breweryDetails || {};
        const moderation = review.moderation || {};
        
        content.innerHTML = `
            <div class="review-detail-grid">
                <!-- Sezione Immagine -->
                ${review.imageUrl ? `
                <div class="detail-section">
                    <h6><i class="fas fa-image me-2"></i>Immagine</h6>
                    <img src="${review.imageUrl}" alt="Review Image" class="img-fluid rounded" style="max-height: 200px;">
                </div>
                ` : ''}
                
                <!-- Sezione Utente -->
                <div class="detail-section">
                    <h6><i class="fas fa-user me-2"></i>Utente</h6>
                    <p><strong>Username:</strong> ${user.username || 'N/A'}</p>
                    <p><strong>Email:</strong> ${user.email || 'N/A'}</p>
                    <p><strong>ID:</strong> <code>${review.user?._id || review.user || 'N/A'}</code></p>
                    ${user.isBanned ? '<span class="badge bg-danger">BANNATO</span>' : ''}
                </div>
                
                <!-- Sezione Birra -->
                <div class="detail-section">
                    <h6><i class="fas fa-beer me-2"></i>Birra</h6>
                    <p><strong>Nome:</strong> ${beer.beerName || 'N/A'}</p>
                    <p><strong>Tipo:</strong> ${beer.beerType || 'N/A'}</p>
                    <p><strong>ABV:</strong> ${beer.alcoholContent ? beer.alcoholContent + '%' : 'N/A'}</p>
                </div>
                
                <!-- Sezione Birrificio -->
                <div class="detail-section">
                    <h6><i class="fas fa-industry me-2"></i>Birrificio</h6>
                    <p><strong>Nome:</strong> ${brewery.breweryName || 'N/A'}</p>
                    <p><strong>Località:</strong> ${brewery.breweryCity || 'N/A'}</p>
                </div>
                
                <!-- Sezione Valutazioni -->
                <div class="detail-section">
                    <h6><i class="fas fa-star me-2"></i>Valutazioni</h6>
                    <div class="ratings-grid">
                        <div class="rating-item">
                            <span>Aspetto</span>
                            <span class="rating-stars">${generateStars(ratings.appearance)}</span>
                        </div>
                        <div class="rating-item">
                            <span>Aroma</span>
                            <span class="rating-stars">${generateStars(ratings.aroma)}</span>
                        </div>
                        <div class="rating-item">
                            <span>Gusto</span>
                            <span class="rating-stars">${generateStars(ratings.taste)}</span>
                        </div>
                        <div class="rating-item">
                            <span>Corpo</span>
                            <span class="rating-stars">${generateStars(ratings.mouthfeel)}</span>
                        </div>
                        <div class="rating-item">
                            <span><strong>Complessivo</strong></span>
                            <span class="rating-stars">${generateStars(ratings.overall)}</span>
                        </div>
                    </div>
                </div>
                
                <!-- Sezione Note -->
                ${review.notes ? `
                <div class="detail-section">
                    <h6><i class="fas fa-comment me-2"></i>Note</h6>
                    <p class="review-notes">${escapeHtml(review.notes)}</p>
                </div>
                ` : ''}
                
                <!-- Sezione Moderazione -->
                <div class="detail-section">
                    <h6><i class="fas fa-shield-alt me-2"></i>Moderazione</h6>
                    <p><strong>Stato:</strong> <span class="badge ${getStatusBadgeClass(review.status)}">${getStatusLabel(review.status)}</span></p>
                    <p><strong>Nascosta:</strong> ${moderation.isHidden ? '<span class="badge bg-warning">Sì</span>' : '<span class="badge bg-success">No</span>'}</p>
                    <p><strong>Segnalazioni:</strong> ${moderation.flagCount || 0}</p>
                    ${moderation.moderationReason ? `<p><strong>Motivo:</strong> ${moderation.moderationReason}</p>` : ''}
                    ${moderation.moderatedAt ? `<p><strong>Data moderazione:</strong> ${formatDate(moderation.moderatedAt)}</p>` : ''}
                </div>
                
                <!-- Sezione Location -->
                ${review.location?.coordinates ? `
                <div class="detail-section">
                    <h6><i class="fas fa-map-marker-alt me-2"></i>Posizione</h6>
                    <p><strong>Lat:</strong> ${review.location.coordinates.latitude || 'N/A'}</p>
                    <p><strong>Lng:</strong> ${review.location.coordinates.longitude || 'N/A'}</p>
                </div>
                ` : ''}
                
                <!-- Sezione Metadati -->
                <div class="detail-section">
                    <h6><i class="fas fa-info-circle me-2"></i>Metadati</h6>
                    <p><strong>ID Recensione:</strong> <code>${review._id}</code></p>
                    <p><strong>Creata:</strong> ${formatDate(review.createdAt)}</p>
                    <p><strong>Aggiornata:</strong> ${formatDate(review.updatedAt)}</p>
                    <p><strong>Processing:</strong> <span class="badge ${getProcessingBadgeClass(review.processingStatus)}">${review.processingStatus || 'N/A'}</span></p>
                </div>
                
                <!-- Storico Moderazione -->
                ${moderation.moderationHistory && moderation.moderationHistory.length > 0 ? `
                <div class="detail-section full-width">
                    <h6><i class="fas fa-history me-2"></i>Storico Moderazione</h6>
                    <div class="moderation-history">
                        ${moderation.moderationHistory.map(h => `
                            <div class="history-item">
                                <span class="history-action">${h.action}</span>
                                <span class="history-reason">${h.reason || 'N/A'}</span>
                                <span class="history-date">${formatDate(h.date)}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
                ` : ''}
            </div>
        `;
    }

    /**
     * Chiude il modal dettagli
     */
    window.closeDetailsModal = function() {
        const modal = document.getElementById('detailsModal');
        if (modal) {
            modal.style.display = 'none';
            document.body.style.overflow = 'auto';
        }
    };

    // ============================================
    // MODAL NASCONDI/MOSTRA RECENSIONE
    // ============================================
    
    let currentHideReviewId = null;
    let currentHideAction = null;

    /**
     * Mostra il modal per nascondere/mostrare una recensione
     */
    window.toggleReviewVisibility = function(reviewId, hide) {
        currentHideReviewId = reviewId;
        currentHideAction = hide ? 'hide' : 'unhide';
        
        const modal = document.getElementById('hideModal');
        const title = document.getElementById('hideModalTitle');
        const reasonGroup = document.getElementById('hideReasonGroup');
        const submitBtn = document.getElementById('hideSubmitBtn');
        
        if (modal && title) {
            if (hide) {
                title.innerHTML = '<i class="fas fa-eye-slash me-2"></i>Nascondi Recensione';
                if (reasonGroup) reasonGroup.style.display = 'block';
                if (submitBtn) {
                    submitBtn.textContent = 'Nascondi';
                    submitBtn.className = 'btn btn-warning';
                }
            } else {
                title.innerHTML = '<i class="fas fa-eye me-2"></i>Mostra Recensione';
                if (reasonGroup) reasonGroup.style.display = 'none';
                if (submitBtn) {
                    submitBtn.textContent = 'Mostra';
                    submitBtn.className = 'btn btn-success';
                }
            }
            
            modal.style.display = 'flex';
            document.body.style.overflow = 'hidden';
        }
    };

    /**
     * Invia la richiesta di hide/unhide
     */
    window.submitHideToggle = async function(event) {
        event.preventDefault();
        
        if (!currentHideReviewId) return;
        
        const reasonSelect = document.getElementById('hideReason');
        const customReason = document.getElementById('customHideReason');
        
        let reason = '';
        if (currentHideAction === 'hide') {
            reason = reasonSelect?.value === 'altro' ? customReason?.value : reasonSelect?.value;
        }
        
        try {
            const response = await fetch(`/administrator/api/reviews/${currentHideReviewId}/visibility`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    hide: currentHideAction === 'hide',
                    reason: reason
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                showToast('success', data.message || 'Operazione completata');
                closeHideModal();
                setTimeout(() => window.location.reload(), 1000);
            } else {
                showToast('error', data.message || 'Errore durante l\'operazione');
            }
        } catch (error) {
            showToast('error', 'Errore di connessione');
        }
    };

    /**
     * Chiude il modal hide
     */
    window.closeHideModal = function() {
        const modal = document.getElementById('hideModal');
        if (modal) {
            modal.style.display = 'none';
            document.body.style.overflow = 'auto';
        }
        currentHideReviewId = null;
        currentHideAction = null;
        
        // Reset form
        const form = document.getElementById('hideForm');
        if (form) form.reset();
        toggleCustomReason();
    };

    /**
     * Toggle campo motivo personalizzato
     */
    window.toggleCustomReason = function() {
        const select = document.getElementById('hideReason');
        const customGroup = document.getElementById('customHideReasonGroup');
        
        if (customGroup) {
            customGroup.style.display = select?.value === 'altro' ? 'block' : 'none';
        }
    };

    // ============================================
    // MODAL CAMBIO STATO
    // ============================================
    
    let currentStatusReviewId = null;

    /**
     * Mostra il modal per cambiare lo stato
     */
    window.showStatusModal = function(reviewId, currentStatus) {
        currentStatusReviewId = reviewId;
        
        const modal = document.getElementById('statusModal');
        const statusSelect = document.getElementById('newStatus');
        
        if (modal && statusSelect) {
            statusSelect.value = currentStatus || 'pending';
            modal.style.display = 'flex';
            document.body.style.overflow = 'hidden';
        }
    };

    /**
     * Invia il cambio di stato
     */
    window.submitStatusChange = async function(event) {
        event.preventDefault();
        
        if (!currentStatusReviewId) return;
        
        const statusSelect = document.getElementById('newStatus');
        const newStatus = statusSelect?.value;
        
        if (!newStatus) {
            showToast('error', 'Seleziona uno stato');
            return;
        }
        
        try {
            const response = await fetch(`/administrator/api/reviews/${currentStatusReviewId}/status`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus })
            });
            
            const data = await response.json();
            
            if (data.success) {
                showToast('success', data.message || 'Stato aggiornato');
                closeStatusModal();
                setTimeout(() => window.location.reload(), 1000);
            } else {
                showToast('error', data.message || 'Errore durante l\'aggiornamento');
            }
        } catch (error) {
            showToast('error', 'Errore di connessione');
        }
    };

    /**
     * Chiude il modal stato
     */
    window.closeStatusModal = function() {
        const modal = document.getElementById('statusModal');
        if (modal) {
            modal.style.display = 'none';
            document.body.style.overflow = 'auto';
        }
        currentStatusReviewId = null;
    };

    // ============================================
    // MODAL BAN UTENTE
    // ============================================
    
    let currentBanUserId = null;

    /**
     * Mostra il modal per bannare un utente
     */
    window.showBanModal = function(userId, username) {
        currentBanUserId = userId;
        
        const modal = document.getElementById('banModal');
        const usernameSpan = document.getElementById('banUsername');
        
        if (modal) {
            if (usernameSpan) usernameSpan.textContent = username || 'Utente';
            modal.style.display = 'flex';
            document.body.style.overflow = 'hidden';
        }
    };

    /**
     * Invia la richiesta di ban
     */
    window.submitBan = async function(event) {
        event.preventDefault();
        
        if (!currentBanUserId) return;
        
        const reasonSelect = document.getElementById('banReason');
        const customReason = document.getElementById('customBanReason');
        const durationSelect = document.getElementById('banDuration');
        
        const reason = reasonSelect?.value === 'altro' ? customReason?.value : reasonSelect?.value;
        const duration = durationSelect?.value;
        
        if (!reason) {
            showToast('error', 'Specifica un motivo per il ban');
            return;
        }
        
        try {
            const response = await fetch(`/administrator/api/users/${currentBanUserId}/ban`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    reason: reason,
                    duration: duration
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                showToast('success', data.message || 'Utente bannato');
                closeBanModal();
                setTimeout(() => window.location.reload(), 1000);
            } else {
                showToast('error', data.message || 'Errore durante il ban');
            }
        } catch (error) {
            showToast('error', 'Errore di connessione');
        }
    };

    /**
     * Chiude il modal ban
     */
    window.closeBanModal = function() {
        const modal = document.getElementById('banModal');
        if (modal) {
            modal.style.display = 'none';
            document.body.style.overflow = 'auto';
        }
        currentBanUserId = null;
        
        // Reset form
        const form = document.getElementById('banForm');
        if (form) form.reset();
        toggleCustomBanReason();
    };

    /**
     * Toggle campo motivo ban personalizzato
     */
    window.toggleCustomBanReason = function() {
        const select = document.getElementById('banReason');
        const customGroup = document.getElementById('customBanReasonGroup');
        
        if (customGroup) {
            customGroup.style.display = select?.value === 'altro' ? 'block' : 'none';
        }
    };

    // ============================================
    // MODAL ELIMINA RECENSIONE
    // ============================================
    
    let currentDeleteReviewId = null;

    /**
     * Mostra il modal per eliminare una recensione
     */
    window.showDeleteModal = function(reviewId) {
        currentDeleteReviewId = reviewId;
        
        const modal = document.getElementById('deleteModal');
        if (modal) {
            modal.style.display = 'flex';
            document.body.style.overflow = 'hidden';
        }
    };

    /**
     * Invia la richiesta di eliminazione
     */
    window.submitDelete = async function(event) {
        event.preventDefault();
        
        if (!currentDeleteReviewId) return;
        
        try {
            const response = await fetch(`/administrator/api/reviews/${currentDeleteReviewId}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' }
            });
            
            const data = await response.json();
            
            if (data.success) {
                showToast('success', data.message || 'Recensione eliminata');
                closeDeleteModal();
                setTimeout(() => window.location.reload(), 1000);
            } else {
                showToast('error', data.message || 'Errore durante l\'eliminazione');
            }
        } catch (error) {
            showToast('error', 'Errore di connessione');
        }
    };

    /**
     * Chiude il modal delete
     */
    window.closeDeleteModal = function() {
        const modal = document.getElementById('deleteModal');
        if (modal) {
            modal.style.display = 'none';
            document.body.style.overflow = 'auto';
        }
        currentDeleteReviewId = null;
    };

    // ============================================
    // UTILITY FUNCTIONS
    // ============================================
    
    /**
     * Chiude tutti i modal aperti
     */
    function closeAllModals() {
        closeImageModal();
        closeDetailsModal();
        closeHideModal();
        closeStatusModal();
        closeBanModal();
        closeDeleteModal();
    }

    /**
     * Genera stelle HTML per rating
     */
    function generateStars(rating) {
        if (!rating && rating !== 0) return '<span class="text-muted">N/A</span>';
        
        const fullStars = Math.floor(rating);
        const halfStar = rating % 1 >= 0.5;
        const emptyStars = 5 - fullStars - (halfStar ? 1 : 0);
        
        let html = '';
        for (let i = 0; i < fullStars; i++) {
            html += '<i class="fas fa-star text-warning"></i>';
        }
        if (halfStar) {
            html += '<i class="fas fa-star-half-alt text-warning"></i>';
        }
        for (let i = 0; i < emptyStars; i++) {
            html += '<i class="far fa-star text-warning"></i>';
        }
        html += ` <small>(${rating.toFixed(1)})</small>`;
        
        return html;
    }

    /**
     * Formatta una data
     */
    function formatDate(dateString) {
        if (!dateString) return 'N/A';
        const date = new Date(dateString);
        return date.toLocaleDateString('it-IT', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    /**
     * Escape HTML per prevenire XSS
     */
    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Ottiene la classe badge per lo stato
     */
    function getStatusBadgeClass(status) {
        const classes = {
            'pending': 'bg-warning',
            'validated': 'bg-info',
            'completed': 'bg-success',
            'rejected': 'bg-danger'
        };
        return classes[status] || 'bg-secondary';
    }

    /**
     * Ottiene la label per lo stato
     */
    function getStatusLabel(status) {
        const labels = {
            'pending': 'In Attesa',
            'validated': 'Validata',
            'completed': 'Completata',
            'rejected': 'Rifiutata'
        };
        return labels[status] || status || 'N/A';
    }

    /**
     * Ottiene la classe badge per processing status
     */
    function getProcessingBadgeClass(status) {
        const classes = {
            'pending_validation': 'bg-warning',
            'processing': 'bg-info',
            'completed': 'bg-success',
            'failed': 'bg-danger',
            'needs_admin_review': 'bg-purple'
        };
        return classes[status] || 'bg-secondary';
    }

    /**
     * Mostra una notifica toast
     */
    function showToast(type, message) {
        const container = document.getElementById('toastContainer');
        if (!container) return;
        
        const toast = document.createElement('div');
        toast.className = `toast-notification toast-${type}`;
        
        const icon = type === 'success' ? 'check-circle' : 
                     type === 'error' ? 'exclamation-circle' : 
                     type === 'warning' ? 'exclamation-triangle' : 'info-circle';
        
        toast.innerHTML = `
            <i class="fas fa-${icon} me-2"></i>
            <span>${escapeHtml(message)}</span>
            <button type="button" class="toast-close" onclick="this.parentElement.remove()">
                <i class="fas fa-times"></i>
            </button>
        `;
        
        container.appendChild(toast);
        
        // Trigger animation
        setTimeout(() => toast.classList.add('show'), 10);
        
        // Auto remove after 5s
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 5000);
    }

    // Export showToast for global use
    window.showToast = showToast;

})();
