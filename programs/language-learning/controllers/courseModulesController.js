const {
  Course,
  Module,
  EngCourseVideo,
  Practice,
  Evaluation,
  Grade
} = require("../../../shared/models/courses");
const User = require("../../../shared/models/user");
const StudentProgress = require("../../../shared/models/studentProgress");
const DateUtil = require("../../../shared/utilities/date");
const catchAsync = require("../../../shared/utilities/catchAsync");

// module controller
module.exports.createModule = catchAsync(async (req, res) => {
  const course = await Course.findById(req.params.course_id);
  const {
    title,
    willLearnModule,
    explanationText,
    moreDetails,
    revealDate,
  } = req.body.module;

  const newModule = new Module({
    title,
    willLearnModule,
    explanationText,
    moreDetails,
    revealDate,
  });

  // saving Course New Module
  await newModule.save();

  // pushing new module in course and saving
  course.modules.push(newModule._id);
  await course.save();

  req.flash("success", "Module créé avec succès");
  res.redirect(`/programs/language-learning/general-english-boost/${course._id}`);
});

module.exports.showModule = catchAsync(async (req, res) => {
  const courseModule = await Module.findById(req.params.module_id)
    .populate("Assignment")
    .populate("videoLinks");
  let course = await Course.findById(req.params.course_id);

  const module_number = course.modules.indexOf(req.params.module_id) + 1;

  course = await Course.findById(req.params.course_id).populate("modules", "title");

  let moduleReveal = DateUtil.revealTime(courseModule.revealDate);
  let displayRevealDate = DateUtil.localTime(courseModule.revealDate);

  // Track module view for progress (fire-and-forget)
  if (req.user) {
    StudentProgress.findOneAndUpdate(
      { userId: req.user._id, courseId: course._id, moduleId: courseModule._id },
      { $set: { lastViewedAt: new Date(), status: 'in_progress' } },
      { upsert: true, new: true }
    ).catch(err => console.error('StudentProgress tracking error:', err));
  }

  res.render("programs/language-learning/courses/course_modules/showModule", {
    courseModule,
    course,
    module_number,
    moduleReveal,
    displayRevealDate,
  });
});

module.exports.markComplete = catchAsync(async (req, res) => {
  const { course_id, module_id } = req.params;

  await StudentProgress.findOneAndUpdate(
    { userId: req.user._id, courseId: course_id, moduleId: module_id },
    { $set: { status: 'completed', completedAt: new Date(), lastViewedAt: new Date() } },
    { upsert: true }
  );

  req.flash('success', 'Module marqué comme terminé !');
  res.redirect(`/programs/language-learning/general-english-boost/${course_id}/modules/${module_id}`);
});

module.exports.showCourseModules = catchAsync(async (req, res) => {
  const course = await Course.findById(req.params.course_id).populate(
    "modules"
  );
  res.render("programs/language-learning/courses/course_modules/showCourseModules", {
    course,
  });
});

module.exports.editModule = catchAsync(async (req, res) => {
  const courseModule = await Module.findById(req.params.module_id).populate("videoLinks").populate("Assignment");
  const course = await Course.findById(req.params.course_id);

  res.render("programs/language-learning/courses/course_modules/editModule", {
    courseModule,
    course,
  });
});

module.exports.updateModule = catchAsync(async (req, res) => {
  const {
    title,
    willLearnModule,
    explanationText,
    moreDetails,
    revealDate,
  } = req.body.module;

  const courseModule = await Module.findByIdAndUpdate(req.params.module_id, {
    title,
    willLearnModule,
    explanationText,
    moreDetails,
    revealDate,
  });
  await courseModule.save();

  req.flash("success", "Module mis à jour avec succès");
  res.redirect(`/programs/language-learning/general-english-boost/admindashboard/${req.params.course_id}/modules`);
});

module.exports.deleteModule = catchAsync(async (req, res) => {
  await Module.findByIdAndDelete(req.params.module_id);
  req.flash("success", "Module supprimé avec succès");
  res.redirect(`/programs/language-learning/general-english-boost/admindashboard/${req.params.course_id}/modules`);
});

// Video lesson
module.exports.addEngVideoLesson = catchAsync(async (req, res) => {
  const courseModule = await Module.findById(req.params.courseModule_id);

  const newEngVideo = new EngCourseVideo(req.body.engVideo);

  // saving new video
  await newEngVideo.save();

  courseModule.videoLinks.push(newEngVideo._id);

  // saving module
  await courseModule.save();

  req.flash("success", "Vidéo de leçon ajoutée avec succès");
  res.redirect(`/programs/language-learning/general-english-boost/admindashboard/${req.params.course_id}/modules`);
});

