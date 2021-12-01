const { Serie, CourseVideo, Subject, Chapter } = require("../models/100bac");

// show serie home
module.exports.showSerieHome = async (req, res) => {
  const serie = await Serie.findById(req.params.serie_id).populate("subjects");
  res.render("programs/100bac/Serie/serieHome", { serie });
};

/* SUBJECTS */

// add a subject to a serie
module.exports.addSubject = async (req, res) => {
  const serie = await Serie.findById(req.params.serie_id);
  const newSubject = new Subject(req.body.subject);
  await newSubject.save();

  serie.subjects.push(newSubject._id);
  await serie.save();

  res.redirect("/100bac");
};

// view a subject
module.exports.viewSubject = async (req, res) => {
  const serie = await Serie.findById(req.params.serie_id);
  const subject = await Subject.findById(req.params.subject_id).populate(
    "chapitres"
  );
  res.render("programs/100bac/Serie/subjects/viewSubject", { serie, subject });
};

// view all subjects
module.exports.viewAllSubject = async (req, res) => {
  const serie = await Serie.findById(req.params.serie_id);
  const subjects = await Subject.find({});
  res.render("programs/100bac/Serie/subjects/viewAllSubject", {
    serie,
    subjects,
  });
};

/* CHAPTERS */

// create a chapter
module.exports.createChapter = async (req, res) => {
  const serie = await Serie.findById(req.params.serie_id);
  const subject = await Subject.findById(req.params.subject_id);

  const newChapter = new Chapter(req.body.chapter);
  await newChapter.save();

  subject.chapitres.push(newChapter._id);
  await subject.save();
  res.redirect("/100bac");
};

// view a chapter
module.exports.viewChapter = async (req, res) => {
  const serie = await Serie.findById(req.params.serie_id);
  const subject = await Subject.findById(req.params.subject_id);
  const chapter = await Chapter.findById(req.params.chapter_id).populate("courses");

  res.render("programs/100bac/Serie/chapters/viewChapter", {
    serie,
    subject,
    chapter,
  });
};

/*=========================================

                VIDEO CONTENT

===========================================*/
module.exports.createVideoContent = async (req, res) => {
  // const serie = await Serie.findById(req.params.serie_id);
  // const subject = await Subject.findById(req.params.subject_id);
  const chapter = await Chapter.findOne({ title: req.body.chapter });

  const newCourseContent = new CourseVideo(req.body.video);
  await newCourseContent.save();

  //saving according to type of videos
  if(req.body.video.videoType === "course"){
    chapter.courses.push(newCourseContent._id);
  }

  if(req.body.video.videoType === "starterEx"){
    chapter.starterExercise.push(newCourseContent._id);
  }

  if(req.body.video.videoType === "advanceEx"){
    chapter.advanceExercise.push(newCourseContent._id);
  }

  if(req.body.video.videoType === "nationalExam"){
    chapter.nationalExams.push(newCourseContent._id);
  }

  if(req.body.video.videoType === "schoolExam"){
    chapter.schoolExams.push(newCourseContent._id);
  }

  await chapter.save();

  res.redirect("/100bac");
};
//
