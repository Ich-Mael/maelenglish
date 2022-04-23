const express = require("express");
const router = express.Router();
const User = require("../models/user");
const Review = require("../models/comments");
const createClubDefaultContent = require("../utilities/createClubDefaultContent");
const engClub = require("../controllers/englishClub");
const catchAsync = require("../utilities/catchAsync");

const {
  isLoggedIn,
  isVerified,
  checkRoles,
} = require("../middlewares/userController");

const {
  checkEnglishClubMembership,
  checkEnglishBoardMembership,
  checkProgramOwnership,
} = require("../middlewares/courseController");
const {
  positions,
  days,
  months
} = require("../utilities/defaultData");

const {
  englishClubs,
  englishClubArticles,
  dailyVocabulary,
  clubMeeting,
  onlineDebate,
  englishClubWorkersOfMonth,
  englishWeeklyLessons,
  englishClubMedia,
} = require("../models/englishClub");


//english for everybody
router.get("/englishlang4all", (req, res) => {
  res.render("programs/englishlang4all/home");
});

router.get("/englishlang4all/free_english_lessons", (req, res) => {
  res.render("programs/englishlang4all/free_lesson");
});

/* =================================================
 *
 * Route for English Clubs
 *
 * ================================================ */

//English clubs
router.get("/englishlang4all/clubs", async (req, res) => {
  const clubs = await englishClubs.find({});
  res.render("programs/englishlang4all/englishClubs/home", {
    clubs,
  });
});

// Form for a new english club
router.get(
  "/englishlang4all/clubs/new",
  isLoggedIn,
  isVerified,
  checkRoles("admin"),
  (req, res) => {
    res.render("programs/englishlang4all/englishClubs/new");
  }
);

// English create an Englis club
router.post(
  "/englishlang4all/clubs/create",
  isLoggedIn,
  isVerified,
  checkRoles("admin"),
  catchAsync(engClub.createEnglishClub)
);

//show english club content
router.get(
  "/englishlang4all/Clubs/:club_id",
  isLoggedIn,
  isVerified,
  checkEnglishClubMembership,
  catchAsync(engClub.showEnglishClub)
);

// ==============================
//
//   Board members privileges
//
//===============================

// Adding a member to an English Club

//======================================
//
//              Articles
//
//======================================

router.post(
  "/englishlang4all/Clubs/:club_id/board_dashboard/article",
  isLoggedIn,
  isVerified,
  checkEnglishBoardMembership,
  catchAsync(engClub.createArticle)
);

//View all articles
router.get(
  "/englishlang4all/Clubs/:club_id/board_dashboard/articles",
  isLoggedIn,
  isVerified,
  checkEnglishBoardMembership,
  catchAsync(engClub.showAllArticles)
);

//Edit article

//form
router.get(
  "/english/clubs/:club_id/board_dashboard/articles/:article_id/edit",
  isLoggedIn,
  isVerified,
  checkEnglishBoardMembership,
  catchAsync(engClub.editArticleForm)
);

//Updating article data
router.put(
  "/englishlang4all/Clubs/:club_id/board_dashboard/articles/:article_id",
  isLoggedIn,
  isVerified,
  checkEnglishBoardMembership,
  catchAsync(engClub.updateArticle)
);

//Deleting an article
router.delete(
  "/englishlang4all/Clubs/:club_id/board_dashboard/articles/:article_id",
  isLoggedIn,
  isVerified,
  checkEnglishBoardMembership,
  catchAsync(engClub.deleteArticle)
);

// **************************** Weekly activities *****************************************

//=========================================================================================
//
//                                     Weekly activity
//
//=========================================================================================

// Word and idiom of the day

router.post(
  "/englishlang4all/Clubs/:club_id/board_dashboard/dailyVocab",
  isLoggedIn,
  isVerified,
  checkEnglishBoardMembership,
  catchAsync(engClub.createDailyVocabulary)
);

// weekly meeting
router.post(
  "/englishlang4all/Clubs/:club_id/board_dashboard/weeklyMeeting",
  isLoggedIn,
  isVerified,
  checkEnglishBoardMembership,
  catchAsync(engClub.createMeeting)
);

