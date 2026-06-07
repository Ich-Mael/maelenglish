const express = require('express');
const router = express.Router();
const Courses = require('../controllers/coursesController');
const CourseModules = require('../controllers/courseModulesController');
const Lessons = require('../controllers/lessonController');
const StudentLessons = require('../controllers/studentLessonController');
const Assessments = require('../controllers/studentAssessmentController');
const catchAsync = require('../../../shared/utilities/catchAsync');
const {
    isLoggedIn,
    checkRoles,
    isVerified
} = require('../../../shared/middlewares/auth');
const {
    checkCourseOwnership
} = require('../middlewares/courseController');
const {
    checkCourseAccess
} = require('../middlewares/courseAccess');

/*
 ************************* COURSES ROUTES *******************************************
 */

// All Courses route for user
router.get('/', Courses.allCourses);

// My Courses route for enrolled user
router.get('/my-courses', isLoggedIn, Courses.myCourses);

// All Courses route for admin
router.get('/admindashboard', isLoggedIn, isVerified, checkRoles(["admin", "super-admin"]), Courses.allCoursesAdmin);

// Form for a new course
router.get('/admindashboard/new', isLoggedIn, isVerified, checkRoles(["admin", "super-admin"]), (req, res) => {
    res.render('programs/language-learning/courses/new');
});

// Creating a new course
router.post('/admindashboard', isLoggedIn, isVerified, checkRoles(["admin", "super-admin"]), Courses.createCourse);

// Show course content
router.get('/enroll-contact', (req, res) => {
    res.render('programs/language-learning/contact_enroll');
});

// Show course content
router.get('/:course_id', isLoggedIn, checkCourseAccess, Courses.showCourse);

// Edit course
router.get("/admindashboard/:course_id/edit", isLoggedIn, isVerified, checkRoles(["admin", "super-admin"]), Courses.editCourse);

// Update Course info
router.put("/admindashboard/:course_id", isLoggedIn, isVerified, checkRoles(["admin", "super-admin"]), Courses.updateCourse);

// Save final exam
router.post("/admindashboard/:course_id/final-exam", isLoggedIn, isVerified, checkRoles(["admin", "super-admin"]), Courses.saveFinalExam);

// Save final project
router.post("/admindashboard/:course_id/final-project", isLoggedIn, isVerified, checkRoles(["admin", "super-admin"]), Courses.saveFinalProject);

// Delete course
router.get("/admindashboard/:course_id/delete", isLoggedIn, isVerified, checkRoles(["admin", "super-admin"]), Courses.deleteCourse); // Fixed: Added delete route if missing or modified
router.delete("/admindashboard/:course_id", isLoggedIn, isVerified, checkRoles(["admin", "super-admin"]), Courses.deleteCourse);

// Show students enrolled in a course
router.get("/admindashboard/:course_id/showStudents", isLoggedIn, isVerified, checkRoles(["admin", "super-admin"]), Courses.showStudents);

// Form to add a student to a course
router.get('/admindashboard/:course_id/addStudent', isLoggedIn, isVerified, checkRoles(["admin", "super-admin"]), Courses.showAddStudentForm);

// Add student to a course
router.post('/admindashboard/:course_id/addStudent', isLoggedIn, isVerified, checkRoles(["admin", "super-admin"]), Courses.addStudentToCourse);

// Update student access dates
router.post('/admindashboard/:course_id/students/:student_id/access', isLoggedIn, isVerified, checkRoles(["admin", "super-admin"]), Courses.updateStudentAccess);

// API: Search users for student enrollment
router.get('/admindashboard/:course_id/search-users', isLoggedIn, isVerified, checkRoles(["admin", "super-admin"]), Courses.searchUsers);

/*
 ************************* MODULE ROUTES *******************************************
 */

// Show all modules of a course
router.get('/admindashboard/:course_id/modules', isLoggedIn, isVerified, checkRoles(['admin', 'super-admin']), CourseModules.showCourseModules);

