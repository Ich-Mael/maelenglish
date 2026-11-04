// MaelEnglish (ex « English Boost ») — mounted at /maelenglish in app.js.
// Old /maelenglish/... URLs are redirected by shared/routes/legacyEnglishRedirect.js.
const express = require('express');
const router = express.Router();
const languageController = require('./controllers/languageController');

const pecpRoutes = require('./routes/pecp');
const coursesRoutes = require('./routes/courses'); // course engine (ex General English Boost)

// Instructor routes
const instructorRoutes = require('./routes/instructor');
const adminInstructorRoutes = require('./routes/admin/instructors');
const adminResourceRoutes = require('./routes/admin/resources');

// Storefront
router.get('/', languageController.renderMaelEnglish);
router.use('/coaching', pecpRoutes);
router.use('/cours', coursesRoutes);

// English4Everyone was retired with the rebranding
router.get('/english4everyone', (req, res) => res.redirect(301, '/maelenglish'));

// Mount instructor routes
router.use('/instructor', instructorRoutes);
router.use('/admin/instructors', adminInstructorRoutes);
router.use('/admin/resources', adminResourceRoutes);

module.exports = router;
