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




module.exports.createEnglishClub = async (req, res) => {
    const englishClub = new englishClubs(req.body.englishClub);

    const {
        PresidentInfo,
    } = req.body;

    // adding boad members
    const president = await User.findOne({
        username: PresidentInfo,
    });

    englishClub.boardMembers.push(president._id);
    englishClub.members.push(president._id);

    await englishClub.save();

    // Creating default content
    await createClubDefaultContent(englishClub._id);

    await englishClub.save();

    // res.send("english club created!!!");
    res.redirect("/englishlang4all/clubs");
}



module.exports.showEnglishClub = async (req, res) => {
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
};


//======================================
//              Articles
//======================================

module.exports.createArticle = async (req, res) => {
    const club_id = req.params.club_id;
    const englishClub = await englishClubs.findById(club_id);
    const article = new englishClubArticles(req.body.englishClubArticle);

    await article.save();

    englishClub.articles.unshift(article);

    await englishClub.save();

    res.redirect(`/englishlang4all/Clubs/${club_id}`);
}

module.exports.showAllArticles = async (req, res) => {
    const club = await englishClubs
        .findById(req.params.club_id)
        .populate("articles");
    res.render("programs/englishlang4all/englishClubs/articles/articlesShow", {
        club,
    });
}

module.exports.editArticleForm = async (req, res) => {
    const article = await englishClubArticles.findById(req.params.article_id);
    const club = await englishClubs.findById(req.params.club_id);

    res.render("programs/englishlang4all/englishClubs/articles/articleEdit", {
        article,
        club,
    });
}

module.exports.updateArticle = async (req, res) => {
    const article = await englishClubArticles.findByIdAndUpdate(
        req.params.article_id, {
            ...req.body.englishClubArticle,
        }
    );

    await article.save();

    res.redirect(`/englishlang4all/Clubs/${req.params.club_id}`);
}

module.exports.deleteArticle = async (req, res) => {
    const article = await englishClubArticles.findByIdAndDelete(
        req.params.article_id
    );
    res.redirect(`/englishlang4all/Clubs/${req.params.club_id}`);
}


//======================================
//          Weekly Activity
//======================================

module.exports.createDailyVocabulary = async (req, res) => {
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
}

module.exports.createMeeting = async (req, res) => {
    const englishClub = await englishClubs.findById(req.params.club_id);
    const newClubMeeting = new clubMeeting(req.body.englishClubMeeting);

    await newClubMeeting.save();

    englishClub.weeklyMeeting.unshift(newClubMeeting);

    await englishClub.save();

    res.redirect(`/englishlang4all/Clubs/${req.params.club_id}`);
}

module.exports.createOnlineDebate = async (req, res) => {
    const englishClub = await englishClubs.findById(req.params.club_id);
    const newOnlineDebate = new onlineDebate(req.body.OnlineDebate);

    await newOnlineDebate.save();

    englishClub.onlineDebates.unshift(newOnlineDebate);

    await englishClub.save();

    res.redirect(`/englishlang4all/Clubs/${req.params.club_id}`);
}


//======================================
//          Student of the month
//======================================
module.exports.leaderOM = async (req, res) => {
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
}

module.exports.allLeadersOM = async (req, res) => {
    const club = await englishClubs
        .findById(req.params.club_id)
        .populate("workersOfMonth");
    res.render("programs/englishlang4all/englishClubs/vips/vipsShow", {
        club,
        days,
        months,
    });
}

module.exports.editLeadersOM = async (req, res) => {
    const leader = await englishClubWorkersOfMonth.findById(
        req.params.leader_id
    );
    const club = await englishClubs.findById(req.params.club_id);

    res.render("programs/englishlang4all/englishClubs/vips/vipsEdit", {
        leader,
        club,
    });
}

module.exports.updateLeadersOM = async (req, res) => {
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
}


//======================================
//         Live Practice
//======================================