// Reorder modules (must be before /:module_id routes)
router.post('/admindashboard/:course_id/modules/reorder', isLoggedIn, isVerified, checkRoles(['admin', 'super-admin']), CourseModules.reorderModules);

// Creating a new module
router.post('/admindashboard/:course_id/module', isLoggedIn, isVerified, checkRoles(["admin", "super-admin"]), CourseModules.createModule);

// Show module content (legacy — kept for backward compat)
router.get('/:course_id/modules/:module_id', isLoggedIn, isVerified, checkCourseOwnership, checkCourseAccess, CourseModules.showModule);

// Mark module as completed (legacy)
router.post('/:course_id/modules/:module_id/complete', isLoggedIn, isVerified, CourseModules.markComplete);

// New structured lesson routes
router.get('/:course_id/modules/:module_id/overview', isLoggedIn, isVerified, checkCourseOwnership, checkCourseAccess, StudentLessons.showModuleOverview);
router.get('/:course_id/modules/:module_id/lessons/:lesson_id', isLoggedIn, isVerified, checkCourseOwnership, checkCourseAccess, StudentLessons.showLesson);
router.post('/:course_id/modules/:module_id/lessons/:lesson_id/complete', isLoggedIn, isVerified, checkCourseOwnership, checkCourseAccess, StudentLessons.completeLesson);

// Edit module
router.get("/admindashboard/:course_id/modules/:module_id/edit", isLoggedIn, isVerified, checkRoles(["admin", "super-admin"]), CourseModules.editModule);

// Update module
router.put("/admindashboard/:course_id/modules/:module_id", isLoggedIn, isVerified, checkRoles(["admin", "super-admin"]), CourseModules.updateModule);

// Delete module
router.delete("/admindashboard/:course_id/modules/:module_id", isLoggedIn, isVerified, checkRoles(["admin", "super-admin"]), CourseModules.deleteModule);

/*
 ************************* PRACTICE EXERCISE ROUTES *******************************************
 */

router.post('/admindashboard/:course_id/modules/:courseModule_id/practice', isLoggedIn, isVerified, checkRoles(["admin", "super-admin"]), CourseModules.createPractice);

router.put('/admindashboard/:course_id/modules/:courseModule_id/practice/:practice_id', isLoggedIn, isVerified, checkRoles(["admin", "super-admin"]), CourseModules.updatePractice);

router.delete('/admindashboard/:course_id/modules/:courseModule_id/practice/:practice_id', isLoggedIn, isVerified, checkRoles(["admin", "super-admin"]), CourseModules.deletePractice);


/*
 ************************* VIDEO LESSON ROUTES *******************************************
 */

router.post('/admindashboard/:course_id/modules/:courseModule_id/engcoursevideo', isLoggedIn, isVerified, checkRoles(["admin", "super-admin"]), CourseModules.addEngVideoLesson);

router.delete('/admindashboard/:course_id/modules/:courseModule_id/engcoursevideo/:video_id', isLoggedIn, isVerified, checkRoles(["admin", "super-admin"]), CourseModules.deleteEngVideoLesson);

router.put('/admindashboard/:course_id/modules/:courseModule_id/engcoursevideo/:video_id', isLoggedIn, isVerified, checkRoles(["admin", "super-admin"]), CourseModules.updateEngVideoLesson);



/*
 ************************* EVALUATION ROUTES *******************************************
 */
// Admin: create or update evaluation for a module
router.post('/admindashboard/:course_id/modules/:module_id/evaluation', isLoggedIn, isVerified, checkRoles(['admin', 'super-admin']), CourseModules.saveEvaluation);

// Admin: delete evaluation from a module
router.delete('/admindashboard/:course_id/modules/:module_id/evaluation', isLoggedIn, isVerified, checkRoles(['admin', 'super-admin']), CourseModules.deleteEvaluation);

// Admin: save module quiz (new structured field)
router.post('/admindashboard/:course_id/modules/:module_id/module-quiz', isLoggedIn, isVerified, checkRoles(['admin', 'super-admin']), CourseModules.saveModuleQuiz);

