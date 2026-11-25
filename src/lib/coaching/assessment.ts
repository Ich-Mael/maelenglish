import { Types } from "mongoose";
import { CoachingAssessment, CoachingAssessmentAnswer, Media, type CoachingAssessmentAnswerDoc, type CoachingAssessmentDoc, type CoachingDoc } from "@/models";
import { CoachingError, openCoaching, type Viewer } from "./service";

/*
 * Speaking assessment at the start and the end of a coaching (owner decision 2026-11-25): the same
 * prompts twice (the end copies the start's by default, so the two can be compared), each member
 * records one answer per prompt and sends them; the coach listens and scores 5 criteria out of 10
 * with a comment. The progress view and the monthly report show start → end per member.
 * Framework-free (tests/coaching-assessment.test.ts).
 */

export const PHASES = ["start", "end"] as const;
export type Phase = (typeof PHASES)[number];
export const CRITERIA = ["fluency", "vocabulary", "grammar", "pronunciation", "clarity"] as const;
export type Criterion = (typeof CRITERIA)[number];
export type Scores = Record<Criterion, number | null>;
export const MIN_PROMPTS = 2;
export const MAX_PROMPTS = 5;

/** Ready-made prompts (French instructions; the answer is in English). The coach edits them. */
export const DEFAULT_PROMPTS = [
  "Présentez-vous en anglais : votre nom, votre poste et ce que vous faites au quotidien.",
  "Racontez une situation récente au travail où vous avez eu besoin de l'anglais. Qu'est-ce qui était facile ? Difficile ?",
  "Pourquoi suivez-vous ce coaching ? Expliquez ce que vous voulez être capable de faire à la fin.",
];

export const isPhase = (p: unknown): p is Phase => PHASES.includes(p as Phase);
const phaseOf = (p: unknown): Phase => {
  if (!isPhase(p)) throw new CoachingError("Not found.");
  return p;
};
const oid = (id: string) => {
  if (!Types.ObjectId.isValid(id)) throw new CoachingError("Not found.");
  return new Types.ObjectId(id);
};

/** The overall score: the average of the criteria scored (one decimal), null when none. */
export function overall(s: Partial<Scores> | null | undefined): number | null {
  const xs = CRITERIA.map((c) => s?.[c]).filter((x): x is number => typeof x === "number");
  return xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : null;
}

/** The coach sets up (or edits, while nobody answered) the assessment of a phase. */
export async function setupAssessment(v: Viewer, coachingId: string, rawPhase: string, raw: { prompts?: unknown; maxSeconds?: unknown }) {
  const phase = phaseOf(rawPhase);
  const { coaching, role } = await openCoaching(v, coachingId);
  if (role !== "coach") throw new CoachingError("Only the coach can do this.");
  const lines = String(raw.prompts ?? "")
    .split("\n")
    .map((l) => l.replace(/\s+/g, " ").trim().slice(0, 400))
    .filter(Boolean)
    .slice(0, MAX_PROMPTS);
  if (lines.length < MIN_PROMPTS) throw new CoachingError(`Write at least ${MIN_PROMPTS} prompts, one per line.`);
  const maxSeconds = Math.min(300, Math.max(30, Math.round(Number(raw.maxSeconds) || 90)));
  const existing = await CoachingAssessment.findOne({ coachingId: coaching._id, phase });
  if (existing && (await CoachingAssessmentAnswer.exists({ assessmentId: existing._id, "answers.0": { $exists: true } }))) throw new CoachingError("Someone already answered: the prompts can't change any more.");
  const prompts = lines.map((text, i) => ({ id: `p${i + 1}`, text }));
  const a = await CoachingAssessment.findOneAndUpdate({ coachingId: coaching._id, phase }, { $set: { prompts, maxSeconds }, $setOnInsert: { createdBy: new Types.ObjectId(v.id) } }, { upsert: true, returnDocument: "after" }).lean<CoachingAssessmentDoc>();
  return { assessment: a!, coaching, created: !existing };
}

/** The prompts to suggest when setting up a phase: the end reuses the start's. */
export async function suggestedPrompts(coachingId: Types.ObjectId, phase: Phase) {
  if (phase === "end") {
    const start = await CoachingAssessment.findOne({ coachingId, phase: "start" }).lean<CoachingAssessmentDoc>();
    if (start?.prompts.length) return { prompts: start.prompts.map((p) => p.text), maxSeconds: start.maxSeconds ?? 90 };
  }
  return { prompts: DEFAULT_PROMPTS, maxSeconds: 90 };
}

async function forMember(v: Viewer, coachingId: string, rawPhase: string) {
  const phase = phaseOf(rawPhase);
  const { coaching, role } = await openCoaching(v, coachingId);
  if (role !== "member") throw new CoachingError("Only the people coached take the assessment.");
  const assessment = await CoachingAssessment.findOne({ coachingId: coaching._id, phase }).lean<CoachingAssessmentDoc>();
  if (!assessment) throw new CoachingError("This assessment isn't open yet.");
  return { phase, coaching, assessment };
}

/** A member records (or re-records, until they send) their answer to one prompt. */
export async function answerPrompt(v: Viewer, coachingId: string, rawPhase: string, promptId: string, mediaId: string) {
  const { phase, coaching, assessment } = await forMember(v, coachingId, rawPhase);
  if (!assessment.prompts.some((p) => p.id === promptId)) throw new CoachingError("Question not found.");
  const m = Types.ObjectId.isValid(mediaId) ? await Media.findOne({ _id: mediaId, ownerId: v.id, kind: "recording", status: "ready" }).lean() : null;
  if (!m) throw new CoachingError("Recording not found: record it again.");
  const prev = await CoachingAssessmentAnswer.findOne({ assessmentId: assessment._id, userId: v.id });
  if (prev?.submittedAt) throw new CoachingError("Already sent to your coach.");
  const answers = [...(prev?.answers ?? []).filter((a) => a.promptId !== promptId), { promptId, mediaId: m._id, durationS: m.durationS ?? 0, at: new Date() }];
  await CoachingAssessmentAnswer.updateOne({ assessmentId: assessment._id, userId: new Types.ObjectId(v.id) }, { $set: { answers, coachingId: coaching._id, phase } }, { upsert: true });
  return { answered: answers.length, total: assessment.prompts.length };
}

