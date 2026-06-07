const mongoose = require('mongoose');

const institutionLessonProgressSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true
        },
        lessonId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'InstitutionLesson',
            required: true,
            index: true
        },
        courseId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'InstitutionCourse',
            required: true,
            index: true
        },
        completedAt: Date
    },
    { timestamps: true }
);

institutionLessonProgressSchema.index({ userId: 1, lessonId: 1 }, { unique: true });

module.exports = mongoose.model('InstitutionLessonProgress', institutionLessonProgressSchema);
