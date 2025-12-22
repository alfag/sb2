/**
 * JavaScript per la pagina di test del matching birrifici AI
 * Gestisce l'invio del form, le chiamate API e la visualizzazione dei risultati
 */

document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('breweryMatchingForm');
    const resultsContainer = document.getElementById('resultsContainer');
    const loadingOverlay = document.getElementById('loadingOverlay');

    // Gestione invio form
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const formData = new FormData(form);
        const testData = {
            breweryName: formData.get('breweryName').trim(),
            breweryWebsite: formData.get('breweryWebsite').trim() || null,
            breweryEmail: formData.get('breweryEmail').trim() || null,
            breweryLegalAddress: formData.get('breweryLegalAddress').trim() || null
        };

        if (!testData.breweryName) {
            alert('Nome birrificio richiesto');
            return;
        }

        showLoading(true);
        
        try {
            const response = await fetch('/administrator/api/test-brewery-matching', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(testData)
            });

            const result = await response.json();
            
            if (result.success) {
                displayResults(result);
            } else {
                displayError(result.error || 'Errore durante il test');
            }
        } catch (error) {
            console.error('Errore durante il test:', error);
            displayError('Errore di connessione durante il test');
        } finally {
            showLoading(false);
        }
    });

    /**
     * Mostra/nasconde il loading overlay
     */
    function showLoading(show) {
        if (show) {
            loadingOverlay.classList.remove('d-none');
        } else {
            loadingOverlay.classList.add('d-none');
        }
    }

    /**
     * Visualizza i risultati del test
     */
    function displayResults(data) {
        const { searchData, result } = data;
        
        let html = `
            <!-- Dati di ricerca -->
            <div class="mb-3 p-3 bg-light rounded">
                <h6 class="text-muted mb-2">
                    <i class="fas fa-search me-2"></i>
                    Parametri di Ricerca
                </h6>
                <div class="row small">
                    <div class="col-12">
                        <strong>Nome:</strong> ${escapeHtml(searchData.breweryName)}
                    </div>
                    ${searchData.breweryWebsite ? `<div class="col-12"><strong>Sito:</strong> ${escapeHtml(searchData.breweryWebsite)}</div>` : ''}
                    ${searchData.breweryEmail ? `<div class="col-12"><strong>Email:</strong> ${escapeHtml(searchData.breweryEmail)}</div>` : ''}
                    ${searchData.breweryLegalAddress ? `<div class="col-12"><strong>Indirizzo:</strong> ${escapeHtml(searchData.breweryLegalAddress)}</div>` : ''}
                </div>
            </div>`;

        if (result.match && !result.needsDisambiguation) {
            // Match trovato senza ambiguità
            html += renderMatchResult(result.match);
        } else if (result.needsDisambiguation && result.ambiguities.length > 0) {
            // Ambiguità rilevate
            html += renderAmbiguityResults(result.ambiguities);
        } else {
            // Nessun match trovato
            html += renderNoMatchResult();
        }

        // Statistiche della ricerca
        html += `
            <div class="mt-3 p-3 bg-info bg-opacity-10 rounded">
                <h6 class="text-info mb-2">
                    <i class="fas fa-info-circle me-2"></i>
                    Statistiche Ricerca
                </h6>
                <div class="row small">
                    <div class="col-6">
                        <strong>Birrifici nel DB:</strong> ${result.totalBreweriesInDB}
                    </div>
                    <div class="col-6">
                        <strong>Timestamp:</strong> ${formatTimestamp(result.timestamp)}
                    </div>
                    <div class="col-12 mt-2">
                        <strong>Necessita disambiguazione:</strong> 
                        <span class="badge ${result.needsDisambiguation ? 'bg-warning' : 'bg-success'}">
                            ${result.needsDisambiguation ? 'Sì' : 'No'}
                        </span>
                    </div>
                </div>
            </div>`;

        resultsContainer.innerHTML = html;
    }

    /**
     * Renderizza il risultato di un match unico
     */
    function renderMatchResult(match) {
        const confidenceColor = getConfidenceColor(match.confidence);
        const confidencePercent = Math.round(match.confidence * 100);
        
        return `
            <div class="match-result">
                <h6 class="text-success mb-2">
                    <i class="fas fa-check-circle me-2"></i>
                    Match Trovato
                </h6>
                
                <div class="row mb-3">
                    <div class="col-8">
                        <strong>${escapeHtml(match.name)}</strong>
                        <br>
                        <small class="text-muted">ID: ${match.id}</small>
                    </div>
                    <div class="col-4 text-end">
                        <span class="badge bg-${confidenceColor}">${match.matchType}</span>
                    </div>
                </div>

                <!-- Barra di confidenza -->
                <div class="mb-2">
                    <div class="d-flex justify-content-between small">
                        <span>Confidenza:</span>
                        <span>${confidencePercent}%</span>
                    </div>
                    <div class="confidence-bar">
                        <div class="confidence-fill bg-${confidenceColor}" style="width: ${confidencePercent}%"></div>
                    </div>
                </div>

                <!-- Dettagli del match -->
                <div class="mt-3">
                    <strong>Dettagli Match:</strong>
                    <ul class="mt-2 mb-0">
                        ${match.website ? `<li><strong>Sito:</strong> ${escapeHtml(match.website)}</li>` : ''}
                        ${match.email ? `<li><strong>Email:</strong> ${escapeHtml(match.email)}</li>` : ''}
                        ${match.address ? `<li><strong>Indirizzo:</strong> ${escapeHtml(match.address)}</li>` : ''}
                        ${match.similarity ? `<li><strong>Similarità Nome:</strong> ${Math.round(match.similarity * 100)}%</li>` : ''}
                    </ul>
                </div>
            </div>`;
    }

    /**
     * Renderizza i risultati con ambiguità
     */
    function renderAmbiguityResults(ambiguities) {
        let html = `
            <div class="ambiguity-result">
                <h6 class="text-warning mb-2">
                    <i class="fas fa-exclamation-triangle me-2"></i>
                    Ambiguità Rilevata (${ambiguities.length} candidati)
                </h6>
                <p class="small">
                    Il sistema ha trovato più birrifici simili. Analizza i candidati per identificare quello corretto:
                </p>
            </div>`;

        ambiguities.forEach((amb, index) => {
            const confidenceColor = getConfidenceColor(amb.confidence);
            const confidencePercent = Math.round(amb.confidence * 100);
            
            html += `
                <div class="card mb-2">
                    <div class="card-body py-2">
                        <div class="row align-items-center">
                            <div class="col-md-6">
                                <strong>${escapeHtml(amb.name)}</strong>
                                <br>
                                <small class="text-muted">ID: ${amb.id}</small>
                            </div>
                            <div class="col-md-3">
                                <span class="badge bg-${confidenceColor}">${amb.matchType}</span>
                                ${amb.keywordMatch ? '<span class="badge bg-info ms-1">Keywords</span>' : ''}
                            </div>
                            <div class="col-md-3">
                                <div class="confidence-bar">
                                    <div class="confidence-fill bg-${confidenceColor}" style="width: ${confidencePercent}%"></div>
                                </div>
                                <small class="text-muted">${confidencePercent}%</small>
                            </div>
                        </div>
                        
                        ${amb.website || amb.email || amb.address ? `
                            <div class="mt-2 small">
                                ${amb.website ? `<div><strong>Sito:</strong> ${escapeHtml(amb.website)}</div>` : ''}
                                ${amb.email ? `<div><strong>Email:</strong> ${escapeHtml(amb.email)}</div>` : ''}
                                ${amb.address ? `<div><strong>Indirizzo:</strong> ${escapeHtml(amb.address)}</div>` : ''}
                            </div>
                        ` : ''}
                    </div>
                </div>`;
        });

        return html;
    }

    /**
     * Renderizza il risultato quando non viene trovato nessun match
     */
    function renderNoMatchResult() {
        return `
            <div class="no-match-result">
                <h6 class="text-danger mb-2">
                    <i class="fas fa-times-circle me-2"></i>
                    Nessun Match Trovato
                </h6>
                <p class="mb-2">
                    Il sistema non ha trovato birrifici corrispondenti nel database. 
                    Questo birrificio verrebbe creato come nuovo.
                </p>
                <div class="mt-3">
                    <strong>Possibili cause:</strong>
                    <ul class="mt-2 mb-0">
                        <li>Il birrificio non è ancora registrato nel sistema</li>
                        <li>Il nome inserito è molto diverso da quello registrato</li>
                        <li>Potrebbero mancare dati aggiuntivi (sito web, email) per confermare il match</li>
                    </ul>
                </div>
            </div>`;
    }

    /**
     * Visualizza un errore
     */
    function displayError(errorMessage) {
        resultsContainer.innerHTML = `
            <div class="alert alert-danger">
                <h6 class="mb-2">
                    <i class="fas fa-exclamation-circle me-2"></i>
                    Errore
                </h6>
                <p class="mb-0">${escapeHtml(errorMessage)}</p>
            </div>`;
    }

    /**
     * Determina il colore in base alla confidenza
     */
    function getConfidenceColor(confidence) {
        if (confidence >= 0.9) return 'success';
        if (confidence >= 0.7) return 'warning';
        return 'danger';
    }

    /**
     * Formatta il timestamp
     */
    function formatTimestamp(timestamp) {
        return new Date(timestamp).toLocaleString('it-IT');
    }

    /**
     * Escape HTML per sicurezza
     */
    function escapeHtml(text) {
        if (!text) return '';
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, function(m) { return map[m]; });
    }

    // Gestione esempi di test (opzionale - per future implementazioni)
    document.querySelectorAll('.test-example').forEach(example => {
        example.addEventListener('click', function() {
            const exampleType = this.dataset.example;
            // Qui si potrebbero aggiungere esempi precompilati
            console.log('Esempio selezionato:', exampleType);
        });
    });
});
