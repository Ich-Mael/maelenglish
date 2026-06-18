const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const moment = require("moment"); // require

/*===================================
             High School
===================================*/
const HighSchoolSchema = new Schema({
  name: {
    type: String,
    required: true,
  },

  founded: {
    type: String,
    required: true,
  },

  area: {
    type: String,
    required: true,
  },

  students: [{
    type: Schema.Types.ObjectId,
    ref: "HStudent",
  }, ],
}, {
  timestamps: true,
});

/*=================================
                Student
===================================*/
const HStudentSchema = new Schema({
  serie: {
    type: String,
    required: true,
  },

  class: {
    type: String,
  },

  academicYear: {
    type: String,
  },

  missionStatement: {
    type: String,
  },

  school: {
    type: String,
  },

  class_id: {
    type: String,
  },

  parentsInfo: {
    type: String,
  },

  neighborhood: {
    type: String,
  },

  parentsContact: {
    type: String,
  },

  practiceSTeacher: [{
    type: String,
  }],

  knowledgeCheckExams: [{
    type: String,
  }],

  personalizedAdvice: [{
    Title: String,
    content: String,
  }],

  hasAHomeTeacher: {
    type: Boolean,
    default: false,
  },

  hasAPremiumContent: {
    type: Boolean,
    default: false,
  },

  mathsGrade: [{
    period: String,
    grade: Number
  }],

  studentBasicInfo: {
    type: Schema.Types.ObjectId,
    ref: "User",
  },

  premiumContent: {
    type: Schema.Types.ObjectId,
    ref: "PremiumContent",
  },

  homeTeacher: [{
    type: Schema.Types.ObjectId,
    ref: "HTeacher",
  }, ],

}, {
  timestamps: true,
});

/*=================================
             Home Teacher
===================================*/
const homeTeacherSchema = new Schema({
  homeTeacherBasicInfo: {
    type: Schema.Types.ObjectId,
    ref: "User",
  },

  occupation: {
    type: String,
  },

  work_areas: [{
    type: String,
  }],

  subject: [{
    type: String,
  }],

  students: [{
    type: Schema.Types.ObjectId,
    ref: "HStudent",
  }, ],

  introVideolink: {
    type: String,
  }

}, {
  timestamps: true,
});

/*================================
              Class
===================================*/
const classSchema = new Schema({
  title: {
    type: String,
    required: true,
    enum: ["Seconde", "Premiere", "Terminale", "Troisieme", "Quatrieme", "Cinquieme", "Sixieme"]
  },

  isActive: {
    type: Boolean,
    default: true,
  },

  serieImageUrl: {
    type: String,
    default: "",
  },

  serie: {
    type: String,
    enum: ["A", "C", "D", "E", "Ti", "AB3", "H", "F1", "F2", "F3", "F4", "G1", "G2", "Collège", "Primaire"]
  },

  subjects: [{
    type: Schema.Types.ObjectId,
    ref: "Subject",
  }, ],

  students: [{
    type: Schema.Types.ObjectId,
    ref: "HStudent",
  }, ],

  // Kalan Naaba: élèves ayant l'accès premium à TOUTE la classe (bundle).
  // Accès limité dans le temps (aligné sur l'année scolaire) — cf. premiumAccess.js
  naabaStudents: [{
    student: { type: Schema.Types.ObjectId, ref: "HStudent" },
    grantedAt: { type: Date, default: Date.now },
    expiresAt: { type: Date },
  }, ],

  // Remise (%) appliquée au prix groupé Kalan Naaba (somme des prix matières)
  naabaDiscountPercent: {
    type: Number,
    default: 20,
  },

}, {
  timestamps: true,
});

