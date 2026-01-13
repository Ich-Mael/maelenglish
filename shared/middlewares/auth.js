module.exports.isLoggedIn = (req, res, next) => {
    if (!req.isAuthenticated()) {
        req.session.returnTo = req.originalUrl;
        req.flash('error', 'Vous devez d\'abord vous connecter!');
        return res.redirect('/login');
    }
    next();
};

module.exports.isVerified = (req, res, next) => {
    if (req.user.isVerified) {
        next();
    } else {
        return res.redirect('/user/send-verification-email');
    }
};

module.exports.isAdmin = (req, res, next) => {
    if (!req.isAuthenticated()) {
        req.flash('error', 'Vous devez d\'abord vous connecter!');
        return res.redirect('/login');
    }
    if (req.user.role === 'admin' || req.user.role === 'super-admin') {
        return next();
    }
    req.flash('error', 'Vous n\'avez pas les permissions nécessaires');
    res.redirect('/');
};

module.exports.checkRoles = roles => (req, res, next) =>
    !roles.includes(req.user.role) ?
    res.render('noAccess') :
    next();

module.exports.profileOwner = id => (req, res, next) => {
    if ((req.user._id !== id)) {
        res.send('noAccess');
    } else {
        next();
    }
};