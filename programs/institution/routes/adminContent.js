const express = require('express');
const router = express.Router();
const { isLoggedIn, checkRoles } = require('../../../shared/middlewares/auth');
const { isInstitutionAdmin, loadInstitution } = require('../../../shared/middlewares/institutionAuth');

const adminOnly = [isLoggedIn, isInstitutionAdmin, loadInstitution];

const courseController      = require('../controllers/admin/courseController');
const moduleController      = require('../controllers/admin/moduleController');
const gradingController     = require('../controllers/admin/gradingController');
const instructorController  = require('../controllers/admin/instructorController');

// ─── COURSE CRUD ─────────────────────────────────────────────────────────────

router.get('/', ...adminOnly, courseController.index);
router.get('/courses/new', ...adminOnly, courseController.new);
router.post('/courses', ...adminOnly, courseController.create);
router.get('/courses/:id', ...adminOnly, courseController.show);
router.get('/courses/:id/edit', ...adminOnly, courseController.edit);
router.put('/courses/:id', ...adminOnly, courseController.update);
router.delete('/courses/:id', ...adminOnly, courseController.destroy);

// ─── MODULE CRUD ─────────────────────────────────────────────────────────────

router.post('/courses/:courseId/modules', ...adminOnly, moduleController.create);
router.get('/courses/:courseId/modules/:moduleId/edit', ...adminOnly, moduleController.edit);
router.put('/courses/:courseId/modules/:moduleId', ...adminOnly, moduleController.update);
router.delete('/courses/:courseId/modules/:moduleId', ...adminOnly, moduleController.destroy);

// ─── LESSON CRUD ─────────────────────────────────────────────────────────────

router.post('/courses/:courseId/modules/:moduleId/lessons', ...adminOnly, moduleController.createLesson);
router.put('/courses/:courseId/modules/:moduleId/lessons/:lessonId', ...adminOnly, moduleController.updateLesson);
router.delete('/courses/:courseId/modules/:moduleId/lessons/:lessonId', ...adminOnly, moduleController.destroyLesson);
router.post('/courses/:courseId/modules/:moduleId/lessons/reorder', ...adminOnly, moduleController.reorderLessons);

// ─── LESSON PRACTICE QUIZ ───────────────────────────────────────────────────

router.get('/courses/:courseId/modules/:moduleId/lessons/:lessonId/quiz', ...adminOnly, moduleController.getPracticeQuizEditor);
router.post('/courses/:courseId/modules/:moduleId/lessons/:lessonId/quiz', ...adminOnly, moduleController.savePracticeQuiz);

// ─── MODULE QUIZ + ASSIGNMENT ────────────────────────────────────────────────

router.post('/courses/:courseId/modules/:moduleId/quiz', ...adminOnly, moduleController.saveQuiz);
router.post('/courses/:courseId/modules/:moduleId/assignment', ...adminOnly, moduleController.saveAssignment);

// ─── FINAL EXAM + PROJECT ────────────────────────────────────────────────────

router.post('/courses/:id/final-exam', ...adminOnly, courseController.saveFinalExam);
router.post('/courses/:id/final-project', ...adminOnly, courseController.saveFinalProject);

// ─── INSTRUCTORS ─────────────────────────────────────────────────────────────

router.get('/instructors',              ...adminOnly, instructorController.index);
router.get('/instructors/search',       ...adminOnly, instructorController.search);
router.post('/instructors',             ...adminOnly, instructorController.add);
router.get('/instructors/:id/edit',     ...adminOnly, instructorController.edit);
router.put('/instructors/:id',          ...adminOnly, instructorController.update);
router.delete('/instructors/:id',       ...adminOnly, instructorController.destroy);

// ─── COURSE INSTRUCTOR ASSIGNMENT ───────────────────────────────────────────

router.post('/courses/:courseId/instructors', ...adminOnly, instructorController.assignToCourse);

// ─── GRADING ─────────────────────────────────────────────────────────────────

router.get('/courses/:courseId/submissions', ...adminOnly, gradingController.submissions);
router.post('/courses/:courseId/assignments/:submissionId/grade', ...adminOnly, gradingController.gradeAssignment);
router.post('/courses/:courseId/final-projects/:submissionId/grade', ...adminOnly, gradingController.gradeFinalProject);

module.exports = router;
