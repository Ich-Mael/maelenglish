const express = require("express");
const catchAsync = require("../utilities/catchAsync");
const router = express.Router();
const BAC = require("../controllers/100bac");

// const { Class, Chapitre, Subject } = require("../models/100bac");
const {
  isLoggedIn,
  checkRoles,
  isVerified,
} = require("../middlewares/userController");
const {
  checkCourseOwnership,
  checkProgramOwnership,
} = require("../middlewares/courseController");

const {
  facebookPageLike,
  classCheck,
  checkStudentStatus,
  chapterPremiumAccess,
} = require("../middlewares/mathsController");
const { HighSchool, HStudent } = require("../models/100bac");

// Operation 100% BAC
router.get(
  "/100bac",
  isLoggedIn,
  isVerified,
  checkStudentStatus,
  catchAsync(async (req, res) => {
    const student = await HStudent.findById(req.user.highSchool_id);

    const allClassesD = await Class.find({
      serie: "D",
    });

    const allClassesA = await Class.find({
      serie: "A",
    });

    res.render("programs/100bac/home", {
      allClassesD,
      allClassesA,
      student,
    });
  })
);

router.get(
  "/admindashboard/100bac/students",
  isVerified,
  checkRoles("admin"),
  catchAsync(async (req, res) => {})
);

//view series and classes
router.get(
  "/admindashboard/100bac/series_and_classes",
  isVerified,
  checkRoles("admin"),
  catchAsync(async (req, res) => {
    const schoolClassesD = await Class.find({
      serie: "D",
    });

    const schoolClassesA = await Class.find({
      serie: "A",
    });

    res.render("programs/100bac/allClasses", {
      schoolClassesD,
      schoolClassesA,
    });
  })
);

// create a new class
router.post(
  "/admindashboard/100bac/class",
  isVerified,
  checkRoles("admin"),
  catchAsync(async (req, res) => {
    const newClass = new Class(req.body.class);
    await newClass.save();
    res.redirect("/100bac");
  })
);

// Show create student
router.post(
  "/admindashboard/100bac/class/newHighschoolStudent",
  isVerified,
  checkRoles("admin"),
  catchAsync(BAC.createHStudent)
);

//student profile
router.get(
  "/user/:user_id/highschoolDashboard/:highSchool_id",
  isVerified,
  catchAsync(BAC.studentProfile)
);

// Show class home
router.get(
  "/100bac/class/:class_id",
  classCheck,
  isLoggedIn,
  isVerified,
  catchAsync(BAC.showClassHome)
);

//========================= Giving Access =================//

// Look for a student
router.post(
  "/admindashboard/100bac/studentDashboard",
  isVerified,
  checkRoles("admin"),
  catchAsync(BAC.studentDashboard)
);

// Student dashboard by admin
router.get("/admindashboard/100bac/studentDashboard/student/:student_id", isVerified, checkRoles("admin"), catchAsync(BAC.showStudentDashboard));

// Give Premium access
router.post(
  "/admindashboard/100bac/class/:class_id/subject/:subject_id/chapter/:chapter_id/givepremiumaccess",
  isVerified,
  checkRoles("admin"),
  catchAsync(BAC.givePremiumAccess)
);

// Adding a Student to a class (an udpdate of student class)
router.put(
  "/admindashboard/100bac/studentDashboard/student/:student_id",
  isLoggedIn,
  isVerified,
  catchAsync(BAC.updateStudentInfo)
);

//========================== Subject =============================//

// Create a new subject form
router.get(
  "/admindashboard/100bac/class/:class_id/subject/new",
  checkRoles("admin"),
  catchAsync(async (req, res) => {
    const schoolClass = await Class.findById(req.params.class_id);
    res.render("programs/100bac/Class/subjects/newSubject", {
      schoolClass,
    });
  })
);

// Create a new subject
router.post(
  "/admindashboard/100bac/class/:class_id/subject",
  isLoggedIn,
  isVerified,
  checkRoles("admin"),
  catchAsync(BAC.addSubject)
);

// View subject
router.get(
  "/100bac/class/:class_id/subject/:subject_id",
  isLoggedIn,
  isVerified,
  classCheck,
  catchAsync(BAC.viewSubject)
);

// View all subject by admin
router.get(
  "/admindashboard/100bac/class/:class_id/subjects",
  checkRoles("admin"),
  catchAsync(BAC.viewAllSubject)
);

// Cours Maths Tle D

// ======================== Chapters =====================

// Create a new chapter form
router.get(
  "/admindashboard/100bac/class/:class_id/subject/:subject_id/chapter/new",
  isVerified,
  checkRoles("admin"),
  catchAsync(async (req, res) => {
    const schoolClass = await Class.findById(req.params.class_id);
    const subject = await Subject.findById(req.params.subject_id);
    res.render("programs/100bac/Class/chapters/newChapter", {
      schoolClass,
      subject,
    });
  })
);

// Create a new chapter
router.post(
  "/admindashboard/100bac/class/:class_id/subject/:subject_id/chapter",
  isVerified,
  checkRoles("admin"),
  catchAsync(BAC.createChapter)
);

// View all chapters by admin
router.get(
  "/admindashboard/100bac/class/:class_id/subject/:subject_id/chapters",
  isVerified,
  checkRoles("admin"),
  catchAsync(BAC.viewAllChapters)
);

//view a chapter
router.get(
  "/100bac/class/:class_id/subject/:subject_id/chapter/:chapter_id",
  isLoggedIn,
  isVerified,
  classCheck,
  catchAsync(BAC.viewChapter)
);

//Starter exercises
router.get(
  "/100bac/class/:class_id/subject/:subject_id/chapter/:chapter_id/SE",
  isLoggedIn,
  isVerified,
  classCheck,
  catchAsync(BAC.viewChapterSE)
);

//Premium content
router.get(
  "/100bac/class/:class_id/subject/:subject_id/chapter/:chapter_id/PRE",
  isLoggedIn,
  isVerified,
  classCheck,
  chapterPremiumAccess,
  catchAsync(BAC.viewChapterPRE)
);

//========================= Video content =================//
// Create a new video content form
router.post(
  "/admindashboard/100bac/class/:class_id/subject/:subject_id/chapter/:chapter_id/videocontent",
  isVerified,
  checkRoles("admin"),
  catchAsync(BAC.createVideoContent)
);

module.exports = router;
