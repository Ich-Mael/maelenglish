const express = require('express');
const router  = express.Router();

const { isInstitutionStudent, loadPortalInstitution } = require('../middlewares/institutionAuth');
const Portal = require('../controllers/institution/portalController');

// All routes require authentication
router.use(isInstitutionStudent);

// ─── INSTITUTION PORTAL ───────────────────────────────────────────────────────
// Per-institution branded portal — access derived from enrollment, not institutionId
router.get('/:institutionId/portal', loadPortalInstitution, Portal.show);

module.exports = router;
