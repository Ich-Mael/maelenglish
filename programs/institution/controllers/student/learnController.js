const {
    InstitutionCourse,
    InstitutionModule,
    InstitutionLesson,
    InstitutionLessonProgress,
    InstitutionEnrollment,
    InstitutionQuizAttempt,
    InstitutionAssignmentSubmission,
    InstitutionFinalExamAttempt,
    InstitutionFinalProjectSubmission
} = require('../../models');
const catchAsync = require('../../../../shared/utilities/catchAsync');

// ─── COURSE LIST ─────────────────────────────────────────────────────────────

module.exports.courses = catchAsync(async (req, res) => {
    const enrollments = await InstitutionEnrollment.find({
        userId: req.user._id,
        institutionId: req.institution._id
    }).populate('courseId', 'title isActive imageUrl');

    const courseIds = enrollments.map(e => e.courseId?._id).filter(Boolean);

    const [completedAgg, totalAgg] = await Promise.all([
        InstitutionLessonProgress.aggregate([
            { $match: { userId: req.user._id, courseId: { $in: courseIds } } },
            { $group: { _id: '$courseId', count: { $sum: 1 } } }
        ]),
        InstitutionLesson.aggregate([
            { $match: { courseId: { $in: courseIds } } },
            { $group: { _id: '$courseId', count: { $sum: 1 } } }
        ])
    ]);

    const completedMap = Object.fromEntries(completedAgg.map(r => [r._id.toString(), r.count]));
    const totalMap     = Object.fromEntries(totalAgg.map(r => [r._id.toString(), r.count]));

    const coursesWithProgress = enrollments.map(enrollment => {
        const course    = enrollment.courseId;
        const cid       = course?._id?.toString();
        const completed = completedMap[cid] || 0;
        const total     = totalMap[cid]     || 0;
        return { course, enrollment, completed, total, pct: total > 0 ? Math.round((completed / total) * 100) : 0 };
    });

    res.render('institution-dashboard/learn/courses', {
        institution: req.institution,
        coursesWithProgress
    });
});

// ─── COURSE DETAIL ────────────────────────────────────────────────────────────

module.exports.courseShow = catchAsync(async (req, res) => {
    const { courseId } = req.params;

    const course = await InstitutionCourse.findOne({
        _id: courseId,
        institutionId: req.institution._id
    }).populate({ path: 'modules', options: { sort: { order: 1 } } });

    if (!course) {
        req.flash('error', 'Cours introuvable.');
        return res.redirect('/institution/learn/courses');
    }

    const [allLessons, lessonProgress] = await Promise.all([
        InstitutionLesson.find({ courseId }).lean(),
        InstitutionLessonProgress.find({ userId: req.user._id, courseId }).lean()
    ]);

    const completedIds = new Set(lessonProgress.map(p => p.lessonId.toString()));

    // Group lessons by moduleId
    const lessonsByMod = {};
    allLessons.forEach(l => {
        const mid = l.moduleId.toString();
        if (!lessonsByMod[mid]) lessonsByMod[mid] = [];
        lessonsByMod[mid].push(l);
    });

    const modulesWithProgress = course.modules.map(mod => {
        const modLessons = lessonsByMod[mod._id.toString()] || [];
        const total      = modLessons.length;
        const completed  = modLessons.filter(l => completedIds.has(l._id.toString())).length;
        const pct        = total > 0 ? Math.round((completed / total) * 100) : 0;
        return { module: mod, total, completed, pct };
    });

    // First module that is not 100% complete
    const resumeModule = modulesWithProgress.find(({ pct }) => pct < 100) || modulesWithProgress[0] || null;

    const [finalExamAttempt, finalProjectSubmission] = await Promise.all([
        InstitutionFinalExamAttempt.findOne({ userId: req.user._id, courseId }).sort({ createdAt: -1 }).lean(),
        InstitutionFinalProjectSubmission.findOne({ userId: req.user._id, courseId }).lean()
    ]);

    res.render('institution-dashboard/learn/course-show', {
        course,
        modulesWithProgress,
        resumeModule,
        finalExamAttempt,
        finalProjectSubmission,
        institution: req.institution,
        enrollment: req.enrollment
    });
});

// ─── MODULE OVERVIEW ─────────────────────────────────────────────────────────

