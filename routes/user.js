const express = require("express");
const passport = require("passport");
const Emailer = require("../utilities/sendEmail");


const crypto = require('crypto');

const router = express.Router();
const User = require("../models/user");
const accountToken = require("../models/accountTokens");
const { englishClubs } = require("../models/englishClub");
const catchAsync = require("../utilities/catchAsync");
const Course = require("../models/courses");
const { isLoggedIn, checkRoles, isVerified } = require("../middlewares/userController");
const {
  checkCourseOwnership,
  checkEnglishBoardMembership,
} = require("../middlewares/courseController");

// register a user form
router.get("/register", (req, res) => {
  res.render("user/register");
});

// register user to DB
router.post("/register", async (req, res) => {
  try {
    const { name, surname, email, username, phoneNumber, gender, password } = req.body;
    const user = new User({ name, surname, email, phoneNumber, gender, username });
    const registeredUser = await User.register(user, password);

    req.login(registeredUser, async (err) => {
      if (err) {
        res.send("Something Went Wrong");
      } else {
        const redirectUrl = (await req.session.returnTo) || "/";
        delete req.session.returnTo;
        req.flash("success", "Votre compte a été créé avec success");
        res.redirect('/user/send-verification-email');
      }
    });
  } catch (e) {
    req.flash("error", e.message);
    res.redirect("/register");
  }
});


//sending activation mail
router.get('/user/send-verification-email', catchAsync(async (req, res) => {
      // generate a token 
      const token = crypto.randomBytes(32).toString('hex');

      // add that to database
      await accountToken({ token: token, email: req.user.email }).save();

      let url;
      if(process.env.NODE_ENV == "production") {
      url = "https://www.afrohk.com/user/verifyemail?token=" + token;
        }else{
      url = "http://localhost:3000/user/verifyemail?token=" + token;
        }
      // send an email for verification
      await new Emailer(req.user, url).sendVerifyEmail();

      res.render('user/account_handler', { username: req.user.username, verified: req.user.isVerified, emailsent: true });  
}));


router.get('/user/verifyemail', async (req, res) => {
  // grab the token
  const token = req.query.token;
  // check if token exists 
  // or just send an error
  if (token) {
      const check = await accountToken.findOne({ token: token });
      if (check) {
          // token verified
          // set the property of verified to true for the user
          const userData = await User.findOne({ email: check.email });
          userData.isVerified = true;
          await userData.save();
          // delete the token now itself
          await accountToken.findOneAndDelete({ token: token });
      res.render('user/account_verified', { username: req.user.username});  
      } else {
          res.render('user/account_handler', { username: req.user.username, verified: req.user.isVerified, err: "Le lien d’activation de compte est expiré" });
      }
  } else {
      // doesnt have a token
      // I will simply redirect to profile 
      res.redirect('/register');
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
  async (req, res) => {
    req.flash(
      "success",
      "Content de vous revoir " + req.user.username.toUpperCase()
    );
    const redirectUrl = (await req.session.returnTo) || "/";
    delete req.session.returnTo;
    console.log(req.session.returnTo);
    res.redirect(redirectUrl);
  }
);

// logout
router.get("/logout", async (req, res) => {
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
router.get(
  "/user/:id",
  isLoggedIn,
  isVerified,
  catchAsync(async (req, res, next) => {
    const id = req.params.id;
    const user = await User.findById(id)
      .populate("coursesTaken")
      .populate("coursesGiven");
    res.render("user/userprofile", { user });
  })
);

//==========================//==========================
//   Admin Privileges  Managing students
//==========================//==========================

// Admin route
router.get("/admindashboard", isLoggedIn, isVerified, checkRoles("admin"), (req, res) => {
  res.render("admindashboard");
});

// adding a student to a course form
router.get("/addstudent/new", isLoggedIn, isVerified, checkRoles("admin"), (req, res) => {
  res.render("courses/addNewStudent");
});

// adding a student to a course
router.post(
  "/addstudent",
  isLoggedIn,
  isVerified,
  checkRoles(["admin", "student_manager"]),
  catchAsync(async (req, res) => {
    const { courseTitle, student } = req.body;
    const user = await User.findOne({ username: student });
    const course = await Course.findOne({ title: courseTitle });
    course.student.push(user);
    await course.save();
    user.coursesTaken.push(course);
    await user.save();
    res.send("user successfully registered for the course");
  })
);

// adding a student to a course
router.post(
  "/admindashboard/newEnglishClubMember",
  isLoggedIn,
  isVerified,
  checkRoles("admin"),
  catchAsync(async (req, res) => {
    const { englishClub_name, memberUsername } = req.body;
    const user = await User.findOne({ username: memberUsername });
    const englishClub = await englishClubs.findOne({ name: englishClub_name });

    if (englishClub.members.includes(user._id)) {
      req.flash("error", `User is already a member of this English club`);
    } else {
      await englishClub.members.push(user._id);
      await englishClub.save();
      req.flash("success", `User successfully added to this English club`);
    }
    res.redirect("/admindashboard");
  })
);

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

router.get(
  "/englishlang4all/Clubs/:club_id/board_dashboard",
  isLoggedIn,
  checkEnglishBoardMembership,
  catchAsync(async (req, res) => {
    const club = await englishClubs.findById(req.params.club_id);
    res.render(
      "programs/englishlang4all/englishClubs/board_members_dashboard",
      { club }
    );
  })
);

module.exports = router;
