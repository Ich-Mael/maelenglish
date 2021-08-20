module.exports.isLoggedIn = (req, res, next) => {
    if (!req.isAuthenticated()) {
        req.session.returnTo = req.originalUrl;
        req.flash('error', 'You must be signed in first!');
        return res.redirect('/login');
    }
    next();
};

module.exports.checkRoles = roles => (req, res, next) =>
    !roles.includes(req.user.role) ?
    res.send('Not authorized') :
    next();

module.exports.profileOwner = id => (req, res, next) => {
    if (!(req.user._id === id)) {
        res.send('Access not authorized');
    } else {
        next();
    }
};