// Admin: save module assignment
router.post('/admindashboard/:course_id/modules/:module_id/assignment', isLoggedIn, isVerified, checkRoles(['admin', 'super-admin']), CourseModules.saveModuleAssignment);

// Student: submit evaluation answers (legacy)
router.post('/:course_id/modules/:module_id/evaluation/submit', isLoggedIn, isVerified, checkCourseOwnership, checkCourseAccess, CourseModules.submitEvaluation);

// Student: module quiz (new)
router.get( '/:course_id/modules/:module_id/module-quiz',        isLoggedIn, isVerified, checkCourseOwnership, checkCourseAccess, Assessments.showModuleQuiz);
router.post('/:course_id/modules/:module_id/module-quiz/submit', isLoggedIn, isVerified, checkCourseOwnership, checkCourseAccess, Assessments.submitModuleQuiz);

// Student: module assignment
router.get( '/:course_id/modules/:module_id/assignment',        isLoggedIn, isVerified, checkCourseOwnership, checkCourseAccess, Assessments.showModuleAssignment);
router.post('/:course_id/modules/:module_id/assignment/submit', isLoggedIn, isVerified, checkCourseOwnership, checkCourseAccess, Assessments.submitModuleAssignment);

// Student: final exam
router.get( '/:course_id/final-exam',        isLoggedIn, isVerified, checkCourseOwnership, checkCourseAccess, Assessments.showFinalExam);
router.post('/:course_id/final-exam/submit', isLoggedIn, isVerified, checkCourseOwnership, checkCourseAccess, Assessments.submitFinalExam);

// Student: final project
router.get( '/:course_id/final-project',        isLoggedIn, isVerified, checkCourseOwnership, checkCourseAccess, Assessments.showFinalProject);
router.post('/:course_id/final-project/submit', isLoggedIn, isVerified, checkCourseOwnership, checkCourseAccess, Assessments.submitFinalProject);

// Instructor: grading queue
router.get( '/admindashboard/:course_id/grading',                      isLoggedIn, isVerified, checkRoles(['admin', 'super-admin', 'english-coach', 'instructor']), Assessments.gradingQueue);
router.post('/admindashboard/:course_id/grading/:submission_id/grade', isLoggedIn, isVerified, checkRoles(['admin', 'super-admin', 'english-coach', 'instructor']), Assessments.gradeSubmission);

/*
 ************************* LESSON ROUTES *******************************************
 */
const adminLesson = [isLoggedIn, isVerified, checkRoles(['admin', 'super-admin'])];

// Create lesson in a module
router.post('/admindashboard/:course_id/modules/:module_id/lessons', ...adminLesson, Lessons.create);

// Update lesson
router.put('/admindashboard/:course_id/modules/:module_id/lessons/:lesson_id', ...adminLesson, Lessons.update);

// Delete lesson
router.delete('/admindashboard/:course_id/modules/:module_id/lessons/:lesson_id', ...adminLesson, Lessons.destroy);

// Reorder lessons (AJAX)
router.post('/admindashboard/:course_id/modules/:module_id/lessons/reorder', ...adminLesson, Lessons.reorder);

// Save practice quiz questions for a lesson
router.post('/admindashboard/:course_id/modules/:module_id/lessons/:lesson_id/practice-quiz', ...adminLesson, Lessons.savePracticeQuiz);

/*
 ************************* COACH RESOURCES ROUTES *******************************************
 */
// Add coach resource to a module
router.post('/admindashboard/:course_id/modules/:courseModule_id/coach-resource', isLoggedIn, isVerified, checkRoles(["admin", "super-admin"]), CourseModules.addCoachResource);

// Delete coach resource from a module
router.delete('/admindashboard/:course_id/modules/:courseModule_id/coach-resource/:resource_id', isLoggedIn, isVerified, checkRoles(["admin", "super-admin"]), CourseModules.deleteCoachResource);

module.exports = router;

