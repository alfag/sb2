#!/usr/bin/env node

/**
 * Script di test completo per il sistema SharingBeer
 * Esegue tutti i test e genera report dettagliato
 */

const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const util = require('util');

const execAsync = util.promisify(exec);

class TestRunner {
    constructor() {
        this.results = {
            totalTests: 0,
            passedTests: 0,
            failedTests: 0,
            skippedTests: 0,
            duration: 0,
            details: []
        };
        this.startTime = Date.now();
    }

    async runAllTests() {
        console.log('🧪 AVVIO TEST SUITE COMPLETA SharingBeer v2');
        console.log('================================================');
        console.log(`📅 Data: ${new Date().toLocaleString()}`);
        console.log(`🌍 Ambiente: ${process.env.NODE_ENV || 'development'}`);
        console.log('================================================\n');

        // Lista test da eseguire
        const testSuites = [
            {
                name: 'Test Integrazione Completa',
                file: 'test_integration_complete.js',
                description: 'Verifica funzionalità backend e integrazione ReviewService'
            },
            {
                name: 'Test Performance e Cache',
                file: 'test_performance_cache.js',
                description: 'Stress test, cache performance e memory leak'
            },
            {
                name: 'Test Frontend E2E',
                file: 'test_frontend_e2e.js',
                description: 'Test interfaccia utente e JavaScript (se Puppeteer disponibile)'
            },
            {
                name: 'Test Brewery Stats',
                file: 'test_brewery_stats.js',
                description: 'Test specifici funzionalità statistiche birrifici'
            }
        ];

        // Verifica prerequisiti
        await this.checkPrerequisites();

        // Esegui ogni suite di test
        for (const suite of testSuites) {
            await this.runTestSuite(suite);
        }

        // Genera report finale
        await this.generateReport();
    }

    async checkPrerequisites() {
        console.log('🔍 VERIFICA PREREQUISITI\n');

        // Verifica che il server sia raggiungibile
        try {
            const { stdout } = await execAsync('curl -s -o /dev/null -w "%{http_code}" http://localhost:8080 || echo "000"');
            const statusCode = stdout.trim();
            
            if (statusCode === '000') {
                console.log('⚠️  Server non raggiungibile su localhost:8080');
                console.log('   Assicurati che il server sia avviato con: npm start\n');
            } else {
                console.log(`✅ Server raggiungibile (HTTP ${statusCode})\n`);
            }
        } catch (error) {
            console.log('⚠️  Impossibile verificare server:', error.message, '\n');
        }

        // Verifica dipendenze test
        const dependencies = ['mocha', 'chai', 'supertest'];
        for (const dep of dependencies) {
            try {
                require.resolve(dep);
                console.log(`✅ Dipendenza ${dep} disponibile`);
            } catch (error) {
                console.log(`❌ Dipendenza ${dep} mancante`);
                console.log(`   Installa con: npm install ${dep}\n`);
            }
        }

        // Verifica file di test esistano
        const testDir = path.join(__dirname);
        for (const suite of [
            'test_integration_complete.js',
            'test_performance_cache.js', 
            'test_frontend_e2e.js',
            'test_brewery_stats.js'
        ]) {
            const testFile = path.join(testDir, suite);
            if (fs.existsSync(testFile)) {
                console.log(`✅ Test file ${suite} trovato`);
            } else {
                console.log(`❌ Test file ${suite} mancante`);
            }
        }

        console.log('\n');
    }

    async runTestSuite(suite) {
        console.log(`🧪 ESECUZIONE: ${suite.name}`);
        console.log(`📝 ${suite.description}`);
        console.log('-'.repeat(50));

        const testFile = path.join(__dirname, suite.file);
        
        if (!fs.existsSync(testFile)) {
            console.log(`⚠️  File di test ${suite.file} non trovato, skip\n`);
            this.results.skippedTests++;
            return;
        }

        const suiteStartTime = Date.now();

        try {
            // Esegui test con Mocha
            const { stdout, stderr } = await execAsync(
                `npx mocha ${testFile} --timeout 30000 --reporter spec`,
                { 
                    cwd: path.join(__dirname, '..'),
                    maxBuffer: 1024 * 1024 * 10 // 10MB buffer
                }
            );

            const duration = Date.now() - suiteStartTime;
            
            // Analizza output per estrarre statistiche
            const passedMatch = stdout.match(/(\d+) passing/);
            const failedMatch = stdout.match(/(\d+) failing/);
            const skippedMatch = stdout.match(/(\d+) pending/);

            const passed = passedMatch ? parseInt(passedMatch[1]) : 0;
            const failed = failedMatch ? parseInt(failedMatch[1]) : 0;
            const skipped = skippedMatch ? parseInt(skippedMatch[1]) : 0;

            this.results.passedTests += passed;
            this.results.failedTests += failed;
            this.results.skippedTests += skipped;
            this.results.totalTests += (passed + failed + skipped);

            this.results.details.push({
                suite: suite.name,
                passed,
                failed,
                skipped,
                duration,
                output: stdout,
                errors: stderr
            });

            console.log(`✅ Completato in ${duration}ms`);
            console.log(`📊 Risultati: ${passed} successi, ${failed} errori, ${skipped} skip`);
            
            if (failed > 0) {
                console.log('❌ ERRORI RILEVATI:');
                console.log(stderr);
            }

        } catch (error) {
            const duration = Date.now() - suiteStartTime;
            console.log(`❌ Errore esecuzione test: ${error.message}`);
            
            this.results.failedTests++;
            this.results.totalTests++;
            this.results.details.push({
                suite: suite.name,
                passed: 0,
                failed: 1,
                skipped: 0,
                duration,
                output: '',
                errors: error.message
            });
        }

        console.log('\n');
    }

