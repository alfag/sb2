/**
 * Script per analizzare e aggiornare il logo del birrificio Collesi
 * Verifica se il logo è chiaro e aggiorna il campo logoIsLight
 */

const mongoose = require('mongoose');
require('../config/db');
const Brewery = require('../src/models/Brewery');
const LogoAnalyzerService = require('../src/services/logoAnalyzerService');

async function main() {
    console.log('⏳ Attesa connessione DB...');
    await new Promise(r => setTimeout(r, 2000));
    
    // Cerca il birrificio Collesi
    const brewery = await Brewery.findOne({ breweryName: { $regex: /collesi/i } });
    
    if (!brewery) {
        console.log('❌ Birrificio Collesi non trovato');
        process.exit(1);
    }
    
    console.log('📍 Trovato birrificio:', brewery.breweryName);
    console.log('🖼️ Logo URL:', brewery.breweryLogo ? brewery.breweryLogo.substring(0, 100) + '...' : 'N/A');
    console.log('☀️ logoIsLight attuale:', brewery.logoIsLight);
    
    if (!brewery.breweryLogo) {
        console.log('❌ Nessun logo presente');
        process.exit(1);
    }
    
    // Analizza il logo
    console.log('\n🔍 Analisi del logo in corso...');
    const isLight = await LogoAnalyzerService.isImageLight(brewery.breweryLogo);
    
    console.log('📊 Risultato analisi:', isLight === null ? 'errore' : (isLight ? '☀️ CHIARO' : '🌙 SCURO'));
    
    // Aggiorna il birrificio
    if (isLight !== null) {
        brewery.logoIsLight = isLight;
        await brewery.save();
        console.log('✅ Aggiornato logoIsLight a:', isLight);
    }
    
    process.exit(0);
}

main().catch(err => {
    console.error('Errore:', err);
    process.exit(1);
});
