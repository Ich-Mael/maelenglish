const User = require("../../../../shared/models/user");
const {
  Class,
  Chapter,
  Subject,
  HStudent,
  HTeacher,
  HSCourseVideo,
  PremiumRequest,
  MathExplanation,
  OpenQuestion,
} = require("./model");
const {
  findEntry,
  hasActiveAccess,
  activeCount,
  grantOrRenew,
} = require("./premiumAccess");
const { explainSteps, SYSTEM_FREE_METHODS, INEQUATION_METHODS, OPERATIONS, COMPLEX_OPERATIONS, ARITH_LABELS, TRIG_OPERATIONS } = require("./mathsLab");
const { solveOpenQuestion } = require("./openQuestions");
const crypto = require("crypto");

// ── Kalan Naaba helpers ──────────────────────────────────────────────
// True if the high-school student (hsId) holds active Kalan Naaba (whole-class premium).
const hasNaaba = (classDoc, hsId) =>
  hasActiveAccess(classDoc && classDoc.naabaStudents, hsId);

// Bundle price = (sum of subjects' premiumPrice) discounted by pct (default 20%).
const computeNaabaPrice = (subjects = [], discountPercent = 20) => {
  const full = subjects.reduce(
    (sum, s) => sum + Number(s.premiumPrice != null ? s.premiumPrice : 2000),
    0
  );
  const pct = Number(discountPercent != null ? discountPercent : 20);
  return { full, discounted: Math.round(full * (1 - pct / 100)), pct };
};

// Expected class/serie combinations offered on E-Kalan, used to populate the
// student-creation forms. Seconde: A, C, Ti, AB3, H. Premiere & Terminale: A, D,
// C, E, F1–F4, G1, G2, H.
const EXPECTED_CLASS_COMBINATIONS = [
  { title: "Seconde", serie: "A" },
  { title: "Seconde", serie: "C" },
  { title: "Seconde", serie: "Ti" },
  { title: "Seconde", serie: "AB3" },
  { title: "Seconde", serie: "H" },
  { title: "Premiere", serie: "A" },
  { title: "Premiere", serie: "D" },
  { title: "Premiere", serie: "C" },
  { title: "Premiere", serie: "E" },
  { title: "Premiere", serie: "F1" },
  { title: "Premiere", serie: "F2" },
  { title: "Premiere", serie: "F3" },
  { title: "Premiere", serie: "F4" },
  { title: "Premiere", serie: "G1" },
  { title: "Premiere", serie: "G2" },
  { title: "Premiere", serie: "H" },
  { title: "Terminale", serie: "A" },
  { title: "Terminale", serie: "D" },
  { title: "Terminale", serie: "C" },
  { title: "Terminale", serie: "E" },
  { title: "Terminale", serie: "F1" },
  { title: "Terminale", serie: "F2" },
  { title: "Terminale", serie: "F3" },
  { title: "Terminale", serie: "F4" },
  { title: "Terminale", serie: "G1" },
  { title: "Terminale", serie: "G2" },
  { title: "Terminale", serie: "H" },
];

// Builds a Mongo $or query matching the expected class/serie combinations.
const expectedClassQuery = () => ({
  $or: EXPECTED_CLASS_COMBINATIONS.map(({ title, serie }) => ({ title, serie })),
});

// show serie home
module.exports.showClassHome = async (req, res) => {
  const schoolClass = await Class.findById(req.params.class_id).populate(
    "subjects"
  );
  
  const hsId = req.user && req.user.highSchool_id;
  const studentHasNaaba = hasNaaba(schoolClass, hsId);

  // ✅ NOUVEAU: Vérifier l'accès premium de l'étudiant pour chaque matière
  let subjectsWithPremiumStatus = [];
  let naabaPending = false;
  if (hsId) {
    for (const subject of schoolClass.subjects) {
      // Kalan Ba (matière) OU Kalan Naaba (toute la classe) => accès premium
      const hasPremiumAccess = studentHasNaaba || hasActiveAccess(subject.premiumStudents, hsId);

      // Demande Kalan Ba en attente pour cette matière
      const pendingRequest = await PremiumRequest.findOne({
        studentId: hsId,
        subjectId: subject._id,
        kind: "subject",
        status: "pending"
      });

      subjectsWithPremiumStatus.push({
        ...subject.toObject(),
        hasPremiumAccess,
        hasPendingRequest: !!pendingRequest
      });
    }

    // Demande Kalan Naaba (classe) en attente
    if (!studentHasNaaba) {
      const naabaReq = await PremiumRequest.findOne({
        studentId: hsId,
        classId: schoolClass._id,
        kind: "class",
        status: "pending"
      });
      naabaPending = !!naabaReq;
    }
  } else {
    // Si pas d'utilisateur connecté, juste passer les sujets sans info premium
    subjectsWithPremiumStatus = schoolClass.subjects;
  }

  const naabaPrice = computeNaabaPrice(schoolClass.subjects, schoolClass.naabaDiscountPercent);

  // Kalan Maths Lab : accessible si accès autonome Maths Lab, OU Kalan Naaba,
  // OU premium Maths (Kalan Ba) actif.
  const hasMathsLab = studentHasNaaba
    || hasActiveAccess(schoolClass.mathsLabStudents, hsId)
    || subjectsWithPremiumStatus.some(
      (s) => s.hasPremiumAccess && /math/i.test(s.title || "")
    );

  res.render("programs/ekalan/Class/classHome", {
    schoolClass: {
      ...schoolClass.toObject(),
      subjects: subjectsWithPremiumStatus
    },
    hasNaaba: studentHasNaaba,
    naabaPending,
    naabaPrice,
    hasMathsLab,
  });
};

// List all students
module.exports.listAllStudents = async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = 20;
  const skip = (page - 1) * limit;
  
  // Filtres
  const serieFilter = req.query.serie || null;
  const classFilter = req.query.class || null;
  const searchQuery = req.query.search || '';
  
  // Construction de la query
  let query = {};
  
  if (serieFilter) {
    query.serie = serieFilter;
  }
  
  if (classFilter) {
    query.class = classFilter;
  }
  
  // Recherche par nom d'utilisateur, école, etc.
  if (searchQuery) {
    // Recherche dans les champs directs
    const directFieldsSearch = [
      { school: { $regex: searchQuery, $options: 'i' } },
      { class: { $regex: searchQuery, $options: 'i' } },
      { neighborhood: { $regex: searchQuery, $options: 'i' } }
    ];
    
    // Recherche dans les utilisateurs associés (nom, prénom, username, email)
    const matchingUsers = await User.find({
      $or: [
        { name: { $regex: searchQuery, $options: 'i' } },
        { surname: { $regex: searchQuery, $options: 'i' } },
        { username: { $regex: searchQuery, $options: 'i' } },
        { email: { $regex: searchQuery, $options: 'i' } }
      ]
    }).select('_id');
    
    const userIds = matchingUsers.map(u => u._id);
    
    // Combiner les deux recherches
    if (userIds.length > 0) {
      query.$or = [
        ...directFieldsSearch,
        { studentBasicInfo: { $in: userIds } }
      ];
    } else {
      query.$or = directFieldsSearch;
    }
  }
  
  // Récupération des étudiants avec populate
  const students = await HStudent.find(query)
    .populate("studentBasicInfo")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);
  
  const totalStudents = await HStudent.countDocuments(query);
  const totalPages = Math.ceil(totalStudents / limit);
  
  // Statistiques
  const stats = {
    total: await HStudent.countDocuments(),
    serieA: await HStudent.countDocuments({ serie: "A" }),
    serieD: await HStudent.countDocuments({ serie: "D" }),
    serieC: await HStudent.countDocuments({ serie: "C" }),
    withPremium: await HStudent.countDocuments({ hasAPremiumContent: true }),
    withHomeTeacher: await HStudent.countDocuments({ hasAHomeTeacher: true })
  };
  
  // Récupérer les classes uniques pour les filtres
  const allClasses = await Class.find({}).select('title serie').sort({ serie: 1, title: 1 });
  
  res.render("programs/ekalan/admin/students/list", {
    students,
    currentPage: page,
    totalPages,
    totalStudents,
    stats,
    allClasses,
    filters: {
      serie: serieFilter,
      class: classFilter,
      search: searchQuery
    }
  });
};

