/**
 * Test per verificare il layout delle statistiche admin
 */

const puppeteer = require('puppeteer');

async function testStatisticsLayout() {
    let browser;
    try {
        console.log('🧪 Avvio test layout statistiche...');
        
        browser = await puppeteer.launch({ 
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        
        const page = await browser.newPage();
        
        // Imposta dimensioni schermo desktop
        await page.setViewport({ width: 1400, height: 900 });
        
        // Naviga alla homepage prima (per evitare problemi di auth)
        await page.goto('http://localhost:8080', { waitUntil: 'networkidle2' });
        
        console.log('✅ Homepage caricata');
        
        // Cerca il link alle statistiche (potrebbero servire credenziali admin)
        const statsLink = await page.$('a[href*="statistics"]');
        if (!statsLink) {
            console.log('⚠️  Link statistiche non trovato, probabilmente serve autenticazione admin');
            return;
        }
        
        // Naviga alle statistiche
        await page.goto('http://localhost:8080/administrator/statistics', { 
            waitUntil: 'networkidle2' 
        });
        
        console.log('✅ Pagina statistiche caricata');
        
        // Verifica presenza elementi chiave
        const heroSection = await page.$('.hero-section');
        const chartsGrid = await page.$('.charts-grid');
        const chartCards = await page.$$('.chart-card');
        
        console.log('🔍 Verifica elementi layout:');
        console.log('  - Hero section:', heroSection ? '✅' : '❌');
        console.log('  - Charts grid:', chartsGrid ? '✅' : '❌');
        console.log('  - Chart cards trovate:', chartCards.length);
        
        // Verifica CSS grid
        if (chartsGrid) {
            const gridStyle = await page.evaluate(() => {
                const grid = document.querySelector('.charts-grid');
                const computedStyle = window.getComputedStyle(grid);
                return {
                    display: computedStyle.display,
                    gridTemplateColumns: computedStyle.gridTemplateColumns,
                    gap: computedStyle.gap
                };
            });
            
            console.log('📐 Stile griglia:', gridStyle);
        }
        
        // Verifica caricamento Chart.js
        const chartJsLoaded = await page.evaluate(() => {
            return typeof Chart !== 'undefined';
        });
        
        console.log('📊 Chart.js caricato:', chartJsLoaded ? '✅' : '❌');
        
        // Verifica canvas presenti
        const canvasElements = await page.$$('canvas');
        console.log('🎨 Canvas trovati:', canvasElements.length);
        
        // Prendi screenshot per debug
        await page.screenshot({ 
            path: '/tmp/statistics-layout-test.png',
            fullPage: true 
        });
        
        console.log('📸 Screenshot salvato in /tmp/statistics-layout-test.png');
        
        console.log('✅ Test completato con successo!');
        
    } catch (error) {
        console.error('❌ Errore durante il test:', error.message);
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

// Esegui il test se chiamato direttamente
if (require.main === module) {
    testStatisticsLayout();
}

module.exports = { testStatisticsLayout };