// Online debate
router.post(
  "/englishlang4all/Clubs/:club_id/board_dashboard/onlineDebate",
  isLoggedIn,
  isVerified,
  checkEnglishBoardMembership,
  catchAsync(engClub.createOnlineDebate)
);

//==============================================================
//
//                        Weekly lessons
//
//==============================================================

router.post(
  "/englishlang4all/Clubs/:club_id/board_dashboard/videoLesson",
  isLoggedIn,
  isVerified,
  checkEnglishBoardMembership,
  catchAsync(async (req, res) => {
    const englishClub = await englishClubs.findById(req.params.club_id);

    const newVideoLesson = new englishWeeklyLessons(req.body.weeklyLesson);
    await newVideoLesson.save();

    englishClub.weeklyVideoLesson.unshift(newVideoLesson);

    await englishClub.save();

    res.redirect(`/englishlang4all/Clubs/${req.params.club_id}`);
  })
);

//View all lessons
router.get(
  "/englishlang4all/Clubs/:club_id/board_dashboard/videoLessons",
  isLoggedIn,
  isVerified,
  checkRoles("admin"),
  catchAsync(async (req, res) => {
    const club = await englishClubs
      .findById(req.params.club_id)
      .populate("weeklyVideoLesson");
    res.render(
      "programs/englishlang4all/englishClubs/videoLessons/videoLessonsShow", {
        club,
      }
    );
  })
);

//edit video lesson form

router.get(
  "/english/clubs/:club_id/board_dashboard/weeklyVideoLessons/:videoLesson_id/edit",
  isLoggedIn,
  isVerified,
  checkRoles("admin"),
  catchAsync(async (req, res) => {
    const videoLesson = await englishWeeklyLessons.findById(
      req.params.videoLesson_id
    );
    const club = await englishClubs.findById(req.params.club_id);

    res.render(
      "programs/englishlang4all/englishClubs/videoLessons/weeklyLessonEdit", {
        videoLesson,
        club,
      }
    );
  })
);

//Updating video lesson data
router.put(
  "/englishlang4all/Clubs/:club_id/board_dashboard/weeklyVideoLessons/:videoLesson_id",
  isLoggedIn,
  isVerified,
  checkRoles("admin"),
  checkEnglishBoardMembership,
  catchAsync(async (req, res) => {
    const videoLesson = await englishWeeklyLessons.findByIdAndUpdate(
      req.params.videoLesson_id, {
        ...req.body.weeklyLesson,
      }
    );

    await videoLesson.save();

    res.redirect(`/englishlang4all/Clubs/${req.params.club_id}`);
  })
);

//=====================================
//
//             Workers of the Months
//
//=====================================

router.post(
  "/englishlang4all/Clubs/:club_id/board_dashboard/workerOfMonth",
  isLoggedIn,
  isVerified,
  checkEnglishBoardMembership,
  catchAsync(engClub.leaderOM)
);

//View all vips of the year
router.get(
  "/englishlang4all/Clubs/:club_id/board_dashboard/workersOfMonth",
  isLoggedIn,
  isVerified,
  checkEnglishBoardMembership,
  catchAsync(engClub.allLeadersOM)
);

//Edit vips of the month

router.get(
  "/english/clubs/:club_id/board_dashboard/leaders/:leader_id/vipsEdit",
  isLoggedIn,
  isVerified,
  checkEnglishBoardMembership,
  catchAsync(engClub.editLeadersOM)
);

//Updating leaders of the month
router.put(
  "/englishlang4all/Clubs/:club_id/board_dashboard/leaders/:leader_id",
  isLoggedIn,
  isVerified,
  checkEnglishBoardMembership,
  catchAsync(engClub.updateLeadersOM)
);

//===========================================================
//
//             media of the english club
//
//===========================================================

