const mongoose = require('mongoose');

const brewerySchema = new mongoose.Schema({
    breweryName: { type: String, required: true },
    breweryDescription: { type: String },
    breweryFiscalCode: { type: String },
    breweryREAcode: { type: String },
    breweryacciseCode: { type: String },
    breweryFund: { type: String },
    breweryLegalAddress: { type: String },
    breweryPhoneNumber: { type: String },
    breweryWebsite: { type: String },
    breweryLogo: { type: String },
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
    lastAiUpdate: { type: Date, default: Date.now }
}, {
    timestamps: true
});

brewerySchema.index({ coordinates: '2dsphere' });

module.exports = mongoose.model('Brewery', brewerySchema);