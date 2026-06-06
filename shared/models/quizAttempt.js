const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const quizAttemptSchema = new Schema({
    userId:   { type: Schema.Types.ObjectId, ref: 'User',   required: true },
    courseId: { type: Schema.Types.ObjectId, ref: 'Course', required: true },

    // null when quizType === 'final_exam'
    moduleId: { type: Schema.Types.ObjectId, ref: 'Module', default: null },

    quizType: {
        type: String,
        required: true,
        enum: ['module_quiz', 'final_exam']
    },

    score:         { type: Number, required: true, min: 0, max: 100 },
    passingScore:  { type: Number, required: true, default: 70 },
    passed:        { type: Boolean, required: true },
    answers:       [String],       // submitted answer values, in question order
    attemptNumber: { type: Number, default: 1 }
}, {
    timestamps: true
});

// Index for fast per-student per-module lookup
quizAttemptSchema.index({ userId: 1, courseId: 1, moduleId: 1, quizType: 1 });

// Latest attempt query
quizAttemptSchema.index({ userId: 1, courseId: 1, quizType: 1, createdAt: -1 });

const QuizAttempt = mongoose.model('QuizAttempt', quizAttemptSchema);

module.exports = QuizAttempt;
