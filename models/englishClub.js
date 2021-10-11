const mongoose = require("mongoose");
const Schema = mongoose.Schema;

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
    },

    articleContent: {
      type: String,
      required: true,
    },

    articleAuthor: {
      type: String,
      required: true,
    },

    articleComments: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

const englishClubs = mongoose.model("EnglishClub", englishClubSchema);
const englishClubArticles = mongoose.model("EnglishClubArticle", englishClubArticleSchema);


module.exports = {englishClubs, englishClubArticles};
