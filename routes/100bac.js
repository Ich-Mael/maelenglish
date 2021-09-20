const express = require('express');
const catchAsync = require('../utilities/catchAsync');
const router = express.Router();
const { isLoggedIn } = require('../middlewares/userController');
const { checkCourseOwnership } = require('../middlewares/courseController');


// Operation 100% BAC
router.get('/100bac', (req, res) => {
    res.render("programs/100bac/home");
});

// Terminale D
router.get('/100bac/TleD', isLoggedIn, catchAsync(async(req, res) => {
    res.render("programs/100bac/TerminaleD/Maths/homeTleD");
}));

// cours Maths Tle D
router.get('/100bac/TleD/maths', isLoggedIn, (req, res) => {
    res.render("programs/100bac/TerminaleD/Maths/cours_maths");
});


// Cours Maths Tle D
router.get('/100bac/TleD/exomaths', isLoggedIn, (req, res) => {
    res.render("programs/100bac/TerminaleD/Maths/exo_maths");
});


//Terminale A
router.get('/100bac/TleA', isLoggedIn, (req, res) => {
    res.render("programs/100bac/TerminaleA/homeTleA");
});


module.exports = router;
