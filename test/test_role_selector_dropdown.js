/**
 * Test per il nuovo Role Selector Dropdown
 * Verifica la funzionalità del menu dropdown per la selezione ruoli
 */

const request = require('supertest');
const { expect } = require('chai');
const app = require('../src/app');

describe('Role Selector Dropdown Tests', function() {
    this.timeout(60000);
    
    let authCookie;
    const testUser = {
        username: 'ClaudeTestUser',
        password: 'ClaudePassword123',
        email: 'claude.test@example.com'
    };
    
    before(async function() {
        // Effettua login per ottenere cookie di autenticazione
        const loginResponse = await request(app)
            .post('/auth/login')
            .send({
                username: 'ClaudeAdmin',
                password: 'ClaudeAdminPassword1'
            });
            
        if (loginResponse.status === 200 && loginResponse.headers['set-cookie']) {
            authCookie = loginResponse.headers['set-cookie'];
            console.log('✓ Login effettuato con successo per i test');
        } else {
            throw new Error('Impossibile effettuare login per i test');
        }
    });
    
    describe('GET /api/user/roles', function() {
        it('dovrebbe restituire i ruoli utente autenticato', async function() {
            const response = await request(app)
                .get('/api/user/roles')
                .set('Cookie', authCookie)
                .expect(200);
                
            expect(response.body).to.have.property('success', true);
            expect(response.body).to.have.property('roles');
            expect(response.body).to.have.property('activeRole');
            expect(response.body).to.have.property('defaultRole');
            expect(response.body.roles).to.be.an('array');
            
            // Administrator dovrebbe essere filtrato dalla UI
            expect(response.body.roles).to.not.include('administrator');
            
            console.log('✓ Endpoint GET /api/user/roles funziona correttamente');
        });
        
        it('dovrebbe negare accesso a utenti non autenticati', async function() {
            await request(app)
                .get('/api/user/roles')
                .expect(302); // Redirect al login
                
            console.log('✓ Accesso negato per utenti non autenticati');
        });
    });
    
    describe('POST /api/user/roles', function() {
        it('dovrebbe aggiornare activeRole e defaultRole per utente autenticato', async function() {
            const updateData = {
                activeRole: 'customer',
                defaultRole: 'customer'
            };
            
            const response = await request(app)
                .post('/api/user/roles')
                .set('Cookie', authCookie)
                .send(updateData)
                .expect(200);
                
            expect(response.body).to.have.property('success', true);
            expect(response.body).to.have.property('message');
            expect(response.body).to.have.property('activeRole', 'customer');
            expect(response.body).to.have.property('defaultRole', 'customer');
            
            console.log('✓ Aggiornamento ruoli funziona correttamente');
        });
        
        it('dovrebbe bloccare la selezione di administrator come defaultRole', async function() {
            const maliciousData = {
                activeRole: 'administrator',
                defaultRole: 'administrator'
            };
            
            const response = await request(app)
                .post('/api/user/roles')
                .set('Cookie', authCookie)
                .send(maliciousData)
                .expect(403);
                
            expect(response.body).to.have.property('success', false);
            expect(response.body.message).to.include('administrator');
            
            console.log('✓ Security fix: Blocco selezione administrator come default');
        });
        
        it('dovrebbe validare che i ruoli appartengano all\'utente', async function() {
            const invalidData = {
                activeRole: 'invalid_role',
                defaultRole: 'invalid_role'
            };
            
            const response = await request(app)
                .post('/api/user/roles')
                .set('Cookie', authCookie)
                .send(invalidData)
                .expect(400);
                
            expect(response.body).to.have.property('success', false);
            expect(response.body.message).to.include('non valido');
            
            console.log('✓ Validazione ruoli funziona correttamente');
        });
        
        it('dovrebbe negare accesso a utenti non autenticati', async function() {
            await request(app)
                .post('/api/user/roles')
                .send({ activeRole: 'customer', defaultRole: 'customer' })
                .expect(302); // Redirect al login
                
            console.log('✓ Accesso POST negato per utenti non autenticati');
        });
    });
    
    describe('Profile Redirect', function() {
        it('dovrebbe reindirizzare GET /profile alla home', async function() {
            const response = await request(app)
                .get('/profile')
                .set('Cookie', authCookie)
                .expect(302);
                
            expect(response.headers.location).to.equal('/#profile-dropdown');
            
            console.log('✓ Redirect del profilo alla home funziona');
        });
    });
    
    describe('Frontend Resources', function() {
        it('dovrebbe servire il CSS del role selector', async function() {
            await request(app)
                .get('/css/roleSelector.css')
                .expect(200)
                .expect('Content-Type', /css/);
                
            console.log('✓ CSS roleSelector servito correttamente');
        });
        
        it('dovrebbe servire il JavaScript del role selector', async function() {
            await request(app)
                .get('/js/roleSelector.js')
                .expect(200)
                .expect('Content-Type', /javascript/);
                
            console.log('✓ JavaScript roleSelector servito correttamente');
        });
    });
});

// Esegui i test se questo file viene chiamato direttamente
if (require.main === module) {
    const { execSync } = require('child_process');
    try {
        console.log('🧪 Avvio test Role Selector Dropdown...\n');
        execSync('npm test -- --grep "Role Selector Dropdown Tests"', {
            stdio: 'inherit',
            cwd: __dirname + '/..'
        });
    } catch (error) {
        console.error('❌ Test falliti:', error.message);
        process.exit(1);
    }
}
