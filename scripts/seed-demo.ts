/**
 * Demo content for local testing (until the admin screens of phase 6):
 *   npm run seed:demo
 * Creates (or recreates) two demo courses — « Aviation (démo) » with every
 * exercise type, and « Challenge Business (démo) » — and a learner enrolled in both:
 *   identifiant « demo », mot de passe « anglais2026 ».
 * Only touches documents it created (courses titled « … (démo) », user « demo »).
 */
import mongoose from "mongoose";
import { existsSync } from "node:fs";
import { AssignmentSubmission, Course, Enrollment, Lesson, LessonProgress, Module, QuizAttempt, User } from "../src/models";
import { setPassword } from "../src/lib/auth/service";

for (const f of [".env.local", ".env"]) if (existsSync(f)) process.loadEnvFile(f); // .env.local wins (no override)

const uri = process.env.APP_DB;
if (!uri) throw new Error("APP_DB manquant (.env.local).");
if (/afrohk/i.test(uri)) {
  console.error("Refus : APP_DB pointe vers la base AfroHK. Utilisez une base MaelEnglish dédiée dans .env.local.");
  process.exit(1);
}

const opts = (...texts: string[]) => texts.map((text, i) => ({ id: String.fromCharCode(97 + i), text }));
const q = (text: string, options: string[], correct: number, explanation = "") => ({
  text,
  options: opts(...options),
  correctOptionId: String.fromCharCode(97 + correct),
  explanation,
});

