const express = require('express');
const catchAsync = require('../utilities/catchAsync');
const router = express.Router();
const BAC = require("../controllers/100bac");
// const { Serie, Chapitre, Subject } = require("../models/100bac");
const { isLoggedIn, checkRoles, isVerified} = require("../middlewares/userController");
const { checkCourseOwnership, checkProgramOwnership } = require('../middlewares/courseController');


// Operation 100% BAC
router.get('/100bac', catchAsync(async(req, res) => {
const allSeries = await Serie.find({});
    res.render("programs/100bac/home",{ allSeries });
}));

router.get('/admindashboard/100bac/series',isVerified, checkRoles("admin"), catchAsync(async(req, res) => {
    const series = await Serie.find({});
        res.render("programs/100bac/allSeries", {series});
}));
    
// create a new serie
router.post('/admindashboard/100bac/serie', isVerified, checkRoles("admin"), catchAsync(async(req, res) =>{
    const newSerie = new Serie(req.body.serie);
    await newSerie.save();
    res.redirect("/100bac");

}));

// Show serie home
router.get('/100bac/serie/:serie_id', catchAsync(BAC.showSerieHome));


//============== subject =================


// create a new subject form
router.get('/admindashboard/100bac/serie/:serie_id/subject/new', isVerified, checkRoles("admin"), catchAsync(async(req, res) =>{
    const serie = await Serie.findById(req.params.serie_id);
    res.render("programs/100bac/Serie/subjects/newSubject", {serie});

}));

// create a new subject
router.post('/admindashboard/100bac/serie/:serie_id/subject', isVerified, checkRoles("admin"), catchAsync(BAC.addSubject));

// view subject
router.get('/100bac/serie/:serie_id/subject/:subject_id', isVerified, catchAsync(BAC.viewSubject));

// view all subject by admin
router.get('/admindashboard/100bac/serie/:serie_id/subjects', isVerified, checkRoles("admin"), catchAsync(BAC.viewAllSubject));

// cours Maths Tle D



// ============== chapters ================= //

// Create a new chapter form
router.get('/admindashboard/100bac/serie/:serie_id/subject/:subject_id/chapter/new', isVerified, checkRoles("admin"), catchAsync(async(req, res) =>{
    const serie = await Serie.findById(req.params.serie_id);
    const subject = await Subject.findById(req.params.subject_id);
    res.render("programs/100bac/Serie/subjects/newChapter", {serie, subject});
}));

//create a new chapter
router.post('/admindashboard/100bac/serie/:serie_id/subject/:subject_id/chapter', isVerified, checkRoles("admin"), catchAsync(BAC.createChapter));

//view a new chapter
router.get('/100bac/serie/:serie_id/subject/:subject_id/chapter/:chapter_id', isVerified, checkRoles("admin"), catchAsync(BAC.viewChapter));




//Terminale A
router.get('/100bac/TleA', isLoggedIn, isVerified, checkProgramOwnership("TleD-ab459"), (req, res) => {
    res.render("programs/100bac/TerminaleA/homeTleA");
});

//============== video content =================//
// Create a new video content form
router.post('/admindashboard/100bac/serie/:serie_id/subject/:subject_id/videocontent', isVerified, checkRoles("admin"), catchAsync(BAC.createVideoContent));


module.exports = router;
