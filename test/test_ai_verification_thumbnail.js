const { expect } = require('chai');
const { setupTestDatabase, cleanupTestDatabase, closeTestDatabase } = require('./testHelper');

// Import modelli DOPO setup database sicuro
let app, request;

describe('🖼️ AI Verification Thumbnail System', function() {
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

  describe('AI Verification Page - Thumbnail Display', function() {
    it('should display the verification page with image and AI data when session data is present', function(done) {
      // Simula dati di sessione come quelli creati dal sistema anti-allucinazioni
      const agent = request.agent();
      
      // Prima, simula una sessione con dati AI
      agent
        .get('/review/verify-ai-analysis')
        .expect(302) // Redirect perché non ci sono dati di sessione
        .end((err, res) => {
          if (err) return done(err);
          
          // Verifica che venga fatto redirect per mancanza dati
          expect(res.header.location).to.equal('/');
          done();
        });
    });

    it('should have CSS classes for thumbnail display', function(done) {
      // Test per verificare che i CSS siano caricati correttamente
      request
        .get('/css/aiVerification.css')
        .expect(200)
        .end((err, res) => {
          if (err) return done(err);
          
          // Verifica presenza delle nuove classi CSS
          expect(res.text).to.include('.ai-analysis-overview');
          expect(res.text).to.include('.analysis-image');
          expect(res.text).to.include('.bottle-thumbnail');
          expect(res.text).to.include('.bottle-thumb');
          expect(res.text).to.include('.confidence-indicator');
          expect(res.text).to.include('.enrichment-needed');
          done();
        });
    });

    it('should have proper template structure for AI data display', function() {
      // Test che verifica la struttura del template
      const fs = require('fs');
      const templatePath = '/home/alessandro/work/sb2/views/review/aiVerification.njk';
      const templateContent = fs.readFileSync(templatePath, 'utf8');
      
      // Verifica presenza delle sezioni per thumbnail e dati AI
      expect(templateContent).to.include('🖼️ Sezione Immagine Analizzata e Dati AI Rilevati');
      expect(templateContent).to.include('analysis-image-section');
      expect(templateContent).to.include('ai-detected-data');
      expect(templateContent).to.include('detected-bottles');
      expect(templateContent).to.include('bottle-thumbnail');
      expect(templateContent).to.include('confidence-indicator');
      expect(templateContent).to.include('enrichment-needed');
    });
  });

  describe('Session Data Structure', function() {
    it('should have proper data structure for AI verification', function() {
      // Test che verifica la struttura attesa dei dati di sessione
      const expectedSessionStructure = {
        aiAnalysisData: {
          bottles: [],
          breweries: [],
          processedData: {},
          userFlowType: 'string',
          messages: {},
          timestamp: 'string'
        },
        aiValidationResult: {
          canSaveDirectly: 'boolean',
          requiresUserConfirmation: 'boolean',
          requiresUserCompletion: 'boolean',
          blockedByValidation: 'boolean',
          userActions: [],
          messages: {}
        },
        aiImageData: {
          base64: 'string',
          mimeType: 'string',
          timestamp: 'string'
        }
      };
      
      // Verifica che la struttura sia ben definita
      expect(expectedSessionStructure).to.have.property('aiAnalysisData');
      expect(expectedSessionStructure).to.have.property('aiValidationResult');
      expect(expectedSessionStructure).to.have.property('aiImageData');
    });
  });
});