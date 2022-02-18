const express = require("express");
const router = express.Router();
const User = require("../models/user");
const Review = require("../models/comments");
const createClubDefaultContent = require("../utilities/createClubDefaultContent");
const catchAsync = require("../utilities/catchAsync");
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

// English clubs
router.post(
  "/englishlang4all/clubs/create",
  isLoggedIn,
  isVerified,
  checkRoles("admin"),
  catchAsync(async (req, res) => {
    const englishClub = new englishClubs(req.body.englishClub);

    const {
      PresidentInfo,
      VicePresidentInfo,
      treasurerInfo,
      secretaryInfo,
      comManagerInfo,
      cultActMInfo,
      flweOfficer,
      mediaManager,
    } = req.body;

    // adding boad members
    const president = await User.findOne({
      username: PresidentInfo,
    });

    englishClub.boardMembers.push(president._id);
    englishClub.members.push(president._id);

    const vicePresident = await User.findOne({
      username: VicePresidentInfo,
    });

    englishClub.boardMembers.push(vicePresident._id);
    englishClub.members.push(vicePresident._id);

    const treasurer = await User.findOne({
      username: treasurerInfo,
    });

    englishClub.boardMembers.push(treasurer._id);
    englishClub.members.push(treasurer._id);

    const secretary = await User.findOne({
      username: secretaryInfo,
    });

    englishClub.boardMembers.push(secretary._id);
    englishClub.members.push(secretary._id);

    const comManager = await User.findOne({
      username: comManagerInfo,
    });

    englishClub.boardMembers.push(comManager._id);
    englishClub.members.push(comManager._id);

    const cultManager = await User.findOne({
      username: cultActMInfo,
    });

    englishClub.boardMembers.push(cultManager._id);
    englishClub.members.push(cultManager._id);

    const FLWEOfficer = await User.findOne({
      username: flweOfficer,
    });

    englishClub.boardMembers.push(FLWEOfficer._id);
    englishClub.members.push(FLWEOfficer._id);

    const MediaManager = await User.findOne({
      username: mediaManager,
    });

    englishClub.boardMembers.push(MediaManager._id);
    englishClub.members.push(MediaManager._id);

    await englishClub.save();

    // Creating default content
    await createClubDefaultContent(englishClub._id);

    await englishClub.save();

    // res.send("english club created!!!");
    res.redirect("/englishlang4all/clubs");
  })
);

//show english club content
router.get(
  "/englishlang4all/Clubs/:club_id",
  isLoggedIn,
  isVerified,
  checkEnglishClubMembership,
  catchAsync(async (req, res) => {
    const club = await englishClubs
      .findById(req.params.club_id)
      .populate("boardMembers")
      .populate("articles")
      .populate("weeklyVideoLesson")
      .populate("workersOfMonth")
      .populate({
        path: "media",
        populate: {
          path: "mediaComments",
          populate: {
            path: "author"
          }
        },
      })
      .populate("dailyVocab")
      .populate("weeklyMeeting")
      .populate("onlineDebates");

    res.render("programs/englishlang4all/englishClubs/show", {
      club,
      positions,
      days,
      months,
    });
  })
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
  catchAsync(async (req, res) => {
    const club_id = req.params.club_id;
    const englishClub = await englishClubs.findById(club_id);
    const article = new englishClubArticles(req.body.englishClubArticle);

    await article.save();

    englishClub.articles.unshift(article);

    await englishClub.save();

    res.redirect(`/englishlang4all/Clubs/${club_id}`);
  })
);

//View all articles
router.get(
  "/englishlang4all/Clubs/:club_id/board_dashboard/articles",
  isLoggedIn,
  isVerified,
  checkEnglishBoardMembership,
  catchAsync(async (req, res) => {
    const club = await englishClubs
      .findById(req.params.club_id)
      .populate("articles");
    res.render("programs/englishlang4all/englishClubs/articles/articlesShow", {
      club,
    });
  })
);

//Edit article

//form
router.get(
  "/english/clubs/:club_id/board_dashboard/articles/:article_id/edit",
  isLoggedIn,
  isVerified,
  checkEnglishBoardMembership,
  catchAsync(async (req, res) => {
    const article = await englishClubArticles.findById(req.params.article_id);
    const club = await englishClubs.findById(req.params.club_id);

    res.render("programs/englishlang4all/englishClubs/articles/articleEdit", {
      article,
      club,
    });
  })
);

//Updating article data
router.put(
  "/englishlang4all/Clubs/:club_id/board_dashboard/articles/:article_id",
  isLoggedIn,
  isVerified,
  checkEnglishBoardMembership,
  catchAsync(async (req, res) => {
    const article = await englishClubArticles.findByIdAndUpdate(
      req.params.article_id, {
        ...req.body.englishClubArticle,
      }
    );

    await article.save();

    res.redirect(`/englishlang4all/Clubs/${req.params.club_id}`);
  })
);

