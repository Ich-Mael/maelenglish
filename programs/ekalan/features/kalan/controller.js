const User = require("../../../../shared/models/user");
const {
  Class,
  Chapter,
  Subject,
  HStudent,
  HTeacher,
  HSCourseVideo,
  PremiumRequest,
} = require("./model");

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
  
  // ✅ NOUVEAU: Vérifier l'accès premium de l'étudiant pour chaque matière
  let subjectsWithPremiumStatus = [];
  if (req.user && req.user.highSchool_id) {
    for (const subject of schoolClass.subjects) {
      // Vérifier si l'étudiant a accès premium
      const hasPremiumAccess = subject.premiumStudents && 
                               subject.premiumStudents.includes(req.user.highSchool_id);
      
      // Vérifier si une demande est en attente
      const pendingRequest = await PremiumRequest.findOne({
        studentId: req.user.highSchool_id,
        subjectId: subject._id,
        status: "pending"
      });
      
      subjectsWithPremiumStatus.push({
        ...subject.toObject(),
        hasPremiumAccess,
        hasPendingRequest: !!pendingRequest
      });
    }
  } else {
    // Si pas d'utilisateur connecté, juste passer les sujets sans info premium
    subjectsWithPremiumStatus = schoolClass.subjects;
  }
  
  res.render("programs/ekalan/Class/classHome", {
    schoolClass: {
      ...schoolClass.toObject(),
      subjects: subjectsWithPremiumStatus
    },
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
  res.render("programs/ekalan/Class/subjects/viewSubject", {
    schoolClass,
    subject,
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

  res.render("programs/ekalan/Class/chapters/viewChapterS-E", {
    serie,
    subject,
    chapter,
    freeExercises,
    grouped,
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

  // Vérifier si l'étudiant a déjà accès premium à cette matière
  if (subject.premiumStudents && subject.premiumStudents.includes(user_hstudent._id)) {
    req.flash("error", "Cet élève a déjà un accès premium à cette matière");
    return res.redirect("back");
  }

  // Ajouter l'étudiant à la liste des premium students de la matière
  if (!subject.premiumStudents) {
    subject.premiumStudents = [];
  }
  subject.premiumStudents.push(user_hstudent._id);
  await subject.save();

    req.flash(
      "success",
    `Accès premium accordé à ${user.surname} ${user.name} pour la matière ${subject.title}`
    );
    res.redirect("back");
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
  if (subject.premiumStudents && subject.premiumStudents.includes(req.user.highSchool_id)) {
    req.flash("info", "Vous avez déjà accès premium à cette matière");
    return res.redirect("back");
  }
  
  // Vérifier si une demande est déjà en attente
  const existingRequest = await PremiumRequest.findOne({
    studentId: req.user.highSchool_id,
    subjectId: subject._id,
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
    status: "pending"
  });
  
  await newRequest.save();
  
  req.flash("success", "Votre demande d'accès premium a été envoyée. Elle sera traitée par un administrateur.");
  res.redirect("back");
};

// ✅ NOUVEAU: Lister toutes les demandes d'accès premium
module.exports.listPremiumRequests = async (req, res) => {
  const status = req.query.status || "pending"; // pending, approved, rejected, all
  
  let filter = {};
  if (status !== "all") {
    filter.status = status;
  }
  
  const requests = await PremiumRequest.find(filter)
    .populate({
      path: "studentId",
      populate: { path: "studentBasicInfo", select: "username name surname email" }
    })
    .populate({
      path: "subjectId",
      select: "title classId",
      populate: { path: "classId", select: "title serie" }
    })
    .populate("reviewedBy", "username name surname")
    .sort({ createdAt: -1 });
  
  // Compter les demandes par statut
  const pendingCount = await PremiumRequest.countDocuments({ status: "pending" });
  const approvedCount = await PremiumRequest.countDocuments({ status: "approved" });
  const rejectedCount = await PremiumRequest.countDocuments({ status: "rejected" });
  
  res.render("programs/ekalan/admin/premium-requests", {
    requests,
    currentStatus: status,
    stats: {
      pending: pendingCount,
      approved: approvedCount,
      rejected: rejectedCount,
      total: pendingCount + approvedCount + rejectedCount
    }
  });
};

// ✅ NOUVEAU: Approuver une demande d'accès premium
module.exports.approvePremiumRequest = async (req, res) => {
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
  
  const subject = request.subjectId;
  const student = request.studentId;
  
  // Ajouter l'étudiant à la liste des premium students de la matière
  if (!subject.premiumStudents) {
    subject.premiumStudents = [];
  }
  
  if (!subject.premiumStudents.includes(student._id)) {
    subject.premiumStudents.push(student._id);
    await subject.save();
  }
  
  // Mettre à jour le statut de la demande
  request.status = "approved";
  request.reviewedAt = new Date();
  request.reviewedBy = req.user._id;
  if (req.body.notes) {
    request.notes = req.body.notes;
  }
  await request.save();
  
  req.flash("success", `Accès premium accordé à ${student.studentBasicInfo ? student.studentBasicInfo.username : 'l\'étudiant'} pour la matière ${subject.title}`);
  res.redirect("/programs/ekalan/kalan/admindashboard/kalan/premium-requests");
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
  res.redirect("/programs/ekalan/kalan/admindashboard/kalan/premium-requests");
};

//
