const { Course, Module } = require('../../models/courses');
const Lesson = require('../../models/lesson');
const LessonProgress = require('../../models/lessonProgress');
const QuizAttempt = require('../../models/quizAttempt');
const AssignmentSubmission = require('../../models/assignmentSubmission');
const catchAsync = require('../../utilities/catchAsync');

const BASE = '/institution/learn';

// ─── HELPERS ──────────────────────────────────────────────────────────────────

async function getModuleProgress(userId, moduleId, lessons) {
    if (!lessons || lessons.length === 0) return { completedLessonIds: new Set(), allLessonsDone: true };
    const records = await LessonProgress.find({ userId, moduleId, status: 'completed' }).select('lessonId');
    const completedLessonIds = new Set(records.map(r => r.lessonId.toString()));
    const allLessonsDone = lessons.every(l => completedLessonIds.has(l._id.toString()));
    return { completedLessonIds, allLessonsDone };
}

function isLessonUnlocked(lesson, lessons, completedLessonIds) {
    const sorted = [...lessons].sort((a, b) => a.order - b.order);
    const idx = sorted.findIndex(l => l._id.toString() === lesson._id.toString());
    if (idx === 0) return true;
    return completedLessonIds.has(sorted[idx - 1]._id.toString());
}

// ─── MY COURSES ───────────────────────────────────────────────────────────────

module.exports.myCourses = catchAsync(async (req, res) => {
    const assignedIds = (req.institution.assignedCourses || []).map(id => id.toString());
    const enrolledIds = (req.user.coursesTaken || []).map(id => (id._id || id).toString());
    const intersection = assignedIds.filter(id => enrolledIds.includes(id));

    if (intersection.length === 0) {
        return res.render('institution-dashboard/learn/courses', {
            institution: req.institution,
            coursesWithProgress: []
        });
    }

    const courses = await Course.find({ _id: { $in: intersection } })
        .select('title isActive courseImageUrl modules category');

    const courseObjectIds = courses.map(c => c._id);

    const [progressData, lessonCounts] = await Promise.all([
        LessonProgress.aggregate([
            { $match: { userId: req.user._id, courseId: { $in: courseObjectIds }, status: 'completed' } },
            { $group: { _id: '$courseId', count: { $sum: 1 } } }
        ]),
        Lesson.aggregate([
            { $match: { courseId: { $in: courseObjectIds }, isActive: true } },
            { $group: { _id: '$courseId', count: { $sum: 1 } } }
        ])
    ]);

    const completedMap = Object.fromEntries(progressData.map(r => [r._id.toString(), r.count]));
    const totalMap     = Object.fromEntries(lessonCounts.map(r => [r._id.toString(), r.count]));

    const coursesWithProgress = courses.map(course => {
        const cid        = course._id.toString();
        const completed  = completedMap[cid] || 0;
        const total      = totalMap[cid]     || 0;
        const enrollment = (req.user.specialProgram || []).find(p => p.courseTitle === course.title);
        return {
            course,
            completed,
            total,
            pct: total > 0 ? Math.round((completed / total) * 100) : 0,
            enrollment
        };
    });

    res.render('institution-dashboard/learn/courses', {
        institution: req.institution,
        coursesWithProgress
    });
});

// ─── COURSE SHOW ──────────────────────────────────────────────────────────────

module.exports.showCourse = catchAsync(async (req, res) => {
    const course = req.course; // set by checkInstitutionCourseAccess

    // For each module, count completed lessons to find the resume point
    const moduleIds = (course.modules || []).map(m => m._id);

    const [progressData, lessonCounts] = await Promise.all([
        LessonProgress.aggregate([
            { $match: { userId: req.user._id, courseId: course._id, status: 'completed' } },
            { $group: { _id: '$moduleId', count: { $sum: 1 } } }
        ]),
        Lesson.aggregate([
            { $match: { moduleId: { $in: moduleIds }, isActive: true } },
            { $group: { _id: '$moduleId', count: { $sum: 1 } } }
        ])
    ]);

    const completedByModule = Object.fromEntries(progressData.map(r => [r._id.toString(), r.count]));
    const totalByModule     = Object.fromEntries(lessonCounts.map(r => [r._id.toString(), r.count]));

    const modulesWithProgress = (course.modules || []).map(m => {
        const mid      = m._id.toString();
        const completed = completedByModule[mid] || 0;
        const total     = totalByModule[mid]     || 0;
        return { module: m, completed, total, pct: total > 0 ? Math.round((completed / total) * 100) : 0 };
    });

    // First module that isn't 100% complete = resume point
    const resumeModule = modulesWithProgress.find(m => m.pct < 100) || modulesWithProgress[0];

    // Check final exam / final project attempts
    const [finalExamAttempt, finalProjectSubmission] = await Promise.all([
        course.finalExam && course.finalExam.questions && course.finalExam.questions.length
            ? QuizAttempt.findOne({ userId: req.user._id, courseId: course._id, quizType: 'final_exam' }).sort({ createdAt: -1 })
            : null,
        course.finalProject && course.finalProject.title
            ? AssignmentSubmission.findOne({ userId: req.user._id, courseId: course._id, assignmentType: 'final_project' })
            : null
    ]);

    res.render('institution-dashboard/learn/course-show', {
        institution: req.institution,
        course,
        modulesWithProgress,
        resumeModule,
        enrollment: req.enrollment,
        finalExamAttempt,
        finalProjectSubmission
    });
});

