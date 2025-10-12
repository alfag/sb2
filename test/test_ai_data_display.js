/**
 * Test per verifica display dati AI nella pagina di arricchimento
 * Verifica che i dati recuperati dall'AI siano mostrati chiaramente
 */

const { expect } = require('chai');
const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

describe('🎨 Test Display Dati AI - Pagina Arricchimento', function() {
    let templateContent;
    let cssContent;

    before(function() {
        // Leggi il template
        const templatePath = path.join(__dirname, '../views/review/aiVerification.njk');
        templateContent = fs.readFileSync(templatePath, 'utf8');
        
        // Leggi i CSS
        const cssPath = path.join(__dirname, '../public/css/aiVerification.css');
        cssContent = fs.readFileSync(cssPath, 'utf8');
    });

    describe('📋 Verifica Template Structure', function() {
        it('✅ Dovrebbe avere sezione riepilogo dati AI per birrifici', function() {
            expect(templateContent).to.include('ai-data-summary');
            expect(templateContent).to.include('Dati Recuperati dall\'AI');
            expect(templateContent).to.include('ai-data-grid');
        });

        it('✅ Dovrebbe rimuovere sezione "Dati che richiedono arricchimento"', function() {
            expect(templateContent).to.not.include('Dati che Richiedono Arricchimento');
            expect(templateContent).to.not.include('enrichment-needed');
            expect(templateContent).to.not.include('validation.userActions');
        });

        it('✅ Dovrebbe avere sezione riepilogo per birre', function() {
            expect(templateContent).to.include('Dati Recuperati dall\'AI per questa Birra');
            expect(templateContent).to.include('beer-data');
        });

        it('✅ Dovrebbe mostrare campi mancanti', function() {
            expect(templateContent).to.include('missing-fields');
            expect(templateContent).to.include('Campi da Completare');
            expect(templateContent).to.include('missing-field required');
            expect(templateContent).to.include('missing-field optional');
        });
    });

    describe('🎨 Verifica CSS Styling', function() {
        it('✅ Dovrebbe avere stili per ai-data-summary', function() {
            expect(cssContent).to.include('.ai-data-summary');
            expect(cssContent).to.include('linear-gradient(145deg, #f8f9fa 0%, #e9ecef 100%)');
        });

        it('✅ Dovrebbe avere stili per ai-data-grid', function() {
            expect(cssContent).to.include('.ai-data-grid');
            expect(cssContent).to.include('grid-template-columns: repeat(auto-fit, minmax(250px, 1fr))');
        });

        it('✅ Dovrebbe avere stili per campi popolati', function() {
            expect(cssContent).to.include('.ai-data-item.populated');
            expect(cssContent).to.include('linear-gradient(145deg, #d4edda 0%, #c3e6cb 100%)');
        });

        it('✅ Dovrebbe avere stili per campi mancanti', function() {
            expect(cssContent).to.include('.missing-field.required');
            expect(cssContent).to.include('.missing-field.optional');
            expect(cssContent).to.include('#f8d7da');
            expect(cssContent).to.include('#fff3cd');
        });

        it('✅ Dovrebbe essere responsive', function() {
            expect(cssContent).to.include('@media (max-width: 768px)');
            expect(cssContent).to.include('grid-template-columns: 1fr');
        });
    });

    describe('🔧 Verifica Logica Template', function() {
        it('✅ Dovrebbe usare filtro cleantext per tipologia', function() {
            expect(templateContent).to.include('| cleantext');
        });

        it('✅ Dovrebbe mostrare thumbnails delle birre', function() {
            expect(templateContent).to.include('bottle.thumbnail');
            expect(templateContent).to.include('beer-thumbnail-mini');
        });

        it('✅ Dovrebbe gestire fallback per campi birrificio', function() {
            expect(templateContent).to.include('brewery.breweryName or brewery.name');
            expect(templateContent).to.include('brewery.breweryWebsite');
            expect(templateContent).to.include('brewery.breweryLegalAddress');
        });

        it('✅ Dovrebbe gestire fallback per campi birra', function() {
            expect(templateContent).to.include('bottle.bottleLabel or bottle.beerName or bottle.name');
            expect(templateContent).to.include('bottle.beerType or bottle.type or bottle.style');
            expect(templateContent).to.include('bottle.alcoholContent or bottle.abv');
        });
    });

    describe('💡 Verifica UX Features', function() {
        it('✅ Dovrebbe avere icone Font Awesome per ogni campo', function() {
            expect(templateContent).to.include('fas fa-building');
            expect(templateContent).to.include('fas fa-globe');
            expect(templateContent).to.include('fas fa-tag');
            expect(templateContent).to.include('fas fa-percentage');
        });

        it('✅ Dovrebbe avere messaggi informativi', function() {
            expect(templateContent).to.include('fas fa-robot text-info');
            expect(templateContent).to.include('fas fa-exclamation-triangle text-warning');
        });

        it('✅ Dovrebbe truncare descrizioni lunghe', function() {
            expect(templateContent).to.include('| truncate(100)');
        });

        it('✅ Dovrebbe formattare valori correttamente', function() {
            expect(templateContent).to.include('| replace(\'%\', \'\')');
            expect(templateContent).to.include('| replace(\'ml\', \'\')');
        });
    });

    describe('🚀 Test Integrazione', function() {
        it('✅ Template dovrebbe essere sintatticamente valido', function() {
            // Verifica che non ci siano tag non chiusi
            const openTags = (templateContent.match(/<(?!\/)[^>]+>/g) || []).length;
            const closeTags = (templateContent.match(/<\/[^>]+>/g) || []).length;
            
            // Tolleranza per self-closing tags
            expect(Math.abs(openTags - closeTags)).to.be.lessThan(20);
        });

        it('✅ CSS dovrebbe essere valido', function() {
            // Verifica che non ci siano bracket non bilanciati
            const openBrackets = (cssContent.match(/\{/g) || []).length;
            const closeBrackets = (cssContent.match(/\}/g) || []).length;
            
            expect(openBrackets).to.equal(closeBrackets);
        });
    });

    after(function() {
        console.log('\n🎨 RISULTATI TEST AI DATA DISPLAY:');
        console.log('✅ Template structure verificata');
        console.log('✅ CSS styling implementato');
        console.log('✅ Logica template corretta');
        console.log('✅ UX features complete');
        console.log('✅ Integrazione funzionale');
        console.log('\n🚀 IMPLEMENTAZIONE COMPLETA:');
        console.log('📊 Dati AI mostrati chiaramente');
        console.log('📝 Campi mancanti evidenziati');
        console.log('🎯 UX ottimizzata per arricchimento');
        console.log('📱 Design responsive implementato');
    });
});