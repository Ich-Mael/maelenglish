const { InstitutionCourse, InstitutionModule, InstitutionLesson, InstitutionInstructor } = require('../../models');
const catchAsync = require('../../../../shared/utilities/catchAsync');

const base = (courseId, moduleId) => `/institution/dashboard/content/courses/${courseId}/modules/${moduleId}/edit`;

// ─── MODULE EDIT PAGE ─────────────────────────────────────────────────────────

module.exports.edit = catchAsync(async (req, res) => {
    const { courseId, moduleId } = req.params;
    const [course, courseModule, lessons, instructors] = await Promise.all([
        InstitutionCourse.findById(courseId),
        InstitutionModule.findById(moduleId),
        InstitutionLesson.find({ moduleId }).sort({ order: 1 }).populate('instructorId', 'name'),
        InstitutionInstructor.find({ institutionId: req.institution._id }).sort({ name: 1 }).select('name title')
    ]);

    if (!courseModule || !course) {
        req.flash('error', 'Module ou cours introuvable.');
        return res.redirect(`/institution/dashboard/content/courses/${courseId}`);
    }

    res.render('institution-dashboard/content/courses/editModule', { course, courseModule, lessons, instructors });
});

// ─── MODULE CREATE ────────────────────────────────────────────────────────────

module.exports.create = catchAsync(async (req, res) => {
    const { courseId } = req.params;
    const { title, description } = req.body;

    const course = await InstitutionCourse.findById(courseId);
    if (!course) {
        req.flash('error', 'Cours introuvable.');
        return res.redirect('/institution/dashboard/content');
    }

    if (!title) {
        req.flash('error', 'Le titre du module est requis.');
        return res.redirect(`/institution/dashboard/content/courses/${courseId}`);
    }

    const moduleOrder = course.modules.length + 1;
    const mod = await InstitutionModule.create({
        courseId,
        institutionId: course.institutionId,
        title: title.trim(),
        description: description || '',
        order: moduleOrder
    });

    course.modules.push(mod._id);
    await course.save();

    req.flash('success', `Module "${mod.title}" créé.`);
    res.redirect(base(courseId, mod._id));
});

// ─── MODULE UPDATE ────────────────────────────────────────────────────────────

module.exports.update = catchAsync(async (req, res) => {
    const { courseId, moduleId } = req.params;
    const { title, description } = req.body;

    const mod = await InstitutionModule.findById(moduleId);
    if (!mod) {
        req.flash('error', 'Module introuvable.');
        return res.redirect(`/institution/dashboard/content/courses/${courseId}`);
    }

    if (title) mod.title = title.trim();
    if (description !== undefined) mod.description = description;

    await mod.save();
    req.flash('success', 'Module mis à jour.');
    res.redirect(base(courseId, moduleId));
});

// ─── MODULE DELETE ────────────────────────────────────────────────────────────

module.exports.destroy = catchAsync(async (req, res) => {
    const { courseId, moduleId } = req.params;

    await InstitutionLesson.deleteMany({ moduleId });
    await InstitutionModule.findByIdAndDelete(moduleId);
    await InstitutionCourse.findByIdAndUpdate(courseId, { $pull: { modules: moduleId } });

    req.flash('success', 'Module supprimé.');
    res.redirect(`/institution/dashboard/content/courses/${courseId}`);
});

// ─── LESSON CREATE ────────────────────────────────────────────────────────────

module.exports.createLesson = catchAsync(async (req, res) => {
    const { courseId, moduleId } = req.params;
    const { title, type, description, videoUrl, videoDuration, fileUrl, fileName, content, instructorId } = req.body;

    if (!title || !type) {
        req.flash('error', 'Titre et type sont requis.');
        return res.redirect(base(courseId, moduleId));
    }

    const count = await InstitutionLesson.countDocuments({ moduleId });
    const lesson = await InstitutionLesson.create({
        moduleId,
        courseId,
        institutionId: (await InstitutionModule.findById(moduleId)).institutionId,
        title: title.trim(),
        type,
        description: description || '',
        order: count + 1,
        videoUrl: type === 'video' ? (videoUrl || '') : undefined,
        videoDuration: type === 'video' ? (parseInt(videoDuration) || 0) : undefined,
        fileUrl: type === 'pdf' ? (fileUrl || '') : undefined,
        fileName: type === 'pdf' ? (fileName || '') : undefined,
        content: type === 'text' ? (content || '') : undefined,
        instructorId: instructorId || undefined
    });

    await InstitutionModule.findByIdAndUpdate(moduleId, { $push: { lessons: lesson._id } });

    req.flash('success', 'Leçon créée.');
    res.redirect(base(courseId, moduleId));
});

// ─── LESSON UPDATE ────────────────────────────────────────────────────────────

module.exports.updateLesson = catchAsync(async (req, res) => {
    const { courseId, moduleId, lessonId } = req.params;
    const { title, description, videoUrl, videoDuration, fileUrl, fileName, content, instructorId } = req.body;

    const lesson = await InstitutionLesson.findOne({ _id: lessonId, moduleId });
    if (!lesson) {
        req.flash('error', 'Leçon introuvable.');
        return res.redirect(base(courseId, moduleId));
    }

    if (title) lesson.title = title.trim();
    if (description !== undefined) lesson.description = description;
    if (lesson.type === 'video') {
        if (videoUrl !== undefined) lesson.videoUrl = videoUrl;
        if (videoDuration !== undefined) lesson.videoDuration = parseInt(videoDuration) || 0;
    }
    if (lesson.type === 'pdf') {
        if (fileUrl !== undefined) lesson.fileUrl = fileUrl;
        if (fileName !== undefined) lesson.fileName = fileName;
    }
    if (lesson.type === 'text' && content !== undefined) lesson.content = content;
    lesson.instructorId = instructorId || null;

    await lesson.save();
    req.flash('success', 'Leçon mise à jour.');
    res.redirect(base(courseId, moduleId));
});