// Show form to create student account (from specific class)
module.exports.showCreateStudentForm = async (req, res) => {
  const schoolClass = await Class.findById(req.params.class_id);
  if (!schoolClass) {
    req.flash("error", "Classe non trouvée");
    return res.redirect("/programs/ekalan/kalan/admindashboard/kalan/series_and_classes");
  }
  
  // Get classes from database matching the expected combinations
  const allClasses = await Class.find(expectedClassQuery()).select('title serie').sort({ title: 1, serie: 1 });

  res.render("programs/ekalan/admin/students/create", {
    schoolClass,
    allClasses,
  });
};

// Show form to create student account (general - no class pre-selected)
module.exports.showCreateStudentFormGeneral = async (req, res) => {
  // Get classes from database matching the expected combinations
  const allClasses = await Class.find(expectedClassQuery()).select('title serie').sort({ title: 1, serie: 1 });

  res.render("programs/ekalan/admin/students/create", {
    schoolClass: null,
    allClasses,
  });
};

// API: Search users (for autocomplete)
module.exports.searchUsers = async (req, res) => {
  const query = req.query.q || '';
  
  // Need at least 3 characters
  if (query.length < 3) {
    return res.json({ users: [] });
  }
  
  // Search users by username, name, surname, or email
  const users = await User.find({
    $or: [
      { username: { $regex: query, $options: 'i' } },
      { name: { $regex: query, $options: 'i' } },
      { surname: { $regex: query, $options: 'i' } },
      { email: { $regex: query, $options: 'i' } }
    ]
  })
  .select('username name surname email isHighSchoolStudent')
  .limit(10)
  .sort({ username: 1 });
  
  // Filter out users who already have an E-Kalan student account
  const usersWithoutStudentAccount = users.filter(user => !user.isHighSchoolStudent);
  
  res.json({ users: usersWithoutStudentAccount });
};

//student
module.exports.createHStudent = async (req, res) => {
  const { student_username, school, class: classId, neighborhood, parentsContact } = req.body;

  // Validate required fields
  if (!student_username || !classId) {
    req.flash("error", "Veuillez remplir tous les champs obligatoires (nom d'utilisateur, classe)");
    return res.redirect("back");
  }

  // Find user by username
  const user = await User.findOne({
    username: student_username,
  });

  if (!user) {
    req.flash("error", `Utilisateur avec le nom d'utilisateur "${student_username}" non trouvé`);
    return res.redirect("back");
  }

  // Find the class by ID
  const studentClass = await Class.findById(classId);

  if (!studentClass) {
    req.flash("error", "Classe non trouvée");
    return res.redirect("back");
  }
  
  // Extract serie from the class
  const serie = studentClass.serie;
  const classTitle = studentClass.title;

  // Checking if user already has high_school status
  const checkingStudent = await HStudent.findOne({
    studentBasicInfo: user._id,
  });

  if (checkingStudent) {
    req.flash("error", `${user.surname} ${user.name} (${user.username}) a déjà un compte élève E-Kalan`);
    return res.redirect("back");
  }

    // Create a new high student
    const new_highStudent = new HStudent({
    school: school || undefined,
    class: classTitle,
    serie: serie,
    neighborhood: neighborhood || undefined,
    parentsContact: parentsContact || undefined,
      studentBasicInfo: user._id,
    });

  // Adding new student to their class
    studentClass.students.push(new_highStudent._id);
    new_highStudent.class_id = studentClass._id;

    await new_highStudent.save();
    await studentClass.save();

  // Setting student Id in user
    user.isHighSchoolStudent = true;
    user.highSchool_id = new_highStudent._id;

    await user.save();

    req.flash(
      "success",
    `Compte élève E-Kalan créé avec succès pour ${user.surname} ${user.name} (${user.username}) dans la classe ${classTitle} (${serie})`
    );
  
  // Redirect to students list
  res.redirect("/programs/ekalan/kalan/admindashboard/kalan/students");
};

//Student profile
module.exports.studentProfile = async (req, res) => {
  const student = await HStudent.findById(req.params.highSchool_id)
    .populate("homeTeacher")
    .populate("studentBasicInfo");

  res.render("programs/ekalan/student/profile", {
    student,
  });
};

// Show student dashboard
module.exports.showStudentDashboard = async (req, res) => {
  const student = await HStudent.findById(req.params.student_id).populate(
    "studentBasicInfo"
  );

  res.render("user/studentDashboard", { student });
};

// Search and Access Student dashboard
module.exports.studentDashboard = async (req, res) => {
  const user = await User.findOne({
    username: req.body.student_username,
  });

  if (!user) {
    req.flash("error", `Utilisateur "${req.body.student_username}" non trouvé`);
    return res.redirect("back");
  }

  const student = await HStudent.findOne({ studentBasicInfo: user._id });

  if (!student) {
    req.flash("error", `${user.username} n'a pas de compte élève E-Kalan`);
    return res.redirect("back");
  }

  res.redirect(
    `/programs/ekalan/kalan/admindashboard/kalan/studentDashboard/student/${student._id}`
  );
};

// add student to a class by updating
module.exports.updateStudentInfo = async (req, res) => {
  const studentNewClass = await Class.findOne({
    title: req.body.class,
    serie: req.body.serie,
  });

  if (!studentNewClass) {
    req.flash("error", `Classe ${req.body.class} (${req.body.serie}) introuvable`);
    return res.redirect("back");
  }

  const student = await HStudent.findById(req.params.student_id);

  if (!student) {
    req.flash("error", "Étudiant non trouvé");
    return res.redirect("back");
  }

  const previousClassId = student.class_id;

  // Update the student's own fields
  student.school = req.body.school;
  student.class = req.body.class;
  student.serie = req.body.serie;

  // Remove the student from their previous class roster (if it changed)
  if (previousClassId && String(previousClassId) !== String(studentNewClass._id)) {
    const studentPreviousClass = await Class.findById(previousClassId);
    if (studentPreviousClass) {
      studentPreviousClass.students.pull(student._id);
      await studentPreviousClass.save();
    }

    // Add to the new class roster (avoid duplicates)
    if (!studentNewClass.students.includes(student._id)) {
      studentNewClass.students.push(student._id);
      await studentNewClass.save();
    }
  }

  student.class_id = studentNewClass._id;
  await student.save();

  req.flash("success", "Informations de l'élève mises à jour");
  res.redirect("back");
};

/* SUBJECTS */

// add a subject to a class
module.exports.addSubject = async (req, res) => {
  const schoolClass = await Class.findById(req.params.class_id);
  if (!schoolClass) {
    req.flash("error", "Classe non trouvée");
    return res.redirect("back");
  }

  // ✅ NOUVEAU: Créer le sujet avec classId
  const newSubject = new Subject({
    ...req.body.subject,
    classId: schoolClass._id
  });
  await newSubject.save();

  // Ajouter le sujet à la classe
  schoolClass.subjects.push(newSubject._id);
  await schoolClass.save();

  req.flash("success", "Matière créée avec succès");
  res.redirect("back");
};

