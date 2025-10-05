/**
 * Modulo per la gestione delle recensioni
 * Gestisce rating stelle, form recensioni e pubblicazione
 */
class ReviewModule {
  constructor() {
    this.currentReviewData = null;
    this.ratings = new Map(); // bottleIndex -> { category -> rating }
    this.notes = new Map(); // bottleIndex -> { category -> notes }
    this.isResolvingDisambiguation = false;
  }

  /**
   * Inizializza il modulo
   */
  async init() {
    console.log('[ReviewModule] Inizializzazione modulo recensioni');
    
    this.bindEvents();
    this.setupEventListeners();

    // Controlla se ci sono già dati AI disponibili in memoria
    if (window.currentReviewData) {
      console.log('[ReviewModule] Dati AI già disponibili in memoria, inizializzo interfaccia');
      this.handleAnalysisComplete(window.currentReviewData);
    } else {
      // Controlla se ci sono dati di disambiguazione in sessione
      console.log('[ReviewModule] Controllo dati sessione dal server...');
      await this.checkSessionData();
    }
    
    console.log('[ReviewModule] Modulo recensioni inizializzato');
  }

  /**
   * Controlla se ci sono dati di disambiguazione in sessione
   */
  async checkSessionData() {
    try {
      console.log('[ReviewModule] Richiesta dati sessione al server...');
      
      const response = await fetch('/review/ai-session-data', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        console.log('[ReviewModule] Nessun dato sessione disponibile, controllo localStorage...');
        
        // Fallback: controlla localStorage
        try {
          const backupData = localStorage.getItem('sb2_ai_analysis_backup');
          if (backupData) {
            const parsed = JSON.parse(backupData);
            const currentSessionId = this.getSessionIdFromCookie();
            
            // Verifica che il backup sia della stessa sessione (non troppo vecchio)
            if (parsed.sessionId === currentSessionId && 
                Date.now() - parsed.timestamp < 30 * 60 * 1000) { // 30 minuti
              console.log('[ReviewModule] Dati recuperati da localStorage backup');
              this.handleAnalysisComplete(parsed.data);
              return;
            } else {
              console.log('[ReviewModule] Backup localStorage scaduto o di sessione diversa, rimuovo');
              localStorage.removeItem('sb2_ai_analysis_backup');
            }
          }
        } catch (error) {
          console.warn('[ReviewModule] Errore recupero da localStorage:', error);
        }
        
        return;
      }

      const sessionData = await response.json();
      console.log('[ReviewModule] Dati sessione ricevuti:', sessionData);

      if (sessionData.hasDisambiguationData && sessionData.needsDisambiguation) {
        console.log('[ReviewModule] Disambiguazione attiva in sessione, ripristino UI...');
        
        // Imposta i dati globali per compatibilità
        window.currentReviewData = sessionData;
        
        // Mostra l'interfaccia di disambiguazione
        this.handleAnalysisComplete(sessionData);
      } else if (sessionData.hasReviewData && !sessionData.needsDisambiguation) {
        console.log('[ReviewModule] Dati review pronti in sessione, mostra interfaccia recensioni...');
        
        // Imposta i dati globali per compatibilità
        window.currentReviewData = sessionData;
        
        // Mostra direttamente l'interfaccia recensioni
        this.handleAnalysisComplete(sessionData);
      } else {
        console.log('[ReviewModule] Nessun dato attivo in sessione');
      }
    } catch (error) {
      console.error('[ReviewModule] Errore controllo dati sessione:', error);
    }
  }  /**
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
      
      // Listener per toggle rating dettagliati
      if (event.target.classList.contains('toggle-detailed-btn')) {
        this.handleDetailedToggle(event);
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
    
    // Salva backup in localStorage per recupero in caso di refresh pagina
    try {
      const sessionId = typeof this.getSessionIdFromCookie === 'function' 
        ? this.getSessionIdFromCookie() 
        : `temp_${Date.now()}`;
      
      localStorage.setItem('sb2_ai_analysis_backup', JSON.stringify({
        data: data,
        timestamp: Date.now(),
        sessionId: sessionId
      }));
      console.log('[ReviewModule] Backup dati salvato in localStorage');
    } catch (error) {
      console.warn('[ReviewModule] Impossibile salvare backup in localStorage:', error);
    }
    
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
    
    // NUOVA LOGICA: Controlla se serve disambiguazione
    if (data.needsDisambiguation) {
      console.log('[ReviewModule] Disambiguazione richiesta:', data.disambiguationReason);
      
      // Notifica inizio disambiguazione al SessionCleanupManager
      if (window.sessionCleanupManager) {
        window.sessionCleanupManager.startDisambiguation();
      }
      
      // CRITICO: Blocca la pulizia automatica durante disambiguazione (legacy)
      if (typeof isDisambiguationActive !== 'undefined') {
        isDisambiguationActive = true;
        console.log('[ReviewModule] Pulizia automatica sessione disabilitata per disambiguazione (legacy)');
      }
      
      this.showDisambiguationInAiFeedback(data);
    } else {
      // Sistema originale: mostra direttamente le stelle
      this.generateReviewInterface(data);
    }
    
    this.showReviewSection();
  }

  /**
   * Mostra disambiguazione nel sistema originale (ai-feedback)
   */
  showDisambiguationInAiFeedback(data) {
    const aiFeedback = document.getElementById('ai-feedback');
    if (!aiFeedback) {
      console.error('[ReviewModule] Elemento ai-feedback NON trovato!');
      return;
    }

    console.log('[ReviewModule] Mostra disambiguazione nel ai-feedback originale');
    console.log('[ReviewModule] Data ricevuta:', data);
    console.log('[ReviewModule] ai-feedback element:', aiFeedback);

    const suggestions = this.getNormalizedDisambiguationSuggestions(data);
    const hasSuggestions = suggestions.length > 0;

    console.log('[ReviewModule] Suggestions normalizzate:', suggestions);
    console.log('[ReviewModule] Has suggestions:', hasSuggestions);
    console.log('[ReviewModule] Data.suggestions:', data.suggestions);
    console.log('[ReviewModule] Data.ambiguities:', data.ambiguities);
    console.log('[ReviewModule] Data.data?.suggestions:', data.data?.suggestions);
    console.log('[ReviewModule] Data.data?.ambiguities:', data.data?.ambiguities);

    let html = '<div class="disambiguation-container">';

    html += `
      <div class="disambiguation-header">
        <h3>🤔 Selezione Birrificio</h3>
        <p class="disambiguation-reason">${this.getDisambiguationMessage(data.disambiguationReason)}</p>
      </div>
    `;

    if (data.originalImage) {
      html += `
        <div class="original-image-section">
          <h4>Immagine analizzata:</h4>
          <div class="original-image-container">
            <img src="data:${data.originalImage.mimeType};base64,${data.originalImage.base64}" 
                 alt="Immagine originale inviata all'AI" class="original-image-preview">
          </div>
        </div>
      `;
    }

    if (data.bottles && data.bottles.length > 0) {
      html += `
        <div class="detected-beers">
          <h4>Birre rilevate nell'immagine:</h4>
          <div class="beer-list">
            ${data.bottles.map((bottle) => `
              <div class="beer-item">
                <div class="beer-info-small">
                  <strong>${bottle.bottleLabel}</strong>
                  <br><small>${bottle.beerType} - ${bottle.alcoholContent}</small>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }

    html += '<div class="disambiguation-options">';

    if (hasSuggestions) {
      html += `
        <div class="option-section">
          <h4>📍 Seleziona il birrificio corretto:</h4>
          <p class="option-description">Abbiamo trovato ${suggestions.length} possibili corrispondenze. Scegli quella giusta oppure registra un nuovo birrificio.</p>
          <div class="brewery-suggestions">
            ${suggestions.map((suggestion, index) => this.renderDisambiguationSuggestion(suggestion, index)).join('')}
          </div>
        </div>
      `;
    } else {
      html += `
        <div class="option-section">
          <h4>📍 Nessuna corrispondenza trovata</h4>
          <p class="option-description">Non siamo riusciti a collegare con certezza l'immagine a un birrificio esistente. Puoi crearne uno nuovo qui sotto.</p>
        </div>
      `;
    }

    html += `
      <div class="option-section">
        <h4>🆕 Non trovi il tuo birrificio?</h4>
        <p class="option-description">Se nessuna delle opzioni proposte è corretta, registra un nuovo birrificio manualmente.</p>
        <button id="no-matching-brewery" class="brewery-option none-option" type="button" aria-pressed="false">
          <div class="brewery-info">
            <strong>🙋‍♀️ Nessuno di questi</strong>
            <small>Voglio registrare un nuovo birrificio</small>
          </div>
        </button>
        <div class="new-brewery-form" id="new-brewery-form" style="display: none;">
          <div class="form-group">
            <label for="new-brewery-name">Nome Birrificio *</label>
            <input type="text" id="new-brewery-name" placeholder="Es: Birrificio Artigianale..." required>
          </div>
          <div class="form-group">
            <label for="new-brewery-location">Località</label>
            <input type="text" id="new-brewery-location" placeholder="Es: Milano, Italia">
          </div>
          <div class="form-group">
            <label for="new-brewery-website">Sito Web</label>
            <input type="url" id="new-brewery-website" placeholder="https://...">
          </div>
          <div class="form-group">
            <label for="new-brewery-email">Email</label>
            <input type="email" id="new-brewery-email" placeholder="info@brewery.com">
          </div>
          <button id="create-new-brewery-btn" class="btn-primary" type="button">
            Crea Nuovo Birrificio
          </button>
        </div>
      </div>
    `;

    html += '</div>';
    html += '</div>';

    console.log('[ReviewModule] HTML generato:', html.substring(0, 200) + '...');

    aiFeedback.innerHTML = html;
    console.log('[ReviewModule] HTML impostato in ai-feedback');
    console.log('[ReviewModule] ai-feedback.innerHTML length:', aiFeedback.innerHTML.length);
    console.log('[ReviewModule] ai-feedback.innerHTML preview:', aiFeedback.innerHTML.substring(0, 300) + '...');

    this.initializeDisambiguationEvents();
    console.log('[ReviewModule] Eventi disambiguazione inizializzati');
  }

