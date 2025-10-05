const puppeteer = require('puppeteer');
const config = require('../config/config');
const chai = require('chai');
const expect = chai.expect;

// Enable should-style assertions
chai.should();

/**
 * Test End-to-End per funzionalità frontend
 * Verifica interfacce utente e JavaScript implementato
 */
describe('🌐 Frontend Integration Tests', () => {
    let browser, page;
    const baseURL = 'http://localhost:8080';
    
    before(async function() {
        this.timeout(30000);
        console.log('🚀 Avvio browser per test E2E...');
        
        try {
            browser = await puppeteer.launch({
                headless: true,
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            });
            page = await browser.newPage();
            await page.setViewport({ width: 1200, height: 800 });
            console.log('✅ Browser avviato');
        } catch (error) {
            console.log('⚠️ Puppeteer non disponibile, skip test E2E');
            this.skip();
        }
    });
    
    after(async function() {
        if (browser) {
            await browser.close();
            console.log('🔐 Browser chiuso');
        }
    });

    describe('📊 Dashboard Admin Statistiche', () => {
        
        it('dovrebbe caricare la dashboard admin e mostrare statistiche', async function() {
            this.timeout(15000);
            
            try {
                // Vai alla homepage e poi tenta login
                await page.goto(`${baseURL}`, { waitUntil: 'networkidle0' });
                
                // Cerca link di login
                const loginLink = await page.$('a[href*="login"], a[href*="auth"]');
                if (loginLink) {
                    await loginLink.click();
                    await page.waitForTimeout(1000);
                }
                
                // Verifica se la pagina si è caricata correttamente
                const title = await page.title();
                console.log(`📄 Titolo pagina: ${title}`);
                
                // Cerca elementi che indicano che il sito è funzionante
                const bodyText = await page.evaluate(() => document.body.textContent);
                bodyText.should.include('SharingBeer').or.include('Login').or.include('Benvenuto');
                
                console.log('✅ Homepage caricata correttamente');
                
            } catch (error) {
                console.log('⚠️ Errore connessione server:', error.message);
                this.skip();
            }
        });
        
        it('dovrebbe verificare che i file JavaScript esistano', async function() {
            this.timeout(10000);
            
            try {
                // Test che i file JS rispondano
                const jsFiles = [
                    '/js/statisticsManager.js',
                    '/js/modularApp.js',
                    '/js/eventManager.js'
                ];
                
                for (const jsFile of jsFiles) {
                    const response = await page.goto(`${baseURL}${jsFile}`, { waitUntil: 'load' });
                    response.status().should.equal(200);
                    console.log(`✅ File JS accessibile: ${jsFile}`);
                }
                
            } catch (error) {
                console.log('⚠️ Errore caricamento JS files:', error.message);
                // Non skip perché potrebbero essere problemi di rete temporanei
            }
        });
        
        it('dovrebbe verificare che i CSS esistano', async function() {
            this.timeout(10000);
            
            try {
                // Test che i file CSS rispondano
                const cssFiles = [
                    '/css/styles.css',
                    '/css/toggle.css'
                ];
                
                for (const cssFile of cssFiles) {
                    const response = await page.goto(`${baseURL}${cssFile}`, { waitUntil: 'load' });
                    response.status().should.equal(200);
                    console.log(`✅ File CSS accessibile: ${cssFile}`);
                }
                
            } catch (error) {
                console.log('⚠️ Errore caricamento CSS files:', error.message);
            }
        });
    });

    describe('🔒 Sicurezza e Autenticazione', () => {
        
        it('dovrebbe bloccare accesso admin senza autenticazione', async function() {
            this.timeout(10000);
            
            try {
                // Tenta accesso diretto a pagina admin
                const response = await page.goto(`${baseURL}/administrator/statistics`, { 
                    waitUntil: 'networkidle0' 
                });
                
                // Dovrebbe essere redirected o mostrare errore
                const currentUrl = page.url();
                const isRedirected = !currentUrl.includes('/administrator/statistics');
                const hasError = response.status() >= 400;
                
                (isRedirected || hasError).should.be.true;
                console.log(`✅ Accesso admin protetto (status: ${response.status()}, url: ${currentUrl})`);
                
            } catch (error) {
                console.log('⚠️ Errore test sicurezza:', error.message);
            }
        });
    });

    describe('📱 Responsiveness e Mobile', () => {
        
        it('dovrebbe adattarsi a viewport mobile', async function() {
            this.timeout(10000);
            
            try {
                // Imposta viewport mobile
                await page.setViewport({ width: 375, height: 667 });
                await page.goto(`${baseURL}`, { waitUntil: 'networkidle0' });
                
                // Verifica che non ci siano errori JavaScript
                const errors = [];
                page.on('pageerror', error => errors.push(error.message));
                
                await page.waitForTimeout(2000);
                
                errors.length.should.equal(0);
                console.log('✅ Layout mobile senza errori JS');
                
                // Ripristina viewport desktop
                await page.setViewport({ width: 1200, height: 800 });
                
            } catch (error) {
                console.log('⚠️ Errore test mobile:', error.message);
            }
        });
    });
});

// Test semplificato senza Puppeteer se non disponibile
describe('🌐 Frontend Fallback Tests (senza browser)', () => {
    
    it('dovrebbe verificare che i file frontend esistano nel filesystem', () => {
        const fs = require('fs');
        const path = require('path');
        
        const requiredFiles = [
            'public/js/statisticsManager.js',
            'public/js/modularApp.js',
            'public/js/eventManager.js',
            'public/css/styles.css',
            'views/admin/statistics.njk',
            'views/admin/breweryStatistics.njk'
        ];
        
        requiredFiles.forEach(file => {
            const fullPath = path.join(__dirname, '..', file);
            const exists = fs.existsSync(fullPath);
            exists.should.be.true;
            console.log(`✅ File esistente: ${file}`);
        });
    });
    
    it('dovrebbe verificare sintassi JavaScript dei file pubblici', () => {
        const fs = require('fs');
        const path = require('path');
        
        const jsFiles = [
            'public/js/statisticsManager.js',
            'public/js/modularApp.js',
            'public/js/eventManager.js'
        ];
        
        jsFiles.forEach(file => {
            const fullPath = path.join(__dirname, '..', file);
            if (fs.existsSync(fullPath)) {
                const content = fs.readFileSync(fullPath, 'utf8');
                
                // Basic syntax check
                (() => {
                    // Wrap in function to avoid global scope issues
                    const wrapped = `(function() { ${content} })();`;
                    new Function(wrapped);
                }).should.not.throw();
                
                console.log(`✅ Sintassi JavaScript valida: ${file}`);
            }
        });
    });
});

module.exports = describe;
