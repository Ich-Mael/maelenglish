const { Course, Module } = require('../../../shared/models/courses');
const Lesson = require('../../../shared/models/lesson');
const LessonProgress = require('../../../shared/models/lessonProgress');
const QuizAttempt = require('../../../shared/models/quizAttempt');
const AssignmentSubmission = require('../../../shared/models/assignmentSubmission');
const User = require('../../../shared/models/user');
const catchAsync = require('../../../shared/utilities/catchAsync');
const Emailer = require('../../../shared/utilities/sendEmail');
const { getBaseUrl } = require('../../../shared/utilities/url');

const GEB_BASE = '/programs/language-learning/general-english-boost';

// ─── CHALLENGE NOTIFICATIONS ────────────────────────────────────────────────────

// Notify the course's coaches/instructors that a challenge checkpoint awaits review.
async function notifyCheckpointSubmitted(req, course, courseModule) {
    const instructorIds = (course.instructors || []).map(i => i._id || i);
    if (!instructorIds.length) return;
    const coaches = await User.find({ _id: { $in: instructorIds }, email: { $ne: null } }).select('name email');
    const student = req.user;
    const studentName = `${student.surname || ''} ${student.name || ''}`.trim() || student.username;
    const gradingUrl = `${getBaseUrl(req)}${GEB_BASE}/admindashboard/${course._id}/grading`;
    await Promise.all(coaches.map(coach =>
        new Emailer(coach, gradingUrl).sendChallengeSubmission({
            courseTitle: course.title,
            dayTitle: courseModule.title,
            studentName,
        }).catch(e => console.error('challenge submit email failed:', e.message))
    ));
}

// Notify the student that their checkpoint was approved (next day unlocked) or returned (redo).
async function notifyGradeResult(req, submission, isReturn) {
    const student = submission.userId; // populated {name,surname,username,email}
    if (!student || !student.email) return;
    const course = await Course.findById(submission.courseId).select('title');
    const challengeUrl = `${getBaseUrl(req)}${GEB_BASE}/${submission.courseId}/challenge`;
    await new Emailer(student, challengeUrl).sendChallengeResult({
        courseTitle: course ? course.title : 'English Challenge',
        dayTitle: submission.moduleId ? submission.moduleId.title : 'le point de contrôle',
        approved: !isReturn,
        feedback: submission.feedback || '',
    });
}

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

    // On a challenge, this is the day's checkpoint → notify the coach(es) and send
    // the student back to the day timeline (the next day stays locked until review).
    const course = await Course.findById(course_id).select('title isChallenge instructors');
    if (course && course.isChallenge) {
        try { await notifyCheckpointSubmitted(req, course, courseModule); }
        catch (e) { console.error('challenge submit email failed:', e.message); }
        req.flash('success', 'Point de contrôle soumis. En attente de la validation de votre coach.');
        return res.redirect(`/programs/language-learning/general-english-boost/${course_id}/challenge`);
    }

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
    const { grade, feedback, action } = req.body;

    // `action === 'return'` sends the checkpoint back for redo (status 'returned'),
    // which keeps the next challenge day locked. Otherwise it is approved
    // (status 'graded'), which unlocks the next day. Grade is optional on approve.
    const isReturn = action === 'return';
    const update = isReturn
        ? { status: 'returned', feedback: feedback || '', gradedBy: req.user._id, gradedAt: new Date() }
        : {
            status:   'graded',
            grade:    (grade !== undefined && grade !== '' && grade !== null) ? parseFloat(grade) : 100,
            feedback: feedback || '',
            gradedBy: req.user._id,
            gradedAt: new Date()
          };

    const submission = await AssignmentSubmission.findByIdAndUpdate(submission_id, update, { new: true })
        .populate('userId', 'name surname username email')
        .populate('moduleId', 'title');

    // Notify the student of the outcome (approved → next day unlocked / returned → redo).
    if (submission) {
        try { await notifyGradeResult(req, submission, isReturn); } catch (e) { console.error('challenge grade email failed:', e.message); }
    }

    req.flash('success', isReturn ? "Devoir renvoyé à l'élève pour correction." : 'Devoir validé — le jour suivant est débloqué.');
    res.redirect(`/programs/language-learning/general-english-boost/admindashboard/${course_id}/grading`);
});
