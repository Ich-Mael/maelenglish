const { Course } = require("../../../shared/models/courses");
const catchAsync = require("../../../shared/utilities/catchAsync");

module.exports.renderEnglish4All = (req, res) => {
    res.render("programs/language-learning/all_home");
};

module.exports.renderEnglish4Everyone = catchAsync(async (req, res) => {
    const courses = await Course.find({}).populate("instructors");
    res.render("programs/language-learning/english4everyone/home", { courses });
});

module.exports.renderPecp = (req, res) => {
    // res.send("Welcome to PECP (Programme d'Entrainement à la Communication Professionnelle)");
    res.render("programs/language-learning/pecp/home");
};