// view a subject
module.exports.viewSubject = async (req, res) => {
  const schoolClass = await Class.findById(req.params.class_id);
  // ✅ NOUVEAU: Utiliser 'chapters' au lieu de 'chapitres'
  const subject = await Subject.findById(req.params.subject_id).populate(
    "chapters"
  );

  // Statut premium de l'étudiant pour cette matière (accès / demande en attente)
  let hasPremiumAccess = false;
  let hasPendingRequest = false;
  let studentHasNaaba = false;
  let naabaPending = false;
  if (subject && req.user && req.user.highSchool_id) {
    const hsId = req.user.highSchool_id;
    studentHasNaaba = hasNaaba(schoolClass, hsId);
    hasPremiumAccess =
      studentHasNaaba || hasActiveAccess(subject.premiumStudents, hsId);
    if (!hasPremiumAccess) {
      const pending = await PremiumRequest.findOne({
        studentId: hsId,
        subjectId: subject._id,
        kind: "subject",
        status: "pending",
      });
      hasPendingRequest = !!pending;
    }
    if (!studentHasNaaba) {
      const naabaReq = await PremiumRequest.findOne({
        studentId: hsId,
        classId: schoolClass._id,
        kind: "class",
        status: "pending",
      });
      naabaPending = !!naabaReq;
    }
  }

  // Prix du bundle Kalan Naaba (somme des matières de la classe − remise)
  const classSubjects = await Subject.find({ classId: schoolClass._id }).select("premiumPrice");
  const naabaPrice = computeNaabaPrice(classSubjects, schoolClass.naabaDiscountPercent);

  res.render("programs/ekalan/Class/subjects/viewSubject", {
    schoolClass,
    subject,
    hasPremiumAccess,
    hasPendingRequest,
    hasNaaba: studentHasNaaba,
    naabaPending,
    naabaPrice,
  });
};

// view all subjects
module.exports.viewAllSubject = async (req, res) => {
  const schoolClass = await Class.findById(req.params.class_id);
  // ✅ NOUVEAU: Filtrer les matières par classId
  const subjects = await Subject.find({ classId: schoolClass._id })
    .populate('classId', 'title serie')
    .sort({ title: 1 });
  res.render("programs/ekalan/Class/subjects/viewAllSubject", {
    schoolClass,
    subjects,
    naabaPrice: computeNaabaPrice(subjects, schoolClass.naabaDiscountPercent),
    naabaCount: activeCount(schoolClass.naabaStudents),
    mathsLabCount: activeCount(schoolClass.mathsLabStudents),
    mathsLabPrice: schoolClass.mathsLabPrice != null ? schoolClass.mathsLabPrice : 2000,
  });
};

// Edit subject (GET - show form)
module.exports.editSubject = async (req, res) => {
  const schoolClass = await Class.findById(req.params.class_id);
  const subject = await Subject.findById(req.params.subject_id);

  if (!subject) {
    req.flash("error", "Matière non trouvée");
    return res.redirect(`/programs/ekalan/kalan/admindashboard/kalan/class/${req.params.class_id}/subjects`);
  }

  res.render("programs/ekalan/Class/subjects/editSubject", {
    schoolClass,
    subject,
  });
};

// Update subject (PUT)
module.exports.updateSubject = async (req, res) => {
  const subject = await Subject.findById(req.params.subject_id);

  if (!subject) {
    req.flash("error", "Matière non trouvée");
    return res.redirect(`/programs/ekalan/kalan/admindashboard/kalan/class/${req.params.class_id}/subjects`);
  }

  const data = req.body.subject || {};
  subject.title = data.title || subject.title;
  subject.subjectImageUrl = data.subjectImageUrl !== undefined ? data.subjectImageUrl : subject.subjectImageUrl;
  subject.aboutVideoLink = data.aboutVideoLink !== undefined ? data.aboutVideoLink : subject.aboutVideoLink;
  subject.isScience = data.isScience === "on" || data.isScience === "true" || data.isScience === true;
  if (data.premiumPrice !== undefined && data.premiumPrice !== "") {
    subject.premiumPrice = parseFloat(data.premiumPrice);
  }

  await subject.save();

  req.flash("success", "Matière mise à jour avec succès");
  res.redirect(`/programs/ekalan/kalan/admindashboard/kalan/class/${req.params.class_id}/subjects`);
};

/* CHAPTERS */

// Show all chapters
module.exports.viewAllChapters = async (req, res) => {
  const schoolClass = await Class.findById(req.params.class_id);
  // ✅ NOUVEAU: Utiliser 'chapters' et filtrer par subjectId
  const subject = await Subject.findById(req.params.subject_id);
  const chapters = await Chapter.find({ 
    subjectId: subject._id,
    classId: schoolClass._id 
  })
    .populate('subjectId', 'title')
    .sort({ order: 1, title: 1 });
  
  res.render("programs/ekalan/Class/chapters/allChapters", {
    subject,
    schoolClass,
    chapters, // ✅ Passer chapters séparément
  });
};

// Create a chapter
module.exports.createChapter = async (req, res) => {
  const schoolClass = await Class.findById(req.params.class_id);
  const subject = await Subject.findById(req.params.subject_id);

  // ✅ NOUVEAU: Créer le chapitre avec subjectId et classId
  const newChapter = new Chapter({
    ...req.body.chapter,
    subjectId: subject._id,
    classId: schoolClass._id
  });
  await newChapter.save();

  // Ajouter le chapitre à la matière
  subject.chapters.push(newChapter._id);
  await subject.save();
  
  req.flash("success", "Chapitre créé avec succès");
  res.redirect("back");
};

// Edit chapter (GET - Show form)
module.exports.editChapter = async (req, res) => {
  const schoolClass = await Class.findById(req.params.class_id);
  const subject = await Subject.findById(req.params.subject_id);
  const chapter = await Chapter.findById(req.params.chapter_id);
  
  if (!chapter) {
    req.flash("error", "Chapitre non trouvé");
    return res.redirect(`/programs/ekalan/kalan/admindashboard/kalan/class/${schoolClass._id}/subject/${subject._id}/chapters`);
  }
  
  res.render("programs/ekalan/Class/chapters/editChapter", {
    schoolClass,
    subject,
    chapter,
  });
};

// Update chapter (PUT)
module.exports.updateChapter = async (req, res) => {
  const schoolClass = await Class.findById(req.params.class_id);
  const subject = await Subject.findById(req.params.subject_id);
  const chapter = await Chapter.findById(req.params.chapter_id);
  
  if (!chapter) {
    req.flash("error", "Chapitre non trouvé");
    return res.redirect(`/programs/ekalan/kalan/admindashboard/kalan/class/${schoolClass._id}/subject/${subject._id}/chapters`);
  }
  
  // Mettre à jour les champs éditables
  chapter.title = req.body.chapter.title || chapter.title;
  chapter.order = req.body.chapter.order !== undefined ? parseInt(req.body.chapter.order) : chapter.order;
  chapter.isActive = req.body.chapter.isActive === "on" || req.body.chapter.isActive === true;
  chapter.aboutLink = req.body.chapter.aboutLink || "";
  chapter.chapterImageUrl = req.body.chapter.chapterImageUrl || "";

  await chapter.save();
  
  req.flash("success", "Chapitre mis à jour avec succès");
  res.redirect(`/programs/ekalan/kalan/admindashboard/kalan/class/${schoolClass._id}/subject/${subject._id}/chapters`);
};

// View a chapter course
module.exports.viewChapter = async (req, res) => {
  const schoolClass = await Class.findById(req.params.class_id);
  const subject = await Subject.findById(req.params.subject_id).populate({
    path: 'chapters',
    options: { sort: { order: 1 } }
  });
  // ✅ NOUVEAU: Utiliser le nouveau array 'content' et filtrer par videoType 'course'
  const chapter = await Chapter.findById(req.params.chapter_id)
    .populate({
      path: 'content',
      match: { videoType: 'course' },
      options: { sort: { order: 1 } }
    });

  // Calculate chapter number (starting from 1)
  let chapterNumber = 1;
  if (subject.chapters && subject.chapters.length > 0) {
    const chapterIndex = subject.chapters.findIndex(ch => ch._id.toString() === chapter._id.toString());
    chapterNumber = chapterIndex >= 0 ? chapterIndex + 1 : 1;
  }

  res.render("programs/ekalan/Class/chapters/viewChapter", {
    schoolClass,
    subject,
    chapter,
    chapterNumber,
  });
};

