const Institution = require('../models/institution');

// Passes if user is institution-admin (or global admin who can access everything)
module.exports.isInstitutionAdmin = (req, res, next) => {
    if (!req.isAuthenticated()) {
        req.session.returnTo = req.originalUrl;
        req.flash('error', 'Vous devez d\'abord vous connecter.');
        return res.redirect('/login');
    }

    const role = req.user.role;
    if (role === 'institution-admin' || role === 'admin' || role === 'super-admin') {
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

        // Global admins may pass institutionId as a route param or query param
        if (role === 'admin' || role === 'super-admin') {
            const id = req.params.institutionId || req.query.institutionId;
            if (id) {
                req.institution = await Institution.findById(id);
                if (!req.institution) {
                    req.flash('error', 'Institution introuvable.');
                    return res.redirect('/admin/institutions');
                }
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
        // Expose brand color to all institution dashboard views
        res.locals.institutionColor = institution.primaryColor || '#0e7490';
        next();
    } catch (err) {
        next(err);
    }
};
