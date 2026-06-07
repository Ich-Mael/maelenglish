const mongoose = require('mongoose');

const institutionQuizAttemptSchema = new mongoose.Schema(
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

module.exports = mongoose.model('InstitutionQuizAttempt', institutionQuizAttemptSchema);