module.exports.moduleOverview = catchAsync(async (req, res) => {
    const { courseId, moduleId } = req.params;

    const [course, courseModule, lessons] = await Promise.all([
        InstitutionCourse.findById(courseId).select('title _id').lean(),
        InstitutionModule.findOne({ _id: moduleId, courseId, institutionId: req.institution._id }),
        InstitutionLesson.find({ moduleId, courseId }).sort({ order: 1 }).lean()
    ]);

    if (!courseModule) {
        req.flash('error', 'Module introuvable.');
        return res.redirect(`/institution/learn/courses/${courseId}`);
    }

    const progress = await InstitutionLessonProgress.find({
        userId: req.user._id,
        courseId,
        lessonId: { $in: lessons.map(l => l._id) }
    }).lean();
    const completedIds = new Set(progress.map(p => p.lessonId.toString()));

    // Sequential unlocking: first lesson always unlocked; each subsequent lesson unlocked once previous is completed
    const lessonsWithStatus = lessons.map((lesson, idx) => ({
        lesson,
        completed: completedIds.has(lesson._id.toString()),
        unlocked: idx === 0 || completedIds.has(lessons[idx - 1]._id.toString())
    }));

    const allLessonsDone = lessons.length > 0 && lessons.every(l => completedIds.has(l._id.toString()));

    const [quizAttempt, assignmentSubmission] = await Promise.all([
        InstitutionQuizAttempt.findOne({ userId: req.user._id, moduleId }).sort({ createdAt: -1 }).lean(),
        InstitutionAssignmentSubmission.findOne({ userId: req.user._id, moduleId }).lean()
    ]);

    res.render('institution-dashboard/learn/module-overview', {
        course,
        courseModule,
        lessonsWithStatus,
        allLessonsDone,
        quizAttempt,
        assignmentSubmission
    });
});

// ─── LESSON ──────────────────────────────────────────────────────────────────

module.exports.lessonShow = catchAsync(async (req, res) => {
    const { courseId, moduleId, lessonId } = req.params;

    const [course, courseModule, lesson, lessons, progress] = await Promise.all([
        InstitutionCourse.findById(courseId).select('title _id').lean(),
        InstitutionModule.findById(moduleId).select('title _id').lean(),
        InstitutionLesson.findOne({ _id: lessonId, moduleId, courseId, institutionId: req.institution._id }),
        InstitutionLesson.find({ moduleId, courseId }).sort({ order: 1 }).lean(),
        InstitutionLessonProgress.findOne({ userId: req.user._id, lessonId }).lean()
    ]);

    if (!lesson) {
        req.flash('error', 'Leçon introuvable.');
        return res.redirect(`/institution/learn/courses/${courseId}/modules/${moduleId}`);
    }

    const lessonIdx  = lessons.findIndex(l => l._id.toString() === lessonId);
    const nextLesson = lessonIdx >= 0 && lessonIdx < lessons.length - 1 ? lessons[lessonIdx + 1] : null;

    res.render('institution-dashboard/learn/lesson-show', {
        lesson,
        course,
        courseModule,
        lessons,
        isCompleted: !!progress,
        nextLesson
    });
});

module.exports.completeLesson = catchAsync(async (req, res) => {
    const { courseId, moduleId, lessonId } = req.params;

    const lesson = await InstitutionLesson.findOne({
        _id: lessonId,
        moduleId,
        courseId,
        institutionId: req.institution._id
    });

    if (!lesson) {
        return res.status(404).json({ error: 'Leçon introuvable' });
    }

    await InstitutionLessonProgress.findOneAndUpdate(
        { userId: req.user._id, lessonId },
        { userId: req.user._id, lessonId, courseId, completedAt: new Date() },
        { upsert: true }
    );

    res.json({ ok: true });
});

// ─── QUIZ ─────────────────────────────────────────────────────────────────────

module.exports.quiz = catchAsync(async (req, res) => {
    const { courseId, moduleId } = req.params;

    const mod = await InstitutionModule.findOne({
        _id: moduleId,
        courseId,
        institutionId: req.institution._id
    });

    if (!mod || !mod.quiz) {
        req.flash('error', 'Quiz non trouvé.');
        return res.redirect(`/institution/learn/courses/${courseId}/modules/${moduleId}`);
    }

    res.render('institution-dashboard/learn/quiz', { module: mod, courseId, moduleId });
});

module.exports.submitQuiz = catchAsync(async (req, res) => {
    const { courseId, moduleId } = req.params;
    const { answers } = req.body;

    const mod = await InstitutionModule.findOne({
        _id: moduleId,
        courseId,
        institutionId: req.institution._id
    });

    if (!mod || !mod.quiz) {
        return res.status(404).json({ error: 'Quiz not found' });
    }

    let score = 0;
    const parsedAnswers = Object.values(answers || {}).map((ans, idx) => ({
        questionIndex: idx,
        selectedValue: ans
    }));

    if (mod.quiz.questions) {
        mod.quiz.questions.forEach((q, idx) => {
            if (parsedAnswers[idx] && parsedAnswers[idx].selectedValue === q.correctAnswer) {
                score += 100 / mod.quiz.questions.length;
            }
        });
    }

    const attempt = await InstitutionQuizAttempt.create({
        userId: req.user._id,
        moduleId,
        courseId,
        institutionId: req.institution._id,
        answers: parsedAnswers,
        score: Math.round(score),
        passed: Math.round(score) >= (mod.quiz.passingScore || 70),
        submittedAt: new Date()
    });

    req.flash('success', `Quiz soumis. Score : ${Math.round(score)}%`);
    res.json({ ok: true, score: Math.round(score), passed: attempt.passed });
});

