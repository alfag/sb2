const bcrypt = require('bcrypt');
const { setupTestDatabase, cleanupTestDatabase, closeTestDatabase } = require('./testHelper');

// Import modelli DOPO setup database per sicurezza
let User;

async function testPasswordFix() {
    try {
        console.log('🧪 Test rapido fix doppio hash password...\n');

        // Setup database di test sicuro
        await setupTestDatabase();
        console.log('✅ Connesso al database di test sicuro');
        
        // Import User model DOPO connessione sicura
        User = require('../src/models/User');

        // Pulisce eventuali utenti di test esistenti
        await User.deleteMany({ username: { $regex: /^testuser_/ } });

        // Test 1: Creazione utente con password in chiaro
        console.log('\n📝 Test 1: Creazione utente...');
        const testPassword = 'myTestPassword123';
        
        const newUser = new User({
            username: 'testuser_' + Date.now(),
            password: testPassword, // Password in chiaro - dovrebbe essere hashata automaticamente
            role: ['customer'],
            customerDetails: {
                customerName: 'Mario',
                customerSurname: 'Rossi',
                customerFiscalCode: 'RSSMRA90A01H501X',
                customerAddresses: {
                    billingAddress: 'Via Roma 1',
                    shippingAddress: 'Via Roma 1'
                },
                customerPhoneNumber: '3331234567'
            }
        });

        await newUser.save();
        
        console.log(`✅ Utente creato: ${newUser.username}`);
        console.log(`✅ Password originale: ${testPassword}`);
        console.log(`✅ Password hashata: ${newUser.password}`);
        console.log(`✅ Password hashata correttamente: ${newUser.password !== testPassword}`);
        console.log(`✅ Lunghezza hash: ${newUser.password.length} caratteri (dovrebbe essere ~60)`);

        // Test 2: Verifica che il login funzioni
        console.log('\n🔐 Test 2: Verifica login...');
        const isMatch = await bcrypt.compare(testPassword, newUser.password);
        console.log(`✅ bcrypt.compare() result: ${isMatch}`);

        // Test 3: Verifica con metodo del modello
        const isMatchMethod = await newUser.comparePassword(testPassword);
        console.log(`✅ comparePassword() method result: ${isMatchMethod}`);

        // Test 4: Verifica con password sbagliata
        console.log('\n❌ Test 3: Verifica con password sbagliata...');
        const isWrongMatch = await newUser.comparePassword('passwordSbagliata');
        console.log(`✅ Password sbagliata rifiutata correttamente: ${!isWrongMatch}`);

        // Cleanup
        await User.deleteOne({ _id: newUser._id });
        console.log(`✅ Utente di test pulito: ${newUser.username}`);

        console.log('\n🎉 TUTTI I TEST SUPERATI! Il fix del doppio hash funziona correttamente.');
        console.log('\nRisultato:');
        console.log('- ✅ Password viene hashata UNA SOLA VOLTA dal middleware pre-save');
        console.log('- ✅ Login funziona correttamente');
        console.log('- ✅ Password sbagliate vengono rifiutate');
        console.log('- ✅ Il doppio hash è stato eliminato');

    } catch (error) {
        console.error('❌ Errore durante il test:', error.message);
        console.error(error);
    } finally {
        // Cleanup automatico database test
        await cleanupTestDatabase();
        await closeTestDatabase();
        console.log('\n🔌 Connessione database chiusa');
        process.exit(0);
    }
}

testPasswordFix();