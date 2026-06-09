const {
    InstitutionCourse, InstitutionModule, InstitutionLesson,
    InstitutionEnrollment, InstitutionLessonProgress,
    InstitutionQuizAttempt, InstitutionAssignmentSubmission,
    InstitutionFinalExamAttempt, InstitutionFinalProjectSubmission
} = require('../../../programs/institution/models');
const catchAsync = require('../../utilities/catchAsync');

module.exports.index = catchAsync(async (req, res) => {
    const courses = await InstitutionCourse.find({
        institutionId: req.institution._id
    }).select('title isActive createdAt').sort({ title: 1 });

    const courseIds = courses.map(c => c._id);
    const enrollmentCounts = await InstitutionEnrollment.aggregate([
        { $match: { institutionId: req.institution._id, courseId: { $in: courseIds } } },
        { $group: { _id: '$courseId', count: { $sum: 1 } } }
    ]);
    const countMap = Object.fromEntries(enrollmentCounts.map(r => [r._id.toString(), r.count]));

    const coursesWithStats = courses.map(course => ({
        course,
        enrolledCount: countMap[course._id.toString()] || 0
    }));

    res.render('institution-dashboard/courses/index', {
        institution: req.institution,
        coursesWithStats
    });
});

module.exports.show = catchAsync(async (req, res) => {
    const { courseId } = req.params;

    const course = await InstitutionCourse.findOne({
        _id: courseId,
        institutionId: req.institution._id
    }).populate('modules', 'title order');

    if (!course) {
        req.flash('error', 'Cours introuvable.');
        return res.redirect('/institution/dashboard/courses');
    }

    const enrollments = await InstitutionEnrollment.find({ courseId })
        .populate('userId', 'name surname username email devices');

    const userIds = enrollments.map(e => e.userId._id || e.userId);
    const totalLessons = await InstitutionLesson.countDocuments({ courseId, isActive: true });

    const progress = await InstitutionLessonProgress.aggregate([
        { $match: { userId: { $in: userIds }, courseId: course._id } },
        { $group: { _id: '$userId', completed: { $sum: 1 }, lastActivity: { $max: '$completedAt' } } }
    ]);
    const progressByUser = Object.fromEntries(progress.map(r => [r._id.toString(), r]));

    const studentsData = enrollments.map(enrollment => {
        const student = enrollment.userId;
        const uid = (student._id || student).toString();
        const pData = progressByUser[uid] || { completed: 0, lastActivity: null };
        const lastLogin = student.devices && student.devices.length > 0
            ? student.devices.reduce((latest, d) => d.lastLogin > latest ? d.lastLogin : latest, student.devices[0].lastLogin)
            : null;
        return {
            student,
            isEnrolled: true,
            enrollment,
            completedModules: pData.completed,
            totalModules: totalLessons,
            lastActivity: pData.lastActivity,
            lastLogin
        };
    });

    res.render('institution-dashboard/courses/show', {
        institution: req.institution,
        course,
        studentsData
    });
});

