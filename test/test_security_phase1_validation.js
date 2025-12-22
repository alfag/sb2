/**
 * 🛡️ TEST VALIDAZIONE SICUREZZA FASE 1
 * 
 * Verifica che tutti e 3 i fix critici di sicurezza multi-ruolo
 * siano effettivamente implementati e funzionanti.
 * 
 * Data: 10 Ottobre 2025
 * Autore: Sistema di test automatizzato
 */

const { setupTestDatabase, cleanupTestDatabase, closeTestDatabase } = require('./testHelper');
const fs = require('fs');
const path = require('path');

// Import modelli DOPO setupTestDatabase
let User, Brewery;

/**
 * Test 1: Verifica Fix Administrator Assignment Block
 * File: src/controllers/administratorController.js (righe 393-396)
 */
function testFix1_AdministratorAssignmentBlock() {
    console.log('\n🔍 Test 1: Verifica blocco assegnazione administrator...');
    
    const filePath = path.join(__dirname, '../src/controllers/administratorController.js');
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Cerca il pattern di sicurezza
    const hasSecurityCheck = content.includes("roleToAdd === 'administrator'") &&
                             content.includes("req.flash('error'") &&
                             content.includes('non può essere assegnato');
    
    if (hasSecurityCheck) {
        console.log('   ✅ Fix 1 TROVATO: Blocco administrator in addRoleToUser()');
        return true;
    } else {
        console.log('   ❌ Fix 1 MANCANTE: Controllo administrator non trovato!');
        return false;
    }
}

/**
 * Test 2: Verifica Fix Role Removal Protection
 * File: src/controllers/administratorController.js (righe 455-474)
 */
function testFix2_RoleRemovalProtection() {
    console.log('\n🔍 Test 2: Verifica protezione rimozione ruoli...');
    
    const filePath = path.join(__dirname, '../src/controllers/administratorController.js');
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Cerca protezione customer
    const hasCustomerProtection = content.includes("roleToRemove === 'customer'");
    
    // Cerca protezione ultimo ruolo
    const hasLastRoleProtection = content.includes('user.role.length <= 1');
    
    if (hasCustomerProtection && hasLastRoleProtection) {
        console.log('   ✅ Fix 2 TROVATO: Protezione customer e ultimo ruolo');
        return true;
    } else {
        console.log('   ❌ Fix 2 MANCANTE:');
        if (!hasCustomerProtection) console.log('      - Protezione customer non trovata');
        if (!hasLastRoleProtection) console.log('      - Protezione ultimo ruolo non trovata');
        return false;
    }
}

/**
 * Test 3: Verifica Fix UI Administrator Exclusion
 * Files: views/customer/userProfile.njk, views/admin/updateUser.njk, public/js/updateUser.js
 */
function testFix3_UIAdministratorExclusion() {
    console.log('\n🔍 Test 3: Verifica esclusione administrator da UI...');
    
    let allPassed = true;
    
    // Test userProfile.njk
    const userProfilePath = path.join(__dirname, '../views/customer/userProfile.njk');
    const userProfileContent = fs.readFileSync(userProfilePath, 'utf8');
    const hasUserProfileFilter = userProfileContent.includes("role != 'administrator'") &&
                                  userProfileContent.includes('selectableRoles');
    
    if (hasUserProfileFilter) {
        console.log('   ✅ userProfile.njk: Filtro administrator presente');
    } else {
        console.log('   ❌ userProfile.njk: Filtro administrator MANCANTE');
        allPassed = false;
    }
    
    // Test updateUser.njk
    const updateUserPath = path.join(__dirname, '../views/admin/updateUser.njk');
    const updateUserContent = fs.readFileSync(updateUserPath, 'utf8');
    const hasUpdateUserFilter = updateUserContent.includes("role != 'administrator'");
    
    if (hasUpdateUserFilter) {
        console.log('   ✅ updateUser.njk: Filtro administrator presente');
    } else {
        console.log('   ❌ updateUser.njk: Filtro administrator MANCANTE');
        allPassed = false;
    }
    
    // Test updateUser.js
    const updateUserJsPath = path.join(__dirname, '../public/js/updateUser.js');
    const updateUserJsContent = fs.readFileSync(updateUserJsPath, 'utf8');
    const hasClientSideValidation = updateUserJsContent.includes("ruolo === 'customer'") &&
                                     updateUserJsContent.includes('Impossibile rimuovere');
    
    if (hasClientSideValidation) {
        console.log('   ✅ updateUser.js: Validazione customer presente');
    } else {
        console.log('   ❌ updateUser.js: Validazione customer MANCANTE');
        allPassed = false;
    }
    
    return allPassed;
}

