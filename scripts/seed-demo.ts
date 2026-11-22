/**
 * Demo content for local testing:
 *   npm run seed:demo
 * Creates (or recreates) the course « MaelEnglish Professional English (démo) » from
 * scripts/seed/m1u1.json (owner spec COURSE_STRUCTURE.md §7: Module 1, Unit 1, 10 steps), a learner
 * enrolled in it (« demo »), a coach on it (« demo-coach ») and an admin (« demo-admin »);
 * password « anglais2026 » for all three. Only touches documents it created (courses titled
 * « … (démo) », Lab activities tagged « démo », the « demo » learner's progress).
 *
 * Seed format: steps in `position` order; an activity names its lesson with `lessonRef` (the
 * lesson's position), converted to `lessonId`. Activity types the Lab doesn't have yet are skipped
 * (logged), so the unit stays hidden from learners until they exist — as the unit rules require.
 */
import mongoose from "mongoose";
import { existsSync, readFileSync } from "node:fs";
import { Activity, ChallengeSubmission, Course, Enrollment, LabAttempt, LabMistake, Module, QuizAttempt, Step, StepProgress, Unit, User, UserBadge, UserStats, XpEvent } from "../src/models";
import { setPassword } from "../src/lib/auth/service";
import { cleanLessonContent } from "../src/lib/course/lesson-content";
import { isActivityType } from "../src/lib/lab/types";

for (const f of [".env.local", ".env"]) if (existsSync(f)) process.loadEnvFile(f); // .env.local wins (no override)

const uri = process.env.APP_DB;
if (!uri) throw new Error("APP_DB manquant (.env.local).");
if (/afrohk/i.test(uri)) {
  console.error("Refus : APP_DB pointe vers la base AfroHK. Utilisez une base MaelEnglish dédiée dans .env.local.");
  process.exit(1);
}

type SeedItem = { prompt: string; options?: string[]; answers: string[]; feedback: string };
type SeedStep = {
  position: number;
  kind: "lesson" | "activity" | "challenge";
  title: string;
  estimatedMinutes?: number;
  content?: unknown;
  lessonRef?: number;
  activityType?: string;
  instructions?: string;
  settings?: { maxPlays?: number; wordBank?: boolean };
  passScore?: number;
  items?: SeedItem[];
  prompt?: string;
  prepSeconds?: number;
  recordSeconds?: number;
  mustInclude?: string[];
  modelAnswer?: { text: string };
};
type Seed = {
  course: { title: string; description: string };
  module: { title: string; summary?: string; level?: "" | "A1" | "A2" | "B1" | "B2" | "C1"; units: { title: string; objectives: string[]; estimatedMinutes?: number; steps: SeedStep[] }[] };
};

const letter = (k: number) => String.fromCharCode(97 + k);
const nearest = <T extends number>(allowed: readonly T[], v: number) => allowed.reduce((a, b) => (Math.abs(b - v) < Math.abs(a - v) ? b : a));

