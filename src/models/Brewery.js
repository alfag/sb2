const mongoose = require('mongoose');

const brewerySchema = new mongoose.Schema({
    breweryName: { type: String, required: true },
    breweryDescription: { type: String },
    breweryFiscalCode: { type: String },
    breweryREAcode: { type: String },
    breweryacciseCode: { type: String },
    pecEmail: { type: String }, // 🔥 FIX: Aggiunta PEC (8 gen 2026)
    breweryFund: { type: String },
    breweryLegalAddress: { type: String },
    breweryPhoneNumber: { type: String },
    breweryWebsite: { type: String },
    breweryLogo: { type: String },
    logoIsLight: { type: Boolean, default: null }, // 🎨 True se logo prevalentemente bianco/chiaro (22 gen 2026)
    breweryImages: { type: [String] },
    breweryVideos: { type: [String] },
    brewerySocialMedia: {
        type: Object,
        facebook: { type: String },
        instagram: { type: String },
        twitter: { type: String },
        linkedin: { type: String },
        youtube: { type: String }
    },
    
    // Campi AI aggiuntivi
    foundingYear: String,
    breweryEmail: String,
    breweryProductionAddress: String,
    brewerySize: String, // 'microbirrificio', 'birrificio artigianale', 'industriale'
    employeeCount: String,
    productionVolume: String,
    distributionArea: String,
    breweryHistory: String,
    masterBrewer: String,
    mainProducts: [String],
    awards: [String],
    
    breweryProducts: [{
        type: mongoose.Schema.Types.ObjectId,
        productID: { type: mongoose.Schema.Types.ObjectId, required: true },
        productName: { type: String, required: true },
        productDescription: { type: String },
        productCategory: { type: String, required: true },
        productPrice: { type: Number, required: true },
        productImage: { type: String },
        productAlcoholContent: { type: Number },
        productVolume: { type: Number },
        productAvailableQuantity: { type: Number },
    }],
    breweryDeposits: [{
        type: Object,
        depositID: { type: mongoose.Schema.Types.ObjectId, required: true },
        depositType: { type: String, enum: ['local', 'remote'], required: function () { return this.depositType != null; } },
        depositAddress: { type: String, required: function () { return this.depositAddress != null; } },
        latitude: { type: Number },
        longitude: { type: Number },
        remoteBreweryDetails: {
            type: Object,
            remoteBreweryID: {
                type: mongoose.Schema.Types.ObjectId, required: function () { return this.parent().depositType === 'remote'; }
            },
            remoteBreweryProducts: [{
                type: mongoose.Schema.Types.ObjectId,
                productAvailableQuantity: { type: Number, required: function () { return this.parent().depositType === 'remote'; } },
                productPrice: { type: Number, required: function () { return this.parent().depositType === 'remote'; } }
            }]
        }
    }],
    
    // Metadati AI
    aiExtracted: { type: Boolean, default: false },
    aiConfidence: Number,
    lastAiUpdate: { type: Date, default: Date.now },
    
    // Sistema di validazione
    validationStatus: {
        type: String,
        enum: ['validated', 'pending_validation', 'ai_extracted', 'web_scraped'],
        default: 'pending_validation'
    },
    dataSource: {
        type: String,
        enum: ['manual', 'ai_analysis', 'web_scraping', 'web_search', 'google_search_retrieval'],
        default: 'manual'
    },
    validatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    validatedAt: Date,
    validationNotes: String,
    needsValidation: { type: Boolean, default: false }, // Flag per validazione dati
    validationReason: String, // Motivazione per cui è richiesta validazione (quando needsValidation = true)
    needsManualReview: { type: Boolean, default: false },
    reviewReason: String
}, {
    timestamps: true
});

brewerySchema.index({ coordinates: '2dsphere' });

// ============================================
// 🔧 URL NORMALIZATION HELPER FUNCTION
// ============================================
/**
 * Normalizza un URL:
 * 1. Converte HTTP → HTTPS per sicurezza
 * 2. Rimuove trailing slashes
 * 3. Rimuove query parameters non necessari
 * @param {string} url - URL da normalizzare
 * @returns {string|null} - URL normalizzato o null se invalido
 */
function normalizeUrl(url) {
    if (!url || typeof url !== 'string') return url;
    
    let normalized = url.trim();
    
    // 1. Converti HTTP → HTTPS (la maggior parte dei siti supporta HTTPS)
    if (normalized.startsWith('http://')) {
        normalized = normalized.replace(/^http:\/\//i, 'https://');
    }
    
    // 2. Rimuovi trailing slash (per uniformità)
    normalized = normalized.replace(/\/+$/, '');
    
    return normalized;
}

// ============================================
// 🔧 PRE-SAVE HOOK - URL NORMALIZATION
// ============================================
/**
 * Hook pre-save per normalizzare automaticamente gli URL
 * Questo garantisce che tutti i logo URL siano HTTPS
 */
brewerySchema.pre('save', function(next) {
    // Normalizza breweryLogo (HTTP → HTTPS)
    if (this.breweryLogo) {
        this.breweryLogo = normalizeUrl(this.breweryLogo);
    }
    
    // Normalizza breweryWebsite (HTTP → HTTPS)
    if (this.breweryWebsite) {
        this.breweryWebsite = normalizeUrl(this.breweryWebsite);
    }
    
    // Normalizza breweryImages array (HTTP → HTTPS)
    if (this.breweryImages && Array.isArray(this.breweryImages)) {
        this.breweryImages = this.breweryImages.map(img => normalizeUrl(img));
    }
    
    next();
});

// ============================================
// 🔧 PRE-UPDATE HOOKS - URL NORMALIZATION
// ============================================
/**
 * Hook per findOneAndUpdate - normalizza URL anche durante gli update
 */
brewerySchema.pre('findOneAndUpdate', function(next) {
    const update = this.getUpdate();
    
    if (update.$set) {
        if (update.$set.breweryLogo) {
            update.$set.breweryLogo = normalizeUrl(update.$set.breweryLogo);
        }
        if (update.$set.breweryWebsite) {
            update.$set.breweryWebsite = normalizeUrl(update.$set.breweryWebsite);
        }
        if (update.$set.breweryImages && Array.isArray(update.$set.breweryImages)) {
            update.$set.breweryImages = update.$set.breweryImages.map(img => normalizeUrl(img));
        }
    }
    
    // Gestisci anche update diretti (senza $set)
    if (update.breweryLogo) {
        update.breweryLogo = normalizeUrl(update.breweryLogo);
    }
    if (update.breweryWebsite) {
        update.breweryWebsite = normalizeUrl(update.breweryWebsite);
    }
    
    next();
});

module.exports = mongoose.model('Brewery', brewerySchema);