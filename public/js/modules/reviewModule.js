/**
 * Modulo per la gestione delle recensioni
 * Gestisce rating stelle, form recensioni e pubblicazione
 */
class ReviewModule {
  constructor() {
    this.currentReviewData = null;
    this.ratings = new Map(); // bottleIndex -> { category -> rating }
    this.notes = new Map(); // bottleIndex -> { category -> notes }
  }

  /**
   * Inizializza il modulo recensioni
   */
  init() {
    this.bindEvents();
    this.setupEventListeners();
    
    // Controlla se ci sono già dati AI disponibili
    if (window.currentReviewData) {
      console.log('[ReviewModule] Dati AI già disponibili, inizializzo interfaccia');
      this.handleAnalysisComplete(window.currentReviewData);
    }
    
    console.log('[ReviewModule] Modulo recensioni inizializzato');
  }

  /**
   * Binding degli eventi recensioni
   */
  bindEvents() {
    // Listener per completamento analisi AI
    window.addEventListener('aiAnalysisComplete', (event) => {
      this.handleAnalysisComplete(event.detail.data);
    });

    // Listener per quando window.currentReviewData viene aggiornato
    let currentReviewDataValue = window.currentReviewData;
    const checkForReviewData = () => {
      if (window.currentReviewData && window.currentReviewData !== currentReviewDataValue) {
        console.log('[ReviewModule] Rilevati nuovi dati AI in window.currentReviewData');
        currentReviewDataValue = window.currentReviewData;
        this.handleAnalysisComplete(window.currentReviewData);
      }
    };
    
    // Controlla periodicamente per nuovi dati (ogni 500ms)
    setInterval(checkForReviewData, 500);

    // Bottone pubblica recensione
    const publishBtn = document.getElementById('publish-review');
    if (publishBtn) {
      window.eventManager.addListener(publishBtn, 'click', 
        this.handlePublishClick.bind(this), 'review-publish-btn');
    }
  }

  /**
   * Setup event listeners dinamici
   */
  setupEventListeners() {
    // Listener per stelle rating (delegated events)
    document.addEventListener('click', (event) => {
      if (event.target.classList.contains('star')) {
        this.handleStarClick(event);
      }
    });

    // Listener per note textarea
    document.addEventListener('input', (event) => {
      if (event.target.hasAttribute('data-notes')) {
        this.handleNotesInput(event);
      }
    });

    // Listener per toggle valutazioni dettagliate
    document.addEventListener('click', (event) => {
      if (event.target.classList.contains('toggle-detailed')) {
        this.handleToggleDetailed(event);
      }
    });
  }

  /**
   * Gestisce completamento analisi AI
   */
  handleAnalysisComplete(data) {
    console.log('[ReviewModule] Analisi AI completata, aggiorno interfaccia');
    
    this.currentReviewData = data;
    
    // Nasconde il bottone principale e la call-to-action quando inizia il processo
    const startReviewBtn = document.getElementById('start-review-process');
    const callToAction = document.querySelector('.review-call-to-action');
    
    if (startReviewBtn) {
      startReviewBtn.style.display = 'none';
      console.log('[ReviewModule] Bottone principale nascosto');
    }
    
    if (callToAction) {
      callToAction.style.display = 'none';
      console.log('[ReviewModule] Call-to-action nascosta');
    }
    
    this.generateReviewInterface(data);
    this.showReviewSection();
  }

  /**
   * Genera interfaccia recensioni
   */
  generateReviewInterface(data) {
    const container = document.getElementById('review-interface');
    if (!container) return;

    let html = '<div class="reviews-container">';

    data.bottles.forEach((bottle, index) => {
      html += this.generateBottleReviewHTML(bottle, index);
    });

    html += '</div>';
    html += this.generatePublishButtonHTML();

    container.innerHTML = html;
    this.initializeRatings(data.bottles.length);
  }

