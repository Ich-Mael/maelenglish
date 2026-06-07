const Announcement = require('../../models/announcement');
const catchAsync   = require('../../utilities/catchAsync');

// GET /institution/dashboard/announcements
module.exports.index = catchAsync(async (req, res) => {
    const announcements = await Announcement.find({ institutionId: req.institution._id })
        .sort({ isPinned: -1, createdAt: -1 });

    res.render('institution-dashboard/announcements', {
        institution: req.institution,
        announcements
    });
});

// POST /institution/dashboard/announcements
module.exports.create = catchAsync(async (req, res) => {
    const { title, body, type, isPinned } = req.body;

    if (!title || !title.trim() || !body || !body.trim()) {
        req.flash('error', 'Titre et contenu sont requis.');
        return res.redirect('/institution/dashboard/announcements');
    }

    await Announcement.create({
        institutionId: req.institution._id,
        title:         title.trim(),
        body:          body.trim(),
        type:          type || 'info',
        isPinned:      isPinned === 'on',
        isPublished:   true,
        createdBy:     req.user._id
    });

    req.flash('success', 'Annonce publiée.');
    res.redirect('/institution/dashboard/announcements');
});

// DELETE /institution/dashboard/announcements/:id
module.exports.destroy = catchAsync(async (req, res) => {
    await Announcement.findOneAndDelete({
        _id:           req.params.id,
        institutionId: req.institution._id
    });
    req.flash('success', 'Annonce supprimée.');
    res.redirect('/institution/dashboard/announcements');
});

// POST /institution/dashboard/announcements/:id/pin
module.exports.togglePin = catchAsync(async (req, res) => {
    const ann = await Announcement.findOne({ _id: req.params.id, institutionId: req.institution._id });
    if (ann) {
        ann.isPinned = !ann.isPinned;
        await ann.save();
    }
    res.redirect('/institution/dashboard/announcements');
});