// Free exercise
module.exports.viewChapterSE = async (req, res) => {
  const serie = await Class.findById(req.params.class_id);
  const subject = await Subject.findById(req.params.subject_id);
  // ✅ NOUVEAU: Utiliser le nouveau array 'content' et filtrer par types gratuits
  const chapter = await Chapter.findById(req.params.chapter_id);
  
  // Types d'exercices gratuits
  const freeTypes = ["starterEx", "CIAM_basic", "practiceEx", "course"];
  const freeExercises = await HSCourseVideo.find({
    chapterId: chapter._id,
    videoType: { $in: freeTypes },
    isActive: true
  }).sort({ order: 1, createdAt: -1 });
  
  // Grouper par type pour l'affichage
  const grouped = freeExercises.reduce((acc, ex) => {
    if (!acc[ex.videoType]) acc[ex.videoType] = [];
    acc[ex.videoType].push(ex);
    return acc;
  }, {});

  // Statut premium de l'étudiant pour cette matière (pour l'upsell premium)
  let hasPremiumAccess = false;
  let hasPendingRequest = false;
  let studentHasNaaba = false;
  let naabaPending = false;
  if (subject && req.user && req.user.highSchool_id) {
    const hsId = req.user.highSchool_id;
    studentHasNaaba = hasNaaba(serie, hsId);
    hasPremiumAccess =
      studentHasNaaba || hasActiveAccess(subject.premiumStudents, hsId);
    if (!hasPremiumAccess) {
      const pending = await PremiumRequest.findOne({
        studentId: hsId,
        subjectId: subject._id,
        kind: "subject",
        status: "pending",
      });
      hasPendingRequest = !!pending;
    }
    if (!studentHasNaaba) {
      const naabaReq = await PremiumRequest.findOne({
        studentId: hsId,
        classId: serie._id,
        kind: "class",
        status: "pending",
      });
      naabaPending = !!naabaReq;
    }
  }

  // Prix du bundle Kalan Naaba (somme des matières de la classe − remise)
  const classSubjects = await Subject.find({ classId: serie._id }).select("premiumPrice");
  const naabaPrice = computeNaabaPrice(classSubjects, serie.naabaDiscountPercent);

  res.render("programs/ekalan/Class/chapters/viewChapterS-E", {
    serie,
    subject,
    chapter,
    freeExercises,
    grouped,
    hasPremiumAccess,
    hasPendingRequest,
    hasNaaba: studentHasNaaba,
    naabaPending,
    naabaPrice,
  });
};

// Premium
module.exports.viewChapterPRE = async (req, res) => {
  const schoolClass = await Class.findById(req.params.class_id);
  const subject = await Subject.findById(req.params.subject_id);
  // ✅ NOUVEAU: Utiliser le nouveau array 'content' et filtrer par types premium
  const chapter = await Chapter.findById(req.params.chapter_id);
  
  // Types d'exercices premium
  const premiumTypes = ["advanceEx", "nationalExam", "schoolExam", "CIAM_Premium", "grandeEcole", "bonus_profs", "exo_perso"];
  const premiumExercises = await HSCourseVideo.find({
    chapterId: chapter._id,
    videoType: { $in: premiumTypes },
    isActive: true
  }).sort({ order: 1, createdAt: -1 });
  
  // Grouper par type pour l'affichage
  const grouped = premiumExercises.reduce((acc, ex) => {
    if (!acc[ex.videoType]) acc[ex.videoType] = [];
    acc[ex.videoType].push(ex);
    return acc;
  }, {});

  res.render("programs/ekalan/Class/chapters/viewChapterPRE", {
    schoolClass,
    subject,
    chapter,
    premiumExercises,
    grouped,
  });
};

// Give Premium access (✅ MODIFIÉ: maintenant au niveau de la matière)
module.exports.givePremiumAccess = async (req, res) => {
  const schoolClass = await Class.findById(req.params.class_id);
  const subject = await Subject.findById(req.params.subject_id);

  const user = await User.findOne({
    username: req.body.student_username,
  });

  if (!user) {
    req.flash("error", "Utilisateur non trouvé");
    return res.redirect("back");
  }

  const user_hstudent = await HStudent.findOne({
    studentBasicInfo: user._id,
  });

  if (!user_hstudent) {
    req.flash("error", "Étudiant non trouvé");
    return res.redirect("back");
  }

  if (!subject.premiumStudents) subject.premiumStudents = [];
  const status = grantOrRenew(subject.premiumStudents, user_hstudent._id);
  if (status === "active") {
    req.flash("error", "Cet élève a déjà un accès premium actif à cette matière");
    return res.redirect("back");
  }
  await subject.save();

  req.flash(
    "success",
    `Accès premium ${status === "renewed" ? "renouvelé" : "accordé"} à ${user.surname} ${user.name} pour la matière ${subject.title}`
  );
  res.redirect("back");
};

// Révoquer l'accès premium d'un élève à une matière
module.exports.revokePremiumAccess = async (req, res) => {
  const subject = await Subject.findById(req.params.subject_id);

  if (!subject) {
    req.flash("error", "Matière non trouvée");
    return res.redirect("back");
  }

  const before = (subject.premiumStudents || []).length;
  subject.premiumStudents = (subject.premiumStudents || []).filter(
    (e) => e.student && e.student.toString() !== req.params.student_id
  );

  if (subject.premiumStudents.length === before) {
    req.flash("error", "Cet élève n'avait pas d'accès premium à cette matière");
    return res.redirect("back");
  }

  await subject.save();
  req.flash("success", "Accès premium révoqué avec succès");
  res.redirect("back");
};

// Page de gestion du premium pour une matière (demandes + élèves premium)
module.exports.manageSubjectPremium = async (req, res) => {
  const schoolClass = await Class.findById(req.params.class_id);
  const subject = await Subject.findById(req.params.subject_id).populate({
    path: "premiumStudents.student",
    populate: { path: "studentBasicInfo", select: "username name surname email" },
  });

  if (!subject) {
    req.flash("error", "Matière non trouvée");
    return res.redirect(
      `/programs/ekalan/kalan/admindashboard/kalan/class/${req.params.class_id}/subjects`
    );
  }

  const requests = await PremiumRequest.find({ subjectId: subject._id })
    .populate({
      path: "studentId",
      populate: { path: "studentBasicInfo", select: "username name surname email" },
    })
    .populate("reviewedBy", "username name surname")
    .sort({ createdAt: -1 });

  res.render("programs/ekalan/Class/subjects/managePremium", {
    schoolClass,
    subject,
    pendingRequests: requests.filter((r) => r.status === "pending"),
    processedRequests: requests.filter((r) => r.status !== "pending"),
  });
};

/*=========================================

                VIDEO CONTENT (EXERCISES)

===========================================*/
module.exports.createVideoContent = async (req, res) => {
  const chapter = await Chapter.findById(req.params.chapter_id);
  if (!chapter) {
    req.flash("error", "Chapitre non trouvé");
    return res.redirect("back");
  }

  // ✅ NOUVEAU: Créer l'exercice avec chapterId
  // Le champ isPremium sera automatiquement défini selon le videoType
  const newCourseContent = new HSCourseVideo({
    ...req.body.video,
    chapterId: chapter._id
  });
  await newCourseContent.save();

  // ✅ NOUVEAU: Ajouter à l'array 'content' au lieu des multiples arrays
  chapter.content.push(newCourseContent._id);
  await chapter.save();

  req.flash("success", "Exercice créé avec succès");
  res.redirect("back");
};

// ❌ SUPPRIMÉ: giveExercisePremiumAccess et removeExercisePremiumAccess
// L'accès premium est maintenant géré uniquement au niveau de la matière (Subject)

