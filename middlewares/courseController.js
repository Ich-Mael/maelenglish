const User = require("../models/user");
const Course = require("../models/courses");
const catchAsync = require('../utilities/catchAsync');

module.exports.checkCourseOwnership = catchAsync(async(req, res, next) => {

    const course = await Course.findById(req.params.course_id);
    if (course.student.includes(req.user._id) || req.user.role === "admin") {
        next();
    } else {
        res.render('noAccess');
    }

});

module.exports.checkProgramOwnership = course => (req, res, next) => {
    if (!req.user.ownedPrograms.some(arr => arr.indexOf(course) !== -1) && req.user.role !== "admin") {
        res.render('noAccess');
    } else {
        next();
    }
};