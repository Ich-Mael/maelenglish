const mongoose = require('mongoose');

const institutionEnrollmentSchema = new mongoose.Schema(
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
        startDate: Date,
        endDate: Date,
        status: {
            type: String,
            enum: ['active', 'expired', 'suspended'],
            default: 'active'
        },
        // Why the enrollment was suspended. 'account-deactivated' marks suspensions
        // caused by a soft-deleted user account, so reactivation only restores those
        // and leaves enrollments suspended for other reasons untouched.
        suspendedReason: {
            type: String,
            enum: ['account-deactivated', null],
            default: null
        },
        enrolledBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        }
    },
    { timestamps: true }
);

institutionEnrollmentSchema.index({ userId: 1, courseId: 1 }, { unique: true });

module.exports = mongoose.model('InstitutionEnrollment', institutionEnrollmentSchema);
