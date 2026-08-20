const express = require("express");
const catchAsync = require("../../../../shared/utilities/catchAsync");
const router = express.Router();
const BAC = require("./controller");

// const { Class, Chapitre, Subject } = require("./model");
const {
  isLoggedIn,
  checkRoles,
  isVerified,
} = require("../../../../shared/middlewares/auth");

const {
  facebookPageLike,
  classCheck,
  checkStudentStatus,
  subjectPremiumAccess, // Accès premium au niveau matière
  checkExercisePremiumAccess,
  mathsLabAccess,
} = require("../../middlewares/studentController");
const { HighSchool, HStudent, Class, Subject } = require("./model");

// Kalan home page (public landing page)
router.get(
  "/",
  catchAsync(async (req, res) => {
    // For a logged-in high-school student, the primary CTA goes to their class.
    let studentClassId = null;
    if (req.user && req.user.isHighSchoolStudent && req.user.highSchool_id) {
      const student = await HStudent.findById(req.user.highSchool_id).select("class_id");
      if (student && student.class_id) studentClassId = student.class_id;
    }
    // Use the main site navbar (same as /user/:id) instead of the program navbar
    res.render("programs/ekalan/kalan_home", { studentClassId });
  })
);

router.get(
  "/admindashboard/kalan/students",
  isLoggedIn,
  isVerified,
  checkRoles(["admin", "super-admin"]),
  catchAsync(BAC.listAllStudents)
);

//view series and classes
router.get(
  "/admindashboard/kalan/series_and_classes",
  isVerified,
  checkRoles(["admin", "super-admin"]),
  catchAsync(async (req, res) => {
    const allClasses = await Class.find({}).sort({ serie: 1, title: 1 });

    // Group classes by serie so the view can render every serie, not just A and D.
    const classesBySerie = allClasses.reduce((acc, c) => {
      const key = c.serie || "—";
      (acc[key] = acc[key] || []).push(c);
      return acc;
    }, {});

    res.render("programs/ekalan/allClasses", {
      classesBySerie,
    });
  })
);

// Kalan Maths Lab — sélecteur de classe (admin).
// Point d'entrée global pour gérer l'accès autonome à la Maths Lab, classe par classe.
router.get(
  "/admindashboard/kalan/maths-lab",
  isLoggedIn,
  isVerified,
  checkRoles(["admin", "super-admin"]),
  catchAsync(async (req, res) => {
    const allClasses = await Class.find({}).sort({ serie: 1, title: 1 });
    res.render("programs/ekalan/admin/maths-lab-classes", { allClasses });
  })
);

// create a new class
router.post(
  "/admindashboard/kalan/class",
  isLoggedIn,
  isVerified,
  checkRoles(["admin", "super-admin"]),
  catchAsync(async (req, res) => {
    const { title, serie } = req.body.class;
    
    // Vérifier si la classe existe déjà
    const existingClass = await Class.findOne({ title, serie });
    if (existingClass) {
      req.flash("error", `La classe ${title} (${serie}) existe déjà`);
      return res.redirect("/programs/ekalan/kalan/admindashboard/kalan/series_and_classes");
    }
    
    const newClass = new Class(req.body.class);
    newClass.isActive = true; // Activer la classe par défaut
    await newClass.save();
    
    req.flash("success", `Classe ${title} (${serie}) créée avec succès`);
    res.redirect("/programs/ekalan/kalan/admindashboard/kalan/series_and_classes");
  })
);

// Show form to create student account (from class)
router.get(
  "/admindashboard/kalan/class/:class_id/addStudent",
  isLoggedIn,
  isVerified,
  checkRoles(["admin", "super-admin"]),
  catchAsync(BAC.showCreateStudentForm)
);

// Show form to create student account (general)
router.get(
  "/admindashboard/kalan/students/new",
  isLoggedIn,
  isVerified,
  checkRoles(["admin", "super-admin"]),
  catchAsync(BAC.showCreateStudentFormGeneral)
);

