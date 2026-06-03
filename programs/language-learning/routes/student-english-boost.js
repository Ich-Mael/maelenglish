const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
    res.render('programs/language-learning/student-english-boost');
});

module.exports = router;
