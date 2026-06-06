const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const lessonProgressSchema = new Schema({
    userId:   { type: Schema.Types.ObjectId, ref: 'User',   required: true },
    courseId: { type: Schema.Types.ObjectId, ref: 'Course', required: true },
    moduleId: { type: Schema.Types.ObjectId, ref: 'Module', required: true },
    lessonId: { type: Schema.Types.ObjectId, ref: 'Lesson', required: true },

    status: {
        type: String,
        enum: ['not_started', 'completed'],
        default: 'not_started'
    },

    completedAt: { type: Date, default: null },

    // For practice quiz attempts (ungraded — just for self-feedback)
    practiceScore: { type: Number, default: null }
}, {
    timestamps: true
});

// One record per student per lesson
lessonProgressSchema.index({ userId: 1, lessonId: 1 }, { unique: true });

// Fast lookups for course-level progress
lessonProgressSchema.index({ userId: 1, courseId: 1 });
lessonProgressSchema.index({ userId: 1, moduleId: 1 });

const LessonProgress = mongoose.model('LessonProgress', lessonProgressSchema);

module.exports = LessonProgress;
