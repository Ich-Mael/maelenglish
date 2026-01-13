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
    if ((req.user.likedPage) || req.user.role === "admin") {
        next();
    } else {
        res.render("social_media")
    }
});

// Checking student status
module.exports.checkStudentStatus = catchAsync(async (req, res, next) => {
if(req.user.isHighSchoolStudent || req.user.role === "admin"){
    next();
}else{
    res.render("notStudent");
}
});

// checking if student belongs to a class
module.exports.classCheck = catchAsync(async (req, res, next) => {

    const schoolClass = await Class.findById(req.params.class_id);

    if ((schoolClass.students.includes(req.user.highSchool_id))) {
        next();
    } else {
        res.render("noAccess");
    }
});

// checking if student belongs to a class
module.exports.chapterPremiumAccess = catchAsync(async (req, res, next) => {
    const chapter = await Chapter.findById(req.params.chapter_id);

    if ((chapter.premiumStudents.includes(req.user.highSchool_id)) || req.user.role === "admin") {
        next();
    } else {
        res.render("noAccess");
    }
});