  /**
   * Genera HTML per recensione singola birra
   */
  generateBottleReviewHTML(bottle, index) {
    return `
      <div class="bottle-review" data-bottle-index="${index}">
        <div class="bottle-header">
          <img src="${bottle.thumbnail || '/images/default-beer.png'}" 
               alt="${bottle.bottleLabel}" class="beer-thumbnail">
          <div class="bottle-info">
            <h3>${bottle.bottleLabel}</h3>
            <p class="brewery">${bottle.breweryName}</p>
            <p class="beer-type">${bottle.beerType} - ${bottle.alcoholContent}</p>
          </div>
        </div>

        <!-- Rating Generale -->
        <div class="rating-section">
          <label>Valutazione Generale:</label>
          <div class="stars-container" data-bottle="${index}" data-category="overall">
            ${this.generateStarsHTML(5)}
          </div>
        </div>

        <!-- Note Generali -->
        <div class="notes-section">
          <label for="notes-${index}-general">Note Generali:</label>
          <textarea id="notes-${index}-general" 
                    data-notes="${index}" 
                    data-category="general"
                    placeholder="Descrivi la tua esperienza con questa birra..."></textarea>
        </div>

        <!-- Toggle Valutazioni Dettagliate -->
        <button class="toggle-detailed" data-bottle="${index}">
          Valutazioni Dettagliate
        </button>

        <!-- Valutazioni Dettagliate -->
        <div class="detailed-ratings" id="detailed-${index}" style="display: none;">
          ${this.generateDetailedRatingsHTML(index)}
        </div>
      </div>
    `;
  }

  /**
   * Genera HTML per valutazioni dettagliate
   */
  generateDetailedRatingsHTML(bottleIndex) {
    const categories = [
      { key: 'appearance', label: 'Aspetto' },
      { key: 'aroma', label: 'Aroma' },
      { key: 'taste', label: 'Gusto' },
      { key: 'mouthfeel', label: 'Sensazione in Bocca' }
    ];

    return categories.map(cat => `
      <div class="detailed-category">
        <label>${cat.label}:</label>
        <div class="stars-container" data-bottle="${bottleIndex}" data-category="${cat.key}">
          ${this.generateStarsHTML(5)}
        </div>
        <textarea data-notes="${bottleIndex}" 
                  data-category="${cat.key}"
                  placeholder="Note per ${cat.label.toLowerCase()}..."></textarea>
      </div>
    `).join('');
  }

  /**
   * Genera HTML per stelle rating
   */
  generateStarsHTML(count) {
    let html = '';
    for (let i = 1; i <= count; i++) {
      html += `<span class="star" data-rating="${i}">★</span>`;
    }
    return html;
  }

  /**
   * Genera HTML per bottone pubblica
   */
  generatePublishButtonHTML() {
    return `
      <div class="publish-section">
        <button id="publish-review" class="btn-primary">
          Pubblica Recensioni
        </button>
      </div>
    `;
  }

  /**
   * Inizializza tracking ratings
   */
  initializeRatings(bottleCount) {
    for (let i = 0; i < bottleCount; i++) {
      this.ratings.set(i, new Map());
      this.notes.set(i, new Map());
    }
  }

  /**
   * Gestisce click su stella
   */
  handleStarClick(event) {
    const star = event.target;
    // Supporta sia il nuovo sistema (.stars-container) che il legacy (.rating-stars)
    const container = star.closest('.stars-container') || star.closest('.rating-stars');
    
    if (!container) {
      console.log('[ReviewModule] Container stelle non trovato per:', star);
      return;
    }

    const bottleIndex = parseInt(container.dataset.bottle);
    const category = container.dataset.category;
    const rating = parseInt(star.dataset.rating);
    
    console.log(`[ReviewModule] Click stella: bottiglia ${bottleIndex}, categoria ${category}, rating ${rating}`);

    this.setRating(bottleIndex, category, rating);
    this.updateStarsDisplay(container, rating);
  }

  /**
   * Imposta rating per categoria
   */
  setRating(bottleIndex, category, rating) {
    if (!this.ratings.has(bottleIndex)) {
      this.ratings.set(bottleIndex, new Map());
    }
    this.ratings.get(bottleIndex).set(category, rating);

    console.log(`[ReviewModule] Rating impostato: Bottle ${bottleIndex}, ${category} = ${rating}`);
  }

  /**
   * Aggiorna display stelle
   */
  updateStarsDisplay(container, rating) {
    const stars = container.querySelectorAll('.star');
    stars.forEach((star, index) => {
      star.classList.toggle('selected', index < rating);
    });
  }

  /**
   * Gestisce input note
   */
  handleNotesInput(event) {
    const textarea = event.target;
    const bottleIndex = parseInt(textarea.dataset.notes);
    const category = textarea.dataset.category;
    const notes = textarea.value;

    this.setNotes(bottleIndex, category, notes);
  }

  /**
   * Imposta note per categoria
   */
  setNotes(bottleIndex, category, notes) {
    if (!this.notes.has(bottleIndex)) {
      this.notes.set(bottleIndex, new Map());
    }
    this.notes.get(bottleIndex).set(category, notes);
  }

