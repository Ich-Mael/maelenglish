const express = require('express');
const router = express.Router();
const { isLoggedIn, checkRoles } = require('../middlewares/userController');
const { checkCourseOwnership, checkProgramOwnership } = require('../middlewares/courseController');


//english for everybody
router.get('/englishlang4all', (req, res) => {
    res.render("programs/englishlang4all/home");
});

router.get('/englishlang4all/free_english_lessons', (req, res) => {
    res.render("programs/englishlang4all/free_lesson");
});

/* =================================================
 *
 * Route for English Clubs
 *
 * ================================================ */

//english clubs 
router.get('/englishlang4all/clubs', isLoggedIn, (req, res) => {
    res.render("programs/englishlang4all/englishClubs/home");
});

/* =================================================
 *
 * Route for General English
 *
 * ================================================ */

//english for Everyone beginner
router.get('/englishlang4all/general_english_beginner', isLoggedIn, checkProgramOwnership("beginner_Eng"), (req, res) => {
    res.render("programs/englishlang4all/general_english_beginner");
});

//english for everyone intermediate
router.get('/englishlang4all/general_english_intermediate', isLoggedIn, checkProgramOwnership("beginner_eng"), (req, res) => {
    res.render("programs/englishlang4all/general_english_beginner");
});


//english for everyone advance
router.get('/englishlang4all/general_english_advance', isLoggedIn, checkProgramOwnership("beginner_eng"), (req, res) => {
    res.render("programs/englishlang4all/general_english_advance");
});


/* =================================================
 *
 * Route for Professional English
 *
 * ================================================ */

//english for adults
router.get('/englishlang4all/adults', isLoggedIn, (req, res) => {
    res.render("programs/englishlang4all/adults");
});


/* =================================================
 *
 * Route for Kid's English
 *
 * ================================================ */

//english for kids
router.get('/englishlang4all/kids', isLoggedIn, (req, res) => {
    res.render("programs/englishlang4all/kids");
});



module.exports = router;
