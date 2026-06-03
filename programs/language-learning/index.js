const express = require('express');
const router = express.Router();

const english4AllRoutes = require('./routes/english4all');
const english4EveryoneRoutes = require('./routes/english4everyone');
const pecpRoutes = require('./routes/pecp');
const generalEnglishBoostRoutes = require('./routes/courses'); // Routes pour General English Boost
const studentEnglishBoostRoutes = require('./routes/student-english-boost');

// Instructor routes
const instructorRoutes = require('./routes/instructor');
const adminInstructorRoutes = require('./routes/admin/instructors');
const adminResourceRoutes = require('./routes/admin/resources');

// Start of Language Learning Program
router.get('/', (req, res) => {
    res.send('Welcome to the Language Learning Program!');
});

router.use('/english4all', english4AllRoutes);
router.use('/english4everyone', english4EveryoneRoutes);
router.use('/pecp', pecpRoutes);
router.use('/general-english-boost', generalEnglishBoostRoutes);
router.use('/student-english-boost', studentEnglishBoostRoutes);

// Mount instructor routes
router.use('/instructor', instructorRoutes);
router.use('/admin/instructors', adminInstructorRoutes);
router.use('/admin/resources', adminResourceRoutes);

module.exports = router;
