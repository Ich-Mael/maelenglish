const { Course, Module } = require('../../models/courses');
const Lesson             = require('../../models/lesson');
const catchAsync         = require('../../utilities/catchAsync');

const base = (courseId, moduleId) =>
    `/admin/courses/${courseId}/modules/${moduleId}/edit`;

// ─── MODULE EDIT PAGE ─────────────────────────────────────────────────────────

module.exports.edit = catchAsync(async (req, res) => {
    const { courseId, moduleId } = req.params;

    const [course, courseModule, lessons] = await Promise.all([
        Course.findById(courseId),
        Module.findById(moduleId),
        Lesson.find({ moduleId }).sort({ order: 1 })
    ]);

    if (!courseModule || !course) {
        req.flash('error', 'Module ou cours introuvable.');
        return res.redirect(`/admin/courses/${courseId}`);
    }

    res.render('admin/courses/editModule', { course, courseModule, lessons });
});

// ─── MODULE UPDATE ────────────────────────────────────────────────────────────

module.exports.update = catchAsync(async (req, res) => {
    const { courseId, moduleId } = req.params;
    const { title, willLearnModule, explanationText, moreDetails, revealDate } = req.body.module || req.body;

    const mod = await Module.findById(moduleId);
    if (!mod) {
        req.flash('error', 'Module introuvable.');
        return res.redirect(`/admin/courses/${courseId}`);
    }

    if (title)             mod.title           = title.trim();
    if (willLearnModule !== undefined) mod.willLearnModule = willLearnModule;
    if (explanationText  !== undefined) mod.explanationText = explanationText;
    if (moreDetails      !== undefined) mod.moreDetails     = moreDetails;
    if (revealDate)        mod.revealDate       = new Date(revealDate);

    await mod.save();
    req.flash('success', 'Module mis à jour.');
    res.redirect(base(courseId, moduleId));
});

// ─── MODULE DELETE ────────────────────────────────────────────────────────────

module.exports.destroy = catchAsync(async (req, res) => {
    const { courseId, moduleId } = req.params;

    await Lesson.deleteMany({ moduleId });
    await Module.findByIdAndDelete(moduleId);
    await Course.findByIdAndUpdate(courseId, { $pull: { modules: moduleId } });

    req.flash('success', 'Module supprimé.');
    res.redirect(`/admin/courses/${courseId}`);
});

// ─── LESSON CREATE ────────────────────────────────────────────────────────────

module.exports.createLesson = catchAsync(async (req, res) => {
    const { courseId, moduleId } = req.params;
    const { title, type, description, videoUrl, videoDuration, fileUrl, fileName, content } = req.body;

    if (!title || !type) {
        req.flash('error', 'Titre et type sont requis.');
        return res.redirect(base(courseId, moduleId));
    }

    const count = await Lesson.countDocuments({ moduleId });
    const lesson = await Lesson.create({
        moduleId, courseId, title: title.trim(), type,
        description: description || '',
        order: count + 1,
        videoUrl:      type === 'video' ? (videoUrl || '') : undefined,
        videoDuration: type === 'video' ? (parseInt(videoDuration) || 0) : undefined,
        fileUrl:       type === 'pdf'   ? (fileUrl || '') : undefined,
        fileName:      type === 'pdf'   ? (fileName || '') : undefined,
        content:       type === 'text'  ? (content || '') : undefined
    });

    await Module.findByIdAndUpdate(moduleId, { $push: { lessons: lesson._id } });

    req.flash('success', 'Leçon créée.');
    res.redirect(base(courseId, moduleId));
});

// ─── LESSON UPDATE ────────────────────────────────────────────────────────────

module.exports.updateLesson = catchAsync(async (req, res) => {
    const { courseId, moduleId, lessonId } = req.params;
    const { title, description, videoUrl, videoDuration, fileUrl, fileName, content } = req.body;

    const lesson = await Lesson.findOne({ _id: lessonId, moduleId });
    if (!lesson) {
        req.flash('error', 'Leçon introuvable.');
        return res.redirect(base(courseId, moduleId));
    }

    if (title)                         lesson.title         = title.trim();
    if (description !== undefined)     lesson.description   = description;
    if (lesson.type === 'video') {
        if (videoUrl     !== undefined) lesson.videoUrl      = videoUrl;
        if (videoDuration !== undefined) lesson.videoDuration = parseInt(videoDuration) || 0;
    }
    if (lesson.type === 'pdf') {
        if (fileUrl  !== undefined) lesson.fileUrl  = fileUrl;
        if (fileName !== undefined) lesson.fileName = fileName;
    }
    if (lesson.type === 'text' && content !== undefined) lesson.content = content;

    await lesson.save();
    req.flash('success', 'Leçon mise à jour.');
    res.redirect(base(courseId, moduleId));
});

// ─── LESSON DELETE ────────────────────────────────────────────────────────────

module.exports.destroyLesson = catchAsync(async (req, res) => {
    const { courseId, moduleId, lessonId } = req.params;

    await Lesson.findOneAndDelete({ _id: lessonId, moduleId });
    await Module.findByIdAndUpdate(moduleId, { $pull: { lessons: lessonId } });

    // Re-number remaining lessons
    const remaining = await Lesson.find({ moduleId }).sort({ order: 1 });
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
        await Lesson.findOneAndUpdate({ _id: orderedIds[i], moduleId }, { order: i + 1 });
    }
    await Module.findByIdAndUpdate(moduleId, { lessons: orderedIds });

    res.json({ ok: true });
});

// ─── MODULE QUIZ ──────────────────────────────────────────────────────────────

module.exports.saveQuiz = catchAsync(async (req, res) => {
    const { courseId, moduleId } = req.params;
    const { title, passingScore, timeLimit, questions } = req.body;

    const mod = await Module.findById(moduleId);
    if (!mod) {
        req.flash('error', 'Module introuvable.');
        return res.redirect(base(courseId, moduleId));
    }

    const parsedQuestions = Object.values(questions || {}).map(q => ({
        text:          q.text,
        options:       Object.values(q.options || {}).map(o => ({ text: o.text, value: o.value })),
        correctAnswer: q.correctAnswer,
        explanation:   q.explanation || ''
    })).filter(q => q.text);

    mod.moduleQuiz = {
        title:        title || 'Quiz du module',
        passingScore: parseInt(passingScore) || 70,
        timeLimit:    parseInt(timeLimit)    || 0,
        questions:    parsedQuestions
    };

    await mod.save();
    req.flash('success', 'Quiz sauvegardé.');
    res.redirect(base(courseId, moduleId));
});

// ─── MODULE ASSIGNMENT ────────────────────────────────────────────────────────

module.exports.saveAssignment = catchAsync(async (req, res) => {
    const { courseId, moduleId } = req.params;
    const { title, instructions, submissionType, maxScore, dueDate } = req.body;

    const mod = await Module.findById(moduleId);
    if (!mod) {
        req.flash('error', 'Module introuvable.');
        return res.redirect(base(courseId, moduleId));
    }

    mod.moduleAssignment = {
        title:          title || '',
        instructions:   instructions || '',
        submissionType: submissionType || 'text',
        maxScore:       parseInt(maxScore) || 100,
        dueDate:        dueDate ? new Date(dueDate) : null
    };

    await mod.save();
    req.flash('success', 'Devoir sauvegardé.');
    res.redirect(base(courseId, moduleId));
});
