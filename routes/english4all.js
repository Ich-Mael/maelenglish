const express = require("express");
const router = express.Router();
const User = require("../models/user");
const createClubDefaultContent = require("../utilities/createClubDefaultContent");
const catchAsync = require("../utilities/catchAsync");
const {
  positions,
  days,
  months,
  defaultWeeklyActivityData,
  defaultArticleData,
  weeklyLessonsData,
  workersOfMonthData,
} = require("../utilities/defaultData");

const {
  englishClubs,
  englishClubArticles,
  englishWeeklyActivities,
  englishClubWorkersOfMonth,
  englishWeeklyLessons,
  englishClubMedia,
  englishClubComment,
} = require("../models/englishClub");
const { isLoggedIn, checkRoles } = require("../middlewares/userController");
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

//english clubs
router.get("/englishlang4all/clubs", isLoggedIn, async (req, res) => {
  const clubs = await englishClubs.find({});
  res.render("programs/englishlang4all/englishClubs/home", {
    clubs,
  });
});

// Form for a new english club
router.get(
  "/englishlang4all/clubs/new",
  isLoggedIn,
  checkRoles("admin"),
  (req, res) => {
    res.render("programs/englishlang4all/englishClubs/new");
  }
);

//english clubs
router.post(
  "/englishlang4all/clubs/create",
  isLoggedIn,
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
  checkEnglishClubMembership,
  catchAsync(async (req, res) => {
    const club = await englishClubs
      .findById(req.params.club_id)
      .populate("boardMembers")
      .populate("articles")
      .populate("weeklyVideoLesson")
      .populate("workersOfMonth")
      .populate("media")
      .populate("weeklyActivity");

    res.render("programs/englishlang4all/englishClubs/show", {
      club,
      positions,
      days,
      months,
    });
  })
);

// =============================
//
//   Board members privileges
//
//===============================

// Adding a member to an English Club

//=====================================
//
//              Articles
//
//=====================================

router.post(
  "/englishlang4all/Clubs/:club_id/board_dashboard/article",
  isLoggedIn,
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
  checkEnglishBoardMembership,
  catchAsync(async (req, res) => {
    const articles = await englishClubArticles.find({});
    const club = await englishClubs.findById(req.params.club_id);

    res.render("programs/englishlang4all/englishClubs/articles/articlesShow", {
      articles,
      club,
    });
  })
);

//Edit article

