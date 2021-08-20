const express = require('express');
const router = express.Router();
const { isLoggedIn } = require('../middlewares/userController');
const { checkCourseOwnership } = require('../middlewares/courseController');


// Operation 100% BAC
router.get('/100bac', (req, res) => {
    res.render("courses/100bac/home");
});

// Terminale D
router.get('/100bac/TleD', isLoggedIn, (req, res) => {
    res.render("courses/100bac/tleD");
});

// cours Maths Tle D
router.get('/100bac/TleD/maths', isLoggedIn, (req, res) => {
    res.render("courses/100bac/TerminaleD/maths");
});


// Cours Maths Tle D
router.get('/100bac/TleD/exomaths', isLoggedIn, (req, res) => {
    res.render("courses/100bac/TerminaleD/exomaths");
});


//Terminale A
router.get('/100bac/TleA', isLoggedIn, (req, res) => {
    res.render("courses/100bac/tleA");
});


module.exports = router;