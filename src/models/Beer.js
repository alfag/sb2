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
  
  // 🆕 ENRICHMENT FIELDS - Campi arricchimento da web scraping (FIX #6 Phase 13)
  color: { type: String, trim: true }, // Colore birra (ambrata, dorata, scura)
  servingTemperature: { type: String, trim: true }, // Temperatura servizio (6-8°C)
  fermentation: { type: String, trim: true }, // Tipo fermentazione (alta/bassa)
  glassType: { type: String, trim: true }, // Tipo bicchiere consigliato
  
  // Caratteristiche sensoriali
  aroma: { type: String, trim: true }, // Profilo aromatico
  appearance: { type: String, trim: true }, // Aspetto visivo dettagliato
  mouthfeel: { type: String, trim: true }, // Sensazione in bocca
  bitterness: { type: String, trim: true }, // Livello amaro
  carbonation: { type: String, trim: true }, // Livello carbonazione
  pairing: { type: [String], default: [] }, // Abbinamenti cibo
  
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
  dataSource: { 
    type: String, 
    enum: ['label', 'label_only', 'web', 'label+web', 'manual', 'google_search_retrieval', 'ai_analysis+gsr', 'database_cache'], 
    default: 'label' 
  },
  lastAiUpdate: { type: Date },
  
  // 🛡️ Validazione dati AI
  needsValidation: { type: Boolean, default: false },
  validationReason: { type: String, trim: true }, // Motivazione per cui è richiesta validazione (quando needsValidation = true)
  validationNotes: { type: String, trim: true },
  
  // Sistema di validazione
  validationStatus: {
    type: String,
    enum: ['validated', 'pending_validation', 'ai_extracted', 'web_scraped', 'gsr_verified'],
    default: 'pending_validation'
  },
  validatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  validatedAt: Date,
  needsManualReview: { type: Boolean, default: false },
  reviewReason: String,
  
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
