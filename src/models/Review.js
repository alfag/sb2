const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  imageUrl: { type: String, required: true },
  sessionId: { type: String }, // ID sessione per controllo duplicati
  ratings: [{
    bottleLabel: String,
    bottleIndex: { type: Number, min: 0 }, // FIX #8: Indice bottiglia per correlazione multi-bottle
    rating: { type: Number, min: 1, max: 5 }, // Rating generale (mantenuto per compatibilità)
    brewery: { type: mongoose.Schema.Types.ObjectId, ref: 'Brewery' },
    beer: { type: mongoose.Schema.Types.ObjectId, ref: 'Beer' }, // Riferimento alla birra nel database
    notes: String, // Note testuali della recensione - Impressioni generali
    // Valutazioni dettagliate per le 4 caratteristiche specifiche
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
      }
    }
  }],
  location: {
    address: String,
    coordinates: {
      latitude: { type: Number, default: null },
      longitude: { type: Number, default: null },
      accuracy: { type: Number, default: null }, // Accuratezza in metri
      altitude: { type: Number, default: null }, // Altitudine in metri
      altitudeAccuracy: { type: Number, default: null },
      heading: { type: Number, default: null }, // Direzione movimento
      speed: { type: Number, default: null } // Velocità in m/s
    },
    timestamp: { type: Date }, // Quando è stata acquisita la posizione
    consentGiven: { type: Boolean, default: false }, // Se utente ha dato consenso
    source: { type: String, enum: ['gps', 'network', 'manual', 'none'], default: 'none' } // Fonte della posizione
  },
  date: { type: Date, default: Date.now },
  deviceId: String,
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  status: { type: String, enum: ['pending', 'validated', 'completed'], default: 'pending' },
  aiFeedback: String,
  // Campi per gestione asincrona (Punto 15)
  processingStatus: { 
    type: String, 
    enum: ['pending_validation', 'processing', 'completed', 'failed', 'needs_admin_review'],
    default: 'pending_validation',
    index: true // Indice per query rapide
  },
  processingJobId: String, // ID del job Bull per tracking
  processingError: String, // Messaggio errore se processing fallito
  adminReviewReason: String, // Motivazione per cui è richiesta revisione admin (quando processingStatus = 'needs_admin_review')
  processingAttempts: { type: Number, default: 0 }, // Numero tentativi processing
  lastProcessingAttempt: Date, // Ultimo tentativo processing
  completedAt: Date, // Data completamento processing
  // Dati grezzi AI da processare in background
  rawAiData: {
    bottles: [mongoose.Schema.Types.Mixed],
    brewery: mongoose.Schema.Types.Mixed,
    imageDataUrl: String
  },
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
  },
  // Metadati elaborazione bottiglie (per frontend)
  metadata: {
    processedBottles: [mongoose.Schema.Types.Mixed], // Array bottiglie processate
    bottlesCount: Number, // Conteggio bottiglie
    lastUpdated: Date // Ultimo aggiornamento metadata
  },
  // Campi moderazione recensione
  moderation: {
    isHidden: { type: Boolean, default: false }, // Nascosta per violazione policy
    moderatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    moderatedAt: { type: Date },
    moderationReason: { type: String }, // Motivo nascondimento/moderazione
    moderationHistory: [{
      action: { type: String, enum: ['hidden', 'unhidden', 'status_changed', 'warning_sent', 'edited'] },
      previousStatus: String,
      newStatus: String,
      reason: { type: String },
      moderatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      moderatedAt: { type: Date, default: Date.now }
    }],
    flagged: { type: Boolean, default: false }, // Segnalata da utenti
    flagCount: { type: Number, default: 0 }, // Numero segnalazioni
    flagReasons: [String] // Motivi segnalazioni
  }
});

module.exports = mongoose.model('Review', reviewSchema);
