const request = require('supertest');
const expect = require('chai').expect;
const app = require('../src/app');
const User = require('../src/models/User');
const Brewery = require('../src/models/Brewery');
const bcrypt = require('bcrypt');

describe('Debug Role Removal', function() {
    this.timeout(30000);
    
    let testUser;
    let testBrewery;
    let adminAgent;
    
    before(async function() {
        // Crea un utente di test con ruoli multipli
        const hashedPassword = await bcrypt.hash('testpassword', 10);
        
        // Crea un birrificio di test
        testBrewery = new Brewery({
            breweryName: 'Test Brewery for Removal',
            breweryDescription: 'Test description',
            breweryFiscalCode: 'TEST12345'
        });
        await testBrewery.save();
        
        // Crea un utente con ruoli customer e brewery
        testUser = new User({
            username: 'userremovaltest',
            password: hashedPassword,
            role: ['customer', 'brewery'],
            defaultRole: 'customer',
            customerDetails: {
                customerName: 'Test',
                customerSurname: 'User'
            },
            breweryDetails: testBrewery._id
        });
        await testUser.save();
        
        // Crea una sessione admin
        adminAgent = request.agent(app);
        await adminAgent
            .post('/auth/login')
            .send({
                username: 'ClaudeAdmin',
                password: 'ClaudeAdminPassword1'
            });
    });
    
    after(async function() {
        try {
            if (testUser) {
                await User.findByIdAndDelete(testUser._id);
            }
            if (testBrewery) {
                await Brewery.findByIdAndDelete(testBrewery._id);
            }
        } catch (error) {
            console.log('Cleanup error:', error.message);
        }
    });
    
    it('should display role removal form elements correctly', async function() {
        const response = await adminAgent
            .get(`/administrator/users/update?userUpdateId=${testUser._id}`)
            .expect(200);
            
        console.log('Page HTML contains role removal form?', response.text.includes('removeRole'));
        console.log('Page HTML contains brewery role?', response.text.includes('brewery'));
        console.log('Page HTML contains remove button?', response.text.includes('remove-role-btn'));
        
        expect(response.text).to.include('removeRole');
        expect(response.text).to.include('brewery');
    });
    
    it('should process role removal request correctly', async function() {
        console.log('Testing role removal for user:', testUser._id);
        console.log('User roles before removal:', testUser.role);
        
        const response = await adminAgent
            .post(`/administrator/users/removeRole/${testUser._id}`)
            .send({ roleToRemove: 'brewery' })
            .expect(302); // Redirect expected
            
        console.log('Response status:', response.status);
        console.log('Response redirect location:', response.header.location);
        
        // Verifica che l'utente sia stato aggiornato
        const updatedUser = await User.findById(testUser._id);
        console.log('User roles after removal:', updatedUser.role);
        
        expect(updatedUser.role).to.not.include('brewery');
        expect(updatedUser.role).to.include('customer');
        expect(updatedUser.breweryDetails).to.be.undefined;
    });
    
    it('should prevent removal of customer role', async function() {
        const response = await adminAgent
            .post(`/administrator/users/removeRole/${testUser._id}`)
            .send({ roleToRemove: 'customer' })
            .expect(302);
            
        console.log('Customer role removal response redirect:', response.header.location);
        
        // Verifica che il ruolo customer sia ancora presente
        const user = await User.findById(testUser._id);
        console.log('User roles after attempted customer removal:', user.role);
        
        expect(user.role).to.include('customer');
    });
    
    it('should check JavaScript console for errors', async function() {
        // Test per verificare se ci sono errori JavaScript nella pagina
        const response = await adminAgent
            .get(`/administrator/users/update?userUpdateId=${testUser._id}`)
            .expect(200);
            
        // Controlla che il JavaScript file sia caricato
        expect(response.text).to.include('/js/updateUser.js');
        
        // Controlla che ci siano gli elementi necessari per il JavaScript
        expect(response.text).to.include('remove-role-btn');
        expect(response.text).to.include('data-role=');
        
        console.log('JavaScript file included?', response.text.includes('/js/updateUser.js'));
        console.log('Remove buttons present?', response.text.includes('remove-role-btn'));
    });
});
