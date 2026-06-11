const express = require('express');
const router = express.Router();
const { isLoggedIn } = require('../../../shared/middlewares/auth');
const { isInstitutionAdmin, loadInstitution, isAfroHKAdmin } = require('../../../shared/middlewares/institutionAuth');

// Both institution-admin and AfroHK admins (for instructor management)
const adminOnly   = [isLoggedIn, isInstitutionAdmin, loadInstitution];
// AfroHK team only — institution admins may not create/edit content
const afroHKOnly  = [isLoggedIn, isAfroHKAdmin,      loadInstitution];

const courseController      = require('../controllers/admin/courseController');
const moduleController      = require('../controllers/admin/moduleController');
const gradingController     = require('../controllers/admin/gradingController');
const instructorController  = require('../controllers/admin/instructorController');

// ─── COURSE LIST (AfroHK only — institution admins have no business here) ─────

router.get('/', ...afroHKOnly, courseController.index);

// ─── COURSE CRUD (AfroHK only) ───────────────────────────────────────────────

router.get('/courses/new',        ...afroHKOnly, courseController.new);
router.post('/courses',           ...afroHKOnly, courseController.create);
router.get('/courses/:id',        ...adminOnly,  courseController.show);   // institution-admin needs this for instructor assignment
router.get('/courses/:id/edit',   ...afroHKOnly, courseController.edit);
router.put('/courses/:id',        ...afroHKOnly, courseController.update);
router.delete('/courses/:id',     ...afroHKOnly, courseController.destroy);
router.post('/courses/:id/toggle-active', ...afroHKOnly, courseController.toggleActive);

// ─── MODULE CRUD (AfroHK only) ───────────────────────────────────────────────

router.post('/courses/:courseId/modules',                       ...afroHKOnly, moduleController.create);
router.post('/courses/:courseId/modules/reorder',               ...afroHKOnly, moduleController.reorderModules);
router.get('/courses/:courseId/modules/:moduleId/edit',         ...afroHKOnly, moduleController.edit);
router.put('/courses/:courseId/modules/:moduleId',              ...afroHKOnly, moduleController.update);
router.delete('/courses/:courseId/modules/:moduleId',           ...afroHKOnly, moduleController.destroy);

// ─── LESSON CRUD (AfroHK only) ───────────────────────────────────────────────

router.post('/courses/:courseId/modules/:moduleId/lessons',                             ...afroHKOnly, moduleController.createLesson);
router.put('/courses/:courseId/modules/:moduleId/lessons/:lessonId',                    ...afroHKOnly, moduleController.updateLesson);
router.delete('/courses/:courseId/modules/:moduleId/lessons/:lessonId',                 ...afroHKOnly, moduleController.destroyLesson);
router.post('/courses/:courseId/modules/:moduleId/lessons/reorder',                     ...afroHKOnly, moduleController.reorderLessons);

// ─── LESSON PRACTICE QUIZ (AfroHK only) ─────────────────────────────────────

router.get('/courses/:courseId/modules/:moduleId/lessons/:lessonId/quiz',   ...afroHKOnly, moduleController.getPracticeQuizEditor);
router.post('/courses/:courseId/modules/:moduleId/lessons/:lessonId/quiz',  ...afroHKOnly, moduleController.savePracticeQuiz);

// ─── MODULE QUIZ + ASSIGNMENT (AfroHK only) ──────────────────────────────────

router.post('/courses/:courseId/modules/:moduleId/quiz',        ...afroHKOnly, moduleController.saveQuiz);
router.post('/courses/:courseId/modules/:moduleId/assignment',  ...afroHKOnly, moduleController.saveAssignment);

// ─── FINAL EXAM + PROJECT (AfroHK only) ─────────────────────────────────────

router.post('/courses/:id/final-exam',      ...afroHKOnly, courseController.saveFinalExam);
router.post('/courses/:id/final-project',   ...afroHKOnly, courseController.saveFinalProject);

// ─── INSTRUCTORS (institution-admin + AfroHK) ────────────────────────────────

router.get('/instructors',              ...adminOnly, instructorController.index);
router.get('/instructors/search',       ...adminOnly, instructorController.search);
router.post('/instructors',             ...adminOnly, instructorController.add);
router.get('/instructors/:id/edit',     ...adminOnly, instructorController.edit);
router.put('/instructors/:id',          ...adminOnly, instructorController.update);
router.delete('/instructors/:id',       ...adminOnly, instructorController.destroy);

// ─── COURSE INSTRUCTOR ASSIGNMENT (institution-admin + AfroHK) ───────────────

router.post('/courses/:courseId/instructors', ...adminOnly, instructorController.assignToCourse);

// ─── GRADING (AfroHK only — instructors use /institution/grade instead) ──────

router.get('/courses/:courseId/submissions',                                ...afroHKOnly, gradingController.submissions);
router.post('/courses/:courseId/assignments/:submissionId/grade',           ...afroHKOnly, gradingController.gradeAssignment);
router.post('/courses/:courseId/final-projects/:submissionId/grade',        ...afroHKOnly, gradingController.gradeFinalProject);

module.exports = router;