/*===================================
                Subject
===================================*/
const subjectSchema = new Schema({
  title: {
    type: String,
    required: true,
  },

  // ✅ NOUVEAU: Référence explicite vers Class
  classId: {
    type: Schema.Types.ObjectId,
    ref: "Class",
    required: true,
    index: true,
  },

  isActive: {
    type: Boolean,
    default: true,
  },

  aboutVideoLink: {
    type: String,
  },

  isScience:{
    type: Boolean,
    default: false, 
  }, 

  subjectImageUrl: {
    type: String,
    default: "",
  },

  reviews: [{
    type: Schema.Types.ObjectId,
    ref: "Comment",
  }, ],

  // Renommé de "chapitres" à "chapters" pour cohérence
  chapters: [{
    type: Schema.Types.ObjectId,
    ref: "Chapter",
  }, ],

  students: [{
    type: Schema.Types.ObjectId,
    ref: "HStudent",
  }, ],

  // Prix de l'accès premium à cette matière (source de vérité unique, FCFA)
  premiumPrice: {
    type: Number,
    default: 2000,
  },

  // Liste des étudiants ayant accès premium à cette matière.
  // Accès limité dans le temps (aligné sur l'année scolaire) — cf. premiumAccess.js
  premiumStudents: [{
    student: { type: Schema.Types.ObjectId, ref: "HStudent" },
    grantedAt: { type: Date, default: Date.now },
    expiresAt: { type: Date },
  }, ],
}, {
  timestamps: true,
});

/*===================================
          Chapter
===================================*/
const chapterSchema = new Schema({
  title: {
    type: String,
    required: true,
    // ✅ SUPPRIMÉ: unique: true - permet la réutilisation de titres entre matières
  },

  // ✅ NOUVEAU: Référence explicite vers Subject
  subjectId: {
    type: Schema.Types.ObjectId,
    ref: "Subject",
    required: true,
    index: true,
  },

  // ✅ NOUVEAU: Référence directe à Class pour faciliter les requêtes
  classId: {
    type: Schema.Types.ObjectId,
    ref: "Class",
    required: true,
    index: true,
  },

  // ✅ NOUVEAU: Ordre d'affichage des chapitres
  order: {
    type: Number,
    default: 0,
  },

  isActive: {
    type: Boolean,
    default: true,
  },

  aboutLink: {
    type: String,
    default: ""
  },

  chapterImageUrl: {
    type: String,
    default: "",
  },

  // ❌ SUPPRIMÉ: premiumPrice déplacé au niveau Subject (source de vérité unique)
  // ❌ SUPPRIMÉ: premiumStudents déplacé au niveau Subject
  // L'accès premium est maintenant géré au niveau de la matière

  // ✅ AMÉLIORÉ: Structure simplifiée avec un seul array pour tous les contenus
  // Les exercices sont maintenant filtrés par videoType dans HSCourseVideo
  content: [{
    type: Schema.Types.ObjectId,
    ref: "HSCourseVideo",
  }, ],

  reviews: [{
    type: Schema.Types.ObjectId,
    ref: "Comment",
  }, ],
}, {
  timestamps: true,
});

// ✅ NOUVEAU: Index composite pour garantir l'unicité du titre dans une matière
chapterSchema.index({ title: 1, subjectId: 1 }, { unique: true });

/*===================================
          Course Video (Exercice)
===================================*/
const courseVideoSchema = new Schema({
  title: {
    type: String,
    required: true,
  },

  // ✅ NOUVEAU: Référence explicite vers Chapter
  chapterId: {
    type: Schema.Types.ObjectId,
    ref: "Chapter",
    required: true,
    index: true,
  },

  videoType: {
    type: String,
    required: true,
    enum: [
      "course",           // Cours vidéo (gratuit)
      "starterEx",        // Exercices de démarrage (gratuit)
      "advanceEx",        // Exercices d'approfondissement (PREMIUM par défaut)
      "nationalExam",     // Examens nationaux (PREMIUM par défaut)
      "schoolExam",       // Examens scolaires (PREMIUM par défaut)
      "practiceEx",       // Exercices pratiques (gratuit)
      "CIAM_basic",       // CIAM basique (gratuit)
      "CIAM_Premium",     // CIAM Premium (PREMIUM par défaut)
      "grandeEcole",      // ✅ NOUVEAU: Exercices grandes écoles (PREMIUM par défaut)
      "bonus_profs",      // Bonus professeurs (PREMIUM par défaut)
      "exo_perso"         // Exercices personnalisés (PREMIUM par défaut)
    ]
  },

  // ✅ NOUVEAU: Contrôle d'accès premium au niveau de l'exercice
  isPremium: {
    type: Boolean,
    default: function() {
      // Définir les types premium par défaut
      const premiumTypes = [
        "advanceEx",
        "nationalExam", 
        "schoolExam",
        "CIAM_Premium",
        "grandeEcole",
        "bonus_profs",
        "exo_perso"
      ];
      return premiumTypes.includes(this.videoType);
    }
  },

  // ❌ SUPPRIMÉ: premiumStudents déplacé au niveau Subject
  // L'accès premium est maintenant géré au niveau de la matière

  // Métadonnées
  country: String,
  reference: String,
  examYear: String,
  author: String,
  otherInfo: String,
  school: String,

  // Contenu
  videoLink: {
    type: String,
    required: true,
  },
  correctionVideoLink: String,
  pdf_Link: String,

  // ✅ NOUVEAU: Ordre d'affichage
  order: {
    type: Number,
    default: 0,
  },

  isActive: {
    type: Boolean,
    default: true,
  }
}, {
  timestamps: true,
});

