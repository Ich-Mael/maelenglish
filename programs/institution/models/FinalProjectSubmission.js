const mongoose = require('mongoose');

const institutionFinalProjectSubmissionSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true
        },
        courseId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'InstitutionCourse',
            required: true,
            index: true
        },
        institutionId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Institution',
            required: true,
            index: true
        },
        submissionType: {
            type: String,
            enum: ['text', 'link']
        },
        content: String,
        grade: Number,
        feedback: String,
        status: {
            type: String,
            enum: ['submitted', 'graded'],
            default: 'submitted'
        },
        submittedAt: Date
    },
    { timestamps: true }
);

institutionFinalProjectSubmissionSchema.index({ userId: 1, courseId: 1 }, { unique: true });

module.exports = mongoose.model('InstitutionFinalProjectSubmission', institutionFinalProjectSubmissionSchema);