// ✅ NOUVEAU: Demander l'accès premium à une matière
module.exports.requestPremiumAccess = async (req, res) => {
  const subject = await Subject.findById(req.params.subject_id);
  
  if (!subject) {
    req.flash("error", "Matière non trouvée");
    return res.redirect("back");
  }
  
  if (!req.user || !req.user.highSchool_id) {
    req.flash("error", "Vous devez être connecté pour faire une demande");
    return res.redirect("back");
  }

  // Vérifier si l'étudiant a déjà accès premium
  if (hasActiveAccess(subject.premiumStudents, req.user.highSchool_id)) {
    req.flash("info", "Vous avez déjà accès premium à cette matière");
    return res.redirect("back");
  }
  
  // Vérifier si une demande est déjà en attente
  const existingRequest = await PremiumRequest.findOne({
    studentId: req.user.highSchool_id,
    subjectId: subject._id,
    kind: "subject",
    status: "pending"
  });

  if (existingRequest) {
    req.flash("info", "Vous avez déjà une demande en attente pour cette matière");
    return res.redirect("back");
  }

  // Créer la demande
  const newRequest = new PremiumRequest({
    studentId: req.user.highSchool_id,
    subjectId: subject._id,
    kind: "subject",
    status: "pending"
  });

  await newRequest.save();

  req.flash("success", "Votre demande d'accès premium a été envoyée. Elle sera traitée par un administrateur.");
  res.redirect("back");
};

/* ====================== KALAN NAABA (bundle classe) ====================== */

// Étudiant: demander Kalan Naaba (accès à toute la classe)
module.exports.requestNaabaAccess = async (req, res) => {
  const schoolClass = await Class.findById(req.params.class_id);
  if (!schoolClass) {
    req.flash("error", "Classe non trouvée");
    return res.redirect("back");
  }
  if (!req.user || !req.user.highSchool_id) {
    req.flash("error", "Vous devez être connecté pour faire une demande");
    return res.redirect("back");
  }
  const hsId = req.user.highSchool_id;

  if (hasNaaba(schoolClass, hsId)) {
    req.flash("info", "Vous avez déjà Kalan Naaba pour cette classe");
    return res.redirect("back");
  }

  const existing = await PremiumRequest.findOne({
    studentId: hsId,
    classId: schoolClass._id,
    kind: "class",
    status: "pending",
  });
  if (existing) {
    req.flash("info", "Vous avez déjà une demande Kalan Naaba en attente pour cette classe");
    return res.redirect("back");
  }

  await new PremiumRequest({
    studentId: hsId,
    classId: schoolClass._id,
    kind: "class",
    status: "pending",
  }).save();

  req.flash("success", "Votre demande Kalan Naaba a été envoyée. Elle sera traitée par un administrateur.");
  res.redirect("back");
};

// Admin: page de gestion Kalan Naaba pour une classe
module.exports.manageClassNaaba = async (req, res) => {
  const schoolClass = await Class.findById(req.params.class_id)
    .populate("subjects", "title premiumPrice")
    .populate({
      path: "naabaStudents.student",
      populate: { path: "studentBasicInfo", select: "username name surname email phoneNumber" },
    });

  if (!schoolClass) {
    req.flash("error", "Classe non trouvée");
    return res.redirect("/programs/ekalan/kalan/admindashboard/kalan/class");
  }

  const requests = await PremiumRequest.find({ classId: schoolClass._id, kind: "class" })
    .populate({
      path: "studentId",
      populate: { path: "studentBasicInfo", select: "username name surname email phoneNumber" },
    })
    .populate("reviewedBy", "username name surname")
    .sort({ createdAt: -1 });

  res.render("programs/ekalan/Class/subjects/manageNaaba", {
    schoolClass,
    naabaPrice: computeNaabaPrice(schoolClass.subjects, schoolClass.naabaDiscountPercent),
    pendingRequests: requests.filter((r) => r.status === "pending"),
    processedRequests: requests.filter((r) => r.status !== "pending"),
  });
};

// Admin: mettre à jour la remise Kalan Naaba de la classe
module.exports.updateNaabaDiscount = async (req, res) => {
  const schoolClass = await Class.findById(req.params.class_id);
  if (!schoolClass) {
    req.flash("error", "Classe non trouvée");
    return res.redirect("back");
  }
  let pct = parseFloat(req.body.naabaDiscountPercent);
  if (isNaN(pct) || pct < 0) pct = 0;
  if (pct > 100) pct = 100;
  schoolClass.naabaDiscountPercent = pct;
  await schoolClass.save();
  req.flash("success", "Remise Kalan Naaba mise à jour");
  res.redirect("back");
};

// Admin: accorder Kalan Naaba manuellement (par username)
module.exports.giveNaabaAccess = async (req, res) => {
  const schoolClass = await Class.findById(req.params.class_id);
  if (!schoolClass) {
    req.flash("error", "Classe non trouvée");
    return res.redirect("back");
  }

  const user = await User.findOne({ username: req.body.student_username });
  if (!user) {
    req.flash("error", "Utilisateur non trouvé");
    return res.redirect("back");
  }
  const student = await HStudent.findOne({ studentBasicInfo: user._id });
  if (!student) {
    req.flash("error", "Étudiant non trouvé");
    return res.redirect("back");
  }

  if (!schoolClass.naabaStudents) schoolClass.naabaStudents = [];
  const status = grantOrRenew(schoolClass.naabaStudents, student._id);
  if (status === "active") {
    req.flash("error", "Cet élève a déjà Kalan Naaba actif pour cette classe");
    return res.redirect("back");
  }
  await schoolClass.save();

  req.flash("success", `Kalan Naaba ${status === "renewed" ? "renouvelé" : "accordé"} à ${user.surname} ${user.name}`);
  res.redirect("back");
};

// Admin: révoquer Kalan Naaba d'un élève
module.exports.revokeNaabaAccess = async (req, res) => {
  const schoolClass = await Class.findById(req.params.class_id);
  if (!schoolClass) {
    req.flash("error", "Classe non trouvée");
    return res.redirect("back");
  }
  const before = (schoolClass.naabaStudents || []).length;
  schoolClass.naabaStudents = (schoolClass.naabaStudents || []).filter(
    (e) => e.student && e.student.toString() !== req.params.student_id
  );
  if (schoolClass.naabaStudents.length === before) {
    req.flash("error", "Cet élève n'avait pas Kalan Naaba");
    return res.redirect("back");
  }
  await schoolClass.save();
  req.flash("success", "Kalan Naaba révoqué avec succès");
  res.redirect("back");
};

// ── Kalan Maths Lab (produit autonome) ───────────────────────────────
// Page de gestion : prix + octroi manuel + liste des accès actifs.
module.exports.manageClassMathsLab = async (req, res) => {
  const schoolClass = await Class.findById(req.params.class_id)
    .populate({
      path: "mathsLabStudents.student",
      populate: { path: "studentBasicInfo", select: "username name surname email phoneNumber" },
    });

  if (!schoolClass) {
    req.flash("error", "Classe non trouvée");
    return res.redirect("/programs/ekalan/kalan/admindashboard/kalan/class");
  }

  res.render("programs/ekalan/Class/subjects/manageMathsLab", { schoolClass });
};

// Admin: mettre à jour le prix de la Kalan Maths Lab (produit autonome)
module.exports.updateMathsLabPrice = async (req, res) => {
  const schoolClass = await Class.findById(req.params.class_id);
  if (!schoolClass) {
    req.flash("error", "Classe non trouvée");
    return res.redirect("back");
  }
  let price = parseFloat(req.body.mathsLabPrice);
  if (isNaN(price) || price < 0) price = 0;
  schoolClass.mathsLabPrice = price;
  await schoolClass.save();
  req.flash("success", "Prix Kalan Maths Lab mis à jour");
  res.redirect("back");
};

