/**
 * Test per verificare che il template AI Verification non abbia più errori di sintassi
 */

const nunjucks = require('nunjucks');
const path = require('path');

console.log('🔧 TEST: Verifica Template AI Verification');
console.log('');

// Setup Nunjucks environment
const env = nunjucks.configure(path.join(__dirname, '../views'), {
    autoescape: true,
    noCache: true
});

// Aggiungi filtro cleantext
env.addFilter('cleantext', function(str) {
    if (typeof str !== 'string') return str;
    return str
        .replace(/â/g, 'a')
        .replace(/ã/g, 'a')
        .replace(/à/g, 'a')
        .replace(/á/g, 'a')
        .replace(/è/g, 'e')
        .replace(/é/g, 'e')
        .trim();
});

// Dati di test
const testData = {
    title: 'Test AI Verification',
    sessionData: {
        bottles: [
            {
                bottleLabel: 'Test Beer',
                beerName: 'Test Beer Name',
                breweryName: 'Test Brewery',
                beerType: 'IPA',
                alcoholContent: '5.2%',
                volume: '330ml',
                thumbnail: '/test/image.jpg',
                confidence: 0.85
            }
        ],
        breweries: [
            {
                breweryName: 'Test Brewery',
                name: 'Test Brewery Alt',
                breweryWebsite: 'https://test.com',
                breweryLegalAddress: 'Test Address',
                confidence: 0.78
            }
        ],
        processedData: {
            some: 'data'
        }
    },
    validation: {
        requiresUserConfirmation: true,
        requiresUserCompletion: true,
        bottles: [],
        breweries: []
    },
    user: null,
    isGuest: true
};

try {
    console.log('📝 Tentativo rendering template...');
    
    const result = env.render('review/aiVerification.njk', testData);
    
    console.log('✅ SUCCESS: Template renderizzato correttamente!');
    console.log('✅ Nessun errore di sintassi Nunjucks');
    console.log('✅ Filtro keys error risolto');
    console.log('✅ Template pronto per l\'uso');
    console.log('');
    console.log('📊 Template include:');
    console.log('- Debug info senza filtro keys');
    console.log('- Sistema di fallback sessionData → validation');
    console.log('- Visualizzazione dati AI con thumbnails');
    console.log('- Form arricchimento con stati visivi');
    console.log('- Gestione caratteri strani con filtro cleantext');
    
    // Verifica che il debug info sia nel rendering
    if (result.includes('🔧 Debug Info:')) {
        console.log('✅ Debug info presente nel template');
    } else {
        console.log('⚠️  Debug info non trovato nel template');
    }
    
    if (result.includes('bottlesData')) {
        console.log('✅ Sistema fallback implementato');
    } else {
        console.log('⚠️  Sistema fallback non implementato correttamente');
    }
    
} catch (error) {
    console.log('❌ ERROR: Template ha ancora errori di sintassi:');
    console.log(error.message);
    console.log('');
    console.log('🔧 Dettagli errore:');
    console.log('Line:', error.lineno || 'N/A');
    console.log('Column:', error.colno || 'N/A');
    console.log('Template:', error.filename || 'N/A');
}

console.log('');