  /**
   * Gestisce toggle valutazioni dettagliate
   */
  handleToggleDetailed(event) {
    const button = event.target;
    const bottleIndex = button.dataset.bottle;
    const detailedSection = document.getElementById(`detailed-${bottleIndex}`);

    if (detailedSection) {
      const isVisible = detailedSection.style.display !== 'none';
      detailedSection.style.display = isVisible ? 'none' : 'block';
      button.textContent = isVisible ? 'Valutazioni Dettagliate' : 'Nascondi Dettagli';
    }
  }

  /**
   * Gestisce click pubblica
   */
  async handlePublishClick(event) {
    console.log('[ReviewModule] Click pubblica recensioni ricevuto');
    console.log('[ReviewModule] Event details:', event);
    
    if (!this.validateReviews()) {
      console.log('[ReviewModule] Validazione fallita - pubblicazione interrotta');
      return;
    }

    console.log('[ReviewModule] Validazione riuscita - procedo con pubblicazione');
    await this.publishReviews();
  }

  /**
   * Valida recensioni prima della pubblicazione
   */
  validateReviews() {
    console.log('[ReviewModule] Inizio validazione recensioni');
    
    // Se non abbiamo dati correnti, controlliamo l'HTML direttamente
    if (!this.currentReviewData || !this.currentReviewData.bottles) {
      console.log('[ReviewModule] Nessun currentReviewData, controllo window.currentReviewData');
      if (window.currentReviewData && window.currentReviewData.bottles) {
        this.currentReviewData = window.currentReviewData;
        console.log('[ReviewModule] Dati recuperati da window.currentReviewData');
      } else {
        console.log('[ReviewModule] Nessun dato disponibile per validazione');
        this.showError('Nessun dato di recensione disponibile');
        return false;
      }
    }
    
    const categories = ['overall', 'appearance', 'aroma', 'taste', 'mouthfeel'];
    console.log('[ReviewModule] Categorie da controllare:', categories);
    
    // Controlla sia i dati tracciati che l'HTML direttamente
    let hasValidReview = false;
    
    // Prima controlla i dati tracciati dal reviewModule
    if (this.ratings.size > 0) {
      console.log('[ReviewModule] Ratings tracciati disponibili:', Array.from(this.ratings.entries()));
      
      hasValidReview = Array.from(this.ratings.keys()).some(bottleIndex => {
        const bottleRatings = this.ratings.get(bottleIndex);
        console.log(`[ReviewModule] Controllo bottiglia ${bottleIndex}, ratings:`, Array.from(bottleRatings.entries()));
        
        const hasValidRating = categories.some(category => {
          const rating = bottleRatings.has(category) ? bottleRatings.get(category) : 0;
          console.log(`[ReviewModule] Bottiglia ${bottleIndex}, categoria ${category}: ${rating}`);
          return rating > 0;
        });
        
        console.log(`[ReviewModule] Bottiglia ${bottleIndex} ha rating valido (tracciato): ${hasValidRating}`);
        return hasValidRating;
      });
    }
    
    // Se non troviamo rating tracciati, controlla direttamente l'HTML
    if (!hasValidReview) {
      console.log('[ReviewModule] Nessun rating tracciato valido, controllo DOM direttamente');
      
      this.currentReviewData.bottles.forEach((bottle, index) => {
        categories.forEach(category => {
          // Supporta sia i selettori nuovi che legacy
          const container = document.querySelector(`[data-bottle="${index}"][data-category="${category}"].rating-stars`) ||
                           document.querySelector(`[data-bottle="${index}"][data-category="${category}"].stars-container`);
          
          if (container) {
            const selectedStars = container.querySelectorAll('.star.selected');
            if (selectedStars.length > 0) {
              console.log(`[ReviewModule] Trovate ${selectedStars.length} stelle selezionate per bottiglia ${index}, categoria ${category}`);
              hasValidReview = true;
              
              // Sincronizza con i dati tracciati
              this.setRating(index, category, selectedStars.length);
            }
          }
        });
      });
    }

    console.log('[ReviewModule] Risultato validazione finale:', hasValidReview);
    
    if (!hasValidReview) {
      console.log('[ReviewModule] Validazione fallita - mostro errore');
      this.showError('Aggiungi almeno una valutazione a stelle prima di pubblicare');
      return false;
    }

    console.log('[ReviewModule] Validazione riuscita');
    return true;
  }

