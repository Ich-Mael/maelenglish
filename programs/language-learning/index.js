const express = require('express');
const router = express.Router();

const english4AllRoutes = require('./routes/english4all');
const english4EveryoneRoutes = require('./routes/english4everyone');
const pecpRoutes = require('./routes/pecp');
const generalEnglishBoostRoutes = require('./routes/courses'); // Routes pour General English Boost

// Start of Language Learning Program
router.get('/', (req, res) => {
    res.send('Welcome to the Language Learning Program!');
});

router.use('/english4all', english4AllRoutes);
router.use('/english4everyone', english4EveryoneRoutes);
router.use('/pecp', pecpRoutes);
router.use('/general-english-boost', generalEnglishBoostRoutes);

module.exports = router;
