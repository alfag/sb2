/**
 * AI Verification Enrichment JavaScript
 * Gestisce l'interattività dei campi di arricchimento dati
 */

class EnrichmentManager {
    constructor() {
        this.formData = {
            breweries: {},
            beers: {}
        };
        
        this.completenessWeights = {
            brewery: {
                name: 25,
                website: 15,
                address: 20,
                email: 15,
                phone: 10,
                founded: 10,
                description: 5
            },
            beer: {
                name: 30,
                type: 20,
                alcohol: 20,
                volume: 15,
                ibu: 5,
                color: 5,
                description: 5
            }
        };
        
        this.init();
    }
    
    init() {
        this.bindEvents();
        this.calculateAllCompleteness();
        this.updateGlobalProgress();
        this.setupFormValidation();
        this.setupAutoSave();
    }
    
    bindEvents() {
        // Form input events
        document.querySelectorAll('.form-control').forEach(input => {
            input.addEventListener('input', (e) => this.handleInputChange(e));
            input.addEventListener('blur', (e) => this.validateField(e.target));
        });
        
        // Action buttons
        document.getElementById('saveAsDraftBtn')?.addEventListener('click', () => this.saveAsDraft());
        document.getElementById('validateAllBtn')?.addEventListener('click', () => this.validateAll());
        document.getElementById('submitEnrichmentBtn')?.addEventListener('click', (e) => this.submitForm(e));
        
        // Form submission
        document.getElementById('enrichmentForm')?.addEventListener('submit', (e) => this.handleFormSubmit(e));
    }
    
    handleInputChange(event) {
        const input = event.target;
        const cardType = this.getCardType(input);
        const cardIndex = this.getCardIndex(input);
        
        if (cardType && cardIndex) {
            this.updateCompleteness(cardType, cardIndex);
            this.updateGlobalProgress();
            
            // Real-time validation
            clearTimeout(this.validationTimeout);
            this.validationTimeout = setTimeout(() => {
                this.validateField(input);
            }, 500);
        }
    }
    
    getCardType(element) {
        const card = element.closest('.enrichment-card');
        if (card?.classList.contains('brewery-card')) return 'brewery';
        if (card?.classList.contains('beer-card')) return 'beer';
        return null;
    }
    
    getCardIndex(element) {
        const card = element.closest('.enrichment-card');
        return card?.dataset.id || null;
    }
    
    calculateCompleteness(cardType, cardIndex) {
        const weights = this.completenessWeights[cardType];
        if (!weights) return 0;
        
        let totalScore = 0;
        let maxScore = 0;
        
        Object.keys(weights).forEach(field => {
            maxScore += weights[field];
            
            const input = document.querySelector(`[name="${cardType}_${field}_${cardIndex}"]`);
            if (input && input.value.trim()) {
                totalScore += weights[field];
            }
        });
        
        return maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;
    }
    
    updateCompleteness(cardType, cardIndex) {
        const completeness = this.calculateCompleteness(cardType, cardIndex);
        const card = document.querySelector(`[data-type="${cardType}"][data-id="${cardIndex}"]`);
        
        if (card) {
            const fill = card.querySelector('.completeness-fill');
            const value = card.querySelector('.completeness-value');
            
            if (fill) {
                fill.style.width = `${completeness}%`;
                fill.dataset.completeness = completeness;
            }
            
            if (value) {
                value.textContent = `${completeness}%`;
            }
            
            // Update card styling based on completeness
            card.classList.remove('low-completeness', 'medium-completeness', 'high-completeness');
            if (completeness < 40) {
                card.classList.add('low-completeness');
            } else if (completeness < 75) {
                card.classList.add('medium-completeness');
            } else {
                card.classList.add('high-completeness');
            }
        }
    }
    
    calculateAllCompleteness() {
        document.querySelectorAll('.enrichment-card').forEach(card => {
            const cardType = card.dataset.type;
            const cardIndex = card.dataset.id;
            
            if (cardType && cardIndex) {
                this.updateCompleteness(cardType, cardIndex);
            }
        });
    }
    
    updateGlobalProgress() {
        const cards = document.querySelectorAll('.enrichment-card');
        let totalCompleteness = 0;
        let cardCount = 0;
        
        cards.forEach(card => {
            const fill = card.querySelector('.completeness-fill');
            if (fill) {
                totalCompleteness += parseInt(fill.dataset.completeness || 0);
                cardCount++;
            }
        });
        
        const globalProgress = cardCount > 0 ? Math.round(totalCompleteness / cardCount) : 0;
        
        const globalFill = document.querySelector('#globalProgressBar .progress-fill');
        const globalPercentage = document.getElementById('globalProgressPercentage');
        
        if (globalFill) {
            globalFill.style.width = `${globalProgress}%`;
            globalFill.dataset.progress = globalProgress;
        }
        
        if (globalPercentage) {
            globalPercentage.textContent = `${globalProgress}%`;
        }
        
        // Update submit button state
        const submitBtn = document.getElementById('submitEnrichmentBtn');
        if (submitBtn) {
            if (globalProgress >= 60) {
                submitBtn.disabled = false;
                submitBtn.classList.remove('btn-secondary');
                submitBtn.classList.add('btn-success');
            } else {
                submitBtn.disabled = true;
                submitBtn.classList.remove('btn-success');
                submitBtn.classList.add('btn-secondary');
            }
        }
    }
    