// Admin: accorder l'accès autonome Kalan Maths Lab manuellement (par username)
module.exports.giveMathsLabAccess = async (req, res) => {
  const schoolClass = await Class.findById(req.params.class_id);
  if (!schoolClass) {
    req.flash("error", "Classe non trouvée");
    return res.redirect("back");
  }

  const user = await User.findOne({ username: req.body.student_username });
  if (!user) {
    req.flash("error", "Utilisateur non trouvé");
    return res.redirect("back");
  }
  const student = await HStudent.findOne({ studentBasicInfo: user._id });
  if (!student) {
    req.flash("error", "Étudiant non trouvé");
    return res.redirect("back");
  }

  if (!schoolClass.mathsLabStudents) schoolClass.mathsLabStudents = [];
  const status = grantOrRenew(schoolClass.mathsLabStudents, student._id);
  if (status === "active") {
    req.flash("error", "Cet élève a déjà la Kalan Maths Lab active pour cette classe");
    return res.redirect("back");
  }
  await schoolClass.save();

  req.flash("success", `Kalan Maths Lab ${status === "renewed" ? "renouvelée" : "accordée"} à ${user.surname} ${user.name}`);
  res.redirect("back");
};

// Admin: révoquer l'accès autonome Kalan Maths Lab d'un élève
module.exports.revokeMathsLabAccess = async (req, res) => {
  const schoolClass = await Class.findById(req.params.class_id);
  if (!schoolClass) {
    req.flash("error", "Classe non trouvée");
    return res.redirect("back");
  }
  const before = (schoolClass.mathsLabStudents || []).length;
  schoolClass.mathsLabStudents = (schoolClass.mathsLabStudents || []).filter(
    (e) => e.student && e.student.toString() !== req.params.student_id
  );
  if (schoolClass.mathsLabStudents.length === before) {
    req.flash("error", "Cet élève n'avait pas la Kalan Maths Lab");
    return res.redirect("back");
  }
  await schoolClass.save();
  req.flash("success", "Kalan Maths Lab révoquée avec succès");
  res.redirect("back");
};

// API: rechercher les élèves d'une classe (nom / prénom / username / email)
// pour l'autocomplétion du formulaire d'octroi Kalan Maths Lab.
module.exports.searchClassStudents = async (req, res) => {
  const q = (req.query.q || "").trim();
  if (q.length < 2) return res.json({ students: [] });

  const schoolClass = await Class.findById(req.params.class_id).select("students");
  if (!schoolClass) return res.json({ students: [] });

  const students = await HStudent.find({ _id: { $in: schoolClass.students || [] } })
    .populate("studentBasicInfo", "username name surname email");

  const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
  const results = students
    .map((s) => s.studentBasicInfo)
    .filter((u) => u && (rx.test(u.username || "") || rx.test(u.name || "") || rx.test(u.surname || "") || rx.test(u.email || "")))
    .slice(0, 12)
    .map((u) => ({ username: u.username, name: u.name, surname: u.surname, email: u.email }));

  res.json({ students: results });
};

// ✅ NOUVEAU: Lister toutes les demandes d'accès premium
module.exports.listPremiumRequests = async (req, res) => {
  const status = req.query.status || "pending"; // pending, approved, rejected, all
  const search = (req.query.search || "").trim();
  const classId = req.query.class || "";
  const subjectId = req.query.subject || "";
  const limit = 20;

  let filter = {};
  if (status !== "all") {
    filter.status = status;
  }

  // Filtre par matière (prioritaire) ou par classe (matières + Kalan Naaba)
  if (subjectId) {
    filter.subjectId = subjectId;
  } else if (classId) {
    const classSubjects = await Subject.find({ classId }).select("_id");
    filter.$or = [
      { subjectId: { $in: classSubjects.map((s) => s._id) } },
      { classId, kind: "class" },
    ];
  }

  // Recherche par étudiant (nom, prénom, username, email)
  if (search) {
    const rx = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    const users = await User.find({
      $or: [{ name: rx }, { surname: rx }, { username: rx }, { email: rx }],
    }).select("_id");
    const students = await HStudent.find({
      studentBasicInfo: { $in: users.map((u) => u._id) },
    }).select("_id");
    filter.studentId = { $in: students.map((s) => s._id) };
  }

  // Pagination
  const totalFiltered = await PremiumRequest.countDocuments(filter);
  const totalPages = Math.max(1, Math.ceil(totalFiltered / limit));
  const page = Math.min(Math.max(1, parseInt(req.query.page) || 1), totalPages);

  // Demandes en attente: les plus anciennes d'abord (FIFO); sinon plus récentes d'abord
  const sort = status === "pending" ? { createdAt: 1 } : { createdAt: -1 };

  const requests = await PremiumRequest.find(filter)
    .populate({
      path: "studentId",
      populate: { path: "studentBasicInfo", select: "username name surname email phoneNumber" }
    })
    .populate({
      path: "subjectId",
      select: "title classId premiumPrice",
      populate: { path: "classId", select: "title serie" }
    })
    .populate({ path: "classId", select: "title serie" })
    .populate("reviewedBy", "username name surname")
    .sort(sort)
    .skip((page - 1) * limit)
    .limit(limit);

  // Compter les demandes par statut (vue d'ensemble globale)
  const pendingCount = await PremiumRequest.countDocuments({ status: "pending" });
  const approvedCount = await PremiumRequest.countDocuments({ status: "approved" });
  const rejectedCount = await PremiumRequest.countDocuments({ status: "rejected" });

  // Options pour les filtres
  const classes = await Class.find().select("title serie").sort({ title: 1 });
  const subjects = await Subject.find()
    .select("title classId")
    .populate("classId", "title serie")
    .sort({ title: 1 });

  res.render("programs/ekalan/admin/premium-requests", {
    requests,
    currentStatus: status,
    filters: { search, classId, subjectId },
    classes,
    subjects,
    pagination: { page, totalPages, total: totalFiltered, limit },
    stats: {
      pending: pendingCount,
      approved: approvedCount,
      rejected: rejectedCount,
      total: pendingCount + approvedCount + rejectedCount
    }
  });
};

// Traitement en masse des demandes premium (approuver / rejeter une sélection)
module.exports.bulkPremiumRequests = async (req, res) => {
  const action = req.body.action;
  let ids = req.body.requestIds || [];
  if (!Array.isArray(ids)) ids = [ids];
  ids = ids.filter(Boolean);

  if (!["approve", "reject"].includes(action) || ids.length === 0) {
    req.flash("error", "Action ou sélection invalide");
    return res.redirect("back");
  }

  const requests = await PremiumRequest.find({
    _id: { $in: ids },
    status: "pending",
  })
    .populate("subjectId")
    .populate("classId");

  let processed = 0;
  for (const request of requests) {
    if (action === "approve") {
      if (request.kind === "class") {
        // Kalan Naaba: accorder/renouveler sur la classe
        const schoolClass = request.classId;
        if (schoolClass) {
          if (!schoolClass.naabaStudents) schoolClass.naabaStudents = [];
          grantOrRenew(schoolClass.naabaStudents, request.studentId);
          await schoolClass.save();
        }
      } else {
        // Kalan Ba: accorder/renouveler sur la matière
        const subject = request.subjectId;
        if (subject) {
          if (!subject.premiumStudents) subject.premiumStudents = [];
          grantOrRenew(subject.premiumStudents, request.studentId);
          await subject.save();
        }
      }
      request.status = "approved";
    } else {
      request.status = "rejected";
    }
    request.reviewedAt = new Date();
    request.reviewedBy = req.user._id;
    await request.save();
    processed++;
  }

  req.flash(
    "success",
    `${processed} demande(s) ${action === "approve" ? "approuvée(s)" : "rejetée(s)"}`
  );
  res.redirect("back");
};

