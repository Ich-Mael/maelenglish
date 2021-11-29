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

    instructors: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
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

  courseVideoLinks: [
    {
      title: String,
      link: String,
    },
  ],

  starterExerciseLinks: [
    {
      title: String,
      link: String,
    },
  ],

  advanceExerciseLinks: [
    {
      title: String,
      link: String,
    },
  ],

  examExerciseLinks: [
    {
      title: String,
      link: String,
    },
  ],

  reviews: [
    {
      type: Schema.Types.ObjectId,
      ref: "Comment",
    },
  ],
});

Serie = mongoose.model("Serie", serieSchema);

Chapter = mongoose.model("Chapitre", chapterSchema);

Subject = mongoose.model("Subject", subjectSchema);

// Grade = mongoose.model("Grade", gradeSchema);

module.exports = { Serie, Chapter, Subject };