    validateField(input) {
        if (!input) return;
        
        const value = input.value.trim();
        const isRequired = input.classList.contains('required');
        
        // Remove previous validation classes
        input.classList.remove('is-valid', 'is-invalid', 'loading');
        
        if (isRequired && !value) {
            input.classList.add('is-invalid');
            this.showFieldError(input, 'Questo campo è obbligatorio');
            return false;
        }
        
        // Type-specific validation
        const inputType = input.type || input.tagName.toLowerCase();
        
        switch (inputType) {
            case 'email':
                if (value && !this.isValidEmail(value)) {
                    input.classList.add('is-invalid');
                    this.showFieldError(input, 'Inserisci un indirizzo email valido');
                    return false;
                }
                break;
                
            case 'url':
                if (value && !this.isValidURL(value)) {
                    input.classList.add('is-invalid');
                    this.showFieldError(input, 'Inserisci un URL valido (es: https://www.sito.it)');
                    return false;
                }
                break;
                
            case 'number':
                if (value && isNaN(value)) {
                    input.classList.add('is-invalid');
                    this.showFieldError(input, 'Inserisci un numero valido');
                    return false;
                }
                break;
        }
        
        if (value) {
            input.classList.add('is-valid');
            this.hideFieldError(input);
        }
        
        return true;
    }
    
    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }
    
    isValidURL(url) {
        try {
            new URL(url);
            return url.startsWith('http://') || url.startsWith('https://');
        } catch {
            return false;
        }
    }
    
    showFieldError(input, message) {
        this.hideFieldError(input);
        
        const errorDiv = document.createElement('div');
        errorDiv.className = 'field-error';
        errorDiv.textContent = message;
        errorDiv.style.color = '#dc3545';
        errorDiv.style.fontSize = '0.85rem';
        errorDiv.style.marginTop = '5px';
        
        input.parentNode.appendChild(errorDiv);
    }
    
    hideFieldError(input) {
        const existingError = input.parentNode.querySelector('.field-error');
        if (existingError) {
            existingError.remove();
        }
    }
    
    setupFormValidation() {
        // Real-time form validation
        const form = document.getElementById('enrichmentForm');
        if (form) {
            form.addEventListener('input', () => {
                this.updateSubmitButtonState();
            });
        }
    }
    
    updateSubmitButtonState() {
        const requiredFields = document.querySelectorAll('.form-control.required');
        const allRequiredFilled = Array.from(requiredFields).every(field => field.value.trim());
        const submitBtn = document.getElementById('submitEnrichmentBtn');
        
        if (submitBtn) {
            submitBtn.disabled = !allRequiredFilled;
        }
    }
    
    setupAutoSave() {
        // Auto-save draft every 30 seconds
        setInterval(() => {
            this.saveAsDraft(true); // Silent save
        }, 30000);
    }
    
    saveAsDraft(silent = false) {
        const formData = this.collectFormData();
        
        try {
            localStorage.setItem('sb2_enrichment_draft', JSON.stringify({
                data: formData,
                timestamp: new Date().toISOString(),
                url: window.location.pathname
            }));
            
            if (!silent) {
                this.showToast('Bozza salvata automaticamente', 'success');
            }
        } catch (error) {
            console.error('Errore nel salvataggio della bozza:', error);
            if (!silent) {
                this.showToast('Errore nel salvataggio della bozza', 'error');
            }
        }
    }
    
    loadDraft() {
        try {
            const draft = localStorage.getItem('sb2_enrichment_draft');
            if (draft) {
                const draftData = JSON.parse(draft);
                if (draftData.url === window.location.pathname) {
                    this.populateForm(draftData.data);
                    this.showToast('Bozza ripristinata', 'info');
                }
            }
        } catch (error) {
            console.error('Errore nel caricamento della bozza:', error);
        }
    }
    
    collectFormData() {
        const data = {
            breweries: {},
            beers: {}
        };
        
        document.querySelectorAll('.brewery-card').forEach(card => {
            const index = card.dataset.id;
            data.breweries[index] = this.collectFormSection(card, 'brewery', index);
        });
        
        document.querySelectorAll('.beer-card').forEach(card => {
            const index = card.dataset.id;
            data.beers[index] = this.collectFormSection(card, 'beer', index);
        });
        
        return data;
    }
    
    collectFormSection(card, type, index) {
        const data = {};
        const inputs = card.querySelectorAll('.form-control');
        
        inputs.forEach(input => {
            const name = input.name;
            if (name && name.includes(`${type}_`) && name.includes(`_${index}`)) {
                const fieldName = name.replace(`${type}_`, '').replace(`_${index}`, '');
                data[fieldName] = input.value.trim();
            }
        });
        
        return data;
    }
    
    populateForm(data) {
        try {
            // Popola i dati dei birrifici
            if (data.breweries) {
                Object.entries(data.breweries).forEach(([index, breweryData]) => {
                    Object.entries(breweryData).forEach(([fieldName, value]) => {
                        const input = document.querySelector(`[name="brewery_${fieldName}_${index}"]`);
                        if (input && value) {
                            input.value = value;
                        }
                    });
                });
            }
            
            // Popola i dati delle birre
            if (data.beers) {
                Object.entries(data.beers).forEach(([index, beerData]) => {
                    Object.entries(beerData).forEach(([fieldName, value]) => {
                        const input = document.querySelector(`[name="beer_${fieldName}_${index}"]`);
                        if (input && value) {
                            input.value = value;
                        }
                    });
                });
            }
            
            console.log('✅ Form popolato con dati bozza:', data);
        } catch (error) {
            console.error('❌ Errore nel popolare il form:', error);
        }
    }
    
    validateAll() {
        let isValid = true;
        const fields = document.querySelectorAll('.form-control');
        
        fields.forEach(field => {
            if (!this.validateField(field)) {
                isValid = false;
            }
        });
        
        if (isValid) {
            this.showToast('Tutti i campi sono validi!', 'success');
        } else {
            this.showToast('Alcuni campi contengono errori', 'error');
        }
        
        return isValid;
    }
    
    handleFormSubmit(event) {
        event.preventDefault();
        
        if (!this.validateAll()) {
            this.showToast('Correggi gli errori prima di inviare', 'error');
            return;
        }
        
        this.submitForm(event);
    }
    
    submitForm(event) {
        const formData = this.collectFormData();
        const form = document.getElementById('enrichmentForm');
        
        // Update hidden field with collected data
        const userCompletionsField = document.getElementById('userCompletionsData');
        if (userCompletionsField) {
            userCompletionsField.value = JSON.stringify(formData);
        }
        
        // Show loading state
        const submitBtn = document.getElementById('submitEnrichmentBtn');
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Elaborazione...';
        }
        
        // Clear draft
        localStorage.removeItem('sb2_enrichment_draft');
        
        // Submit form
        if (form) {
            form.submit();
        }
    }
    
    showToast(message, type = 'info') {
        // Create toast notification
        const toast = document.createElement('div');
        toast.className = `toast-notification toast-${type}`;
        toast.innerHTML = `
            <div class="toast-content">
                <i class="fas fa-${this.getToastIcon(type)}"></i>
                <span>${message}</span>
            </div>
        `;
        
        // Style toast
        Object.assign(toast.style, {
            position: 'fixed',
            top: '20px',
            right: '20px',
            zIndex: '9999',
            background: this.getToastColor(type),
            color: 'white',
            padding: '15px 20px',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            transform: 'translateX(100%)',
            transition: 'transform 0.3s ease'
        });
        
        document.body.appendChild(toast);
        
        // Animate in
        setTimeout(() => {
            toast.style.transform = 'translateX(0)';
        }, 100);
        
        // Remove after 4 seconds
        setTimeout(() => {
            toast.style.transform = 'translateX(100%)';
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300);
        }, 4000);
    }
    
    getToastIcon(type) {
        const icons = {
            success: 'check-circle',
            error: 'exclamation-circle',
            warning: 'exclamation-triangle',
            info: 'info-circle'
        };
        return icons[type] || 'info-circle';
    }
    
    getToastColor(type) {
        const colors = {
            success: '#28a745',
            error: '#dc3545',
            warning: '#ffc107',
            info: '#17a2b8'
        };
        return colors[type] || '#17a2b8';
    }
}