// ✅ NOUVEAU: Approuver une demande d'accès premium
module.exports.approvePremiumRequest = async (req, res) => {
  const request = await PremiumRequest.findById(req.params.request_id)
    .populate("studentId")
    .populate("subjectId")
    .populate("classId");

  if (!request) {
    req.flash("error", "Demande non trouvée");
    return res.redirect("back");
  }

  if (request.status !== "pending") {
    req.flash("error", "Cette demande a déjà été traitée");
    return res.redirect("back");
  }

  const student = request.studentId;
  const who = student.studentBasicInfo ? student.studentBasicInfo.username : "l'étudiant";

  if (request.kind === "class") {
    // Kalan Naaba: accès à toute la classe
    const schoolClass = request.classId;
    if (!schoolClass.naabaStudents) schoolClass.naabaStudents = [];
    const status = grantOrRenew(schoolClass.naabaStudents, student._id);
    await schoolClass.save();
    req.flash("success", `Kalan Naaba ${status === "renewed" ? "renouvelé" : "accordé"} à ${who} (${schoolClass.title} ${schoolClass.serie})`);
  } else {
    // Kalan Ba: accès à la matière
    const subject = request.subjectId;
    if (!subject.premiumStudents) subject.premiumStudents = [];
    const status = grantOrRenew(subject.premiumStudents, student._id);
    await subject.save();
    req.flash("success", `Accès premium ${status === "renewed" ? "renouvelé" : "accordé"} à ${who} pour la matière ${subject.title}`);
  }

  request.status = "approved";
  request.reviewedAt = new Date();
  request.reviewedBy = req.user._id;
  if (req.body.notes) request.notes = req.body.notes;
  await request.save();

  res.redirect("back");
};

// ✅ NOUVEAU: Rejeter une demande d'accès premium
module.exports.rejectPremiumRequest = async (req, res) => {
  const request = await PremiumRequest.findById(req.params.request_id)
    .populate("studentId")
    .populate("subjectId");
  
  if (!request) {
    req.flash("error", "Demande non trouvée");
    return res.redirect("back");
  }
  
  if (request.status !== "pending") {
    req.flash("error", "Cette demande a déjà été traitée");
    return res.redirect("back");
  }
  
  // Mettre à jour le statut de la demande
  request.status = "rejected";
  request.reviewedAt = new Date();
  request.reviewedBy = req.user._id;
  if (req.body.notes) {
    request.notes = req.body.notes;
  }
  await request.save();

  req.flash("success", "Demande rejetée");
  res.redirect("back");
};

/* ====================== ESPACE MATHS ====================== */

// Page de l'Espace Maths (GeoGebra + explications IA)
module.exports.mathsLab = async (req, res) => {
  const schoolClass = await Class.findById(req.params.class_id);
  if (!schoolClass) {
    req.flash("error", "Classe non trouvée");
    return res.redirect("back");
  }
  const oq = await openQuestionQuota(req.user);
  res.render("programs/ekalan/Class/maths-lab", { schoolClass, oqUsed: oq.used, oqLimit: oq.limit });
};

// Detect cache entries whose LaTeX was corrupted by lone-backslash JSON escapes
// (a control char where a command like \frac/\text was meant). Such an entry is
// re-generated with the repaired parser instead of being served.
function cacheLooksCorrupted(doc) {
  const latexes = [doc.finalAnswerLatex || ""];
  (doc.steps || []).forEach((s) => { if (s && s.latex) latexes.push(s.latex); });
  return latexes.some((s) => { for (let i = 0; i < s.length; i++) { if (s.charCodeAt(i) < 32) return true; } return false; });
}

// ── Maths Lab : « Questions ouvertes » ────────────────────────────────
// Quota of fresh AI answers per student per day (cached answers are free; admins unlimited).
const OPEN_QUESTIONS_DAILY_LIMIT = 10;
function isMathsLabAdmin(user) { return !!user && ["admin", "super-admin"].includes(user.role); }
async function openQuestionQuota(user) {
  if (!user) return { used: 0, limit: OPEN_QUESTIONS_DAILY_LIMIT };
  if (isMathsLabAdmin(user)) return { used: 0, limit: null };
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const used = await OpenQuestion.countDocuments({ user: user._id, createdAt: { $gte: start } });
  return { used, limit: OPEN_QUESTIONS_DAILY_LIMIT };
}

// POST …/maths-lab/open  { statement, questions[], mode: 'hint' | 'full' } → JSON
module.exports.openQuestion = async (req, res) => {
  try {
    const mode = req.body.mode === "hint" ? "hint" : "full";
    const norm = (s) => String(s == null ? "" : s).replace(/\s+/g, " ").trim();
    const statement = norm(req.body.statement);
    // typed questions { type: calc|show|compare|sign, text, expr, a, b } (plain strings still accepted)
    const TYPES = ["calc", "show", "compare", "sign"];
    const questions = (Array.isArray(req.body.questions) ? req.body.questions : []).map((q) => {
      if (typeof q === "string") return { type: "", text: norm(q) };
      const o = { type: TYPES.includes(q && q.type) ? q.type : "", text: norm(q && q.text) };
      ["expr", "a", "b"].forEach((k) => { if (q && q[k]) o[k] = norm(q[k]).slice(0, 300); });
      return o;
    }).filter((q) => q.text);
    if (!statement || statement.length > 2000) return res.status(400).json({ ok: false, error: "Énoncé manquant ou trop long (2000 caractères max)." });
    if (!questions.length || questions.length > 8 || questions.some((q) => q.text.length > 500)) {
      return res.status(400).json({ ok: false, error: "Indiquez entre 1 et 8 questions (500 caractères max chacune)." });
    }
    const key = crypto.createHash("sha256").update(mode + "|" + statement + "|" + JSON.stringify(questions)).digest("hex");
    const quota = await openQuestionQuota(req.user);

    const cached = await OpenQuestion.findOne({ key }).sort({ createdAt: -1 });
    if (cached && cached.answers && cached.answers.length) {
      return res.json({ ok: true, cached: true, answers: cached.answers, verification: cached.verification, retried: cached.retried, anchors: cached.anchors || [], quota });
    }
    if (quota.limit !== null && quota.used >= quota.limit) {
      return res.status(429).json({ ok: false, error: `Limite atteinte : ${quota.limit} questions ouvertes par jour. Revenez demain !`, quota });
    }

    const result = await solveOpenQuestion({ statement, questions, mode });
    if (!result.ok) {
      return res.json({ ok: false, error: "Réponse indisponible pour le moment — réessayez dans un instant.", quota });
    }
    await OpenQuestion.create({
      user: req.user._id, classId: req.params.class_id, key, mode, statement, questions: questions.map((q) => q.text), types: questions.map((q) => q.type),
      answers: result.answers, verification: result.verification, retried: result.retried, anchors: result.anchors,
    });
    const after = { used: quota.limit === null ? 0 : quota.used + 1, limit: quota.limit };
    return res.json({ ok: true, cached: false, answers: result.answers, verification: result.verification, retried: result.retried, anchors: result.anchors, quota: after });
  } catch (err) {
    console.error("[openQuestion]", err && err.message);
    return res.status(500).json({ ok: false, error: "Erreur serveur." });
  }
};

