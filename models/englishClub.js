const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const { format, formatDistance, formatRelative, subDays } = require("date-fns");

// english club schema
const englishClubSchema = new Schema(
  {
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
      required: true,
    },

    motto: {
      type: String,
      trim: true,
      required: true,
    },

    description: {
      type: String,
      required: true,
      trim: true,
    },

    foundDate: {
      type: String,
      required: true,
    },

    // image
    bannerImageUrlMedium: {
      type: String,
    },

    bannerImageUrlSmall: {
      type: String,
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

    boardMembers: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    members: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    studentOfMonth: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    InstructorOfMonth: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    articles: [
      {
        type: Schema.Types.ObjectId,
        ref: "EnglishClubArticle",
      },
    ],

    weeklyActivity: [
      {
        type: Schema.Types.ObjectId,
        ref: "EnglishWeeklyActivity",
      },
    ],
  },
  {
    timestamps: true,
  }
);

// english club article schema
const englishClubArticleSchema = new Schema(
  {
    title: {
      type: String,
      required: true,
    },
    // image
    articleImage: {
      type: String,
      required: true,
    },

    articleSummary: {
      type: String,
      required: true,
    },

    articleContent: {
      type: String,
      required: true,
    },

    articleAuthor: {
      type: String,
      required: true,
    },

    postedAT: {
      type: Date,
      default: format(Date.now(), "MM/dd/yyyy"),
    },

    articleComments: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

//Daily vocabulary schema
const weeklyActivitySchema = new Schema({
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
    examples: [String],
  },

  IdiomDay: {
    idiom: {
      type: String,
      default: "Afro House of Knowledge",
    },

    idiomMeaning: {
      type: String,
      default: "",
    },

    learnMoreIdiom: {
      type: String,
      default: "Afro House of Knowledge",
    },

    examples: [String],
  },

  englishClubMeeting: {
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
  },

  OnlineDebate: {
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
      type: String 
    },
  },
});

const englishClubs = mongoose.model("EnglishClub", englishClubSchema);
const englishClubArticles = mongoose.model(
  "EnglishClubArticle",
  englishClubArticleSchema
);
const englishWeeklyActivities = mongoose.model(
  "EnglishWeeklyActivity",
  weeklyActivitySchema
);

module.exports = { englishClubs, englishClubArticles, englishWeeklyActivities };
