const User = require("../../../shared/models/user");
const { Course } = require("../../../shared/models/courses");
const catchAsync = require("../../../shared/utilities/catchAsync");

module.exports.checkCourseOwnership = catchAsync(async (req, res, next) => {
  const course = await Course.findById(req.params.course_id);
  if (course) {
    if (course.students.includes(req.user._id) || req.user.role === "admin") {
      next();
    } else {
      req.flash("error", "Vous n'avez pas accès à ce cours");
      res.redirect("/maelenglish#programmes");
    }
  } else {
    req.flash("error", "Cours non trouvé");
    res.redirect("/maelenglish#programmes");
  }
});

