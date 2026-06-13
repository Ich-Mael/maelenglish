const Announcement = require('../models/announcement');
const { InstitutionAssignmentSubmission, InstitutionFinalProjectSubmission } = require('../../programs/institution/models');

const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;

module.exports = async (req, res, next) => {
    try {
        if (!req.institution || !req.user) return next();

        const seenAt = req.session.notifSeenAt
            ? new Date(req.session.notifSeenAt)
            : new Date(Date.now() - THIRTY_DAYS);

        const [newAnnouncements, gradedAssignments, gradedProjects] = await Promise.all([
            Announcement.find({
                institutionId: req.institution._id,
                isPublished: true,
                createdAt: { $gt: seenAt }
            }).sort({ isPinned: -1, createdAt: -1 }).limit(5).lean(),

            InstitutionAssignmentSubmission.countDocuments({
                userId: req.user._id,
                status: 'graded',
                gradedAt: { $gt: seenAt }
            }),

            InstitutionFinalProjectSubmission.countDocuments({
                userId: req.user._id,
                status: 'graded',
                gradedAt: { $gt: seenAt }
            })
        ]);

        const notifGradeCount = gradedAssignments + gradedProjects;

        res.locals.notifAnnouncements = newAnnouncements;
        res.locals.notifGradeCount    = notifGradeCount;
        res.locals.notifCount         = newAnnouncements.length + notifGradeCount;
    } catch (_) {
        // non-fatal — leave notifCount undefined, navbar hides bell
    }
    next();
};
