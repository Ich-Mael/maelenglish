const { InstitutionCourse, InstitutionLesson, InstitutionEnrollment, InstitutionLessonProgress } = require('../../../programs/institution/models');
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

    const enrollments = await InstitutionEnrollment.find({ courseId })
        .populate('userId', 'name surname username email devices');

    const userIds = enrollments.map(e => e.userId._id || e.userId);
    const lessonCount = await InstitutionLesson.countDocuments({ courseId, isActive: true });

    const progress = await InstitutionLessonProgress.aggregate([
        { $match: { userId: { $in: userIds }, courseId: course._id } },
        { $group: { _id: '$userId', completed: { $sum: 1 }, lastActivity: { $max: '$completedAt' } } }
    ]);
    const progressByUser = Object.fromEntries(progress.map(r => [r._id.toString(), r]));

    const now = new Date();
    const escape = v => `"${String(v ?? '').replace(/"/g, '""')}"`;

    const headers = [
        'Nom', 'Prénom', 'Nom utilisateur', 'Email',
        'Date début', 'Date fin', 'Statut accès',
        'Leçons complétées', 'Total leçons', 'Progression (%)',
        'Dernière activité', 'Dernière connexion'
    ];

    const rows = enrollments.map(enrollment => {
        const student = enrollment.userId;
        const uid = (student._id || student).toString();
        const pData = progressByUser[uid] || { completed: 0, lastActivity: null };
        const lastLogin = student.devices && student.devices.length > 0
            ? student.devices.reduce((l, d) => d.lastLogin > l ? d.lastLogin : l, student.devices[0].lastLogin)
            : null;
        const endDate = enrollment.endDate ? new Date(enrollment.endDate) : null;
        const accessStatus = endDate && endDate < now ? 'Expiré'
            : enrollment.status === 'active' ? 'Actif' : enrollment.status;
        const pct = lessonCount > 0 ? Math.round((pData.completed / lessonCount) * 100) : 0;

        return [
            escape(student.surname),
            escape(student.name),
            escape(student.username),
            escape(student.email),
            escape(enrollment.startDate ? new Date(enrollment.startDate).toLocaleDateString('fr-FR') : ''),
            escape(endDate ? endDate.toLocaleDateString('fr-FR') : ''),
            escape(accessStatus),
            escape(pData.completed),
            escape(lessonCount),
            escape(pct),
            escape(pData.lastActivity ? new Date(pData.lastActivity).toLocaleDateString('fr-FR') : ''),
            escape(lastLogin ? new Date(lastLogin).toLocaleDateString('fr-FR') : '')
        ].join(',');
    });

    const csv = [headers.map(escape).join(','), ...rows].join('\r\n');
    const filename = `progression_${course.title.replace(/[^a-z0-9]/gi, '_')}_${now.toISOString().split('T')[0]}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send('﻿' + csv);
});
