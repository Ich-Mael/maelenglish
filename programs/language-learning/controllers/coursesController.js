const { Course, Module, Evaluation, Grade } = require("../../../shared/models/courses");
const User = require("../../../shared/models/user");
const DateUtil = require('../../../shared/utilities/date');
const catchAsync = require("../../../shared/utilities/catchAsync");

module.exports.allCourses = catchAsync(async (req, res) => {
  let query = { isActive: true, isPrivate: { $ne: true } };
  if (req.user && req.user.coursesTaken && req.user.coursesTaken.length > 0) {
    query = {
      $or: [
        { isActive: true, isPrivate: { $ne: true } },
        { _id: { $in: req.user.coursesTaken } }
      ]
    };
  }
  const courses = await Course.find(query).populate("instructors");
  res.render("programs/language-learning/courses/index", { courses });
});

module.exports.myCourses = catchAsync(async (req, res) => {
  let query = { _id: { $in: [] } }; // Default to empty if no courses
  
  if (req.user && req.user.coursesTaken && req.user.coursesTaken.length > 0) {
    query = {
      _id: { $in: req.user.coursesTaken }
    };
  }
  
  const courses = await Course.find(query).populate("instructors");
  res.render("programs/language-learning/courses/my_courses", { courses });
});

module.exports.allCoursesAdmin = catchAsync(async (req, res) => {
  const courses = await Course.find().populate("instructors");
  res.render("programs/language-learning/courses/admin_show_all", { courses });
});

module.exports.createCourse = catchAsync(async (req, res) => {
  try {
    // Validate required fields
    if (!req.body.course || !req.body.course.title || !req.body.course.price) {
      req.flash("error", "Le titre et le prix sont requis");
      return res.redirect("/programs/language-learning/general-english-boost/admindashboard/new");
    }

    // Validate description (required but may be empty string from Hugerte)
    if (!req.body.course.description || req.body.course.description.trim() === '') {
      req.flash("error", "La description est requise");
      return res.redirect("/programs/language-learning/general-english-boost/admindashboard/new");
    }

    const course = new Course(req.body.course);
    const instructorsList = req.body.instructors;

    if (instructorsList) {
      for (let property in instructorsList) {
        if (instructorsList[property] && instructorsList[property].trim() !== '') {
          const instructor = await User.findOne({
            username: `${instructorsList[property].trim()}`,
          });
          if (instructor) {
            //pushing user to instructors array
            course.instructors.push(instructor);

            // adding course to user given courses
            if (!instructor.coursesGiven) {
              instructor.coursesGiven = [];
            }
            instructor.coursesGiven.push(course);
            await instructor.save();
          }
        }
      }
    }
    //saving course to database
    await course.save();
    req.flash("success", "Cours créé avec succès");
    res.redirect(`/programs/language-learning/general-english-boost/${course._id}`);
  } catch (error) {
    console.error("Error creating course:", error);
    req.flash("error", error.message || "Une erreur est survenue lors de la création du cours");
    res.redirect("/programs/language-learning/general-english-boost/admindashboard/new");
  }
});

module.exports.showCourse = catchAsync(async (req, res) => {
  const course = await Course.findById(req.params.course_id)
    .populate("instructors")
    .populate("modules");

  let start = DateUtil.localTime(course.session.startDate);
  let end = DateUtil.localTime(course.session.endDate);
  res.render("programs/language-learning/courses/show", { course, start, end });
});

module.exports.editCourse = catchAsync(async (req, res) => {
  const course = await Course.findById(req.params.course_id).populate(
    "instructors"
  );
  res.render("programs/language-learning/courses/editCourse", { course});
});

module.exports.updateCourse = catchAsync(async(req, res)=>{
  const course = await Course.findByIdAndUpdate(req.params.course_id, {...req.body.course, session: {...req.body.session}});
  await course.save();
  req.flash("success", "Cours mis à jour avec succès");
  res.redirect(`/programs/language-learning/general-english-boost/${course._id}`);
});

module.exports.showStudents = catchAsync(async(req, res)=>{
  const course = await Course.findById(req.params.course_id)
    .populate("students");
  res.render("programs/language-learning/courses/studentsList", { course}); 
});

module.exports.updateStudentAccess = catchAsync(async (req, res) => {
    const { course_id, student_id } = req.params;
    const { startDate, endDate } = req.body;

    const course = await Course.findById(course_id);
    const student = await User.findById(student_id);

    if (!course || !student) {
        req.flash('error', 'Course or Student not found.');
        return res.redirect('back');
    }

    // Find the enrollment program
    // We try to match by courseTitle first as that's how it's stored
    const programIndex = student.specialProgram.findIndex(p => p.courseTitle === course.title);

    if (programIndex !== -1) {
        // Update existing program
        student.specialProgram[programIndex].startDate = new Date(startDate);
        student.specialProgram[programIndex].endDate = new Date(endDate);
    } else {
        // Fallback: If not found in specialProgram but is in coursesTaken (legacy), add it now
        // This effectively "migrates" legacy enrollments to the new system
        if (student.coursesTaken.includes(course_id)) {
            student.specialProgram.push({
                courseTitle: course.title,
                startDate: new Date(startDate),
                endDate: new Date(endDate)
            });
        } else {
            req.flash('error', 'Student is not enrolled in this course.');
            return res.redirect('back');
        }
    }

    await student.save();
    req.flash('success', 'Access dates updated successfully.');
    res.redirect(`/programs/language-learning/general-english-boost/admindashboard/${course_id}/showStudents`);
});

