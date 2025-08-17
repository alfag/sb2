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
    this.currentReviewData = data;
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
    const container = star.closest('.stars-container');
    
    if (!container) return;

    const bottleIndex = parseInt(container.dataset.bottle);
    const category = container.dataset.category;
    const rating = parseInt(star.dataset.rating);

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
    if (!this.validateReviews()) {
      return;
    }

    await this.publishReviews();
  }

  /**
   * Valida recensioni prima della pubblicazione
   */
  validateReviews() {
    const hasValidReview = Array.from(this.ratings.keys()).some(bottleIndex => {
      const bottleRatings = this.ratings.get(bottleIndex);
      return bottleRatings.has('overall') && bottleRatings.get('overall') > 0;
    });

    if (!hasValidReview) {
      this.showError('Aggiungi almeno una valutazione a stelle prima di pubblicare');
      return false;
    }

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
        throw new Error(result.message || 'Errore durante la pubblicazione');
      }

      this.showSuccess('Recensioni pubblicate con successo!');
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

    this.currentReviewData.bottles.forEach((bottle, index) => {
      const bottleRatings = this.ratings.get(index);
      const bottleNotes = this.notes.get(index);

      if (!bottleRatings || !bottleRatings.has('overall')) {
        return; // Salta se non ha rating generale
      }

      const review = {
        beerId: bottle._id,
        beerName: bottle.bottleLabel,
        breweryName: bottle.breweryName,
        rating: bottleRatings.get('overall'),
        notes: bottleNotes.get('general') || '',
        detailedRatings: this.getDetailedRatings(index),
        aiData: bottle.aiData,
        thumbnail: bottle.thumbnail
      };

      reviews.push(review);
    });

    return {
      reviews,
      aiAnalysisData: this.currentReviewData
    };
  }

  /**
   * Ottieni valutazioni dettagliate per bottiglia
   */
  getDetailedRatings(bottleIndex) {
    const bottleRatings = this.ratings.get(bottleIndex);
    const bottleNotes = this.notes.get(bottleIndex);

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

    const section = document.getElementById('review-process');
    if (section) {
      section.style.display = 'none';
    }
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
    // Implementa notifica errore
    console.error('[ReviewModule] Errore:', message);
  }
}

// Export per uso globale
window.ReviewModule = ReviewModule;
