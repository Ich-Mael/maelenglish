const express = require('express');
const router = express.Router();
const { Course, Module } = require('../models/courses');
const User = require('../models/user');
const Lesson = require('../models/lesson');
const Institution = require('../models/institution');
const catchAsync = require('../utilities/catchAsync');
const { isLoggedIn, checkRoles } = require('../middlewares/auth');
const ModuleCtrl = require('../controllers/admin/moduleController');

const adminOnly = [isLoggedIn, checkRoles(['admin', 'super-admin'])];

// ─── LIST ─────────────────────────────────────────────────────────────────────

router.get('/', ...adminOnly, catchAsync(async (req, res) => {
    const { search, active } = req.query;
    const query = { source: 'admin' };

    if (search) {
        query.title = { $regex: search, $options: 'i' };
    }
    if (active === 'true')  query.isActive = true;
    if (active === 'false') query.isActive = false;

    const courses = await Course.find(query)
        .select('title level isActive isPrivate students modules price createdAt')
        .sort({ createdAt: -1 });

    res.render('admin/courses/list', { courses, filters: req.query });
}));

// ─── NEW FORM ─────────────────────────────────────────────────────────────────

router.get('/new', ...adminOnly, (req, res) => {
    res.render('admin/courses/new');
});

// ─── CREATE ───────────────────────────────────────────────────────────────────

router.post('/', ...adminOnly, catchAsync(async (req, res) => {
    const { title, description, price, level, requirements, willLearn, syllabusSummary, courseImageUrl, isPrivate } = req.body;

    if (!title || !price) {
        req.flash('error', 'Le titre et le prix sont requis.');
        return res.redirect('/admin/courses/new');
    }

    const course = await Course.create({
        title:          title.trim(),
        description:    description || '',
        price:          parseFloat(price) || 0,
        level:          level || 'beginner',
        requirements:   requirements || '',
        willLearn:      willLearn || '',
        syllabusSummary: syllabusSummary || '',
        courseImageUrl: courseImageUrl || '',
        isPrivate:      isPrivate === 'on' || isPrivate === 'true',
        isActive:       false,
        source:         'admin'
    });

    req.flash('success', `Cours "${course.title}" créé. Ajoutez des modules pour le structurer.`);
    res.redirect(`/admin/courses/${course._id}`);
}));

// ─── SHOW ─────────────────────────────────────────────────────────────────────

router.get('/:id', ...adminOnly, catchAsync(async (req, res) => {
    const course = await Course.findOne({ _id: req.params.id, source: 'admin' })
        .populate('modules', 'title order lessons moduleQuiz moduleAssignment');

    if (!course) {
        req.flash('error', 'Cours introuvable.');
        return res.redirect('/admin/courses');
    }

    // Lesson counts per module
    const modulesWithCounts = await Promise.all((course.modules || []).map(async mod => {
        const lessonCount = await Lesson.countDocuments({ moduleId: mod._id });
        return { module: mod, lessonCount };
    }));

    // Enrolled student count
    const studentCount = course.students ? course.students.length : 0;

    // Institutions this course is assigned to
    const assignedInstitutions = await Institution.find({
        assignedCourses: course._id
    }).select('name isActive');

    res.render('admin/courses/show', {
        course,
        modulesWithCounts,
        studentCount,
        assignedInstitutions
    });
}));

// ─── EDIT FORM ────────────────────────────────────────────────────────────────

router.get('/:id/edit', ...adminOnly, catchAsync(async (req, res) => {
    const course = await Course.findOne({ _id: req.params.id, source: 'admin' });
    if (!course) {
        req.flash('error', 'Cours introuvable.');
        return res.redirect('/admin/courses');
    }
    res.render('admin/courses/edit', { course });
}));

// ─── UPDATE ───────────────────────────────────────────────────────────────────

router.put('/:id', ...adminOnly, catchAsync(async (req, res) => {
    const { title, description, price, level, requirements, willLearn, syllabusSummary, courseImageUrl, isPrivate, isActive } = req.body;

    const course = await Course.findOne({ _id: req.params.id, source: 'admin' });
    if (!course) {
        req.flash('error', 'Cours introuvable.');
        return res.redirect('/admin/courses');
    }

    if (title)            course.title           = title.trim();
    if (description !== undefined) course.description = description;
    if (price)            course.price           = parseFloat(price) || 0;
    if (level)            course.level           = level;
    if (requirements !== undefined) course.requirements = requirements;
    if (willLearn !== undefined)    course.willLearn    = willLearn;
    if (syllabusSummary !== undefined) course.syllabusSummary = syllabusSummary;
    if (courseImageUrl !== undefined) course.courseImageUrl  = courseImageUrl;
    course.isPrivate = isPrivate === 'on' || isPrivate === 'true';
    course.isActive  = isActive  === 'on' || isActive  === 'true';

    await course.save();
    req.flash('success', 'Cours mis à jour.');
    res.redirect(`/admin/courses/${course._id}`);
}));

