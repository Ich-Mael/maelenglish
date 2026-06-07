const express = require('express');
const router  = express.Router();

const { isInstitutionStudent, loadStudentInstitution, checkInstitutionCourseAccess } = require('../middlewares/institutionAuth');
const StudentLearning = require('../controllers/institution/studentLearningController');

// All routes require login + institution membership + institution loading
router.use(isInstitutionStudent, loadStudentInstitution);

// My courses list
router.get('/learn/courses', StudentLearning.myCourses);

// Per-course routes — all require active enrollment validation
const withCourseAccess = [checkInstitutionCourseAccess];

router.get('/learn/courses/:courseId',                                                          withCourseAccess, StudentLearning.showCourse);
router.get('/learn/courses/:courseId/modules/:moduleId/overview',                              withCourseAccess, StudentLearning.showModuleOverview);
router.get('/learn/courses/:courseId/modules/:moduleId/lessons/:lessonId',                    withCourseAccess, StudentLearning.showLesson);
router.post('/learn/courses/:courseId/modules/:moduleId/lessons/:lessonId/complete',          withCourseAccess, StudentLearning.completeLesson);
router.get('/learn/courses/:courseId/modules/:moduleId/quiz',                                 withCourseAccess, StudentLearning.showModuleQuiz);
router.post('/learn/courses/:courseId/modules/:moduleId/quiz/submit',                         withCourseAccess, StudentLearning.submitModuleQuiz);
router.get('/learn/courses/:courseId/modules/:moduleId/assignment',                           withCourseAccess, StudentLearning.showModuleAssignment);
router.post('/learn/courses/:courseId/modules/:moduleId/assignment/submit',                   withCourseAccess, StudentLearning.submitModuleAssignment);
router.get('/learn/courses/:courseId/final-exam',                                             withCourseAccess, StudentLearning.showFinalExam);
router.post('/learn/courses/:courseId/final-exam/submit',                                     withCourseAccess, StudentLearning.submitFinalExam);
router.get('/learn/courses/:courseId/final-project',                                          withCourseAccess, StudentLearning.showFinalProject);
router.post('/learn/courses/:courseId/final-project/submit',                                  withCourseAccess, StudentLearning.submitFinalProject);

module.exports = router;
