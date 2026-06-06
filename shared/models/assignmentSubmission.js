const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const assignmentSubmissionSchema = new Schema({
    userId:   { type: Schema.Types.ObjectId, ref: 'User',   required: true },
    courseId: { type: Schema.Types.ObjectId, ref: 'Course', required: true },

    // null when assignmentType === 'final_project'
    moduleId: { type: Schema.Types.ObjectId, ref: 'Module', default: null },

    assignmentType: {
        type: String,
        required: true,
        enum: ['module_assignment', 'final_project']
    },

    submissionType: {
        type: String,
        required: true,
        enum: ['text', 'link']
    },

    content: { type: String, required: true }, // text response or URL

    status: {
        type: String,
        enum: ['pending', 'graded', 'returned'],
        default: 'pending'
    },

    // Grading (filled by instructor)
    grade:    { type: Number, default: null },
    maxScore: { type: Number, default: 100 },
    feedback: { type: String, default: '' },
    gradedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    gradedAt: { type: Date, default: null }
}, {
    timestamps: true
});

// One submission per student per assignment (upsert on resubmit)
assignmentSubmissionSchema.index(
    { userId: 1, courseId: 1, moduleId: 1, assignmentType: 1 },
    { unique: true }
);

// For instructor grading queue
assignmentSubmissionSchema.index({ courseId: 1, status: 1 });

const AssignmentSubmission = mongoose.model('AssignmentSubmission', assignmentSubmissionSchema);

module.exports = AssignmentSubmission;
