const express = require("express");
const router = express.Router();
const User = require("../models/user");
const catchAsync = require("../utilities/catchAsync");
const {
  positions,
  days,
  months,
  defaultWeeklyActivityData,
  defaultArticleData,
} = require("../utilities/defaultData");

const {
  englishClubs,
  englishClubArticles,
  englishWeeklyActivities,
} = require("../models/englishClub");
const { isLoggedIn, checkRoles } = require("../middlewares/userController");
const {
  checkCourseOwnership,
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
  "/englishlang4all/clubs",
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

    const president = await User.findOne({
      username: PresidentInfo,
    });
    englishClub.boardMembers.push(president);

    const vicePresident = await User.findOne({
      username: VicePresidentInfo,
    });
    englishClub.boardMembers.push(vicePresident);

    const treasurer = await User.findOne({
      username: treasurerInfo,
    });
    englishClub.boardMembers.push(treasurer);

    const secretary = await User.findOne({
      username: secretaryInfo,
    });
    englishClub.boardMembers.push(secretary);

    const comManager = await User.findOne({
      username: comManagerInfo,
    });
    englishClub.boardMembers.push(comManager);

    const cultManager = await User.findOne({
      username: cultActMInfo,
    });
    englishClub.boardMembers.push(cultManager);

    await englishClub.save();

    res.redirect("/englishlang4all/clubs");
  })
);

//show english club content
router.get(
  "/englishlang4all/Clubs/:club_id",
  isLoggedIn,
  catchAsync(async (req, res) => {
    const club = await englishClubs
      .findById(req.params.club_id)
      .populate("boardMembers")
      .populate("articles")
      .populate("weeklyActivity");

    res.render("programs/englishlang4all/englishClubs/show", {
      club,
      positions,
      days,
      months,
    });
  })
);

//=====================================
//
//              Articles
//
//=====================================

router.post(
  "/englishlang4all/Clubs/:club_id/board_dashboard/article",
  isLoggedIn,
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

//=====================================
//
//             Weekly activity
//
//=====================================

router.post(
  "/englishlang4all/Clubs/:club_id/board_dashboard/weeklyactivity",
  isLoggedIn,
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

// =============================
//
//   Board members privileges
//
//===============================

// **************************** ARTICLES *****************************************

//View all articles
router.get(
  "/englishlang4all/Clubs/:club_id/board_dashboard/articles",
  isLoggedIn,
  catchAsync(async (req, res) => {
    const articles = await englishClubArticles.find({});
    const club = await englishClubs.findById(req.params.club_id);

    res.render("programs/englishlang4all/englishClubs/articlesShow", {
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
  catchAsync(async (req, res) => {
    const article = await englishClubArticles.findById(req.params.article_id);
    const club = await englishClubs.findById(req.params.club_id);

    res.render("programs/englishlang4all/englishClubs/articleEdit", {
      article,
      club,
    });
  })
);

//Updating article data
router.put(
  "/englishlang4all/Clubs/:club_id/board_dashboard/articles/:article_id",
  isLoggedIn,
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
  catchAsync(async (req, res) => {
    const article = await englishClubArticles.findByIdAndDelete(
      req.params.article_id
    );
    res.redirect(`/englishlang4all/Clubs/${req.params.club_id}`);
  })
);

// **************************** Weekly activities *****************************************

//View all weekly activity
router.get(
  "/englishlang4all/Clubs/:club_id/board_dashboard/weeklyActivities",
  isLoggedIn,
  catchAsync(async (req, res) => {
    const weeklyActivities = await englishWeeklyActivities.find({});
    const club = await englishClubs.findById(req.params.club_id);

    // console.log(weeklyActivities);
    res.render("programs/englishlang4all/englishClubs/weeklyActivitiesShow", {
      weeklyActivities,
      club,
      days,
      months,
    });
  })
);

//Edit weekly activity

// Form
router.get(
  "/english/clubs/:club_id/board_dashboard/weeklActivities/:weeklyActivity_id/edit",
  isLoggedIn,
  catchAsync(async (req, res) => {
    const weeklyActivity = await englishWeeklyActivities.findById(
      req.params.weeklyActivity_id
    );
    const club = await englishClubs.findById(req.params.club_id);

    res.render("programs/englishlang4all/englishClubs/weeklyActivityEdit", {
      weeklyActivity,
      club,
    });
  })
);

//Updating weekly activity data
router.put(
  "/englishlang4all/Clubs/:club_id/board_dashboard/weeklyActivities/:weeklyActivity_id",
  isLoggedIn,
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
