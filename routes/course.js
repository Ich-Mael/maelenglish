const express = require('express');
const router = express.Router();
const User = require("../models/user");
const Course = require("../models/courses");
const { isLoggedIn, checkRoles } = require("../controllers/userController");



// All Courses route
router.get('/courses', async(req, res)=>{
	const courses = await 
	Course.find({}).populate('instructors');
	console.log(courses);
	res.render('courses/index', {courses});
    });

// Create a new course
router.get('/courses/new', isLoggedIn, checkRoles("admin"), (req, res)=>{
	res.render('courses/new');
});

//
router.post('/courses',isLoggedIn, checkRoles("admin"), async(req, res)=>{
	const course = new Course(req.body.course);
	const instructorsList = req.body.instructors;

	for( let property in instructorsList){
        const instructor = await User.findOne({username: `${instructorsList[property]}`});
       //pushing user to instructors array
	course.instructors.push(instructor);
	}
       //saving course to database
	await course.save();
	res.redirect(`/courses/${course._id}`);
});

//
router.get('/courses/:id', async(req, res)=>{
	const course = await Course.findById(req.params.id);
	res.render('courses/show', {course});
});

module.exports = router;