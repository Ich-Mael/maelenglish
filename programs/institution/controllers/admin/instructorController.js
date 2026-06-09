const User = require('../../../../shared/models/user');
const { InstitutionInstructor, InstitutionCourse } = require('../../models');
const catchAsync = require('../../../../shared/utilities/catchAsync');

const base = '/institution/dashboard/content/instructors';

// List instructors + search endpoint
module.exports.index = catchAsync(async (req, res) => {
    const [instructors, courses] = await Promise.all([
        InstitutionInstructor.find({ institutionId: req.institution._id })
            .populate('userId', 'name surname username email')
            .sort({ name: 1 }),
        InstitutionCourse.find({ institutionId: req.institution._id })
            .select('title instructors isActive')
            .sort({ createdAt: -1 })
    ]);

    res.render('institution-dashboard/content/instructors/index', { instructors, courses });
});

// JSON search — find institution-instructor users not already in this institution
module.exports.search = catchAsync(async (req, res) => {
    const q = (req.query.q || '').trim();
    if (q.length < 2) return res.json({ users: [] });

    const alreadyLinked = await InstitutionInstructor.distinct('userId', {
        institutionId: req.institution._id
    });

    const users = await User.find({
        role: 'institution-instructor',
        _id: { $nin: alreadyLinked },
        $or: [
            { username: { $regex: q, $options: 'i' } },
            { name:     { $regex: q, $options: 'i' } },
            { surname:  { $regex: q, $options: 'i' } },
            { email:    { $regex: q, $options: 'i' } }
        ]
    }).select('name surname username email').limit(10);

    res.json({ users: users.map(u => ({
        _id:      u._id,
        name:     u.name,
        surname:  u.surname,
        username: u.username,
        email:    u.email
    })) });
});

// Link an institution-instructor user to this institution
module.exports.add = catchAsync(async (req, res) => {
    const { userId, title, bio, photoUrl } = req.body;

    const user = await User.findOne({ _id: userId, role: 'institution-instructor' });
    if (!user) {
        req.flash('error', 'Utilisateur introuvable ou rôle incorrect.');
        return res.redirect(base);
    }

    const existing = await InstitutionInstructor.findOne({
        userId,
        institutionId: req.institution._id
    });
    if (existing) {
        req.flash('error', `${user.name} ${user.surname} est déjà dans votre liste.`);
        return res.redirect(base);
    }

    await InstitutionInstructor.create({
        institutionId: req.institution._id,
        userId,
        name:     `${user.name} ${user.surname}`,
        title:    title ? title.trim() : '',
        bio:      bio || '',
        photoUrl: photoUrl ? photoUrl.trim() : '',
        email:    user.email,
        createdBy: req.user._id
    });

    req.flash('success', `${user.name} ${user.surname} ajouté(e) comme instructeur.`);
    res.redirect(base);
});

module.exports.edit = catchAsync(async (req, res) => {
    const instructor = await InstitutionInstructor.findOne({
        _id: req.params.id,
        institutionId: req.institution._id
    }).populate('userId', 'name surname username email');

    if (!instructor) {
        req.flash('error', 'Instructeur introuvable.');
        return res.redirect(base);
    }

    res.render('institution-dashboard/content/instructors/edit', { instructor });
});

module.exports.update = catchAsync(async (req, res) => {
    const { title, bio, photoUrl } = req.body;

    const instructor = await InstitutionInstructor.findOne({
        _id: req.params.id,
        institutionId: req.institution._id
    });

    if (!instructor) {
        req.flash('error', 'Instructeur introuvable.');
        return res.redirect(base);
    }

    instructor.title    = title    ? title.trim()    : '';
    instructor.bio      = bio      || '';
    instructor.photoUrl = photoUrl ? photoUrl.trim() : '';

    await instructor.save();
    req.flash('success', 'Profil instructeur mis à jour.');
    res.redirect(base);
});

module.exports.destroy = catchAsync(async (req, res) => {
    await InstitutionInstructor.findOneAndDelete({
        _id: req.params.id,
        institutionId: req.institution._id
    });

    req.flash('success', 'Instructeur retiré de votre institution.');
    res.redirect(base);
});

// Assign/update instructors on a course
module.exports.assignToCourse = catchAsync(async (req, res) => {
    const { courseId } = req.params;
    const instructorIds = req.body.instructorIds
        ? (Array.isArray(req.body.instructorIds) ? req.body.instructorIds : [req.body.instructorIds])
        : [];

    const course = await InstitutionCourse.findOne({
        _id: courseId,
        institutionId: req.institution._id
    });
    if (!course) {
        req.flash('error', 'Cours introuvable.');
        return res.redirect(base);
    }

    course.instructors = instructorIds;
    await course.save();

    req.flash('success', `Instructeurs mis à jour pour "${course.title}".`);
    // Redirect back to instructors page — works for both institution admins and AfroHK admins
    const ref = req.get('Referer') || base;
    res.redirect(ref.includes('/courses/') ? base : ref);
});