/** Lab content for a seeded activity of a type that exists (`listen_choose`, `fill_gaps`, `listen_fill_gaps`, `sentence_builder`, `match_pairs` so far). */
function labContent(s: SeedStep): Record<string, unknown> | null {
  if (s.activityType === "match_pairs") {
    // Seed « matching » = situation (prompt) ↔ the right reply (answer) → Lab « match_pairs ».
    return { perScreen: 5, pairs: (s.items ?? []).map((it, i) => ({ id: `p${i + 1}`, left: it.prompt, right: it.answers[0] ?? "", explanation: it.feedback, audioMediaId: "" })) };
  }
  if (s.activityType === "sentence_builder") {
    // The seed gives shuffled tiles and the answer: each word of the answer becomes a tile.
    return {
      audioWhen: "after",
      items: (s.items ?? []).map((it, i) => ({ id: `s${i + 1}`, sentence: it.answers[0] ?? "", translation: "", distractors: [], alternatives: it.answers.slice(1), explanation: it.feedback, audioMediaId: "" })),
    };
  }
  if (s.activityType === "fill_gaps" || s.activityType === "listen_fill_gaps") {
    // One line per item, its « ___ » replaced by [answer|alternatives]; the options not used as answers become distractors.
    const items = s.items ?? [];
    const answers = new Set(items.flatMap((it) => it.answers));
    return {
      text: items.map((it) => it.prompt.replace("___", `[${it.answers.join("|")}]`)).join("\n"),
      explanations: items.map((it) => it.feedback),
      hint: "letters",
      wordBank: (s.settings as { wordBank?: boolean } | undefined)?.wordBank === true,
      distractors: [...new Set(items.flatMap((it) => it.options ?? []))].filter((o) => !answers.has(o)),
      typos: s.activityType === "fill_gaps", // listening: exact words (« manages », not « manage »)
      // Listen and fill the gaps: the audio is uploaded in the Lab (the activity stays a draft until then).
      ...(s.activityType === "listen_fill_gaps" ? { audioMediaId: "", audioDurationS: 0, context: "", maxPlays: [0, 2, 3].includes(s.settings?.maxPlays ?? 0) ? (s.settings?.maxPlays ?? 0) : 0 } : {}),
    };
  }
  if (s.activityType !== "listen_choose") return null;
  return {
    audioMediaId: "", // to upload in the Lab — the activity stays a draft until then
    audioDurationS: 0,
    context: "",
    transcript: "",
    maxPlays: [0, 2, 3].includes(s.settings?.maxPlays ?? 0) ? (s.settings?.maxPlays ?? 0) : 0,
    questions: (s.items ?? []).map((it, i) => {
      const options = (it.options ?? []).map((text, k) => ({ id: letter(k), text }));
      return { id: `q${i + 1}`, text: it.prompt, options, correctOptionId: options.find((o) => o.text === it.answers[0])?.id ?? "", explanation: it.feedback, startS: null };
    }),
  };
}

