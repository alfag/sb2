const mongoose = require('mongoose');

async function checkReviewBeerRefs() {
    try {
        // Usa la stessa connessione del progetto
        require('dotenv').config();
        await mongoose.connect(process.env.MONGODB_URL_SB2);
        console.log('✅ Connected to MongoDB');

        const Review = mongoose.model('Review', new mongoose.Schema({}, {strict: false}));
        const Beer = mongoose.model('Beer', new mongoose.Schema({}, {strict: false}));
        
        // Trova ultima review completata
        const review = await Review.findOne({processingStatus: 'completed'})
            .sort({createdAt: -1})
            .lean();

        if (!review) {
            console.log('❌ Nessuna review completed trovata');
            process.exit(0);
        }

        console.log('\n=== REVIEW ANALYSIS ===');
        console.log('Review ID:', review._id);
        console.log('Ratings count:', review.ratings?.length || 0);
        console.log('ProcessingStatus:', review.processingStatus);
        
        console.log('\n=== RATINGS DETAILS ===');
        if (review.ratings && review.ratings.length > 0) {
            for (let i = 0; i < review.ratings.length; i++) {
                const rating = review.ratings[i];
                console.log(`\nRating ${i}:`);
                console.log('  - bottleLabel:', rating.bottleLabel || 'N/A');
                console.log('  - bottleIndex:', rating.bottleIndex);
                console.log('  - brewery:', rating.brewery || '❌ MISSING');
                console.log('  - beer:', rating.beer || '❌ MISSING');
                
                // Verifica se la beer esiste
                if (rating.beer) {
                    const beer = await Beer.findById(rating.beer).lean();
                    if (beer) {
                        console.log('  ✅ Beer trovata:', beer.beerName);
                        console.log('  - Campi enrichment:');
                        console.log('    * color:', beer.color || '❌');
                        console.log('    * servingTemperature:', beer.servingTemperature || '❌');
                        console.log('    * fermentation:', beer.fermentation || '❌');
                        console.log('    * pairing:', beer.pairing || '❌');
                        console.log('    * glassType:', beer.glassType || '❌');
                        console.log('    * aroma:', beer.aroma || '❌');
                        console.log('    * appearance:', beer.appearance || '❌');
                        console.log('    * mouthfeel:', beer.mouthfeel || '❌');
                        console.log('    * bitterness:', beer.bitterness || '❌');
                        console.log('    * carbonation:', beer.carbonation || '❌');
                    } else {
                        console.log('  ❌ Beer ID non trovata nel database');
                    }
                }
            }
        } else {
            console.log('❌ Nessun rating trovato nella review');
        }

        console.log('\n=== METADATA ===');
        console.log('extractedBottles:', review.metadata?.extractedBottles?.length || 0);
        console.log('processedBottles:', review.metadata?.processedBottles?.length || 0);

        await mongoose.disconnect();
        console.log('\n✅ Disconnected');
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

checkReviewBeerRefs();
