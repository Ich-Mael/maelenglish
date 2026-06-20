const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
    res.render('programs/language-learning/student-english-boost', {
        title: 'Student English Boost 2026 — Bourse d\'anglais AfroHK',
        ogTitle: 'Student English Boost 2026 — Bourse d\'anglais AfroHK',
        ogDescription: "200 bourses pour transformer votre anglais ! Rejoignez Student English Boost 2026 : une formation intensive d'un mois en anglais conversationnel, réservée aux étudiants. Places limitées — saisissez votre chance et inscrivez-vous dès maintenant !",
        ogImage: '/assets/img/student_english_boost.JPG',
    });
});

module.exports = router;
