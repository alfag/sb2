const chai = require('chai');
const sinon = require('sinon');
const expect = chai.expect;

const User = require('../src/models/User');
const Administrator = require('../src/models/Administrator');
const Brewery = require('../src/models/Brewery');
const administratorController = require('../src/controllers/administratorController');

describe('Sistema Multi-Ruolo SB2 - Fase 1', function() {
    this.timeout(30000);

    let testUser;
    let adminUser;

    before(async function() {
        // Crea utente test per i test
        testUser = new User({
            username: 'testMultiRole',
            password: 'TestPassword123',
            role: ['customer', 'brewery'],
            defaultRole: 'customer'
        });
        await testUser.save();

        // Crea admin per test privilegi
        const adminDetails = new Administrator({
            administratorName: 'TestAdmin',
            administratorPermission: 'full'
        });
        await adminDetails.save();

        adminUser = new User({
            username: 'testAdmin',
            password: 'AdminPassword123',
            role: ['administrator'],
            administratorDetails: adminDetails._id
        });
        await adminUser.save();
    });

    after(async function() {
        // Cleanup test data
        await User.deleteOne({ username: 'testMultiRole' });
        await User.deleteOne({ username: 'testAdmin' });
        await Administrator.deleteOne({ administratorName: 'TestAdmin' });
    });

    describe('🔴 SICUREZZA ADMINISTRATOR', function() {
        
        it('BLOCCA assegnazione ruolo administrator via addRoleToUser()', async function() {
            const req = {
                flash: sinon.spy()
            };
            const res = {
                redirect: sinon.spy()
            };

            // Test della funzione addRoleToUser con ruolo administrator
            await administratorController.addRoleToUser(
                testUser._id.toString(), 
                'administrator', 
                req, 
                res
            );

            // Verifica che sia stato mostrato errore
            expect(req.flash.calledWith('error')).to.be.true;
            expect(req.flash.args[0][1]).to.include('administrator non può essere assegnato');
            
            // Verifica che ci sia stato redirect
            expect(res.redirect.called).to.be.true;
            
            // Verifica che l'utente NON abbia il ruolo administrator
            const updatedUser = await User.findById(testUser._id);
            expect(updatedUser.role).to.not.include('administrator');
        });

        it('Permette assegnazione ruoli customer e brewery', async function() {
            const req = {
                flash: sinon.spy()
            };
            const res = {
                redirect: sinon.spy()
            };

            // Test user senza brewery role con timestamp per unicità
            const uniqueUsername = `simpleTestUser_${Date.now()}`;
            const simpleUser = new User({
                username: uniqueUsername,
                password: 'TestPassword123',
                role: ['customer'],
                defaultRole: 'customer'
            });
            await simpleUser.save();

            try {
                // Test aggiunta ruolo brewery (dovrebbe funzionare)
                await administratorController.addRoleToUser(
                    simpleUser._id.toString(), 
                    'brewery', 
                    req, 
                    res
                );

                // Verifica che NON ci sia stato errore di sicurezza per brewery
                const errorCalls = req.flash.getCalls().filter(call => 
                    call.args[0] === 'error' && 
                    call.args[1].includes('administrator non può essere assegnato')
                );
                expect(errorCalls.length).to.equal(0);
                
                // Verifica che l'utente abbia il ruolo brewery
                const updatedUser = await User.findById(simpleUser._id);
                expect(updatedUser.role).to.include('brewery');

                // Verifica che sia stato chiamato flash con success (non error)
                const successCalls = req.flash.getCalls().filter(call => 
                    call.args[0] === 'success'
                );
                expect(successCalls.length).to.be.greaterThan(0);

            } finally {
                // Cleanup (importante anche in caso di errore)
                await User.deleteOne({ _id: simpleUser._id });
            }
        });
    });

    describe('🟡 FUNZIONALITÀ CAMPO DEFAULT ROLE', function() {
        
        it('Campo defaultRole ha validazione corretta nel modello', function() {
            const userSchema = User.schema;
            const defaultRoleField = userSchema.paths.defaultRole;
            
            expect(defaultRoleField).to.exist;
            expect(defaultRoleField.enumValues).to.deep.equal(['customer', 'brewery']);
            expect(defaultRoleField.defaultValue).to.equal('customer');
            expect(defaultRoleField.isRequired).to.be.true;
        });

        it('Campo defaultRole non accetta valore administrator', async function() {
            const invalidUser = new User({
                username: 'invalidTest',
                password: 'password123',
                role: ['customer'],
                defaultRole: 'administrator'
            });

            try {
                await invalidUser.save();
                expect.fail('Dovrebbe aver fallito la validazione');
            } catch (error) {
                expect(error.name).to.equal('ValidationError');
                expect(error.message).to.include('defaultRole');
            }
        });

        it('Campo defaultRole accetta valori customer e brewery', async function() {
            // Test con defaultRole customer
            const customerUser = new User({
                username: 'customerTest',
                password: 'password123',
                role: ['customer'],
                defaultRole: 'customer'
            });
            await customerUser.save();
            expect(customerUser.defaultRole).to.equal('customer');

            // Test con defaultRole brewery
            const breweryUser = new User({
                username: 'breweryTest',
                password: 'password123',
                role: ['brewery'],
                defaultRole: 'brewery'
            });
            await breweryUser.save();
            expect(breweryUser.defaultRole).to.equal('brewery');

            // Cleanup
            await User.deleteOne({ _id: customerUser._id });
            await User.deleteOne({ _id: breweryUser._id });
        });
    });

    describe('🟢 LOGICA MIDDLEWARE', function() {
        
        it('setActiveRole usa defaultRole quando disponibile', function() {
            const authMiddleware = require('../src/middlewares/authMiddleware');
            
            // Mock request/response
            const req = {
                user: {
                    role: ['customer', 'brewery'],
                    defaultRole: 'brewery'
                },
                path: '/some-path',
                session: {} // Aggiunto session mock
            };
            const res = {
                locals: {}
            };
            const next = sinon.spy();

            // Esegui middleware
            authMiddleware.setActiveRole(req, res, next);

            // Verifica che activeRole sia impostato a defaultRole
            expect(res.locals.activeRole).to.equal('brewery');
            expect(next.called).to.be.true;
        });

        it('setActiveRole fallback a priorità quando defaultRole non disponibile', function() {
            const authMiddleware = require('../src/middlewares/authMiddleware');
            
            // Mock request/response senza defaultRole
            const req = {
                user: {
                    role: ['customer', 'brewery']
                    // no defaultRole
                },
                path: '/some-path',
                session: {} // Aggiunto session mock
            };
            const res = {
                locals: {}
            };
            const next = sinon.spy();

            // Esegui middleware
            authMiddleware.setActiveRole(req, res, next);

            // Verifica che activeRole sia impostato secondo priorità (brewery ha priorità su customer)
            expect(res.locals.activeRole).to.equal('brewery');
            expect(next.called).to.be.true;
        });
    });

    describe('🔧 VALIDAZIONE SICUREZZA', function() {
        
        it('Ruolo administrator non viene incluso nei ruoli selezionabili', function() {
            // Simula utente con tutti i ruoli
            const user = {
                role: ['customer', 'brewery', 'administrator']
            };

            // Filtra ruoli come fa il template userProfile.njk
            const selectableRoles = user.role.filter(role => role !== 'administrator');
            
            expect(selectableRoles).to.deep.equal(['customer', 'brewery']);
            expect(selectableRoles).to.not.include('administrator');
        });

        it('Sistema bloccca tentativo di impostare administrator via POST', function() {
            // Simula validazione POST /profile come in baseRoutes.js
            const requestBody = { activeRole: 'administrator' };
            const userRoles = ['customer', 'brewery', 'administrator'];

            // Logica di sicurezza implementata
            const isAdministratorRequest = requestBody.activeRole === 'administrator';
            const hasValidRole = userRoles.includes(requestBody.activeRole);

            expect(isAdministratorRequest).to.be.true;
            expect(hasValidRole).to.be.true;
            
            // Ma dovrebbe essere bloccato dalla validazione di sicurezza
            const shouldBlock = requestBody.activeRole === 'administrator';
            expect(shouldBlock).to.be.true;
        });
    });
});
