const mongoose = require('mongoose');

const adminConfigSchema = new mongoose.Schema({
    systemParameters: {
        type: Object,
        required: true
    },
    discountSettings: {
        type: Object,
        required: true
    },
    invitationManagement: {
        type: Object,
        required: true
    }
}, { timestamps: true });

module.exports = mongoose.model('AdminConfig', adminConfigSchema);