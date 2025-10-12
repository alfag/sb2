/**
 * Test Suite per Sistema Multi-Ruolo - Fase 2
 * Test per Brewery Dashboard Unificato e funzionalità complete
 */

const request = require('supertest');
const { expect } = require('chai');
const { setupTestDatabase, cleanupTestDatabase, closeTestDatabase } = require('./testHelper');

// Import modelli DOPO setup database per sicurezza
let app, User, Brewery, Beer, Review;

describe('FASE 2: Sistema Multi-Ruolo - Brewery Dashboard', function() {
    this.timeout(10000);

    let testUser, testBrewery, testBeer, testReview;
    let agent;

    before(async function() {
        // Setup database di test sicuro
        await setupTestDatabase();
        
        // Import modelli DOPO connessione sicura
        app = require('../src/app');
        User = require('../src/models/User');
        Brewery = require('../src/models/Brewery');
        Beer = require('../src/models/Beer');
        Review = require('../src/models/Review');
        
        // Inizializza agent DOPO import app
        agent = request.agent(app);
        
        // Setup test data
        try {
            // Crea birrificio test
            testBrewery = new Brewery({
                breweryName: 'Test Brewery Dashboard',
                breweryDescription: 'Birrificio per test dashboard',
                breweryFiscalCode: 'TEST123456789',
                breweryAddress: 'Via Test 123',
                breweryPhoneNumber: '+39 123 456 7890',
                breweryWebsite: 'https://test-brewery.com'
            });
            await testBrewery.save();

            // Crea birra test
            testBeer = new Beer({
                beerName: 'Test Beer Dashboard',
                brewery: testBrewery._id,
                beerDescription: 'Birra per test dashboard'
            });
            await testBeer.save();

            // Aggiungi birra al birrificio
            testBrewery.breweryProducts.push(testBeer._id);
            await testBrewery.save();

            // Crea utente brewery test
            testUser = new User({
                username: 'brewery-dashboard-test',
                password: 'password123',
                role: ['customer', 'brewery'],
                defaultRole: 'brewery',
                breweryDetails: testBrewery._id,
                customerDetails: {
                    customerID: new Date().getTime(),
                    customerName: 'Test',
                    customerSurname: 'Brewery',
                    customerFiscalCode: 'TSTBRW123456'
                }
            });
            await testUser.save();

            // Crea recensione test
            testReview = new Review({
                reviewUser: testUser._id,
                reviewBeer: testBeer._id,
                reviewBrewery: testBrewery._id,
                reviewImageUrl: 'test-image.jpg',
                reviews: [{
                    reviewText: 'Recensione test per dashboard',
                    reviewRating: 4.5,
                    reviewAppearance: 4,
                    reviewAroma: 4,
                    reviewTaste: 5,
                    reviewMouthfeel: 4,
                    reviewOverall: 4
                }]
            });
            await testReview.save();

        } catch (error) {
            console.error('Errore setup test data:', error);
            throw error;
        }
    });

    after(async function() {
        // Cleanup test data
        try {
            if (testReview) await Review.findByIdAndDelete(testReview._id);
            if (testBeer) await Beer.findByIdAndDelete(testBeer._id);
            if (testBrewery) await Brewery.findByIdAndDelete(testBrewery._id);
            if (testUser) await User.findByIdAndDelete(testUser._id);
        } catch (error) {
            console.warn('Errore cleanup test data:', error);
        }
        
        // Cleanup automatico database test
        await cleanupTestDatabase();
        await closeTestDatabase();
    });

    describe('🏭 Brewery Dashboard Access', function() {
        beforeEach(async function() {
            // Login come brewery user
            await agent
                .post('/auth/login')
                .send({
                    username: 'brewery-dashboard-test',
                    password: 'password123'
                });
        });

        afterEach(async function() {
            // Logout
            await agent.post('/auth/logout');
        });

        it('dovrebbe permettere accesso alla dashboard brewery per utenti brewery', async function() {
            const response = await agent
                .get('/brewery/dashboard')
                .expect(200);

            expect(response.text).to.include('Dashboard Gestione Birrificio');
            expect(response.text).to.include(testBrewery.breweryName);
            expect(response.text).to.include('Statistiche Birrificio');
            expect(response.text).to.include('Modifica Dati Birrificio');
        });

        it('dovrebbe mostrare statistiche corrette del birrificio', async function() {
            const response = await agent
                .get('/brewery/dashboard')
                .expect(200);

            // Verifica presenza metriche
            expect(response.text).to.include('Recensioni Totali');
            expect(response.text).to.include('Birre Catalogate');
            expect(response.text).to.include('Rating Medio');
            expect(response.text).to.include('Utenti Attivi');
        });

        it('dovrebbe mostrare form di modifica con dati attuali', async function() {
            const response = await agent
                .get('/brewery/dashboard')
                .expect(200);

            // Verifica form fields con valori attuali
            expect(response.text).to.include(`value="${testBrewery.breweryName}"`);
            expect(response.text).to.include(testBrewery.breweryDescription);
            expect(response.text).to.include(`value="${testBrewery.breweryFiscalCode}"`);
            expect(response.text).to.include(`value="${testBrewery.breweryAddress}"`);
            expect(response.text).to.include(`value="${testBrewery.breweryPhoneNumber}"`);
            expect(response.text).to.include(`value="${testBrewery.breweryWebsite}"`);
        });

        it('dovrebbe permettere aggiornamento dati birrificio', async function() {
            const updatedData = {
                breweryName: 'Updated Test Brewery',
                breweryDescription: 'Descrizione aggiornata via dashboard',
                breweryFiscalCode: 'UPD123456789',
                breweryAddress: 'Via Aggiornata 456',
                breweryPhoneNumber: '+39 987 654 3210',
                breweryWebsite: 'https://updated-brewery.com'
            };

            await agent
                .post(`/brewery/dashboard/update/${testBrewery._id}`)
                .send(updatedData)
                .expect(302); // Redirect

            // Verifica aggiornamento nel database
            const updatedBrewery = await Brewery.findById(testBrewery._id);
            expect(updatedBrewery.breweryName).to.equal(updatedData.breweryName);
            expect(updatedBrewery.breweryDescription).to.equal(updatedData.breweryDescription);
            expect(updatedBrewery.breweryFiscalCode).to.equal(updatedData.breweryFiscalCode);
            expect(updatedBrewery.breweryAddress).to.equal(updatedData.breweryAddress);
            expect(updatedBrewery.breweryPhoneNumber).to.equal(updatedData.breweryPhoneNumber);
            expect(updatedBrewery.breweryWebsite).to.equal(updatedData.breweryWebsite);
        });
    });

    describe('🔒 Brewery Dashboard Security', function() {
        let otherBrewery, otherUser;

        before(async function() {
            // Crea altro birrificio e utente per test sicurezza
            otherBrewery = new Brewery({
                breweryName: 'Other Test Brewery',
                breweryDescription: 'Altro birrificio per test sicurezza'
            });
            await otherBrewery.save();

            otherUser = new User({
                username: 'other-brewery-test',
                password: 'password123',
                role: ['customer', 'brewery'],
                breweryDetails: otherBrewery._id,
                customerDetails: {
                    customerID: new Date().getTime() + 1,
                    customerName: 'Other',
                    customerSurname: 'Brewery',
                    customerFiscalCode: 'OTRBR123456'
                }
            });
            await otherUser.save();
        });

        after(async function() {
            if (otherUser) await User.findByIdAndDelete(otherUser._id);
            if (otherBrewery) await Brewery.findByIdAndDelete(otherBrewery._id);
        });

        it('dovrebbe negare accesso a utenti non brewery', async function() {
            // Crea utente solo customer
            const customerUser = new User({
                username: 'customer-only-test',
                password: 'password123',
                role: ['customer'],
                customerDetails: {
                    customerID: new Date().getTime() + 2,
                    customerName: 'Customer',
                    customerSurname: 'Only',
                    customerFiscalCode: 'CSTMR123456'
                }
            });
            await customerUser.save();

            const customerAgent = request.agent(app);
            await customerAgent
                .post('/auth/login')
                .send({
                    username: 'customer-only-test',
                    password: 'password123'
                });

            await customerAgent
                .get('/brewery/dashboard')
                .expect(302); // Redirect per accesso negato

            await customerAgent.post('/auth/logout');
            await User.findByIdAndDelete(customerUser._id);
        });

        it('dovrebbe impedire modifica dati di altri birrifici', async function() {
            const otherAgent = request.agent(app);
            
            await otherAgent
                .post('/auth/login')
                .send({
                    username: 'other-brewery-test',
                    password: 'password123'
                });

            // Tenta di modificare il birrificio del primo utente
            await otherAgent
                .post(`/brewery/dashboard/update/${testBrewery._id}`)
                .send({
                    breweryName: 'Tentativo Hacking'
                })
                .expect(302); // Redirect per accesso negato

            // Verifica che i dati non siano cambiati
            const unchangedBrewery = await Brewery.findById(testBrewery._id);
            expect(unchangedBrewery.breweryName).to.not.equal('Tentativo Hacking');

            await otherAgent.post('/auth/logout');
        });
    });

    describe('🔄 Multi-Role Integration', function() {
        beforeEach(async function() {
            await agent
                .post('/auth/login')
                .send({
                    username: 'brewery-dashboard-test',
                    password: 'password123'
                });
        });

        afterEach(async function() {
            await agent.post('/auth/logout');
        });

        it('dovrebbe permettere cambio ruolo da brewery a customer', async function() {
            // Cambio a customer
            await agent
                .post('/profile')
                .send({ activeRole: 'customer' })
                .expect(302);

            // Verifica che la dashboard brewery non sia più accessibile
            await agent
                .get('/brewery/dashboard')
                .expect(302); // Redirect per ruolo sbagliato
        });

        it('dovrebbe usare defaultRole brewery per redirect automatico', async function() {
            // Logout e re-login
            await agent.post('/auth/logout');
            
            // Verifica che l'utente abbia defaultRole = brewery
            const user = await User.findById(testUser._id);
            expect(user.defaultRole).to.equal('brewery');

            // Re-login dovrebbe reindirizzare alla dashboard brewery
            const loginResponse = await agent
                .post('/auth/login')
                .send({
                    username: 'brewery-dashboard-test',
                    password: 'password123'
                });

            // Segue il redirect
            expect(loginResponse.status).to.equal(302);
        });
    });

    describe('📊 Dashboard Statistics Integration', function() {
        beforeEach(async function() {
            await agent
                .post('/auth/login')
                .send({
                    username: 'brewery-dashboard-test',
                    password: 'password123'
                });
        });

        afterEach(async function() {
            await agent.post('/auth/logout');
        });

        it('dovrebbe mostrare statistiche filtrate per il birrificio specifico', async function() {
            const response = await agent
                .get('/brewery/dashboard')
                .expect(200);

            // Verifica che mostri solo statistiche del proprio birrificio
            expect(response.text).to.include(testBrewery.breweryName);
            expect(response.text).to.include(testBeer.beerName);
            
            // Non dovrebbe mostrare dati di altri birrifici
            expect(response.text).to.not.include('Other Test Brewery');
        });

        it('dovrebbe generare charts se ci sono recensioni', async function() {
            const response = await agent
                .get('/brewery/dashboard')
                .expect(200);

            // Verifica presenza script Chart.js se ci sono recensioni
            if (testReview) {
                expect(response.text).to.include('Chart.js');
                expect(response.text).to.include('reviewsChart');
            }
        });
    });
});

module.exports = {};
