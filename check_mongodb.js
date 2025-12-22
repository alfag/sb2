const mongoose = require('mongoose');
require('dotenv').config();

// Connessione a MongoDB
mongoose.connect(process.env.MONGODB_URL_SB2, {
  //useFindAndModify: false,
  //useCreateIndex: true
});

mongoose.connection.on('open', async () => {
  console.log('✅ Connesso a MongoDB');

  try {
    // Query per birrifici
    const breweries = await mongoose.connection.db.collection('breweries').find({}).toArray();
    console.log(`\n🏭 BIRRIFICI (${breweries.length} totali):`);
    breweries.forEach((brewery, index) => {
      console.log(`\n${index + 1}. ${brewery.breweryName || 'Nome non disponibile'}`);
      console.log(`   ID: ${brewery._id}`);
      console.log(`   Website: ${brewery.website || 'Non disponibile'}`);
      console.log(`   Descrizione: ${brewery.breweryDescription ? brewery.breweryDescription.substring(0, 100) + '...' : 'Non disponibile'}`);
      console.log(`   Prodotti principali: ${brewery.mainProducts ? brewery.mainProducts.join(', ') : 'Non disponibili'}`);
      console.log(`   Anno fondazione: ${brewery.foundingYear || 'Non disponibile'}`);
      console.log(`   Indirizzo: ${brewery.breweryLegalAddress || 'Non disponibile'}`);
      console.log(`   Email: ${brewery.email || 'Non disponibile'}`);
      console.log(`   Telefono: ${brewery.phone || 'Non disponibile'}`);
      console.log(`   Data creazione: ${brewery.createdAt}`);
      console.log(`   Ultimo aggiornamento AI: ${brewery.lastAiUpdate || 'Mai'}`);
    });

    // Query per birre
    const beers = await mongoose.connection.db.collection('beers').find({}).toArray();
    console.log(`\n🍺 BIRRE (${beers.length} totali):`);
    beers.forEach((beer, index) => {
      console.log(`\n${index + 1}. ${beer.beerName || 'Nome non disponibile'}`);
      console.log(`   ID: ${beer._id}`);
      console.log(`   Birrificio: ${beer.brewery ? beer.brewery : 'Non associato'}`);
      console.log(`   Tipo: ${beer.beerType || 'Non disponibile'}`);
      console.log(`   ABV: ${beer.alcoholContent || 'Non disponibile'}`);
      console.log(`   IBU: ${beer.ibu || 'Non disponibile'}`);
      console.log(`   Volume: ${beer.volume || 'Non disponibile'}`);
      console.log(`   Descrizione: ${beer.description ? beer.description.substring(0, 100) + '...' : 'Non disponibile'}`);
      console.log(`   Ingredienti: ${beer.ingredients ? beer.ingredients.join(', ') : 'Non disponibili'}`);
      console.log(`   Data creazione: ${beer.createdAt}`);
    });

    // Query per recensioni
    const reviews = await mongoose.connection.db.collection('reviews').find({}).toArray();
    console.log(`\n📝 RECENSIONI (${reviews.length} totali):`);
    reviews.forEach((review, index) => {
      console.log(`\n${index + 1}. Recensione ID: ${review._id}`);
      console.log(`   Utente: ${review.user || 'Anonimo'}`);
      console.log(`   Stato: ${review.processingStatus || 'Completato'}`);
      console.log(`   Birre: ${review.metadata?.extractedBottles?.length || 0}`);
      console.log(`   Data creazione: ${review.createdAt}`);
    });

  } catch (error) {
    console.error('❌ Errore durante la query:', error);
  } finally {
    mongoose.connection.close();
  }
});

mongoose.connection.on('error', (error) => {
  console.error('❌ Errore di connessione a MongoDB:', error);
});