  getNormalizedDisambiguationSuggestions(data) {
    if (!data) return [];

    const sources = [
      data.suggestions, // Direttamente nella risposta (per SINGLE_AMBIGUOUS_MATCH)
      data.ambiguities, // Direttamente nella risposta (per SINGLE_AMBIGUOUS_MATCH)
      data.data?.suggestions, // In data.suggestions (per altri casi)
      data.data?.ambiguities, // In data.ambiguities (per altri casi)
      data.originalAnalysis?.suggestions,
      data.originalAnalysis?.ambiguities
    ];

    const firstAvailable = sources.find((source) => Array.isArray(source) && source.length > 0);
    if (!firstAvailable) return [];

    return firstAvailable.map((item, index) => this.formatSuggestionForUI(item, index));
  }

  formatSuggestionForUI(item = {}, index = 0) {
    const rawId = item.rawId || item._id || item.id || item.breweryId || null;
    const suggestionId = rawId ? rawId.toString() : (item.id ? item.id.toString() : `suggestion-${index}`);
    const location = item.breweryLocation || item.location || item.breweryLegalAddress || item.breweryProductionAddress || item.city || null;
    const website = item.breweryWebsite || item.website || item.url || null;
    const email = item.breweryEmail || item.email || null;

    let confidence = null;
    if (typeof item.confidence === 'number') {
      confidence = item.confidence;
    } else if (typeof item.similarity === 'number') {
      confidence = item.similarity;
    } else if (typeof item.matchRatio === 'number') {
      confidence = item.matchRatio;
    } else if (typeof item.meta?.similarity === 'number') {
      confidence = item.meta.similarity;
    }

    const matchType = item.matchType || item.meta?.matchType || item.disambiguationReason || null;
    const keywordMatch = typeof item.keywordMatch === 'boolean' ? item.keywordMatch : Boolean(item.meta?.keywordMatch);

    return {
      id: suggestionId,
      rawId: rawId ? rawId.toString() : null,
      breweryName: item.breweryName || item.name || item.label || 'Birrificio non identificato',
      breweryLocation: location,
      breweryWebsite: website,
      breweryEmail: email,
      confidence,
      matchType,
      keywordMatch,
      selectable: Boolean(rawId)
    };
  }

