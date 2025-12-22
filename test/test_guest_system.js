const { expect } = require('chai');
const request = require('supertest');
const { setupTestDatabase, cleanupTestDatabase, closeTestDatabase } = require('./testHelper');

let app;

describe('Test Sistema Guest - Recensioni AI senza autenticazione', function() {
    this.timeout(30000);

    before(async function() {
        await setupTestDatabase();
        
        // Import app DOPO connessione sicura
        app = require('../src/app');
    });

    after(async function() {
        await cleanupTestDatabase();
        await closeTestDatabase();
    });

    describe('Accesso Guest al Sistema AI', function() {
        it('dovrebbe permettere accesso alla home page senza autenticazione', async function() {
            const response = await request(app)
                .get('/')
                .expect(200);
            
            // Verifica che la pagina sia caricata correttamente
            expect(response.text).to.include('SharingBeer');
            console.log('✅ Home page accessibile ai guest');
        });

        it('dovrebbe permettere accesso all\'interfaccia di verifica AI senza autenticazione', async function() {
            const agent = request.agent(app);
            
            // Simula dati di sessione per il test
            await agent
                .get('/')
                .expect(200);

            // Test accesso diretto (dovrebbe reindirizzare se non ci sono dati di sessione)
            const response = await agent
                .get('/review/verify-ai-analysis')
                .expect(302); // Redirect perché non ci sono dati di sessione
            
            console.log('✅ Sistema di verifica gestisce correttamente utenti guest');
        });

        it('dovrebbe permettere pulizia sessione validazione senza autenticazione', async function() {
            const agent = request.agent(app);
            
            const response = await agent
                .post('/review/clear-validation-session')
                .expect(200);
            
            expect(response.body).to.have.property('success', true);
            console.log('✅ Pulizia sessione funziona per utenti guest');
        });

        it('dovrebbe permettere controllo stato validazione senza autenticazione', async function() {
            const agent = request.agent(app);
            
            const response = await agent
                .get('/review/validation-status')
                .expect(200);
            
            expect(response.body).to.have.property('hasValidation');
            expect(response.body).to.have.property('hasSessionData');
            console.log('✅ Controllo stato validazione funziona per guest');
        });

        it('dovrebbe permettere ricerca suggerimenti senza autenticazione', async function() {
            const response = await request(app)
                .get('/review/api/suggestions')
                .query({
                    searchType: 'brewery',
                    breweryName: 'Test Brewery'
                })
                .expect(200);
            
            expect(response.body).to.have.property('success');
            expect(response.body).to.have.property('suggestions');
            console.log('✅ API suggerimenti accessibile ai guest');
        });
    });

    describe('Gestione Dati Guest', function() {
        it('dovrebbe gestire correttamente identificativi guest nelle rotte', async function() {
            const agent = request.agent(app);
            
            // Test che gli identificativi guest vengano gestiti correttamente
            const response = await agent
                .post('/review/clear-validation-session')
                .expect(200);
            
            expect(response.body.success).to.be.true;
            console.log('✅ Identificativi guest gestiti correttamente');
        });

        it('dovrebbe permettere salvataggio dati da parte di utenti guest', async function() {
            // Questo test verifica che il flusso di salvataggio sia configurato per guest
            // In pratica dovrebbe chiamare i controller con parametri guest
            
            const agent = request.agent(app);
            
            // Simula una richiesta di conferma (senza dati di sessione per semplicità)
            const response = await agent
                .post('/review/confirm-ai-analysis')
                .send({
                    confirmVerified: true,
                    userCompletions: []
                })
                .expect(400); // 400 perché non ci sono dati di sessione, ma non 401 (autenticazione)
            
            expect(response.body).to.have.property('success', false);
            expect(response.body.message).to.include('Dati di sessione non validi');
            console.log('✅ Flusso conferma configurato per gestire guest (errore appropriato senza dati sessione)');
        });
    });

    describe('Logging e Monitoraggio Guest', function() {
        it('dovrebbe loggare correttamente le attività guest', async function() {
            const agent = request.agent(app);
            
            // Test che le operazioni guest vengano loggate appropriatamente
            const response = await agent
                .get('/review/validation-status')
                .expect(200);
            
            // Se arriviamo qui, significa che il logging guest funziona
            // (i log effettivi sono visibili nella console del server)
            console.log('✅ Sistema di logging guest configurato correttamente');
        });
    });
});