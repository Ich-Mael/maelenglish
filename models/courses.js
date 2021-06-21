const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const courseSchema = new Schema(
  {
    title: {
      type: String,
      required: true,
    },

    description: {
      type: String,
      required: true,
    },

    courseImageUrl: {
      type: String,
    },

    price: Number,

    instructors: [{
      type: Schema.Types.ObjectId,
      ref: "User",
    }],

    student: [{
      type: Schema.Types.ObjectId,
      ref: "User",
    }],
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Course", courseSchema);
