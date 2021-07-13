module.exports.checkCourseOwnership = course_id => (req, res, next) => {
    if (req.user.coursesTaken.includes(course_id)) {
        next();
    } else {
        res.render('noAccess');
    }
};