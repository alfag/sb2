const mongoose = require('mongoose');

const adminConfigSchema = new mongoose.Schema({
    adminID: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        unique: true
    },
    adminName: {
        type: String,
        required: true
    },
    adminPermissions: {
        type: Object,
        required: true,
        default: {
            manageUsers: true,
            manageBrewery: true,
            viewReports: true
        }
    },
}, { timestamps: true });

module.exports = mongoose.model('AdminConfig', adminConfigSchema);