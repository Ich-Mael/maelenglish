const { Course, Module } = require('../../models/courses');
const User = require('../../models/user');
const StudentProgress = require('../../models/studentProgress');
const catchAsync = require('../../utilities/catchAsync');

// List assigned courses
module.exports.index = catchAsync(async (req, res) => {
    const courses = await Course.find({
        _id: { $in: req.institution.assignedCourses }
    }).select('title isActive students modules session').sort({ title: 1 });

    // For each course, count how many institution students are enrolled
    const institutionStudentIds = await User.find({
        institutionId: req.institution._id,
        role: { $ne: 'institution-admin' }
    }).distinct('_id');

    const coursesWithStats = courses.map(course => {
        const enrolledCount = (course.students || []).filter(sid =>
            institutionStudentIds.some(iid => iid.toString() === sid.toString())
        ).length;
        return { course, enrolledCount };
    });

    res.render('institution-dashboard/courses/index', {
        institution: req.institution,
        coursesWithStats
    });
});

// Show one course with all institution students and their progress
module.exports.show = catchAsync(async (req, res) => {
    const { courseId } = req.params;

    // Verify course is assigned
    const isAssigned = req.institution.assignedCourses.some(id => id.toString() === courseId);
    if (!isAssigned) {
        req.flash('error', 'Ce cours n\'est pas assigné à votre institution.');
        return res.redirect('/institution/dashboard/courses');
    }

    const course = await Course.findById(courseId).populate('modules', 'title');
    if (!course) {
        req.flash('error', 'Cours introuvable.');
        return res.redirect('/institution/dashboard/courses');
    }

    // Get all institution students
    const students = await User.find({
        institutionId: req.institution._id,
        role: { $ne: 'institution-admin' }
    }).select('name surname username email specialProgram coursesTaken devices').sort({ surname: 1 });

    // Get progress for all institution students in this course
    const progress = await StudentProgress.find({
        courseId,
        institutionId: req.institution._id
    }).populate('moduleId', 'title');

    // Build progress lookup: userId -> [moduleProgress]
    const progressByUser = {};
    progress.forEach(p => {
        const uid = p.userId.toString();
        if (!progressByUser[uid]) progressByUser[uid] = [];
        progressByUser[uid].push(p);
    });

    const studentsData = students.map(student => {
        const isEnrolled = (student.coursesTaken || []).some(id => id.toString() === courseId);
        const enrollment = (student.specialProgram || []).find(p => p.courseTitle === course.title);
        const modules = progressByUser[student._id.toString()] || [];
        const completedModules = modules.filter(m => m.status === 'completed').length;
        const lastActivity = modules.length > 0
            ? modules.reduce((latest, m) => m.lastViewedAt > latest ? m.lastViewedAt : latest, modules[0].lastViewedAt)
            : null;
        const lastLogin = student.devices && student.devices.length > 0
            ? student.devices.reduce((latest, d) => d.lastLogin > latest ? d.lastLogin : latest, student.devices[0].lastLogin)
            : null;

        return { student, isEnrolled, enrollment, completedModules, totalModules: course.modules.length, lastActivity, lastLogin };
    });

    res.render('institution-dashboard/courses/show', {
        institution: req.institution,
        course,
        studentsData
    });
});
