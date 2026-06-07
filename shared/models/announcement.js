const mongoose = require('mongoose');
const Schema   = mongoose.Schema;

const announcementSchema = new Schema({
    institutionId: { type: Schema.Types.ObjectId, ref: 'Institution', required: true, index: true },
    title:         { type: String, required: true, trim: true },
    body:          { type: String, required: true },
    type: {
        type:    String,
        enum:    ['info', 'discount', 'new_course', 'event', 'reminder'],
        default: 'info'
    },
    isPinned:    { type: Boolean, default: false },
    isPublished: { type: Boolean, default: true },
    createdBy:   { type: Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

module.exports = mongoose.model('Announcement', announcementSchema);
