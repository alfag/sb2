const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  imageUrl: { type: String, required: true },
  sessionId: { type: String }, // ID sessione per controllo duplicati
  ratings: [{
    bottleLabel: String,
    rating: { type: Number, min: 1, max: 5 }, // Rating generale (mantenuto per compatibilità)
    brewery: { type: mongoose.Schema.Types.ObjectId, ref: 'Brewery' },
    beer: { type: mongoose.Schema.Types.ObjectId, ref: 'Beer' }, // Riferimento alla birra nel database
    notes: String, // Note testuali della recensione
    // Valutazioni dettagliate per le 5 caratteristiche principali
    detailedRatings: {
      appearance: {
        rating: { type: Number, min: 1, max: 5 },
        notes: String // Note sull'aspetto (colore, limpidezza, schiuma)
      },
      aroma: {
        rating: { type: Number, min: 1, max: 5 },
        notes: String // Note sull'aroma e profumi
      },
      taste: {
        rating: { type: Number, min: 1, max: 5 },
        notes: String // Note sul gusto e bilanciamento
      },
      mouthfeel: {
        rating: { type: Number, min: 1, max: 5 },
        notes: String // Note su corpo, carbonazione, astringenza
      },
      overall: {
        rating: { type: Number, min: 1, max: 5 },
        notes: String // Impressione generale
      }
    },
    // Dati AI aggiuntivi per ogni bottiglia
    aiData: {
      alcoholContent: String,
      beerType: String,
      beerSubStyle: String,
      volume: String,
      description: String,
      ingredients: String,
      tastingNotes: String,
      confidence: Number,
      dataSource: String, // 'label', 'web', 'label+web'
      ibu: String,
      nutritionalInfo: String,
      price: String,
      availability: String,
      bottleLabel: String // Nome birra dai dati AI
    }
  }],
  location: {
    address: String,
    gps: {
      lat: Number,
      lng: Number
    }
  },
  date: { type: Date, default: Date.now },
  deviceId: String,
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  status: { type: String, enum: ['pending', 'validated', 'completed'], default: 'pending' },
  aiFeedback: String,
  // Metadati dell'analisi AI
  aiAnalysis: {
    webSearchPerformed: Boolean,
    dataSourceSummary: {
      fromLabel: [String],
      fromWebSearch: [String],
      notAvailable: [String]
    },
    imageQuality: String, // 'ottima', 'buona', 'discreta', 'scarsa'
    analysisComplete: Boolean,
    overallConfidence: Number,
    processingTime: String
  }
});

module.exports = mongoose.model('Review', reviewSchema);
