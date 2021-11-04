const { Course, Module, Evaluation, Grade } = require("../models/courses");
const User = require("../models/user");
const DateUtil = require("../utilities/date");

module.exports.createModule = async (req, res) => {
  const course = await Course.findById(req.params.course_id);
  const {
    title,
    willLearnModule,
    explanationText,
    moreDetails,
    videos,
    revealDate,
  } = req.body.module;

  const videoLinks = videos.split(",");

  const newModule = new Module({
    title,
    willLearnModule,
    explanationText,
    moreDetails,
    revealDate,
    videoLinks,
  });

  // saving Course New Module
  await newModule.save();

  // pushing new module in course and saving
  course.modules.push(newModule._id);

  await course.save();

  res.redirect(`/courses/${course._id}`);
};

module.exports.showModule = async (req, res) => {
  const courseModule = await Module.findById(req.params.module_id);
  const course = await Course.findById(req.params.course_id).populate(
    "modules"
  );

  let moduleReveal = DateUtil.revealTime(courseModule.revealDate);
  displayRevealDate = DateUtil.localTime(courseModule.revealDate);
  res.render("courses/course_modules/showModule", {
    courseModule,
    course,
    moduleReveal,
    displayRevealDate
  });
};
