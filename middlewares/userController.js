module.exports.isLoggedIn = (req, res, next) => {
    if (!req.isAuthenticated()) {
        req.session.returnTo = req.originalUrl;
        console.log(req.session.returnTo);
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