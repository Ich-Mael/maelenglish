const crypto = require('crypto');
const User = require('../../models/user');
const { Course } = require('../../models/courses');
const LessonProgress = require('../../models/lessonProgress');
const Lesson = require('../../models/lesson');
const QuizAttempt = require('../../models/quizAttempt');
const AssignmentSubmission = require('../../models/assignmentSubmission');
const Emailer = require('../../utilities/sendEmail');
const { getBaseUrl } = require('../../utilities/url');
const catchAsync = require('../../utilities/catchAsync');

// List all students enrolled in at least one of this institution's assigned courses
module.exports.index = catchAsync(async (req, res) => {
    const assignedCourses = req.institution.assignedCourses;

    const [students, assignedCourseDetails] = await Promise.all([
        User.find({
            coursesTaken: { $in: assignedCourses },
            role: { $ne: 'institution-admin' }
        }).select('name surname username email isVerified specialProgram coursesTaken devices').sort({ surname: 1, name: 1 }),
        Course.find({ _id: { $in: assignedCourses } }).select('title _id')
    ]);

    const studentsWithMeta = students.map(s => {
        const lastLogin = s.devices && s.devices.length > 0
            ? s.devices.reduce((latest, d) => d.lastLogin > latest ? d.lastLogin : latest, s.devices[0].lastLogin)
            : null;
        const activeEnrollments = (s.specialProgram || []).filter(p =>
            p.endDate && new Date(p.endDate) >= new Date()
        );
        return { student: s, lastLogin, activeEnrollmentsCount: activeEnrollments.length };
    });

    res.render('institution-dashboard/students/index', {
        institution: req.institution,
        studentsWithMeta,
        assignedCourseDetails
    });
});

// Search any AfrohK user by name / username / email (JSON API for live search)
module.exports.search = catchAsync(async (req, res) => {
    const q = (req.query.q || '').trim();

    if (q.length < 2) return res.json({ users: [] });

    const assignedCourses = req.institution.assignedCourses;

    // Already enrolled: users who have taken at least one institution course
    const enrolledIds = await User.find({
        coursesTaken: { $in: assignedCourses }
    }).distinct('_id');

    const users = await User.find({
        $or: [
            { username: { $regex: q, $options: 'i' } },
            { name:     { $regex: q, $options: 'i' } },
            { surname:  { $regex: q, $options: 'i' } },
            { email:    { $regex: q, $options: 'i' } }
        ],
        role: { $nin: ['admin', 'super-admin', 'institution-admin'] }
    })
    .select('username name surname email isVerified')
    .limit(10)
    .sort({ surname: 1, name: 1 });

    const enrolledSet = new Set(enrolledIds.map(id => id.toString()));

    res.json({
        users: users.map(u => ({
            _id:        u._id,
            username:   u.username,
            name:       u.name,
            surname:    u.surname,
            email:      u.email,
            isVerified: u.isVerified,
            enrolled:   enrolledSet.has(u._id.toString())
        }))
    });
});

