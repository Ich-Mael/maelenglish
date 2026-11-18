const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const studentProgressSchema = new Schema({
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },

    courseId: {
        type: Schema.Types.ObjectId,
        ref: 'Course',
        required: true
    },

    moduleId: {
        type: Schema.Types.ObjectId,
        ref: 'Module',
        required: true
    },

    // Denormalized for fast institution-scoped queries
    institutionId: {
        type: Schema.Types.ObjectId,
        ref: 'Institution',
        default: null
    },

    status: {
        type: String,
        enum: ['not_started', 'in_progress', 'completed'],
        default: 'in_progress'
    },

    lastViewedAt: {
        type: Date,
        default: Date.now
    },

    completedAt: {
        type: Date,
        default: null
    }
}, {
    timestamps: true
});

// Unique constraint: one progress record per student per module
studentProgressSchema.index({ userId: 1, courseId: 1, moduleId: 1 }, { unique: true });

// Fast lookup for institution dashboard queries
studentProgressSchema.index({ institutionId: 1, courseId: 1 });
studentProgressSchema.index({ institutionId: 1, userId: 1 });

const StudentProgress = mongoose.model('StudentProgress', studentProgressSchema);

module.exports = StudentProgress;
