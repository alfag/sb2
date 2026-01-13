/**
 * Script per correggere l'URL del logo di La Morosina
 * 
 * Problema: L'URL usa HTTP invece di HTTPS, causando blocco mixed content nel browser
 * Soluzione: Aggiornare l'URL da http:// a https://
 * 
 * Esegui con: node scripts/fix_morosina_logo.js
 */

const mongoose = require('mongoose');
require('dotenv').config();

const MONGODB_URL = process.env.MONGODB_URL_SB2 || 'mongodb://localhost:27017/sb2_data';

async function fixMorosinaLogo() {
    try {
        console.log('🔧 Connessione al database...');
        await mongoose.connect(MONGODB_URL);
        console.log('✅ Connesso al database');

        // Query per trovare La Morosina
        const result = await mongoose.connection.db.collection('breweries').findOneAndUpdate(
            { breweryName: { $regex: /morosina/i } },
            { 
                $set: { 
                    breweryLogo: 'https://lamorosina.it/images/logo/dark.svg' 
                } 
            },
            { returnDocument: 'after' }
        );

        if (result) {
            console.log('✅ Logo aggiornato con successo!');
            console.log(`   Birrificio: ${result.breweryName}`);
            console.log(`   Nuovo URL logo: ${result.breweryLogo}`);
        } else {
            console.log('⚠️ Birrificio La Morosina non trovato nel database');
        }

    } catch (error) {
        console.error('❌ Errore:', error.message);
    } finally {
        await mongoose.disconnect();
        console.log('🔌 Disconnesso dal database');
    }
}

fixMorosinaLogo();
