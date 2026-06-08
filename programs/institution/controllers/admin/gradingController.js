const { InstitutionCourse, InstitutionAssignmentSubmission, InstitutionFinalProjectSubmission } = require('../../models');
const catchAsync = require('../../../../shared/utilities/catchAsync');

module.exports.submissions = catchAsync(async (req, res) => {
    const { courseId } = req.params;

    const course = await InstitutionCourse.findOne({
        _id: courseId,
        institutionId: req.institution._id
    }).populate({ path: 'modules', select: 'title assignment order', options: { sort: { order: 1 } } });

    if (!course) {
        req.flash('error', 'Cours introuvable.');
        return res.redirect('/institution/dashboard/content');
    }

    const [assignmentSubs, finalProjectSubs] = await Promise.all([
        InstitutionAssignmentSubmission.find({ courseId, institutionId: req.institution._id })
            .populate('userId', 'name surname username')
            .sort({ createdAt: -1 })
            .lean(),
        InstitutionFinalProjectSubmission.find({ courseId, institutionId: req.institution._id })
            .populate('userId', 'name surname username')
            .sort({ createdAt: -1 })
            .lean()
    ]);

    const subsByModule = {};
    assignmentSubs.forEach(sub => {
        const mid = sub.moduleId.toString();
        if (!subsByModule[mid]) subsByModule[mid] = [];
        subsByModule[mid].push(sub);
    });

    res.render('institution-dashboard/content/courses/submissions', {
        course,
        subsByModule,
        finalProjectSubs,
        pendingCount: assignmentSubs.filter(s => s.status !== 'graded').length + finalProjectSubs.filter(s => s.status !== 'graded').length
    });
});

module.exports.gradeAssignment = catchAsync(async (req, res) => {
    const { courseId, submissionId } = req.params;
    const { grade, feedback } = req.body;

    const sub = await InstitutionAssignmentSubmission.findOne({
        _id: submissionId,
        courseId,
        institutionId: req.institution._id
    });

    if (!sub) {
        req.flash('error', 'Soumission introuvable.');
        return res.redirect(`/institution/dashboard/content/courses/${courseId}/submissions`);
    }

    sub.grade = parseFloat(grade);
    sub.feedback = feedback || '';
    sub.status = 'graded';
    await sub.save();

    req.flash('success', 'Devoir noté.');
    res.redirect(`/institution/dashboard/content/courses/${courseId}/submissions`);
});

module.exports.gradeFinalProject = catchAsync(async (req, res) => {
    const { courseId, submissionId } = req.params;
    const { grade, feedback } = req.body;

    const sub = await InstitutionFinalProjectSubmission.findOne({
        _id: submissionId,
        courseId,
        institutionId: req.institution._id
    });

    if (!sub) {
        req.flash('error', 'Soumission introuvable.');
        return res.redirect(`/institution/dashboard/content/courses/${courseId}/submissions`);
    }

    sub.grade = parseFloat(grade);
    sub.feedback = feedback || '';
    sub.status = 'graded';
    await sub.save();

    req.flash('success', 'Projet noté.');
    res.redirect(`/institution/dashboard/content/courses/${courseId}/submissions`);
});
