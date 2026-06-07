const { InstitutionCourse } = require('../../models');
const catchAsync = require('../../../../shared/utilities/catchAsync');

module.exports.index = catchAsync(async (req, res) => {
    const courses = await InstitutionCourse.find({ institutionId: req.institution._id })
        .select('title isActive modules createdAt')
        .sort({ createdAt: -1 });
    res.render('institution-dashboard/content/courses/index', { courses });
});

module.exports.new = catchAsync(async (req, res) => {
    res.render('institution-dashboard/content/courses/new');
});

module.exports.create = catchAsync(async (req, res) => {
    const { title, description, imageUrl } = req.body;
    const course = await InstitutionCourse.create({
        institutionId: req.institution._id,
        title: title.trim(),
        description: description || '',
        imageUrl: imageUrl || '',
        createdBy: req.user._id
    });
    req.flash('success', `Cours "${course.title}" créé.`);
    res.redirect(`/institution/dashboard/content/courses/${course._id}`);
});

module.exports.show = catchAsync(async (req, res) => {
    const course = await InstitutionCourse.findOne({
        _id: req.params.id,
        institutionId: req.institution._id
    }).populate('modules');

    if (!course) {
        req.flash('error', 'Cours introuvable.');
        return res.redirect('/institution/dashboard/content');
    }

    res.render('institution-dashboard/content/courses/show', { course });
});

module.exports.edit = catchAsync(async (req, res) => {
    const course = await InstitutionCourse.findOne({
        _id: req.params.id,
        institutionId: req.institution._id
    });

    if (!course) {
        req.flash('error', 'Cours introuvable.');
        return res.redirect('/institution/dashboard/content');
    }

    res.render('institution-dashboard/content/courses/edit', { course });
});

module.exports.update = catchAsync(async (req, res) => {
    const { title, description, imageUrl, isActive } = req.body;
    const course = await InstitutionCourse.findOne({
        _id: req.params.id,
        institutionId: req.institution._id
    });

    if (!course) {
        req.flash('error', 'Cours introuvable.');
        return res.redirect('/institution/dashboard/content');
    }

    if (title) course.title = title.trim();
    if (description !== undefined) course.description = description;
    if (imageUrl !== undefined) course.imageUrl = imageUrl;
    course.isActive = isActive === 'on' || isActive === 'true';

    await course.save();
    req.flash('success', 'Cours mis à jour.');
    res.redirect(`/institution/dashboard/content/courses/${course._id}`);
});

module.exports.destroy = catchAsync(async (req, res) => {
    const course = await InstitutionCourse.findOne({
        _id: req.params.id,
        institutionId: req.institution._id
    });

    if (!course) {
        req.flash('error', 'Cours introuvable.');
        return res.redirect('/institution/dashboard/content');
    }

    await InstitutionCourse.findByIdAndDelete(course._id);
    req.flash('success', 'Cours supprimé.');
    res.redirect('/institution/dashboard/content');
});

module.exports.saveFinalExam = catchAsync(async (req, res) => {
    const { title, passingScore, timeLimit, questions } = req.body;
    const course = await InstitutionCourse.findOne({
        _id: req.params.id,
        institutionId: req.institution._id
    });

    if (!course) {
        req.flash('error', 'Cours introuvable.');
        return res.redirect('/institution/dashboard/content');
    }

    const parsedQuestions = Object.values(questions || {}).map(q => ({
        text: q.text,
        options: Object.values(q.options || {}).map(o => ({ text: o.text, value: o.value })),
        correctAnswer: q.correctAnswer,
        explanation: q.explanation || ''
    })).filter(q => q.text);

    course.finalExam = {
        title: title || 'Examen final',
        passingScore: parseInt(passingScore) || 70,
        timeLimit: parseInt(timeLimit) || 0,
        questions: parsedQuestions
    };

    await course.save();
    req.flash('success', 'Examen final sauvegardé.');
    res.redirect(`/institution/dashboard/content/courses/${course._id}`);
});

module.exports.saveFinalProject = catchAsync(async (req, res) => {
    const { title, instructions, submissionType, maxScore, dueDate } = req.body;
    const course = await InstitutionCourse.findOne({
        _id: req.params.id,
        institutionId: req.institution._id
    });

    if (!course) {
        req.flash('error', 'Cours introuvable.');
        return res.redirect('/institution/dashboard/content');
    }

    course.finalProject = {
        title: title || 'Projet final',
        instructions: instructions || '',
        submissionType: submissionType || 'text',
        maxScore: parseInt(maxScore) || 100,
        dueDate: dueDate ? new Date(dueDate) : null
    };

    await course.save();
    req.flash('success', 'Projet final sauvegardé.');
    res.redirect(`/institution/dashboard/content/courses/${course._id}`);
});