//Deleting an article
router.delete(
  "/englishlang4all/Clubs/:club_id/board_dashboard/articles/:article_id",
  isLoggedIn,
  isVerified,
  checkEnglishBoardMembership,
  catchAsync(async (req, res) => {
    const article = await englishClubArticles.findByIdAndDelete(
      req.params.article_id
    );
    res.redirect(`/englishlang4all/Clubs/${req.params.club_id}`);
  })
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
  catchAsync(async (req, res) => {
    const englishClub = await englishClubs.findById(req.params.club_id);
    const newDailyVocabulary = new dailyVocabulary({
      wordOfDay: {
        ...req.body.wordOfDay,
      },
      IdiomDay: {
        ...req.body.IdiomDay,
      },
    });

    await newDailyVocabulary.save();

    englishClub.dailyVocab.unshift(newDailyVocabulary);

    await englishClub.save();

    res.redirect(`/englishlang4all/Clubs/${req.params.club_id}`);
  })
);

// weekly meeting
router.post(
  "/englishlang4all/Clubs/:club_id/board_dashboard/weeklyMeeting",
  isLoggedIn,
  isVerified,
  checkEnglishBoardMembership,
  catchAsync(async (req, res) => {
    const englishClub = await englishClubs.findById(req.params.club_id);
    const newClubMeeting = new clubMeeting(req.body.englishClubMeeting);

    await newClubMeeting.save();

    englishClub.weeklyMeeting.unshift(newClubMeeting);

    await englishClub.save();

    res.redirect(`/englishlang4all/Clubs/${req.params.club_id}`);
  })
);

// Online debate
router.post(
  "/englishlang4all/Clubs/:club_id/board_dashboard/onlineDebate",
  isLoggedIn,
  isVerified,
  checkEnglishBoardMembership,
  catchAsync(async (req, res) => {
    const englishClub = await englishClubs.findById(req.params.club_id);
    const newOnlineDebate = new onlineDebate(req.body.OnlineDebate);

    await newOnlineDebate.save();

    englishClub.onlineDebates.unshift(newOnlineDebate);

    await englishClub.save();

    res.redirect(`/englishlang4all/Clubs/${req.params.club_id}`);
  })
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
  catchAsync(async (req, res) => {
    const englishClub = await englishClubs.findById(req.params.club_id);

    const newWorkersOfMonth = new englishClubWorkersOfMonth({
      studentOfMonth: {
        ...req.body.studentOfMonth,
      },
      instructorOfMonth: {
        ...req.body.instructorOfMonth,
      },
    });

    await newWorkersOfMonth.save();

    englishClub.workersOfMonth.unshift(newWorkersOfMonth);

    await englishClub.save();

    res.redirect(`/englishlang4all/Clubs/${req.params.club_id}`);
  })
);

//View all vips of the year
router.get(
  "/englishlang4all/Clubs/:club_id/board_dashboard/workersOfMonth",
  isLoggedIn,
  isVerified,
  checkEnglishBoardMembership,
  catchAsync(async (req, res) => {
    const club = await englishClubs
      .findById(req.params.club_id)
      .populate("workersOfMonth");
    res.render("programs/englishlang4all/englishClubs/vips/vipsShow", {
      club,
      days,
      months,
    });
  })
);

//Edit vips of the month

router.get(
  "/english/clubs/:club_id/board_dashboard/leaders/:leader_id/vipsEdit",
  isLoggedIn,
  isVerified,
  checkEnglishBoardMembership,
  catchAsync(async (req, res) => {
    const leader = await englishClubWorkersOfMonth.findById(
      req.params.leader_id
    );
    const club = await englishClubs.findById(req.params.club_id);

    res.render("programs/englishlang4all/englishClubs/vips/vipsEdit", {
      leader,
      club,
    });
  })
);

//Updating leaders of the month
router.put(
  "/englishlang4all/Clubs/:club_id/board_dashboard/leaders/:leader_id",
  isLoggedIn,
  isVerified,
  checkEnglishBoardMembership,
  catchAsync(async (req, res) => {
    const leader = await englishClubWorkersOfMonth.findByIdAndUpdate(
      req.params.leader_id, {
        studentOfMonth: {
          ...req.body.studentOfMonth,
        },
        instructorOfMonth: {
          ...req.body.instructorOfMonth,
        },
      }
    );
    leader.save();

    res.redirect(`/englishlang4all/Clubs/${req.params.club_id}`);
  })
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