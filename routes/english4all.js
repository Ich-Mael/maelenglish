const express = require('express');
const router = express.Router();
const { isLoggedIn, checkRoles } = require('../middlewares/userController');
const { checkCourseOwnership } = require('../middlewares/courseController');


//english for everybody
router.get('/englishlang4all', (req, res) => {
    res.render("courses/englishlang4all/home");
});


//english clubs 
router.get('/englishlang4all/clubs', isLoggedIn, (req, res) => {
    res.render("courses/englishlang4all/clubs");
});

//english for students
router.get('/englishlang4all/students', isLoggedIn, (req, res) => {
    res.render("courses/englishlang4all/basicenglish");
});

//english for adults
router.get('/englishlang4all/adults', isLoggedIn, (req, res) => {
    res.render("courses/englishlang4all/adults");
});

//english for kids
router.get('/englishlang4all/kids', isLoggedIn, (req, res) => {
    res.render("courses/englishlang4all/kids");
});

module.exports = router;