// Global functions for template onclick handlers
window.searchBrewerySuggestions = function(index) {
    // Placeholder for brewery search functionality
    console.log('Searching brewery suggestions for index:', index);
    enrichmentManager.showToast('Funzionalità di ricerca in sviluppo', 'info');
};

window.validateBreweryData = function(index) {
    const card = document.querySelector(`[data-type="brewery"][data-id="${index}"]`);
    if (card) {
        const inputs = card.querySelectorAll('.form-control');
        let isValid = true;
        
        inputs.forEach(input => {
            if (!enrichmentManager.validateField(input)) {
                isValid = false;
            }
        });
        
        if (isValid) {
            enrichmentManager.showToast('Dati birrificio validati con successo', 'success');
        } else {
            enrichmentManager.showToast('Correggi gli errori nei dati del birrificio', 'error');
        }
    }
};

window.searchBeerSuggestions = function(index) {
    console.log('Searching beer suggestions for index:', index);
    enrichmentManager.showToast('Funzionalità di ricerca in sviluppo', 'info');
};

window.analyzeLabel = function(index) {
    console.log('Analyzing label for beer index:', index);
    enrichmentManager.showToast('Analisi etichetta in sviluppo', 'info');
};

// Initialize when DOM is loaded
let enrichmentManager;

document.addEventListener('DOMContentLoaded', function() {
    if (document.getElementById('enrichmentForm')) {
        enrichmentManager = new EnrichmentManager();
        
        // Load draft if available
        enrichmentManager.loadDraft();
    }
});

// Clean up on page unload
window.addEventListener('beforeunload', function() {
    if (enrichmentManager) {
        enrichmentManager.saveAsDraft(true);
    }
});