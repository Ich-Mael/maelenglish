const express = require('express');
const router = express.Router();
const crypto = require('crypto');

const Institution = require('../models/institution');
const User = require('../models/user');
const { Course } = require('../models/courses');
const catchAsync = require('../utilities/catchAsync');
const { isLoggedIn, checkRoles } = require('../middlewares/auth');
const Emailer = require('../utilities/sendEmail');
const { getBaseUrl } = require('../utilities/url');

const adminOnly = [isLoggedIn, checkRoles(['admin', 'super-admin'])];

// ─── LIST ────────────────────────────────────────────────────────────────────

router.get('/', ...adminOnly, catchAsync(async (req, res) => {
    const filter = {};
    if (req.query.active === 'true') filter.isActive = true;
    if (req.query.active === 'false') filter.isActive = false;

    const institutions = await Institution.find(filter)
        .populate('admins', 'name surname email')
        .sort({ createdAt: -1 });

    res.render('admin/institutions/list', { institutions, filters: req.query });
}));

// ─── NEW FORM ────────────────────────────────────────────────────────────────

router.get('/new', ...adminOnly, catchAsync(async (req, res) => {
    const courses = await Course.find({ isActive: true }).select('title').sort({ title: 1 });
    res.render('admin/institutions/new', { courses });
}));

// ─── CREATE ──────────────────────────────────────────────────────────────────

router.post('/', ...adminOnly, catchAsync(async (req, res) => {
    const {
        name, description, contactEmail, phone, city, country, logoUrl,
        adminName, adminSurname, adminUsername, adminEmail, adminGender
    } = req.body;

    if (!name || !adminName || !adminSurname || !adminUsername || !adminEmail || !adminGender) {
        req.flash('error', 'Veuillez remplir tous les champs obligatoires.');
        return res.redirect('/admin/institutions/new');
    }

    // Check slug uniqueness
    const slug = Institution.generateSlug(name);
    const existing = await Institution.findOne({ slug });
    if (existing) {
        req.flash('error', `Une institution avec ce nom existe déjà (slug: ${slug}).`);
        return res.redirect('/admin/institutions/new');
    }

    // Check username/email uniqueness for admin user
    const existingUser = await User.findOne({ $or: [{ username: adminUsername }, { email: adminEmail }] });
    if (existingUser) {
        req.flash('error', existingUser.username === adminUsername
            ? 'Ce nom d\'utilisateur est déjà utilisé.'
            : 'Cette adresse email est déjà utilisée.');
        return res.redirect('/admin/institutions/new');
    }

    // Generate password + activation token for the institution admin
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%';
    let password = '';
    for (let i = 0; i < 10; i++) password += charset.charAt(Math.floor(Math.random() * charset.length));
    password += 'A1a';

    const activationToken = crypto.randomBytes(32).toString('hex');
    const activationExpires = Date.now() + 48 * 60 * 60 * 1000; // 48 hours

    // Create the institution admin user
    const adminUser = new User({
        name: adminName,
        surname: adminSurname,
        username: adminUsername,
        email: adminEmail,
        gender: adminGender,
        role: 'institution-admin',
        isVerified: false,
        activationToken,
        activationExpires
    });
    await User.register(adminUser, password);

    // Create the institution
    const institution = new Institution({
        name,
        slug,
        description: description || '',
        contactEmail: contactEmail || adminEmail,
        phone: phone || '',
        city: city || '',
        country: country || 'Burkina Faso',
        logoUrl: logoUrl || '',
        createdBy: req.user._id,
        admins: [adminUser._id]
    });
    await institution.save();

    // Link user to institution
    adminUser.institutionId = institution._id;
    await adminUser.save();

    // Send activation email
    try {
        const activationUrl = `${getBaseUrl(req)}/user/activate/${activationToken}`;
        await new Emailer(adminUser, activationUrl).sendActivationEmail(password);
        req.flash('success', `Institution "${institution.name}" créée. Email d'activation envoyé à ${adminEmail}.`);
    } catch (err) {
        console.error('Institution admin activation email error:', err);
        req.flash('warning', `Institution créée, mais l'email n'a pas pu être envoyé. Mot de passe: ${password}`);
    }

    res.redirect(`/admin/institutions/${institution._id}`);
}));

// ─── SHOW ─────────────────────────────────────────────────────────────────────