/** A member sends their answers (every prompt answered). */
export async function submitAssessment(v: Viewer, coachingId: string, rawPhase: string) {
  const { coaching, assessment } = await forMember(v, coachingId, rawPhase);
  const a = await CoachingAssessmentAnswer.findOne({ assessmentId: assessment._id, userId: v.id });
  if (a?.submittedAt) return { coaching, answer: a.toObject() as CoachingAssessmentAnswerDoc };
  const missing = assessment.prompts.filter((p) => !(a?.answers ?? []).some((x) => x.promptId === p.id));
  if (!a || missing.length) throw new CoachingError(`Answer every question first (${missing.length} left).`);
  a.submittedAt = new Date();
  await a.save();
  return { coaching, answer: a.toObject() as CoachingAssessmentAnswerDoc };
}

/** The coach scores a sent assessment (0–10 per criterion, at least one) with a comment. */
export async function reviewAssessment(v: Viewer, answerId: string, raw: Partial<Record<Criterion, unknown>> & { comment?: unknown }) {
  const a = await CoachingAssessmentAnswer.findById(oid(answerId));
  if (!a) throw new CoachingError("Assessment not found.");
  const { coaching, role } = await openCoaching(v, String(a.coachingId));
  if (role !== "coach") throw new CoachingError("Only the coach can do this.");
  if (!a.submittedAt) throw new CoachingError("Not sent yet.");
  const scores = Object.fromEntries(
    CRITERIA.map((c) => {
      const x = raw[c];
      const n = x === "" || x == null ? null : Math.round(Number(x));
      return [c, n == null || !Number.isFinite(n) ? null : Math.max(0, Math.min(10, n))];
    }),
  ) as Scores;
  if (overall(scores) == null) throw new CoachingError("Give at least one score.");
  a.set("scores", scores);
  a.comment = String(raw.comment ?? "").replace(/\r/g, "").trim().slice(0, 3000);
  a.reviewedAt = new Date();
  a.reviewedBy = new Types.ObjectId(v.id);
  await a.save();
  return { coaching, answer: a.toObject() as CoachingAssessmentAnswerDoc };
}

export type AssessmentRow = {
  userId: string;
  answers: { promptId: string; mediaId: string; durationS: number }[];
  submitted: boolean;
  reviewed: boolean;
  id: string | null;
  scores: Scores | null;
  overall: number | null;
  comment: string;
};

/**
 * Both phases for a coaching page: the prompts and, per member (a member: only themselves), their
 * answers and review. Media ids are returned; the page signs them after this access check.
 */
export async function assessmentsFor(v: Viewer, coachingId: string) {
  const { coaching, role } = await openCoaching(v, coachingId);
  const members = role === "member" ? [v.id] : (coaching.memberIds ?? []).map(String);
  const [list, answers] = await Promise.all([
    CoachingAssessment.find({ coachingId: coaching._id }).lean<CoachingAssessmentDoc[]>(),
    CoachingAssessmentAnswer.find({ coachingId: coaching._id, userId: { $in: members.map((m) => new Types.ObjectId(m)) } }).lean<CoachingAssessmentAnswerDoc[]>(),
  ]);
  const phase = (p: Phase) => {
    const a = list.find((x) => x.phase === p) ?? null;
    const rows: AssessmentRow[] = members.map((m) => {
      const r = a ? answers.find((x) => String(x.assessmentId) === String(a._id) && String(x.userId) === m) : undefined;
      const reviewed = !!r?.reviewedAt;
      return {
        userId: m,
        answers: (r?.answers ?? []).map((x) => ({ promptId: x.promptId, mediaId: String(x.mediaId), durationS: x.durationS ?? 0 })),
        submitted: !!r?.submittedAt,
        reviewed,
        id: r ? String(r._id) : null,
        scores: reviewed ? (r!.scores as Scores) : null,
        overall: reviewed ? overall(r!.scores as Scores) : null,
        comment: reviewed ? (r!.comment ?? "") : "",
      };
    });
    return { assessment: a ? { prompts: a.prompts.map((x) => ({ id: x.id, text: x.text })), maxSeconds: a.maxSeconds ?? 90 } : null, rows };
  };
  return { coaching, role, start: phase("start"), end: phase("end") };
}

/** Start → end overall scores per member (reviewed only), for the progress view and the report. */
export async function levelsFor(coaching: Pick<CoachingDoc, "_id">, memberIds: string[]) {
  const rows = await CoachingAssessmentAnswer.find({ coachingId: coaching._id, userId: { $in: memberIds.map((m) => new Types.ObjectId(m)) }, reviewedAt: { $ne: null } }).select("userId phase scores").lean<CoachingAssessmentAnswerDoc[]>();
  return Object.fromEntries(
    memberIds.map((m) => {
      const of = (p: Phase) => {
        const r = rows.find((x) => String(x.userId) === m && x.phase === p);
        return r ? { overall: overall(r.scores as Scores), scores: r.scores as Scores } : null;
      };
      return [m, { start: of("start"), end: of("end") }];
    }),
  ) as Record<string, { start: { overall: number | null; scores: Scores } | null; end: { overall: number | null; scores: Scores } | null }>;
}
