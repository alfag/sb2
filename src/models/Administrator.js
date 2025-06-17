const mongoose = require('mongoose');

const administratorSchema = new mongoose.Schema({
    administratorName: { type: String, required: true },
    administratorPermission: { type: String, required: true }
}, { timestamps: true });

module.exports = mongoose.model('Administrator', administratorSchema);