router.post(
  "/englishlang4all/Clubs/:club_id/board_dashboard/clubMedia",
  isLoggedIn,
  isVerified,
  checkEnglishBoardMembership,
  catchAsync(async (req, res) => {
    const englishClub = await englishClubs.findById(req.params.club_id);

    const newMedia = new englishClubMedia(req.body);

    await newMedia.save();

    englishClub.media.unshift(newMedia);

    await englishClub.save();

    res.redirect(`/englishlang4all/Clubs/${req.params.club_id}`);
  })
);

//View all media of the year
router.get(
  "/englishlang4all/Clubs/:club_id/board_dashboard/allClubMedia",
  isLoggedIn,
  isVerified,
  checkEnglishBoardMembership,
  catchAsync(async (req, res) => {
    const club = await englishClubs
      .findById(req.params.club_id)
      .populate("media");
    res.render("programs/englishlang4all/englishClubs/clubMedia/mediaShow", {
      club,
      days,
      months,
    });
  })
);

//Edit vidoes of the months
router.get(
  "/englishlang4all/clubs/:club_id/board_dashboard/clubMedia/:media_id/mediaEdit",
  isLoggedIn,
  isVerified,
  checkEnglishBoardMembership,
  catchAsync(async (req, res) => {
    const media = await englishClubMedia.findById(req.params.media_id);
    const club = await englishClubs.findById(req.params.club_id);

    res.render("programs/englishlang4all/englishClubs/clubMedia/mediaEdit", {
      media,
      club,
    });
  })
);

//Updating videos
router.put(
  "/englishlang4all/Clubs/:club_id/board_dashboard/clubMedia/:media_id",
  isLoggedIn,
  isVerified,
  checkEnglishBoardMembership,
  catchAsync(async (req, res) => {
    const media = await englishClubMedia.findByIdAndUpdate(
      req.params.media_id,
      req.body
    );
    media.save();

    res.redirect(`/englishlang4all/Clubs/${req.params.club_id}`);
  })
);


/* =================================================
 *
 *               Song Challenges
 *
 * ================================================ */
router.get(
  "/englishlang4all/lsc/song-1",
  catchAsync(async (req, res) => {
    res.render(
      "programs/englishlang4all/lsc/song-1"
    );
  })
);

router.get(
  "/englishlang4all/lsc/song123hg34ukk",
  catchAsync(async (req, res) => {
    res.render(
      "programs/englishlang4all/lsc/song-2"
    );
  })
);




/* =================================================
 *
 *                Global Challenges
 *
 * ================================================ */
router.get(
  "/englishlang4all/Clubs/:club_id/grammar",
  isLoggedIn,
  isVerified,
  checkEnglishClubMembership,
  catchAsync(async (req, res) => {
    const club = await englishClubs.findById(req.params.club_id);

    res.render(
      "programs/englishlang4all/englishClubs/clubQuiz/grammarQuiz.ejs", {
        club
      }
    );
  })
);

/* =================================================
 *
 * Route for General English
 *
 * ================================================ */

//english for Everyone beginner
router.get(
  "/englishlang4all/general_english_beginner",
  isLoggedIn,
  isVerified,
  checkProgramOwnership("beginner_Eng"),
  (req, res) => {
    res.render("programs/englishlang4all/general_english_beginner");
  }
);

//english for everyone intermediate
router.get(
  "/englishlang4all/general_english_intermediate",
  isLoggedIn,
  checkProgramOwnership("beginner_eng"),
  (req, res) => {
    res.render("programs/englishlang4all/general_english_beginner");
  }
);

//english for everyone advance
router.get(
  "/englishlang4all/general_english_advance",
  isLoggedIn,
  checkProgramOwnership("beginner_eng"),
  (req, res) => {
    res.render("programs/englishlang4all/general_english_advance");
  }
);

/* =================================================
 *
 * Route for Professional English
 *
 * ================================================ */

//english for adults
router.get("/englishlang4all/adults", isLoggedIn, (req, res) => {
  res.render("programs/englishlang4all/adults");
});

/* =================================================
 *
 * Route for Kid's English
 *
 * ================================================ */

//english for kids
router.get("/englishlang4all/kids", isLoggedIn, (req, res) => {
  res.render("programs/englishlang4all/kids");
});

module.exports = router;