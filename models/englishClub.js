const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const {
  format
} = require("date-fns");

// english club schema
const englishClubSchema = new Schema({


  city: {
    type: String,
    trim: true,
  },

  clubType: {
    type: String,
    required: true,
    enum: [
      "High-school",
      "University",
      "Company",
      "Professional",
      "Private",
      "Simple",
    ],
  },

  professionType: {
    type: String,
    trim: true,
  },

  instituition: {
    type: String,
    trim: true,
    required: true,
  },

  acronym: {
    type: String,
    trim: true,
    required: true,
  },

  name: {
    type: String,
    trim: true,
    unique: true,
    required: true,
  },

  motto: {
    type: String,
    trim: true,
    required: true,
  },

  description: {
    type: String,
    trim: true,
  },

  foundDate: {
    type: String,
    required: true,
  },

  // image
  bannerImageUrlMedium: {
    type: String,
    required: true,
    trim: true,
  },

  logoImageUrl: {
    type: String,
    required: true,
  },

  instituitionLogoUrl: {
    type: String,
    required: true,
  },

  // social media links
  facebookLink: {
    type: String,
    trim: true,
  },

  twitterLink: {
    type: String,
    trim: true,
  },

  instagramLink: {
    type: String,
    trim: true,
  },

  youtubeLink: {
    type: String,
    trim: true,
  },

  clubMentor: {
    type: Schema.Types.ObjectId,
    ref: "User",
  },

  mentorDetails: {
    type: String,
    trim: true,
  },

  englishCoach: [{
    type: Schema.Types.ObjectId,
    ref: "User",
  }, ],

  boardMembers: [{
    type: Schema.Types.ObjectId,
    ref: "User",
  }, ],

  members: [{
    type: Schema.Types.ObjectId,
    ref: "User",
  }, ],

  workersOfMonth: [{
    type: Schema.Types.ObjectId,
    ref: "EnglishClubWorkersOfMonth",
  }, ],

  articles: [{
    type: Schema.Types.ObjectId,
    ref: "EnglishClubArticle",
  }, ],

  dailyVocab: [{
    type: Schema.Types.ObjectId,
    ref: "DailyVocabulary",
  }, ],

  weeklyMeeting: [{
    type: Schema.Types.ObjectId,
    ref: "ClubMeeting",
  }, ],

  onlineDebates: [{
    type: Schema.Types.ObjectId,
    ref: "OnlineDebate",
  }, ],

  weeklyVideoLesson: [{
    type: Schema.Types.ObjectId,
    ref: "EnglishWeeklyLessons",
  }, ],
  media: [{
    type: Schema.Types.ObjectId,
    ref: "EnglishClubMedia",
  }, ],
}, {
  timestamps: true,
});

const englishClubHubSchema = new Schema({
  cityName: {
    type: String,
    trim: true
  },

  country: {
    type: String,
    enum: [
      "Burkina-Faso",
      "Niger",
      "Togo",
      "Côte d'Ivoire",
      "Benin",
      "Cameroun",
      "Senegal",
    ],
  },

  clubs: {

    High_school: [{
      type: Schema.Types.ObjectId,
      ref: "EnglishClub",
    }],

    University: [{
      type: Schema.Types.ObjectId,
      ref: "EnglishClub",
    }],

    Company: [{
      type: Schema.Types.ObjectId,
      ref: "EnglishClub",
    }],

    Professional: [{
      type: Schema.Types.ObjectId,
      ref: "EnglishClub",
    }],

    Private: [{
      type: Schema.Types.ObjectId,
      ref: "EnglishClub",
    }],

    Simple: [{
      type: Schema.Types.ObjectId,
      ref: "EnglishClub",
    }]
  },

  focalPoint: {
    type: Schema.Types.ObjectId,
    ref: "User",
  }
});


// english club article schema
const englishClubArticleSchema = new Schema({
  title: {
    type: String,
  },
  // image
  articleImage: {
    type: String,
  },

  articleSummary: {
    type: String,
  },

  articleContent: {
    type: String,
  },

  articleAuthor: {
    type: String,
  },

  postedAT: {
    type: Date,
    default: format(Date.now(), "MM/dd/yyyy"),
  },

  articleComments: {
    type: String,
  },
}, {
  timestamps: true,
});

//Daily vocabulary schema

