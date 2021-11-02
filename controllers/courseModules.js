const { Course, Module, Evaluation, Grade } = require("../models/courses");
const User = require("../models/user");

module.exports.createModule = async (req, res) => {
  const course = await Course.findById(req.params.course_id);
  const { title, willLearnModule, explanationText, moreDetails, videos } =
    req.body.module;

  const videoLinks = videos.split(",");

  const newModule = new Module({
    title,
    willLearnModule,
    explanationText,
    moreDetails,
    videoLinks,
  });

  // saving Course New Module
  await newModule.save();

  // pushing new module in course and saving
  course.modules.push(newModule._id);
  
  await course.save();

  res.redirect(`/courses/${course._id}`);
};
