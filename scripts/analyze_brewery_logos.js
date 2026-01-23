/**
 * Script per analizzare tutti i loghi birrifici esistenti
 * e popolare il campo logoIsLight nel database
 * 
 * Eseguire una volta: node scripts/analyze_brewery_logos.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const LogoAnalyzerService = require('../src/services/logoAnalyzerService');

async function main() {
    console.log('🎨 Connessione al database...');
    
    await mongoose.connect(process.env.MONGODB_URL_SB2);
    console.log('✅ Connesso al database');
    
    console.log('\n🎨 Avvio analisi loghi birrifici...\n');
    
    const result = await LogoAnalyzerService.analyzeAllBreweries();
    
    console.log('\n========================================');
    console.log('📊 RISULTATI ANALISI:');
    console.log(`   ✅ Analizzati: ${result.analyzed}`);
    console.log(`   ☀️  Loghi chiari: ${result.light}`);
    console.log(`   🌙  Loghi scuri: ${result.dark}`);
    console.log(`   ❌ Errori: ${result.errors}`);
    console.log('========================================\n');
    
    await mongoose.disconnect();
    console.log('✅ Disconnesso dal database');
}

main().catch(err => {
    console.error('❌ Errore:', err);
    process.exit(1);
});
