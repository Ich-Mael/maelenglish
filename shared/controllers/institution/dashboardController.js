const { InstitutionCourse, InstitutionEnrollment } = require('../../../programs/institution/models');
const Institution = require('../../models/institution');
const catchAsync = require('../../utilities/catchAsync');

module.exports.home = catchAsync(async (req, res) => {
    const now = new Date();

    const [courseCount, studentIds, activeEnrollments] = await Promise.all([
        InstitutionCourse.countDocuments({ institutionId: req.institution._id }),
        InstitutionEnrollment.distinct('userId', { institutionId: req.institution._id }),
        InstitutionEnrollment.countDocuments({
            institutionId: req.institution._id,
            status: 'active',
            $or: [{ endDate: null }, { endDate: { $gte: now } }]
        })
    ]);

    res.render('institution-dashboard/home', {
        institution: req.institution,
        stats: {
            studentCount: studentIds.length,
            courseCount,
            activeEnrollments
        }
    });
});

module.exports.settings = catchAsync(async (req, res) => {
    res.render('institution-dashboard/settings', { institution: req.institution });
});

module.exports.updateSettings = catchAsync(async (req, res) => {
    const institution = await Institution.findById(req.institution._id);
    if (!institution) {
        req.flash('error', 'Institution introuvable.');
        return res.redirect('/institution/dashboard');
    }

    const { description, contactEmail, phone, city, country, logoUrl,
            primaryColor, secondaryColor, accentColor,
            website, facebook, instagram, twitter, linkedin, youtube, whatsapp } = req.body;

    if (description  !== undefined) institution.description  = description;
    if (contactEmail !== undefined) institution.contactEmail = contactEmail.trim().toLowerCase();
    if (phone        !== undefined) institution.phone        = phone;
    if (city         !== undefined) institution.city         = city;
    if (country      !== undefined) institution.country      = country;
    if (logoUrl      !== undefined) institution.logoUrl      = logoUrl;
    if (primaryColor && /^#[0-9a-fA-F]{6}$/.test(primaryColor)) institution.primaryColor = primaryColor;
    institution.secondaryColor = (secondaryColor && /^#[0-9a-fA-F]{6}$/.test(secondaryColor)) ? secondaryColor : '';
    institution.accentColor    = (accentColor    && /^#[0-9a-fA-F]{6}$/.test(accentColor))    ? accentColor    : '';

    institution.socialMedia = {
        website:   website   || '',
        facebook:  facebook  || '',
        instagram: instagram || '',
        twitter:   twitter   || '',
        linkedin:  linkedin  || '',
        youtube:   youtube   || '',
        whatsapp:  whatsapp  || ''
    };

    await institution.save();
    req.flash('success', 'Paramètres mis à jour.');
    res.redirect('/institution/dashboard/settings');
});
