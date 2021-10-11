const express = require("express");
const passport = require("passport");
const router = express.Router();
const User = require("../models/user");
const {englishClubs} = require("../models/englishClub");
const catchAsync = require('../utilities/catchAsync');
const Course = require("../models/courses");
const {englishClubArticles} = require("../models/englishClub");
const { isLoggedIn, checkRoles } = require("../middlewares/userController");
const { checkCourseOwnership, checkEnglishBoardMembership} = require("../middlewares/courseController");




// register a user form
router.get("/register", (req, res) => {
    res.render("user/register");
});

// register user to DB
router.post("/register", async(req, res) => {
    try {
        const { name, surname, email, username, password } = req.body;
        const user = new User({ name, surname, email, username });
        const registeredUser = await User.register(user, password);
        req.login(registeredUser, async(err) => {
            if (err) {
                res.send("Something Went Wrong");
            } else {
        const redirectUrl = await req.session.returnTo || "/";
        delete req.session.returnTo;
        req.flash("success", "Votre compte a été créé avec success");
        res.redirect(redirectUrl);
            }
        });
    } catch (e) {
        req.flash("error", e.message);
        res.redirect("/register");
    }
});

// login user form
router.get("/login", (req, res) => {
    res.render("user/login");
});

router.post(
    "/login",
    passport.authenticate("local", {
        failureFlash: true,
        failureRedirect: "/login",
    }),
    async(req, res) => {
        req.flash("success", "Content de vous revoir " + req.user.username.toUpperCase());
        const redirectUrl = await req.session.returnTo || "/";
        delete req.session.returnTo;
        console.log(req.session.returnTo);
        res.redirect(redirectUrl);
    }
);

// logout
router.get("/logout", async(req, res) => {
    await req.logout();
    req.flash("success", `Au revoir 👋🏽 ! À la prochaine!!`);
    res.redirect("/");
});

// newsletter

// router.post("/newsletter", async(req, res)=>{
//     console.log(req.body);
//     req.flash("success", `your is email succesfully saved!`);
//     res.redirect("/");
// });


// Instructor route
router.get(
    "/instructordashboard",
    isLoggedIn,
    checkRoles(["instructor", "admin"]),
    (req, res) => {
        res.render("instructor");
    }
);

// user profile route
router.get('/user/:id', isLoggedIn, catchAsync(async(req, res, next) => {
    const id = req.params.id;
    const user = await User.findById(id).populate('coursesTaken').populate('coursesGiven');
    res.render('user/userprofile', { user });
}));

//==========================//==========================
//   Admin Privileges  Managing students
//==========================//==========================


// Admin route
router.get("/admindashboard", isLoggedIn, checkRoles("admin"), (req, res) => {
    res.render("admindashboard");
});


// adding a student to a course form
router.get('/addstudent/new', isLoggedIn, checkRoles("admin"), (req, res) => {
    res.render('courses/addNewStudent');
});

// adding a student to a course
router.post('/addstudent', isLoggedIn, checkRoles(["admin", "student_manager"]), catchAsync(async(req, res) => {
    const { courseTitle, student } = req.body;
    const user = await User.findOne({ username: student });
    const course = await Course.findOne({ title: courseTitle });
    course.student.push(user);
    await course.save();
    user.coursesTaken.push(course);
    await user.save();
    res.send("user successfully registered for the course");
}));


//==========================//==========================
//   Instrucctor Privileges  Managing courses
//==========================//==========================

// Instructor route
router.get(
    "/instructordashboard",
    isLoggedIn,
    checkRoles(["instructor", "admin"]),
    (req, res) => {
        res.render("instructor");
    }
);


//==========================//==========================
//   English club Board members privileges
//==========================//==========================

// Accessing dashboard

router.get('/englishlang4all/Clubs/:club_id/board_dashboard', isLoggedIn,  catchAsync(async(req, res) => {
    const club = await englishClubs.findById(req.params.club_id);
    res.render('programs/englishlang4all/englishClubs/board_members_dashboard', {club});
}));


module.exports = router;