  getConfidenceLabel(confidence) {
    if (typeof confidence !== 'number' || Number.isNaN(confidence)) {
      return null;
    }

    const clamped = Math.max(0, Math.min(confidence, 1));
    const percentage = Math.round(clamped * 100);
    return `Confidenza ${percentage}%`;
  }

  getMatchTypeLabel(matchType) {
    if (!matchType) return null;

    const labels = {
      AMBIGUOUS_FUZZY: 'Corrispondenza simile',
      AMBIGUOUS_SINGLE: 'Conferma necessaria',
      PARTIAL_AMBIGUOUS: 'Match parziale',
      MULTIPLE_SIMILAR_MATCHES: 'Più corrispondenze simili',
      MULTIPLE_KEYWORD_MATCHES: 'Parole chiave simili',
      SINGLE_AMBIGUOUS_MATCH: 'Corrispondenza ambigua',
      FUZZY_HIGH_CONFIDENCE: 'Alta confidenza',
      EXACT_NAME: 'Nome identico'
    };

    return labels[matchType] || null;
  }

  renderDisambiguationSuggestion(suggestion, index) {
    const classes = ['brewery-option'];
    if (!suggestion.selectable) {
      classes.push('disabled-option');
    }

    const dataAttribute = suggestion.selectable && suggestion.rawId
      ? `data-brewery-id="${suggestion.rawId}"`
      : '';

    const disabledAttribute = suggestion.selectable ? '' : 'disabled aria-disabled="true"';

    const detailLines = [];
    if (suggestion.breweryLocation) {
      detailLines.push(`<small>📍 ${suggestion.breweryLocation}</small>`);
    }
    if (suggestion.breweryWebsite) {
      detailLines.push(`<small>🌐 ${suggestion.breweryWebsite}</small>`);
    }
    if (suggestion.breweryEmail) {
      detailLines.push(`<small>✉️ ${suggestion.breweryEmail}</small>`);
    }

    const metaBadges = [];
    const confidenceLabel = this.getConfidenceLabel(suggestion.confidence);
    if (confidenceLabel) {
      metaBadges.push(`<span class="match-confidence">${confidenceLabel}</span>`);
    }

    const matchTypeLabel = this.getMatchTypeLabel(suggestion.matchType);
    if (matchTypeLabel) {
      metaBadges.push(`<span class="match-type">${matchTypeLabel}</span>`);
    }

    if (suggestion.keywordMatch) {
      metaBadges.push('<span class="keyword-badge">Parole chiave in comune</span>');
    }

    const metaHtml = metaBadges.length > 0
      ? `<div class="brewery-match-meta">${metaBadges.join('')}</div>`
      : '';

    return `
      <button class="${classes.join(' ')}" type="button" ${dataAttribute} ${disabledAttribute} aria-pressed="false">
        <div class="brewery-info">
          <strong>${suggestion.breweryName}</strong>
          ${detailLines.join('')}
          ${metaHtml}
        </div>
      </button>
    `;
  }

