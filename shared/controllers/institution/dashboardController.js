const {
    InstitutionCourse, InstitutionEnrollment,
    InstitutionLesson, InstitutionLessonProgress,
    InstitutionAssignmentSubmission, InstitutionFinalProjectSubmission,
    InstitutionEnrollmentRequest
} = require('../../../programs/institution/models');
const Institution = require('../../models/institution');
const catchAsync  = require('../../utilities/catchAsync');

module.exports.home = catchAsync(async (req, res) => {
    const institutionId = req.institution._id;
    const now     = new Date();
    const in7days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const courses = await InstitutionCourse.find({ institutionId })
        .populate('instructors', 'name title')
        .sort({ createdAt: -1 })
        .lean();

    const courseIds = courses.map(c => c._id);

    const [
        enrollCounts,
        activeCounts,
        lessonCounts,
        progressAgg,
        pendingAssignments,
        pendingProjects,
        expiringEnrollments,
        expiredCount,
        pendingRequestCount
    ] = await Promise.all([
        InstitutionEnrollment.aggregate([
            { $match: { institutionId, courseId: { $in: courseIds } } },
            { $group: { _id: '$courseId', count: { $sum: 1 } } }
        ]),
        InstitutionEnrollment.aggregate([
            { $match: { institutionId, courseId: { $in: courseIds },
                $or: [{ endDate: null }, { endDate: { $gte: now } }] } },
            { $group: { _id: '$courseId', count: { $sum: 1 } } }
        ]),
        InstitutionLesson.aggregate([
            { $match: { courseId: { $in: courseIds } } },
            { $group: { _id: '$courseId', count: { $sum: 1 } } }
        ]),
        // Average progress % per course: avg completed lessons per enrolled user
        InstitutionLessonProgress.aggregate([
            { $match: { courseId: { $in: courseIds } } },
            { $group: { _id: { courseId: '$courseId', userId: '$userId' }, done: { $sum: 1 } } },
            { $group: { _id: '$_id.courseId', avgDone: { $avg: '$done' } } }
        ]),
        InstitutionAssignmentSubmission.aggregate([
            { $match: { courseId: { $in: courseIds }, status: 'submitted' } },
            { $group: { _id: '$courseId', count: { $sum: 1 } } }
        ]),
        InstitutionFinalProjectSubmission.aggregate([
            { $match: { courseId: { $in: courseIds }, status: 'submitted' } },
            { $group: { _id: '$courseId', count: { $sum: 1 } } }
        ]),
        InstitutionEnrollment.find({
            institutionId,
            endDate: { $gte: now, $lte: in7days }
        }).populate('userId', 'name surname username').populate('courseId', 'title').lean(),
        InstitutionEnrollment.countDocuments({ institutionId, endDate: { $lt: now } }),
        InstitutionEnrollmentRequest.countDocuments({ institutionId, status: 'pending' })
    ]);

    const toMap = arr => Object.fromEntries(arr.map(r => [r._id.toString(), r.count]));
    const enrollMap  = toMap(enrollCounts);
    const activeMap  = toMap(activeCounts);
    const lessonMap  = toMap(lessonCounts);
    const assignMap  = toMap(pendingAssignments);
    const projectMap = toMap(pendingProjects);
    const progMap    = Object.fromEntries(progressAgg.map(r => [r._id.toString(), r.avgDone]));

    const courseCards = courses.map(course => {
        const cid        = course._id.toString();
        const enrolled   = enrollMap[cid]  || 0;
        const active     = activeMap[cid]  || 0;
        const total      = lessonMap[cid]  || 0;
        const avgDone    = progMap[cid]    || 0;
        const avgPct     = total > 0 ? Math.round((avgDone / total) * 100) : 0;
        const pending    = (assignMap[cid] || 0) + (projectMap[cid] || 0);
        return { course, enrolled, active, avgPct, pending, instructors: course.instructors || [] };
    });

    const totalPending = courseCards.reduce((s, c) => s + c.pending, 0);

    res.render('institution-dashboard/home', {
        institution: req.institution,
        courseCards,
        expiringEnrollments,
        expiredCount,
        totalPending,
        pendingRequestCount
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
