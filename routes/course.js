const express = require('express');
const router = express.Router();
const User = require("../models/user");
const catchAsync = require('../utilities/catchAsync');
const {Course, Module, Evaluation, Grade } = require("../models/courses");
const { isLoggedIn, checkRoles, isVerified} = require("../middlewares/userController");
const { checkCourseOwnership } = require("../middlewares/courseController");

// All Courses route
router.get('/courses', isVerified, async(req, res) => {
    const courses = await
    Course.find({isActive: true}).populate('instructors');
    res.render('courses/index', { courses });
});

/*
************************* COURSES ROUTES *******************************************
*/

// Form for a new course
router.get('/courses/new', isVerified, isLoggedIn, checkRoles("admin"), (req, res) => {
    res.render('courses/new');
});

// Creating a new course
router.post('/courses', isVerified, isLoggedIn, checkRoles("admin"), catchAsync(async(req, res) => {
    const course = new Course(req.body.course);
    const instructorsList = req.body.instructors;

    for (let property in instructorsList) {
        const instructor = await User.findOne({ username: `${instructorsList[property]}` });
        if(instructor){
        //pushing user to instructors array
        course.instructors.push(instructor);

        // adding course to user given courses
        instructor.coursesGiven.push(course);
        await instructor.save();
        }
    }
    //saving course to database
    await course.save();
    // res.redirect(`/courses`);
    res.redirect(`/courses/${course._id}`);
}));

// Show course content
router.get('/courses/:course_id', isVerified, isLoggedIn, checkCourseOwnership, catchAsync(async(req, res) => {
    const course = await Course.findById(req.params.course_id);
    res.render('courses/show', { course });
}));

// Edit new course


/*
************************* MODULE ROUTES *******************************************
*/

// Evalution routes
router.get('/courses/:course_id/:evaluation', isVerified, isLoggedIn, checkCourseOwnership, catchAsync(async(req, res) => {
    const course = await Course.findById(req.params.course_id);
    const user = await User.findById(req.user._id);
    const evaluation = req.params.evaluation;
    res.send("eval page");
}));




/*
************************* EVALUATION ROUTES *******************************************
*/



module.exports = router;
