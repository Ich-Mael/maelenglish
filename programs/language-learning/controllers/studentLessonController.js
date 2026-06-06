const { Course, Module } = require('../../../shared/models/courses');
const Lesson = require('../../../shared/models/lesson');
const LessonProgress = require('../../../shared/models/lessonProgress');
const QuizAttempt = require('../../../shared/models/quizAttempt');
const AssignmentSubmission = require('../../../shared/models/assignmentSubmission');
const catchAsync = require('../../../shared/utilities/catchAsync');

// ─── HELPERS ──────────────────────────────────────────────────────────────────

async function getModuleProgress(userId, moduleId, lessons) {
    if (!lessons || lessons.length === 0) return { completedLessonIds: new Set(), allLessonsDone: true };

    const records = await LessonProgress.find({
        userId,
        moduleId,
        status: 'completed'
    }).select('lessonId');

    const completedLessonIds = new Set(records.map(r => r.lessonId.toString()));
    const allLessonsDone = lessons.every(l => completedLessonIds.has(l._id.toString()));

    return { completedLessonIds, allLessonsDone };
}

// A lesson is unlocked if it's the first, or the previous lesson is completed
function isLessonUnlocked(lesson, lessons, completedLessonIds) {
    const sorted = [...lessons].sort((a, b) => a.order - b.order);
    const idx = sorted.findIndex(l => l._id.toString() === lesson._id.toString());
    if (idx === 0) return true;
    return completedLessonIds.has(sorted[idx - 1]._id.toString());
}

// ─── MODULE OVERVIEW ──────────────────────────────────────────────────────────
// Replaces / enhances the existing showModule for the new lesson-based structure

module.exports.showModuleOverview = catchAsync(async (req, res) => {
    const { course_id, module_id } = req.params;

    const [course, courseModule, lessons] = await Promise.all([
        Course.findById(course_id).populate('modules', 'title order'),
        Module.findById(module_id),
        Lesson.find({ moduleId: module_id, isActive: true }).sort({ order: 1 })
    ]);

    if (!courseModule) {
        req.flash('error', 'Module introuvable.');
        return res.redirect(`/programs/language-learning/general-english-boost/${course_id}`);
    }

    const { completedLessonIds, allLessonsDone } = await getModuleProgress(req.user._id, module_id, lessons);

    // Get latest quiz attempt for this module
    const quizAttempt = await QuizAttempt.findOne({
        userId: req.user._id,
        courseId: course_id,
        moduleId: module_id,
        quizType: 'module_quiz'
    }).sort({ createdAt: -1 });

    // Get assignment submission
    const assignmentSubmission = await AssignmentSubmission.findOne({
        userId: req.user._id,
        courseId: course_id,
        moduleId: module_id,
        assignmentType: 'module_assignment'
    });

    const lessonsWithStatus = lessons.map(l => ({
        lesson: l,
        completed: completedLessonIds.has(l._id.toString()),
        unlocked: isLessonUnlocked(l, lessons, completedLessonIds)
    }));

    res.render('programs/language-learning/courses/course_modules/moduleOverview', {
        course,
        courseModule,
        lessonsWithStatus,
        allLessonsDone,
        quizAttempt,
        assignmentSubmission
    });
});

// ─── LESSON SHOW ──────────────────────────────────────────────────────────────

module.exports.showLesson = catchAsync(async (req, res) => {
    const { course_id, module_id, lesson_id } = req.params;

    const [course, courseModule, lesson, lessons] = await Promise.all([
        Course.findById(course_id),
        Module.findById(module_id),
        Lesson.findById(lesson_id),
        Lesson.find({ moduleId: module_id, isActive: true }).sort({ order: 1 })
    ]);

    if (!lesson || lesson.moduleId.toString() !== module_id) {
        req.flash('error', 'Leçon introuvable.');
        return res.redirect(`/programs/language-learning/general-english-boost/${course_id}/modules/${module_id}`);
    }

    const { completedLessonIds } = await getModuleProgress(req.user._id, module_id, lessons);

    // Enforce sequential access
    if (!isLessonUnlocked(lesson, lessons, completedLessonIds)) {
        req.flash('error', 'Vous devez terminer la leçon précédente d\'abord.');
        return res.redirect(`/programs/language-learning/general-english-boost/${course_id}/modules/${module_id}/overview`);
    }

    const isCompleted = completedLessonIds.has(lesson_id);

    // Determine next lesson
    const sorted = [...lessons].sort((a, b) => a.order - b.order);
    const idx = sorted.findIndex(l => l._id.toString() === lesson_id);
    const nextLesson = sorted[idx + 1] || null;

    res.render('programs/language-learning/courses/lessons/show', {
        course,
        courseModule,
        lesson,
        lessons: sorted,
        isCompleted,
        nextLesson
    });
});

// ─── MARK LESSON COMPLETE ─────────────────────────────────────────────────────

module.exports.completeLesson = catchAsync(async (req, res) => {
    const { course_id, module_id, lesson_id } = req.params;

    await LessonProgress.findOneAndUpdate(
        { userId: req.user._id, courseId: course_id, moduleId: module_id, lessonId: lesson_id },
        { $set: { status: 'completed', completedAt: new Date() } },
        { upsert: true }
    );

    // Determine next lesson to redirect to
    const lessons = await Lesson.find({ moduleId: module_id, isActive: true }).sort({ order: 1 });
    const current = lessons.find(l => l._id.toString() === lesson_id);
    const next = current ? lessons.find(l => l.order === current.order + 1) : null;

    if (next) {
        res.redirect(`/programs/language-learning/general-english-boost/${course_id}/modules/${module_id}/lessons/${next._id}`);
    } else {
        req.flash('success', 'Toutes les leçons de ce module sont terminées !');
        res.redirect(`/programs/language-learning/general-english-boost/${course_id}/modules/${module_id}/overview`);
    }
});
