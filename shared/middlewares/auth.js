module.exports.isLoggedIn = (req, res, next) => {
    if (!req.isAuthenticated()) {
        req.session.returnTo = req.originalUrl;
        req.flash('error', 'Vous devez d\'abord vous connecter!');
        return res.redirect('/login');
    }
    next();
};

module.exports.isVerified = (req, res, next) => {
    if (!req.user) return res.redirect('/login');
    // Admins bypass the email-verification requirement
    const userRoles = Array.isArray(req.user.roles) ? req.user.roles : [req.user.role];
    if (userRoles.includes('admin') || userRoles.includes('super-admin') || userRoles.includes('institution-admin')) return next();
    if (req.user.isVerified) return next();
    return res.redirect('/user/send-verification-email');
};

module.exports.isAdmin = (req, res, next) => {
    if (!req.isAuthenticated()) {
        req.flash('error', 'Vous devez d\'abord vous connecter!');
        return res.redirect('/login');
    }
    // Handle both singular 'role' and plural 'roles' array
    const userRoles = Array.isArray(req.user.roles) ? req.user.roles : [req.user.role];
    if (userRoles.includes('admin') || userRoles.includes('super-admin')) {
        return next();
    }
    req.flash('error', 'Vous n\'avez pas les permissions nécessaires');
    res.redirect('/');
};

module.exports.checkRoles = roles => (req, res, next) => {
    if (!req.isAuthenticated()) {
        req.flash('error', 'Vous devez d\'abord vous connecter!');
        return res.redirect('/login');
    }
    // Handle both singular 'role' and plural 'roles' array
    const userRoles = Array.isArray(req.user.roles) ? req.user.roles : [req.user.role];
    const hasRequiredRole = userRoles.some(role => roles.includes(role));
    if (!hasRequiredRole) {
        return res.render('noAccess');
    }
    next();
};

module.exports.profileOwner = id => (req, res, next) => {
    if ((req.user._id !== id)) {
        res.send('noAccess');
    } else {
        next();
    }
};