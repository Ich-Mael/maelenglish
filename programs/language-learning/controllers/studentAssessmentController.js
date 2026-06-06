const { Course, Module } = require('../../../shared/models/courses');
const Lesson = require('../../../shared/models/lesson');
const LessonProgress = require('../../../shared/models/lessonProgress');
const QuizAttempt = require('../../../shared/models/quizAttempt');
const AssignmentSubmission = require('../../../shared/models/assignmentSubmission');
const catchAsync = require('../../../shared/utilities/catchAsync');

// ─── MODULE QUIZ ──────────────────────────────────────────────────────────────

module.exports.showModuleQuiz = catchAsync(async (req, res) => {
    const { course_id, module_id } = req.params;

    const courseModule = await Module.findById(module_id);
    if (!courseModule || !courseModule.moduleQuiz || !courseModule.moduleQuiz.questions.length) {
        req.flash('error', 'Quiz introuvable.');
        return res.redirect(`/programs/language-learning/general-english-boost/${course_id}/modules/${module_id}/overview`);
    }

    // Check all lessons done
    const lessons = await Lesson.find({ moduleId: module_id, isActive: true });
    const completedCount = await LessonProgress.countDocuments({
        userId: req.user._id,
        moduleId: module_id,
        status: 'completed'
    });

    if (completedCount < lessons.length) {
        req.flash('error', 'Terminez toutes les leçons avant de faire le quiz.');
        return res.redirect(`/programs/language-learning/general-english-boost/${course_id}/modules/${module_id}/overview`);
    }

    // Previous attempt
    const lastAttempt = await QuizAttempt.findOne({
        userId: req.user._id,
        courseId: course_id,
        moduleId: module_id,
        quizType: 'module_quiz'
    }).sort({ createdAt: -1 });

    const course = await Course.findById(course_id).select('title');

    res.render('programs/language-learning/courses/assessments/moduleQuiz', {
        course,
        courseModule,
        lastAttempt
    });
});

module.exports.submitModuleQuiz = catchAsync(async (req, res) => {
    const { course_id, module_id } = req.params;

    const courseModule = await Module.findById(module_id);
    if (!courseModule || !courseModule.moduleQuiz) {
        req.flash('error', 'Quiz introuvable.');
        return res.redirect(`/programs/language-learning/general-english-boost/${course_id}/modules/${module_id}/overview`);
    }

    const quiz = courseModule.moduleQuiz;
    const answers = req.body.answers || {};
    let correct = 0;
    const submittedAnswers = [];

    quiz.questions.forEach((q, idx) => {
        const submitted = answers[String(idx)] || '';
        submittedAnswers.push(submitted);
        if (submitted === q.correctAnswer) correct++;
    });

    const score = quiz.questions.length > 0
        ? Math.round((correct / quiz.questions.length) * 100)
        : 0;
    const passed = score >= (quiz.passingScore || 70);

    const existingAttempts = await QuizAttempt.countDocuments({
        userId: req.user._id,
        courseId: course_id,
        moduleId: module_id,
        quizType: 'module_quiz'
    });

    await QuizAttempt.create({
        userId:        req.user._id,
        courseId:      course_id,
        moduleId:      module_id,
        quizType:      'module_quiz',
        score,
        passingScore:  quiz.passingScore || 70,
        passed,
        answers:       submittedAnswers,
        attemptNumber: existingAttempts + 1
    });

    if (passed) {
        req.flash('success', `Quiz réussi ! Score : ${score}/100. ✓`);
    } else {
        req.flash('error', `Score : ${score}/100. Score requis : ${quiz.passingScore || 70}/100. Réessayez.`);
    }

    res.redirect(`/programs/language-learning/general-english-boost/${course_id}/modules/${module_id}/overview`);
});

// ─── MODULE ASSIGNMENT ────────────────────────────────────────────────────────

module.exports.showModuleAssignment = catchAsync(async (req, res) => {
    const { course_id, module_id } = req.params;

    const courseModule = await Module.findById(module_id);
    if (!courseModule || !courseModule.moduleAssignment || !courseModule.moduleAssignment.title) {
        req.flash('error', 'Devoir introuvable.');
        return res.redirect(`/programs/language-learning/general-english-boost/${course_id}/modules/${module_id}/overview`);
    }

    const existing = await AssignmentSubmission.findOne({
        userId: req.user._id,
        courseId: course_id,
        moduleId: module_id,
        assignmentType: 'module_assignment'
    });

    const course = await Course.findById(course_id).select('title');

    res.render('programs/language-learning/courses/assessments/moduleAssignment', {
        course,
        courseModule,
        existing
    });
});

module.exports.submitModuleAssignment = catchAsync(async (req, res) => {
    const { course_id, module_id } = req.params;
    const { content } = req.body;

    const courseModule = await Module.findById(module_id);
    if (!courseModule || !courseModule.moduleAssignment) {
        req.flash('error', 'Devoir introuvable.');
        return res.redirect(`/programs/language-learning/general-english-boost/${course_id}/modules/${module_id}/overview`);
    }

    if (!content || !content.trim()) {
        req.flash('error', 'Votre réponse ne peut pas être vide.');
        return res.redirect(`/programs/language-learning/general-english-boost/${course_id}/modules/${module_id}/assignment`);
    }

    await AssignmentSubmission.findOneAndUpdate(
        { userId: req.user._id, courseId: course_id, moduleId: module_id, assignmentType: 'module_assignment' },
        {
            $set: {
                submissionType: courseModule.moduleAssignment.submissionType || 'text',
                content: content.trim(),
                maxScore: courseModule.moduleAssignment.maxScore || 100,
                status: 'pending'
            }
        },
        { upsert: true }
    );

    req.flash('success', 'Devoir soumis avec succès. En attente de correction.');
    res.redirect(`/programs/language-learning/general-english-boost/${course_id}/modules/${module_id}/overview`);
});

