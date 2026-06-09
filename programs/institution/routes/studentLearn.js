const express = require('express');
const router = express.Router();
const { isLoggedIn } = require('../../../shared/middlewares/auth');
const { isInstitutionStudent, loadStudentInstitution, checkInstitutionCourseAccess } = require('../../../shared/middlewares/institutionAuth');

const learnController = require('../controllers/student/learnController');

const studentAuth = [isLoggedIn, isInstitutionStudent, loadStudentInstitution];

// ─── INSTRUCTORS ────────────────────────────────────────────────────────────

router.get('/instructors', ...studentAuth, learnController.instructors);

// ─── COURSE BROWSING ────────────────────────────────────────────────────────

router.get('/courses', ...studentAuth, learnController.courses);
router.get('/courses/:courseId', ...studentAuth, checkInstitutionCourseAccess, learnController.courseShow);

// ─── MODULE + LESSON VIEWS ──────────────────────────────────────────────────

router.get('/courses/:courseId/modules/:moduleId', ...studentAuth, checkInstitutionCourseAccess, learnController.moduleOverview);
router.get('/courses/:courseId/modules/:moduleId/overview', ...studentAuth, checkInstitutionCourseAccess, learnController.moduleOverview);
router.get('/courses/:courseId/modules/:moduleId/lessons/:lessonId', ...studentAuth, checkInstitutionCourseAccess, learnController.lessonShow);
router.post('/courses/:courseId/modules/:moduleId/lessons/:lessonId/complete', ...studentAuth, checkInstitutionCourseAccess, learnController.completeLesson);

// ─── QUIZ ───────────────────────────────────────────────────────────────────

router.get('/courses/:courseId/modules/:moduleId/quiz', ...studentAuth, checkInstitutionCourseAccess, learnController.quiz);
router.post('/courses/:courseId/modules/:moduleId/quiz/submit', ...studentAuth, checkInstitutionCourseAccess, learnController.submitQuiz);

// ─── ASSIGNMENT ─────────────────────────────────────────────────────────────

router.get('/courses/:courseId/modules/:moduleId/assignment', ...studentAuth, checkInstitutionCourseAccess, learnController.assignment);
router.post('/courses/:courseId/modules/:moduleId/assignment/submit', ...studentAuth, checkInstitutionCourseAccess, learnController.submitAssignment);

// ─── FINAL EXAM ──────────────────────────────────────────────────────────────

router.get('/courses/:courseId/final-exam', ...studentAuth, checkInstitutionCourseAccess, learnController.finalExam);
router.post('/courses/:courseId/final-exam/submit', ...studentAuth, checkInstitutionCourseAccess, learnController.submitFinalExam);

// ─── FINAL PROJECT ───────────────────────────────────────────────────────────

router.get('/courses/:courseId/final-project', ...studentAuth, checkInstitutionCourseAccess, learnController.finalProject);
router.post('/courses/:courseId/final-project/submit', ...studentAuth, checkInstitutionCourseAccess, learnController.submitFinalProject);

module.exports = router;
