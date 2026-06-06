const User = require('../../models/user');
const { Course } = require('../../models/courses');
const StudentProgress = require('../../models/studentProgress');
const catchAsync = require('../../utilities/catchAsync');

module.exports.home = catchAsync(async (req, res) => {
    const assignedCourses = req.institution.assignedCourses;

    // Fetch assigned course titles for specialProgram matching
    const courses = await Course.find({ _id: { $in: assignedCourses } }).select('title');
    const assignedTitles = courses.map(c => c.title);

    const [studentCount, activeEnrollments] = await Promise.all([
        // Students = users enrolled in at least one of this institution's courses
        User.countDocuments({
            coursesTaken: { $in: assignedCourses }
        }),
        // Active enrollments = users with a non-expired specialProgram entry for one of this institution's courses
        User.countDocuments({
            coursesTaken: { $in: assignedCourses },
            specialProgram: {
                $elemMatch: {
                    courseTitle: { $in: assignedTitles },
                    endDate: { $gte: new Date() }
                }
            }
        })
    ]);

    res.render('institution-dashboard/home', {
        institution: req.institution,
        stats: {
            studentCount,
            courseCount: assignedCourses.length,
            activeEnrollments
        }
    });
});
