const express = require('express');
const router = express.Router();

const { isInstitutionAdmin, loadInstitution } = require('../middlewares/institutionAuth');
const Dashboard = require('../controllers/institution/dashboardController');
const Students = require('../controllers/institution/studentsController');
const Courses = require('../controllers/institution/coursesController');

// All routes require institution-admin role + loaded institution
router.use(isInstitutionAdmin, loadInstitution);

// ─── DASHBOARD HOME ───────────────────────────────────────────────────────────
router.get('/dashboard', Dashboard.home);

// ─── COURSES ──────────────────────────────────────────────────────────────────
router.get('/dashboard/courses', Courses.index);
router.get('/dashboard/courses/:courseId', Courses.show);
router.get('/dashboard/courses/:courseId/export.csv', Courses.exportCsv);

// ─── STUDENTS ─────────────────────────────────────────────────────────────────
router.get('/dashboard/students', Students.index);
router.get('/dashboard/students/search', Students.search);  // must be before /:userId
router.get('/dashboard/students/:userId', Students.show);

// Enroll student in a course
router.post('/dashboard/students/:userId/enroll', Students.enroll);

// Bulk enroll multiple students in a course
router.post('/dashboard/enroll-bulk', Students.enrollBulk);

// Unenroll student from a course
router.delete('/dashboard/students/:userId/courses/:courseId', Students.unenroll);

module.exports = router;
