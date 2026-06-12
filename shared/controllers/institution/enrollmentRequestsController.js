const InstitutionEnrollmentRequest = require('../../../programs/institution/models/EnrollmentRequest');
const InstitutionCourse = require('../../../programs/institution/models/Course');
const catchAsync = require('../../utilities/catchAsync');

module.exports.index = catchAsync(async (req, res) => {
    const { status } = req.query;
    const filter = { institutionId: req.institution._id };
    if (status && ['pending', 'contacted', 'enrolled', 'rejected'].includes(status)) {
        filter.status = status;
    }

    const [requests, counts] = await Promise.all([
        InstitutionEnrollmentRequest.find(filter)
            .populate('courseId', 'title')
            .sort({ createdAt: -1 })
            .lean(),
        InstitutionEnrollmentRequest.aggregate([
            { $match: { institutionId: req.institution._id } },
            { $group: { _id: '$status', count: { $sum: 1 } } }
        ])
    ]);

    const countMap = { pending: 0, contacted: 0, enrolled: 0, rejected: 0 };
    counts.forEach(c => { if (countMap[c._id] !== undefined) countMap[c._id] = c.count; });

    res.render('institution-dashboard/requests', {
        institution: req.institution,
        requests,
        countMap,
        activeStatus: status || ''
    });
});

module.exports.updateStatus = catchAsync(async (req, res) => {
    const { id } = req.params;
    const { status, notes } = req.body;

    const request = await InstitutionEnrollmentRequest.findOne({
        _id: id,
        institutionId: req.institution._id
    });

    if (!request) {
        req.flash('error', 'Demande introuvable.');
        return res.redirect('/institution/dashboard/requests');
    }

    if (status && ['pending', 'contacted', 'enrolled', 'rejected'].includes(status)) {
        request.status = status;
    }
    if (notes !== undefined) request.notes = notes.trim();
    await request.save();

    req.flash('success', 'Statut mis à jour.');
    res.redirect('/institution/dashboard/requests');
});

module.exports.destroy = catchAsync(async (req, res) => {
    await InstitutionEnrollmentRequest.findOneAndDelete({
        _id: req.params.id,
        institutionId: req.institution._id
    });
    req.flash('success', 'Demande supprimée.');
    res.redirect('/institution/dashboard/requests');
});
