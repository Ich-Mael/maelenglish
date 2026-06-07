const mongoose = require('mongoose');

const institutionModuleSchema = new mongoose.Schema(
    {
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
        description: String,
        order: {
            type: Number,
            default: 1
        },
        lessons: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'InstitutionLesson'
            }
        ],
        quiz: {
            title: String,
            passingScore: Number,
            timeLimit: Number,
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
        assignment: {
            title: String,
            instructions: String,
            submissionType: {
                type: String,
                enum: ['text', 'link']
            },
            maxScore: {
                type: Number,
                default: 100
            },
            dueDate: Date
        }
    },
    { timestamps: true }
);

module.exports = mongoose.model('InstitutionModule', institutionModuleSchema);