//form
router.get(
  "/english/clubs/:club_id/board_dashboard/articles/:article_id/edit",
  isLoggedIn,
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
  checkEnglishBoardMembership,
  catchAsync(async (req, res) => {
    const article = await englishClubArticles.findByIdAndUpdate(
      req.params.article_id,
      {
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
  checkEnglishBoardMembership,
  catchAsync(async (req, res) => {
    const article = await englishClubArticles.findByIdAndDelete(
      req.params.article_id
    );
    res.redirect(`/englishlang4all/Clubs/${req.params.club_id}`);
  })
);

// **************************** Weekly activities *****************************************

//=====================================
//
//             Weekly activity
//
//=====================================

router.post(
  "/englishlang4all/Clubs/:club_id/board_dashboard/weeklyactivity",
  isLoggedIn,
  checkEnglishBoardMembership,
  catchAsync(async (req, res) => {
    const englishClub = await englishClubs.findById(req.params.club_id);
    const newWeeklyActivity = new englishWeeklyActivities({
      wordOfDay: {
        ...req.body.wordOfDay,
      },
      IdiomDay: {
        ...req.body.IdiomDay,
      },
      englishClubMeeting: {
        ...req.body.englishClubMeeting,
      },
      OnlineDebate: {
        ...req.body.OnlineDebate,
      },
    });

    await newWeeklyActivity.save();

    englishClub.weeklyActivity.unshift(newWeeklyActivity);

    await englishClub.save();

    res.redirect(`/englishlang4all/Clubs/${req.params.club_id}`);
  })
);

//View all weekly activity
router.get(
  "/englishlang4all/Clubs/:club_id/board_dashboard/weeklyActivities",
  isLoggedIn,
  checkEnglishBoardMembership,
  catchAsync(async (req, res) => {
    const weeklyActivities = await englishWeeklyActivities.find({});
    const club = await englishClubs.findById(req.params.club_id);

    // console.log(weeklyActivities);
    res.render(
      "programs/englishlang4all/englishClubs/activities/weeklyActivitiesShow",
      {
        weeklyActivities,
        club,
        days,
        months,
      }
    );
  })
);

// Form
router.get(
  "/english/clubs/:club_id/board_dashboard/weeklyActivities/:weeklyActivity_id/edit",
  isLoggedIn,
  checkEnglishBoardMembership,
  catchAsync(async (req, res) => {
    const weeklyActivity = await englishWeeklyActivities.findById(
      req.params.weeklyActivity_id
    );
    const club = await englishClubs.findById(req.params.club_id);

    res.render(
      "programs/englishlang4all/englishClubs/activities/weeklyActivityEdit",
      {
        weeklyActivity,
        club,
      }
    );
  })
);

//Updating weekly activity data
router.put(
  "/englishlang4all/Clubs/:club_id/board_dashboard/weeklyActivities/:weeklyActivity_id",
  isLoggedIn,
  checkEnglishBoardMembership,
  catchAsync(async (req, res) => {
    const weeklActivity = await englishWeeklyActivities.findByIdAndUpdate(
      req.params.weeklyActivity_id,
      {
        wordOfDay: {
          ...req.body.wordOfDay,
        },
        IdiomDay: {
          ...req.body.IdiomDay,
        },
        englishClubMeeting: {
          ...req.body.englishClubMeeting,
        },
        OnlineDebate: {
          ...req.body.OnlineDebate,
        },
      }
    );
    weeklActivity.save();

    res.redirect(`/englishlang4all/Clubs/${req.params.club_id}`);
  })
);

//=====================================
//
//             Weekly lessons
//
//=====================================

router.post(
  "/englishlang4all/Clubs/:club_id/board_dashboard/videoLesson",
  isLoggedIn,
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
  checkEnglishBoardMembership,
  catchAsync(async (req, res) => {
    const videoLessons = await englishWeeklyLessons.find({});
    const club = await englishClubs.findById(req.params.club_id);

    res.render(
      "programs/englishlang4all/englishClubs/videoLessons/videoLessonsShow",
      {
        videoLessons,
        club,
      }
    );
  })
);

//edit video lesson form

router.get(
  "/english/clubs/:club_id/board_dashboard/weeklyVideoLessons/:videoLesson_id/edit",
  isLoggedIn,
  checkEnglishBoardMembership,
  catchAsync(async (req, res) => {
    const videoLesson = await englishWeeklyLessons.findById(
      req.params.videoLesson_id
    );
    const club = await englishClubs.findById(req.params.club_id);

    res.render(
      "programs/englishlang4all/englishClubs/videoLessons/weeklyLessonEdit",
      {
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
  checkEnglishBoardMembership,
  catchAsync(async (req, res) => {
    const videoLesson = await englishWeeklyLessons.findByIdAndUpdate(
      req.params.videoLesson_id,
      {
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
  checkEnglishBoardMembership,
  catchAsync(async (req, res) => {
    const leaders = await englishClubWorkersOfMonth.find({});
    const club = await englishClubs.findById(req.params.club_id);

    console.log(leaders);
    res.render("programs/englishlang4all/englishClubs/vips/vipsShow", {
      leaders,
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
  checkEnglishBoardMembership,
  catchAsync(async (req, res) => {
    const leader = await englishClubWorkersOfMonth.findByIdAndUpdate(
      req.params.leader_id,
      {
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
  checkEnglishBoardMembership,
  catchAsync(async (req, res) => {
    const medias = await englishClubMedia.find({});
    const club = await englishClubs.findById(req.params.club_id);

    res.render("programs/englishlang4all/englishClubs/clubMedia/mediaShow", {
      medias,
      club,
      days,
      months,
    });
  })
);

//Edit all vips of the month
router.get(
  "/englishlang4all/clubs/:club_id/board_dashboard/clubMedia/:media_id/mediaEdit",
  isLoggedIn,
  checkEnglishBoardMembership,
  catchAsync(async (req, res) => {
    const media = await englishClubMedia.findById(
      req.params.media_id
    );
    const club = await englishClubs.findById(req.params.club_id);

    res.render("programs/englishlang4all/englishClubs/clubMedia/mediaEdit", {
      media,
      club,
    });
  })
);

//Updating leaders of the month
router.put(
  "/englishlang4all/Clubs/:club_id/board_dashboard/clubMedia/:media_id",
  isLoggedIn,
  checkEnglishBoardMembership,
  catchAsync(async (req, res) => {
    const media = await englishClubMedia.findByIdAndUpdate(req.params.media_id, req.body);
    media.save();

res.redirect(`/englishlang4all/Clubs/${req.params.club_id}`);
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
