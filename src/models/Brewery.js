const mongoose = require('mongoose');

const brewerySchema = new mongoose.Schema({
    breweryID: { type: mongoose.Schema.Types.ObjectId, required: true, unique: true },
    breweryName: { type: String, required: true },
    breweryDescription: { type: String },
    breweryFiscalCode: { type: String, required: true },
    breweryREAcode: { type: String, required: true },
    breweryacciseCode: { type: String, required: true },
    breweryFund: { type: String, required: true },
    breweryLegalAddress: { type: String, required: true },
    breweryPhoneNumber: { type: String, required: true },
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
    },
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
}, {
    timestamps: true
});

brewerySchema.index({ coordinates: '2dsphere' });

module.exports = mongoose.model('Brewery', brewerySchema);