// ─── ASSIGNMENT ───────────────────────────────────────────────────────────────

module.exports.assignment = catchAsync(async (req, res) => {
    const { courseId, moduleId } = req.params;

    const mod = await InstitutionModule.findOne({
        _id: moduleId,
        courseId,
        institutionId: req.institution._id
    });

    if (!mod || !mod.assignment) {
        req.flash('error', 'Devoir non trouvé.');
        return res.redirect(`/institution/learn/courses/${courseId}/modules/${moduleId}`);
    }

    res.render('institution-dashboard/learn/assignment', { module: mod, courseId, moduleId });
});

module.exports.submitAssignment = catchAsync(async (req, res) => {
    const { courseId, moduleId } = req.params;
    const { content } = req.body;

    const mod = await InstitutionModule.findOne({
        _id: moduleId,
        courseId,
        institutionId: req.institution._id
    });

    if (!mod || !mod.assignment) {
        return res.status(404).json({ error: 'Assignment not found' });
    }

    await InstitutionAssignmentSubmission.create({
        userId: req.user._id,
        moduleId,
        courseId,
        institutionId: req.institution._id,
        submissionType: mod.assignment.submissionType || 'text',
        content,
        submittedAt: new Date()
    });

    req.flash('success', 'Devoir soumis.');
    res.json({ ok: true });
});

// ─── FINAL EXAM ───────────────────────────────────────────────────────────────

module.exports.finalExam = catchAsync(async (req, res) => {
    const { courseId } = req.params;

    const course = await InstitutionCourse.findOne({
        _id: courseId,
        institutionId: req.institution._id
    });

    if (!course || !course.finalExam) {
        req.flash('error', 'Examen final non trouvé.');
        return res.redirect(`/institution/learn/courses/${courseId}`);
    }

    const lastAttempt = await InstitutionFinalExamAttempt.findOne({
        userId: req.user._id,
        courseId
    }).sort({ createdAt: -1 });

    res.render('institution-dashboard/learn/final-exam', { course, courseId, lastAttempt });
});

module.exports.submitFinalExam = catchAsync(async (req, res) => {
    const { courseId } = req.params;
    const { answers } = req.body;

    const course = await InstitutionCourse.findOne({
        _id: courseId,
        institutionId: req.institution._id
    });

    if (!course || !course.finalExam) {
        return res.status(404).json({ error: 'Exam not found' });
    }

    let score = 0;
    const parsedAnswers = Object.values(answers || {}).map((ans, idx) => ({
        questionIndex: idx,
        selectedValue: ans
    }));

    if (course.finalExam.questions) {
        course.finalExam.questions.forEach((q, idx) => {
            if (parsedAnswers[idx] && parsedAnswers[idx].selectedValue === q.correctAnswer) {
                score += 100 / course.finalExam.questions.length;
            }
        });
    }

    const attempt = await InstitutionFinalExamAttempt.create({
        userId: req.user._id,
        courseId,
        institutionId: req.institution._id,
        answers: parsedAnswers,
        score: Math.round(score),
        passed: Math.round(score) >= (course.finalExam.passingScore || 70),
        submittedAt: new Date()
    });

    req.flash('success', `Examen soumis. Score : ${Math.round(score)}%`);
    res.json({ ok: true, score: Math.round(score), passed: attempt.passed });
});

// ─── FINAL PROJECT ────────────────────────────────────────────────────────────

module.exports.finalProject = catchAsync(async (req, res) => {
    const { courseId } = req.params;

    const course = await InstitutionCourse.findOne({
        _id: courseId,
        institutionId: req.institution._id
    });

    if (!course || !course.finalProject) {
        req.flash('error', 'Projet final non trouvé.');
        return res.redirect(`/institution/learn/courses/${courseId}`);
    }

    const existing = await InstitutionFinalProjectSubmission.findOne({
        userId: req.user._id,
        courseId
    });

    res.render('institution-dashboard/learn/final-project', { course, courseId, existing });
});

module.exports.submitFinalProject = catchAsync(async (req, res) => {
    const { courseId } = req.params;
    const { content } = req.body;

    const course = await InstitutionCourse.findOne({
        _id: courseId,
        institutionId: req.institution._id
    });

    if (!course || !course.finalProject) {
        return res.status(404).json({ error: 'Project not found' });
    }

    await InstitutionFinalProjectSubmission.create({
        userId: req.user._id,
        courseId,
        institutionId: req.institution._id,
        submissionType: course.finalProject.submissionType || 'text',
        content,
        submittedAt: new Date()
    });

    req.flash('success', 'Projet soumis.');
    res.json({ ok: true });
});
