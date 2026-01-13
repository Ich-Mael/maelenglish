const express = require('express');
const router = express.Router();
const Courses = require('../controllers/coursesController');
const CourseModules = require('../controllers/courseModulesController');
const catchAsync = require('../../../shared/utilities/catchAsync');
const {
    isLoggedIn,
    checkRoles,
    isVerified
} = require('../../../shared/middlewares/auth');
const {
    checkCourseOwnership
} = require('../middlewares/courseController');

/*
 ************************* COURSES ROUTES *******************************************
 */

// All Courses route for user
router.get('/', Courses.allCourses);

// All Courses route for admin
router.get('/admindashboard', isLoggedIn, isVerified, checkRoles("admin"), Courses.allCoursesAdmin);

// Form for a new course
router.get('/admindashboard/new', isLoggedIn, isVerified, checkRoles("admin"), (req, res) => {
    res.render('programs/language-learning/courses/new');
});

// Creating a new course
router.post('/admindashboard', isLoggedIn, isVerified, checkRoles("admin"), Courses.createCourse);

// Show course content
router.get('/enroll-contact', (req, res) => {
    res.render('programs/language-learning/contact_enroll');
});

router.get('/:course_id', Courses.showCourse);

// Edit course
router.get("/admindashboard/:course_id/edit", isLoggedIn, isVerified, checkRoles("admin"), Courses.editCourse);

// Update Course info
router.put("/admindashboard/:course_id", isLoggedIn, isVerified, checkRoles("admin"), Courses.updateCourse);

// Delete course
router.delete("/admindashboard/:course_id", isLoggedIn, isVerified, checkRoles("admin"), Courses.deleteCourse);

// Show students enrolled in a course
router.get("/admindashboard/:course_id/showStudents", isLoggedIn, isVerified, checkRoles("admin"), Courses.showStudents);

// Form to add a student to a course
router.get('/admindashboard/:course_id/addStudent', isLoggedIn, isVerified, checkRoles("admin"), Courses.showAddStudentForm);

// Add student to a course
router.post('/admindashboard/:course_id/addStudent', isLoggedIn, isVerified, checkRoles("admin"), Courses.addStudentToCourse);

// API: Search users for student enrollment
router.get('/admindashboard/:course_id/search-users', isLoggedIn, isVerified, checkRoles("admin"), Courses.searchUsers);

/*
 ************************* MODULE ROUTES *******************************************
 */

// Show all modules of a course
router.get('/admindashboard/:course_id/modules', isLoggedIn, isVerified, checkRoles('admin'), CourseModules.showCourseModules);

// Creating a new module
router.post('/admindashboard/:course_id/module', isLoggedIn, isVerified, checkRoles("admin"), CourseModules.createModule);

// Show module content
router.get('/:course_id/modules/:module_id', isLoggedIn, isVerified, checkCourseOwnership, CourseModules.showModule);

// Edit module
router.get("/admindashboard/:course_id/modules/:module_id/edit", isLoggedIn, isVerified, checkRoles("admin"), CourseModules.editModule);

// Update module
router.put("/admindashboard/:course_id/modules/:module_id", isLoggedIn, isVerified, checkRoles("admin"), CourseModules.updateModule);

// Delete module
router.delete("/admindashboard/:course_id/modules/:module_id", isLoggedIn, isVerified, checkRoles("admin"), CourseModules.deleteModule);

/*
 ************************* PRACTICE EXERCISE ROUTES *******************************************
 */

router.post('/admindashboard/:course_id/modules/:courseModule_id/practice', isLoggedIn, isVerified, checkRoles("admin"), CourseModules.createPractice);

/*
 ************************* VIDEO LESSON ROUTES *******************************************
 */

router.post('/admindashboard/:course_id/modules/:courseModule_id/engcoursevideo', isLoggedIn, isVerified, checkRoles("admin"), CourseModules.addEngVideoLesson);

/*
 ************************* EVALUATION ROUTES *******************************************
 */
// Evaluation routes (placeholder for future implementation)
router.get('/:course_id/evaluations/:evaluation', isLoggedIn, isVerified, checkCourseOwnership, catchAsync(async (req, res) => {
    res.send("Evaluation page - To be implemented");
}));

/*
 ************************* COACH RESOURCES ROUTES *******************************************
 */
// Add coach resource to a module
router.post('/admindashboard/:course_id/modules/:courseModule_id/coach-resource', isLoggedIn, isVerified, checkRoles("admin"), CourseModules.addCoachResource);

// Delete coach resource from a module
router.delete('/admindashboard/:course_id/modules/:courseModule_id/coach-resource/:resource_id', isLoggedIn, isVerified, checkRoles("admin"), CourseModules.deleteCoachResource);

module.exports = router;

