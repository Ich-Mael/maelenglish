import { Types } from "mongoose";
import { StepProgress, WritingSubmission, type WritingSubmissionDoc } from "@/models";
import { aiServices, type WritingCorrection } from "@/lib/ai";
import { recordUsage } from "@/lib/ai/metering";
import { normalizeRich, plainText } from "@/lib/rich-text";
import type { WritingTaskContent } from "./types";

/*
 * Lab « writing task », reviewed by a coach (framework-free, tested in tests/writing.test.ts; owner
 * decision 2026-11-22): the learner sends a version → it is checked, an AI correction draft is made
 * at once (Claude Haiku 5.5, src/lib/ai/claude.ts; cost in AiUsage, kind llm) for the COACH only,
 * and the version waits for the coach (`coachStatus` pending). The coach edits the draft, adds a
 * comment and a score and sends it (`reviewWriting`): the learner sees it as their coach's feedback.
 * 3 sends per activity (one more when the coach asks for a new version after the last one).
 */

export const MAX_WRITING_SENDS = 3;
type Sends = { attempts?: number | null; extraAttempts?: number | null } | null | undefined;
export const writingSendsAllowed = (s: Sends) => MAX_WRITING_SENDS + (s?.extraAttempts ?? 0);
export const writingSendsLeft = (s: Sends) => Math.max(0, writingSendsAllowed(s) - (s?.attempts ?? 0));