  /**
   * Pubblica recensioni
   */
  async publishReviews() {
    try {
      this.setPublishingState(true);

      const reviewsData = this.collectReviewsData();
      
      const response = await fetch('/review/create-multiple', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(reviewsData)
      });

      const result = await response.json();

      if (!response.ok) {
        // Gestione specifica per contenuto inappropriato
        if (result.inappropriateContent) {
          throw new Error('È stato rilevato linguaggio inappropriato nelle tue recensioni. Per favore, rivedi il contenuto ed evita parole volgari o offensive.');
        }
        throw new Error(result.message || 'Errore durante la pubblicazione');
      }

      this.showSuccess('Recensioni pubblicate con successo!');
      this.clearPreviousErrors(); // Pulisce eventuali messaggi di errore precedenti
      this.resetReviewInterface();

    } catch (error) {
      console.error('[ReviewModule] Errore pubblicazione:', error);
      this.showError(`Errore: ${error.message}`);
    } finally {
      this.setPublishingState(false);
    }
  }

  /**
   * Raccoglie dati recensioni per invio
   */
  collectReviewsData() {
    const reviews = [];

    if (!this.currentReviewData || !this.currentReviewData.bottles) {
      console.log('[ReviewModule] Nessun currentReviewData disponibile per raccolta');
      return { reviews, aiAnalysisData: null };
    }

    this.currentReviewData.bottles.forEach((bottle, index) => {
      let bottleRatings = this.ratings.get(index);
      let bottleNotes = this.notes.get(index);
      
      // Se non abbiamo dati tracciati, leggi dall'HTML
      if (!bottleRatings || bottleRatings.size === 0) {
        console.log(`[ReviewModule] Nessun rating tracciato per bottiglia ${index}, leggo dall'HTML`);
        bottleRatings = new Map();
        
        // Leggi rating dall'HTML
        const categories = ['overall', 'appearance', 'aroma', 'taste', 'mouthfeel'];
        categories.forEach(category => {
          const container = document.querySelector(`[data-bottle="${index}"][data-category="${category}"].rating-stars`) ||
                           document.querySelector(`[data-bottle="${index}"][data-category="${category}"].stars-container`);
          
          if (container) {
            const selectedStars = container.querySelectorAll('.star.selected');
            if (selectedStars.length > 0) {
              bottleRatings.set(category, selectedStars.length);
            }
          }
        });
      }
      
      // Se non abbiamo note tracciate, leggi dall'HTML
      if (!bottleNotes || bottleNotes.size === 0) {
        console.log(`[ReviewModule] Nessuna nota tracciata per bottiglia ${index}, leggo dall'HTML`);
        bottleNotes = new Map();
        
        // Leggi note dall'HTML
        const categories = ['general', 'appearance', 'aroma', 'taste', 'mouthfeel'];
        categories.forEach(category => {
          const textarea = document.querySelector(`[data-notes="${index}"][data-category="${category}"]`);
          if (textarea && textarea.value.trim()) {
            bottleNotes.set(category, textarea.value.trim());
          }
        });
      }

      // Controlla se ha almeno un rating (generale o dettagliato)
      const hasOverallRating = bottleRatings.has('overall') && bottleRatings.get('overall') > 0;
      const hasDetailedRating = ['appearance', 'aroma', 'taste', 'mouthfeel'].some(cat => 
        bottleRatings.has(cat) && bottleRatings.get(cat) > 0
      );
      
      if (!hasOverallRating && !hasDetailedRating) {
        console.log(`[ReviewModule] Bottiglia ${index} saltata - nessun rating trovato`);
        return; // Salta se non ha rating
      }

      const review = {
        beerId: bottle._id,
        beerName: bottle.bottleLabel,
        breweryName: bottle.breweryName,
        rating: bottleRatings.get('overall') || 0,
        notes: bottleNotes.get('general') || '',
        detailedRatings: this.getDetailedRatingsFromData(bottleRatings, bottleNotes),
        aiData: bottle.aiData,
        thumbnail: bottle.thumbnail
      };

      console.log(`[ReviewModule] Bottiglia ${index} raccolta:`, {
        beerName: bottle.bottleLabel,
        overallRating: review.rating,
        hasNotes: !!review.notes,
        hasDetailedRatings: !!review.detailedRatings
      });

      reviews.push(review);
    });

    return {
      reviews,
      aiAnalysisData: this.currentReviewData
    };
  }

  /**
   * Ottieni valutazioni dettagliate da dati specifici
   */
  getDetailedRatingsFromData(bottleRatings, bottleNotes) {
    if (!bottleRatings || !bottleNotes) return null;

    const detailed = {};
    const categories = ['appearance', 'aroma', 'taste', 'mouthfeel'];

    categories.forEach(category => {
      const rating = bottleRatings.get(category);
      const notes = bottleNotes.get(category);

      if (rating || notes) {
        detailed[category] = {
          rating: rating || null,
          notes: notes || ''
        };
      }
    });

    return Object.keys(detailed).length > 0 ? detailed : null;
  }

  /**
   * Mostra sezione recensioni
   */
  showReviewSection() {
    const section = document.getElementById('review-process');
    if (section) {
      section.style.display = 'block';
    }
  }

  /**
   * Imposta stato pubblicazione
   */
  setPublishingState(publishing) {
    const button = document.getElementById('publish-review');
    if (button) {
      button.disabled = publishing;
      button.textContent = publishing ? 'Pubblicazione in corso...' : 'Pubblica Recensioni';
    }
  }

  /**
   * Reset interfaccia recensioni
   */
  resetReviewInterface() {
    this.currentReviewData = null;
    this.ratings.clear();
    this.notes.clear();

    // Nasconde la sezione di processo recensione
    const section = document.getElementById('review-process');
    if (section) {
      section.style.display = 'none';
    }
    
    // Ripristina il bottone principale e la call-to-action (compatibilità con HTML legacy)
    const startReviewBtn = document.getElementById('start-review-process');
    const callToAction = document.querySelector('.review-call-to-action');
    
    if (startReviewBtn) {
      startReviewBtn.style.display = 'inline-flex';
      console.log('[ReviewModule] Bottone principale ripristinato');
    }
    
    if (callToAction) {
      callToAction.style.display = 'block';
      console.log('[ReviewModule] Call-to-action ripristinata');
    }
    
    // Reset dei dati globali per compatibilità con sistema legacy
    window.currentReviewData = null;
    
    console.log('[ReviewModule] Interfaccia recensioni ripristinata completamente');
  }

  /**
   * Mostra messaggio successo
   */
  showSuccess(message) {
    // Implementa notifica successo
    console.log('[ReviewModule] Successo:', message);
  }

  /**
   * Mostra errore
   */
  showError(message) {
    // Utilizza il sistema di notifiche globale se disponibile
    if (window.utils && window.utils.showNotification) {
      window.utils.showNotification(message, 'error', 8000);
    } else {
      // Fallback: crea notifica semplice
      this.createSimpleNotification(message, 'error');
    }
    console.error('[ReviewModule] Errore:', message);
  }

  /**
   * Mostra successo
   */
  showSuccess(message) {
    // Prima pulisci eventuali errori precedenti
    this.clearPreviousErrors();
    
    // Utilizza il sistema di notifiche globale se disponibile
    if (window.utils && window.utils.showNotification) {
      window.utils.showNotification(message, 'success', 5000);
    } else {
      // Fallback: crea notifica semplice
      this.createSimpleNotification(message, 'success');
    }
    console.log('[ReviewModule] Successo:', message);
  }

  /**
   * Pulisce messaggi di errore precedenti
   */
  clearPreviousErrors() {
    // Rimuovi notifiche del sistema utils se disponibile
    if (window.utils && window.utils.clearNotifications) {
      window.utils.clearNotifications();
    }
    
    // Rimuovi notifiche semplici create da questo modulo
    const simpleNotifications = document.querySelectorAll('.simple-notification, .dynamic-alert, .alert-warning, .alert-danger, .error-message');
    simpleNotifications.forEach(notification => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    });
    
    console.log('[ReviewModule] Messaggi di errore precedenti rimossi');
  }

  /**
   * Crea notifica semplice (fallback)
   */
  createSimpleNotification(message, type) {
    const notification = document.createElement('div');
    notification.className = `simple-notification notification-${type}`;
    notification.textContent = message;
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${type === 'error' ? '#dc3545' : '#28a745'};
      color: white;
      padding: 15px 20px;
      border-radius: 5px;
      z-index: 9999;
      max-width: 400px;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    `;
    
    document.body.appendChild(notification);
    
    // Auto-rimozione dopo 8 secondi
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 8000);
  }
}

// Export per uso globale
window.ReviewModule = ReviewModule;
