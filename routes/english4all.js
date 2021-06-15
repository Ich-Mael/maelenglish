const express = require('express');
const router = express.Router();
const {isLoggedIn, checkRoles} = require('../controllers/userController');
const {checkCourseOwnership} = require('../controllers/courseController');


//english for everybody
router.get('/englishlang4all', (req, res)=>{
    res.render("courses/englishlang4all/home");
});


//english clubs 
router.get('/englishlang4all/clubs', isLoggedIn, checkCourseOwnership('eng4clubs'),(req, res)=>{
    res.render("courses/englishlang4all/clubs");
});

//english for students
router.get('/englishlang4all/students', isLoggedIn, checkCourseOwnership('eng4everyone'), (req, res)=>{
    res.render("courses/englishlang4all/basicenglish");
});

//english for adults
router.get('/englishlang4all/adults', isLoggedIn, checkCourseOwnership('eng4professionnal'), (req, res)=>{
    res.render("courses/englishlang4all/adults");
});

//english for kids
router.get('/englishlang4all/kids', isLoggedIn, checkCourseOwnership('eng4kids'), (req, res)=>{
    res.render("courses/englishlang4all/kids");
});

module.exports = router ;
