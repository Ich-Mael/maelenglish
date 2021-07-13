const express = require("express");
const passport = require("passport");
const router = express.Router();
const User = require("../models/user");
const Course = require("../models/courses");
const { isLoggedIn, checkRoles } = require("../controllers/userController");

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
    (req, res) => {
        req.flash("success", "Welcome back " + req.user.username.toUpperCase());
        const redirectUrl = req.session.returnTo || "/";
        delete req.session.returnTo;
        res.redirect(redirectUrl);
    }
);

// logout
router.get("/logout", (req, res) => {
    req.logout();
    req.flash("success", `Goodbye ! See you nextime!!`);
    res.redirect("/");
});

// Admin route
router.get("/admindashboard", isLoggedIn, checkRoles("admin"), (req, res) => {
    res.render("admindashboard");
});

// Form for a new course
router.get('/courses/new', isLoggedIn, checkRoles("admin"), (req, res) => {
    res.render('courses/new');
});

// creating a new course
router.post('/courses', isLoggedIn, checkRoles("admin"), async(req, res) => {
    const course = new Course(req.body.course);
    const instructorsList = req.body.instructors;

    for (let property in instructorsList) {
        const instructor = await User.findOne({ username: `${instructorsList[property]}` });
        //pushing user to instructors array
        course.instructors.push(instructor);

        // adding course to user given courses
        instructor.coursesGiven.push(course);
        await instructor.save();
    }
    //saving course to database
    await course.save();
    res.redirect(`/courses/${course._id}`);
});


//==========================
//     Managing students
//==========================


// adding a student to a course form
router.get('/addstudent/new', isLoggedIn, checkRoles("admin"), (req, res) => {
    res.render('courses/addNewStudent');
});


// adding a student to a course
router.post('/addstudent', isLoggedIn, checkRoles("admin"), async(req, res) => {
    const { courseTitle, student } = req.body;
    const user = await User.findOne({ username: student });
    const course = await Course.findOne({ title: courseTitle });
    course.student.push(user);
    await course.save();
    console.log(course);
    user.coursesTaken.push(course);
    await user.save();
    console.log(user);
    res.send("user successfully registered for the course");
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

module.exports = router;