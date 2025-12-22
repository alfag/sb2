const { expect } = require('chai');
const { setupTestDatabase, cleanupTestDatabase, closeTestDatabase } = require('./testHelper');

describe('🎨 Field State Visual System', function() {
  this.timeout(10000);

  before(async function() {
    await setupTestDatabase();
  });

  after(async function() {
    await cleanupTestDatabase();
    await closeTestDatabase();
  });

  describe('Template Field State Logic', function() {
    it('should have conditional classes for different field states', function() {
      const fs = require('fs');
      const templatePath = '/home/alessandro/work/sb2/views/review/aiVerification.njk';
      const templateContent = fs.readFileSync(templatePath, 'utf8');
      
      // Verifica presenza della logica per stati dei campi
      expect(templateContent).to.include('field-populated');
      expect(templateContent).to.include('field-required-missing');
      expect(templateContent).to.include('field-optional');
      
      // Verifica icone condizionali
      expect(templateContent).to.include('fas fa-check-circle text-success');
      expect(templateContent).to.include('fas fa-exclamation-circle text-danger');
      expect(templateContent).to.include('fas fa-circle text-muted');
      
      // Verifica messaggi condizionali
      expect(templateContent).to.include('Dato recuperato automaticamente');
      expect(templateContent).to.include('Campo obbligatorio mancante');
      expect(templateContent).to.include('Campo opzionale');
    });

    it('should have proper field state variables for brewery fields', function() {
      const fs = require('fs');
      const templatePath = '/home/alessandro/work/sb2/views/review/aiVerification.njk';
      const templateContent = fs.readFileSync(templatePath, 'utf8');
      
      // Verifica variabili per campi birrificio
      expect(templateContent).to.include('breweryNameValue');
      expect(templateContent).to.include('breweryWebsiteValue');
      expect(templateContent).to.include('breweryAddressValue');
      expect(templateContent).to.include('breweryEmailValue');
      expect(templateContent).to.include('breweryPhoneValue');
      expect(templateContent).to.include('breweryFoundedValue');
      expect(templateContent).to.include('breweryDescriptionValue');
    });

    it('should have proper field state variables for beer fields', function() {
      const fs = require('fs');
      const templatePath = '/home/alessandro/work/sb2/views/review/aiVerification.njk';
      const templateContent = fs.readFileSync(templatePath, 'utf8');
      
      // Verifica variabili per campi birra
      expect(templateContent).to.include('beerNameValue');
      expect(templateContent).to.include('beerTypeValue');
      expect(templateContent).to.include('beerAlcoholValue');
      expect(templateContent).to.include('beerVolumeValue');
    });
  });

  describe('CSS Field State Styling', function() {
    it('should have styles for populated fields (green)', function() {
      const fs = require('fs');
      const cssPath = '/home/alessandro/work/sb2/public/css/aiVerification.css';
      const cssContent = fs.readFileSync(cssPath, 'utf8');
      
      // Verifica stili per campi popolati
      expect(cssContent).to.include('.field-populated');
      expect(cssContent).to.include('background: linear-gradient(145deg, #d4edda 0%, #c3e6cb 100%)');
      expect(cssContent).to.include('border: 2px solid #28a745');
      expect(cssContent).to.include('.field-populated::before');
      expect(cssContent).to.include("content: '✅'");
    });

    it('should have styles for required missing fields (red)', function() {
      const fs = require('fs');
      const cssPath = '/home/alessandro/work/sb2/public/css/aiVerification.css';
      const cssContent = fs.readFileSync(cssPath, 'utf8');
      
      // Verifica stili per campi obbligatori mancanti
      expect(cssContent).to.include('.field-required-missing');
      expect(cssContent).to.include('background: linear-gradient(145deg, #f8d7da 0%, #f5c6cb 100%)');
      expect(cssContent).to.include('border: 2px solid #dc3545');
      expect(cssContent).to.include('.field-required-missing::before');
      expect(cssContent).to.include("content: '❗'");
      expect(cssContent).to.include('animation: requiredPulse 2s infinite');
    });

    it('should have styles for optional fields (white)', function() {
      const fs = require('fs');
      const cssPath = '/home/alessandro/work/sb2/public/css/aiVerification.css';
      const cssContent = fs.readFileSync(cssPath, 'utf8');
      
      // Verifica stili per campi opzionali
      expect(cssContent).to.include('.field-optional');
      expect(cssContent).to.include('background: white');
      expect(cssContent).to.include('border: 2px solid #e9ecef');
      expect(cssContent).to.include('.field-optional::before');
      expect(cssContent).to.include("content: '⚪'");
    });

    it('should have animations for required fields', function() {
      const fs = require('fs');
      const cssPath = '/home/alessandro/work/sb2/public/css/aiVerification.css';
      const cssContent = fs.readFileSync(cssPath, 'utf8');
      
      // Verifica animazioni per campi obbligatori
      expect(cssContent).to.include('@keyframes requiredPulse');
      expect(cssContent).to.include('@keyframes bounce');
      expect(cssContent).to.include('@keyframes pulse');
    });
  });

  describe('Field Classification Logic', function() {
    it('should classify brewery name as required', function() {
      const fs = require('fs');
      const templatePath = '/home/alessandro/work/sb2/views/review/aiVerification.njk';
      const templateContent = fs.readFileSync(templatePath, 'utf8');
      
      // Nome birrificio deve essere obbligatorio
      const breweryNameSection = templateContent.match(/<!-- Nome Birrificio - OBBLIGATORIO -->([\s\S]*?)<!-- /);
      expect(breweryNameSection).to.not.be.null;
      expect(breweryNameSection[1]).to.include('field-required-missing');
      expect(breweryNameSection[1]).to.include('required');
    });

    it('should classify brewery website as optional', function() {
      const fs = require('fs');
      const templatePath = '/home/alessandro/work/sb2/views/review/aiVerification.njk';
      const templateContent = fs.readFileSync(templatePath, 'utf8');
      
      // Sito web deve essere opzionale
      const websiteSection = templateContent.match(/<!-- Sito Web - OPZIONALE -->([\s\S]*?)<!-- /);
      expect(websiteSection).to.not.be.null;
      expect(websiteSection[1]).to.include('field-optional');
      expect(websiteSection[1]).to.not.include('required');
    });

    it('should classify beer name as required', function() {
      const fs = require('fs');
      const templatePath = '/home/alessandro/work/sb2/views/review/aiVerification.njk';
      const templateContent = fs.readFileSync(templatePath, 'utf8');
      
      // Nome birra deve essere obbligatorio
      const beerNameSection = templateContent.match(/<!-- Nome Birra - OBBLIGATORIO -->([\s\S]*?)<!-- /);
      expect(beerNameSection).to.not.be.null;
      expect(beerNameSection[1]).to.include('field-required-missing');
      expect(beerNameSection[1]).to.include('required');
    });

    it('should classify beer type as important but optional', function() {
      const fs = require('fs');
      const templatePath = '/home/alessandro/work/sb2/views/review/aiVerification.njk';
      const templateContent = fs.readFileSync(templatePath, 'utf8');
      
      // Tipologia birra deve essere importante ma opzionale
      const beerTypeSection = templateContent.match(/<!-- Tipologia - IMPORTANTE ma non obbligatorio -->([\s\S]*?)<!-- /);
      expect(beerTypeSection).to.not.be.null;
      expect(beerTypeSection[1]).to.include('field-optional');
      expect(beerTypeSection[1]).to.not.include('required');
    });
  });

  describe('Visual Feedback System', function() {
    it('should have different icons for different field states', function() {
      const fs = require('fs');
      const templatePath = '/home/alessandro/work/sb2/views/review/aiVerification.njk';
      const templateContent = fs.readFileSync(templatePath, 'utf8');
      
      // Verifica icone diverse per stati diversi
      expect(templateContent).to.include('fas fa-check-circle text-success'); // Popolato
      expect(templateContent).to.include('fas fa-exclamation-circle text-danger'); // Mancante obbligatorio
      expect(templateContent).to.include('fas fa-circle text-muted'); // Opzionale
    });

    it('should have informative field hints', function() {
      const fs = require('fs');
      const templatePath = '/home/alessandro/work/sb2/views/review/aiVerification.njk';
      const templateContent = fs.readFileSync(templatePath, 'utf8');
      
      // Verifica messaggi informativi diversi
      expect(templateContent).to.include('✅ <strong>Dato recuperato automaticamente</strong>');
      expect(templateContent).to.include('❗ <strong>Campo obbligatorio mancante</strong>');
      expect(templateContent).to.include('⚪ <strong>Campo opzionale</strong>');
      expect(templateContent).to.include('⚪ <strong>Campo importante</strong>');
    });

    it('should have proper CSS classes for form controls', function() {
      const fs = require('fs');
      const templatePath = '/home/alessandro/work/sb2/views/review/aiVerification.njk';
      const templateContent = fs.readFileSync(templatePath, 'utf8');
      
      // Verifica classi CSS per input
      expect(templateContent).to.include('form-control required'); // Base obbligatorio
      expect(templateContent).to.include('populated'); // Dato presente
      expect(templateContent).to.include('missing-required'); // Obbligatorio mancante
      expect(templateContent).to.include('optional'); // Opzionale
    });
  });

  describe('Data Retrieval Logic', function() {
    it('should handle multiple data source fallbacks', function() {
      const fs = require('fs');
      const templatePath = '/home/alessandro/work/sb2/views/review/aiVerification.njk';
      const templateContent = fs.readFileSync(templatePath, 'utf8');
      
      // Verifica fallback per nome birrificio
      expect(templateContent).to.include('brewery.breweryName or brewery.name or');
      
      // Verifica fallback per nome birra
      expect(templateContent).to.include('bottle.bottleLabel or bottle.beerName or bottle.name or');
      
      // Verifica fallback per tipo birra
      expect(templateContent).to.include('bottle.beerType or bottle.type or bottle.style or');
      
      // Verifica fallback per gradazione
      expect(templateContent).to.include('bottle.alcoholContent | replace');
    });
  });
});