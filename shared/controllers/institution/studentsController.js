const User = require('../../models/user');
const { Course } = require('../../models/courses');
const StudentProgress = require('../../models/studentProgress');
const Emailer = require('../../utilities/sendEmail');
const catchAsync = require('../../utilities/catchAsync');

// List all students enrolled in at least one of this institution's assigned courses
module.exports.index = catchAsync(async (req, res) => {
    const assignedCourses = req.institution.assignedCourses;

    const students = await User.find({
        coursesTaken: { $in: assignedCourses },
        role: { $ne: 'institution-admin' }
    }).select('name surname username email isVerified specialProgram coursesTaken devices').sort({ surname: 1, name: 1 });

    const studentsWithMeta = students.map(s => {
        const lastLogin = s.devices && s.devices.length > 0
            ? s.devices.reduce((latest, d) => d.lastLogin > latest ? d.lastLogin : latest, s.devices[0].lastLogin)
            : null;
        // Count active enrollments only for this institution's courses
        const activeEnrollments = (s.specialProgram || []).filter(p =>
            p.endDate && new Date(p.endDate) >= new Date()
        );
        return { student: s, lastLogin, activeEnrollmentsCount: activeEnrollments.length };
    });

    res.render('institution-dashboard/students/index', {
        institution: req.institution,
        studentsWithMeta
    });
});

// Show one student's progress across this institution's assigned courses
module.exports.show = catchAsync(async (req, res) => {
    const assignedCourses = req.institution.assignedCourses;

    // Student must be enrolled in at least one of this institution's courses
    const student = await User.findOne({
        _id: req.params.userId,
        coursesTaken: { $in: assignedCourses }
    }).populate('coursesTaken');

    if (!student) {
        req.flash('error', 'Étudiant introuvable ou non inscrit à vos cours.');
        return res.redirect('/institution/dashboard/students');
    }

    const courses = await Course.find({
        _id: { $in: assignedCourses }
    }).select('title isActive modules');

    // Progress scoped to this institution's courses only
    const progress = await StudentProgress.find({
        userId: student._id,
        courseId: { $in: assignedCourses }
    }).populate('moduleId', 'title').populate('courseId', 'title');

    const progressByCourse = {};
    progress.forEach(p => {
        const cid = p.courseId._id.toString();
        if (!progressByCourse[cid]) progressByCourse[cid] = [];
        progressByCourse[cid].push(p);
    });

    const enrollmentStatus = courses.map(course => {
        const enrollment = (student.specialProgram || []).find(p => p.courseTitle === course.title);
        const isEnrolled = (student.coursesTaken || []).some(id => {
            const idStr = id._id ? id._id.toString() : id.toString();
            return idStr === course._id.toString();
        });
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

// Enroll a student in one of this institution's assigned courses
module.exports.enroll = catchAsync(async (req, res) => {
    const { courseId, startDate, endDate } = req.body;
    const { userId } = req.params;

    // Verify course is assigned to this institution
    const isAssigned = req.institution.assignedCourses.some(id => id.toString() === courseId);
    if (!isAssigned) {
        req.flash('error', 'Ce cours n\'est pas assigné à votre institution.');
        return res.redirect(`/institution/dashboard/students/${userId}`);
    }

    const [student, course] = await Promise.all([
        User.findById(userId),
        Course.findById(courseId)
    ]);

    if (!student) {
        req.flash('error', 'Étudiant introuvable.');
        return res.redirect('/institution/dashboard/students');
    }
    if (!course) {
        req.flash('error', 'Cours introuvable.');
        return res.redirect(`/institution/dashboard/students/${userId}`);
    }

    if ((student.coursesTaken || []).some(id => id.toString() === courseId)) {
        req.flash('error', `${student.name} est déjà inscrit(e) à "${course.title}".`);
        return res.redirect(`/institution/dashboard/students/${userId}`);
    }

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

    // Send enrollment notification (fire-and-forget)
    const enrollment = student.specialProgram[student.specialProgram.length - 1];
    const loginUrl = `${req.protocol}://${req.get('host')}/login`;
    new Emailer(student).sendEnrollmentEmail(course.title, enrollment.startDate, enrollment.endDate, loginUrl)
      .catch(err => console.error('Enrollment email error:', err));

    req.flash('success', `${student.name} ${student.surname} inscrit(e) à "${course.title}".`);
    res.redirect(`/institution/dashboard/students/${userId}`);
});

// Unenroll a student from one of this institution's assigned courses
module.exports.unenroll = catchAsync(async (req, res) => {
    const { userId, courseId } = req.params;

    // Verify course is assigned to this institution (prevents cross-institution unenrollment)
    const isAssigned = req.institution.assignedCourses.some(id => id.toString() === courseId);
    if (!isAssigned) {
        req.flash('error', 'Ce cours n\'est pas assigné à votre institution.');
        return res.redirect('/institution/dashboard/students');
    }

    const [student, course] = await Promise.all([
        User.findById(userId),
        Course.findById(courseId)
    ]);

    if (!student) {
        req.flash('error', 'Étudiant introuvable.');
        return res.redirect('/institution/dashboard/students');
    }
    if (!course) {
        req.flash('error', 'Cours introuvable.');
        return res.redirect(`/institution/dashboard/students/${userId}`);
    }

    course.students = course.students.filter(id => id.toString() !== userId);
    await course.save();

    student.coursesTaken = (student.coursesTaken || []).filter(id => id.toString() !== courseId);
    student.specialProgram = (student.specialProgram || []).filter(p => p.courseTitle !== course.title);
    await student.save();

    req.flash('success', `${student.name} ${student.surname} désinscrit(e) de "${course.title}".`);
    res.redirect(`/institution/dashboard/students/${userId}`);
});
