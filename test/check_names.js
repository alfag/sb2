// Verifica esatta dei nomi nel database
const mongoose = require('mongoose');

async function checkExactNames() {
  try {
    await mongoose.connect(process.env.MONGODB_URL_SB2 || 'mongodb://localhost:27017/sb2');

    const Brewery = require('../src/models/Brewery');
    const breweries = await Brewery.find({}, 'breweryName').lean();

    console.log('=== VERIFICA ESATTA DEI NOMI ===');
    console.log('Totale birrifici:', breweries.length);
    console.log();

    const targetName = 'Birrificio Indipendente Viana';
    console.log('Cerco esattamente:', targetName);
    console.log();

    let found = false;
    breweries.forEach((brewery, index) => {
      const name = brewery.breweryName;
      const isExactMatch = name === targetName;
      const containsTarget = name.includes(targetName);
      const targetContains = targetName.includes(name);

      if (isExactMatch) {
        console.log('MATCH ESATTO TROVATO:');
        console.log('   Indice:', index);
        console.log('   Nome:', name);
        found = true;
      } else if (containsTarget || targetContains) {
        console.log('CORRISPONDENZA PARZIALE:');
        console.log('   Indice:', index);
        console.log('   Nome nel DB:', name);
        console.log('   Nome cercato:', targetName);
      }
    });

    if (!found) {
      console.log('NESSUN MATCH ESATTO TROVATO!');
      console.log();
      console.log('Birrifici che contengono "Viana":');
      const vianaBreweries = breweries.filter(b =>
        b.breweryName && b.breweryName.toLowerCase().includes('viana')
      );

      if (vianaBreweries.length === 0) {
        console.log('   Nessuno!');
      } else {
        vianaBreweries.forEach((b, i) => {
          console.log('   ' + (i+1) + '. ' + b.breweryName);
        });
      }
    }

  } catch (error) {
    console.error('Errore:', error.message);
  } finally {
    await mongoose.disconnect();
  }
}

checkExactNames();
