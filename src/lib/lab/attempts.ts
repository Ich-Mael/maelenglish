import { Types } from "mongoose";
import { LabAttempt, LabMistake } from "@/models";
import type { ItemResult } from "./grade";

/* Records a finished Lab attempt and updates the learner's mistake bank (framework-free, tested). */

export type AttemptRecord = {
  userId: string;
  courseId: string | Types.ObjectId;
  stepId: string | Types.ObjectId;
  activityId: string | Types.ObjectId;
  type: string;
  score: number;
  stars: number;
  bonus: number;
  timeSpentS: number;
  plays: number;
  items: ItemResult[];
  answers: Readonly<Record<string, unknown>>;
};

export async function recordAttempt(a: AttemptRecord) {
  const base = { userId: new Types.ObjectId(a.userId), activityId: new Types.ObjectId(String(a.activityId)) };
  await LabAttempt.create({
    ...base,
    courseId: a.courseId,
    stepId: a.stepId,
    type: a.type,
    score: a.score,
    stars: a.stars,
    bonus: a.bonus,
    timeSpentS: Math.max(0, Math.min(6 * 3600, Math.round(a.timeSpentS))),
    plays: Math.max(0, Math.round(a.plays)),
    items: a.items.map((i) => ({ itemId: i.id, correct: i.correct, answer: a.answers[i.id] ?? null })),
  });
  const now = new Date();
  await Promise.all(
    a.items.map((i) =>
      i.correct
        ? LabMistake.updateOne({ ...base, itemId: i.id }, { $set: { resolved: true } })
        : LabMistake.updateOne(
            { ...base, itemId: i.id },
            { $set: { courseId: a.courseId, stepId: a.stepId, lastWrongAt: now, resolved: false }, $inc: { count: 1 } },
            { upsert: true },
          ),
    ),
  );
}
