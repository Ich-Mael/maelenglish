const express = require("express");
const passport = require("passport");
const router = express.Router();
const User = require("../models/user");
const catchAsync = require('../utilities/catchAsync');
const Course = require("../models/courses");
const { isLoggedIn, checkRoles } = require("../middlewares/userController");
const { checkCourseOwnership } = require("../middlewares/courseController");

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
        req.login(registeredUser, (err) => {
            if (err) {
                res.send("Something Went Wrong");
            } else {
                req.flash("success", "Votre compte a été créé avec success");
                res.redirect("/");
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
        req.flash("success", "Welcome back " + req.user.username.toUpperCase());
        const redirectUrl = await req.session.returnTo || "/";
        delete req.session.returnTo;
        res.redirect(redirectUrl);
    }
);

// logout
router.get("/logout", (req, res) => {
    req.logout();
    res.redirect("/");
    req.flash("success", `Goodbye ! See you nextime!!`);
});

// Admin route
router.get("/admindashboard", isLoggedIn, checkRoles("admin"), (req, res) => {
    res.render("admindashboard");
});

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
    console.log(user);
    res.render('user/userprofile', { user });
}));

//==========================
//     Managing students
//==========================

// adding a student to a course form
router.get('/addstudent/new', isLoggedIn, checkRoles("admin"), (req, res) => {
    res.render('courses/addNewStudent');
});

// adding a student to a course
router.post('/addstudent', isLoggedIn, checkRoles("admin"), catchAsync(async(req, res) => {
    const { courseTitle, student } = req.body;
    const user = await User.findOne({ username: student });
    const course = await Course.findOne({ title: courseTitle });
    course.student.push(user);
    await course.save();
    user.coursesTaken.push(course);
    await user.save();
    res.send("user successfully registered for the course");
}));

// Instructor route
router.get(
    "/instructordashboard",
    isLoggedIn,
    checkRoles(["instructor", "admin"]),
    (req, res) => {
        res.render("instructor");
    }
);

module.exports = router;