// ─── MODULE OVERVIEW ──────────────────────────────────────────────────────────

module.exports.showModuleOverview = catchAsync(async (req, res) => {
    const { courseId, moduleId } = req.params;
    const course = req.course;

    const [courseModule, lessons] = await Promise.all([
        Module.findById(moduleId),
        Lesson.find({ moduleId, isActive: true }).sort({ order: 1 })
    ]);

    if (!courseModule) {
        req.flash('error', 'Module introuvable.');
        return res.redirect(`${BASE}/courses/${courseId}`);
    }

    const { completedLessonIds, allLessonsDone } = await getModuleProgress(req.user._id, moduleId, lessons);

    const [quizAttempt, assignmentSubmission] = await Promise.all([
        QuizAttempt.findOne({ userId: req.user._id, courseId, moduleId, quizType: 'module_quiz' }).sort({ createdAt: -1 }),
        AssignmentSubmission.findOne({ userId: req.user._id, courseId, moduleId, assignmentType: 'module_assignment' })
    ]);

    const lessonsWithStatus = lessons.map(l => ({
        lesson: l,
        completed: completedLessonIds.has(l._id.toString()),
        unlocked:  isLessonUnlocked(l, lessons, completedLessonIds)
    }));

    res.render('institution-dashboard/learn/module-overview', {
        institution: req.institution,
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
    const { courseId, moduleId, lessonId } = req.params;
    const course = req.course;

    const [courseModule, lesson, lessons] = await Promise.all([
        Module.findById(moduleId),
        Lesson.findById(lessonId),
        Lesson.find({ moduleId, isActive: true }).sort({ order: 1 })
    ]);

    if (!lesson || lesson.moduleId.toString() !== moduleId) {
        req.flash('error', 'Leçon introuvable.');
        return res.redirect(`${BASE}/courses/${courseId}/modules/${moduleId}/overview`);
    }

    const { completedLessonIds } = await getModuleProgress(req.user._id, moduleId, lessons);

    if (!isLessonUnlocked(lesson, lessons, completedLessonIds)) {
        req.flash('error', 'Terminez la leçon précédente d\'abord.');
        return res.redirect(`${BASE}/courses/${courseId}/modules/${moduleId}/overview`);
    }

    const isCompleted = completedLessonIds.has(lessonId);
    const sorted      = [...lessons].sort((a, b) => a.order - b.order);
    const idx         = sorted.findIndex(l => l._id.toString() === lessonId);
    const nextLesson  = sorted[idx + 1] || null;

    res.render('institution-dashboard/learn/lesson-show', {
        institution: req.institution,
        course,
        courseModule,
        lesson,
        lessons: sorted,
        isCompleted,
        nextLesson
    });
});

// ─── COMPLETE LESSON ──────────────────────────────────────────────────────────

module.exports.completeLesson = catchAsync(async (req, res) => {
    const { courseId, moduleId, lessonId } = req.params;

    await LessonProgress.findOneAndUpdate(
        { userId: req.user._id, courseId, moduleId, lessonId },
        { $set: { status: 'completed', completedAt: new Date() } },
        { upsert: true }
    );

    const lessons = await Lesson.find({ moduleId, isActive: true }).sort({ order: 1 });
    const current = lessons.find(l => l._id.toString() === lessonId);
    const next    = current ? lessons.find(l => l.order === current.order + 1) : null;

    if (next) {
        return res.redirect(`${BASE}/courses/${courseId}/modules/${moduleId}/lessons/${next._id}`);
    }
    req.flash('success', 'Toutes les leçons de ce module sont terminées !');
    res.redirect(`${BASE}/courses/${courseId}/modules/${moduleId}/overview`);
});

// ─── MODULE QUIZ ──────────────────────────────────────────────────────────────

module.exports.showModuleQuiz = catchAsync(async (req, res) => {
    const { courseId, moduleId } = req.params;
    const course = req.course;

    const courseModule = await Module.findById(moduleId);
    if (!courseModule || !courseModule.moduleQuiz || !courseModule.moduleQuiz.questions.length) {
        req.flash('error', 'Quiz introuvable.');
        return res.redirect(`${BASE}/courses/${courseId}/modules/${moduleId}/overview`);
    }

    const lessons = await Lesson.find({ moduleId, isActive: true });
    const completedCount = await LessonProgress.countDocuments({ userId: req.user._id, moduleId, status: 'completed' });
    if (completedCount < lessons.length) {
        req.flash('error', 'Terminez toutes les leçons avant de faire le quiz.');
        return res.redirect(`${BASE}/courses/${courseId}/modules/${moduleId}/overview`);
    }

    const lastAttempt = await QuizAttempt.findOne({ userId: req.user._id, courseId, moduleId, quizType: 'module_quiz' }).sort({ createdAt: -1 });

    res.render('institution-dashboard/learn/quiz', {
        institution: req.institution,
        course,
        courseModule,
        lastAttempt,
        quizType:    'module_quiz',
        submitUrl:   `${BASE}/courses/${courseId}/modules/${moduleId}/quiz/submit`,
        backUrl:     `${BASE}/courses/${courseId}/modules/${moduleId}/overview`
    });
});

module.exports.submitModuleQuiz = catchAsync(async (req, res) => {
    const { courseId, moduleId } = req.params;

    const courseModule = await Module.findById(moduleId);
    if (!courseModule || !courseModule.moduleQuiz) {
        req.flash('error', 'Quiz introuvable.');
        return res.redirect(`${BASE}/courses/${courseId}/modules/${moduleId}/overview`);
    }

    const quiz    = courseModule.moduleQuiz;
    const answers = req.body.answers || {};
    let correct   = 0;
    const submittedAnswers = [];

    quiz.questions.forEach((q, idx) => {
        const submitted = answers[String(idx)] || '';
        submittedAnswers.push(submitted);
        if (submitted === q.correctAnswer) correct++;
    });

    const score  = quiz.questions.length > 0 ? Math.round((correct / quiz.questions.length) * 100) : 0;
    const passed = score >= (quiz.passingScore || 70);

    const existingAttempts = await QuizAttempt.countDocuments({ userId: req.user._id, courseId, moduleId, quizType: 'module_quiz' });

    await QuizAttempt.create({
        userId: req.user._id, courseId, moduleId,
        quizType: 'module_quiz', score,
        passingScore:  quiz.passingScore || 70,
        passed, answers: submittedAnswers,
        attemptNumber: existingAttempts + 1
    });

    req.flash(passed ? 'success' : 'error',
        passed ? `Quiz réussi ! Score : ${score}/100. ✓`
               : `Score : ${score}/100. Requis : ${quiz.passingScore || 70}/100. Réessayez.`);

    res.redirect(`${BASE}/courses/${courseId}/modules/${moduleId}/overview`);
});

// ─── MODULE ASSIGNMENT ────────────────────────────────────────────────────────

module.exports.showModuleAssignment = catchAsync(async (req, res) => {
    const { courseId, moduleId } = req.params;
    const course = req.course;

    const courseModule = await Module.findById(moduleId);
    if (!courseModule || !courseModule.moduleAssignment || !courseModule.moduleAssignment.title) {
        req.flash('error', 'Devoir introuvable.');
        return res.redirect(`${BASE}/courses/${courseId}/modules/${moduleId}/overview`);
    }

    const existing = await AssignmentSubmission.findOne({ userId: req.user._id, courseId, moduleId, assignmentType: 'module_assignment' });

    res.render('institution-dashboard/learn/assignment', {
        institution: req.institution,
        course,
        courseModule,
        title:        courseModule.moduleAssignment.title,
        instructions: courseModule.moduleAssignment.instructions,
        submissionType: courseModule.moduleAssignment.submissionType || 'text',
        existing,
        assignmentType: 'module_assignment',
        submitUrl:    `${BASE}/courses/${courseId}/modules/${moduleId}/assignment/submit`,
        backUrl:      `${BASE}/courses/${courseId}/modules/${moduleId}/overview`
    });
});

module.exports.submitModuleAssignment = catchAsync(async (req, res) => {
    const { courseId, moduleId } = req.params;
    const { content } = req.body;

    const courseModule = await Module.findById(moduleId);
    if (!courseModule || !courseModule.moduleAssignment) {
        req.flash('error', 'Devoir introuvable.');
        return res.redirect(`${BASE}/courses/${courseId}/modules/${moduleId}/overview`);
    }

    if (!content || !content.trim()) {
        req.flash('error', 'Votre réponse ne peut pas être vide.');
        return res.redirect(`${BASE}/courses/${courseId}/modules/${moduleId}/assignment`);
    }

    await AssignmentSubmission.findOneAndUpdate(
        { userId: req.user._id, courseId, moduleId, assignmentType: 'module_assignment' },
        { $set: { submissionType: courseModule.moduleAssignment.submissionType || 'text', content: content.trim(), maxScore: courseModule.moduleAssignment.maxScore || 100, status: 'pending' } },
        { upsert: true }
    );

    req.flash('success', 'Devoir soumis. En attente de correction.');
    res.redirect(`${BASE}/courses/${courseId}/modules/${moduleId}/overview`);
});

// ─── FINAL EXAM ───────────────────────────────────────────────────────────────

module.exports.showFinalExam = catchAsync(async (req, res) => {
    const { courseId } = req.params;
    const course = await Course.findById(courseId).populate('modules', 'title order moduleQuiz');

    if (!course || !course.finalExam || !course.finalExam.questions.length) {
        req.flash('error', 'Examen final introuvable.');
        return res.redirect(`${BASE}/courses/${courseId}`);
    }

    const lastAttempt = await QuizAttempt.findOne({ userId: req.user._id, courseId, quizType: 'final_exam' }).sort({ createdAt: -1 });

    res.render('institution-dashboard/learn/quiz', {
        institution:  req.institution,
        course,
        courseModule: null,
        lastAttempt,
        quizType:    'final_exam',
        submitUrl:   `${BASE}/courses/${courseId}/final-exam/submit`,
        backUrl:     `${BASE}/courses/${courseId}`
    });
});

module.exports.submitFinalExam = catchAsync(async (req, res) => {
    const { courseId } = req.params;
    const course = await Course.findById(courseId).select('finalExam');

    if (!course || !course.finalExam) {
        req.flash('error', 'Examen final introuvable.');
        return res.redirect(`${BASE}/courses/${courseId}`);
    }

    const exam    = course.finalExam;
    const answers = req.body.answers || {};
    let correct   = 0;
    const submittedAnswers = [];

    exam.questions.forEach((q, idx) => {
        const submitted = answers[String(idx)] || '';
        submittedAnswers.push(submitted);
        if (submitted === q.correctAnswer) correct++;
    });

    const score  = exam.questions.length > 0 ? Math.round((correct / exam.questions.length) * 100) : 0;
    const passed = score >= (exam.passingScore || 70);

    const existingAttempts = await QuizAttempt.countDocuments({ userId: req.user._id, courseId, quizType: 'final_exam' });

    await QuizAttempt.create({
        userId: req.user._id, courseId, moduleId: null,
        quizType: 'final_exam', score,
        passingScore:  exam.passingScore || 70,
        passed, answers: submittedAnswers,
        attemptNumber: existingAttempts + 1
    });

    req.flash(passed ? 'success' : 'error',
        passed ? `Examen final réussi ! Score : ${score}/100. Félicitations ! 🎉`
               : `Score : ${score}/100. Requis : ${exam.passingScore || 70}/100. Réessayez.`);

    res.redirect(`${BASE}/courses/${courseId}`);
});

// ─── FINAL PROJECT ────────────────────────────────────────────────────────────

module.exports.showFinalProject = catchAsync(async (req, res) => {
    const { courseId } = req.params;
    const course = req.course;

    if (!course.finalProject || !course.finalProject.title) {
        req.flash('error', 'Projet final introuvable.');
        return res.redirect(`${BASE}/courses/${courseId}`);
    }

    const existing = await AssignmentSubmission.findOne({ userId: req.user._id, courseId, assignmentType: 'final_project' });

    res.render('institution-dashboard/learn/assignment', {
        institution:    req.institution,
        course,
        courseModule:   null,
        title:          course.finalProject.title,
        instructions:   course.finalProject.instructions,
        submissionType: course.finalProject.submissionType || 'text',
        existing,
        assignmentType: 'final_project',
        submitUrl:      `${BASE}/courses/${courseId}/final-project/submit`,
        backUrl:        `${BASE}/courses/${courseId}`
    });
});

module.exports.submitFinalProject = catchAsync(async (req, res) => {
    const { courseId } = req.params;
    const { content } = req.body;
    const course = req.course;

    if (!course.finalProject) {
        req.flash('error', 'Projet final introuvable.');
        return res.redirect(`${BASE}/courses/${courseId}`);
    }

    if (!content || !content.trim()) {
        req.flash('error', 'Votre soumission ne peut pas être vide.');
        return res.redirect(`${BASE}/courses/${courseId}/final-project`);
    }

    await AssignmentSubmission.findOneAndUpdate(
        { userId: req.user._id, courseId, assignmentType: 'final_project' },
        { $set: { submissionType: course.finalProject.submissionType || 'text', content: content.trim(), maxScore: course.finalProject.maxScore || 100, status: 'pending', moduleId: null } },
        { upsert: true }
    );

    req.flash('success', 'Projet final soumis. En attente de correction.');
    res.redirect(`${BASE}/courses/${courseId}`);
});
