const User = require("../models/user");
const catchAsync = require("../utilities/catchAsync");

const {
    Class,
    Chapter,
    Subject,
    HStudent,
    HTeacher,
    HSCourseVideo,
} = require("../models/100bac");

module.exports.facebookPageLike = catchAsync(async (req, res, next) => {
    const subject = await Subject.findById(req.params.subject_id);

    if ((req.user.isHighSchoolStudent && req.user.likedPage && Subject.students.includes(req.user._id)) || req.user.role === "admin") {
        next();
    } else {
        res.render("social_media");
    }
});


module.exports.chapterPremiumAccess = catchAsync(async (req, res, next) => {
    const subject = await Subject.findById(req.params.subject_id);
    const chapter = await Chapter.findById(req.params.chapter_id);

    if ((chapter.premiumStudents.includes(req.user.highSchool_id)) || req.user.role === "admin") {
        next();
    } else {
        res.render("noAccess");
    }
});