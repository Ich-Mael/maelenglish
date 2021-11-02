const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const courseSchema = new Schema(
  {
    title: {
      type: String,
      required: true,
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

    description: {
      type: String,
      default: "New Course"
    },

    courseImageUrl: {
      type: String,
      default:"",
    },

    price: {
      type: Number,
      required: true,
    },
   
    requirements: {
      type: String,
      default: "No requirement for this course"
    },

    reviews: [
      {
        type: Schema.Types.ObjectId,
        ref: "Comment",
      },
    ],

    modules: [
      {
        type: Schema.Types.ObjectId,
        ref: "Module",
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

  evaluation: {
    type: Schema.Types.ObjectId,
    ref: "Evaluation",
  },

  videoLinks: [
    {
      type: String,
    },
  ],
});

/*===================================
            Evaluation
===================================*/

const evaluationSchema = new Schema({
  title: {
    type: String,
    required: true,
  },

  questions: [
    {
      Question_text: String,
      Question_response: String,
      options: [
        {
          id: String, //or number
          text: String,
          value: String,
        },
      ],
    },
  ],
  grade: {
    type: Schema.Types.ObjectId,
    ref: "Grade",
  },
});

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

Course = mongoose.model("Course", courseSchema);

Module = mongoose.model("Module", moduleSchema);

Evaluation = mongoose.model("Evaluation", evaluationSchema);

Grade = mongoose.model("Grade", gradeSchema);

module.exports = { Course, Module, Evaluation, Grade };