// API: Search users for student account creation
router.get(
  "/admindashboard/kalan/students/search-users",
  isLoggedIn,
  isVerified,
  checkRoles(["admin", "super-admin"]),
  catchAsync(BAC.searchUsers)
);

// Create student account
router.post(
  "/admindashboard/kalan/class/newHighschoolStudent",
  isLoggedIn,
  isVerified,
  checkRoles(["admin", "super-admin"]),
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
  "/class/:class_id",
  isLoggedIn,
  isVerified,
  classCheck,
  catchAsync(BAC.showClassHome)
);

//========================= Giving Access =================//

// Look for a student
router.post(
  "/admindashboard/kalan/studentDashboard",
  isVerified,
  checkRoles(["admin", "super-admin"]),
  catchAsync(BAC.studentDashboard)
);

// Student dashboard by admin
router.get("/admindashboard/kalan/studentDashboard/student/:student_id", isVerified, checkRoles(["admin", "super-admin"]), catchAsync(BAC.showStudentDashboard));

// ✅ NOUVEAU: Demander l'accès premium (étudiant)
router.post(
  "/class/:class_id/subject/:subject_id/request-premium-access",
  isLoggedIn,
  isVerified,
  classCheck,
  catchAsync(BAC.requestPremiumAccess)
);

// Kalan Naaba: demander l'accès à toute la classe (étudiant)
router.post(
  "/class/:class_id/request-naaba-access",
  isLoggedIn,
  isVerified,
  classCheck,
  catchAsync(BAC.requestNaabaAccess)
);

// Espace Maths — page (élève premium Maths / Kalan Naaba)
router.get(
  "/class/:class_id/maths-lab",
  isLoggedIn,
  isVerified,
  classCheck,
  mathsLabAccess,
  catchAsync(BAC.mathsLab)
);

// Espace Maths — explication IA (JSON, rate-limited)
router.post(
  "/class/:class_id/maths-lab/explain",
  isLoggedIn,
  isVerified,
  classCheck,
  mathsLabAccess,
  (req, res, next) => req.app.get("authLimiter")(req, res, next),
  catchAsync(BAC.explainMath)
);

// ✅ NOUVEAU: Liste des demandes d'accès premium (admin)
router.get(
  "/admindashboard/kalan/premium-requests",
  isLoggedIn,
  isVerified,
  checkRoles(["admin", "super-admin"]),
  catchAsync(BAC.listPremiumRequests)
);

// Traitement en masse des demandes premium (admin)
router.post(
  "/admindashboard/kalan/premium-requests/bulk",
  isLoggedIn,
  isVerified,
  checkRoles(["admin", "super-admin"]),
  catchAsync(BAC.bulkPremiumRequests)
);

// ✅ NOUVEAU: Approuver une demande d'accès premium
router.post(
  "/admindashboard/kalan/premium-requests/:request_id/approve",
  isLoggedIn,
  isVerified,
  checkRoles(["admin", "super-admin"]),
  catchAsync(BAC.approvePremiumRequest)
);

// ✅ NOUVEAU: Rejeter une demande d'accès premium
router.post(
  "/admindashboard/kalan/premium-requests/:request_id/reject",
  isLoggedIn,
  isVerified,
  checkRoles(["admin", "super-admin"]),
  catchAsync(BAC.rejectPremiumRequest)
);

// Manage premium access for a subject (requests + premium students) (admin)
router.get(
  "/admindashboard/kalan/class/:class_id/subject/:subject_id/premium",
  isLoggedIn,
  isVerified,
  checkRoles(["admin", "super-admin"]),
  catchAsync(BAC.manageSubjectPremium)
);

// Give Premium access (admin) - méthode manuelle
router.post(
  "/admindashboard/kalan/class/:class_id/subject/:subject_id/givepremiumaccess",
  isVerified,
  checkRoles(["admin", "super-admin"]),
  catchAsync(BAC.givePremiumAccess)
);

// Revoke premium access of a student for a subject (admin)
router.delete(
  "/admindashboard/kalan/class/:class_id/subject/:subject_id/premium/revoke/:student_id",
  isLoggedIn,
  isVerified,
  checkRoles(["admin", "super-admin"]),
  catchAsync(BAC.revokePremiumAccess)
);

