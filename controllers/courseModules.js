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
  let course = await Course.findById(req.params.course_id);

  const module_number = course.modules.indexOf(req.params.module_id) + 1;

   course = await Course.findById(req.params.course_id).populate("modules", "title");

  let moduleReveal = DateUtil.revealTime(courseModule.revealDate);
  displayRevealDate = DateUtil.localTime(courseModule.revealDate);
  res.render("courses/course_modules/showModule", {
    courseModule,
    course,
    module_number,
    moduleReveal,
    displayRevealDate,
  });
};

module.exports.showCourseModules = async (req, res) => {
  const course = await Course.findById(req.params.course_id).populate(
    "modules"
  );
  res.render("courses/course_modules/showCourseModules", {
    course,
  });
};

module.exports.editModule = async (req, res) => {
  const courseModule = await Module.findById(req.params.module_id);
  const course = await Course.findById(req.params.course_id);

  res.render("courses/course_modules/editModule", {
    courseModule,
    course,
  });
};

module.exports.updateModule = async (req, res) => {
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

  const courseModule = await Module.findByIdAndUpdate(req.params.module_id, {
    title,
    willLearnModule,
    explanationText,
    moreDetails,
    videoLinks,
    revealDate,
  });
  await courseModule.save();

  res.redirect(`/admindashboard/courses/${req.params.course_id}/modules`);
};
