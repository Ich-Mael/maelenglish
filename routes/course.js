const express = require('express');
const router = express.Router();
const User = require("../models/user");
const Course = require("../models/courses");
const { isLoggedIn, checkRoles } = require("../controllers/userController");



// Courses route
router.get('/courses', async(req, res)=>{
	const courses = await Course.find({});
	res.render('courses/index', {courses});
    });



module.exports = router;