// Kalan Naaba management for a class (admin)
router.get(
  "/admindashboard/kalan/class/:class_id/naaba",
  isLoggedIn,
  isVerified,
  checkRoles(["admin", "super-admin"]),
  catchAsync(BAC.manageClassNaaba)
);

// Update Kalan Naaba discount % for a class (admin)
router.post(
  "/admindashboard/kalan/class/:class_id/naaba/discount",
  isLoggedIn,
  isVerified,
  checkRoles(["admin", "super-admin"]),
  catchAsync(BAC.updateNaabaDiscount)
);

// Grant Kalan Naaba manually (admin)
router.post(
  "/admindashboard/kalan/class/:class_id/givenaaba",
  isLoggedIn,
  isVerified,
  checkRoles(["admin", "super-admin"]),
  catchAsync(BAC.giveNaabaAccess)
);

// Revoke Kalan Naaba of a student (admin)
router.delete(
  "/admindashboard/kalan/class/:class_id/naaba/revoke/:student_id",
  isLoggedIn,
  isVerified,
  checkRoles(["admin", "super-admin"]),
  catchAsync(BAC.revokeNaabaAccess)
);

// Kalan Maths Lab (produit autonome) — page de gestion pour une classe (admin)
router.get(
  "/admindashboard/kalan/class/:class_id/maths-lab-access",
  isLoggedIn,
  isVerified,
  checkRoles(["admin", "super-admin"]),
  catchAsync(BAC.manageClassMathsLab)
);

// API: rechercher les élèves d'une classe (autocomplétion octroi Maths Lab) (admin)
router.get(
  "/admindashboard/kalan/class/:class_id/students/search",
  isLoggedIn,
  isVerified,
  checkRoles(["admin", "super-admin"]),
  catchAsync(BAC.searchClassStudents)
);

// Update Kalan Maths Lab price for a class (admin)
router.post(
  "/admindashboard/kalan/class/:class_id/maths-lab-access/price",
  isLoggedIn,
  isVerified,
  checkRoles(["admin", "super-admin"]),
  catchAsync(BAC.updateMathsLabPrice)
);

// Grant Kalan Maths Lab (standalone) manually (admin)
router.post(
  "/admindashboard/kalan/class/:class_id/give-maths-lab",
  isLoggedIn,
  isVerified,
  checkRoles(["admin", "super-admin"]),
  catchAsync(BAC.giveMathsLabAccess)
);

// Revoke Kalan Maths Lab (standalone) of a student (admin)
router.delete(
  "/admindashboard/kalan/class/:class_id/maths-lab-access/revoke/:student_id",
  isLoggedIn,
  isVerified,
  checkRoles(["admin", "super-admin"]),
  catchAsync(BAC.revokeMathsLabAccess)
);

// Adding a Student to a class (an udpdate of student class)
router.put(
  "/admindashboard/kalan/studentDashboard/student/:student_id",
  isLoggedIn,
  isVerified,
  catchAsync(BAC.updateStudentInfo)
);

//========================== Subject =============================//

// Create a new subject form
router.get(
  "/admindashboard/kalan/class/:class_id/subject/new",
  checkRoles(["admin", "super-admin"]),
  catchAsync(async (req, res) => {
    const schoolClass = await Class.findById(req.params.class_id);
    res.render("programs/ekalan/Class/subjects/newSubject", {
      schoolClass,
    });
  })
);

// Create a new subject
router.post(
  "/admindashboard/kalan/class/:class_id/subject",
  isLoggedIn,
  isVerified,
  checkRoles(["admin", "super-admin"]),
  catchAsync(BAC.addSubject)
);

// View subject
router.get(
  "/class/:class_id/subject/:subject_id",
  isLoggedIn,
  isVerified,
  classCheck,
  catchAsync(BAC.viewSubject)
);

// View all subject by admin
router.get(
  "/admindashboard/kalan/class/:class_id/subjects",
  checkRoles(["admin", "super-admin"]),
  catchAsync(BAC.viewAllSubject)
);

