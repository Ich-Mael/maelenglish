const mongoose = require('mongoose');

const institutionFinalExamAttemptSchema = new mongoose.Schema(
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
        answers: [
            {
                questionIndex: Number,
                selectedValue: String
            }
        ],
        score: Number,
        passed: Boolean,
        attemptNumber: {
            type: Number,
            default: 1
        },
        submittedAt: Date
    },
    { timestamps: true }
);

institutionFinalExamAttemptSchema.index({ userId: 1, courseId: 1, attemptNumber: 1 }, { unique: true });

module.exports = mongoose.model('InstitutionFinalExamAttempt', institutionFinalExamAttemptSchema);
