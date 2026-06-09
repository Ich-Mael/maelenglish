const express = require('express');
const router = express.Router();
const { isLoggedIn } = require('../../../shared/middlewares/auth');
const { isInstitutionInstructor, loadInstructorInstitution } = require('../../../shared/middlewares/institutionAuth');
const gradingController = require('../controllers/instructor/gradingController');

const instructorOnly = [isLoggedIn, isInstitutionInstructor, loadInstructorInstitution];

router.get('/',                                                  ...instructorOnly, gradingController.home);
router.get('/courses/:courseId/submissions',                     ...instructorOnly, gradingController.courseSubmissions);
router.post('/courses/:courseId/assignments/:submissionId',      ...instructorOnly, gradingController.gradeAssignment);
router.post('/courses/:courseId/final-projects/:submissionId',   ...instructorOnly, gradingController.gradeFinalProject);

module.exports = router;
