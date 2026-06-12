const express = require('express');
const router = express.Router();

const { isInstitutionAdmin, loadInstitution } = require('../middlewares/institutionAuth');
const Dashboard       = require('../controllers/institution/dashboardController');
const Students        = require('../controllers/institution/studentsController');
const Courses         = require('../controllers/institution/coursesController');
const Testimonials         = require('../controllers/institution/testimonialsController');
const Announcements        = require('../controllers/institution/announcementsController');
const EnrollmentRequests   = require('../controllers/institution/enrollmentRequestsController');

// Dashboard routes require institution-admin role + loaded institution
router.use('/dashboard', isInstitutionAdmin, loadInstitution);

// ─── DASHBOARD HOME ───────────────────────────────────────────────────────────
router.get('/dashboard', Dashboard.home);

// ─── SETTINGS ─────────────────────────────────────────────────────────────────
router.get('/dashboard/settings', Dashboard.settings);
router.put('/dashboard/settings', Dashboard.updateSettings);

// ─── COURSES ──────────────────────────────────────────────────────────────────
router.get('/dashboard/courses', Courses.index);
router.get('/dashboard/courses/:courseId', Courses.show);
router.get('/dashboard/courses/:courseId/export.csv', Courses.exportCsv);
router.post('/dashboard/courses/:courseId/enroll', Courses.enrollFromCourse);

// ─── TESTIMONIALS ─────────────────────────────────────────────────────────────
router.post('/dashboard/courses/:courseId/testimonials', Testimonials.create);
router.put('/dashboard/courses/:courseId/testimonials/:tid', Testimonials.togglePublished);
router.delete('/dashboard/courses/:courseId/testimonials/:tid', Testimonials.destroy);

// ─── STUDENTS ─────────────────────────────────────────────────────────────────
router.get('/dashboard/students', Students.index);
router.get('/dashboard/students/search', Students.search);  // must be before /:userId
router.get('/dashboard/students/:userId', Students.show);

// Create a new student account (and optionally enroll)
router.post('/dashboard/students/create', Students.createStudent);

// Enroll student in a course
router.post('/dashboard/students/:userId/enroll', Students.enroll);

// Bulk enroll multiple students in a course
router.post('/dashboard/enroll-bulk', Students.enrollBulk);

// Update enrollment dates
router.put('/dashboard/students/:userId/courses/:courseId', Students.updateEnrollment);

// Unenroll student from a course
router.delete('/dashboard/students/:userId/courses/:courseId', Students.unenroll);

// Resend activation email to unverified student
router.post('/dashboard/students/:userId/resend-activation', Students.resendActivation);

// ─── ANNOUNCEMENTS ────────────────────────────────────────────────────────────
router.get('/dashboard/announcements',                           Announcements.index);
router.post('/dashboard/announcements',                          Announcements.create);
router.post('/dashboard/announcements/:id/pin',                  Announcements.togglePin);
router.delete('/dashboard/announcements/:id',                    Announcements.destroy);

// ─── ENROLLMENT REQUESTS ──────────────────────────────────────────────────────
router.get('/dashboard/requests',               EnrollmentRequests.index);
router.put('/dashboard/requests/:id/status',    EnrollmentRequests.updateStatus);
router.delete('/dashboard/requests/:id',        EnrollmentRequests.destroy);

module.exports = router;