async function main() {
  await mongoose.connect(uri!);
  console.log(`Base : ${mongoose.connection.name}`);
  const seed = JSON.parse(readFileSync("scripts/seed/m1u1.json", "utf8")) as Seed;

  // Clean previous demo data.
  const oldIds = (await Course.find({ title: /\(démo\)$/ }).select("_id").lean()).map((c) => c._id);
  const oldSteps = (await Step.find({ courseId: { $in: oldIds } }).select("_id").lean()).map((s) => s._id);
  await Promise.all([
    XpEvent.deleteMany({ courseId: { $in: oldIds } }),
    Module.deleteMany({ courseId: { $in: oldIds } }),
    Unit.deleteMany({ courseId: { $in: oldIds } }),
    Step.deleteMany({ courseId: { $in: oldIds } }),
    StepProgress.deleteMany({ stepId: { $in: oldSteps } }),
    LabAttempt.deleteMany({ courseId: { $in: oldIds } }),
    LabMistake.deleteMany({ courseId: { $in: oldIds } }),
    QuizAttempt.deleteMany({ courseId: { $in: oldIds } }),
    ChallengeSubmission.deleteMany({ courseId: { $in: oldIds } }),
    Enrollment.deleteMany({ courseId: { $in: oldIds } }),
    Course.deleteMany({ _id: { $in: oldIds } }),
    Activity.deleteMany({ tags: "démo" }),
  ]);

  const course = await Course.create({ title: seed.course.title, description: seed.course.description, level: "beginner", isPublished: true });
  const mod = await Module.create({ courseId: course._id, order: 1, title: seed.module.title, summary: seed.module.summary ?? "", level: seed.module.level ?? "" });

  let created = 0;
  for (const [ui, u] of seed.module.units.entries()) {
    const unit = await Unit.create({ courseId: course._id, moduleId: mod._id, order: ui + 1, title: u.title, objectives: u.objectives, estimatedMinutes: u.estimatedMinutes ?? 0 });
    const lessonByRef = new Map<number, mongoose.Types.ObjectId>();
    let position = 0;
    for (const s of [...u.steps].sort((a, b) => a.position - b.position)) {
      const base = { courseId: course._id, moduleId: mod._id, unitId: unit._id, title: s.title, estimatedMinutes: s.estimatedMinutes ?? 0 };
      if (s.kind === "lesson") {
        const raw = (s.content ?? {}) as { intro?: string };
        const content = cleanLessonContent({ ...raw, intro: raw.intro ? `<p>${raw.intro}</p>` : "" });
        const step = await Step.create({ ...base, position: ++position, kind: "lesson", content });
        lessonByRef.set(s.position, step._id);
      } else if (s.kind === "activity") {
        // The seed's « matching » is the Lab's « match_pairs ».
        if (s.activityType === "matching") s.activityType = "match_pairs";
        const content = isActivityType(s.activityType) ? labContent(s) : null;
        if (!content) {
          console.log(`  · ignoré : « ${s.title} » (type ${s.activityType} pas encore dans le Labo)`);
          continue;
        }
        const gaps = s.activityType === "fill_gaps" || s.activityType === "sentence_builder" || s.activityType === "match_pairs"; // ready at once; the listening types wait for their audio
        const a = await Activity.create({ type: s.activityType as "listen_choose", title: s.title, level: seed.module.level ?? "", skills: gaps ? ["grammar"] : ["listening"], durationMin: s.estimatedMinutes ?? 0, instructions: s.instructions ?? "", tags: ["démo"], status: gaps ? "ready" : "draft", content });
        if (!gaps) console.log(`  · « ${s.title} » créée en brouillon : ajoutez l'audio dans le Labo, puis cochez « Ready ».`);
        await Step.create({ ...base, position: ++position, kind: "activity", activityId: a._id, lessonId: lessonByRef.get(s.lessonRef ?? -1) ?? null, passScore: s.passScore ?? 60 });
      } else {
        const a = await Activity.create({
          type: "speaking_challenge",
          title: s.title,
          level: seed.module.level ?? "",
          skills: ["speaking"],
          durationMin: s.estimatedMinutes ?? 0,
          tags: ["démo"],
          status: "ready",
          content: {
            instructions: `<p>${s.prompt ?? ""}</p>`,
            maxSeconds: nearest([30, 45, 60, 90, 120, 180] as const, s.recordSeconds ?? 60),
            prepSeconds: nearest([0, 10, 15, 30, 60] as const, s.prepSeconds ?? 0),
            mustInclude: s.mustInclude ?? [],
            modelAnswerText: s.modelAnswer?.text ?? "",
            modelAnswerAudioMediaId: "",
          },
        });
        await Step.create({ ...base, position: ++position, kind: "challenge", activityId: a._id });
      }
      created++;
    }
  }
  console.log(`${created} étape(s) créée(s) dans « ${seed.module.title} ».`);

  // ── Demo learner ────────────────────────────────────────────────────────
  let demo = await User.findOne({ username: "demo" });
  if (!demo) demo = await User.create({ name: "Awa", surname: "Démo", username: "demo", phoneNumber: "+226 70 00 00 00" });
  await setPassword(demo._id, "anglais2026");
  await Promise.all([StepProgress, QuizAttempt, ChallengeSubmission, LabAttempt, LabMistake, XpEvent, UserStats, UserBadge].map((M) => (M as typeof XpEvent).deleteMany({ userId: demo._id })));
  await Enrollment.create({ userId: demo._id, courseId: course._id, startDate: new Date() });

  // Staff demo accounts (only created if missing): an admin and a coach on the demo course.
  let admin = await User.findOne({ username: "demo-admin" });
  if (!admin) admin = await User.create({ name: "Mael", surname: "Admin", username: "demo-admin", email: "demo-admin@example.com", role: "admin", isVerified: true });
  await setPassword(admin._id, "anglais2026");
  let coach = await User.findOne({ username: "demo-coach" });
  if (!coach) coach = await User.create({ name: "Grace", surname: "Coach", username: "demo-coach", email: "demo-coach@example.com", role: "english-coach", isVerified: true });
  await setPassword(coach._id, "anglais2026");
  await Course.updateOne({ _id: course._id }, { $set: { instructors: [coach._id] } });

  console.log("Démo prête — mot de passe « anglais2026 » pour : demo (apprenant), demo-coach (coach), demo-admin (admin).");
  await mongoose.disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await mongoose.disconnect();
  process.exit(1);
});
