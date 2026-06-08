const crypto = require('crypto');
const User = require('../../models/user');
const {
    InstitutionCourse,
    InstitutionLesson,
    InstitutionEnrollment,
    InstitutionLessonProgress,
    InstitutionQuizAttempt,
    InstitutionAssignmentSubmission
} = require('../../../programs/institution/models');
const Emailer = require('../../utilities/sendEmail');
const { getBaseUrl } = require('../../utilities/url');
const catchAsync = require('../../utilities/catchAsync');

// List all students with at least one enrollment in this institution
module.exports.index = catchAsync(async (req, res) => {
    const now = new Date();

    const [enrolledUserIds, courses, activeEnrollmentCounts] = await Promise.all([
        InstitutionEnrollment.distinct('userId', { institutionId: req.institution._id }),
        InstitutionCourse.find({ institutionId: req.institution._id }).select('title _id'),
        InstitutionEnrollment.aggregate([
            {
                $match: {
                    institutionId: req.institution._id,
                    status: 'active',
                    $or: [{ endDate: null }, { endDate: { $gte: now } }]
                }
            },
            { $group: { _id: '$userId', count: { $sum: 1 } } }
        ])
    ]);

    const students = await User.find({
        _id: { $in: enrolledUserIds },
        role: { $ne: 'institution-admin' }
    }).select('name surname username email isVerified devices').sort({ surname: 1, name: 1 });

    const activeCountMap = Object.fromEntries(activeEnrollmentCounts.map(r => [r._id.toString(), r.count]));

    const studentsWithMeta = students.map(s => {
        const lastLogin = s.devices && s.devices.length > 0
            ? s.devices.reduce((latest, d) => d.lastLogin > latest ? d.lastLogin : latest, s.devices[0].lastLogin)
            : null;
        return {
            student: s,
            lastLogin,
            activeEnrollmentsCount: activeCountMap[s._id.toString()] || 0
        };
    });

    res.render('institution-dashboard/students/index', {
        institution: req.institution,
        studentsWithMeta,
        assignedCourseDetails: courses
    });
});

