const { expect } = require('chai');
const request = require('supertest');

// IMPORT SICURO: Usa helper di test che garantisce database separato
const { testConfig, setupTestDatabase, cleanupTestDatabase, closeTestDatabase } = require('./testHelper');
const mongoose = require('mongoose');

// Import modelli e app DOPO setup database di test
let app, User, Brewery;

describe('🏭 Test Assegnazione Utente-Birrificio', function() {
    this.timeout(30000);
    
    let testUser;
    let testBrewery;
    let adminUser;

    before(async function() {
        console.log('🔧 Setup test brewery user assignment SICURO...');
        
        // Connessione database di TEST SICURO
        await setupTestDatabase();
        
        // Import modelli DOPO connessione test sicura
        app = require('../src/app');
        User = require('../src/models/User');
        Brewery = require('../src/models/Brewery');
        
        // Cleanup precedente
        await User.deleteMany({ username: { $in: ['testUserBrewery', 'testAdmin'] } });
        await Brewery.deleteMany({ breweryName: 'Test Brewery for Assignment' });
        
        console.log('✅ Database di TEST connesso per brewery user assignment');

        // Crea un birrificio di test
        testBrewery = new Brewery({
            breweryName: 'Test Brewery for Assignment',
            breweryDescription: 'Birrificio per test assegnazione utenti',
            breweryFiscalCode: 'TEST123456789',
            breweryREAcode: 'TEST-REA-001',
            breweryacciseCode: 'TEST-ACCISE-001',
            breweryFund: 'Test Fund',
            breweryLegalAddress: 'Via Test 123, Test City',
            breweryPhoneNumber: '+39 123 456 7890'
        });
        await testBrewery.save();

        // Crea un utente di test
        testUser = new User({
            username: 'testUserBrewery',
            password: '$2b$10$test.password.hash',
            role: ['customer'],
            defaultRole: 'customer'
        });
        await testUser.save();

        // Crea admin di test
        adminUser = new User({
            username: 'testAdmin',
            password: '$2b$10$test.admin.password.hash',
            role: ['administrator'],
            defaultRole: 'customer'  // Administrator non è permesso in defaultRole
        });
        await adminUser.save();
    });

    after(async function() {
        // Cleanup finale del test database
        await cleanupTestDatabase();
        console.log('🧹 Cleanup test brewery user assignment completato');
    });

    describe('📝 Pagina Update User', function() {
        it('Dovrebbe includere lista birrifici disponibili', async function() {
            const agent = request.agent(app);
            
            // Login come admin
            await agent
                .post('/auth/login')
                .send({
                    username: 'testAdmin',
                    password: 'test.admin.password.hash'
                })
                .expect(302);

            // Accedi alla pagina di update con utente selezionato
            const response = await agent
                .get(`/administrator/users/update?userUpdateId=${testUser._id}`)
                .expect(200);

            expect(response.text).to.include('Test Brewery for Assignment');
            expect(response.text).to.include('Seleziona Birrificio');
            expect(response.text).to.include('Obbligatorio per assegnare il ruolo brewery');
        });

        it('Dovrebbe mostrare toggle password', async function() {
            const agent = request.agent(app);
            
            // Login come admin
            await agent
                .post('/auth/login')
                .send({
                    username: 'testAdmin',
                    password: 'test.admin.password.hash'
                })
                .expect(302);

            // Accedi alla pagina di update
            const response = await agent
                .get(`/administrator/users/update?userUpdateId=${testUser._id}`)
                .expect(200);

            expect(response.text).to.include('togglePassword');
            expect(response.text).to.include('👁️');
        });
    });

    describe('🔗 Assegnazione Ruolo Brewery', function() {
        it('Dovrebbe richiedere selezione birrificio per ruolo brewery', async function() {
            const agent = request.agent(app);
            
            // Login come admin
            await agent
                .post('/auth/login')
                .send({
                    username: 'testAdmin',
                    password: 'test.admin.password.hash'
                })
                .expect(302);

            // Prova ad assegnare ruolo brewery senza birrificio
            await agent
                .post(`/administrator/users/addRole/${testUser._id}`)
                .send({
                    roleToAdd: 'brewery'
                    // Nessun breweryId
                })
                .expect(302);

            // Verifica che l'utente non abbia il ruolo brewery
            const updatedUser = await User.findById(testUser._id);
            expect(updatedUser.role).to.not.include('brewery');
        });

        it('Dovrebbe assegnare ruolo brewery con birrificio selezionato', async function() {
            const agent = request.agent(app);
            
            // Login come admin
            await agent
                .post('/auth/login')
                .send({
                    username: 'testAdmin',
                    password: 'test.admin.password.hash'
                })
                .expect(302);

            // Assegna ruolo brewery con birrificio
            await agent
                .post(`/administrator/users/addRole/${testUser._id}`)
                .send({
                    roleToAdd: 'brewery',
                    breweryId: testBrewery._id.toString()
                })
                .expect(302);

            // Verifica che l'utente abbia il ruolo brewery e sia collegato al birrificio
            const updatedUser = await User.findById(testUser._id).populate('breweryDetails');
            expect(updatedUser.role).to.include('brewery');
            expect(updatedUser.breweryDetails._id.toString()).to.equal(testBrewery._id.toString());
        });

        it('Dovrebbe impedire doppia assegnazione dello stesso birrificio', async function() {
            // Crea un secondo utente
            const secondUser = new User({
                username: 'testUserBrewery2',
                password: '$2b$10$test.password.hash',
                role: ['customer'],
                defaultRole: 'customer'
            });
            await secondUser.save();

            const agent = request.agent(app);
            
            // Login come admin
            await agent
                .post('/auth/login')
                .send({
                    username: 'testAdmin',
                    password: 'test.admin.password.hash'
                })
                .expect(302);

            // Prova ad assegnare lo stesso birrificio
            await agent
                .post(`/administrator/users/addRole/${secondUser._id}`)
                .send({
                    roleToAdd: 'brewery',
                    breweryId: testBrewery._id.toString()
                })
                .expect(302);

            // Verifica che il secondo utente non abbia il ruolo brewery
            const updatedSecondUser = await User.findById(secondUser._id);
            expect(updatedSecondUser.role).to.not.include('brewery');

            // Cleanup
            await User.deleteOne({ _id: secondUser._id });
        });
    });

    describe('🔒 Sicurezza Password Toggle', function() {
        it('Dovrebbe includere JavaScript per toggle password', async function() {
            const agent = request.agent(app);
            
            // Login come admin
            await agent
                .post('/auth/login')
                .send({
                    username: 'testAdmin',
                    password: 'test.admin.password.hash'
                })
                .expect(302);

            // Accedi alla pagina di update
            const response = await agent
                .get(`/administrator/users/update?userUpdateId=${testUser._id}`)
                .expect(200);

            expect(response.text).to.include('updateUser.js');
        });
    });
});