router.get('/:id', ...adminOnly, catchAsync(async (req, res) => {
    const institution = await Institution.findById(req.params.id)
        .populate('admins', 'name surname email username isVerified')
        .populate('assignedCourses', 'title isActive');

    if (!institution) {
        req.flash('error', 'Institution introuvable.');
        return res.redirect('/admin/institutions');
    }

    const studentCount = await User.countDocuments({ institutionId: institution._id, role: 'user' });

    // Only admin-managed courses can be assigned to institutions
    const assignedIds = institution.assignedCourses.map(c => c._id);
    const availableCourses = await Course.find({
        source: 'admin',
        isActive: true,
        _id: { $nin: assignedIds }
    }).select('title').sort({ title: 1 });

    res.render('admin/institutions/show', { institution, studentCount, availableCourses });
}));

// ─── EDIT ─────────────────────────────────────────────────────────────────────

router.get('/:id/edit', ...adminOnly, catchAsync(async (req, res) => {
    const institution = await Institution.findById(req.params.id);
    if (!institution) {
        req.flash('error', 'Institution introuvable.');
        return res.redirect('/admin/institutions');
    }
    res.render('admin/institutions/edit', { institution });
}));

router.put('/:id', ...adminOnly, catchAsync(async (req, res) => {
    const { name, description, contactEmail, phone, city, country, logoUrl, primaryColor, primaryColorHex } = req.body;
    const institution = await Institution.findById(req.params.id);
    if (!institution) {
        req.flash('error', 'Institution introuvable.');
        return res.redirect('/admin/institutions');
    }

    if (name) institution.name = name;
    if (description !== undefined) institution.description = description;
    if (contactEmail) institution.contactEmail = contactEmail;
    if (phone !== undefined) institution.phone = phone;
    if (city !== undefined) institution.city = city;
    if (country) institution.country = country;
    if (logoUrl !== undefined) institution.logoUrl = logoUrl;
    const color = primaryColorHex || primaryColor;
    if (color && /^#[0-9a-fA-F]{6}$/.test(color)) institution.primaryColor = color;

    await institution.save();
    req.flash('success', 'Institution mise à jour avec succès.');
    res.redirect(`/admin/institutions/${institution._id}`);
}));

// ─── ASSIGN COURSE ────────────────────────────────────────────────────────────

router.post('/:id/courses', ...adminOnly, catchAsync(async (req, res) => {
    const { courseId } = req.body;
    const institution = await Institution.findById(req.params.id);
    if (!institution) {
        req.flash('error', 'Institution introuvable.');
        return res.redirect('/admin/institutions');
    }

    if (!courseId) {
        req.flash('error', 'Veuillez sélectionner un cours.');
        return res.redirect(`/admin/institutions/${req.params.id}`);
    }

    if (!institution.assignedCourses.includes(courseId)) {
        institution.assignedCourses.push(courseId);
        await institution.save();
        req.flash('success', 'Cours assigné avec succès.');
    } else {
        req.flash('error', 'Ce cours est déjà assigné à cette institution.');
    }

    res.redirect(`/admin/institutions/${institution._id}`);
}));

// ─── UNASSIGN COURSE ──────────────────────────────────────────────────────────

router.delete('/:id/courses/:courseId', ...adminOnly, catchAsync(async (req, res) => {
    const institution = await Institution.findById(req.params.id);
    if (!institution) {
        req.flash('error', 'Institution introuvable.');
        return res.redirect('/admin/institutions');
    }

    institution.assignedCourses = institution.assignedCourses.filter(
        c => c.toString() !== req.params.courseId
    );
    await institution.save();
    req.flash('success', 'Cours retiré de l\'institution.');
    res.redirect(`/admin/institutions/${institution._id}`);
}));

// ─── TOGGLE ACTIVE ────────────────────────────────────────────────────────────

router.post('/:id/toggle', ...adminOnly, catchAsync(async (req, res) => {
    const institution = await Institution.findById(req.params.id);
    if (!institution) {
        req.flash('error', 'Institution introuvable.');
        return res.redirect('/admin/institutions');
    }

    institution.isActive = !institution.isActive;
    await institution.save();

    req.flash('success', `Institution ${institution.isActive ? 'activée' : 'désactivée'}.`);
    res.redirect(`/admin/institutions/${institution._id}`);
}));

module.exports = router;
