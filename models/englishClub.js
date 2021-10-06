const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const englishClubSchema = new Schema({
    instituition: {
        type: String,
        required: true,
    },

    acronym: {
        type: String,
        required: true,
    },

    name: {
        type: String,
        required: true,
    },

    motto: {
        type: String,
        required: true,
    },

    description: {
        type: String,
        required: true,
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

    // social media links
    facebookLink: {
        type: String,
    },

    twitterLink: {
        type: String,
    },

    instagramLink: {
        type: String,
    },

    youtubeLink: {
        type: String,
    },


    members: [{
        type: Schema.Types.ObjectId,
        ref: "User",
    }],
}, {
    timestamps: true,
});

module.exports = mongoose.model("EnglishClub", englishClubSchema);