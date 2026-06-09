const mongoose = require('mongoose');

const institutionLessonSchema = new mongoose.Schema(
    {
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
        title: {
            type: String,
            required: true
        },
        type: {
            type: String,
            enum: ['video', 'text', 'pdf', 'practice_quiz'],
            required: true
        },
        description: String,
        order: Number,
        isActive: {
            type: Boolean,
            default: true
        },
        videoUrl: String,
        videoDuration: Number,
        content: String,
        fileUrl: String,
        fileName: String,
        practiceQuiz: {
            questions: [
                {
                    text: String,
                    options: [
                        {
                            text: String,
                            value: String
                        }
                    ],
                    correctAnswer: String,
                    explanation: String
                }
            ]
        },
        instructorId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'InstitutionInstructor'
        }
    },
    { timestamps: true }
);

module.exports = mongoose.model('InstitutionLesson', institutionLessonSchema);
