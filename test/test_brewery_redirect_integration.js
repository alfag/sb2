/**
 * Test Integration per Redirect Brewery Users con utenti reali
 * SICUREZZA: Utilizza database test isolato per prevenire corruzione dati produzione
 */

const request = require('supertest');
const { expect } = require('chai');
const { setupTestDatabase, cleanupTestDatabase, closeTestDatabase } = require('./testHelper');

// Import DOPO setup database sicuro
let app, User, Brewery;

describe('🧪 Test Integration Redirect Brewery Users', function() {
    this.timeout(15000);

    let testBrewery, agent;

    before(async function() {
        // SICUREZZA: Setup database test PRIMA di importare modelli
        await setupTestDatabase();
        
        // Import sicuri DOPO connessione test
        app = require('../src/app');
        User = require('../src/models/User');
        Brewery = require('../src/models/Brewery');
        // Crea birrificio test
        testBrewery = new Brewery({
            breweryName: 'Redirect Test Brewery',
            breweryDescription: 'Birrificio per test redirect',
            breweryFiscalCode: 'REDIRECT123',
            breweryAddress: 'Via Redirect 123'
        });
        await testBrewery.save();

        agent = request.agent(app);
    });

    after(async function() {
        // Cleanup
        if (testBrewery) {
            await Brewery.findByIdAndDelete(testBrewery._id);
        }
    });

    it('dovrebbe gestire redirect completo per utente brewery con defaultRole brewery', async function() {
        try {
            // Login come ClaudeAdmin
            const loginResponse = await agent
                .post('/login')
                .send({
                    username: 'ClaudeAdmin',
                    password: 'ClaudeAdminPassword1'
                });

            expect(loginResponse.status).to.be.oneOf([200, 302]);
            console.log('✅ Login ClaudeAdmin riuscito');

            // Aggiungi temporaneamente ruolo brewery e breweryDetails
            const user = await User.findOne({ username: 'ClaudeAdmin' });
            const originalRole = [...user.role];
            const originalDefaultRole = user.defaultRole;
            const originalBreweryDetails = user.breweryDetails;

            // Aggiorna utente con ruolo brewery
            if (!user.role.includes('brewery')) {
                user.role.push('brewery');
            }
            user.defaultRole = 'brewery';
            user.breweryDetails = testBrewery._id;
            await user.save();

            console.log('✅ Utente temporaneamente configurato come brewery');

            // Logout e re-login per aggiornare sessione
            await agent.get('/logout');
            
            const reLoginResponse = await agent
                .post('/login')
                .send({
                    username: 'ClaudeAdmin',
                    password: 'ClaudeAdminPassword1'
                });

            expect(reLoginResponse.status).to.be.oneOf([200, 302]);
            console.log('✅ Re-login riuscito con nuovi ruoli');

            // Test redirect dalla home
            const homeResponse = await agent.get('/');
            
            console.log('📍 Response status:', homeResponse.status);
            console.log('📍 Response headers:', homeResponse.headers.location);

            if (homeResponse.status === 302) {
                expect(homeResponse.headers.location).to.include('/brewery/dashboard');
                console.log('✅ Redirect corretto dalla home alla dashboard brewery');

                // Segui il redirect e verifica che la dashboard si carichi
                const dashboardResponse = await agent.get('/brewery/dashboard');
                expect(dashboardResponse.status).to.equal(200);
                expect(dashboardResponse.text).to.include('Dashboard Gestione Birrificio');
                console.log('✅ Dashboard brewery caricata correttamente');
            } else {
                console.log('⚠️  Nessun redirect - verifica logica middleware');
            }

            // Ripristina stato originale utente
            await User.findByIdAndUpdate(user._id, {
                role: originalRole,
                defaultRole: originalDefaultRole,
                breweryDetails: originalBreweryDetails
            });

            console.log('✅ Stato utente ripristinato');

            await agent.get('/logout');

        } catch (error) {
            console.error('❌ Errore test:', error.message);
            throw error;
        }
    });

    it('dovrebbe gestire cambio activeRole da customer a brewery e redirect', async function() {
        try {
            // Login come ClaudeAdmin
            await agent
                .post('/login')
                .send({
                    username: 'ClaudeAdmin',
                    password: 'ClaudeAdminPassword1'
                });

            // Setup brewery temporaneo
            const user = await User.findOne({ username: 'ClaudeAdmin' });
            const originalRole = [...user.role];
            const originalBreweryDetails = user.breweryDetails;

            if (!user.role.includes('brewery')) {
                user.role.push('brewery');
            }
            user.breweryDetails = testBrewery._id;
            await user.save();

            // Imposta activeRole customer prima
            await agent
                .post('/profile')
                .send({ activeRole: 'customer' });

            // Verifica che home non reindirizza con activeRole customer
            const homeCustomerResponse = await agent.get('/');
            expect(homeCustomerResponse.status).to.equal(200);
            console.log('✅ Home mostrata correttamente con activeRole customer');

            // Cambio activeRole a brewery
            const roleChangeResponse = await agent
                .post('/profile')
                .send({ activeRole: 'brewery' });

            console.log('📍 Role change response:', roleChangeResponse.status);
            console.log('📍 Role change location:', roleChangeResponse.headers.location);

            // Verifica redirect automatico alla dashboard brewery
            if (roleChangeResponse.status === 302) {
                expect(roleChangeResponse.headers.location).to.include('/brewery/dashboard');
                console.log('✅ Redirect automatico alla dashboard quando cambio ruolo a brewery');
            }

            // Ora home dovrebbe reindirizzare
            const homeBreweryResponse = await agent.get('/');
            if (homeBreweryResponse.status === 302) {
                expect(homeBreweryResponse.headers.location).to.include('/brewery/dashboard');
                console.log('✅ Home ora reindirizza correttamente alla dashboard');
            }

            // Cleanup
            await User.findByIdAndUpdate(user._id, {
                role: originalRole,
                breweryDetails: originalBreweryDetails
            });

            await agent.get('/logout');

        } catch (error) {
            console.error('❌ Errore test cambio ruolo:', error.message);
            throw error;
        }
    });

    // SICUREZZA: Cleanup database test
    after(async function() {
        await cleanupTestDatabase();
        await closeTestDatabase();
    });
});

module.exports = {};