const dailyVocabularySchema = new Schema({
  wordOfDay: {
    word: {
      type: String,
      default: "Knowledge",
    },

    wordMeaning: {
      type: String,
      default: "",
    },

    learnMoreWord: {
      type: String,
    },
  },

  IdiomDay: {
    idiom: {
      type: String,
      default: "When pigs fly",
    },

    idiomMeaning: {
      type: String,
      default: "To say something will never happen",
    },

    learnMoreIdiom: {
      type: String,
      default: "",
    },
  },
});

//weekly meeting
const englishClubMeetingSchema = new Schema({
  meetingDate: {
    type: Date,
    default: Date.now(),
  },
  venue: {
    type: String,
    default: "Afro House of Knowledge",
  },
  meetingTime: {
    type: String,
  },
  about: {
    type: String,
    default: "Afro House of Knowledge",
  },
});

// weekly online debate
const weeklyOnlineDebateSchema = new Schema({
  topicOne: {
    type: String,
    default: "No debate yet",
  },

  debateDateOne: {
    type: Date,
    default: Date.now(),
  },

  debateTimeOne: {
    type: String,
  },

  topicTwo: {
    type: String,
    default: "No debate yet",
  },

  debateDateTwo: {
    type: Date,
    default: Date.now(),
  },

  debateTimeTwo: {
    type: String,
  },
  aboutTopic: {
    type: String,
  },
});

// weekly lesson schema
const weeklyLessonSchema = new Schema({
  lessonTitle: {
    type: String,
  },
  // image
  videoLink: {
    type: String,
    trim: true,
  },

  lessonSummary: {
    type: String,
  },

  lessonAuthor: {
    type: String,
  },

  postedAT: {
    type: Date,
    default: format(Date.now(), "MM/dd/yyyy"),
  },
}, {
  timestamps: true,
});

// english club leaders schema
const workersOfMonthSchema = new Schema({
  studentOfMonth: {
    fullname: {
      type: String,
    },
    imageUrl: {
      type: String,
    },

    reasons: {
      type: String,
    },

    about: {
      type: String,
    },
  },

  instructorOfMonth: {
    fullname: {
      type: String,
    },

    imageUrl: {
      type: String,
    },

    reasons: {
      type: String,
    },

    about: {
      type: String,
    },
  },
}, {
  timestamps: true,
});

// media schema
const englishClubMediaSchema = new Schema({
  mediaTitle: {
    type: String,
    trim: true,
  },

  videoLink: {
    type: String,
    trim: true,
  },

  mediaComments: [{
    type: Schema.Types.ObjectId,
    ref: "Comment",
  }, ],
}, {
  timestamps: true,
});

// club members schema

const englishClubMembersSchema = new Schema({
  clubMember: {
    type: Schema.Types.ObjectId,
    ref: "User",
  },

  level: {
    type: String,
    required: true,
    enum: [
      "A0/A1 - Beginner/Elementary",
      "A2 - Pre-Intermediate",
      "B1 - Intermediate",
      "B2 - Upper-Intermediate",
      "C1 - Advanced",
      "C2 - Proficient",
    ],
  },
})

const englishClubHub = mongoose.model("EnglishClubHub", englishClubHubSchema);

const englishClubs = mongoose.model("EnglishClub", englishClubSchema);

const englishClubMedia = mongoose.model(
  "EnglishClubMedia",
  englishClubMediaSchema
);

const englishClubArticles = mongoose.model(
  "EnglishClubArticle",
  englishClubArticleSchema
);

const dailyVocabulary = mongoose.model(
  "DailyVocabulary",
  dailyVocabularySchema
);

const clubMeeting = mongoose.model("ClubMeeting", englishClubMeetingSchema);

const onlineDebate = mongoose.model("OnlineDebate", weeklyOnlineDebateSchema);

const englishWeeklyLessons = mongoose.model(
  "EnglishWeeklyLessons",
  weeklyLessonSchema
);



const englishClubWorkersOfMonth = mongoose.model(
  "EnglishClubWorkersOfMonth",
  workersOfMonthSchema
);

module.exports = {
  englishClubHub,
  englishClubs,
  englishClubArticles,
  dailyVocabulary,
  onlineDebate,
  clubMeeting,
  englishWeeklyLessons,
  englishClubWorkersOfMonth,
  englishClubMedia,
};