const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
    customer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    brewery: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Brewery',
        required: true
    },
    beerBox: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'BeerBox',
        required: true
    },
    status: {
        type: String,
        enum: ['pending', 'in progress', 'completed', 'canceled'],
        default: 'pending'
    },
    paymentMethod: {
        type: String,
        required: true
    },
    trackingNumber: {
        type: String,
        required: false
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Order', orderSchema);