// ─── TOGGLE ACTIVE ────────────────────────────────────────────────────────────

router.post('/:id/toggle', ...adminOnly, catchAsync(async (req, res) => {
    const course = await Course.findOne({ _id: req.params.id, source: 'admin' });
    if (!course) {
        req.flash('error', 'Cours introuvable.');
        return res.redirect('/admin/courses');
    }
    course.isActive = !course.isActive;
    await course.save();
    req.flash('success', `Cours ${course.isActive ? 'activé' : 'désactivé'}.`);
    res.redirect(`/admin/courses/${course._id}`);
}));

// ─── DELETE ───────────────────────────────────────────────────────────────────

router.delete('/:id', ...adminOnly, catchAsync(async (req, res) => {
    const course = await Course.findOne({ _id: req.params.id, source: 'admin' });
    if (!course) {
        req.flash('error', 'Cours introuvable.');
        return res.redirect('/admin/courses');
    }

    // Safety: refuse delete if students enrolled or assigned to institutions
    if (course.students && course.students.length > 0) {
        req.flash('error', 'Impossible de supprimer un cours avec des étudiants inscrits.');
        return res.redirect(`/admin/courses/${course._id}`);
    }

    // Remove from institution assignments
    await Institution.updateMany(
        { assignedCourses: course._id },
        { $pull: { assignedCourses: course._id } }
    );

    // Delete modules and lessons
    for (const moduleId of (course.modules || [])) {
        await Lesson.deleteMany({ moduleId });
        await Module.findByIdAndDelete(moduleId);
    }

    await Course.findByIdAndDelete(course._id);
    req.flash('success', `Cours "${course.title}" supprimé.`);
    res.redirect('/admin/courses');
}));

// ─── ADD MODULE ───────────────────────────────────────────────────────────────

router.post('/:id/modules', ...adminOnly, catchAsync(async (req, res) => {
    const { title, willLearnModule, order } = req.body;

    const course = await Course.findOne({ _id: req.params.id, source: 'admin' });
    if (!course) {
        req.flash('error', 'Cours introuvable.');
        return res.redirect('/admin/courses');
    }

    if (!title || !willLearnModule) {
        req.flash('error', 'Le titre et l\'objectif du module sont requis.');
        return res.redirect(`/admin/courses/${course._id}`);
    }

    const moduleOrder = parseInt(order) || (course.modules.length + 1);
    const mod = await Module.create({
        title: title.trim(),
        willLearnModule: willLearnModule.trim(),
        order: moduleOrder
    });

    course.modules.push(mod._id);
    await course.save();

    req.flash('success', `Module "${mod.title}" créé.`);
    res.redirect(`/admin/courses/${course._id}/modules/${mod._id}/edit`);
}));

// ─── MODULE REORDER ───────────────────────────────────────────────────────────
router.post('/:courseId/modules/reorder', ...adminOnly, catchAsync(async (req, res) => {
    const orderedIds = (req.body.orderedIds || '').split(',').filter(Boolean);
    await Course.findByIdAndUpdate(req.params.courseId, { modules: orderedIds });
    res.json({ ok: true });
}));

// ─── MODULE EDIT / UPDATE / DELETE ───────────────────────────────────────────
router.get('/:courseId/modules/:moduleId/edit',         ...adminOnly, ModuleCtrl.edit);
router.put('/:courseId/modules/:moduleId',              ...adminOnly, ModuleCtrl.update);
router.delete('/:courseId/modules/:moduleId',           ...adminOnly, ModuleCtrl.destroy);

// ─── LESSON CRUD + REORDER ────────────────────────────────────────────────────
router.post('/:courseId/modules/:moduleId/lessons/reorder', ...adminOnly, ModuleCtrl.reorderLessons);
router.post('/:courseId/modules/:moduleId/lessons',         ...adminOnly, ModuleCtrl.createLesson);
router.put('/:courseId/modules/:moduleId/lessons/:lessonId',...adminOnly, ModuleCtrl.updateLesson);
router.delete('/:courseId/modules/:moduleId/lessons/:lessonId', ...adminOnly, ModuleCtrl.destroyLesson);

// ─── MODULE QUIZ + ASSIGNMENT ─────────────────────────────────────────────────
router.post('/:courseId/modules/:moduleId/quiz',        ...adminOnly, ModuleCtrl.saveQuiz);
router.post('/:courseId/modules/:moduleId/assignment',  ...adminOnly, ModuleCtrl.saveAssignment);

module.exports = router;
