const express = require('express');
const router = express.Router();

const kalanRoutes = require('./features/kalan/routes');

// Program home
router.get('/', (req, res) => {
    res.render('programs/ekalan/home');
});

// Mount kalan feature routes (100bac courses)
router.use('/kalan', kalanRoutes);

module.exports = router;

