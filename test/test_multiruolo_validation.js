/**
 * Test Suite Validazione Sistema Multi-Ruolo Completo
 * Test per tutte le funzionalità Fase 1 + Fase 2
 */

const request = require('supertest');
const { expect } = require('chai');
const { setupTestDatabase, cleanupTestDatabase, closeTestDatabase } = require('./testHelper');

// Import modelli DOPO setup database per sicurezza
let app, User, Brewery;

describe('VALIDAZIONE COMPLETA: Sistema Multi-Ruolo Fase 1+2', function() {
    this.timeout(15000);

    let adminUser, breweryUser, customerUser, testBrewery;
    let adminAgent, breweryAgent, customerAgent;

    before(async function() {
        // Setup database di test sicuro
        await setupTestDatabase();
        
        // Import modelli DOPO connessione sicura
        app = require('../src/app');
        User = require('../src/models/User');
        Brewery = require('../src/models/Brewery');
        
        // Inizializza agents DOPO import app
        adminAgent = request.agent(app);
        breweryAgent = request.agent(app);
        customerAgent = request.agent(app);
        
        // Setup completo test data
        try {
            // Crea birrificio test
            testBrewery = new Brewery({
                breweryName: 'Multi-Role Test Brewery',
                breweryDescription: 'Birrificio per test multi-ruolo completo',
                breweryFiscalCode: 'MLTROLE123',
                breweryAddress: 'Via Multi Role 123'
            });
            await testBrewery.save();

            // Crea admin user
            adminUser = new User({
                username: 'ClaudeAdmin',
                password: 'ClaudeAdminPassword1',
                role: ['customer', 'administrator'],
                defaultRole: 'customer',
                customerDetails: {
                    customerID: new Date().getTime(),
                    customerName: 'Claude',
                    customerSurname: 'Admin',
                    customerFiscalCode: 'CLDADM123456'
                }
            });
            await adminUser.save();

            // Crea brewery user multi-ruolo
            breweryUser = new User({
                username: 'multi-brewery-user',
                password: 'password123',
                role: ['customer', 'brewery'],
                defaultRole: 'brewery',
                breweryDetails: testBrewery._id,
                customerDetails: {
                    customerID: new Date().getTime() + 1,
                    customerName: 'Multi',
                    customerSurname: 'Brewery',
                    customerFiscalCode: 'MLTBRW123456'
                }
            });
            await breweryUser.save();

            // Crea customer user
            customerUser = new User({
                username: 'customer-only-user',
                password: 'password123',
                role: ['customer'],
                defaultRole: 'customer',
                customerDetails: {
                    customerID: new Date().getTime() + 2,
                    customerName: 'Customer',
                    customerSurname: 'Only',
                    customerFiscalCode: 'CSTMR123456'
                }
            });
            await customerUser.save();

        } catch (error) {
            console.error('Errore setup validazione completa:', error);
            throw error;
        }
    });

    after(async function() {
        // Cleanup completo
        try {
            if (customerUser) await User.findByIdAndDelete(customerUser._id);
            if (breweryUser) await User.findByIdAndDelete(breweryUser._id);
            if (adminUser) await User.findByIdAndDelete(adminUser._id);
            if (testBrewery) await Brewery.findByIdAndDelete(testBrewery._id);
        } catch (error) {
            console.warn('Errore cleanup validazione completa:', error);
        }
        
        // Cleanup automatico database test
        await cleanupTestDatabase();
        await closeTestDatabase();
    });

    describe('🎯 FASE 1: Sicurezza e Gestione Ruoli', function() {
        beforeEach(async function() {
            // Login admin
            await adminAgent
                .post('/auth/login')
                .send({
                    username: 'ClaudeAdmin',
                    password: 'ClaudeAdminPassword1'
                });
        });

        afterEach(async function() {
            await adminAgent.post('/auth/logout');
        });

        it('dovrebbe bloccare assegnazione ruolo administrator', async function() {
            const response = await adminAgent
                .post(`/administrator/users/update/${breweryUser._id}/add-role`)
                .send({ roleToAdd: 'administrator' })
                .expect(302);

            // Verifica che il ruolo non sia stato aggiunto
            const user = await User.findById(breweryUser._id);
            expect(user.role).to.not.include('administrator');
        });

        it('dovrebbe proteggere rimozione ruolo customer', async function() {
            const response = await adminAgent
                .post(`/administrator/users/update/${breweryUser._id}/remove-role`)
                .send({ roleToRemove: 'customer' })
                .expect(302);

            // Verifica che il ruolo customer sia ancora presente
            const user = await User.findById(breweryUser._id);
            expect(user.role).to.include('customer');
        });

        it('dovrebbe validare defaultRole nel modello User', async function() {
            const user = await User.findById(breweryUser._id);
            expect(user.defaultRole).to.be.oneOf(['customer', 'brewery']);
            expect(user.defaultRole).to.equal('brewery');
        });

        it('dovrebbe gestire cambio activeRole via profilo', async function() {
            // Login brewery user
            await breweryAgent
                .post('/auth/login')
                .send({
                    username: 'multi-brewery-user',
                    password: 'password123'
                });

            // Cambia activeRole a customer
            await breweryAgent
                .post('/profile')
                .send({ activeRole: 'customer' })
                .expect(302);

            // Verifica che la dashboard brewery non sia accessibile
            await breweryAgent
                .get('/brewery/dashboard')
                .expect(302);

            await breweryAgent.post('/auth/logout');
        });
    });

    describe('🏭 FASE 2: Brewery Dashboard Unificato', function() {
        beforeEach(async function() {
            await breweryAgent
                .post('/auth/login')
                .send({
                    username: 'multi-brewery-user',
                    password: 'password123'
                });
        });

        afterEach(async function() {
            await breweryAgent.post('/auth/logout');
        });

        it('dovrebbe fornire accesso completo alla dashboard brewery', async function() {
            const response = await breweryAgent
                .get('/brewery/dashboard')
                .expect(200);

            // Verifica elementi dashboard unificata
            expect(response.text).to.include('Dashboard Gestione Birrificio');
            expect(response.text).to.include('Statistiche Birrificio');
            expect(response.text).to.include('Modifica Dati Birrificio');
            expect(response.text).to.include(testBrewery.breweryName);
        });

        it('dovrebbe permettere aggiornamenti sicuri dei dati', async function() {
            const originalName = testBrewery.breweryName;
            const newName = 'Updated Multi-Role Brewery';

            await breweryAgent
                .post(`/brewery/dashboard/update/${testBrewery._id}`)
                .send({
                    breweryName: newName,
                    breweryDescription: 'Descrizione aggiornata'
                })
                .expect(302);

            // Verifica aggiornamento
            const updatedBrewery = await Brewery.findById(testBrewery._id);
            expect(updatedBrewery.breweryName).to.equal(newName);

            // Ripristina nome originale per altri test
            await Brewery.findByIdAndUpdate(testBrewery._id, { breweryName: originalName });
        });

        it('dovrebbe mostrare statistiche specifiche del birrificio', async function() {
            const response = await breweryAgent
                .get('/brewery/dashboard')
                .expect(200);

            // Verifica presenza metriche specifiche
            expect(response.text).to.include('Recensioni Totali');
            expect(response.text).to.include('Birre Catalogate');
            expect(response.text).to.include('Rating Medio');
        });
    });

    describe('🔒 Controlli Sicurezza Cross-Ruolo', function() {
        it('customer non dovrebbe accedere a dashboard brewery', async function() {
            await customerAgent
                .post('/auth/login')
                .send({
                    username: 'customer-only-user',
                    password: 'password123'
                });

            await customerAgent
                .get('/brewery/dashboard')
                .expect(302); // Redirect per accesso negato

            await customerAgent.post('/auth/logout');
        });

        it('customer non dovrebbe accedere a funzioni admin', async function() {
            await customerAgent
                .post('/auth/login')
                .send({
                    username: 'customer-only-user',
                    password: 'password123'
                });

            await customerAgent
                .get('/administrator/users')
                .expect(302); // Redirect per accesso negato

            await customerAgent.post('/auth/logout');
        });

        it('brewery user non dovrebbe modificare altri birrifici', async function() {
            // Crea secondo birrificio
            const otherBrewery = new Brewery({
                breweryName: 'Other Security Test Brewery',
                breweryDescription: 'Per test sicurezza'
            });
            await otherBrewery.save();

            await breweryAgent
                .post('/auth/login')
                .send({
                    username: 'multi-brewery-user',
                    password: 'password123'
                });

            // Tenta modifica birrificio non proprio
            await breweryAgent
                .post(`/brewery/dashboard/update/${otherBrewery._id}`)
                .send({ breweryName: 'Hacked Name' })
                .expect(302);

            // Verifica che non sia cambiato
            const unchangedBrewery = await Brewery.findById(otherBrewery._id);
            expect(unchangedBrewery.breweryName).to.equal('Other Security Test Brewery');

            await breweryAgent.post('/auth/logout');
            await Brewery.findByIdAndDelete(otherBrewery._id);
        });
    });

    describe('🔄 Integrazione Completa Multi-Ruolo', function() {
        it('dovrebbe gestire workflow completo admin -> brewery', async function() {
            // Login admin
            await adminAgent
                .post('/auth/login')
                .send({
                    username: 'ClaudeAdmin',
                    password: 'ClaudeAdminPassword1'
                });

            // Admin gestisce utente brewery
            const response = await adminAgent
                .get(`/administrator/users/update?userUpdateId=${breweryUser._id}`)
                .expect(200);

            expect(response.text).to.include('multi-brewery-user');
            expect(response.text).to.include(testBrewery.breweryName);

            await adminAgent.post('/auth/logout');

            // Brewery user accede alla propria dashboard
            await breweryAgent
                .post('/auth/login')
                .send({
                    username: 'multi-brewery-user',
                    password: 'password123'
                });

            await breweryAgent
                .get('/brewery/dashboard')
                .expect(200);

            await breweryAgent.post('/auth/logout');
        });

        it('dovrebbe mantenere consistenza durante cambi ruolo', async function() {
            await breweryAgent
                .post('/auth/login')
                .send({
                    username: 'multi-brewery-user',
                    password: 'password123'
                });

            // Accesso dashboard come brewery
            await breweryAgent
                .get('/brewery/dashboard')
                .expect(200);

            // Cambio a customer
            await breweryAgent
                .post('/profile')
                .send({ activeRole: 'customer' })
                .expect(302);

            // Dashboard brewery non più accessibile
            await breweryAgent
                .get('/brewery/dashboard')
                .expect(302);

            // Cambio di nuovo a brewery
            await breweryAgent
                .post('/profile')
                .send({ activeRole: 'brewery' })
                .expect(302);

            // Dashboard brewery di nuovo accessibile
            await breweryAgent
                .get('/brewery/dashboard')
                .expect(200);

            await breweryAgent.post('/auth/logout');
        });
    });

    describe('📊 Performance e Scalabilità', function() {
        it('dovrebbe caricare dashboard con performance accettabili', async function() {
            await breweryAgent
                .post('/auth/login')
                .send({
                    username: 'multi-brewery-user',
                    password: 'password123'
                });

            const startTime = Date.now();
            
            await breweryAgent
                .get('/brewery/dashboard')
                .expect(200);

            const loadTime = Date.now() - startTime;
            expect(loadTime).to.be.below(3000); // Sotto 3 secondi

            await breweryAgent.post('/auth/logout');
        });

        it('dovrebbe gestire richieste concorrenti senza conflitti', async function() {
            const promises = [];
            
            // Simula richieste concorrenti
            for (let i = 0; i < 5; i++) {
                const agent = request.agent(app);
                promises.push(
                    agent
                        .post('/auth/login')
                        .send({
                            username: 'multi-brewery-user',
                            password: 'password123'
                        })
                        .then(() => agent.get('/brewery/dashboard'))
                        .then(() => agent.post('/auth/logout'))
                );
            }

            const results = await Promise.all(promises);
            
            // Tutte le richieste dovrebbero essere riuscite
            results.forEach(result => {
                expect(result.status).to.equal(200);
            });
        });
    });
});

module.exports = {};
