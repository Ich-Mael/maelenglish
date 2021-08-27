const express = require('express');
const router = express.Router();
const User = require("../models/user");
const catchAsync = require('../utilities/catchAsync');
const Course = require("../models/courses");
const { isLoggedIn, checkRoles } = require("../middlewares/userController");
const { checkCourseOwnership } = require("../middlewares/courseController");

// All Courses route
router.get('/courses', async(req, res) => {
    const courses = await
    Course.find({}).populate('instructors');
    res.render('courses/index', { courses });
});

// creating a new course
router.post('/courses', isLoggedIn, checkRoles("admin"), catchAsync(async(req, res) => {
    const course = new Course(req.body.course);
    const instructorsList = req.body.instructors;

    for (let property in instructorsList) {
        const instructor = await User.findOne({ username: `${instructorsList[property]}` });
        //pushing user to instructors array
        course.instructors.push(instructor);

        // adding course to user given courses
        instructor.coursesGiven.push(course);
        await instructor.save();
    }
    //saving course to database
    await course.save();
    res.redirect(`/courses/${course._id}`);
}));

// Form for a new course
router.get('/courses/new', isLoggedIn, checkRoles("admin"), (req, res) => {
    res.render('courses/new');
});

//show course content
router.get('/courses/:course_id', isLoggedIn, checkCourseOwnership, catchAsync(async(req, res) => {
    const course = await Course.findById(req.params.course_id);
    res.render('courses/show', { course });
}));

// Evalution routes
router.get('/courses/:course_id/:evaluation', isLoggedIn, checkCourseOwnership, catchAsync(async(req, res) => {
    const course = await Course.findById(req.params.course_id);
    const user = await User.findById(req.user._id);
    const evaluation = req.params.evaluation;
    console.log(course);
    console.log(user);
    console.log(evaluation);
    res.send("eval page");
}));


module.exports = router;
