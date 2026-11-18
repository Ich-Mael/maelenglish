const mongoose = require('mongoose');
const Schema   = mongoose.Schema;

const visitorMessageSchema = new Schema({
    name:    { type: String, required: true, trim: true },
    email:   { type: String, required: true, trim: true, lowercase: true },
    message: { type: String, required: true },
    isRead:  { type: Boolean, default: false, index: true }
}, { timestamps: true });

module.exports = mongoose.model('VisitorMessage', visitorMessageSchema);