// Practice exercises
module.exports.createPractice = catchAsync(async (req, res) => {
  const module = await Module.findById(req.params.courseModule_id);

  const {
    title,
    category,
    practice_links
  } = req.body.practice;

  const links = practice_links ? practice_links.split(",").map(link => link.trim()) : [];

  const newPractice = new Practice({
    title,
    category,
    links
  });
  await newPractice.save();

  module.Assignment.push(newPractice._id);
  await module.save();

  req.flash("success", "Exercice de pratique ajouté avec succès");
  res.redirect(`/programs/language-learning/general-english-boost/admindashboard/${req.params.course_id}/modules`);
});

// Coach Resources
module.exports.addCoachResource = catchAsync(async (req, res) => {
  const courseModule = await Module.findById(req.params.courseModule_id);
  
  if (!courseModule) {
    req.flash("error", "Module non trouvé");
    return res.redirect(`/programs/language-learning/general-english-boost/admindashboard/${req.params.course_id}/modules`);
  }

  const { title, type, description, link } = req.body.resource;
  
  courseModule.coachResources.push({
    title,
    type,
    description,
    link
  });
  
  await courseModule.save();
  
  req.flash("success", "Ressource pour coach ajoutée avec succès");
  res.redirect(`/programs/language-learning/general-english-boost/admindashboard/${req.params.course_id}/modules/${req.params.courseModule_id}/edit`);
});

module.exports.deleteCoachResource = catchAsync(async (req, res) => {
  const courseModule = await Module.findById(req.params.courseModule_id);
  
  if (!courseModule) {
    req.flash("error", "Module non trouvé");
    return res.redirect(`/programs/language-learning/general-english-boost/admindashboard/${req.params.course_id}/modules`);
  }
  
  courseModule.coachResources = courseModule.coachResources.filter(
    resource => resource._id.toString() !== req.params.resource_id
  );
  
  await courseModule.save();
  
  req.flash("success", "Ressource supprimée avec succès");
  res.redirect(`/programs/language-learning/general-english-boost/admindashboard/${req.params.course_id}/modules/${req.params.courseModule_id}/edit`);
});

// Delete Video lesson from a module
module.exports.deleteEngVideoLesson = catchAsync(async (req, res) => {
  const { course_id, courseModule_id, video_id } = req.params;
  const courseModule = await Module.findById(courseModule_id);

  if (!courseModule) {
    req.flash("error", "Module non trouvé");
    return res.redirect(`/programs/language-learning/general-english-boost/admindashboard/${course_id}/modules`);
  }

  // Remove video ID from module's videoLinks array
  courseModule.videoLinks = courseModule.videoLinks.filter(
    id => id.toString() !== video_id
  );
  await courseModule.save();

  // Also delete the EngCourseVideo document itself
  await EngCourseVideo.findByIdAndDelete(video_id);

  req.flash("success", "Vidéo supprimée avec succès");
  res.redirect(`/programs/language-learning/general-english-boost/admindashboard/${course_id}/modules/${courseModule_id}/edit`);
});

// Update Video lesson in a module
module.exports.updateEngVideoLesson = catchAsync(async (req, res) => {
  const { course_id, courseModule_id, video_id } = req.params;

  await EngCourseVideo.findByIdAndUpdate(video_id, req.body.engVideo);

  req.flash("success", "Vidéo mise à jour avec succès");
  res.redirect(`/programs/language-learning/general-english-boost/admindashboard/${course_id}/modules/${courseModule_id}/edit`);
});

// Update Practice exercise in a module
module.exports.updatePractice = catchAsync(async (req, res) => {
  const { course_id, courseModule_id, practice_id } = req.params;
  const { title, category, practice_links } = req.body.practice;

  const links = practice_links ? practice_links.split(",").map(link => link.trim()) : [];

  await Practice.findByIdAndUpdate(practice_id, { title, category, links });

  req.flash("success", "Exercice de pratique mis à jour avec succès");
  res.redirect(`/programs/language-learning/general-english-boost/admindashboard/${course_id}/modules/${courseModule_id}/edit`);
});

// Delete Practice exercise from a module
module.exports.deletePractice = catchAsync(async (req, res) => {
  const { course_id, courseModule_id, practice_id } = req.params;
  const courseModule = await Module.findById(courseModule_id);

  if (!courseModule) {
    req.flash("error", "Module non trouvé");
    return res.redirect(`/programs/language-learning/general-english-boost/admindashboard/${course_id}/modules`);
  }

  // Remove practice ID from module's Assignment array
  courseModule.Assignment = courseModule.Assignment.filter(
    id => id.toString() !== practice_id
  );
  await courseModule.save();

  // Also delete the Practice document itself
  await Practice.findByIdAndDelete(practice_id);

  req.flash("success", "Exercice de pratique supprimé avec succès");
  res.redirect(`/programs/language-learning/general-english-boost/admindashboard/${course_id}/modules/${courseModule_id}/edit`);
});


