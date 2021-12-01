const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const moment = require("moment"); // require

const serieSchema = new Schema(
  {
    title: {
      type: String,
      required: true,
    },

    isActive: {
      type: Boolean,
      default: false,
    },

    category: {
      type: String,
      default: "Education",
    },

    session: {
      startDate: {
        type: Date,
        default: Date.now(),
      },

      endDate: {
        type: Date,
        default: moment().add(1, "M"),
      },
    },

    serieImageUrl: {
      type: String,
      default: "",
    },

    price: {
      type: Number,
      //       required: true,
    },

    requirements: {
      type: String,
      default: "No requirement for this course",
    },

    subjects: [
      {
        type: Schema.Types.ObjectId,
        ref: "Subject",
      },
    ],
    chapitres: [
      {
        type: Schema.Types.ObjectId,
        ref: "Chapitre",
      },
    ],

    students: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
    ],
  },
  {
    timestamps: true,
  }
);

/*===================================
                Subject
===================================*/
const subjectSchema = new Schema({
  title: {
    type: String,
    required: true,
  },

  subjectImageUrl: {
    type: String,
    default: "",
  },

  reviews: [
    {
      type: Schema.Types.ObjectId,
      ref: "Comment",
    },
  ],

  chapitres: [
    {
      type: Schema.Types.ObjectId,
      ref: "Chapitre",
    },
  ],
});

/*===================================
            Module
===================================*/

const chapterSchema = new Schema({
  title: {
    type: String,
    unique: true,
    required: true,
  },

  willLearn: {
    type: String,
  },

  revealDate: {
    type: String,
    default: Date.now(),
  },

  chapterImageUrl: {
    type: String,
    default: "",
  },

  courses: [
    {
      type: Schema.Types.ObjectId,
      ref: "CourseVideo",
    },
  ],

  starterExercise: [
    {
      type: Schema.Types.ObjectId,
      ref: "CourseVideo",
    },
  ],

  advanceExercise: [
    {
      type: Schema.Types.ObjectId,
      ref: "CourseVideo",
    },
  ],

  nationalExams: [
    {
      type: Schema.Types.ObjectId,
      ref: "CourseVideo",
    },
  ],

  schoolExams: [
    {
      type: Schema.Types.ObjectId,
      ref: "CourseVideo",
    },
  ],

  reviews: [
    {
      type: Schema.Types.ObjectId,
      ref: "Comment",
    },
  ],
});

const courseVideoSchema = new Schema({
  title: String,
  country: String,
  examYear: String ,
  author: String ,
  school: String,
  videoNumber: String,
  link: String,
  videoType :{
    type: String,
    enum:["course", "starterEx", "advanceEx", "nationalExam", "schoolExam"]
  }
});

Serie = mongoose.model("Serie", serieSchema);

Chapter = mongoose.model("Chapitre", chapterSchema);

Subject = mongoose.model("Subject", subjectSchema);

CourseVideo = mongoose.model("CourseVideo", courseVideoSchema);

// Grade = mongoose.model("Grade", gradeSchema);

module.exports = { Serie, Chapter, Subject, CourseVideo};