// Edit subject form (GET)
router.get(
  "/admindashboard/kalan/class/:class_id/subject/:subject_id/edit",
  isLoggedIn,
  isVerified,
  checkRoles(["admin", "super-admin"]),
  catchAsync(BAC.editSubject)
);

// Update subject (PUT)
router.put(
  "/admindashboard/kalan/class/:class_id/subject/:subject_id",
  isLoggedIn,
  isVerified,
  checkRoles(["admin", "super-admin"]),
  catchAsync(BAC.updateSubject)
);

// Cours Maths Tle D

// ======================== Chapters =====================

// Create a new chapter form
router.get(
  "/admindashboard/kalan/class/:class_id/subject/:subject_id/chapter/new",
  isVerified,
  checkRoles(["admin", "super-admin"]),
  catchAsync(async (req, res) => {
    const schoolClass = await Class.findById(req.params.class_id);
    const subject = await Subject.findById(req.params.subject_id);
    res.render("programs/ekalan/Class/chapters/newChapter", {
      schoolClass,
      subject,
    });
  })
);

// Create a new chapter
router.post(
  "/admindashboard/kalan/class/:class_id/subject/:subject_id/chapter",
  isVerified,
  checkRoles(["admin", "super-admin"]),
  catchAsync(BAC.createChapter)
);

// View all chapters by admin
router.get(
  "/admindashboard/kalan/class/:class_id/subject/:subject_id/chapters",
  isVerified,
  checkRoles(["admin", "super-admin"]),
  catchAsync(BAC.viewAllChapters)
);

// Edit chapter (GET - Show form)
router.get(
  "/admindashboard/kalan/class/:class_id/subject/:subject_id/chapter/:chapter_id/edit",
  isVerified,
  checkRoles(["admin", "super-admin"]),
  catchAsync(BAC.editChapter)
);

// Update chapter (PUT)
router.put(
  "/admindashboard/kalan/class/:class_id/subject/:subject_id/chapter/:chapter_id",
  isVerified,
  checkRoles(["admin", "super-admin"]),
  catchAsync(BAC.updateChapter)
);

//view a chapter
router.get(
  "/class/:class_id/subject/:subject_id/chapter/:chapter_id",
  isLoggedIn,
  isVerified,
  classCheck,
  catchAsync(BAC.viewChapter)
);

// Starter exercises (Free exercises)
router.get(
  "/class/:class_id/subject/:subject_id/chapter/:chapter_id/SE",
  isLoggedIn,
  isVerified,
  classCheck,
  catchAsync(BAC.viewChapterSE)
);

// Premium content — access gated at the subject level
router.get(
  "/class/:class_id/subject/:subject_id/chapter/:chapter_id/PRE",
  isLoggedIn,
  isVerified,
  classCheck,
  subjectPremiumAccess,
  catchAsync(BAC.viewChapterPRE)
);

//========================= Video content (Exercises) =================//

// Create a new video content (exercise)
router.post(
  "/admindashboard/kalan/class/:class_id/subject/:subject_id/chapter/:chapter_id/videocontent",
  isLoggedIn,
  isVerified,
  checkRoles(["admin", "super-admin"]),
  catchAsync(BAC.createVideoContent)
);

// ✅ NOUVEAU: View a specific exercise
router.get(
  "/class/:class_id/subject/:subject_id/chapter/:chapter_id/exercise/:exercise_id",
  isLoggedIn,
  isVerified,
  classCheck,
  checkExercisePremiumAccess,
  catchAsync(async (req, res) => {
    // Cette route peut être utilisée pour visualiser un exercice individuel
    // Pour l'instant, redirige vers la page du chapitre
    // À implémenter dans le contrôleur si nécessaire
    res.redirect(`/programs/ekalan/kalan/class/${req.params.class_id}/subject/${req.params.subject_id}/chapter/${req.params.chapter_id}`);
  })
);

// ❌ SUPPRIMÉ: Routes pour accès premium au niveau exercice
// L'accès premium est maintenant géré uniquement au niveau de la matière (Subject)

module.exports = router;
