const { Course, Module } = require('../../models/courses');
const User = require('../../models/user');
const LessonProgress = require('../../models/lessonProgress');
const Lesson = require('../../models/lesson');
const catchAsync = require('../../utilities/catchAsync');

// List assigned courses with enrolled student counts
module.exports.index = catchAsync(async (req, res) => {
    const assignedCourses = req.institution.assignedCourses;

    const courses = await Course.find({
        _id: { $in: assignedCourses }
    }).select('title isActive students modules session').sort({ title: 1 });

    // For each course, count students enrolled in it (any student, not filtered by institution)
    // The course.students array is the source of truth for enrollment
    const coursesWithStats = courses.map(course => ({
        course,
        enrolledCount: (course.students || []).length
    }));

    res.render('institution-dashboard/courses/index', {
        institution: req.institution,
        coursesWithStats
    });
});

// Export course progress as CSV
module.exports.exportCsv = catchAsync(async (req, res) => {
    const { courseId } = req.params;
    const assignedCourses = req.institution.assignedCourses;

    const isAssigned = assignedCourses.some(id => id.toString() === courseId);
    if (!isAssigned) {
        req.flash('error', 'Ce cours n\'est pas assigné à votre institution.');
        return res.redirect('/institution/dashboard/courses');
    }

    const course = await Course.findById(courseId).populate('modules', 'title');
    if (!course) return res.redirect('/institution/dashboard/courses');

    const students = await User.find({
        coursesTaken: courseId,
        role: { $ne: 'institution-admin' }
    }).select('name surname username email specialProgram devices').sort({ surname: 1 });

    const [progress, lessonCount] = await Promise.all([
        LessonProgress.find({ courseId }),
        Lesson.countDocuments({ courseId })
    ]);

    const progressByUser = {};
    progress.forEach(p => {
        const uid = p.userId.toString();
        if (!progressByUser[uid]) progressByUser[uid] = { completed: 0, lastActivity: null };
        if (p.status === 'completed') progressByUser[uid].completed++;
        const ts = p.completedAt || p.updatedAt;
        if (ts && (!progressByUser[uid].lastActivity || ts > progressByUser[uid].lastActivity)) {
            progressByUser[uid].lastActivity = ts;
        }
    });

    const moduleCount = lessonCount;

    // Build CSV rows
    const escape = v => `"${String(v ?? '').replace(/"/g, '""')}"`;

    const headers = [
        'Nom', 'Prénom', 'Nom utilisateur', 'Email',
        'Date début', 'Date fin', 'Statut accès',
        'Leçons complétées', 'Total leçons', 'Progression (%)',
        'Dernière activité', 'Dernière connexion'
    ];

    const now = new Date();
    const rows = students.map(student => {
        const enrollment = (student.specialProgram || []).find(p => p.courseTitle === course.title);
        const pData = progressByUser[student._id.toString()] || { completed: 0, lastActivity: null };
        const completed = pData.completed;
        const pct = moduleCount > 0 ? Math.round((completed / moduleCount) * 100) : 0;
        const lastActivity = pData.lastActivity;
        const lastLogin = student.devices && student.devices.length > 0
            ? student.devices.reduce((l, d) => d.lastLogin > l ? d.lastLogin : l, student.devices[0].lastLogin)
            : null;

        const endDate = enrollment && enrollment.endDate ? new Date(enrollment.endDate) : null;
        const accessStatus = !enrollment ? 'Non inscrit'
            : endDate && endDate < now ? 'Expiré' : 'Actif';

        return [
            escape(student.surname),
            escape(student.name),
            escape(student.username),
            escape(student.email),
            escape(enrollment ? new Date(enrollment.startDate).toLocaleDateString('fr-FR') : ''),
            escape(endDate ? endDate.toLocaleDateString('fr-FR') : ''),
            escape(accessStatus),
            escape(completed),
            escape(moduleCount),
            escape(pct),
            escape(lastActivity ? new Date(lastActivity).toLocaleDateString('fr-FR') : ''),
            escape(lastLogin ? new Date(lastLogin).toLocaleDateString('fr-FR') : '')
        ].join(',');
    });

    const csv = [headers.map(escape).join(','), ...rows].join('\r\n');
    const filename = `progression_${course.title.replace(/[^a-z0-9]/gi, '_')}_${now.toISOString().split('T')[0]}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send('﻿' + csv); // BOM for Excel UTF-8 compatibility
});

// Show one course with all enrolled students and their progress
module.exports.show = catchAsync(async (req, res) => {
    const { courseId } = req.params;
    const assignedCourses = req.institution.assignedCourses;

    // Verify course is assigned to this institution
    const isAssigned = assignedCourses.some(id => id.toString() === courseId);
    if (!isAssigned) {
        req.flash('error', 'Ce cours n\'est pas assigné à votre institution.');
        return res.redirect('/institution/dashboard/courses');
    }

    const course = await Course.findById(courseId).populate('modules', 'title');
    if (!course) {
        req.flash('error', 'Cours introuvable.');
        return res.redirect('/institution/dashboard/courses');
    }

    // Students = all users enrolled in this specific course
    const students = await User.find({
        coursesTaken: courseId,
        role: { $ne: 'institution-admin' }
    }).select('name surname username email specialProgram coursesTaken devices').sort({ surname: 1 });

    const [progress, totalLessons] = await Promise.all([
        LessonProgress.find({ courseId }),
        Lesson.countDocuments({ courseId })
    ]);

    // Build lookup: userId -> { completed, lastActivity }
    const progressByUser = {};
    progress.forEach(p => {
        const uid = p.userId.toString();
        if (!progressByUser[uid]) progressByUser[uid] = { completed: 0, lastActivity: null };
        if (p.status === 'completed') progressByUser[uid].completed++;
        const ts = p.completedAt || p.updatedAt;
        if (ts && (!progressByUser[uid].lastActivity || ts > progressByUser[uid].lastActivity)) {
            progressByUser[uid].lastActivity = ts;
        }
    });

    const studentsData = students.map(student => {
        const isEnrolled = (student.coursesTaken || []).some(id => id.toString() === courseId);
        const enrollment = (student.specialProgram || []).find(p => p.courseTitle === course.title);
        const pData = progressByUser[student._id.toString()] || { completed: 0, lastActivity: null };
        const lastLogin = student.devices && student.devices.length > 0
            ? student.devices.reduce((latest, d) => d.lastLogin > latest ? d.lastLogin : latest, student.devices[0].lastLogin)
            : null;

        return { student, isEnrolled, enrollment, completedModules: pData.completed, totalModules: totalLessons, lastActivity: pData.lastActivity, lastLogin };
    });

    res.render('institution-dashboard/courses/show', {
        institution: req.institution,
        course,
        studentsData
    });
});
