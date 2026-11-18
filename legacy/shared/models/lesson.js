const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const practiceQuizQuestionSchema = new Schema({
    text:          { type: String, required: true },
    options: [{
        id:    String,
        text:  String,
        value: String
    }],
    correctAnswer: { type: String, required: true },
    explanation:   { type: String, default: '' }
}, { _id: true });

const lessonSchema = new Schema({
    moduleId: {
        type: Schema.Types.ObjectId,
        ref: 'Module',
        required: true,
        index: true
    },

    courseId: {
        type: Schema.Types.ObjectId,
        ref: 'Course',
        required: true,
        index: true
    },

    title: { type: String, required: true, trim: true },

    order: { type: Number, default: 0, index: true },

    isActive: { type: Boolean, default: true },

    type: {
        type: String,
        required: true,
        enum: ['video', 'text', 'pdf', 'practice_quiz']
    },

    description: { type: String, default: '' },

    // ── video ──────────────────────────────────────────────────────────
    videoUrl:      { type: String, default: '' },
    videoDuration: { type: Number, default: 0 }, // minutes

    // ── text ───────────────────────────────────────────────────────────
    content: { type: String, default: '' }, // rich HTML

    // ── pdf ────────────────────────────────────────────────────────────
    fileUrl:  { type: String, default: '' },
    fileName: { type: String, default: '' },

    // ── practice quiz (ungraded) ───────────────────────────────────────
    practiceQuiz: {
        questions: [practiceQuizQuestionSchema]
    }
}, {
    timestamps: true
});

// Ensure unique order per module
lessonSchema.index({ moduleId: 1, order: 1 }, { unique: true, sparse: true });

const Lesson = mongoose.model('Lesson', lessonSchema);

module.exports = Lesson;
