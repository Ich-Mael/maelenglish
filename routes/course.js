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
//
router.get('/courses/:id', async(req, res)=>{
	const course = await Course.findById(req.params.id);
	res.render('courses/show', {course});
});

module.exports = router;