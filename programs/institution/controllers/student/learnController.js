const { InstitutionCourse, InstitutionModule, InstitutionLesson, InstitutionEnrollment, InstitutionQuizAttempt, InstitutionAssignmentSubmission, InstitutionFinalExamAttempt, InstitutionFinalProjectSubmission } = require('../../models');
const catchAsync = require('../../../../shared/utilities/catchAsync');

// ─── COURSE BROWSING ─────────────────────────────────────────────────────────

module.exports.courses = catchAsync(async (req, res) => {
    const enrollments = await InstitutionEnrollment.find({
        userId: req.user._id,
        institutionId: req.institution._id
    }).populate('courseId');

    res.render('institution-dashboard/learn/courses', { enrollments });
});

module.exports.courseShow = catchAsync(async (req, res) => {
    const { courseId } = req.params;
    const course = await InstitutionCourse.findOne({
        _id: courseId,
        institutionId: req.institution._id
    }).populate('modules');

    if (!course) {
        req.flash('error', 'Cours introuvable.');
        return res.redirect('/institution/learn/courses');
    }

    res.render('institution-dashboard/learn/course-show', { course });
});

// ─── MODULE + LESSON VIEWS ──────────────────────────────────────────────────

module.exports.moduleOverview = catchAsync(async (req, res) => {
    const { courseId, moduleId } = req.params;

    const mod = await InstitutionModule.findOne({
        _id: moduleId,
        courseId,
        institutionId: req.institution._id
    }).populate('lessons');

    if (!mod) {
        req.flash('error', 'Module introuvable.');
        return res.redirect(`/institution/learn/courses/${courseId}`);
    }

    res.render('institution-dashboard/learn/module-overview', { module: mod, courseId });
});

module.exports.lessonShow = catchAsync(async (req, res) => {
    const { courseId, moduleId, lessonId } = req.params;

    const lesson = await InstitutionLesson.findOne({
        _id: lessonId,
        moduleId,
        courseId,
        institutionId: req.institution._id
    });

    if (!lesson) {
        req.flash('error', 'Leçon introuvable.');
        return res.redirect(`/institution/learn/courses/${courseId}/modules/${moduleId}`);
    }

    res.render('institution-dashboard/learn/lesson-show', { lesson, courseId, moduleId });
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

    const { InstitutionLessonProgress } = require('../../models');
    await InstitutionLessonProgress.findOneAndUpdate(
        { userId: req.user._id, lessonId },
        { userId: req.user._id, lessonId, courseId, completedAt: new Date() },
        { upsert: true }
    );

    res.json({ ok: true });
});

// ─── QUIZ ───────────────────────────────────────────────────────────────────

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

    req.flash('success', `Quiz soumis. Score: ${Math.round(score)}%`);
    res.json({ ok: true, score: Math.round(score), passed: attempt.passed });
});

// ─── ASSIGNMENT ─────────────────────────────────────────────────────────────

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

// ─── FINAL EXAM ──────────────────────────────────────────────────────────────

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

    res.render('institution-dashboard/learn/final-exam', { course, courseId });
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

    req.flash('success', `Examen soumis. Score: ${Math.round(score)}%`);
    res.json({ ok: true, score: Math.round(score), passed: attempt.passed });
});

// ─── FINAL PROJECT ───────────────────────────────────────────────────────────

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

    res.render('institution-dashboard/learn/final-project', { course, courseId });
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
