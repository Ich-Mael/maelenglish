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

  gender: {
    type: String,
    required: true,
    enum: ["male", "female", "other"],
  },

  // Optional: many learners have no email. At least one of email / phoneNumber is required
  // (see the pre-validate hook). Unique only among accounts that have one (sparse index —
  // run `npm run migrate:whatsapp` once so the old non-sparse index is replaced).
  email: {
    type: String,
    trim: true,
    lowercase: true,
    unique: true,
    sparse: true,
    validate: {
      validator: function (v) {
        if (v === undefined || v === null || v === "") return true;
        return /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/.test(v);
      },
      message: "Saisissez une adresse mail valide",
    },
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
      "institution-admin",
      "institution-instructor",
    ],
  },

  // Partner institution this user belongs to (null = AfrohK direct user)
  institutionId: {
    type: Schema.Types.ObjectId,
    ref: "Institution",
    default: null
  },

  isVerified: {
    type: Boolean,
    default: false,
  },

  phoneNumber: {
    type: String,
    trim: true,
  },

  // phoneNumber normalised to international digits (e.g. 22670123456) — WhatsApp recipient and
  // phone login. Computed in the pre-validate hook. Not unique: a family may share one number.
  phoneE164: {
    type: String,
    index: true,
  },

  // Set when the account was activated through WhatsApp: the user chooses the password on the
  // activation page (no password is ever sent over WhatsApp).
  passwordSetRequired: {
    type: Boolean,
    default: false,
  },

  // Password reset by a 6-digit code sent on WhatsApp (hash only, short expiry, limited attempts)
  resetCodeHash: { type: String },
  resetCodeExpires: { type: Date },
  resetCodeAttempts: { type: Number, default: 0 },

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
    default: 3 // Limite par défaut de 3 appareils
  },

  // ── Soft-delete (account deactivation by a global admin) ──
  // isActive: false blocks login and revokes course access while preserving
  // the user record and all historical progress/grades.
  isActive: {
    type: Boolean,
    default: true
  },
  deactivatedAt: {
    type: Date,
    default: null
  },
  deactivatedBy: {
    type: Schema.Types.ObjectId,
    ref: "User",
    default: null
  }
}, {
  timestamps: true
});

// Email or phone: at least one contact channel; keep phoneE164 in sync with phoneNumber.
userSchema.pre("validate", function (next) {
  const { normalizePhone } = require("../utilities/phone");
  if (this.email === "") this.email = undefined;
  if (this.isModified("phoneNumber") || (this.phoneNumber && !this.phoneE164)) {
    this.phoneE164 = this.phoneNumber ? normalizePhone(this.phoneNumber) || undefined : undefined;
  }
  if (!this.email && !this.phoneNumber) {
    this.invalidate("email", "Renseignez une adresse email ou un numéro WhatsApp.");
  }
  next();
});

userSchema.plugin(passportLocalMongoose);

const User = mongoose.model("User", userSchema);

module.exports = User;

