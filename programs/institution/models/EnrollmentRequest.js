const mongoose = require('mongoose');

const enrollmentRequestSchema = new mongoose.Schema(
    {
        courseId:      { type: mongoose.Schema.Types.ObjectId, ref: 'InstitutionCourse',  required: true, index: true },
        institutionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Institution',         required: true, index: true },
        name:    { type: String, required: true, trim: true },
        email:   { type: String, required: true, trim: true, lowercase: true },
        phone:   { type: String, trim: true, default: '' },
        message: { type: String, trim: true, default: '' },
        status: {
            type: String,
            enum: ['pending', 'contacted', 'enrolled', 'rejected'],
            default: 'pending'
        },
        notes: { type: String, trim: true, default: '' }
    },
    { timestamps: true }
);

module.exports = mongoose.model('InstitutionEnrollmentRequest', enrollmentRequestSchema);
