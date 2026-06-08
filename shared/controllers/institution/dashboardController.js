const { InstitutionCourse, InstitutionEnrollment } = require('../../../programs/institution/models');
const catchAsync = require('../../utilities/catchAsync');

module.exports.home = catchAsync(async (req, res) => {
    const now = new Date();

    const [courseCount, studentIds, activeEnrollments] = await Promise.all([
        InstitutionCourse.countDocuments({ institutionId: req.institution._id }),
        InstitutionEnrollment.distinct('userId', { institutionId: req.institution._id }),
        InstitutionEnrollment.countDocuments({
            institutionId: req.institution._id,
            status: 'active',
            $or: [{ endDate: null }, { endDate: { $gte: now } }]
        })
    ]);

    res.render('institution-dashboard/home', {
        institution: req.institution,
        stats: {
            studentCount: studentIds.length,
            courseCount,
            activeEnrollments
        }
    });
});
