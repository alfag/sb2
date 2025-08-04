// Script per pulire i valori AI_EXTRACTED_TEMP dal database
const mongoose = require('mongoose');
const Brewery = require('./src/models/Brewery');

async function cleanAITempValues() {
  try {
    // Connetti al database
    const { DB_URI } = require('./config/config');
    await mongoose.connect(DB_URI);
    console.log('✓ Connesso al database');

    // Trova tutti i birrifici con valori AI_EXTRACTED_TEMP
    const breweriesWithTemp = await Brewery.find({
      $or: [
        { breweryFiscalCode: 'AI_EXTRACTED_TEMP' },
        { breweryREAcode: 'AI_EXTRACTED_TEMP' },
        { breweryacciseCode: 'AI_EXTRACTED_TEMP' },
        { breweryFund: 'AI_EXTRACTED_TEMP' }
      ]
    });

    console.log(`Trovati ${breweriesWithTemp.length} birrifici con valori AI_EXTRACTED_TEMP`);

    if (breweriesWithTemp.length === 0) {
      console.log('✓ Nessun dato da pulire');
      process.exit(0);
    }

    // Mostra i birrifici che verranno aggiornati
    console.log('\\nBirrifici da aggiornare:');
    breweriesWithTemp.forEach((brewery, index) => {
      console.log(`${index + 1}. ${brewery.breweryName} (ID: ${brewery._id})`);
      if (brewery.breweryFiscalCode === 'AI_EXTRACTED_TEMP') console.log('   - breweryFiscalCode: AI_EXTRACTED_TEMP → ""');
      if (brewery.breweryREAcode === 'AI_EXTRACTED_TEMP') console.log('   - breweryREAcode: AI_EXTRACTED_TEMP → ""');
      if (brewery.breweryacciseCode === 'AI_EXTRACTED_TEMP') console.log('   - breweryacciseCode: AI_EXTRACTED_TEMP → ""');
      if (brewery.breweryFund === 'AI_EXTRACTED_TEMP') console.log('   - breweryFund: AI_EXTRACTED_TEMP → ""');
    });

    console.log('\\nProcedo con la pulizia...');

    // Aggiorna tutti i record
    const updateResult = await Brewery.updateMany(
      {
        $or: [
          { breweryFiscalCode: 'AI_EXTRACTED_TEMP' },
          { breweryREAcode: 'AI_EXTRACTED_TEMP' },
          { breweryacciseCode: 'AI_EXTRACTED_TEMP' },
          { breweryFund: 'AI_EXTRACTED_TEMP' }
        ]
      },
      {
        $set: {
          breweryFiscalCode: { $cond: { if: { $eq: ["$breweryFiscalCode", "AI_EXTRACTED_TEMP"] }, then: "", else: "$breweryFiscalCode" } },
          breweryREAcode: { $cond: { if: { $eq: ["$breweryREAcode", "AI_EXTRACTED_TEMP"] }, then: "", else: "$breweryREAcode" } },
          breweryacciseCode: { $cond: { if: { $eq: ["$breweryacciseCode", "AI_EXTRACTED_TEMP"] }, then: "", else: "$breweryacciseCode" } },
          breweryFund: { $cond: { if: { $eq: ["$breweryFund", "AI_EXTRACTED_TEMP"] }, then: "", else: "$breweryFund" } }
        }
      }
    );

    // Aggiornamento più semplice usando bulkWrite
    const bulkOps = [];
    for (const brewery of breweriesWithTemp) {
      const updateFields = {};
      
      if (brewery.breweryFiscalCode === 'AI_EXTRACTED_TEMP') {
        updateFields.breweryFiscalCode = '';
      }
      if (brewery.breweryREAcode === 'AI_EXTRACTED_TEMP') {
        updateFields.breweryREAcode = '';
      }
      if (brewery.breweryacciseCode === 'AI_EXTRACTED_TEMP') {
        updateFields.breweryacciseCode = '';
      }
      if (brewery.breweryFund === 'AI_EXTRACTED_TEMP') {
        updateFields.breweryFund = '';
      }

      if (Object.keys(updateFields).length > 0) {
        bulkOps.push({
          updateOne: {
            filter: { _id: brewery._id },
            update: { $set: updateFields }
          }
        });
      }
    }

    if (bulkOps.length > 0) {
      const bulkResult = await Brewery.bulkWrite(bulkOps);
      console.log(`✓ Aggiornati ${bulkResult.modifiedCount} birrifici`);
    }

    // Verifica che la pulizia sia avvenuta
    const remainingTemp = await Brewery.countDocuments({
      $or: [
        { breweryFiscalCode: 'AI_EXTRACTED_TEMP' },
        { breweryREAcode: 'AI_EXTRACTED_TEMP' },
        { breweryacciseCode: 'AI_EXTRACTED_TEMP' },
        { breweryFund: 'AI_EXTRACTED_TEMP' }
      ]
    });

    if (remainingTemp === 0) {
      console.log('✓ Pulizia completata con successo!');
      console.log('✓ Tutti i valori AI_EXTRACTED_TEMP sono stati rimossi');
    } else {
      console.log(`⚠ Attenzione: rimangono ancora ${remainingTemp} record con AI_EXTRACTED_TEMP`);
    }

    process.exit(0);
  } catch (error) {
    console.error('Errore durante la pulizia:', error.message);
    process.exit(1);
  }
}

// Esegui solo se chiamato direttamente
if (require.main === module) {
  cleanAITempValues();
}

module.exports = { cleanAITempValues };
