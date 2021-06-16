const express = require('express');
const router = express.Router();
const {isLoggedIn} = require('../controllers/userController');
const {checkCourseOwnership} = require('../controllers/courseController');


// Operation 100% BAC
router.get('/100bac', (req, res)=>{
    res.render("courses/100bac/home");
});

// Terminale D
router.get('/100bac/TleD', isLoggedIn, checkCourseOwnership('100bacTleD'),(req, res)=>{
    res.render("courses/100bac/tleD");
});

// cours Maths Tle D
router.get('/100bac/TleD/maths', isLoggedIn, checkCourseOwnership('100bacTleD'),(req, res)=>{
    res.render("courses/100bac/TerminaleD/maths");
});


// Cours Maths Tle D
router.get('/100bac/TleD/exomaths', isLoggedIn, checkCourseOwnership('100bacTleD'),(req, res)=>{
    res.render("courses/100bac/TerminaleD/exomaths");
});


//Terminale A
router.get('/100bac/TleA', isLoggedIn, checkCourseOwnership('100bacTleA'), (req, res)=>{
    res.render("courses/100bac/tleA");
});


module.exports = router ;
