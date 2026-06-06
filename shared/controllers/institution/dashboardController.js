const User = require('../../models/user');
const { Course } = require('../../models/courses');
const StudentProgress = require('../../models/studentProgress');
const catchAsync = require('../../utilities/catchAsync');

module.exports.home = catchAsync(async (req, res) => {
    const institutionId = req.institution._id;

    const [studentCount, courseCount, activeEnrollments] = await Promise.all([
        User.countDocuments({ institutionId, role: { $ne: 'institution-admin' } }),
        Promise.resolve(req.institution.assignedCourses.length),
        // Count users who have at least one specialProgram entry that is still active
        User.countDocuments({
            institutionId,
            'specialProgram.endDate': { $gte: new Date() }
        })
    ]);

    res.render('institution-dashboard/home', {
        institution: req.institution,
        stats: { studentCount, courseCount, activeEnrollments }
    });
});