// Live search (JSON) — used by the enroll-student UI
module.exports.search = catchAsync(async (req, res) => {
    const q = (req.query.q || '').trim();
    if (q.length < 2) return res.json({ users: [] });

    const [enrolledIds, users] = await Promise.all([
        InstitutionEnrollment.distinct('userId', { institutionId: req.institution._id }),
        User.find({
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
        .sort({ surname: 1, name: 1 })
    ]);

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

// Show one student's progress across this institution's courses
module.exports.show = catchAsync(async (req, res) => {
    const student = await User.findById(req.params.userId);
    if (!student) {
        req.flash('error', 'Étudiant introuvable.');
        return res.redirect('/institution/dashboard/students');
    }

    const courses = await InstitutionCourse.find({
        institutionId: req.institution._id
    }).select('title isActive');

    const courseIds = courses.map(c => c._id);

    const [lessonProgress, lessonCounts, passedQuizzes, pendingAssignments, enrollments] = await Promise.all([
        InstitutionLessonProgress.find({ userId: student._id, courseId: { $in: courseIds } }),
        InstitutionLesson.aggregate([
            { $match: { courseId: { $in: courseIds }, isActive: true } },
            { $group: { _id: '$courseId', count: { $sum: 1 } } }
        ]),
        InstitutionQuizAttempt.aggregate([
            { $match: { userId: student._id, courseId: { $in: courseIds }, passed: true } },
            { $group: { _id: '$courseId', count: { $sum: 1 } } }
        ]),
        InstitutionAssignmentSubmission.aggregate([
            { $match: { userId: student._id, courseId: { $in: courseIds }, status: 'submitted' } },
            { $group: { _id: '$courseId', count: { $sum: 1 } } }
        ]),
        InstitutionEnrollment.find({ userId: student._id, institutionId: req.institution._id })
    ]);

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
    const enrollmentByCourse = Object.fromEntries(enrollments.map(e => [e.courseId.toString(), e]));

    const enrollmentStatus = courses.map(course => {
        const cid       = course._id.toString();
        const enrollment = enrollmentByCourse[cid];
        const completed  = completedByCourse[cid] || 0;
        const total      = totalByCourse[cid]      || 0;
        return {
            course,
            isEnrolled: !!enrollment,
            enrollment,
            completedModules:   completed,
            totalModules:       total,
            passedQuizzes:      passedQuizMap[cid]    || 0,
            pendingAssignments: pendingAssignMap[cid]  || 0,
            lastActivity:       lastActivityByCourse[cid] || null,
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

// Enroll a student in one of this institution's courses
module.exports.enroll = catchAsync(async (req, res) => {
    const { courseId, startDate, endDate } = req.body;
    const { userId } = req.params;

    const [course, student] = await Promise.all([
        InstitutionCourse.findOne({ _id: courseId, institutionId: req.institution._id }),
        User.findById(userId)
    ]);

    if (!course) {
        req.flash('error', 'Ce cours n\'est pas disponible dans votre institution.');
        return res.redirect(`/institution/dashboard/students/${userId}`);
    }
    if (!student) {
        req.flash('error', 'Étudiant introuvable.');
        return res.redirect('/institution/dashboard/students');
    }

    const existing = await InstitutionEnrollment.findOne({ userId, courseId });
    if (existing) {
        req.flash('error', `${student.name} est déjà inscrit(e) à "${course.title}".`);
        return res.redirect(`/institution/dashboard/students/${userId}`);
    }

    const start = startDate ? new Date(startDate) : new Date();
    const end   = endDate   ? new Date(endDate)   : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    await InstitutionEnrollment.create({
        userId,
        courseId,
        institutionId: req.institution._id,
        startDate: start,
        endDate: end,
        status: 'active',
        enrolledBy: req.user._id
    });

    // Link student to institution if not already
    if (!student.institutionId) {
        student.institutionId = req.institution._id;
        await student.save();
    }

    const loginUrl = `${getBaseUrl(req)}/login`;
    new Emailer(student).sendEnrollmentEmail(course.title, start, end, loginUrl)
        .catch(err => console.error('Enrollment email error:', err));

    req.flash('success', `${student.name} ${student.surname} inscrit(e) à "${course.title}".`);
    res.redirect(`/institution/dashboard/students/${userId}`);
});

// Bulk enroll multiple students in a course
module.exports.enrollBulk = catchAsync(async (req, res) => {
    const { courseId, startDate, endDate, studentIds } = req.body;

    const course = await InstitutionCourse.findOne({ _id: courseId, institutionId: req.institution._id });
    if (!course) {
        req.flash('error', 'Ce cours n\'est pas disponible dans votre institution.');
        return res.redirect('/institution/dashboard/students');
    }

    const ids = Array.isArray(studentIds) ? studentIds : studentIds ? [studentIds] : [];
    if (ids.length === 0) {
        req.flash('error', 'Sélectionnez au moins un étudiant.');
        return res.redirect('/institution/dashboard/students');
    }

    const start = startDate ? new Date(startDate) : new Date();
    const end   = endDate   ? new Date(endDate)   : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    let enrolled = 0;
    let skipped  = 0;

    for (const userId of ids) {
        const student = await User.findById(userId);
        if (!student) { skipped++; continue; }

        const existing = await InstitutionEnrollment.findOne({ userId, courseId });
        if (existing) { skipped++; continue; }

        await InstitutionEnrollment.create({
            userId,
            courseId,
            institutionId: req.institution._id,
            startDate: start,
            endDate: end,
            status: 'active',
            enrolledBy: req.user._id
        });

        if (!student.institutionId) {
            student.institutionId = req.institution._id;
            await student.save();
        }

        const loginUrl = `${getBaseUrl(req)}/login`;
        new Emailer(student).sendEnrollmentEmail(course.title, start, end, loginUrl)
            .catch(err => console.error('Bulk enrollment email error:', err));

        enrolled++;
    }

    req.flash('success', `${enrolled} étudiant(s) inscrit(s) à "${course.title}"${skipped > 0 ? ` (${skipped} déjà inscrit(s) ou introuvable(s))` : ''}.`);
    res.redirect('/institution/dashboard/students');
});

// Unenroll a student from a course
module.exports.unenroll = catchAsync(async (req, res) => {
    const { userId, courseId } = req.params;

    const [course, student] = await Promise.all([
        InstitutionCourse.findOne({ _id: courseId, institutionId: req.institution._id }),
        User.findById(userId)
    ]);

    if (!course) {
        req.flash('error', 'Ce cours n\'est pas disponible dans votre institution.');
        return res.redirect('/institution/dashboard/students');
    }
    if (!student) {
        req.flash('error', 'Étudiant introuvable.');
        return res.redirect('/institution/dashboard/students');
    }

    await InstitutionEnrollment.findOneAndDelete({ userId, courseId });

    req.flash('success', `${student.name} ${student.surname} désinscrit(e) de "${course.title}".`);
    res.redirect(`/institution/dashboard/students/${userId}`);
});

// Update enrollment dates for an already-enrolled student
module.exports.updateEnrollment = catchAsync(async (req, res) => {
    const { userId, courseId } = req.params;
    const { startDate, endDate } = req.body;

    const course = await InstitutionCourse.findOne({ _id: courseId, institutionId: req.institution._id });
    if (!course) {
        req.flash('error', 'Ce cours n\'est pas disponible dans votre institution.');
        return res.redirect(`/institution/dashboard/students/${userId}`);
    }

    const enrollment = await InstitutionEnrollment.findOne({ userId, courseId });
    if (!enrollment) {
        req.flash('error', 'Cet étudiant n\'est pas inscrit à ce cours.');
        return res.redirect(`/institution/dashboard/students/${userId}`);
    }

    if (startDate) enrollment.startDate = new Date(startDate);
    if (endDate)   enrollment.endDate   = new Date(endDate);
    await enrollment.save();

    req.flash('success', 'Dates d\'accès mises à jour.');
    res.redirect(`/institution/dashboard/students/${userId}`);
});

// Resend activation email to unverified student
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

    const activationToken   = crypto.randomBytes(32).toString('hex');
    const activationExpires = Date.now() + 48 * 60 * 60 * 1000;

    const charset   = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#';
    let newPassword = '';
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