module.exports.exportCsv = catchAsync(async (req, res) => {
    const { courseId } = req.params;

    const course = await InstitutionCourse.findOne({
        _id: courseId,
        institutionId: req.institution._id
    });
    if (!course) return res.redirect('/institution/dashboard/courses');

    const [enrollments, modules, lessonCount] = await Promise.all([
        InstitutionEnrollment.find({ courseId }).populate('userId', 'name surname username email devices'),
        InstitutionModule.find({ courseId }).sort({ order: 1 }).select('title order quiz assignment').lean(),
        InstitutionLesson.countDocuments({ courseId, isActive: true })
    ]);

    const userIds = enrollments.map(e => e.userId._id || e.userId);

    const [progressData, quizAttempts, assignmentSubs, finalExams, finalProjects] = await Promise.all([
        InstitutionLessonProgress.aggregate([
            { $match: { userId: { $in: userIds }, courseId: course._id } },
            { $group: { _id: '$userId', completed: { $sum: 1 }, lastActivity: { $max: '$completedAt' } } }
        ]),
        InstitutionQuizAttempt.aggregate([
            { $match: { courseId: course._id, userId: { $in: userIds } } },
            { $sort: { score: -1 } },
            { $group: { _id: { userId: '$userId', moduleId: '$moduleId' }, score: { $first: '$score' } } }
        ]),
        InstitutionAssignmentSubmission.find({ courseId, userId: { $in: userIds } }).lean(),
        InstitutionFinalExamAttempt.aggregate([
            { $match: { courseId: course._id, userId: { $in: userIds } } },
            { $sort: { score: -1 } },
            { $group: { _id: '$userId', score: { $first: '$score' }, passed: { $first: '$passed' } } }
        ]),
        InstitutionFinalProjectSubmission.find({ courseId, userId: { $in: userIds } }).lean()
    ]);

    const progressByUser  = Object.fromEntries(progressData.map(r => [r._id.toString(), r]));
    const finalExamByUser = Object.fromEntries(finalExams.map(e => [e._id.toString(), e]));
    const finalProjByUser = Object.fromEntries(finalProjects.map(p => [p.userId.toString(), p]));

    const quizByUser = {};
    for (const qa of quizAttempts) {
        const uid = qa._id.userId.toString();
        const mid = qa._id.moduleId.toString();
        if (!quizByUser[uid]) quizByUser[uid] = {};
        quizByUser[uid][mid] = qa.score;
    }
    const assignByUser = {};
    for (const a of assignmentSubs) {
        const uid = a.userId.toString();
        const mid = a.moduleId.toString();
        if (!assignByUser[uid]) assignByUser[uid] = {};
        assignByUser[uid][mid] = a;
    }

    const now    = new Date();
    const escape = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const fmtDate = d => d ? new Date(d).toLocaleDateString('fr-FR') : '';

    // Build dynamic module-grade headers (only modules with quiz or assignment)
    const gradedModules = modules.filter(m => m.quiz?.questions?.length || m.assignment?.title);
    const moduleHeaders = gradedModules.flatMap(m => {
        const cols = [];
        if (m.quiz?.questions?.length)  cols.push(`Quiz — ${m.title} (%)`);
        if (m.assignment?.title)        cols.push(`Devoir — ${m.title} (/${m.assignment.maxScore || 100})`);
        return cols;
    });

    const headers = [
        'Nom', 'Prénom', 'Nom utilisateur', 'Email',
        'Date début', 'Date fin', 'Statut accès',
        'Leçons complétées', 'Total leçons', 'Progression (%)',
        ...moduleHeaders,
        'Examen final (%)', 'Examen final réussi',
        `Projet final (/${course.finalProject?.maxScore || 100})`, 'Projet final statut',
        'Dernière activité', 'Dernière connexion'
    ];

    const rows = enrollments.map(enrollment => {
        const student  = enrollment.userId;
        const uid      = (student._id || student).toString();
        const pData    = progressByUser[uid]  || { completed: 0, lastActivity: null };
        const examData = finalExamByUser[uid] || null;
        const projData = finalProjByUser[uid] || null;
        const lastLogin = student.devices?.length
            ? student.devices.reduce((l, d) => d.lastLogin > l ? d.lastLogin : l, student.devices[0].lastLogin)
            : null;
        const endDate     = enrollment.endDate ? new Date(enrollment.endDate) : null;
        const accessStatus = endDate && endDate < now ? 'Expiré'
            : enrollment.status === 'active' ? 'Actif' : enrollment.status;
        const pct = lessonCount > 0 ? Math.round((pData.completed / lessonCount) * 100) : 0;

        const moduleCols = gradedModules.flatMap(m => {
            const mid  = m._id.toString();
            const cols = [];
            if (m.quiz?.questions?.length) {
                const score = quizByUser[uid]?.[mid];
                cols.push(escape(score != null ? score : ''));
            }
            if (m.assignment?.title) {
                const sub = assignByUser[uid]?.[mid];
                cols.push(escape(
                    !sub              ? '' :
                    sub.status === 'graded' ? sub.grade :
                    'En attente'
                ));
            }
            return cols;
        });

        const examScore  = examData ? escape(examData.score) : escape('');
        const examPassed = examData ? escape(examData.passed ? 'Oui' : 'Non') : escape('');
        const projGrade  = !projData ? escape('')
            : projData.status === 'graded' ? escape(projData.grade)
            : escape('En attente');
        const projStatus = !projData ? escape('Non soumis')
            : projData.status === 'graded' ? escape('Noté')
            : escape('En attente');

        return [
            escape(student.surname),
            escape(student.name),
            escape(student.username),
            escape(student.email),
            escape(fmtDate(enrollment.startDate)),
            escape(endDate ? endDate.toLocaleDateString('fr-FR') : ''),
            escape(accessStatus),
            escape(pData.completed),
            escape(lessonCount),
            escape(pct),
            ...moduleCols,
            examScore,
            examPassed,
            projGrade,
            projStatus,
            escape(fmtDate(pData.lastActivity)),
            escape(fmtDate(lastLogin))
        ].join(',');
    });

    const csv      = [headers.map(escape).join(','), ...rows].join('\r\n');
    const filename = `progression_${course.title.replace(/[^a-z0-9]/gi, '_')}_${now.toISOString().split('T')[0]}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send('﻿' + csv);
});
