const express = require('express');
const catchAsync = require('../utilities/catchAsync');
const router = express.Router();
const { isLoggedIn, isVerified} = require('../middlewares/userController');
const { checkCourseOwnership, checkProgramOwnership } = require('../middlewares/courseController');


// Operation 100% BAC
router.get('/100bac',isLoggedIn, isVerified, (req, res) => {
    res.render("programs/100bac/home");
});

// Terminale D
router.get('/100bac/TleD', isLoggedIn, isVerified, checkProgramOwnership("TleD-ab456"), catchAsync(async(req, res) => {
    res.render("programs/100bac/TerminaleD/Maths/homeTleD");
}));

// cours Maths Tle D
router.get('/100bac/TleD/maths', isLoggedIn, isVerified, checkProgramOwnership("TleA-ab457"), (req, res) => {
    res.render("programs/100bac/TerminaleD/Maths/cours_maths");
});


// Cours Maths Tle D
router.get('/100bac/TleD/exomaths', isLoggedIn, isVerified, checkProgramOwnership("TleC-ab458"), (req, res) => {
    res.render("programs/100bac/TerminaleD/Maths/exo_maths");
});


//Terminale A
router.get('/100bac/TleA', isLoggedIn, isVerified, checkProgramOwnership("TleD-ab459"), (req, res) => {
    res.render("programs/100bac/TerminaleA/homeTleA");
});


module.exports = router;
