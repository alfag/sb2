const { expect } = require('chai');
const { setupTestDatabase, cleanupTestDatabase, closeTestDatabase } = require('./testHelper');

// Import modelli DOPO setup database sicuro
let app, request;

describe('📝 AI Verification Enrichment Fields', function() {
  this.timeout(10000);

  before(async function() {
    await setupTestDatabase();
    
    // Import DOPO connessione sicura
    app = require('../src/app');
    request = require('supertest')(app);
  });

  after(async function() {
    await cleanupTestDatabase();
    await closeTestDatabase();
  });

  describe('Enrichment Form Structure', function() {
    it('should have enrichment form section in the template', function() {
      const fs = require('fs');
      const templatePath = '/home/alessandro/work/sb2/views/review/aiVerification.njk';
      const templateContent = fs.readFileSync(templatePath, 'utf8');
      
      // Verifica presenza della sezione form per arricchimento
      expect(templateContent).to.include('📝 Sezione Form per Arricchimento Dati');
      expect(templateContent).to.include('enrichment-form-section');
      expect(templateContent).to.include('enrichmentForm');
      
      // Verifica presenza dei campi per birrifici
      expect(templateContent).to.include('brewery-enrichment');
      expect(templateContent).to.include('brewery_name_');
      expect(templateContent).to.include('brewery_website_');
      expect(templateContent).to.include('brewery_address_');
      expect(templateContent).to.include('brewery_email_');
      expect(templateContent).to.include('brewery_phone_');
      
      // Verifica presenza dei campi per birre
      expect(templateContent).to.include('beer-enrichment');
      expect(templateContent).to.include('beer_name_');
      expect(templateContent).to.include('beer_type_');
      expect(templateContent).to.include('beer_alcohol_');
      expect(templateContent).to.include('beer_volume_');
      expect(templateContent).to.include('beer_ibu_');
    });

    it('should have enrichment manager JavaScript', function() {
      const fs = require('fs');
      const jsPath = '/home/alessandro/work/sb2/public/js/enrichmentManager.js';
      
      expect(fs.existsSync(jsPath)).to.be.true;
      
      const jsContent = fs.readFileSync(jsPath, 'utf8');
      
      // Verifica presenza delle funzioni principali
      expect(jsContent).to.include('class EnrichmentManager');
      expect(jsContent).to.include('calculateCompleteness');
      expect(jsContent).to.include('updateGlobalProgress');
      expect(jsContent).to.include('validateField');
      expect(jsContent).to.include('saveAsDraft');
      expect(jsContent).to.include('submitForm');
    });

    it('should have enrichment CSS styles', function() {
      const fs = require('fs');
      const cssPath = '/home/alessandro/work/sb2/public/css/aiVerification.css';
      const cssContent = fs.readFileSync(cssPath, 'utf8');
      
      // Verifica presenza degli stili per i form di arricchimento
      expect(cssContent).to.include('.enrichment-form-section');
      expect(cssContent).to.include('.enrichment-card');
      expect(cssContent).to.include('.completeness-indicator');
      expect(cssContent).to.include('.form-grid');
      expect(cssContent).to.include('.ai-suggestion-section');
      expect(cssContent).to.include('.form-actions');
      expect(cssContent).to.include('.progress-bar');
    });
  });

  describe('Form Field Types', function() {
    it('should have appropriate input types for different data', function() {
      const fs = require('fs');
      const templatePath = '/home/alessandro/work/sb2/views/review/aiVerification.njk';
      const templateContent = fs.readFileSync(templatePath, 'utf8');
      
      // Verifica tipi di input appropriati
      expect(templateContent).to.include('type="email"'); // Per email
      expect(templateContent).to.include('type="url"'); // Per siti web
      expect(templateContent).to.include('type="tel"'); // Per telefoni
      expect(templateContent).to.include('type="number"'); // Per numeri (anno, gradazione, ecc.)
      
      // Verifica presenza di textarea per descrizioni
      expect(templateContent).to.include('<textarea'); // Per descrizioni
      
      // Verifica presenza di select per tipologie birra
      expect(templateContent).to.include('<select'); // Per tipologie
      expect(templateContent).to.include('option value="IPA"');
      expect(templateContent).to.include('option value="Lager"');
      expect(templateContent).to.include('option value="Stout"');
    });

    it('should have proper form validation attributes', function() {
      const fs = require('fs');
      const templatePath = '/home/alessandro/work/sb2/views/review/aiVerification.njk';
      const templateContent = fs.readFileSync(templatePath, 'utf8');
      
      // Verifica attributi di validazione
      expect(templateContent).to.include('required'); // Campi obbligatori
      expect(templateContent).to.include('class="form-control required"'); // Classi richieste
      expect(templateContent).to.include('placeholder='); // Placeholder informativi
      expect(templateContent).to.include('min='); // Valori minimi per numeri
      expect(templateContent).to.include('max='); // Valori massimi per numeri
      expect(templateContent).to.include('step='); // Step per decimali
    });
  });

  describe('Interactive Features', function() {
    it('should have completeness indicators', function() {
      const fs = require('fs');
      const templatePath = '/home/alessandro/work/sb2/views/review/aiVerification.njk';
      const templateContent = fs.readFileSync(templatePath, 'utf8');
      
      // Verifica indicatori di completezza
      expect(templateContent).to.include('completeness-indicator');
      expect(templateContent).to.include('completeness-bar');
      expect(templateContent).to.include('completeness-fill');
      expect(templateContent).to.include('completeness-value');
    });

    it('should have action buttons for AI assistance', function() {
      const fs = require('fs');
      const templatePath = '/home/alessandro/work/sb2/views/review/aiVerification.njk';
      const templateContent = fs.readFileSync(templatePath, 'utf8');
      
      // Verifica pulsanti di assistenza AI
      expect(templateContent).to.include('searchBrewerySuggestions');
      expect(templateContent).to.include('validateBreweryData');
      expect(templateContent).to.include('searchBeerSuggestions');
      expect(templateContent).to.include('analyzeLabel');
    });

    it('should have form submission handling', function() {
      const fs = require('fs');
      const templatePath = '/home/alessandro/work/sb2/views/review/aiVerification.njk';
      const templateContent = fs.readFileSync(templatePath, 'utf8');
      
      // Verifica gestione invio form
      expect(templateContent).to.include('saveAsDraftBtn');
      expect(templateContent).to.include('validateAllBtn');
      expect(templateContent).to.include('submitEnrichmentBtn');
      expect(templateContent).to.include('userCompletionsData');
    });
  });

  describe('User Experience Features', function() {
    it('should have progress tracking', function() {
      const fs = require('fs');
      const templatePath = '/home/alessandro/work/sb2/views/review/aiVerification.njk';
      const templateContent = fs.readFileSync(templatePath, 'utf8');
      
      // Verifica tracking progresso
      expect(templateContent).to.include('form-progress');
      expect(templateContent).to.include('globalProgressBar');
      expect(templateContent).to.include('globalProgressPercentage');
    });

    it('should have field hints and help text', function() {
      const fs = require('fs');
      const templatePath = '/home/alessandro/work/sb2/views/review/aiVerification.njk';
      const templateContent = fs.readFileSync(templatePath, 'utf8');
      
      // Verifica presenza di hint informativi
      expect(templateContent).to.include('field-hint');
      expect(templateContent).to.include('Il nome ufficiale del birrificio');
      expect(templateContent).to.include('URL del sito web ufficiale');
      expect(templateContent).to.include('Percentuale di alcol per volume');
      expect(templateContent).to.include('International Bitterness Units');
    });
  });

  describe('JavaScript Functionality', function() {
    it('should have EnrichmentManager class with required methods', function() {
      const fs = require('fs');
      const jsPath = '/home/alessandro/work/sb2/public/js/enrichmentManager.js';
      const jsContent = fs.readFileSync(jsPath, 'utf8');
      
      // Verifica metodi principali della classe
      expect(jsContent).to.include('constructor()');
      expect(jsContent).to.include('init()');
      expect(jsContent).to.include('bindEvents()');
      expect(jsContent).to.include('handleInputChange');
      expect(jsContent).to.include('calculateCompleteness');
      expect(jsContent).to.include('updateCompleteness');
      expect(jsContent).to.include('validateField');
      expect(jsContent).to.include('saveAsDraft');
      expect(jsContent).to.include('submitForm');
    });

    it('should have validation functions', function() {
      const fs = require('fs');
      const jsPath = '/home/alessandro/work/sb2/public/js/enrichmentManager.js';
      const jsContent = fs.readFileSync(jsPath, 'utf8');
      
      // Verifica funzioni di validazione
      expect(jsContent).to.include('isValidEmail');
      expect(jsContent).to.include('isValidURL');
      expect(jsContent).to.include('validateAll');
      expect(jsContent).to.include('showFieldError');
      expect(jsContent).to.include('hideFieldError');
    });

    it('should have auto-save functionality', function() {
      const fs = require('fs');
      const jsPath = '/home/alessandro/work/sb2/public/js/enrichmentManager.js';
      const jsContent = fs.readFileSync(jsPath, 'utf8');
      
      // Verifica funzionalità auto-save
      expect(jsContent).to.include('setupAutoSave');
      expect(jsContent).to.include('loadDraft');
      expect(jsContent).to.include('localStorage');
      expect(jsContent).to.include('sb2_enrichment_draft');
    });
  });
});