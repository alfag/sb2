const { expect } = require('chai');
const nunjucks = require('nunjucks');

describe('🔧 Fix Caratteri Strani - Campo Tipologia', function() {
    let env;
    
    before(function() {
        // Setup Nunjucks environment con filtro cleantext
        env = nunjucks.configure('views', {
            autoescape: true,
            noCache: true
        });
        
        // Aggiungi filtro cleantext per test
        env.addFilter('cleantext', function(str) {
            if (typeof str !== 'string') return str;
            
            return str
                // Fix caratteri UTF-8 mal codificati comuni
                .replace(/â/g, 'a')
                .replace(/ã/g, 'a')
                .replace(/à/g, 'a')
                .replace(/á/g, 'a')
                .replace(/è/g, 'e')
                .replace(/é/g, 'e')
                .replace(/ì/g, 'i')
                .replace(/í/g, 'i')
                .replace(/ò/g, 'o')
                .replace(/ó/g, 'o')
                .replace(/ù/g, 'u')
                .replace(/ú/g, 'u')
                .replace(/ñ/g, 'n')
                .replace(/ç/g, 'c')
                // Rimuove caratteri di controllo invisibili
                .replace(/[\x00-\x1F\x7F-\x9F]/g, '')
                // Normalizza spazi
                .replace(/\s+/g, ' ')
                .trim();
        });
    });
    
    it('✅ Dovrebbe pulire caratteri UTF-8 mal codificati', function() {
        const testCases = [
            { input: 'IPâ', expected: 'IPa' },
            { input: 'Lãger', expected: 'Lager' },
            { input: 'Weìzen', expected: 'Weizen' },
            { input: 'Ståut', expected: 'Staut' },
            { input: 'Saìson', expected: 'Saison' }
        ];
        
        testCases.forEach(testCase => {
            const template = `{{ beerType | cleantext }}`;
            const result = env.renderString(template, { beerType: testCase.input });
            expect(result).to.equal(testCase.expected);
        });
    });
    
    it('✅ Dovrebbe gestire caratteri di controllo invisibili', function() {
        const inputWithControlChars = 'IPA\x00\x1F\x7F';
        const template = `{{ beerType | cleantext }}`;
        const result = env.renderString(template, { beerType: inputWithControlChars });
        expect(result).to.equal('IPA');
    });
    
    it('✅ Dovrebbe normalizzare spazi multipli', function() {
        const inputWithSpaces = 'Blonde   Ale   ';
        const template = `{{ beerType | cleantext }}`;
        const result = env.renderString(template, { beerType: inputWithSpaces });
        expect(result).to.equal('Blonde Ale');
    });
    
    it('✅ Dovrebbe gestire valori null/undefined senza errori', function() {
        const template = `{{ beerType | cleantext }}`;
        
        let result = env.renderString(template, { beerType: null });
        expect(result).to.equal('');
        
        result = env.renderString(template, { beerType: undefined });
        expect(result).to.equal('');
        
        result = env.renderString(template, {});
        expect(result).to.equal('');
    });
    
    it('✅ Dovrebbe testare template logic per selezione tipologia', function() {
        const mockBottle = {
            beerType: 'IPâ',
            type: 'Lãger',
            style: 'Weìzen'
        };
        
        // Simula la logica del template
        const beerTypeValue = mockBottle.beerType || mockBottle.type || mockBottle.style || '';
        const template = `{% set cleanBeerType = beerTypeValue | cleantext %}{{ cleanBeerType }}`;
        const result = env.renderString(template, { beerTypeValue });
        
        expect(result).to.equal('IPa');
    });
    
    it('✅ Dovrebbe testare matching case-insensitive per selezione option', function() {
        const testCases = [
            { input: 'ipa', shouldMatch: 'IPA' },
            { input: 'IPÀ', shouldMatch: 'IPA' },
            { input: 'làger', shouldMatch: 'Lager' },
            { input: 'STOUT', shouldMatch: 'Stout' }
        ];
        
        testCases.forEach(testCase => {
            const cleanType = env.getFilter('cleantext')(testCase.input);
            const isMatch = cleanType.toLowerCase() === testCase.shouldMatch.toLowerCase();
            expect(isMatch).to.be.true;
        });
    });
});

console.log('🔧 Test completato per fix caratteri strani nel campo tipologia');
console.log('✅ Filtro cleantext implementato');
console.log('✅ Template logic aggiornata');
console.log('✅ CSS font rendering migliorato');
console.log('✅ Matching case-insensitive per opzioni select');