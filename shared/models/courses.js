const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const moment = require('moment');

const courseSchema = new Schema({
  title: {
    type: String,
    required: true,
  },

  typeOfCourse:{
    type: String,
    enum:["Special-program", "Distance-learning", "Self-paced"],
  },

  isPrivate: {
    type: Boolean,
    default: false
  },

  isActive: {
    type: Boolean,
    default: false
  },

  willLearn: {
    type: String,
    default: "New Skills"
  },

  category: {
    type: String,
    default: "Education"
  },

  syllabusSummary: {
    type: String,
    default: "Cours de 3 modules et 2 evalutions"
  },

  session: {
    startDate: {
      type: Date,
      default: Date.now()
    },

    endDate: {
      type: Date,
      default: moment().add(1, 'M')
    }
  },

  preview: [{
    title: {
      type: String,
    },
    link: {
      type: String,
    }
  }],

  description: {
    type: String,
    default: "New Course"
  },

  courseImageUrl: {
    type: String,
    default: "",
  },

  price: {
    type: Number,
    required: true,
  },

  requirements: {
    type: String,
    default: "No requirement for this course"
  },

  reviews: [{
    type: Schema.Types.ObjectId,
    ref: "Comment",
  }, ],

  modules: [{
    type: Schema.Types.ObjectId,
    ref: "Module",
  }, ],

  instructors: [{
    type: Schema.Types.ObjectId,
    ref: "User",
  }, ],

  students: [{
    type: Schema.Types.ObjectId,
    ref: "User",
  }, ],

  // ── NEW: structured course fields ─────────────────────────────────

  // Who manages this course — used to separate admin-created courses
  // from program-specific ones (English Boost, PECP, etc.)
  source: {
    type: String,
    enum: ['admin', 'english-boost', 'pecp', 'english4all', 'english4everyone'],
    default: 'admin'
  },

  level: {
    type: String,
    enum: ['beginner', 'intermediate', 'advanced'],
    default: 'beginner'
  },

  finalExam: {
    title:        { type: String, default: '' },
    passingScore: { type: Number, default: 70 },
    timeLimit:    { type: Number, default: 0 }, // minutes, 0 = no limit
    questions: [{
      text:          String,
      options: [{ id: String, text: String, value: String }],
      correctAnswer: String,
      explanation:   { type: String, default: '' }
    }]
  },

  finalProject: {
    title:          { type: String, default: '' },
    instructions:   { type: String, default: '' },
    submissionType: { type: String, enum: ['text', 'link'], default: 'text' },
    maxScore:       { type: Number, default: 100 }
  }
}, {
  timestamps: true,
});

/*===================================
            Module
===================================*/

const moduleSchema = new Schema({
  title: {
    type: String,
    required: true,
  },

  willLearnModule: {
    type: String,
    required: true,
  },

  explanationText: {
    type: String,
  },

  moreDetails: {
    type: String,
  },

  Assignment: [{
    type: Schema.Types.ObjectId,
    ref: "Practice",
  }],

  evaluation: {
    type: Schema.Types.ObjectId,
    ref: "Evaluation",
  },

  revealDate: {
    type: String,
    default: Date.now()
  },

  videoLinks: [{
    type: Schema.Types.ObjectId,
    ref: "EngCourseVideo",
  }, ],

  coachResources: [{
    title: {
      type: String,
      required: true
    },
    type: {
      type: String,
      enum: ["Lesson Plan", "Teaching Guide", "Answer Key", "Presentation Slides", "Worksheet", "Assessment Rubric", "Additional Materials"],
      required: true
    },
    description: {
      type: String
    },
    link: {
      type: String,
      required: true
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],

  // ── NEW: structured module fields ──────────────────────────────────
  order: { type: Number, default: 0 },

  // Lessons (new atomic content units replacing videoLinks + Assignment)
  lessons: [{
    type: Schema.Types.ObjectId,
    ref: 'Lesson'
  }],

  // Graded quiz at end of module
  moduleQuiz: {
    title:        { type: String, default: '' },
    passingScore: { type: Number, default: 70 },
    timeLimit:    { type: Number, default: 0 }, // minutes, 0 = no limit
    questions: [{
      text:          String,
      options: [{ id: String, text: String, value: String }],
      correctAnswer: String,
      explanation:   { type: String, default: '' }
    }]
  },

  // Assignment at end of module (manually graded)
  moduleAssignment: {
    title:          { type: String, default: '' },
    instructions:   { type: String, default: '' },
    submissionType: { type: String, enum: ['text', 'link'], default: 'text' },
    maxScore:       { type: Number, default: 100 },
    dueDate:        { type: Date, default: null }
  }
});

/*===================================
           Practice
===================================*/

const practiceSchema = new Schema({
  title: {
    type: String,
  },

  category:{
    type: String,
    default: "English Exercise",
    enum:["English lesson", "Vocabulary", "Grammar", "Listening", "Reading", "Writing"],
  },

  links: [{
    type: String,
  }]
});

/*===================================
            Evaluation
===================================*/

const evaluationSchema = new Schema({
  title: {
    type: String,
    required: true,
  },

  questions: [{
    Question_text: String,
    Question_response: String, // correct answer value
    options: [{
      id: String,
      text: String,
      value: String,
    }],
  }],

  // Per-student results (replaces the single grade ref)
  studentGrades: [{
    studentId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    score: { type: Number, default: 0 },      // 0–100
    answers: [String],                         // submitted answer values
    submittedAt: { type: Date, default: Date.now }
  }],

  // Legacy single-grade ref (kept for backward compat)
  grade: {
    type: Schema.Types.ObjectId,
    ref: "Grade",
  },
}, { timestamps: true });

/*===================================
          Grade 
===================================*/
const gradeSchema = new Schema({
  student: {
    type: Schema.Types.ObjectId,
    ref: "User",
  },

  score: {
    type: Number,
    default: 0,
  },

  appreciation: {
    text: String,
    feedback: String,
  },
});

// ENGLISH VIDEO LESSON
const engCourseVideoSchema = new Schema({
  title: {
    type: String,
  },

  lessonType: {
    type: String,
    default: "English lesson",
    enum:["English lesson", "Vocabulary", "Grammar", "Pronunciation", "Writing"],
  },

  lessonImage:{
    type: String,
  },

  engCourseLink: {
    type: String,
  }
});

const Course = mongoose.model("Course", courseSchema);
const EngCourseVideo = mongoose.model("EngCourseVideo", engCourseVideoSchema);
const Module = mongoose.model("Module", moduleSchema);
const Practice = mongoose.model("Practice", practiceSchema);
const Evaluation = mongoose.model("Evaluation", evaluationSchema);
const Grade = mongoose.model("Grade", gradeSchema);

module.exports = {
  Course,
  Module,
  Practice,
  Evaluation,
  EngCourseVideo,
  Grade
};

