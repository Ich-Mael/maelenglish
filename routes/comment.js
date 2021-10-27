const express = require("express");
const catchAsync = require("../utilities/catchAsync");
const { isLoggedIn, checkRoles, isVerified } = require("../middlewares/userController");
const router = express.Router();
const User = require("../models/user");
const {
  englishClubs,
  englishClubArticles,
  englishWeeklyActivities,
  englishClubWorkersOfMonth,
  englishWeeklyLessons,
  englishClubMedia,
} = require("../models/englishClub");
const Review = require("../models/comments");
const {
  checkEnglishClubMembership,
  checkEnglishBoardMembership,
  checkProgramOwnership,
} = require("../middlewares/courseController");

// Post english comment route
router.post(
  "/englishlang4all/clubs/:club_id/clubMedia/:media_id/comment",
  isLoggedIn, isVerified,
  checkEnglishClubMembership,
  catchAsync(async (req, res) => {
    const media = await englishClubMedia.findById(req.params.media_id);

    const newReview = new Review(req.body.review);
    newReview.author = req.user._id;
    await newReview.save();

    media.mediaComments.push(newReview);

    await media.save();

    req.flash("success", `Comment successfully posted`);
    res.redirect(`/englishlang4all/Clubs/${req.params.club_id}`);
  })
);

module.exports = router;