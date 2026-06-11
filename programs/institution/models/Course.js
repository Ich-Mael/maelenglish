const mongoose = require('mongoose');

const institutionCourseSchema = new mongoose.Schema(
    {
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
        prerequisites: String,
        objectives: String,
        targetAudience: String,
        imageUrl: String,
        category: {
            type: String,
            enum: [
                'Informatique & Tech',
                'Gestion & Finance',
                'Droit & Fiscalité',
                'Langues',
                'Marketing & Communication',
                'Comptabilité',
                'Ressources Humaines',
                'Développement Personnel',
                'Santé',
                'Agriculture',
                'Autre'
            ],
            default: 'Autre'
        },
        isActive: {
            type: Boolean,
            default: false
        },
        modules: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'InstitutionModule'
            }
        ],
        instructors: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'InstitutionInstructor'
            }
        ],
        finalExam: {
            title: String,
            passingScore: {
                type: Number,
                default: 70
            },
            timeLimit: {
                type: Number,
                default: 0
            },
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
        finalProject: {
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
        },
        pricing: {
            isFree: { type: Boolean, default: false },
            amount: Number,
            currency: { type: String, default: 'FCFA' }
        },
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        }
    },
    { timestamps: true }
);

module.exports = mongoose.model('InstitutionCourse', institutionCourseSchema);
