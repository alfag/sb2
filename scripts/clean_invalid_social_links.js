/**
 * Script per pulire i social links non validi dal database
 * 
 * I social links estratti dallo scraping sono spesso errati o inesistenti.
 * Questo script rimuove tutti i social links esistenti, così GSR potrà
 * ripopolarli correttamente in futuro.
 * 
 * @created 1 Febbraio 2026
 */

const mongoose = require('mongoose');
const config = require('../config/config');

async function cleanSocialLinks() {
  console.log('🧹 Pulizia Social Links - Inizio\n');
  
  try {
    await mongoose.connect(config.MONGODB_URL);
    console.log('✅ Connesso a MongoDB\n');
    
    const Brewery = require('../src/models/Brewery');
    
    // Trova tutti i birrifici con social media
    const breweriesWithSocial = await Brewery.find({
      $or: [
        { 'brewerySocialMedia.facebook': { $exists: true, $ne: null, $ne: '' } },
        { 'brewerySocialMedia.instagram': { $exists: true, $ne: null, $ne: '' } },
        { 'brewerySocialMedia.twitter': { $exists: true, $ne: null, $ne: '' } },
        { 'brewerySocialMedia.youtube': { $exists: true, $ne: null, $ne: '' } },
        { 'brewerySocialMedia.linkedin': { $exists: true, $ne: null, $ne: '' } }
      ]
    }).select('breweryName brewerySocialMedia');
    
    console.log(`📊 Trovati ${breweriesWithSocial.length} birrifici con social links\n`);
    
    if (breweriesWithSocial.length === 0) {
      console.log('✅ Nessun social link da pulire');
      await mongoose.connection.close();
      return;
    }
    
    // Mostra cosa verrà rimosso
    console.log('=== SOCIAL LINKS CHE VERRANNO RIMOSSI ===\n');
    breweriesWithSocial.forEach(b => {
      const social = b.brewerySocialMedia || {};
      const activeSocial = Object.entries(social)
        .filter(([k, v]) => v && v.trim && v.trim() !== '')
        .map(([k, v]) => `${k}: ${v}`)
        .join('\n    ');
      
      if (activeSocial) {
        console.log(`📍 ${b.breweryName}`);
        console.log(`    ${activeSocial}\n`);
      }
    });
    
    // Chiedi conferma
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    const answer = await new Promise(resolve => {
      rl.question('\n⚠️  Vuoi procedere con la pulizia? (s/N): ', resolve);
    });
    rl.close();
    
    if (answer.toLowerCase() !== 's') {
      console.log('\n❌ Operazione annullata');
      await mongoose.connection.close();
      return;
    }
    
    // Pulisci tutti i social links
    console.log('\n🔄 Pulizia in corso...\n');
    
    const result = await Brewery.updateMany(
      {},
      {
        $set: {
          brewerySocialMedia: {
            facebook: null,
            instagram: null,
            twitter: null,
            linkedin: null,
            youtube: null
          }
        }
      }
    );
    
    console.log(`✅ Aggiornati ${result.modifiedCount} birrifici`);
    console.log('\n✨ Pulizia completata!');
    console.log('   I social links verranno ripopolati da GSR durante le prossime recensioni.\n');
    
  } catch (error) {
    console.error('❌ Errore:', error.message);
  } finally {
    await mongoose.connection.close();
    console.log('📴 Connessione MongoDB chiusa');
  }
}

// Esegui
cleanSocialLinks();