async function main() {
  await mongoose.connect(uri!);
  console.log(`Base : ${mongoose.connection.name}`);

  // Clean previous demo data.
  const old = await Course.find({ title: /\(démo\)$/ }).select("_id").lean();
  const oldIds = old.map((c) => c._id);
  await Promise.all([
    Module.deleteMany({ courseId: { $in: oldIds } }),
    Lesson.deleteMany({ courseId: { $in: oldIds } }),
    LessonProgress.deleteMany({ courseId: { $in: oldIds } }),
    QuizAttempt.deleteMany({ courseId: { $in: oldIds } }),
    AssignmentSubmission.deleteMany({ courseId: { $in: oldIds } }),
    Enrollment.deleteMany({ courseId: { $in: oldIds } }),
    Course.deleteMany({ _id: { $in: oldIds } }),
  ]);

  // ── Aviation (démo) ─────────────────────────────────────────────────────
  const aviation = await Course.create({
    title: "Aviation (démo)",
    description: "Cours de démonstration : toutes les étapes et tous les types d'exercices.",
    program: "aviation",
    level: "intermediate",
    isPublished: true,
    finalExam: {
      title: "Examen final — Aviation",
      passingScore: 70,
      timeLimit: 10,
      questions: [
        q("« Fasten your seatbelt » signifie :", ["Attachez votre ceinture", "Éteignez votre téléphone", "Restez assis"], 0),
        q("Le « boarding pass » est :", ["Le passeport", "La carte d'embarquement", "Le billet de train"], 1),
        q("« We are experiencing a slight delay » annonce :", ["Une annulation", "Un léger retard", "Un changement de porte"], 1),
        q("Le « runway » est :", ["La piste", "La cabine", "La soute"], 0),
      ],
    },
    finalProject: {
      title: "Votre annonce de bienvenue",
      instructions:
        "Enregistrez-vous en train de lire **votre propre annonce de bienvenue à bord** (30 secondes environ), déposez l'audio sur Google Drive ou WhatsApp Web, puis collez le lien ici.",
      submissionType: "link",
    },
  });

  const m1 = await Module.create({
    courseId: aviation._id,
    order: 1,
    title: "Welcome on board",
    summary: "Accueillir les passagers et faire les premières annonces.",
    quiz: {
      title: "Quiz : Welcome on board",
      passingScore: 70,
      questions: [
        q("Comment dit-on « Bienvenue à bord » ?", ["Welcome on board", "Welcome in plane", "Good board"], 0, "On dit « on board » pour « à bord »."),
        q("« Please remain seated » signifie :", ["Veuillez rester assis", "Veuillez vous lever", "Veuillez patienter"], 0),
        q("« Cabin crew » désigne :", ["Les pilotes", "Le personnel de cabine", "Les passagers"], 1),
      ],
    },
    assignment: {
      title: "Votre première annonce",
      instructions: "Écrivez **en anglais** une courte annonce de bienvenue (4 à 6 phrases) : nom de la compagnie, destination, durée du vol, consignes de sécurité.",
      submissionType: "text",
    },
  });

  const m2 = await Module.create({
    courseId: aviation._id,
    order: 2,
    title: "At the gate",
    summary: "Embarquement, retards et changements de porte.",
    quiz: {
      title: "Quiz : At the gate",
      passingScore: 70,
      questions: [
        q("« Gate » se traduit par :", ["Porte d'embarquement", "Guichet", "Bagage"], 0),
        q("« The flight is delayed » :", ["Le vol est annulé", "Le vol est retardé", "Le vol est complet"], 1),
      ],
    },
  });

  const m3 = await Module.create({ courseId: aviation._id, order: 3, title: "Safety first", summary: "Les consignes de sécurité." });

  const lesson = (moduleId: mongoose.Types.ObjectId, order: number, data: Record<string, unknown>) =>
    Lesson.create({ courseId: aviation._id, moduleId, order, ...data });

  await lesson(m1._id, 1, {
    title: "Les annonces à bord",
    type: "text",
    description: "Le vocabulaire des premières minutes du vol.",
    content: [
      "## Bienvenue à bord !",
      "Les premières annonces suivent toujours le même schéma : **saluer**, **présenter le vol**, puis **donner les consignes**.",
      "",
      "| Anglais | Français |",
      "|---|---|",
      "| Welcome on board | Bienvenue à bord |",
      "| Fasten your seatbelt | Attachez votre ceinture |",
      "| Cabin crew | Personnel de cabine |",
      "| Flight time | Durée du vol |",
      "",
      "> Astuce : parlez lentement et articulez — les passagers ne sont pas tous anglophones.",
      "",
      "### Exemple",
      "*Good morning ladies and gentlemen, welcome on board this flight to Paris. Our flight time today will be five hours.*",
    ].join("\n"),
  });

  await lesson(m1._id, 2, {
    title: "Pratique : à bord",
    type: "practice",
    exercises: [
      { kind: "choice", text: "Welcome on board!", prompt: "Que signifie cette phrase ?", options: opts("Bienvenue à bord !", "Bon voyage !", "Embarquement immédiat !"), correctOptionId: "a" },
      { kind: "build", text: "Please fasten your seatbelt", translation: "Veuillez attacher votre ceinture", distractors: ["close", "the"] },
      { kind: "match", pairs: [{ left: "pilot", right: "pilote" }, { left: "runway", right: "piste" }, { left: "seat", right: "siège" }, { left: "luggage", right: "bagages" }] },
      { kind: "gap", text: "Our flight ___ today is five hours.", translation: "La durée de notre vol aujourd'hui est de cinq heures.", answers: ["time"] },
      { kind: "listen", text: "Please remain seated.", answers: ["Please remain seated"] },
      { kind: "order", prompt: "Remettez l'annonce dans l'ordre", items: ["Good morning, ladies and gentlemen.", "Welcome on board this flight to Paris.", "Please fasten your seatbelt.", "We wish you a pleasant flight."] },
      { kind: "speak", text: "Welcome on board this flight to Paris.", translation: "Bienvenue à bord de ce vol pour Paris." },
    ],
  });

  await lesson(m2._id, 1, {
    title: "Retards et changements de porte",
    type: "text",
    content: "## À la porte d'embarquement\n\n- **Boarding** : l'embarquement\n- **Delay** : un retard\n- **Gate change** : un changement de porte\n\n*We are experiencing a slight delay due to the weather.*",
  });
  await lesson(m2._id, 2, {
    title: "Pratique : à la porte",
    type: "practice",
    exercises: [
      { kind: "choice", text: "Boarding will begin at gate 3.", prompt: "Où commence l'embarquement ?", options: opts("Porte 3", "Terminal 3", "Dans 3 minutes"), correctOptionId: "a" },
      { kind: "build", text: "The flight is delayed", translation: "Le vol est retardé", distractors: ["cancel"] },
      { kind: "gap", text: "Please proceed to ___ 12.", translation: "Veuillez vous rendre à la porte 12.", answers: ["gate"] },
    ],
  });
  await lesson(m3._id, 1, {
    title: "Pratique : sécurité",
    type: "practice",
    exercises: [
      { kind: "match", pairs: [{ left: "life jacket", right: "gilet de sauvetage" }, { left: "oxygen mask", right: "masque à oxygène" }, { left: "emergency exit", right: "sortie de secours" }] },
      { kind: "speak", text: "In case of emergency, follow the lights to the exit." },
    ],
  });

  // ── Challenge Business (démo) ───────────────────────────────────────────
  const challenge = await Course.create({
    title: "Challenge Business (démo)",
    description: "Une mission par jour, validée par un coach.",
    program: "business",
    isPublished: true,
    isChallenge: true,
    challenge: { themeLabel: "Anglais des réunions" },
  });
  const days = [
    { title: "Se présenter en réunion", text: "Hello everyone, I'm in charge of sales." },
    { title: "Proposer un ordre du jour", text: "Let's go over the agenda for today's meeting." },
    { title: "Conclure une réunion", text: "Thank you all, let's wrap up here." },
  ];
  for (const [i, d] of days.entries()) {
    const day = await Module.create({
      courseId: challenge._id,
      order: i + 1,
      title: d.title,
      isCheckpointRequired: true,
      assignment: { title: `Mission du jour ${i + 1}`, instructions: `Écrivez 3 phrases en anglais pour : **${d.title.toLowerCase()}**.`, submissionType: "text" },
    });
    await Lesson.create({
      courseId: challenge._id,
      moduleId: day._id,
      order: 1,
      title: `Échauffement : ${d.title}`,
      type: "practice",
      exercises: [
        { kind: "speak", text: d.text },
        { kind: "build", text: d.text.replace(/[.,!?]/g, "") },
      ],
    });
  }

  // ── Demo learner ────────────────────────────────────────────────────────
  let demo = await User.findOne({ username: "demo" });
  if (!demo) demo = await User.create({ name: "Awa", surname: "Démo", username: "demo", phoneNumber: "+226 70 00 00 00" });
  await setPassword(demo._id, "anglais2026");
  await Promise.all([LessonProgress.deleteMany({ userId: demo._id }), QuizAttempt.deleteMany({ userId: demo._id }), AssignmentSubmission.deleteMany({ userId: demo._id })]);
  await Enrollment.create({ userId: demo._id, courseId: aviation._id, startDate: new Date() });
  await Enrollment.create({ userId: demo._id, courseId: challenge._id, startDate: new Date(Date.now() - 2 * 86400_000) });

  console.log("Démo prête : identifiant « demo », mot de passe « anglais2026 ».");
  await mongoose.disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await mongoose.disconnect();
  process.exit(1);
});