// ─── FINAL EXAM ───────────────────────────────────────────────────────────────

module.exports.showFinalExam = catchAsync(async (req, res) => {
    const { course_id } = req.params;

    const course = await Course.findById(course_id).populate('modules', 'title order moduleQuiz');
    if (!course || !course.finalExam || !course.finalExam.questions.length) {
        req.flash('error', 'Examen final introuvable.');
        return res.redirect(`/programs/language-learning/general-english-boost/${course_id}`);
    }

    const lastAttempt = await QuizAttempt.findOne({
        userId: req.user._id,
        courseId: course_id,
        quizType: 'final_exam'
    }).sort({ createdAt: -1 });

    res.render('programs/language-learning/courses/assessments/finalExam', {
        course,
        lastAttempt
    });
});

module.exports.submitFinalExam = catchAsync(async (req, res) => {
    const { course_id } = req.params;

    const course = await Course.findById(course_id).select('finalExam');
    if (!course || !course.finalExam) {
        req.flash('error', 'Examen final introuvable.');
        return res.redirect(`/programs/language-learning/general-english-boost/${course_id}`);
    }

    const exam = course.finalExam;
    const answers = req.body.answers || {};
    let correct = 0;
    const submittedAnswers = [];

    exam.questions.forEach((q, idx) => {
        const submitted = answers[String(idx)] || '';
        submittedAnswers.push(submitted);
        if (submitted === q.correctAnswer) correct++;
    });

    const score = exam.questions.length > 0
        ? Math.round((correct / exam.questions.length) * 100)
        : 0;
    const passed = score >= (exam.passingScore || 70);

    const existingAttempts = await QuizAttempt.countDocuments({
        userId: req.user._id,
        courseId: course_id,
        quizType: 'final_exam'
    });

    await QuizAttempt.create({
        userId:        req.user._id,
        courseId:      course_id,
        moduleId:      null,
        quizType:      'final_exam',
        score,
        passingScore:  exam.passingScore || 70,
        passed,
        answers:       submittedAnswers,
        attemptNumber: existingAttempts + 1
    });

    if (passed) {
        req.flash('success', `Examen final réussi ! Score : ${score}/100. Félicitations ! 🎉`);
    } else {
        req.flash('error', `Score : ${score}/100. Score requis : ${exam.passingScore || 70}/100. Réessayez.`);
    }

    res.redirect(`/programs/language-learning/general-english-boost/${course_id}`);
});

// ─── FINAL PROJECT ────────────────────────────────────────────────────────────

module.exports.showFinalProject = catchAsync(async (req, res) => {
    const { course_id } = req.params;
    const course = await Course.findById(course_id).select('title finalProject');
    if (!course || !course.finalProject || !course.finalProject.title) {
        req.flash('error', 'Projet final introuvable.');
        return res.redirect(`/programs/language-learning/general-english-boost/${course_id}`);
    }

    const existing = await AssignmentSubmission.findOne({
        userId: req.user._id,
        courseId: course_id,
        assignmentType: 'final_project'
    });

    res.render('programs/language-learning/courses/assessments/finalProject', { course, existing });
});

module.exports.submitFinalProject = catchAsync(async (req, res) => {
    const { course_id } = req.params;
    const { content } = req.body;

    const course = await Course.findById(course_id).select('finalProject');
    if (!course || !course.finalProject) {
        req.flash('error', 'Projet final introuvable.');
        return res.redirect(`/programs/language-learning/general-english-boost/${course_id}`);
    }

    if (!content || !content.trim()) {
        req.flash('error', 'Votre soumission ne peut pas être vide.');
        return res.redirect(`/programs/language-learning/general-english-boost/${course_id}/final-project`);
    }

    await AssignmentSubmission.findOneAndUpdate(
        { userId: req.user._id, courseId: course_id, assignmentType: 'final_project' },
        {
            $set: {
                submissionType: course.finalProject.submissionType || 'text',
                content:        content.trim(),
                maxScore:       course.finalProject.maxScore || 100,
                status:         'pending',
                moduleId:       null
            }
        },
        { upsert: true }
    );

    req.flash('success', 'Projet final soumis. En attente de correction.');
    res.redirect(`/programs/language-learning/general-english-boost/${course_id}`);
});

// ─── INSTRUCTOR GRADING ───────────────────────────────────────────────────────

module.exports.gradingQueue = catchAsync(async (req, res) => {
    const { course_id } = req.params;

    const submissions = await AssignmentSubmission.find({ courseId: course_id, status: 'pending' })
        .populate('userId', 'name surname username')
        .populate('moduleId', 'title')
        .sort({ createdAt: 1 });

    const course = await Course.findById(course_id).select('title');

    res.render('programs/language-learning/courses/assessments/gradingQueue', { course, submissions });
});

module.exports.gradeSubmission = catchAsync(async (req, res) => {
    const { course_id, submission_id } = req.params;
    const { grade, feedback } = req.body;

    await AssignmentSubmission.findByIdAndUpdate(submission_id, {
        grade:    parseFloat(grade),
        feedback: feedback || '',
        status:   'graded',
        gradedBy: req.user._id,
        gradedAt: new Date()
    });

    req.flash('success', 'Devoir noté.');
    res.redirect(`/programs/language-learning/general-english-boost/admindashboard/${course_id}/grading`);
});
