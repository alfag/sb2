const mongoose = require('mongoose');

const beerSchema = new mongoose.Schema({
  // Informazioni base della birra
  beerName: { type: String, required: true, trim: true },
  brewery: { type: mongoose.Schema.Types.ObjectId, ref: 'Brewery', required: true },
  
  // Caratteristiche tecniche
  alcoholContent: { type: String, trim: true },
  beerType: { type: String, trim: true },
  beerSubStyle: { type: String, trim: true },
  ibu: { type: String, trim: true }, // International Bitterness Units
  volume: { type: String, trim: true },
  
  // Descrizioni e note
  description: { type: String, trim: true },
  ingredients: { type: String, trim: true },
  tastingNotes: { type: String, trim: true },
  nutritionalInfo: { type: String, trim: true },
  
  // Informazioni commerciali
  price: { type: String, trim: true },
  availability: { type: String, trim: true },
  
  // Metadati AI
  aiExtracted: { type: Boolean, default: false },
  aiConfidence: { type: Number, min: 0, max: 1 },
  dataSource: { type: String, enum: ['label', 'web', 'label+web', 'manual'], default: 'label' },
  lastAiUpdate: { type: Date },
  
  // Normalizzazione per ricerche
  normalizedName: { type: String }, // Nome normalizzato per ricerche
  searchKeywords: [{ type: String }], // Keywords per ricerca fuzzy
  
  // Metadati di sistema
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Indici per performance
beerSchema.index({ beerName: 1, brewery: 1 }); // Indice composto per ricerca duplicati
beerSchema.index({ normalizedName: 1 });
beerSchema.index({ brewery: 1 });
beerSchema.index({ searchKeywords: 1 });

// Middleware per aggiornamento automatico di updatedAt
beerSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  
  // Genera nome normalizzato per ricerche
  if (this.beerName) {
    this.normalizedName = this.beerName
      .toLowerCase()
      .trim()
      .replace(/[^\w\s]/g, '') // Rimuove punteggiatura
      .replace(/\s+/g, ' '); // Normalizza spazi
    
    // Genera keywords per ricerca fuzzy
    const words = this.normalizedName.split(' ').filter(w => w.length > 2);
    this.searchKeywords = [...new Set(words)]; // Rimuove duplicati
  }
  
  next();
});

module.exports = mongoose.model('Beer', beerSchema);
