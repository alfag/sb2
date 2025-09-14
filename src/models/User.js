const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true,
    },
    password: {
        type: String,
        required: true,
    },
    role: {
        type: [String],
        required: true,
        enum: ['customer', 'brewery', 'administrator'],
        default: ['customer'],
    },
    defaultRole: {
        type: String,
        enum: ['customer', 'brewery'],
        default: 'customer',
        required: true,
    },
    customerDetails: {
        type: Object,
        customerID: { type: mongoose.Schema.Types.ObjectId, required: true, unique: true },
        customerName: { type: String, required: true },
        customerSurname: { type: String, required: true },
        customerFiscalCode: { type: String, required: true },
        customerAddresses: {
            billingAddress: { type: String },
            shippingAddress: { type: String },
        },
        customerPhoneNumber: { type: String },
        customerPurchases: [{
            type: Object,
            purchaseDate: { type: Date, default: Date.now },
            purchaseAmount: { type: Number, required: true },
            purchaseItems: [{
                itemID: { type: mongoose.Schema.Types.ObjectId },
                quantity: { type: Number, required: true }
            }],
            purchaseStatus: { type: String },
            purchasePaymentMethod: { type: String },
            purchaseShippingMethod: { type: String, enum: ['onsite', 'express'], default: 'onsite' },
            purchaseTrackingNumber: { type: String },
            purchaseDeliveryAddress: { type: String }
        }],
        customerWishlist: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Brewery.breweryProducts'
        }],
        customerReviews: [{
            type: Object,
            productID: { type: mongoose.Schema.Types.ObjectId },
            ref: 'Brewery.breweryProducts',
            reviewText: { type: String },
            reviewRating: { type: Number, min: 1, max: 5 },
            reviewDate: { type: Date, default: Date.now }
        }],
    },
    breweryDetails: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Brewery',
    },
    administratorDetails: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Administrator',
    }
}, { timestamps: true });

userSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();
    this.password = await bcrypt.hash(this.password, 10);
    next();
});

userSchema.methods.comparePassword = async function (candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

const User = mongoose.model('User', userSchema);

module.exports = User;