// Endpoint JSON : explication pas-à-pas (cache + Claude). Renvoie toujours du JSON.
module.exports.explainMath = async (req, res) => {
  try {
    const domain = req.body.domain === "complex" ? "complex"
      : req.body.domain === "trig" ? "trig" : "function";
    const operation = req.body.operation;
    const casResult = typeof req.body.casResult === "string" ? req.body.casResult.trim() : "";

    // Trig: Claude computes the result itself, so no casResult is supplied.
    const longOp = operation === "vecteurs" || operation === "transfo" || operation === "analytique" || operation === "espace" || operation === "conique" || operation === "divisibilite" || operation === "affine" || operation === "branches" || operation === "study" || operation === "diff_eq"; // multi-question exercise: longer input and anchored summary
    if (domain !== "trig" && (!casResult || casResult.length > (longOp ? 2500 : 500))) {
      return res.status(400).json({ ok: false, error: "Résultat invalide." });
    }

    let key;
    let input;
    let params = {};

    if (domain === "trig") {
      input = typeof req.body.expression === "string" ? req.body.expression.trim() : "";
      if (!input || input.length > 300) {
        return res.status(400).json({ ok: false, error: "Expression invalide." });
      }
      if (!TRIG_OPERATIONS[operation]) {
        return res.status(400).json({ ok: false, error: "Opération inconnue." });
      }
      if (operation === "trig_equation") {
        const interval = typeof req.body.interval === "string" ? req.body.interval.trim().slice(0, 60) : "";
        params = { interval };
        key = `trig|${operation}|${input}|${interval}`;
      } else {
        key = `trig|${operation}|${input}`;
      }
    } else if (domain === "complex") {
      // input = expression canonique (z₁, (3+4i)^3, ou la liste d'affixes pour la géométrie)
      input = typeof req.body.expression === "string" ? req.body.expression.trim() : "";
      if (!input || input.length > 400) {
        return res.status(400).json({ ok: false, error: "Nombre complexe invalide." });
      }
      if (!COMPLEX_OPERATIONS[operation]) {
        return res.status(400).json({ ok: false, error: "Opération inconnue." });
      }

      const z2 = typeof req.body.z2 === "string" ? req.body.z2.trim() : "";
      const n = Number.parseInt(req.body.n, 10);
      const arithOp = req.body.arithOp;
      const z0 = typeof req.body.z0 === "string" ? req.body.z0.trim().slice(0, 120) : "";

      let opKeyPart = operation;
      if (operation === "arithmetic") {
        if (!z2 || z2.length > 120) {
          return res.status(400).json({ ok: false, error: "Second nombre complexe invalide." });
        }
        if (!ARITH_LABELS[arithOp]) {
          return res.status(400).json({ ok: false, error: "Opération arithmétique inconnue." });
        }
        params = { z2, arithOp };
      } else if (operation === "power" || operation === "nth_roots") {
        if (!Number.isInteger(n) || n < 2 || n > 12) {
          return res.status(400).json({ ok: false, error: "Exposant n invalide (2 à 12)." });
        }
        params = { n };
      } else if (operation === "eval_at" || operation === "quotient" || operation === "solve_quotient") {
        if (!z0) {
          return res.status(400).json({ ok: false, error: "Valeur z₀ manquante." });
        }
        params = { z0 };
        // distinct cache per z₀ ; "quotient" v2 = both methods (division posée + identification)
        opKeyPart = operation === "quotient" ? `quotient:v2:${z0}` : `${operation}:${z0}`;
      }

      key = `complex|${input}|${opKeyPart}|${casResult}`;
    } else {
      input = typeof req.body.function === "string" ? req.body.function.trim() : "";
      if (!input || input.length > (longOp ? 800 : 200)) {
        return res.status(400).json({ ok: false, error: "Fonction invalide." });
      }
      if (!OPERATIONS[operation]) {
        return res.status(400).json({ ok: false, error: "Opération inconnue." });
      }
      let opKeyPart = operation;
      if (operation === "limit") {
        const point = typeof req.body.point === "string" ? req.body.point.trim().slice(0, 40) : "";
        const side = req.body.side === "+" || req.body.side === "-" ? req.body.side : "";
        if (point) {
          params = { point, side };
          opKeyPart = `limit:${point}${side}`; // distinct cache key per target/side
        }
      } else if (operation === "integral_def") {
        const a = typeof req.body.a === "string" ? req.body.a.trim().slice(0, 40) : "";
        const b = typeof req.body.b === "string" ? req.body.b.trim().slice(0, 40) : "";
        if (!a || !b) {
          return res.status(400).json({ ok: false, error: "Bornes a et b manquantes." });
        }
        params = { a, b };
        opKeyPart = `integral_def:${a},${b}`; // distinct cache key per bounds
      } else if (operation === "inequation") {
        const method = typeof req.body.method === "string" ? req.body.method : "";
        if (INEQUATION_METHODS[method]) {
          params = { method };
          opKeyPart = `inequation:${method}`;
        }
      } else if (operation === "diff_eq") {
        if (req.body.method === "lin2") params = { method: "lin2" };
      } else if (operation === "affine") {
        params = { method: ["study", "write", "compose"].includes(req.body.method) ? req.body.method : "study" };
      } else if (operation === "divisibilite") {
        params = { method: ["div_base", "div_table", "div_false", "rest", "which"].includes(req.body.method) ? req.body.method : "div_table" };
      } else if (operation === "conique") {
        params = { method: req.body.method === "fde" ? "fde" : "eq" };
      } else if (operation === "vecteurs") {
        if (req.body.method === "repere") params = { method: "repere" }; // dans un repère (coordinates)
      } else if (operation === "transfo") {
        const task = ["recog", "recog_ind", "write", "write_ind", "find", "find_ind", "compose"].includes(req.body.method) ? req.body.method : "recog";
        params = { method: task };
      } else if (operation === "system_free") {
        const method = typeof req.body.method === "string" ? req.body.method : "";
        if (SYSTEM_FREE_METHODS[method]) {
          params = { method };
          opKeyPart = `system_free:${method}`; // the imposed method changes the explanation
        }
      } else if (operation === "integral_ipp") {
        const a = typeof req.body.a === "string" ? req.body.a.trim().slice(0, 40) : "";
        const b = typeof req.body.b === "string" ? req.body.b.trim().slice(0, 40) : "";
        if ((a && !b) || (!a && b)) {
          return res.status(400).json({ ok: false, error: "Bornes a et b incomplètes." });
        }
        if (a) params = { a, b };
        opKeyPart = `integral_ipp:${a},${b}`; // primitive (no bounds) or definite
      } else if (operation === "study") {
        opKeyPart = "study:v4"; // bump when the étude prompt changes (busts old cached studies)
      } else if (operation === "tangent") {
        const x0 = typeof req.body.x0 === "string" ? req.body.x0.trim().slice(0, 40) : "";
        if (!x0) {
          return res.status(400).json({ ok: false, error: "Point x₀ manquant." });
        }
        params = { x0 };
        opKeyPart = `tangent:${x0}`; // distinct cache key per point
      }
      key = longOp
        ? `${operation}|${crypto.createHash("sha256").update(`${input}|${(params && params.method) || ""}|${casResult}`).digest("hex")}`
        : `${input}|${opKeyPart}|${casResult}`;
    }

    const cached = await MathExplanation.findOne({ key });
    if (cached && !cacheLooksCorrupted(cached)) {
      return res.json({ ok: true, cached: true, casResult, steps: cached.steps, finalAnswerLatex: cached.finalAnswerLatex });
    }
    if (cached) {
      // Older entry with LaTeX corrupted by lone-backslash JSON escapes — drop it and regenerate.
      try { await MathExplanation.deleteOne({ key }); } catch (e) { /* ignore */ }
    }

    const result = await explainSteps({ domain, input, operation, casResult, params });
    if (!result.ok) {
      return res.json({
        ok: false,
        casResult,
        error: "Explication indisponible pour le moment — le résultat ci-dessus reste correct.",
      });
    }

    try {
      await MathExplanation.create({ key, domain, functionStr: input, operation, casResult, steps: result.steps, finalAnswerLatex: result.finalAnswerLatex });
    } catch (e) {
      /* ignore duplicate-key race */
    }

    return res.json({ ok: true, cached: false, casResult, steps: result.steps, finalAnswerLatex: result.finalAnswerLatex, verified: result.verified });
  } catch (err) {
    console.error("[explainMath]", err && err.message);
    return res.status(500).json({ ok: false, error: "Erreur serveur." });
  }
};

//
