const mongoose = require('mongoose');

const brewerySchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true
    },
    address: {
        type: String,
        required: true
    },
    coordinates: {
        type: {
            type: String,
            enum: ['Point'], // 'Point' for GeoJSON
            required: true
        },
        coordinates: {
            type: [Number], // [longitude, latitude]
            required: true
        }
    },
    catalog: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'BeerBox'
    }],
    mbCode: {
        type: String,
        unique: true
    },
    storageSpace: {
        type: Number,
        required: true
    },
    currentStock: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'BeerBox'
    }],
    distributedBeerBoxes: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'BeerBox'
    }]
}, {
    timestamps: true
});

brewerySchema.index({ coordinates: '2dsphere' });

module.exports = mongoose.model('Brewery', brewerySchema);