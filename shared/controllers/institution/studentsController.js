const User = require('../../models/user');
const { Course } = require('../../models/courses');
const StudentProgress = require('../../models/studentProgress');
const catchAsync = require('../../utilities/catchAsync');

// List all institution students
module.exports.index = catchAsync(async (req, res) => {
    const institutionId = req.institution._id;

    const students = await User.find({
        institutionId,
        role: { $ne: 'institution-admin' }
    }).select('name surname username email isVerified specialProgram coursesTaken devices').sort({ surname: 1, name: 1 });

    // Attach last login from devices
    const studentsWithMeta = students.map(s => {
        const lastLogin = s.devices && s.devices.length > 0
            ? s.devices.reduce((latest, d) => d.lastLogin > latest ? d.lastLogin : latest, s.devices[0].lastLogin)
            : null;
        const activeEnrollments = (s.specialProgram || []).filter(p => p.endDate && new Date(p.endDate) >= new Date());
        return { student: s, lastLogin, activeEnrollmentsCount: activeEnrollments.length };
    });

    res.render('institution-dashboard/students/index', {
        institution: req.institution,
        studentsWithMeta
    });
});

// Show one student's full progress
module.exports.show = catchAsync(async (req, res) => {
    const student = await User.findOne({
        _id: req.params.userId,
        institutionId: req.institution._id
    }).populate('coursesTaken');

    if (!student) {
        req.flash('error', 'Étudiant introuvable ou n\'appartient pas à votre institution.');
        return res.redirect('/institution/dashboard/students');
    }

    // Get assigned courses for this institution to show enrollment options
    const assignedCourses = await Course.find({
        _id: { $in: req.institution.assignedCourses }
    }).select('title isActive modules');

    // Get module progress for this student across institution courses
    const assignedCourseIds = req.institution.assignedCourses.map(id => id.toString());
    const progress = await StudentProgress.find({
        userId: student._id,
        courseId: { $in: req.institution.assignedCourses }
    }).populate('moduleId', 'title').populate('courseId', 'title');

    // Build progress map: courseId -> [moduleProgress]
    const progressByCourse = {};
    progress.forEach(p => {
        const cid = p.courseId._id.toString();
        if (!progressByCourse[cid]) progressByCourse[cid] = [];
        progressByCourse[cid].push(p);
    });

    // Get grades for this student
    const { Grade } = require('../../models/courses');
    // grades are not directly linked to institution, so we skip complex grade aggregation here
    // and just show enrollment status per course

    // Build enrollment status per assigned course
    const enrollmentStatus = assignedCourses.map(course => {
        const enrollment = (student.specialProgram || []).find(p => p.courseTitle === course.title);
        const isEnrolled = (student.coursesTaken || []).some(id => id._id
            ? id._id.toString() === course._id.toString()
            : id.toString() === course._id.toString()
        );
        const modules = progressByCourse[course._id.toString()] || [];
        const completedModules = modules.filter(m => m.status === 'completed').length;

        return {
            course,
            isEnrolled,
            enrollment,
            completedModules,
            totalModules: course.modules ? course.modules.length : 0,
            lastViewedAt: modules.length > 0
                ? modules.reduce((latest, m) => m.lastViewedAt > latest ? m.lastViewedAt : latest, modules[0].lastViewedAt)
                : null
        };
    });

    const lastLogin = student.devices && student.devices.length > 0
        ? student.devices.reduce((latest, d) => d.lastLogin > latest ? d.lastLogin : latest, student.devices[0].lastLogin)
        : null;

    res.render('institution-dashboard/students/show', {
        institution: req.institution,
        student,
        enrollmentStatus,
        lastLogin
    });
});

// Enroll student in a course
module.exports.enroll = catchAsync(async (req, res) => {
    const { courseId, startDate, endDate } = req.body;
    const { userId } = req.params;

    // Verify student belongs to this institution
    const student = await User.findOne({ _id: userId, institutionId: req.institution._id });
    if (!student) {
        req.flash('error', 'Étudiant introuvable.');
        return res.redirect('/institution/dashboard/students');
    }

    // Verify course is assigned to this institution
    const isAssigned = req.institution.assignedCourses.some(id => id.toString() === courseId);
    if (!isAssigned) {
        req.flash('error', 'Ce cours n\'est pas assigné à votre institution.');
        return res.redirect(`/institution/dashboard/students/${userId}`);
    }

    const course = await Course.findById(courseId);
    if (!course) {
        req.flash('error', 'Cours introuvable.');
        return res.redirect(`/institution/dashboard/students/${userId}`);
    }

    // Check if already enrolled
    if ((student.coursesTaken || []).some(id => id.toString() === courseId)) {
        req.flash('error', `${student.name} est déjà inscrit(e) à "${course.title}".`);
        return res.redirect(`/institution/dashboard/students/${userId}`);
    }

    // Enroll: mirrors addStudentToCourse logic
    course.students.push(student._id);
    await course.save();

    if (!student.coursesTaken) student.coursesTaken = [];
    student.coursesTaken.push(course._id);

    if (!student.specialProgram) student.specialProgram = [];
    student.specialProgram.push({
        courseTitle: course.title,
        startDate: startDate ? new Date(startDate) : new Date(),
        endDate: endDate ? new Date(endDate) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    });

    await student.save();

    req.flash('success', `${student.name} ${student.surname} inscrit(e) à "${course.title}".`);
    res.redirect(`/institution/dashboard/students/${userId}`);
});

// Unenroll student from a course
module.exports.unenroll = catchAsync(async (req, res) => {
    const { userId, courseId } = req.params;

    const student = await User.findOne({ _id: userId, institutionId: req.institution._id });
    if (!student) {
        req.flash('error', 'Étudiant introuvable.');
        return res.redirect('/institution/dashboard/students');
    }

    const course = await Course.findById(courseId);
    if (!course) {
        req.flash('error', 'Cours introuvable.');
        return res.redirect(`/institution/dashboard/students/${userId}`);
    }

    // Remove from course.students
    course.students = course.students.filter(id => id.toString() !== userId);
    await course.save();

    // Remove from user.coursesTaken
    student.coursesTaken = (student.coursesTaken || []).filter(id => id.toString() !== courseId);

    // Remove from specialProgram by matching title
    student.specialProgram = (student.specialProgram || []).filter(p => p.courseTitle !== course.title);

    await student.save();

    req.flash('success', `${student.name} ${student.surname} désinscrit(e) de "${course.title}".`);
    res.redirect(`/institution/dashboard/students/${userId}`);
});