export const wordCount = (text: string) => (text.trim().match(/[A-Za-zÀ-ÿ0-9'’-]+/g) ?? []).length;

export class WritingError extends Error {}

export type WritingTarget = { courseId: Types.ObjectId | string; moduleId?: unknown; unitId?: unknown; stepId: Types.ObjectId | string; activityId: Types.ObjectId | string; level: string; content: WritingTaskContent };

/** Checks the text against the activity's length (French message), returns it trimmed and its word count. */
function checkText(rawText: string, c: WritingTaskContent) {
  const text = rawText.replace(/\r/g, "").trim().slice(0, 4000);
  const n = wordCount(text);
  const atLeast = Math.max(5, Math.floor(c.minWords / 3));
  if (n < atLeast) throw new WritingError(`Écrivez au moins ${atLeast} mots avant d'envoyer votre texte (vous en avez ${n}).`);
  if (n > c.maxWords * 2) throw new WritingError(`Votre texte est trop long (${n} mots) : ${c.maxWords} mots au maximum.`);
  return { text, n };
}

/** The AI correction draft (null when the service fails or isn't configured: the coach corrects by hand). */
async function draftCorrection(userId: string, target: WritingTarget, text: string, now: Date): Promise<WritingCorrection | null> {
  const c = target.content;
  try {
    const result = await aiServices().feedback.correctWriting({ prompt: plainText(c.prompt), checklist: c.checklist, minWords: c.minWords, maxWords: c.maxWords, level: target.level, answer: text });
    await recordUsage(userId, { kind: "llm", feature: "writing_task", provider: result.usage.provider, tokens: result.usage.inputTokens + result.usage.outputTokens, costMicros: result.usage.costMicros }, now).catch((e) => console.error("[writing] usage", e));
    return { ...result.correction, score: Math.max(0, Math.min(100, Math.round(result.correction.score))) };
  } catch (e) {
    console.error("[writing] AI draft failed", e);
    return null;
  }
}

/** Staff preview (Lab page): the AI draft of a text, nothing saved. */
export async function previewCorrection(userId: string, target: WritingTarget, rawText: string, now = new Date()): Promise<WritingCorrection> {
  const { text } = checkText(rawText, target.content);
  const draft = await draftCorrection(userId, target, text, now);
  if (!draft) throw new WritingError("The AI correction failed or isn't configured (ANTHROPIC_API_KEY): try again later.");
  return draft;
}

/** The learner sends a version to their coach (with the AI draft for the coach). */
export async function sendWriting(userId: string, target: WritingTarget, rawText: string, now = new Date()): Promise<WritingSubmissionDoc> {
  const { text, n } = checkText(rawText, target.content);
  const existing = await WritingSubmission.findOne({ userId, stepId: target.stepId }).lean<WritingSubmissionDoc>();
  if (writingSendsLeft(existing) <= 0) throw new WritingError(`Vous avez envoyé vos ${writingSendsAllowed(existing)} versions pour cette activité : votre coach va lire la dernière.`);
  const correction = await draftCorrection(userId, target, text, now);
  const entry = { text, wordCount: n, score: correction?.score ?? 0, correction, at: now };
  const submission = await WritingSubmission.findOneAndUpdate(
    { userId, stepId: target.stepId },
    {
      $set: { courseId: target.courseId, moduleId: target.moduleId ?? null, unitId: target.unitId ?? null, activityId: target.activityId, text, wordCount: n, correction, aiScore: correction?.score ?? 0, submittedAt: now, coachStatus: "pending", redoAsked: false },
      $inc: { tries: 1, attempts: 1 },
      $push: { history: { $each: [entry], $slice: -10 } },
    },
    { upsert: true, returnDocument: "after" },
  ).lean<WritingSubmissionDoc>();
  return submission!;
}

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const list = <T>(v: unknown, n: number, map: (x: Record<string, unknown>) => T | null): T[] =>
  (Array.isArray(v) ? v : [])
    .slice(0, n)
    .map((x) => (x && typeof x === "object" ? map(x as Record<string, unknown>) : null))
    .filter((x): x is T => x !== null);

/** The coach's edited correction, cleaned (it comes from the review form). */
export function cleanFeedback(raw: unknown): WritingCorrection {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const score = Math.round(Number(r.score));
  return {
    score: Number.isFinite(score) ? Math.max(0, Math.min(100, score)) : 0,
    summary: str(r.summary, 1000),
    strengths: (Array.isArray(r.strengths) ? r.strengths : []).map((x) => str(x, 300)).filter(Boolean).slice(0, 6),
    errors: list(r.errors, 15, (e) => {
      const quote = str(e.quote, 300);
      const correction = str(e.correction, 300);
      return quote || correction ? { quote, correction, explanation: str(e.explanation, 400) } : null;
    }),
    checklist: list(r.checklist, 8, (c) => (str(c.item, 200) ? { item: str(c.item, 200), met: c.met === true, comment: str(c.comment, 300) } : null)),
    corrected: str(r.corrected, 6000),
  };
}

/**
 * The coach sends their feedback on the latest version: the edited correction, a comment (rich
 * text) and a score (the step's score). `askNewVersion`: the learner is asked to send a new
 * version (one more send granted if they had none left).
 */
export async function reviewWriting(graderId: string, submissionId: string, input: { feedback: unknown; comment?: string; askNewVersion?: boolean }, now = new Date()) {
  if (!Types.ObjectId.isValid(submissionId)) throw new WritingError("Invalid ID.");
  const sub = await WritingSubmission.findById(submissionId);
  if (!sub) throw new WritingError("Answer not found.");
  const feedback = cleanFeedback(input.feedback);
  const comment = normalizeRich(input.comment);
  if (!plainText(comment) && !feedback.summary && !feedback.errors.length) throw new WritingError("Write a comment or keep at least the summary for the learner.");
  sub.feedback = feedback;
  sub.coachComment = comment;
  sub.coachScore = feedback.score;
  sub.coachStatus = "reviewed";
  sub.redoAsked = !!input.askNewVersion;
  if (input.askNewVersion && writingSendsLeft(sub) <= 0) sub.extraAttempts = (sub.extraAttempts ?? 0) + 1;
  sub.reviewedBy = new Types.ObjectId(graderId);
  sub.reviewedAt = now;
  // This version's feedback stays in its history entry.
  const last = sub.history[sub.history.length - 1];
  if (last) {
    last.feedback = feedback;
    last.coachComment = comment;
    last.coachScore = feedback.score;
    last.reviewedAt = now;
    sub.markModified("history");
  }
  await sub.save();
  await StepProgress.updateOne({ userId: sub.userId, stepId: sub.stepId }, { $set: { score: feedback.score } });
  return sub.toObject() as WritingSubmissionDoc;
}
