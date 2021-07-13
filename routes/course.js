const express = require('express');
const router = express.Router();
const User = require("../models/user");
const Course = require("../models/courses");
const { isLoggedIn, checkRoles } = require("../controllers/userController");
const { checkCourseOwnership } = require("../controllers/courseController");



// All Courses route
router.get('/courses', async(req, res) => {
    const courses = await
    Course.find({}).populate('instructors');
    res.render('courses/index', { courses });
});
//
router.get('/courses/:id', isLoggedIn, async(req, res) => {
    const course = await Course.findById(req.params.id);
    const access = await req.user.coursesTaken.includes(course._id);
    if (access) {
        res.render('courses/show', { course });
    } else {
        res.render('noAccess');
    }

});

module.exports = router;