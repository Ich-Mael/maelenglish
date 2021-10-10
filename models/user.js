const mongoose = require("mongoose");
const passportLocalMongoose = require("passport-local-mongoose");
const Schema = mongoose.Schema;

const userSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    surname: {
      type: String,
      trim: true,
      required: true,
    },

    username: {
      type: String,
      trim: true,
      required: true,
      unique: true,
    },

    email: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },

    role: {
      type: String,
      default: "user",
      enum: [
        "user",
        "admin",
        "super-admin",
        "english-club-bm",
        "english-club-admin",
        "instructor",
        "english-coach",
        "student_manager",
      ],
    },

    phoneNumber: {
      type: String,
      trim: true,
    },

    
    imageUrl: {
      type: String,
      trim: true,
      default: "https://www.kindpng.com/picc/m/105-1055656_account-user-profile-avatar-avatar-user-profile-icon.png",
    },

    about: {
      type: String,
      trim: true,
    },

    //social media links
    facebookLink: {
      type: String,
      trim: true,
      default:"https://web.facebook.com/Afro-House-Of-Knowledge-104795908266730",
    },

    twitterLink: {
      type: String,
      trim: true,
      default:"https://twitter.com/afro_of"
    },

    linkedIn: {
      type: String,
      trim: true,
      default:"https://www.linkedin.com/in/ismael-zerbo-443b73220/"
    },

    whatsAppLink: {
      type: String,
      trim: true,
    },

    // English club details
    isEnglishClubBoardMember: {
      type: Boolean,
      default: false,
    },

    // programs
    ownedPrograms: [],


    // courses
    coursesGiven: [
      {
        type: Schema.Types.ObjectId,
        ref: "Course",
      },
    ],

    coursesTaken: [
      {
        type: Schema.Types.ObjectId,
        ref: "Course",
      },
    ],

    //grades
    grades: [
      [
        {
          type: Schema.Types.ObjectId,
          ref: "course",
        },
      ],
    ],
  },
  { timestamps: true }
);

userSchema.plugin(passportLocalMongoose);

const user = mongoose.model("User", userSchema);

module.exports = user;
