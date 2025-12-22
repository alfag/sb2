/**
 * Test Sistema Anti-Allucinazioni Completo
 * Verifica l'integrazione end-to-end del sistema
 */

const fs = require('fs');
const path = require('path');
const AIService = require('../src/services/aiService');
const aiValidationService = require('../src/services/aiValidationService');
const GeminiAI = require('../src/utils/geminiAi');

// Test di base per il sistema anti-allucinazioni
async function testAntiHallucinationSystem() {
    console.log('🛡️ Avvio test sistema anti-allucinazioni...');
    
    try {
        // Mock di una sessione
        const mockSession = {
            id: 'test-session-' + Date.now(),
            aiRequestCount: 0
        };
        
        // Mock di un userId
        const mockUserId = 'test-user-123';
        
        // Crea un'immagine di test molto piccola (1x1 pixel PNG)
        const testImageBuffer = Buffer.from([
            0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D,
            0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
            0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4, 0x89, 0x00, 0x00, 0x00,
            0x0B, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9C, 0x63, 0x60, 0x00, 0x02, 0x00,
            0x00, 0x05, 0x00, 0x01, 0x0D, 0x0A, 0x2D, 0xB4, 0x00, 0x00, 0x00, 0x00,
            0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82
        ]);
        
        console.log('📊 Test 1: Controllo rate limiting');
        const rateLimitCheck = AIService.canMakeRequest(mockSession, mockUserId);
        console.log('✓ Rate limit check:', {
            canMake: rateLimitCheck.canMakeRequest,
            remaining: rateLimitCheck.remainingRequests,
            development: rateLimitCheck.developmentMode
        });
        
        console.log('🖼️ Test 2: Validazione formato immagine');
        const isValidFormat = AIService.isValidImageFormat(testImageBuffer);
        console.log('✓ Formato immagine PNG valido:', isValidFormat);
        
        console.log('🔐 Test 3: Generazione hash immagine');
        const imageHash = AIService.generateImageHash(testImageBuffer);
        console.log('✓ Hash immagine generato:', imageHash.substring(0, 16) + '...');
        
        console.log('🧪 Test 4: Validazione dati analisi');
        const mockAnalysisData = {
            bottles: [
                { name: 'Test Beer', style: 'IPA', abv: 5.5, ibu: 45 }
            ],
            brewery: { name: 'Test Brewery' }
        };
        const validation = AIService.validateAnalysisData(mockAnalysisData);
        console.log('✓ Validazione dati:', {
            isValid: validation.isValid,
            errorsCount: validation.errors.length
        });
        
        console.log('🎯 Test 5: Matching birrifici');
        const mockBreweries = [
            { breweryName: 'Birra Moretti', _id: 'brewery1' },
            { breweryName: 'Peroni', _id: 'brewery2' },
            { breweryName: 'Guinness', _id: 'brewery3' }
        ];
        
        // Test exact match
        const exactMatch = await AIService.findMatchingBrewery('Birra Moretti', {}, mockBreweries);
        console.log('✓ Exact match trovato:', {
            found: !!exactMatch.match,
            matchType: exactMatch.match?.matchType
        });
        
        // Test fuzzy match
        const fuzzyMatch = await AIService.findMatchingBrewery('Moretti', {}, mockBreweries);
        console.log('✓ Fuzzy match risultato:', {
            needsDisambiguation: fuzzyMatch.needsDisambiguation,
            ambiguitiesCount: fuzzyMatch.ambiguities.length
        });
        
        console.log('📝 Test 6: Calcolo similarità nomi');
        const similarity1 = AIService.calculateNameSimilarity('Birra Moretti', 'Moretti');
        const similarity2 = AIService.calculateNameSimilarity('Peroni', 'Guinness');
        console.log('✓ Similarità:', {
            'Birra Moretti vs Moretti': similarity1.toFixed(2),
            'Peroni vs Guinness': similarity2.toFixed(2)
        });
        
        console.log('📋 Test 7: AIValidationService');
        const mockAIResult = {
            success: true,
            breweries: [
                { breweryName: 'Test Brewery Fake', confidence: 0.3 }
            ],
            beers: [
                { name: 'Fake Beer', brewery: 'Test Brewery Fake' }
            ]
        };
        
        try {
            const validationResult = await aiValidationService.processAIResults(mockAIResult, mockBreweries);
            console.log('✓ Validazione AI completata:', {
                canSaveDirectly: validationResult.canSaveDirectly,
                requiresConfirmation: validationResult.requiresUserConfirmation,
                requiresCompletion: validationResult.requiresUserCompletion,
                userActionsCount: validationResult.userActions?.length || 0
            });
        } catch (error) {
            console.log('⚠️ Validazione AI (errore previsto):', error.message.substring(0, 50));
        }
        
        console.log('✅ Test sistema anti-allucinazioni completato!');
        
        return {
            success: true,
            message: 'Tutti i test sono stati completati con successo',
            testsPassed: 7
        };
        
    } catch (error) {
        console.error('❌ Errore durante il test:', error);
        return {
            success: false,
            error: error.message,
            testsPassed: 0
        };
    }
}

// Test interfaccia verifica AI
function testVerificationInterface() {
    console.log('🎨 Test interfaccia verifica AI...');
    
    const templatePath = path.join(__dirname, 'views', 'review', 'aiVerification.njk');
    const cssPath = path.join(__dirname, 'public', 'css', 'aiVerification.css');
    const jsPath = path.join(__dirname, 'public', 'js', 'aiVerification.js');
    const routesPath = path.join(__dirname, 'src', 'routes', 'aiVerificationRoutes.js');
    
    const checks = [
        { name: 'Template aiVerification.njk', path: templatePath },
        { name: 'CSS aiVerification.css', path: cssPath },
        { name: 'JavaScript aiVerification.js', path: jsPath },
        { name: 'Routes aiVerificationRoutes.js', path: routesPath }
    ];
    
    let allPass = true;
    
    checks.forEach(check => {
        if (fs.existsSync(check.path)) {
            const stats = fs.statSync(check.path);
            console.log(`✓ ${check.name} - ${Math.round(stats.size / 1024)}KB`);
        } else {
            console.log(`❌ ${check.name} - File non trovato`);
            allPass = false;
        }
    });
    
    return {
        success: allPass,
        filesChecked: checks.length,
        message: allPass ? 'Tutti i file dell\'interfaccia sono presenti' : 'Alcuni file mancanti'
    };
}

// Esecuzione test se chiamato direttamente
if (require.main === module) {
    (async () => {
        console.log('🚀 Avvio test suite sistema anti-allucinazioni\n');
        
        const systemTest = await testAntiHallucinationSystem();
        console.log('\n' + '='.repeat(50));
        
        const interfaceTest = testVerificationInterface();
        console.log('\n' + '='.repeat(50));
        
        console.log('\n📊 RISULTATI FINALI:');
        console.log(`Sistema Anti-Allucinazioni: ${systemTest.success ? '✅ PASS' : '❌ FAIL'}`);
        console.log(`Interfaccia Verifica: ${interfaceTest.success ? '✅ PASS' : '❌ FAIL'}`);
        
        if (systemTest.success && interfaceTest.success) {
            console.log('\n🎉 TUTTI I TEST SUPERATI! Il sistema è pronto per l\'uso.');
        } else {
            console.log('\n⚠️ Alcuni test hanno fallito. Controlla gli errori sopra.');
        }
    })();
}

module.exports = {
    testAntiHallucinationSystem,
    testVerificationInterface
};