  clearSuggestionSelection() {
    document.querySelectorAll('.brewery-option').forEach((button) => {
      button.classList.remove('selected');
      button.classList.remove('loading');
      if (button.hasAttribute('aria-pressed')) {
        button.setAttribute('aria-pressed', 'false');
      }
    });
  }

  highlightSelectedBreweryOption(button) {
    if (!button) return;
    this.clearSuggestionSelection();
    button.classList.add('selected');
    button.setAttribute('aria-pressed', 'true');
  }

  showNewBreweryForm(focus = false) {
    const form = document.getElementById('new-brewery-form');
    if (form) {
      form.style.display = 'block';
      form.classList.add('visible');
    }

    const noneButton = document.getElementById('no-matching-brewery');
    if (noneButton) {
      this.highlightSelectedBreweryOption(noneButton);
    }

    const nameInput = document.getElementById('new-brewery-name');
    if (focus && nameInput) {
      setTimeout(() => nameInput.focus(), 100);
    }

    if (form) {
      form.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  toggleDisambiguationInteractivity(enable) {
    const container = document.querySelector('.disambiguation-container');
    if (!container) return;

    container.querySelectorAll('button').forEach((button) => {
      button.disabled = !enable;
      if (enable) {
        button.classList.remove('is-disabled');
        button.removeAttribute('aria-disabled');
      } else {
        button.classList.add('is-disabled');
        button.setAttribute('aria-disabled', 'true');
      }
    });
  }

  /**
   * Genera interfaccia recensioni (sistema originale)
   */
  generateReviewInterface(data) {
    console.log('[ReviewModule] Generazione interfaccia recensioni - SISTEMA ORIGINALE');

    // Usa il sistema originale: popola bottle-ratings
    this.populateBottleRatings(data.bottles);
  }

  /**
   * Popola il container bottle-ratings con il sistema originale
   */
  populateBottleRatings(bottles) {
    const bottleRatings = document.getElementById('bottle-ratings');
    if (!bottleRatings) {
      console.error('[ReviewModule] Container bottle-ratings non trovato!');
      return;
    }

    console.log('[ReviewModule] Popolamento bottle-ratings con', bottles.length, 'bottiglie');

    let html = '<div class="bottles-rating-container">';
    
    bottles.forEach((bottle, index) => {
      html += this.generateBottleReviewHTML(bottle, index);
    });

    html += '</div>';
    bottleRatings.innerHTML = html;

    // Inizializza il sistema di rating originale
    this.initializeRatings(bottles.length);
  }

  /**
   * Genera HTML per recensione singola birra
   */
  generateBottleReviewHTML(bottle, index) {
    return `
      <div class="bottle-review" data-bottle-index="${index}">
        <div class="bottle-header">
          <img src="${bottle.thumbnail || bottle.imageDataUrl || '/images/default-beer.svg'}" 
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
   * Gestisce toggle dei rating dettagliati
   */
  handleDetailedToggle(event) {
    const button = event.target;
    const bottleIndex = button.dataset.bottle;
    const detailedSection = document.getElementById(`detailed-${bottleIndex}`);
    
    if (detailedSection) {
      if (detailedSection.style.display === 'none') {
        detailedSection.style.display = 'block';
        button.textContent = '📊 Nascondi Dettagli';
      } else {
        detailedSection.style.display = 'none';
        button.textContent = '📊 Valutazione Dettagliata';
      }
    }
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
      
      // Rimuovi backup da localStorage dopo pubblicazione riuscita
      try {
        localStorage.removeItem('sb2_ai_analysis_backup');
        console.log('[ReviewModule] Backup localStorage rimosso dopo pubblicazione');
      } catch (error) {
        console.warn('[ReviewModule] Errore rimozione backup localStorage:', error);
      }
      
      // Notifica completamento al SessionCleanupManager
      if (window.sessionCleanupManager) {
        window.sessionCleanupManager.cleanupOnReviewComplete();
      }
      
      this.resetReviewInterface();

    } catch (error) {
      console.error('[ReviewModule] Errore pubblicazione:', error);
      
      // Notifica errore al SessionCleanupManager
      if (window.sessionCleanupManager) {
        window.sessionCleanupManager.cleanupOnReviewError(error);
      }
      
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
   * Inizializza eventi per disambiguazione
   */
  initializeDisambiguationEvents() {
    // Selezione birrificio esistente proposto
    document.querySelectorAll('.brewery-option[data-brewery-id]').forEach((button) => {
      button.addEventListener('click', (event) => {
        if (this.isResolvingDisambiguation) {
          console.debug('[ReviewModule] Disambiguazione già in corso, ignoro click duplicato');
          return;
        }

        const option = event.currentTarget;
        const breweryId = option.dataset.breweryId;
        if (!breweryId) {
          console.warn('[ReviewModule] Nessun ID birrificio associato al bottone selezionato');
          return;
        }

        this.highlightSelectedBreweryOption(option);
        this.resolveDisambiguation({ selectedBreweryId: breweryId }, { triggerElement: option });
      });
    });

    // Opzione "Nessuno di questi"
    const noneButton = document.getElementById('no-matching-brewery');
    if (noneButton) {
      noneButton.addEventListener('click', () => {
        if (this.isResolvingDisambiguation) {
          return;
        }
        this.showNewBreweryForm(true);
      });
    }

    // Creazione nuovo birrificio
    const createBtn = document.getElementById('create-new-brewery-btn');
    if (createBtn) {
      createBtn.addEventListener('click', () => {
        if (this.isResolvingDisambiguation) {
          return;
        }
        this.handleCreateNewBrewery();
      });
    }
  }

  /**
   * Gestisce creazione nuovo birrificio
   */
  handleCreateNewBrewery() {
    this.showNewBreweryForm();

    const nameInput = document.getElementById('new-brewery-name');
    const locationInput = document.getElementById('new-brewery-location');
    const websiteInput = document.getElementById('new-brewery-website');
    const emailInput = document.getElementById('new-brewery-email');

    if (nameInput) {
      nameInput.classList.remove('input-error');
    }

    const sanitizedName = nameInput?.value.trim();
    if (!nameInput.value.trim()) {
      this.showError('Nome birrificio obbligatorio');
      nameInput.focus();
      nameInput.classList.add('input-error');
      return;
    }

    const newBreweryData = {
      breweryName: sanitizedName,
      breweryLocation: locationInput.value.trim() || null,
      breweryWebsite: websiteInput.value.trim() || null,
      breweryEmail: emailInput.value.trim() || null
    };

    const triggerElement = document.getElementById('create-new-brewery-btn');

    this.resolveDisambiguation({
      createNewBrewery: true,
      newBreweryData: newBreweryData
    }, { triggerElement });
  }

  /**
   * Risolve disambiguazione chiamando il server
   */
  async resolveDisambiguation(resolutionData, options = {}) {
    if (this.isResolvingDisambiguation) {
      console.debug('[ReviewModule] Disambiguazione già in corso, richiesta ignorata', resolutionData);
      return;
    }

    const { triggerElement = null } = options;

    try {
      console.log('[ReviewModule] Risoluzione disambiguazione:', resolutionData);

      this.isResolvingDisambiguation = true;
      this.toggleDisambiguationInteractivity(false);

      if (triggerElement) {
        triggerElement.classList.add('loading');
        triggerElement.setAttribute('aria-busy', 'true');
      }

      const response = await fetch('/review/resolve-disambiguation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(resolutionData)
      });

      const result = await response.json();

      if (result.success) {
        console.log('[ReviewModule] Disambiguazione risolta con successo');
        
        // Notifica fine disambiguazione al SessionCleanupManager
        if (window.sessionCleanupManager) {
          window.sessionCleanupManager.endDisambiguation();
        }
        
        // CRITICO: Riabilita la pulizia automatica ora che disambiguazione è completa (legacy)
        if (typeof isDisambiguationActive !== 'undefined') {
          isDisambiguationActive = false;
          console.log('[ReviewModule] Pulizia automatica sessione riabilitata (legacy)');
        }
        
        // Aggiorna i dati con la risoluzione
        this.currentReviewData = result.resolvedAnalysis;
        
        // Pulisce la disambiguazione dal ai-feedback
        const aiFeedback = document.getElementById('ai-feedback');
        if (aiFeedback) {
          aiFeedback.innerHTML = '<div class="success-message">✅ Birrificio confermato: ' + result.brewery.breweryName + '</div>';
        }
        
        // Mostra messaggio di successo
        this.showSuccess(result.message);
        
        // Usa il sistema originale: genera le stelle nel bottle-ratings
        this.generateReviewInterface(result.resolvedAnalysis);
        this.toggleDisambiguationInteractivity(true);
        
      } else {
        throw new Error(result.error || 'Errore durante la risoluzione');
      }

    } catch (error) {
      console.error('[ReviewModule] Errore risoluzione disambiguazione:', error);
      
      // CRITICO: Riabilita la pulizia automatica anche in caso di errore
      if (typeof isDisambiguationActive !== 'undefined') {
        isDisambiguationActive = false;
        console.log('[ReviewModule] Pulizia automatica sessione riabilitata dopo errore');
      }
      
      this.toggleDisambiguationInteractivity(true);
      this.showError('Errore durante la risoluzione: ' + error.message);
      return;
    }
    finally {
      if (triggerElement) {
        triggerElement.classList.remove('loading');
        triggerElement.removeAttribute('aria-busy');
      }

      this.isResolvingDisambiguation = false;
    }
  }

  /**
   * Ottiene messaggio user-friendly per tipo disambiguazione
   */
  getDisambiguationMessage(reason) {
    const messages = {
      'MULTIPLE_BREWERY_MATCHES': 'Sono stati trovati più birrifici con nomi simili. Seleziona quello corretto o creane uno nuovo.',
      'FUZZY_BREWERY_MATCH': 'Il nome del birrificio non corrisponde esattamente a quelli nel database. Seleziona quello più simile o creane uno nuovo.',
      'NO_BREWERY_NAME_EXTRACTED': 'Non è stato possibile identificare chiaramente il birrificio dall\'immagine. Seleziona quello corretto o creane uno nuovo.',
      'PARTIAL_BREWERY_MATCH': 'Il birrificio identificato corrisponde solo parzialmente a quelli nel database. Verifica la selezione.',
      'SINGLE_AMBIGUOUS_MATCH': 'È stata trovata una corrispondenza ambigua per il birrificio. Verifica che sia quello corretto.'
    };

    return messages[reason] || 'È necessario chiarire quale birrificio corrisponde alle birre nell\'immagine.';
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

  /**
   * Ottiene session ID da cookie o genera uno temporaneo
   */
  getSessionIdFromCookie() {
    // Prova a ottenere da cookie connect.sid
    const cookies = document.cookie.split(';');
    for (let cookie of cookies) {
      const [name, value] = cookie.trim().split('=');
      if (name === 'connect.sid') {
        return decodeURIComponent(value);
      }
    }
    
    // Fallback: genera ID temporaneo basato su timestamp
    return `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Export per uso globale
window.ReviewModule = ReviewModule;