// ✅ NOUVEAU: Index pour faciliter les requêtes
courseVideoSchema.index({ chapterId: 1, videoType: 1, isPremium: 1 });
courseVideoSchema.index({ chapterId: 1, isPremium: 1 });

/*===================================
        Premium Content
===================================*/
const premiumContentSchema = new Schema({
  title: String,
  chapter: String,
  content: String,
  correctionVideoLink: String,
  pdf_Link: String,
  videoType: {
    type: String,
    enum: ["Exo_Perso", "Devoir_Test", "Conseils_Perso"]
  }
}, {
  timestamps: true
});

/*===================================
        Premium Access Request
===================================*/
const premiumRequestSchema = new Schema({
  studentId: {
    type: Schema.Types.ObjectId,
    ref: "HStudent",
    required: true,
    index: true,
  },
  // Type de demande: "subject" (Kalan Ba, une matière) ou "class" (Kalan Naaba, toute la classe)
  kind: {
    type: String,
    enum: ["subject", "class"],
    default: "subject",
    index: true,
  },
  subjectId: {
    type: Schema.Types.ObjectId,
    ref: "Subject",
    required: function () { return this.kind === "subject"; },
    index: true,
  },
  classId: {
    type: Schema.Types.ObjectId,
    ref: "Class",
    index: true,
  },
  status: {
    type: String,
    enum: ["pending", "approved", "rejected"],
    default: "pending",
    index: true,
  },
  requestedAt: {
    type: Date,
    default: Date.now,
  },
  reviewedAt: Date,
  reviewedBy: {
    type: Schema.Types.ObjectId,
    ref: "User",
  },
  notes: String, // Notes admin (optionnel)
}, {
  timestamps: true,
});

// Anti-doublon des demandes en attente, par tier.
// NOTE migration: l'ancien index { studentId, subjectId, status } (partial status:pending)
// doit être DROPPÉ en base — Mongoose ne modifie pas un index existant en place.
premiumRequestSchema.index(
  { studentId: 1, subjectId: 1, status: 1 },
  { unique: true, partialFilterExpression: { status: "pending", kind: "subject" } }
);
premiumRequestSchema.index(
  { studentId: 1, classId: 1, status: 1 },
  { unique: true, partialFilterExpression: { status: "pending", kind: "class" } }
);

const Class = mongoose.model("Class", classSchema);

const Chapter = mongoose.model("Chapter", chapterSchema);

const Subject = mongoose.model("Subject", subjectSchema);

const HSCourseVideo = mongoose.model("HSCourseVideo", courseVideoSchema);

const HStudent = mongoose.model("HStudent", HStudentSchema);

const HTeacher = mongoose.model("HTeacher", homeTeacherSchema);

const PremiumContent = mongoose.model("PremiumContent", premiumContentSchema);

const PremiumRequest = mongoose.model("PremiumRequest", premiumRequestSchema);

const HighSchool = mongoose.model("HighSchool", HighSchoolSchema);

module.exports = {
  Class,
  Chapter,
  Subject,
  HStudent,
  HTeacher,
  HSCourseVideo,
  PremiumContent,
  PremiumRequest,
  HighSchool
};