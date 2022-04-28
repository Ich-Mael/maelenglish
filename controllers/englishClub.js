const express = require("express");
const router = express.Router();
const User = require("../models/user");
const Review = require("../models/comments");
const createClubDefaultContent = require("../utilities/createClubDefaultContent");


const {
    positions,
    days,
    months
} = require("../utilities/defaultData");

const {
    englishClubMember,
    englishClubHub,
    englishClubs,
    englishClubArticles,
    dailyVocabulary,
    clubMeeting,
    onlineDebate,
    englishClubWorkersOfMonth,
    englishWeeklyLessons,
    englishClubMedia,
} = require("../models/englishClub");



function addEngClub(club) {

    if (club.clubType === "High-school") {
        hub.clubs.High_school.push(club._id);
    }

    if (club.clubType === "University") {
        hub.clubs.University.push(club._id);
    }

    if (club.clubType === "Company") {
        hub.clubs.Company.push(club._id);
    }

    if (club.clubType === "Private") {
        hub.clubs.Private.push(club._id);
    }

    if (club.clubType === "Professional") {
        hub.clubs.Professional.push(club._id);
    }

    if (club.clubType === "Simple") {
        hub.clubs.Simple.push(club._id);
    }

}


async function addBoardMember(boardUsername, clubname, position) {
    boardUsername = req.body;
    const englishClub = englishClubs.findOne({
        name: clubname
    });

    // adding boad members
    const boardmember = await User.findOne({
        username: boardUsername,
    });

    englishClub.boardMembers.push(boardmember._id);
    englishClub.members.push(boardmember._id);

    await englishClub.save();

}



// English club hub
module.exports.createEnglishHub = async (req, res) => {
    const newEngClubHub = new englishClubHub(req.body.engHub);
    const focalpoint = await User.findOne({
        username: req.body.focalPoint
    });
    newEngClubHub.focalPoint = focalpoint._id;

    await newEngClubHub.save();

    res.send("new hub created");
}

module.exports.showCountryHubs = async (req, res) => {
    const hubCountry = req.params.country;

    function filterByCountry(obj) {
        if (obj.country === hubCountry) {
            return true
        }
    }
    const hubs = await englishClubHub.find({}).populate("focalPoint").populate("clubs.University").populate("clubs.High_school").populate("clubs.Company").populate("clubs.Professional").populate("clubs.Private").populate("clubs.Simple");

    let countryHubs = await hubs.filter(filterByCountry);

    res.render("programs/englishlang4all/englishClubs/showClubHub", {
        countryHubs,
        hubCountry
    });
}

// English club

module.exports.createEnglishClub = async (req, res) => {
    const englishClub = new englishClubs(req.body.englishClub);

    hub = await englishClubHub.findById(req.params.hub_id);
    // adding boad members
    const president = await User.findOne({
        username: req.body.PresidentInfo,
    });

    // create a new english club member
    const newEngClubMember = new englishClubMember({
        clubMember: president._id,
        position: "Chair Person",
        level: "B1 - Intermediate",
        isBoardMember: true
    });

    await newEngClubMember.save();


    englishClub.boardMembers.push(newEngClubMember._id);
    englishClub.members.push(newEngClubMember._id);

    await englishClub.save();

    // adding the English club to the hub
    addEngClub(englishClub);

    await hub.save();

    // Creating default content
    await createClubDefaultContent(englishClub._id);

    await englishClub.save();

    // res.send("english club created!!!");
    res.redirect(`/englishlang4all/clubs/${hub.country}/hubs`);
}

module.exports.showClubHomePage = async (req, res) => {
    const hub = await englishClubHub.findById(req.params.hub_id);
    const club = await englishClubs
        .findById(req.params.club_id)
        .populate({
            path: "boardMembers",
            populate: {
                path: "clubMember"
            }
        })

    console.log(club);

    res.render("programs/englishlang4all/englishClubs/clubInfoPage", {
        hub,
        club,
        positions,
        days,
        months,
    });
}

module.exports.showEnglishClub = async (req, res) => {
    const hub = await englishClubHub.findById(req.params.hub_id);
    const club = await englishClubs
        .findById(req.params.club_id)
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
        hub,
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