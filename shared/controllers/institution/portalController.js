const { Course }   = require('../../models/courses');
const Lesson        = require('../../models/lesson');
const LessonProgress = require('../../models/lessonProgress');
const Announcement  = require('../../models/announcement');
const catchAsync    = require('../../utilities/catchAsync');

// GET /institution/:institutionId/portal
module.exports.show = catchAsync(async (req, res) => {
    const institution  = req.institution; // set by loadPortalInstitution
    const assignedIds  = (institution.assignedCourses || []).map(id => id.toString());
    const enrolledIds  = (req.user.coursesTaken || []).map(id => (id._id || id).toString());
    const intersection = assignedIds.filter(id => enrolledIds.includes(id));

    // Courses + progress
    const courses = await Course.find({ _id: { $in: intersection } })
        .select('title isActive courseImageUrl modules category');

    const courseObjectIds = courses.map(c => c._id);

    const [progressData, lessonCounts, announcements] = await Promise.all([
        LessonProgress.aggregate([
            { $match: { userId: req.user._id, courseId: { $in: courseObjectIds }, status: 'completed' } },
            { $group: { _id: '$courseId', count: { $sum: 1 } } }
        ]),
        Lesson.aggregate([
            { $match: { courseId: { $in: courseObjectIds }, isActive: true } },
            { $group: { _id: '$courseId', count: { $sum: 1 } } }
        ]),
        Announcement.find({ institutionId: institution._id, isPublished: true })
            .sort({ isPinned: -1, createdAt: -1 })
            .limit(10)
    ]);

    const completedMap = Object.fromEntries(progressData.map(r => [r._id.toString(), r.count]));
    const totalMap     = Object.fromEntries(lessonCounts.map(r => [r._id.toString(), r.count]));

    const coursesWithProgress = courses.map(course => {
        const cid        = course._id.toString();
        const completed  = completedMap[cid] || 0;
        const total      = totalMap[cid]     || 0;
        const enrollment = (req.user.specialProgram || []).find(p => p.courseTitle === course.title);
        return {
            course,
            completed,
            total,
            pct: total > 0 ? Math.round((completed / total) * 100) : 0,
            enrollment
        };
    });

    res.render('institution-dashboard/portal', {
        institution,
        coursesWithProgress,
        announcements
    });
});
