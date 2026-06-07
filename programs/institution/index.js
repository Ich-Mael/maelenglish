const express = require('express');
const router = express.Router();

const adminContentRoutes = require('./routes/adminContent');
const studentLearnRoutes = require('./routes/studentLearn');

router.use('/dashboard/content', adminContentRoutes);
router.use('/learn', studentLearnRoutes);

module.exports = router;
