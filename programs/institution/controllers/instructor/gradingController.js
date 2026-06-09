const {
    InstitutionCourse,
    InstitutionAssignmentSubmission,
    InstitutionFinalProjectSubmission
} = require('../../models');
const catchAsync = require('../../../../shared/utilities/catchAsync');

// Home: list courses assigned to this instructor with pending submission counts
module.exports.home = catchAsync(async (req, res) => {
    const courses = await InstitutionCourse.find({
        institutionId: req.institution._id,
        instructors: req.instructor._id
    }).select('title isActive imageUrl').lean();

    const courseIds = courses.map(c => c._id);

    const [pendingAssignments, pendingProjects] = await Promise.all([
        InstitutionAssignmentSubmission.aggregate([
            { $match: { courseId: { $in: courseIds }, status: 'submitted' } },
            { $group: { _id: '$courseId', count: { $sum: 1 } } }
        ]),
        InstitutionFinalProjectSubmission.aggregate([
            { $match: { courseId: { $in: courseIds }, status: 'submitted' } },
            { $group: { _id: '$courseId', count: { $sum: 1 } } }
        ])
    ]);

    const pendingAssignMap = Object.fromEntries(pendingAssignments.map(r => [r._id.toString(), r.count]));
    const pendingProjectMap = Object.fromEntries(pendingProjects.map(r => [r._id.toString(), r.count]));

    const coursesWithCounts = courses.map(c => ({
        course: c,
        pendingAssignments: pendingAssignMap[c._id.toString()] || 0,
        pendingProjects:    pendingProjectMap[c._id.toString()] || 0
    }));

    res.render('institution-dashboard/grade/index', {
        coursesWithCounts,
        institution: req.institution
    });
});

// Submissions for a course: assignments + final projects
module.exports.courseSubmissions = catchAsync(async (req, res) => {
    const { courseId } = req.params;

    const course = await InstitutionCourse.findOne({
        _id: courseId,
        institutionId: req.institution._id,
        instructors: req.instructor._id
    }).populate('modules', 'title order');

    if (!course) {
        req.flash('error', 'Cours introuvable ou accès non autorisé.');
        return res.redirect('/institution/grade');
    }

    const [assignmentSubs, projectSubs] = await Promise.all([
        InstitutionAssignmentSubmission.find({ courseId })
            .populate('userId', 'name surname username')
            .sort({ submittedAt: 1 })
            .lean(),
        InstitutionFinalProjectSubmission.find({ courseId })
            .populate('userId', 'name surname username')
            .sort({ submittedAt: 1 })
            .lean()
    ]);

    // Group assignment subs by moduleId
    const moduleMap = Object.fromEntries((course.modules || []).map(m => [m._id.toString(), m]));
    const assignmentsByModule = {};
    assignmentSubs.forEach(s => {
        const mid = s.moduleId.toString();
        if (!assignmentsByModule[mid]) assignmentsByModule[mid] = [];
        assignmentsByModule[mid].push(s);
    });

    res.render('institution-dashboard/grade/submissions', {
        course,
        moduleMap,
        assignmentsByModule,
        projectSubs,
        institution: req.institution
    });
});

// Grade an assignment submission
module.exports.gradeAssignment = catchAsync(async (req, res) => {
    const { courseId, submissionId } = req.params;
    const { grade, feedback } = req.body;

    // Verify instructor is assigned to this course
    const course = await InstitutionCourse.findOne({
        _id: courseId,
        institutionId: req.institution._id,
        instructors: req.instructor._id
    });
    if (!course) return res.status(403).json({ ok: false, error: 'Accès non autorisé.' });

    const sub = await InstitutionAssignmentSubmission.findOne({ _id: submissionId, courseId });
    if (!sub) return res.status(404).json({ ok: false, error: 'Soumission introuvable.' });

    sub.grade    = parseFloat(grade) || 0;
    sub.feedback = feedback || '';
    sub.status   = 'graded';
    sub.gradedBy = req.instructor._id;
    sub.gradedAt = new Date();
    await sub.save();

    req.flash('success', 'Devoir noté.');
    res.redirect(`/institution/grade/courses/${courseId}/submissions`);
});

// Grade a final project submission
module.exports.gradeFinalProject = catchAsync(async (req, res) => {
    const { courseId, submissionId } = req.params;
    const { grade, feedback } = req.body;

    const course = await InstitutionCourse.findOne({
        _id: courseId,
        institutionId: req.institution._id,
        instructors: req.instructor._id
    });
    if (!course) return res.status(403).json({ ok: false, error: 'Accès non autorisé.' });

    const sub = await InstitutionFinalProjectSubmission.findOne({ _id: submissionId, courseId });
    if (!sub) return res.status(404).json({ ok: false, error: 'Soumission introuvable.' });

    sub.grade    = parseFloat(grade) || 0;
    sub.feedback = feedback || '';
    sub.status   = 'graded';
    sub.gradedBy = req.instructor._id;
    sub.gradedAt = new Date();
    await sub.save();

    req.flash('success', 'Projet final noté.');
    res.redirect(`/institution/grade/courses/${courseId}/submissions`);
});