// ─── LESSON DELETE ────────────────────────────────────────────────────────────

module.exports.destroyLesson = catchAsync(async (req, res) => {
    const { courseId, moduleId, lessonId } = req.params;

    await InstitutionLesson.findOneAndDelete({ _id: lessonId, moduleId });
    await InstitutionModule.findByIdAndUpdate(moduleId, { $pull: { lessons: lessonId } });

    const remaining = await InstitutionLesson.find({ moduleId }).sort({ order: 1 });
    for (let i = 0; i < remaining.length; i++) {
        remaining[i].order = i + 1;
        await remaining[i].save();
    }

    req.flash('success', 'Leçon supprimée.');
    res.redirect(base(courseId, moduleId));
});

// ─── LESSON REORDER ───────────────────────────────────────────────────────────

module.exports.reorderLessons = catchAsync(async (req, res) => {
    const { moduleId } = req.params;
    const orderedIds = (req.body.orderedIds || '').split(',').filter(Boolean);

    for (let i = 0; i < orderedIds.length; i++) {
        await InstitutionLesson.findOneAndUpdate({ _id: orderedIds[i], moduleId }, { order: i + 1 });
    }
    await InstitutionModule.findByIdAndUpdate(moduleId, { lessons: orderedIds });

    res.json({ ok: true });
});

// ─── MODULE QUIZ ──────────────────────────────────────────────────────────────

module.exports.saveQuiz = catchAsync(async (req, res) => {
    const { courseId, moduleId } = req.params;
    const { title, passingScore, timeLimit, questions } = req.body;

    const mod = await InstitutionModule.findById(moduleId);
    if (!mod) {
        req.flash('error', 'Module introuvable.');
        return res.redirect(`/institution/dashboard/content/courses/${courseId}`);
    }

    const parsedQuestions = Object.values(questions || {}).map(q => ({
        text: q.text,
        options: Object.values(q.options || {}).map(o => ({ text: o.text, value: o.value })),
        correctAnswer: q.correctAnswer,
        explanation: q.explanation || ''
    })).filter(q => q.text);

    mod.quiz = {
        title: title || 'Quiz du module',
        passingScore: parseInt(passingScore) || 70,
        timeLimit: parseInt(timeLimit) || 0,
        questions: parsedQuestions
    };

    await mod.save();
    req.flash('success', 'Quiz sauvegardé.');
    res.redirect(base(courseId, moduleId));
});

// ─── MODULE ASSIGNMENT ────────────────────────────────────────────────────────

module.exports.saveAssignment = catchAsync(async (req, res) => {
    const { courseId, moduleId } = req.params;
    const { title, instructions, submissionType, maxScore, dueDate } = req.body;

    const mod = await InstitutionModule.findById(moduleId);
    if (!mod) {
        req.flash('error', 'Module introuvable.');
        return res.redirect(`/institution/dashboard/content/courses/${courseId}`);
    }

    mod.assignment = {
        title: title || '',
        instructions: instructions || '',
        submissionType: submissionType || 'text',
        maxScore: parseInt(maxScore) || 100,
        dueDate: dueDate ? new Date(dueDate) : null
    };

    await mod.save();
    req.flash('success', 'Devoir sauvegardé.');
    res.redirect(base(courseId, moduleId));
});

// ─── LESSON PRACTICE QUIZ EDITOR ──────────────────────────────────────────────

module.exports.getPracticeQuizEditor = catchAsync(async (req, res) => {
    const { courseId, moduleId, lessonId } = req.params;
    const [course, courseModule, lesson] = await Promise.all([
        InstitutionCourse.findById(courseId),
        InstitutionModule.findById(moduleId),
        InstitutionLesson.findOne({ _id: lessonId, moduleId })
    ]);

    if (!course || !courseModule || !lesson) {
        req.flash('error', 'Cours, module ou leçon introuvable.');
        return res.redirect(`/institution/dashboard/content/courses/${courseId}`);
    }

    if (lesson.type !== 'practice_quiz') {
        req.flash('error', 'Cette leçon n\'est pas un quiz de pratique.');
        return res.redirect(base(courseId, moduleId));
    }

    res.render('institution-dashboard/content/courses/editPracticeQuiz', { course, courseModule, lesson });
});

// ─── LESSON PRACTICE QUIZ SAVE ────────────────────────────────────────────────

module.exports.savePracticeQuiz = catchAsync(async (req, res) => {
    const { courseId, moduleId, lessonId } = req.params;
    const { questions } = req.body;

    const lesson = await InstitutionLesson.findOne({ _id: lessonId, moduleId });
    if (!lesson) {
        req.flash('error', 'Leçon introuvable.');
        return res.redirect(base(courseId, moduleId));
    }

    const parsedQuestions = Object.values(questions || {}).map(q => ({
        text: q.text,
        options: Object.values(q.options || {}).map(o => ({ text: o.text, value: o.value })),
        correctAnswer: q.correctAnswer,
        explanation: q.explanation || ''
    })).filter(q => q.text);

    lesson.practiceQuiz = {
        questions: parsedQuestions
    };

    await lesson.save();
    req.flash('success', 'Quiz de pratique sauvegardé.');
    res.redirect(base(courseId, moduleId));
});
