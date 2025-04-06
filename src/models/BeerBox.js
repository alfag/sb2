const mongoose = require('mongoose');

const beerBoxSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
    },
    brewery: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Brewery',
        required: true,
    },
    price: {
        type: Number,
        required: true,
    },
    availability: {
        type: Number,
        required: true,
    },
    sbCode: {
        type: String,
        unique: true,
        required: true,
    },
    logisticsStatus: {
        type: String,
        enum: ['in warehouse', 'shipped', 'delivered'],
        default: 'in warehouse',
    },
}, { timestamps: true });

module.exports = mongoose.model('BeerBox', beerBoxSchema);