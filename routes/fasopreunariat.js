const express = require('express');
const router = express.Router();
const {isLoggedIn, checkRoles} = require('../controllers/userController');
const {checkCourseOwnership} = require('../controllers/courseController');


//english for everybody
router.get('/fasopreunariat', (req, res)=>{
    res.render("comingsoon");
});

module.exports = router ;
