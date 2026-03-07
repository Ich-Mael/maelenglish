const mongoose = require("mongoose");
const passportLocalMongoose = require("passport-local-mongoose");
const Schema = mongoose.Schema;
const moment = require('moment');

const userSchema = new Schema({
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

  isVip: {
    type: Boolean,
    default: false
  },

  username: {
    type: String,
    trim: true,
    required: true,
    unique: true,
  },

  defP: {
    type: String,
    trim: true,
    required: false, // Not stored, only used for password confirmation in forms
  },

  gender: {
    type: String,
    required: true,
    enum: ["male", "female", "other"],
  },

  email: {
    type: String,
    trim: true,
    lowercase: true,
    unique: true,
    validate: {
      validator: function (v) {
        return /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/.test(v);
      },
      message: "Saisissez une adresse mail valide",
    },
    required: [true, "Email required"],
  },

  role: {
    type: String,
    default: "user",
    enum: [
      "user",
      "account-manager",
      "admin",
      "super-admin",
      "english-club-bm",
      "english-club-admin",
      "instructor",
      "english-coach",
      "student_manager",
      "englishClub-boardMember",
    ],
  },

  isVerified: {
    type: Boolean,
    default: false,
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
    default: "What you should know about me"
  },

  englishLevel: {
    type: String,
    trim: true,
  },

  // ============================================
  // KALAN PROGRAM FIELDS (Primary to High School)
  // ============================================

  // High School Student (Kalan courses feature)
  isHighSchoolStudent: {
    type: Boolean,
    default: false,
  },

  highSchool_id: {
    type: String,
    trim: true,
    default: "",
  },

  // Home Teacher (MyProf marketplace feature)
  isHomeTeacher: {
    type: Boolean,
    default: false,
  },

  homeTeacher_id: {
    type: String,
    trim: true,
    default: "",
  },

  // ============================================
  // ENGLISH BOOST PROGRAM FIELDS
  // ============================================

  // English Club Member (English4All feature)
  isClubMember: {
    type: Boolean,
    default: false,
  },

  clubMember_id: {
    type: String,
    trim: true,
    default: "",
  },

  // PECP Student (PECP feature)
  isPecpStudent: {
    type: Boolean,
    default: false,
  },

  pecpStudent_id: {
    type: String,
    trim: true,
    default: "",
  },

  // PECP Coach (PECP feature)
  isPecpCoach: {
    type: Boolean,
    default: false,
  },

  pecpCoach_id: {
    type: String,
    trim: true,
    default: "",
  },

  // English Club Board Member
  isEnglishClubBoardMember: {
    type: Boolean,
    default: false,
  },

  // ============================================
  // SOCIAL MEDIA & LINKS
  // ============================================

  likedPage: {
    type: Boolean,
    default: false,
  },

  facebookLink: {
    type: String,
    trim: true,
    default: "https://web.facebook.com/Afro-House-Of-Knowledge-104795908266730",
  },

  twitterLink: {
    type: String,
    trim: true,
    default: "https://twitter.com/afro_of",
  },

  linkedIn: {
    type: String,
    trim: true,
    default: "https://www.linkedin.com/in/ismael-zerbo-443b73220/",
  },

  whatsAppLink: {
    type: String,
    trim: true,
    default: "https://wa.me/22653344444"
  },

  // ============================================
  // COURSES & PROGRAMS
  // ============================================

  // Programs owned by user
  ownedPrograms: [],

  // Special programs with enrollment dates (English Boost)
  specialProgram: [{
    courseTitle: String,
    startDate: {
      type: Date,
      default: Date.now()
    },
    endDate: {
      type: Date,
      default: moment().add(1, 'M')
    }
  },],

  // Courses given (as instructor)
  coursesGiven: [{
    type: Schema.Types.ObjectId,
    ref: "Course",
  },],

  // Courses taken (as student)
  coursesTaken: [{
    type: Schema.Types.ObjectId,
    ref: "Course",
  },],

  // Live performance tracking (English Boost)
  myLivePerf: [{
    type: Schema.Types.ObjectId,
    ref: "LivePerf",
  },],

  // Grades
  grades: [
    [{
      type: Schema.Types.ObjectId,
      ref: "course",
    },],
  ],

  // Activation Fields
  activationToken: {
    type: String,
    default: undefined
  },

  activationExpires: {
    type: Date,
    default: undefined
  },

  // Password Reset Fields
  resetPasswordToken: {
    type: String,
    default: undefined
  },

  resetPasswordExpires: {
    type: Date,
    default: undefined
  },

  // ============================================
  // DEVICE TRACKING (Account Sharing Prevention)
  // ============================================

  // Device tracking for account sharing prevention
  devices: [{
    deviceId: {
      type: String,
      required: true
    },
    deviceType: {
      type: String,
      enum: ['mobile', 'tablet', 'desktop'],
      required: true
    },
    deviceModel: {
      type: String
    },
    browser: String,
    os: String,
    platform: String,
    userAgent: String,
    ipAddress: String,
    lastLogin: {
      type: Date,
      default: Date.now
    },
    firstSeen: {
      type: Date,
      default: Date.now
    },
    isActive: {
      type: Boolean,
      default: true
    }
  }],

  maxDevices: {
    type: Number,
    default: 2 // Limite par défaut de 2 appareils
  }
}, {
  timestamps: true
});

userSchema.plugin(passportLocalMongoose);

const User = mongoose.model("User", userSchema);

module.exports = User;