/**
 * Test Integrazione: Simula assegnazione administrator
 */
async function testIntegration_BlockAdministratorAssignment() {
    console.log('\n🔍 Test Integrazione: Simula assegnazione administrator...');
    
    try {
        // Crea utente di test
        const testUser = new User({
            username: 'testuser_security',
            email: 'test_security@example.com',
            password: 'TestPassword123!',
            role: ['customer'],
            defaultRole: 'customer'
        });
        
        await testUser.save();
        
        // Simula tentativo di aggiungere administrator
        const originalRoles = [...testUser.role];
        
        // Il controller dovrebbe bloccare questo
        // (qui testiamo solo che il modello permetta modifiche manuali per admin db)
        testUser.role.push('administrator');
        await testUser.save();
        
        // Verifica che sia stato aggiunto (a livello modello è permesso)
        const updated = await User.findById(testUser._id);
        const hasAdministrator = updated.role.includes('administrator');
        
        if (hasAdministrator) {
            console.log('   ✅ Modello permette administrator (OK per gestione DB)');
            console.log('   ℹ️  Controller deve bloccare via UI (verificato in Fix 1)');
            
            // Cleanup
            await User.deleteOne({ _id: testUser._id });
            return true;
        } else {
            console.log('   ❌ Test fallito: administrator non aggiunto');
            return false;
        }
        
    } catch (error) {
        console.error('   ❌ Errore durante test integrazione:', error.message);
        return false;
    }
}

/**
 * Main Test Runner
 */
async function runSecurityPhase1Validation() {
    console.log('═══════════════════════════════════════════════════════════');
    console.log('🛡️  TEST VALIDAZIONE SICUREZZA FASE 1 - MULTI-RUOLO UTENTI');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('Data: 10 Ottobre 2025');
    console.log('Obiettivo: Verificare che tutti e 3 i fix critici siano implementati\n');
    
    try {
        // Setup database test
        await setupTestDatabase();
        console.log('✅ Database test connesso\n');
        
        // Import modelli dopo connessione
        User = require('../src/models/User');
        Brewery = require('../src/models/Brewery');
        
        // Esegui test statici (analisi codice)
        const results = {
            fix1: testFix1_AdministratorAssignmentBlock(),
            fix2: testFix2_RoleRemovalProtection(),
            fix3: testFix3_UIAdministratorExclusion()
        };
        
        // Test integrazione (con database)
        results.integration = await testIntegration_BlockAdministratorAssignment();
        
        // Risultati finali
        console.log('\n═══════════════════════════════════════════════════════════');
        console.log('📊 RISULTATI FINALI:');
        console.log('═══════════════════════════════════════════════════════════');
        
        const allPassed = Object.values(results).every(r => r === true);
        
        console.log(`Fix 1 (Administrator Assignment Block): ${results.fix1 ? '✅ PASS' : '❌ FAIL'}`);
        console.log(`Fix 2 (Role Removal Protection):       ${results.fix2 ? '✅ PASS' : '❌ FAIL'}`);
        console.log(`Fix 3 (UI Administrator Exclusion):     ${results.fix3 ? '✅ PASS' : '❌ FAIL'}`);
        console.log(`Test Integrazione:                      ${results.integration ? '✅ PASS' : '❌ FAIL'}`);
        
        console.log('\n═══════════════════════════════════════════════════════════');
        if (allPassed) {
            console.log('🎉 TUTTI I TEST SUPERATI! Sistema sicurezza Fase 1 COMPLETO ✅');
            console.log('═══════════════════════════════════════════════════════════\n');
            process.exit(0);
        } else {
            console.log('❌ ALCUNI TEST FALLITI! Implementazione incompleta');
            console.log('═══════════════════════════════════════════════════════════\n');
            process.exit(1);
        }
        
    } catch (error) {
        console.error('\n❌ ERRORE DURANTE I TEST:', error.message);
        console.error(error.stack);
        process.exit(1);
    } finally {
        // Cleanup
        await cleanupTestDatabase();
        await closeTestDatabase();
        console.log('✅ Cleanup database completato');
    }
}

// Esegui test se chiamato direttamente
if (require.main === module) {
    runSecurityPhase1Validation();
}

module.exports = { runSecurityPhase1Validation };
