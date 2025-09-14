const chai = require('chai');
const request = require('supertest');
const app = require('../src/app');
const User = require('../src/models/User');
const Brewery = require('../src/models/Brewery');
const mongoose = require('mongoose');

const expect = chai.expect;

describe('🔒 Security Tests - Role Removal Controls', function() {
    this.timeout(30000);

    let testUser;
    let testBrewery;
    let adminAgent;

    before(async function() {
        // Crea utente di test con ruoli multipli
        testUser = new User({
            username: 'multiRoleUser',
            password: 'password123',
            role: ['customer', 'brewery'],
            defaultRole: 'customer',
            customerDetails: {
                customerName: 'Test',
                customerSurname: 'User'
            }
        });
        await testUser.save();

        // Crea birrificio di test
        testBrewery = new Brewery({
            breweryName: 'Test Brewery',
            breweryDescription: 'Test brewery for role removal'
        });
        await testBrewery.save();

        // Associa birrificio all'utente
        testUser.breweryDetails = testBrewery._id;
        await testUser.save();

        // Login come admin
        const loginResponse = await request(app)
            .post('/auth/login')
            .send({
                username: 'ClaudeAdmin',
                password: 'ClaudeAdminPassword1'
            });

        // Estrai il cookie di sessione
        const sessionCookie = loginResponse.headers['set-cookie'];
        adminAgent = { sessionCookie };
    });

    after(async function() {
        // Cleanup
        if (testUser) await User.findByIdAndDelete(testUser._id);
        if (testBrewery) await Brewery.findByIdAndDelete(testBrewery._id);
        if (adminAgent) adminAgent.close();
    });

    describe('Customer Role Removal Protection', function() {
        it('should block removal of customer role via POST request', async function() {
            const res = await request(app)
                .post(`/administrator/users/removeRole/${testUser._id}`)
                .set('Cookie', adminAgent.sessionCookie)
                .send({ roleToRemove: 'customer' });

            expect(res.status).to.equal(302); // Redirect
            
            // Verifica che l'utente mantenga ancora il ruolo customer
            const updatedUser = await User.findById(testUser._id);
            expect(updatedUser.role).to.include('customer');
        });

        it('should show error message when trying to remove customer role', async function() {
            const res = await request(app)
                .post(`/administrator/users/removeRole/${testUser._id}`)
                .set('Cookie', adminAgent.sessionCookie)
                .send({ roleToRemove: 'customer' });

            expect(res.status).to.equal(302);
            expect(res.headers.location).to.include('administrator/users/update');
        });
    });

    describe('Last Role Protection', function() {
        it('should block removal of last remaining role', async function() {
            // Crea utente con solo ruolo customer
            const singleRoleUser = new User({
                username: 'singleRoleUser',
                password: 'password123',
                role: ['customer'],
                defaultRole: 'customer',
                customerDetails: {
                    customerName: 'Single',
                    customerSurname: 'Role'
                }
            });
            await singleRoleUser.save();

            try {
                const res = await adminAgent
                    .post(`/administrator/users/removeRole/${singleRoleUser._id}`)
                    .send({ roleToRemove: 'customer' });

                expect(res).to.have.status(302);
                
                // Verifica che l'utente mantenga il ruolo
                const updatedUser = await User.findById(singleRoleUser._id);
                expect(updatedUser.role).to.have.lengthOf(1);
                expect(updatedUser.role).to.include('customer');
            } finally {
                await User.findByIdAndDelete(singleRoleUser._id);
            }
        });
    });

    describe('Brewery Role Removal', function() {
        it('should allow removal of brewery role when user has multiple roles', async function() {
            const res = await adminAgent
                .post(`/administrator/users/removeRole/${testUser._id}`)
                .send({ roleToRemove: 'brewery' });

            expect(res).to.have.status(302);
            
            // Verifica che il ruolo brewery sia stato rimosso
            const updatedUser = await User.findById(testUser._id);
            expect(updatedUser.role).to.not.include('brewery');
            expect(updatedUser.role).to.include('customer'); // Customer deve rimanere
            expect(updatedUser.breweryDetails).to.be.undefined;
        });

        it('should not delete brewery entity when removing brewery role', async function() {
            // Re-aggiungi ruolo brewery per il test
            testUser.role.push('brewery');
            testUser.breweryDetails = testBrewery._id;
            await testUser.save();

            const res = await adminAgent
                .post(`/administrator/users/removeRole/${testUser._id}`)
                .send({ roleToRemove: 'brewery' });

            expect(res).to.have.status(302);
            
            // Verifica che il birrificio esista ancora
            const breweryStillExists = await Brewery.findById(testBrewery._id);
            expect(breweryStillExists).to.not.be.null;
        });
    });

    describe('Administrator Role Removal', function() {
        it('should block removal of administrator role via web interface', async function() {
            // Crea utente con ruolo admin
            const adminUser = new User({
                username: 'testAdmin',
                password: 'password123',
                role: ['customer', 'administrator'],
                defaultRole: 'customer'
            });
            await adminUser.save();

            try {
                const res = await adminAgent
                    .post(`/administrator/users/removeRole/${adminUser._id}`)
                    .send({ roleToRemove: 'administrator' });

                // Il ruolo administrator non dovrebbe essere rimovibile via interfaccia
                expect(res).to.have.status(302);
                
                const updatedUser = await User.findById(adminUser._id);
                expect(updatedUser.role).to.include('administrator');
            } finally {
                await User.findByIdAndDelete(adminUser._id);
            }
        });
    });

    describe('Security Edge Cases', function() {
        it('should handle invalid role removal gracefully', async function() {
            const res = await adminAgent
                .post(`/administrator/users/removeRole/${testUser._id}`)
                .send({ roleToRemove: 'invalidRole' });

            expect(res).to.have.status(302);
            
            // L'utente non dovrebbe essere modificato
            const updatedUser = await User.findById(testUser._id);
            expect(updatedUser.role).to.include('customer');
        });

        it('should handle non-existent user ID gracefully', async function() {
            const fakeId = new mongoose.Types.ObjectId();
            const res = await adminAgent
                .post(`/administrator/users/removeRole/${fakeId}`)
                .send({ roleToRemove: 'customer' });

            expect(res).to.have.status(302);
        });

        it('should require valid session for role removal', async function() {
            const unauthenticatedAgent = chai.request.agent(app);
            
            const res = await unauthenticatedAgent
                .post(`/administrator/users/removeRole/${testUser._id}`)
                .send({ roleToRemove: 'brewery' });

            expect(res).to.have.status(302);
            expect(res.headers.location).to.include('/auth/login');
        });
    });

    describe('User Interface Security', function() {
        it('should not show remove button for customer role in UI', async function() {
            const res = await adminAgent
                .get(`/administrator/users/update?userUpdateId=${testUser._id}`);

            expect(res).to.have.status(200);
            expect(res.text).to.include('Customer');
            
            // Verifica che non ci sia il pulsante di rimozione per customer
            expect(res.text).to.not.match(/removeRole.*customer.*×/);
            expect(res.text).to.include('fa-lock'); // Dovrebbe mostrare l'icona lock
        });

        it('should not show remove button for administrator role in UI', async function() {
            // Crea admin user temporaneo
            const adminUser = new User({
                username: 'tempAdmin',
                password: 'password123',
                role: ['customer', 'administrator'],
                defaultRole: 'customer'
            });
            await adminUser.save();

            try {
                const res = await adminAgent
                    .get(`/administrator/users/update?userUpdateId=${adminUser._id}`);

                expect(res).to.have.status(200);
                expect(res.text).to.include('Administrator');
                
                // Non dovrebbe esserci pulsante di rimozione per administrator
                expect(res.text).to.not.match(/removeRole.*administrator.*×/);
            } finally {
                await User.findByIdAndDelete(adminUser._id);
            }
        });
    });
});