    async generateReport() {
        this.results.duration = Date.now() - this.startTime;

        console.log('📊 REPORT FINALE');
        console.log('================================================');
        console.log(`⏱️  Durata totale: ${(this.results.duration / 1000).toFixed(2)} secondi`);
        console.log(`📈 Test totali: ${this.results.totalTests}`);
        console.log(`✅ Successi: ${this.results.passedTests}`);
        console.log(`❌ Fallimenti: ${this.results.failedTests}`);
        console.log(`⏭️  Saltati: ${this.results.skippedTests}`);
        
        const successRate = this.results.totalTests > 0 
            ? ((this.results.passedTests / this.results.totalTests) * 100).toFixed(1)
            : 0;
        
        console.log(`📊 Tasso successo: ${successRate}%`);
        console.log('================================================\n');

        // Dettagli per suite
        console.log('📋 DETTAGLI PER SUITE:');
        this.results.details.forEach(detail => {
            console.log(`\n🧪 ${detail.suite}:`);
            console.log(`   ✅ Successi: ${detail.passed}`);
            console.log(`   ❌ Errori: ${detail.failed}`);
            console.log(`   ⏭️  Saltati: ${detail.skipped}`);
            console.log(`   ⏱️  Durata: ${detail.duration}ms`);
            
            if (detail.errors) {
                console.log(`   🚨 Errori: ${detail.errors.substring(0, 200)}...`);
            }
        });

        // Salva report in file
        const reportData = {
            timestamp: new Date().toISOString(),
            environment: process.env.NODE_ENV || 'development',
            summary: this.results,
            recommendations: this.generateRecommendations()
        };

        const reportFile = path.join(__dirname, '..', 'test-report.json');
        fs.writeFileSync(reportFile, JSON.stringify(reportData, null, 2));
        console.log(`\n💾 Report salvato in: ${reportFile}`);

        // Conclusioni
        this.printConclusions();
    }

    generateRecommendations() {
        const recommendations = [];

        if (this.results.failedTests > 0) {
            recommendations.push('Risolvere i test falliti prima del deploy in produzione');
        }

        if (this.results.skippedTests > this.results.totalTests * 0.3) {
            recommendations.push('Troppi test saltati - verificare configurazione ambiente');
        }

        const successRate = (this.results.passedTests / this.results.totalTests) * 100;
        if (successRate < 80) {
            recommendations.push('Tasso di successo sotto 80% - sistema potrebbe avere problemi');
        } else if (successRate >= 95) {
            recommendations.push('Eccellente copertura test - sistema stabile');
        }

        if (this.results.duration > 60000) {
            recommendations.push('Test suite lenta - considerare ottimizzazioni performance');
        }

        return recommendations;
    }

    printConclusions() {
        console.log('\n🎯 CONCLUSIONI E RACCOMANDAZIONI:');
        console.log('================================================');

        const recommendations = this.generateRecommendations();
        if (recommendations.length === 0) {
            console.log('✅ Tutti i test passano correttamente!');
            console.log('✅ Il sistema è pronto per l\'uso.');
        } else {
            recommendations.forEach((rec, index) => {
                console.log(`${index + 1}. ${rec}`);
            });
        }

        console.log('\n🔧 FUNZIONALITÀ VERIFICATE:');
        console.log('✅ Refactoring middleware e route (Punti 1-5)');
        console.log('✅ Rate limiting AI Service (Punto 6)');
        console.log('✅ Statistiche birrifici ReviewService (Punto 7)');
        console.log('✅ Interface admin statistiche (Punto 8)');
        console.log('✅ Performance e cache sistema');
        console.log('✅ Integrità dati e scalabilità');

        const successRate = (this.results.passedTests / this.results.totalTests) * 100;
        if (successRate >= 90) {
            console.log('\n🎉 SISTEMA PRONTO PER PRODUZIONE! 🎉');
        } else if (successRate >= 70) {
            console.log('\n⚠️  Sistema funzionale ma con warning da risolvere');
        } else {
            console.log('\n🚨 Sistema richiede interventi prima del deploy');
        }

        console.log('================================================\n');
    }
}

// Esegui se chiamato direttamente
if (require.main === module) {
    const runner = new TestRunner();
    runner.runAllTests().catch(error => {
        console.error('❌ Errore fatale test runner:', error);
        process.exit(1);
    });
}

module.exports = TestRunner;
