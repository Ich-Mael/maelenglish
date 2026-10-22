const crypto = require('crypto');
const User = require('../../models/user');
const {
    InstitutionCourse,
    InstitutionModule,
    InstitutionLesson,
    InstitutionEnrollment,
    InstitutionLessonProgress,
    InstitutionQuizAttempt,
    InstitutionAssignmentSubmission,
    InstitutionFinalExamAttempt,
    InstitutionFinalProjectSubmission
} = require('../../../programs/institution/models');
const Emailer = require('../../utilities/sendEmail');
const notify = require('../../utilities/notify');
const { normalizePhone, looksLikePhone } = require('../../utilities/phone');
const { getBaseUrl } = require('../../utilities/url');
const catchAsync = require('../../utilities/catchAsync');

// List all students with at least one enrollment in this institution
module.exports.index = catchAsync(async (req, res) => {
    const now = new Date();
    const filterCourseId = req.query.courseId || null;

    const courses = await InstitutionCourse.find({ institutionId: req.institution._id })
        .select('title _id').sort({ title: 1 }).lean();
    const courseIds = courses.map(c => c._id);
    const courseMap = Object.fromEntries(courses.map(c => [c._id.toString(), c.title]));

    // userId set: scoped to one course when filter active, otherwise all
    const enrollmentFilter = { institutionId: req.institution._id };
    if (filterCourseId) enrollmentFilter.courseId = filterCourseId;

    const [filteredUserIds, allEnrollments, activeEnrollmentCounts] = await Promise.all([
        InstitutionEnrollment.distinct('userId', enrollmentFilter),
        // All enrollments across all courses (for badges + tab counts)
        InstitutionEnrollment.find({ institutionId: req.institution._id, courseId: { $in: courseIds } })
            .select('userId courseId endDate').lean(),
        InstitutionEnrollment.aggregate([
            { $match: {
                institutionId: req.institution._id,
                courseId: { $in: courseIds },
                $or: [{ endDate: null }, { endDate: { $gte: now } }]
            }},
            { $group: { _id: '$userId', count: { $sum: 1 } } }
        ])
    ]);

    const students = await User.find({
        _id: { $in: filteredUserIds },
        role: { $ne: 'institution-admin' }
    }).select('name surname username email isVerified devices').sort({ surname: 1, name: 1 });

    // Per-student course badges & per-course student counts for tab labels
    const enrollmentsByUser = {};
    const courseCountMap = {};
    for (const e of allEnrollments) {
        const uid = e.userId.toString();
        const cid = e.courseId.toString();
        if (!enrollmentsByUser[uid]) enrollmentsByUser[uid] = [];
        enrollmentsByUser[uid].push({
            courseId: cid,
            title: courseMap[cid] || '?',
            expired: !!(e.endDate && new Date(e.endDate) < now)
        });
        courseCountMap[cid] = (courseCountMap[cid] || 0) + 1;
    }

    const activeCountMap = Object.fromEntries(activeEnrollmentCounts.map(r => [r._id.toString(), r.count]));

    const studentsWithMeta = students.map(s => {
        const uid = s._id.toString();
        const lastLogin = s.devices && s.devices.length > 0
            ? s.devices.reduce((latest, d) => d.lastLogin > latest ? d.lastLogin : latest, s.devices[0].lastLogin)
            : null;
        return {
            student: s,
            lastLogin,
            activeEnrollmentsCount: activeCountMap[uid] || 0,
            courseBadges: enrollmentsByUser[uid] || []
        };
    });

    res.render('institution-dashboard/students/index', {
        institution: req.institution,
        studentsWithMeta,
        assignedCourseDetails: courses,
        filterCourseId,
        courseCountMap
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
                { email:    { $regex: q, $options: 'i' } },
                ...(looksLikePhone(q) && normalizePhone(q) ? [{ phoneE164: normalizePhone(q) }] : [])
            ],
            role: { $nin: ['admin', 'super-admin', 'institution-admin'] }
        })
        .select('username name surname email phoneNumber isVerified')
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
            phoneNumber: u.phoneNumber,
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

    const enrollments = await InstitutionEnrollment.find({
        userId: student._id,
        institutionId: req.institution._id
    }).lean();

    const lastLogin = student.devices && student.devices.length > 0
        ? student.devices.reduce((latest, d) => d.lastLogin > latest ? d.lastLogin : latest, student.devices[0].lastLogin)
        : null;

    if (enrollments.length === 0) {
        return res.render('institution-dashboard/students/show', {
            institution: req.institution,
            student,
            courseData: [],
            lastLogin
        });
    }

    const enrolledCourseIds = enrollments.map(e => e.courseId);
    const enrollmentByCourse = Object.fromEntries(enrollments.map(e => [e.courseId.toString(), e]));

    const [courses, modules, allLessons, progressRecords, quizAttempts,
           assignmentSubs, finalExamAttempts, finalProjectSubs] = await Promise.all([
        InstitutionCourse.find({ _id: { $in: enrolledCourseIds } })
            .select('title isActive finalExam finalProject').lean(),
        InstitutionModule.find({ courseId: { $in: enrolledCourseIds } })
            .select('title order quiz assignment courseId').sort({ courseId: 1, order: 1 }).lean(),
        InstitutionLesson.find({ courseId: { $in: enrolledCourseIds }, isActive: true })
            .select('_id moduleId courseId').lean(),
        InstitutionLessonProgress.find({ userId: student._id, courseId: { $in: enrolledCourseIds } })
            .select('lessonId courseId completedAt').lean(),
        InstitutionQuizAttempt.aggregate([
            { $match: { userId: student._id, courseId: { $in: enrolledCourseIds } } },
            { $sort: { score: -1 } },
            { $group: { _id: '$moduleId', score: { $first: '$score' }, passed: { $first: '$passed' } } }
        ]),
        InstitutionAssignmentSubmission.find({
            userId: student._id, courseId: { $in: enrolledCourseIds }
        }).lean(),
        InstitutionFinalExamAttempt.aggregate([
            { $match: { userId: student._id, courseId: { $in: enrolledCourseIds } } },
            { $sort: { score: -1 } },
            { $group: { _id: '$courseId', score: { $first: '$score' }, passed: { $first: '$passed' } } }
        ]),
        InstitutionFinalProjectSubmission.find({
            userId: student._id, courseId: { $in: enrolledCourseIds }
        }).lean()
    ]);

    const completedLessonIds = new Set(progressRecords.map(p => p.lessonId.toString()));
    const quizByModule       = Object.fromEntries(quizAttempts.map(r => [r._id.toString(), r]));
    const assignByModule     = Object.fromEntries(assignmentSubs.map(a => [a.moduleId.toString(), a]));
    const finalExamByCourse  = Object.fromEntries(finalExamAttempts.map(r => [r._id.toString(), r]));
    const finalProjByCourse  = Object.fromEntries(finalProjectSubs.map(p => [p.courseId.toString(), p]));

    // Group lessons by moduleId
    const lessonsByModule = {};
    for (const l of allLessons) {
        const mid = l.moduleId.toString();
        if (!lessonsByModule[mid]) lessonsByModule[mid] = [];
        lessonsByModule[mid].push(l._id.toString());
    }

    // Group modules by courseId
    const modulesByCourse = {};
    for (const m of modules) {
        const cid = m.courseId.toString();
        if (!modulesByCourse[cid]) modulesByCourse[cid] = [];
        modulesByCourse[cid].push(m);
    }

    // Last activity per course
    const lastActivityByCourse = {};
    for (const p of progressRecords) {
        const cid = p.courseId.toString();
        const ts  = p.completedAt || p.updatedAt;
        if (ts && (!lastActivityByCourse[cid] || ts > lastActivityByCourse[cid])) {
            lastActivityByCourse[cid] = ts;
        }
    }

    const now = new Date();
    const courseData = courses.map(course => {
        const cid        = course._id.toString();
        const enrollment = enrollmentByCourse[cid];
        const isExpired  = !!(enrollment.endDate && new Date(enrollment.endDate) < now);

        const courseModules = (modulesByCourse[cid] || []).map(m => {
            const mid        = m._id.toString();
            const lessonIds  = lessonsByModule[mid] || [];
            const total      = lessonIds.length;
            const completed  = lessonIds.filter(lid => completedLessonIds.has(lid)).length;
            return {
                module:    m,
                total,
                completed,
                pct:       total > 0 ? Math.round((completed / total) * 100) : null,
                quiz:      quizByModule[mid]   || null,
                assign:    assignByModule[mid] || null
            };
        });

        const totalLessons     = courseModules.reduce((s, m) => s + m.total, 0);
        const completedLessons = courseModules.reduce((s, m) => s + m.completed, 0);

        return {
            course,
            enrollment,
            isExpired,
            courseModules,
            totalLessons,
            completedLessons,
            overallPct:   totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0,
            lastActivity: lastActivityByCourse[cid] || null,
            finalExam:    finalExamByCourse[cid]    || null,
            finalProject: finalProjByCourse[cid]    || null
        };
    });

    res.render('institution-dashboard/students/show', {
        institution: req.institution,
        student,
        courseData,
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
    notify.sendEnrollment(student, { courseTitle: course.title, start, end, loginUrl });

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
        notify.sendEnrollment(student, { courseTitle: course.title, start, end, loginUrl });

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

// Create a brand-new student account and optionally enroll them
module.exports.createStudent = catchAsync(async (req, res) => {
    const { name, surname, email, phoneNumber: rawPhone, username: rawUsername, courseId, startDate, endDate } = req.body;

    const normalizedEmail = (email || '').trim().toLowerCase() || undefined;
    const phoneNumber = (rawPhone || '').trim() || undefined;
    if (!name || !surname || (!normalizedEmail && !phoneNumber)) {
        req.flash('error', 'Prénom, nom et un email ou un numéro WhatsApp sont requis.');
        return res.redirect('/institution/dashboard/students');
    }
    if (phoneNumber && !normalizePhone(phoneNumber)) {
        req.flash('error', 'Numéro WhatsApp invalide (ex. 70 12 34 56 ou +226 70 12 34 56).');
        return res.redirect('/institution/dashboard/students');
    }

    // Derive username: provided > email prefix > name.surname, then ensure uniqueness
    const slug = (v) => String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9._-]/g, '');
    let baseUsername = rawUsername
        ? rawUsername.trim().toLowerCase().replace(/[^a-z0-9._-]/g, '')
        : normalizedEmail ? normalizedEmail.split('@')[0].replace(/[^a-z0-9._-]/g, '') : [slug(name), slug(surname)].filter(Boolean).join('.');
    if (!baseUsername) baseUsername = 'etudiant';

    let username = baseUsername;
    let attempt  = 0;
    while (await User.findOne({ username })) {
        attempt++;
        username = `${baseUsername}${attempt}`;
    }

    const emailExists = normalizedEmail ? await User.findOne({ email: normalizedEmail }) : null;
    if (emailExists) {
        req.flash('error', `Un compte avec l'email ${normalizedEmail} existe déjà. Utilisez la recherche pour l'inscrire.`);
        return res.redirect('/institution/dashboard/students');
    }

    // Generate temporary password
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#';
    let tempPassword = '';
    for (let i = 0; i < 10; i++) tempPassword += charset.charAt(Math.floor(Math.random() * charset.length));
    tempPassword += 'A1a';

    const activationToken   = crypto.randomBytes(32).toString('hex');
    const activationExpires = Date.now() + 72 * 60 * 60 * 1000;

    const student = new User({
        name:              name.trim(),
        surname:           surname.trim(),
        email:             normalizedEmail,
        phoneNumber,
        username,
        gender:            'other',
        role:              'user',
        institutionId:     req.institution._id,
        isVerified:        false,
        activationToken,
        activationExpires
    });
    notify.prepareActivation(student); // WhatsApp → the student chooses the password at activation
    await User.register(student, tempPassword);

    // Optional immediate enrollment
    if (courseId) {
        const course = await InstitutionCourse.findOne({ _id: courseId, institutionId: req.institution._id });
        if (course) {
            const start = startDate ? new Date(startDate) : new Date();
            const end   = endDate   ? new Date(endDate)   : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
            await InstitutionEnrollment.create({
                userId:        student._id,
                courseId,
                institutionId: req.institution._id,
                startDate:     start,
                endDate:       end,
                status:        'active',
                enrolledBy:    req.user._id
            });
        }
    }

    const activationUrl = `${getBaseUrl(req)}/user/activate/${activationToken}`;
    try {
        const result = await notify.sendActivation(student, { activationUrl, activationToken, password: tempPassword });
        const [type, msg] = notify.activationFlash(result, student, { password: tempPassword, activationUrl });
        req.flash(type, msg);
    } catch (err) {
        console.error('Create student activation error:', err);
        req.flash('warning', student.passwordSetRequired
            ? `Compte créé pour ${student.name} ${student.surname} (@${username}). Message WhatsApp non envoyé — lien d'activation à transmettre : ${activationUrl}`
            : `Compte créé pour ${student.name} ${student.surname} (@${username}). Email non envoyé — mot de passe temporaire : ${tempPassword}`);
    }

    res.redirect(`/institution/dashboard/students/${student._id}`);
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
    notify.prepareActivation(student);
    await student.setPassword(newPassword);
    await student.save();

    const activationUrl = `${getBaseUrl(req)}/user/activate/${activationToken}`;
    try {
        const result = await notify.sendActivation(student, { activationUrl, activationToken, password: newPassword });
        if (result.channel === 'whatsapp' && result.simulated) req.flash('warning', `WhatsApp n'est pas encore configuré : transmettez ce lien d'activation : ${activationUrl}`);
        else if (result.channel === 'whatsapp') req.flash('success', `Lien d'activation renvoyé sur WhatsApp au ${result.to}.`);
        else if (result.channel === 'email') req.flash('success', `Email d'activation renvoyé à ${result.to}.`);
        else req.flash('warning', `Aucun moyen de contact. Nouveau mot de passe temporaire : ${newPassword}`);
    } catch (err) {
        console.error('Resend activation error:', err);
        req.flash('warning', student.passwordSetRequired ? `Message non envoyé. Lien d'activation à transmettre : ${activationUrl}` : `Email non envoyé. Nouveau mot de passe temporaire : ${newPassword}`);
    }

    res.redirect(`/institution/dashboard/students/${req.params.userId}`);
});
