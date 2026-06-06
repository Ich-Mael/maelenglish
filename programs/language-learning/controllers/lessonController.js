const { Course, Module } = require('../../../shared/models/courses');
const Lesson = require('../../../shared/models/lesson');
const catchAsync = require('../../../shared/utilities/catchAsync');

// ─── CREATE ───────────────────────────────────────────────────────────────────

module.exports.create = catchAsync(async (req, res) => {
    const { course_id, module_id } = req.params;
    const { title, type, description, videoUrl, videoDuration, content, fileUrl, fileName } = req.body;

    const courseModule = await Module.findById(module_id);
    if (!courseModule) {
        req.flash('error', 'Module introuvable.');
        return res.redirect(`/programs/language-learning/general-english-boost/admindashboard/${course_id}/modules`);
    }

    // Order = next after existing lessons
    const order = (courseModule.lessons || []).length + 1;

    const lesson = await Lesson.create({
        moduleId: module_id,
        courseId: course_id,
        title: title.trim(),
        type,
        order,
        description: description || '',
        videoUrl:       type === 'video'  ? (videoUrl || '')   : '',
        videoDuration:  type === 'video'  ? (parseInt(videoDuration) || 0) : 0,
        content:        type === 'text'   ? (content || '')    : '',
        fileUrl:        type === 'pdf'    ? (fileUrl || '')    : '',
        fileName:       type === 'pdf'    ? (fileName || '')   : '',
        practiceQuiz:   type === 'practice_quiz' ? { questions: [] } : undefined
    });

    courseModule.lessons.push(lesson._id);
    await courseModule.save();

    req.flash('success', `Leçon "${lesson.title}" créée.`);
    res.redirect(`/programs/language-learning/general-english-boost/admindashboard/${course_id}/modules/${module_id}/edit`);
});

// ─── UPDATE ───────────────────────────────────────────────────────────────────

module.exports.update = catchAsync(async (req, res) => {
    const { course_id, module_id, lesson_id } = req.params;
    const { title, description, videoUrl, videoDuration, content, fileUrl, fileName } = req.body;

    const lesson = await Lesson.findOne({ _id: lesson_id, moduleId: module_id });
    if (!lesson) {
        req.flash('error', 'Leçon introuvable.');
        return res.redirect(`/programs/language-learning/general-english-boost/admindashboard/${course_id}/modules/${module_id}/edit`);
    }

    lesson.title       = title ? title.trim() : lesson.title;
    lesson.description = description !== undefined ? description : lesson.description;

    if (lesson.type === 'video') {
        if (videoUrl  !== undefined) lesson.videoUrl      = videoUrl;
        if (videoDuration !== undefined) lesson.videoDuration = parseInt(videoDuration) || 0;
    }
    if (lesson.type === 'text'  && content  !== undefined) lesson.content  = content;
    if (lesson.type === 'pdf') {
        if (fileUrl  !== undefined) lesson.fileUrl  = fileUrl;
        if (fileName !== undefined) lesson.fileName = fileName;
    }

    await lesson.save();

    req.flash('success', 'Leçon mise à jour.');
    res.redirect(`/programs/language-learning/general-english-boost/admindashboard/${course_id}/modules/${module_id}/edit`);
});

// ─── DELETE ───────────────────────────────────────────────────────────────────

module.exports.destroy = catchAsync(async (req, res) => {
    const { course_id, module_id, lesson_id } = req.params;

    await Lesson.findByIdAndDelete(lesson_id);

    // Remove from module lessons array
    await Module.findByIdAndUpdate(module_id, { $pull: { lessons: lesson_id } });

    // Re-number remaining lessons
    const remaining = await Lesson.find({ moduleId: module_id }).sort({ order: 1 });
    for (let i = 0; i < remaining.length; i++) {
        remaining[i].order = i + 1;
        await remaining[i].save();
    }

    req.flash('success', 'Leçon supprimée.');
    res.redirect(`/programs/language-learning/general-english-boost/admindashboard/${course_id}/modules/${module_id}/edit`);
});

// ─── REORDER ──────────────────────────────────────────────────────────────────

module.exports.reorder = catchAsync(async (req, res) => {
    const { course_id, module_id } = req.params;
    // orderedIds: comma-separated lesson IDs in new order
    const orderedIds = (req.body.orderedIds || '').split(',').filter(Boolean);

    for (let i = 0; i < orderedIds.length; i++) {
        await Lesson.findOneAndUpdate(
            { _id: orderedIds[i], moduleId: module_id },
            { order: i + 1 }
        );
    }

    // Sync module.lessons array order
    await Module.findByIdAndUpdate(module_id, { lessons: orderedIds });

    res.json({ ok: true });
});

// ─── SAVE PRACTICE QUIZ ───────────────────────────────────────────────────────

module.exports.savePracticeQuiz = catchAsync(async (req, res) => {
    const { course_id, module_id, lesson_id } = req.params;
    const { questions } = req.body;

    const lesson = await Lesson.findOne({ _id: lesson_id, moduleId: module_id, type: 'practice_quiz' });
    if (!lesson) {
        req.flash('error', 'Leçon introuvable.');
        return res.redirect(`/programs/language-learning/general-english-boost/admindashboard/${course_id}/modules/${module_id}/edit`);
    }

    const parsed = (Array.isArray(questions) ? questions : [questions]).map((q, idx) => ({
        text:          q.text || '',
        correctAnswer: q.correctAnswer || '',
        explanation:   q.explanation || '',
        options:       (Array.isArray(q.options) ? q.options : []).map((opt, oi) => ({
            id:    String(oi),
            text:  opt.text  || '',
            value: opt.value || String(oi)
        }))
    }));

    lesson.practiceQuiz = { questions: parsed };
    await lesson.save();

    req.flash('success', 'Quiz de pratique sauvegardé.');
    res.redirect(`/programs/language-learning/general-english-boost/admindashboard/${course_id}/modules/${module_id}/edit`);
});
