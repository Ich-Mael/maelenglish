const express = require('express');
const router = express.Router();

const adminContentRoutes  = require('./routes/adminContent');
const studentLearnRoutes  = require('./routes/studentLearn');
const instructorGradeRoutes = require('./routes/instructorGrade');

router.use('/dashboard/content', adminContentRoutes);
router.use('/learn', studentLearnRoutes);
router.use('/grade', instructorGradeRoutes);

module.exports = router;
