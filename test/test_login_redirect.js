const request = require('supertest');
const { expect } = require('chai');
const app = require('../src/app');
const mongoose = require('mongoose');
const User = require('../src/models/User');
const bcrypt = require('bcrypt');

describe('Test Login Redirect per Ruolo', function() {
    let testUsers = {};
    let cookies = {};
    
    // Configurazione timeout per i test
    this.timeout(10000);

    before(async function() {
        console.log('🔧 Setup test login redirect...');
        
        // Crea utenti di test per ogni ruolo se non esistono
        const testUserData = [
            {
                username: 'admin_test',
                password: 'testpass123',
                role: ['administrator'],
                defaultRole: 'administrator'
            },
            {
                username: 'brewery_test', 
                password: 'testpass123',
                role: ['brewery'],
                defaultRole: 'brewery'
            },
            {
                username: 'customer_test',
                password: 'testpass123', 
                role: ['customer'],
                defaultRole: 'customer'
            },
            {
                username: 'multi_test',
                password: 'testpass123',
                role: ['customer', 'brewery'],
                defaultRole: 'brewery'  // Testa con defaultRole brewery
            }
        ];

        for (const userData of testUserData) {
            let user = await User.findOne({ username: userData.username });
            
            if (!user) {
                const hashedPassword = await bcrypt.hash(userData.password, 10);
                user = await User.create({
                    username: userData.username,
                    password: hashedPassword,
                    role: userData.role,
                    defaultRole: userData.defaultRole
                });
                console.log(`✅ Utente creato: ${userData.username} con ruolo ${userData.role.join(', ')}`);
            } else {
                console.log(`ℹ️ Utente esistente: ${userData.username}`);
            }
            
            testUsers[userData.username] = user;
        }
    });

    describe('Redirect al Login', function() {
        
        it('dovrebbe reindirizzare administrator alla dashboard admin', async function() {
            const agent = request.agent(app);
            
            const loginResponse = await agent
                .post('/login')
                .send({
                    username: 'admin_test',
                    password: 'testpass123'
                });

            console.log('Login administrator - Status:', loginResponse.status);
            console.log('Login administrator - Location:', loginResponse.headers.location);
            
            // Verifica che il redirect sia verso /administrator  
            if (loginResponse.status === 302) {
                expect(loginResponse.headers.location).to.equal('/administrator');
                console.log('✅ Administrator reindirizzato correttamente a /administrator');
            } else {
                console.log('❌ Login failed con status:', loginResponse.status);
                console.log('Response:', loginResponse.text);
                throw new Error('Login failed');
            }
        });

        it('dovrebbe reindirizzare brewery alla dashboard brewery', async function() {
            const agent = request.agent(app);
            
            const loginResponse = await agent
                .post('/login')
                .send({
                    username: 'brewery_test',
                    password: 'testpass123'
                });

            console.log('Login brewery - Status:', loginResponse.status);
            console.log('Login brewery - Location:', loginResponse.headers.location);
            
            // Verifica che il redirect sia verso /brewery/dashboard
            if (loginResponse.status === 302) {
                expect(loginResponse.headers.location).to.equal('/brewery/dashboard');
                console.log('✅ Brewery reindirizzato correttamente a /brewery/dashboard');
            } else {
                console.log('❌ Login failed con status:', loginResponse.status);
                console.log('Response:', loginResponse.text);
                throw new Error('Login failed');
            }
        });

        it('dovrebbe reindirizzare customer alla home page', async function() {
            const agent = request.agent(app);
            
            const loginResponse = await agent
                .post('/login')
                .send({
                    username: 'customer_test',
                    password: 'testpass123'
                });

            console.log('Login customer - Status:', loginResponse.status);
            console.log('Login customer - Location:', loginResponse.headers.location);
            
            // Verifica che il redirect sia verso /
            if (loginResponse.status === 302) {
                expect(loginResponse.headers.location).to.equal('/');
                console.log('✅ Customer reindirizzato correttamente a /');
            } else {
                console.log('❌ Login failed con status:', loginResponse.status);
                console.log('Response:', loginResponse.text);
                throw new Error('Login failed');
            }
        });

        it('dovrebbe usare defaultRole per utenti multiruolo', async function() {
            const agent = request.agent(app);
            
            const loginResponse = await agent
                .post('/login')
                .send({
                    username: 'multi_test',
                    password: 'testpass123'
                });

            console.log('Login multiruolo - Status:', loginResponse.status);
            console.log('Login multiruolo - Location:', loginResponse.headers.location);
            
            // Verifica che usi defaultRole (brewery) per il redirect
            if (loginResponse.status === 302) {
                expect(loginResponse.headers.location).to.equal('/brewery/dashboard');
                console.log('✅ Utente multiruolo reindirizzato secondo defaultRole (brewery)');
            } else {
                console.log('❌ Login failed con status:', loginResponse.status);
                console.log('Response:', loginResponse.text);
                throw new Error('Login failed');
            }
        });
    });

    after(async function() {
        console.log('🧹 Cleanup test redirect...');
        // Non eliminiamo gli utenti test per permettere test manuali
        console.log('✅ Test completati');
    });
});

// Esporta per eventuale riuso
module.exports = {
    description: 'Test Login Redirect per Ruolo',
    // 🎯 IMPLEMENTAZIONE COMPLETATA 21 SETTEMBRE 2025
    // Sistema di redirect automatico alla home di ruolo dopo login:
    // - Administrator → /administrator  
    // - Brewery → /brewery/dashboard
    // - Customer → /
    // Test validati manualmente e funzionanti ✅
};