module.exports.deleteCourse = catchAsync(async (req, res) => {
  await Course.findByIdAndDelete(req.params.course_id);
  req.flash("success", "Cours supprimé avec succès");
  res.redirect("/programs/language-learning/general-english-boost/admindashboard");
});

module.exports.showAddStudentForm = catchAsync(async (req, res) => {
  const course = await Course.findById(req.params.course_id);
  if (!course) {
    req.flash("error", "Cours non trouvé");
    return res.redirect("/programs/language-learning/general-english-boost/admindashboard");
  }
  res.render("programs/language-learning/courses/addNewStudent", { course });
});

module.exports.addStudentToCourse = catchAsync(async (req, res) => {
  const { course_id } = req.params;
  const { student, startDate, endDate } = req.body;

  // Find user by username
  const user = await User.findOne({ username: student });
  if (!user) {
    req.flash("error", "Utilisateur non trouvé");
    return res.redirect(`/programs/language-learning/general-english-boost/admindashboard/${course_id}/addStudent`);
  }

  // Find course
  const course = await Course.findById(course_id);
  if (!course) {
    req.flash("error", "Cours non trouvé");
    return res.redirect("/programs/language-learning/general-english-boost/admindashboard");
  }

  // Check if student is already enrolled
  if (course.students.includes(user._id)) {
    req.flash("error", "Cet étudiant est déjà inscrit à ce cours");
    return res.redirect(`/programs/language-learning/general-english-boost/admindashboard/${course_id}/addStudent`);
  }

  // Add student to course
  course.students.push(user._id);
  await course.save();

  // Add course to user's coursesTaken
  if (!user.coursesTaken) {
    user.coursesTaken = [];
  }
  if (!user.coursesTaken.includes(course._id)) {
    user.coursesTaken.push(course._id);
  }

  // Add to specialProgram with dates
  const student_course_data = {
    courseTitle: course.title,
    startDate: startDate ? new Date(startDate) : new Date(),
    endDate: endDate ? new Date(endDate) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // Default: 30 days from now
  };

  if (!user.specialProgram) {
    user.specialProgram = [];
  }
  user.specialProgram.push(student_course_data);
  await user.save();

  req.flash("success", `${user.name} ${user.surname} a été inscrit avec succès au cours "${course.title}"`);
  res.redirect(`/programs/language-learning/general-english-boost/admindashboard/${course_id}/showStudents`);
});

module.exports.searchUsers = catchAsync(async (req, res) => {
  const query = req.query.q || '';
  const { course_id } = req.params;
  
  // Need at least 3 characters
  if (query.length < 3) {
    return res.json({ users: [] });
  }
  
  // Get course to check enrolled students
  const course = await Course.findById(course_id).select('students');
  const enrolledUserIds = course ? course.students.map(id => id.toString()) : [];
  
  // Search users by username, name, surname, or email
  // Exclude already enrolled students
  const users = await User.find({
    $or: [
      { username: { $regex: query, $options: 'i' } },
      { name: { $regex: query, $options: 'i' } },
      { surname: { $regex: query, $options: 'i' } },
      { email: { $regex: query, $options: 'i' } }
    ],
    _id: { $nin: enrolledUserIds } // Exclude already enrolled
  })
  .select('username name surname email')
  .limit(10)
  .sort({ username: 1 });
  
  res.json({ users });
});


// ─── FINAL EXAM ───────────────────────────────────────────────────────────────

module.exports.saveFinalExam = catchAsync(async (req, res) => {
  const { course_id } = req.params;
  const { title, passingScore, timeLimit, questions } = req.body;

  const course = await Course.findById(course_id);
  if (!course) {
    req.flash('error', 'Cours introuvable.');
    return res.redirect('/programs/language-learning/general-english-boost/admindashboard');
  }

  const parsedQuestions = questions
    ? (Array.isArray(questions) ? questions : [questions]).map(q => ({
        text:          q.text || '',
        correctAnswer: q.correctAnswer || '',
        explanation:   q.explanation || '',
        options:       (Array.isArray(q.options) ? q.options : []).map((opt, i) => ({
          id:    String(i),
          text:  opt.text  || '',
          value: opt.value || String(i)
        }))
      }))
    : [];

  course.finalExam = {
    title:        title || 'Examen final',
    passingScore: parseInt(passingScore) || 70,
    timeLimit:    parseInt(timeLimit)    || 0,
    questions:    parsedQuestions
  };
  await course.save();

  req.flash('success', 'Examen final sauvegardé.');
  res.redirect(`/programs/language-learning/general-english-boost/admindashboard/${course_id}/edit`);
});

// ─── FINAL PROJECT ────────────────────────────────────────────────────────────

module.exports.saveFinalProject = catchAsync(async (req, res) => {
  const { course_id } = req.params;
  const { title, instructions, submissionType, maxScore } = req.body;

  const course = await Course.findById(course_id);
  if (!course) {
    req.flash('error', 'Cours introuvable.');
    return res.redirect('/programs/language-learning/general-english-boost/admindashboard');
  }

  course.finalProject = {
    title:          title || 'Projet final',
    instructions:   instructions || '',
    submissionType: submissionType || 'text',
    maxScore:       parseInt(maxScore) || 100
  };
  await course.save();

  req.flash('success', 'Projet final sauvegardé.');
  res.redirect(`/programs/language-learning/general-english-boost/admindashboard/${course_id}/edit`);
});
