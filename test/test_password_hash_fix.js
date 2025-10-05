const { expect } = require('chai');
const bcrypt = require('bcrypt');
const { setupTestDatabase, cleanupTestDatabase, closeTestDatabase } = require('./testHelper');

let app, User, authController;

describe('Test Fix Doppio Hash Password', function() {
    this.timeout(30000);

    before(async function() {
        await setupTestDatabase();
        
        // Import modelli DOPO connessione sicura
        app = require('../src/app');
        User = require('../src/models/User');
        authController = require('../src/controllers/authController');
    });

    after(async function() {
        await cleanupTestDatabase();
        await closeTestDatabase();
    });

    beforeEach(async function() {
        // Pulisce la collezione users prima di ogni test
        await User.deleteMany({});
    });

    describe('Registrazione Utente', function() {
        it('dovrebbe hashare la password correttamente una sola volta', async function() {
            const userData = {
                username: 'testuser123',
                password: 'plainPassword123',
                customerName: 'Mario',
                customerSurname: 'Rossi',
                customerFiscalCode: 'RSSMRA90A01H501X',
                customerBillingAddress: 'Via Roma 1',
                customerShippingAddress: 'Via Roma 1',
                customerPhoneNumber: '3331234567'
            };

            // Crea direttamente un utente per testare il middleware pre-save
            const newUser = new User({
                username: userData.username,
                password: userData.password, // Password in chiaro
                role: ['customer'],
                customerDetails: {
                    customerName: userData.customerName,
                    customerSurname: userData.customerSurname,
                    customerFiscalCode: userData.customerFiscalCode,
                    customerAddresses: {
                        billingAddress: userData.customerBillingAddress,
                        shippingAddress: userData.customerShippingAddress
                    },
                    customerPhoneNumber: userData.customerPhoneNumber
                }
            });

            await newUser.save();

            // Verifica che la password sia stata hashata
            expect(newUser.password).to.not.equal(userData.password);
            expect(newUser.password).to.have.lengthOf(60); // Lunghezza tipica di bcrypt hash

            // Verifica che bcrypt.compare funzioni correttamente
            const isMatch = await bcrypt.compare(userData.password, newUser.password);
            expect(isMatch).to.be.true;

            console.log('✅ Password hashata correttamente dal middleware pre-save');
            console.log(`Original: ${userData.password}`);
            console.log(`Hashed: ${newUser.password}`);
        });

        it('dovrebbe permettere il login con la password corretta', async function() {
            const userData = {
                username: 'logintest123',
                password: 'testPassword456'
            };

            // Crea utente
            const newUser = new User({
                username: userData.username,
                password: userData.password, // Password in chiaro - verrà hashata automaticamente
                role: ['customer'],
                customerDetails: {
                    customerName: 'Test',
                    customerSurname: 'User',
                    customerFiscalCode: 'TSTUSER90A01H501X',
                    customerAddresses: {
                        billingAddress: 'Via Test 1',
                        shippingAddress: 'Via Test 1'
                    },
                    customerPhoneNumber: '3330000000'
                }
            });

            await newUser.save();

            // Testa il metodo comparePassword del modello
            const isMatch = await newUser.comparePassword(userData.password);
            expect(isMatch).to.be.true;

            // Testa con password sbagliata
            const isWrongMatch = await newUser.comparePassword('passwordSbagliata');
            expect(isWrongMatch).to.be.false;

            console.log('✅ Login funziona correttamente con password hashata una sola volta');
        });

        it('NON dovrebbe hashare la password se è già stata hashata', async function() {
            const originalPassword = 'testPassword789';
            
            // Prima hashaata manualmente (simula vecchio comportamento)
            const manuallyHashed = await bcrypt.hash(originalPassword, 10);
            
            // Crea utente con password già hashata
            const user = new User({
                username: 'prehashtest',
                password: manuallyHashed,
                role: ['customer'],
                customerDetails: {
                    customerName: 'PreHash',
                    customerSurname: 'Test',
                    customerFiscalCode: 'PRHTEST90A01H501X',
                    customerAddresses: {
                        billingAddress: 'Via PreHash 1',
                        shippingAddress: 'Via PreHash 1'
                    },
                    customerPhoneNumber: '3330000001'
                }
            });

            await user.save();

            // La password dovrebbe rimanere quella hashata manualmente
            // perché il middleware controlla isModified('password')
            expect(user.password).to.equal(manuallyHashed);

            // Ma il login dovrebbe funzionare
            const isMatch = await bcrypt.compare(originalPassword, user.password);
            expect(isMatch).to.be.true;

            console.log('✅ Middleware non re-hasha password già hashate');
        });
    });

    describe('Aggiornamento Password', function() {
        it('dovrebbe hashare la nuova password quando viene modificata', async function() {
            // Crea utente iniziale
            const user = new User({
                username: 'updatetest',
                password: 'passwordOriginale',
                role: ['customer'],
                customerDetails: {
                    customerName: 'Update',
                    customerSurname: 'Test',
                    customerFiscalCode: 'UPDTEST90A01H501X',
                    customerAddresses: {
                        billingAddress: 'Via Update 1',
                        shippingAddress: 'Via Update 1'
                    },
                    customerPhoneNumber: '3330000002'
                }
            });

            await user.save();
            const originalHash = user.password;

            // Modifica la password
            user.password = 'nuovaPassword123';
            await user.save();

            // La password dovrebbe essere stata hashata di nuovo
            expect(user.password).to.not.equal('nuovaPassword123');
            expect(user.password).to.not.equal(originalHash);

            // Il login con la nuova password dovrebbe funzionare
            const isMatch = await bcrypt.compare('nuovaPassword123', user.password);
            expect(isMatch).to.be.true;

            console.log('✅ Aggiornamento password funziona correttamente');
        });
    });
});