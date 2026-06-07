const mongoose = require('mongoose');

const institutionAssignmentSubmissionSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true
        },
        moduleId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'InstitutionModule',
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

module.exports = mongoose.model('InstitutionAssignmentSubmission', institutionAssignmentSubmissionSchema);
