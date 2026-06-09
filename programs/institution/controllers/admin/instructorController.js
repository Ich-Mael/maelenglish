const { InstitutionInstructor } = require('../../models');
const catchAsync = require('../../../../shared/utilities/catchAsync');

const base = '/institution/dashboard/content/instructors';

module.exports.index = catchAsync(async (req, res) => {
    const instructors = await InstitutionInstructor.find({
        institutionId: req.institution._id
    }).sort({ name: 1 });

    res.render('institution-dashboard/content/instructors/index', { instructors });
});

module.exports.new = (req, res) => {
    res.render('institution-dashboard/content/instructors/new');
};

module.exports.create = catchAsync(async (req, res) => {
    const { name, title, bio, photoUrl, email } = req.body;

    if (!name || !name.trim()) {
        req.flash('error', 'Le nom est requis.');
        return res.redirect(`${base}/new`);
    }

    await InstitutionInstructor.create({
        institutionId: req.institution._id,
        name: name.trim(),
        title: title ? title.trim() : '',
        bio: bio || '',
        photoUrl: photoUrl ? photoUrl.trim() : '',
        email: email ? email.trim() : '',
        createdBy: req.user._id
    });

    req.flash('success', `Instructeur "${name.trim()}" créé.`);
    res.redirect(base);
});

module.exports.edit = catchAsync(async (req, res) => {
    const instructor = await InstitutionInstructor.findOne({
        _id: req.params.id,
        institutionId: req.institution._id
    });

    if (!instructor) {
        req.flash('error', 'Instructeur introuvable.');
        return res.redirect(base);
    }

    res.render('institution-dashboard/content/instructors/edit', { instructor });
});

module.exports.update = catchAsync(async (req, res) => {
    const { name, title, bio, photoUrl, email } = req.body;

    const instructor = await InstitutionInstructor.findOne({
        _id: req.params.id,
        institutionId: req.institution._id
    });

    if (!instructor) {
        req.flash('error', 'Instructeur introuvable.');
        return res.redirect(base);
    }

    if (name) instructor.name = name.trim();
    instructor.title   = title ? title.trim() : '';
    instructor.bio     = bio || '';
    instructor.photoUrl = photoUrl ? photoUrl.trim() : '';
    instructor.email   = email ? email.trim() : '';

    await instructor.save();
    req.flash('success', 'Instructeur mis à jour.');
    res.redirect(base);
});

module.exports.destroy = catchAsync(async (req, res) => {
    await InstitutionInstructor.findOneAndDelete({
        _id: req.params.id,
        institutionId: req.institution._id
    });

    req.flash('success', 'Instructeur supprimé.');
    res.redirect(base);
});
