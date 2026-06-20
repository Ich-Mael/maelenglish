const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
    res.render('programs/language-learning/student-english-boost', {
        title: 'Student English Boost 2026 — Bourse d\'anglais AfroHK',
        ogTitle: 'Student English Boost 2026 — Bourse d\'anglais AfroHK',
        ogDescription: "Boostez votre anglais conversationnel en 1 mois intensif ! Grâce à la bourse AfroHK, profitez de 70% de réduction : ne payez que 15 000 FCFA au lieu de 50 000. 200 bourses pour les étudiants — places limitées, inscrivez-vous !",
        ogImage: '/assets/img/student_english_boost.JPG',
    });
});

module.exports = router;
