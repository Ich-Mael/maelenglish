const User = require("../models/user");

const {
    Course,
    Module,
    Evaluation,
    Grade
} = require("../models/courses");

const {
    englishClubs
} = require("../models/englishClub");

const catchAsync = require("../utilities/catchAsync");

module.exports.checkEnglishClubMembership = catchAsync(async (req, res, next) => {
    const {
        club_id
    } = req.params;
    const englishClub = await englishClubs.findById(club_id);
    if (englishClub.members.includes(req.user._id) || req.user.role == "admin" || req.user.role == "english-club-admin") {
        next();
    } else {
        req.flash("error", "Vous n’êtes pas membre de ce club d’Anglais");
        res.redirect(`/englishlang4all/Clubs`);
    }
});

module.exports.checkEnglishBoardMembership = catchAsync(async (req, res, next) => {
    const {
        club_id
    } = req.params;
    const englishClub = await englishClubs.findById(club_id);
    if (
        englishClub.boardMembers.indexOf(req.user._id) > -1 ||
        req.user.role == "admin" || req.user.role == "english-club-admin"
    ) {
        next();
    } else {
        req.flash("error", "You are not a board member.");
        res.redirect(`/englishlang4all/Clubs`);
    }
});