// Show one student's progress across this institution's assigned courses
module.exports.show = catchAsync(async (req, res) => {
    const assignedCourses = req.institution.assignedCourses;

    const student = await User.findById(req.params.userId).populate('coursesTaken');

    if (!student) {
        req.flash('error', 'Étudiant introuvable.');
        return res.redirect('/institution/dashboard/students');
    }

    const courses = await Course.find({
        _id: { $in: assignedCourses }
    }).select('title isActive modules');

    const courseObjectIds = courses.map(c => c._id);

    const [lessonProgress, lessonCounts, passedQuizzes, pendingAssignments] = await Promise.all([
        LessonProgress.find({ userId: student._id, courseId: { $in: courseObjectIds }, status: 'completed' }),
        Lesson.aggregate([
            { $match: { courseId: { $in: courseObjectIds }, isActive: true } },
            { $group: { _id: '$courseId', count: { $sum: 1 } } }
        ]),
        QuizAttempt.aggregate([
            { $match: { userId: student._id, courseId: { $in: courseObjectIds }, passed: true, quizType: 'module_quiz' } },
            { $group: { _id: '$courseId', count: { $sum: 1 } } }
        ]),
        AssignmentSubmission.aggregate([
            { $match: { userId: student._id, courseId: { $in: courseObjectIds }, status: 'pending' } },
            { $group: { _id: '$courseId', count: { $sum: 1 } } }
        ])
    ]);

    // Build per-course lookup maps
    const completedByCourse = {};
    const lastActivityByCourse = {};
    lessonProgress.forEach(p => {
        const cid = p.courseId.toString();
        completedByCourse[cid] = (completedByCourse[cid] || 0) + 1;
        const ts = p.completedAt || p.updatedAt;
        if (ts && (!lastActivityByCourse[cid] || ts > lastActivityByCourse[cid])) {
            lastActivityByCourse[cid] = ts;
        }
    });
    const totalByCourse    = Object.fromEntries(lessonCounts.map(r => [r._id.toString(), r.count]));
    const passedQuizMap    = Object.fromEntries(passedQuizzes.map(r => [r._id.toString(), r.count]));
    const pendingAssignMap = Object.fromEntries(pendingAssignments.map(r => [r._id.toString(), r.count]));

    const enrollmentStatus = courses.map(course => {
        const cid        = course._id.toString();
        const enrollment = (student.specialProgram || []).find(p => p.courseTitle === course.title);
        const isEnrolled = (student.coursesTaken || []).some(id => {
            const idStr = id._id ? id._id.toString() : id.toString();
            return idStr === cid;
        });
        const completed = completedByCourse[cid] || 0;
        const total     = totalByCourse[cid]     || 0;

        return {
            course,
            isEnrolled,
            enrollment,
            completedModules:    completed,
            totalModules:        total,
            passedQuizzes:       passedQuizMap[cid]    || 0,
            pendingAssignments:  pendingAssignMap[cid] || 0,
            lastActivity:        lastActivityByCourse[cid] || null,
            pct: total > 0 ? Math.round((completed / total) * 100) : 0
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
    const loginUrl = `${getBaseUrl(req)}/login`;
    new Emailer(student).sendEnrollmentEmail(course.title, enrollment.startDate, enrollment.endDate, loginUrl)
      .catch(err => console.error('Enrollment email error:', err));

    req.flash('success', `${student.name} ${student.surname} inscrit(e) à "${course.title}".`);
    res.redirect(`/institution/dashboard/students/${userId}`);
});

// Bulk enroll multiple students in a course
module.exports.enrollBulk = catchAsync(async (req, res) => {
    const { courseId, startDate, endDate, studentIds } = req.body;

    // Verify course is assigned to this institution
    const isAssigned = req.institution.assignedCourses.some(id => id.toString() === courseId);
    if (!isAssigned) {
        req.flash('error', 'Ce cours n\'est pas assigné à votre institution.');
        return res.redirect('/institution/dashboard/students');
    }

    const ids = Array.isArray(studentIds) ? studentIds : studentIds ? [studentIds] : [];
    if (ids.length === 0) {
        req.flash('error', 'Sélectionnez au moins un étudiant.');
        return res.redirect('/institution/dashboard/students');
    }

    const course = await Course.findById(courseId);
    if (!course) {
        req.flash('error', 'Cours introuvable.');
        return res.redirect('/institution/dashboard/students');
    }

    const start = startDate ? new Date(startDate) : new Date();
    const end = endDate ? new Date(endDate) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    let enrolled = 0;
    let skipped = 0;

    for (const userId of ids) {
        const student = await User.findById(userId);
        if (!student) { skipped++; continue; }

        // Skip already enrolled
        if ((student.coursesTaken || []).some(id => id.toString() === courseId)) {
            skipped++;
            continue;
        }

        course.students.push(student._id);
        if (!student.coursesTaken) student.coursesTaken = [];
        student.coursesTaken.push(course._id);
        if (!student.specialProgram) student.specialProgram = [];
        student.specialProgram.push({ courseTitle: course.title, startDate: start, endDate: end });
        await student.save();

        // Fire-and-forget enrollment email
        const loginUrl = `${getBaseUrl(req)}/login`;
        new Emailer(student).sendEnrollmentEmail(course.title, start, end, loginUrl)
            .catch(err => console.error('Bulk enrollment email error:', err));

        enrolled++;
    }

    await course.save();

    req.flash('success', `${enrolled} étudiant(s) inscrit(s) à "${course.title}"${skipped > 0 ? ` (${skipped} déjà inscrit(s) ou introuvable(s))` : ''}.`);
    res.redirect('/institution/dashboard/students');
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

// Resend activation email with a fresh token and new temporary password
module.exports.resendActivation = catchAsync(async (req, res) => {
    const student = await User.findById(req.params.userId);

    if (!student) {
        req.flash('error', 'Étudiant introuvable.');
        return res.redirect('/institution/dashboard/students');
    }

    if (student.isVerified) {
        req.flash('error', 'Ce compte est déjà activé.');
        return res.redirect(`/institution/dashboard/students/${req.params.userId}`);
    }

    // Generate fresh token (48h) and new temporary password
    const activationToken   = crypto.randomBytes(32).toString('hex');
    const activationExpires = Date.now() + 48 * 60 * 60 * 1000;

    const charset     = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#';
    let newPassword   = '';
    for (let i = 0; i < 10; i++) newPassword += charset.charAt(Math.floor(Math.random() * charset.length));
    newPassword += 'A1a';

    student.activationToken   = activationToken;
    student.activationExpires = activationExpires;
    await student.setPassword(newPassword);
    await student.save();

    try {
        const activationUrl = `${getBaseUrl(req)}/user/activate/${activationToken}`;
        await new Emailer(student, activationUrl).sendActivationEmail(newPassword);
        req.flash('success', `Email d'activation renvoyé à ${student.email}.`);
    } catch (err) {
        console.error('Resend activation email error:', err);
        req.flash('warning', `Email non envoyé. Nouveau mot de passe temporaire : ${newPassword}`);
    }

    res.redirect(`/institution/dashboard/students/${req.params.userId}`);
});
