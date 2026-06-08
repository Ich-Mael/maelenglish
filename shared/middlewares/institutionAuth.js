const Institution = require('../models/institution');
const { InstitutionEnrollment, InstitutionCourse } = require('../../programs/institution/models');

// Passes if user is institution-admin (or global admin who can access everything)
module.exports.isInstitutionAdmin = (req, res, next) => {
    if (!req.isAuthenticated()) {
        req.session.returnTo = req.originalUrl;
        req.flash('error', 'Vous devez d\'abord vous connecter.');
        return res.redirect('/login');
    }

    // Handle both singular 'role' and plural 'roles' array
    const userRoles = Array.isArray(req.user.roles) ? req.user.roles : [req.user.role];
    if (userRoles.includes('institution-admin') || userRoles.includes('admin') || userRoles.includes('super-admin')) {
        return next();
    }

    req.flash('error', 'Accès réservé aux administrateurs d\'institution.');
    return res.redirect('/');
};

// Loads the institution from req.user.institutionId and attaches it as req.institution.
// For global admins accessing a specific institution via :institutionId param, loads that instead.
module.exports.loadInstitution = async (req, res, next) => {
    try {
        const role = req.user.role;

        // Global admins may pass institutionId as a route param, query param, body field,
        // or fall back to a session-persisted value so navigation between pages doesn't
        // lose institution context.
        if (role === 'admin' || role === 'super-admin') {
            const id = req.params.institutionId
                || req.query.institutionId
                || (req.body && req.body.institutionId)
                || req.session.activeInstitutionId;

            if (id) {
                req.institution = await Institution.findById(id);
                if (!req.institution) {
                    req.flash('error', 'Institution introuvable.');
                    return res.redirect('/admin/institutions');
                }
                // Persist so subsequent page loads in the same flow keep the context
                req.session.activeInstitutionId = req.institution._id.toString();
                res.locals.institutionColor = req.institution.primaryColor || '#0e7490';
                res.locals.institutionId = req.institution._id.toString();
                res.locals.institution = req.institution;
            }
            return next();
        }

        // Institution admins: load from their profile
        if (!req.user.institutionId) {
            req.flash('error', 'Aucune institution associée à votre compte.');
            return res.redirect('/');
        }

        const institution = await Institution.findById(req.user.institutionId);

        if (!institution) {
            req.flash('error', 'Institution introuvable.');
            return res.redirect('/');
        }

        if (!institution.isActive) {
            req.flash('error', 'Votre institution a été désactivée. Veuillez contacter AfroHK.');
            return res.redirect('/');
        }

        req.institution = institution;
        res.locals.institutionColor = institution.primaryColor || '#0e7490';
        res.locals.institutionId = institution._id.toString();
        res.locals.institution = institution;
        next();
    } catch (err) {
        next(err);
    }
};

// ─── STUDENT PORTAL MIDDLEWARE ────────────────────────────────────────────────

// Requires authentication only — institution access is validated by loadStudentInstitution
// or loadPortalInstitution depending on the route.
module.exports.isInstitutionStudent = (req, res, next) => {
    if (!req.isAuthenticated()) {
        req.session.returnTo = req.originalUrl;
        req.flash('error', 'Vous devez d\'abord vous connecter.');
        return res.redirect('/login');
    }
    return next();
};

// Loads the institution for /institution/learn/ routes.
// Tries user.institutionId first, then derives from an active enrollment.
module.exports.loadStudentInstitution = async (req, res, next) => {
    try {
        let institution;

        if (req.user.institutionId) {
            institution = await Institution.findById(req.user.institutionId);
        }

        // Derive from an active enrollment if institutionId not set on the user
        if (!institution) {
            const enrollment = await InstitutionEnrollment.findOne({ userId: req.user._id });
            if (enrollment) {
                institution = await Institution.findById(enrollment.institutionId);
            }
        }

        if (!institution) {
            req.flash('error', 'Aucune institution associée à votre compte.');
            return res.redirect('/dashboard');
        }
        if (!institution.isActive) {
            req.flash('error', 'Votre institution a été désactivée. Contactez AfroHK.');
            return res.redirect('/dashboard');
        }

        req.institution = institution;
        res.locals.institutionColor = institution.primaryColor || '#0e7490';
        res.locals.institution = institution;
        res.locals.learnMode = true;
        next();
    } catch (err) {
        next(err);
    }
};

// Loads institution for /institution/:institutionId/portal.
// Verifies the student has at least one enrollment in that institution.
module.exports.loadPortalInstitution = async (req, res, next) => {
    try {
        const institution = await Institution.findById(req.params.institutionId);
        if (!institution || !institution.isActive) {
            req.flash('error', 'Portail introuvable.');
            return res.redirect('/dashboard');
        }

        const enrollment = await InstitutionEnrollment.findOne({
            userId: req.user._id,
            institutionId: institution._id
        });

        if (!enrollment) {
            req.flash('error', 'Vous n\'avez pas accès à ce portail.');
            return res.redirect('/dashboard');
        }

        req.institution = institution;
        res.locals.institutionColor = institution.primaryColor || '#0e7490';
        next();
    } catch (err) {
        next(err);
    }
};

// Verifies the student has active enrollment in the requested course.
// Requires req.institution to be set (run loadStudentInstitution first).
// Sets req.course (InstitutionCourse) and req.enrollment on success.
module.exports.checkInstitutionCourseAccess = async (req, res, next) => {
    try {
        const { courseId } = req.params;

        const course = await InstitutionCourse.findOne({
            _id: courseId,
            institutionId: req.institution._id
        }).populate('modules', 'title order quiz assignment');

        if (!course) {
            req.flash('error', 'Ce cours n\'est pas disponible dans votre institution.');
            return res.redirect('/institution/learn/courses');
        }

        const enrollment = await InstitutionEnrollment.findOne({
            userId: req.user._id,
            courseId,
            institutionId: req.institution._id
        });

        if (!enrollment) {
            req.flash('error', 'Vous n\'êtes pas inscrit à ce cours.');
            return res.redirect('/institution/learn/courses');
        }

        const now = new Date();
        if (enrollment.startDate && new Date(enrollment.startDate) > now) {
            req.flash('error', 'Ce cours n\'est pas encore disponible.');
            return res.redirect('/institution/learn/courses');
        }
        if (enrollment.endDate && new Date(enrollment.endDate) < now) {
            req.flash('error', 'Votre accès à ce cours a expiré. Contactez votre institution.');
            return res.redirect('/institution/learn/courses');
        }

        req.course = course;
        req.enrollment = enrollment;
        next();
    } catch (err) {
        next(err);
    }
};
