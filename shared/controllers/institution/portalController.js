const { InstitutionCourse, InstitutionLesson, InstitutionLessonProgress, InstitutionEnrollment } = require('../../../programs/institution/models');
const Announcement = require('../../models/announcement');
const catchAsync   = require('../../utilities/catchAsync');

module.exports.show = catchAsync(async (req, res) => {
    const institution = req.institution;

    const enrollments = await InstitutionEnrollment.find({
        userId: req.user._id,
        institutionId: institution._id
    }).select('courseId startDate endDate status');

    const courseIds = enrollments.map(e => e.courseId);
    const courses = await InstitutionCourse.find({
        _id: { $in: courseIds },
        isActive: true
    }).select('title imageUrl');

    const courseObjectIds = courses.map(c => c._id);

    const [progressData, lessonCounts, announcements] = await Promise.all([
        InstitutionLessonProgress.aggregate([
            { $match: { userId: req.user._id, courseId: { $in: courseObjectIds } } },
            { $group: { _id: '$courseId', count: { $sum: 1 } } }
        ]),
        InstitutionLesson.aggregate([
            { $match: { courseId: { $in: courseObjectIds }, isActive: true } },
            { $group: { _id: '$courseId', count: { $sum: 1 } } }
        ]),
        Announcement.find({ institutionId: institution._id, isPublished: true })
            .sort({ isPinned: -1, createdAt: -1 })
            .limit(10)
    ]);

    const completedMap = Object.fromEntries(progressData.map(r => [r._id.toString(), r.count]));
    const totalMap     = Object.fromEntries(lessonCounts.map(r => [r._id.toString(), r.count]));
    const enrollmentByCourse = Object.fromEntries(enrollments.map(e => [e.courseId.toString(), e]));

    const coursesWithProgress = courses.map(course => {
        const cid       = course._id.toString();
        const completed = completedMap[cid] || 0;
        const total     = totalMap[cid]     || 0;
        return {
            course,
            completed,
            total,
            pct:        total > 0 ? Math.round((completed / total) * 100) : 0,
            enrollment: enrollmentByCourse[cid]
        };
    });

    res.render('institution-dashboard/portal', {
        institution,
        coursesWithProgress,
        announcements
    });
});
