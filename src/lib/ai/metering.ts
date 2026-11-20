import { Types } from "mongoose";
import { AiUsage, AppSettings, User, type AiKind } from "@/models";
import { dayKey } from "@/lib/gamification/rules";

/*
 * AI usage metering and monthly caps (DECISIONS.md « Metering »). Framework-free (tested in
 * tests/metering.test.ts). Seconds of audio (speech + conversation) count against the learner's
 * monthly AI minutes; LLM-only calls are recorded for cost but don't use minutes.
 */

export class AiQuotaError extends Error {
  constructor(public remainingSeconds: number) {
    super("Vous avez utilisé toutes vos minutes IA de ce mois-ci. Elles reviennent le 1er du mois prochain.");
    this.name = "AiQuotaError";
  }
}

const MINUTE_KINDS: readonly AiKind[] = ["stt", "pronunciation", "conversation"];

export const monthOf = (day: string) => day.slice(0, 7);

export async function recordUsage(
  userId: string,
  u: { kind: AiKind; feature: string; provider: string; seconds?: number; tokens?: number; costMicros?: number },
  now = new Date(),
) {
  const day = dayKey(now);
  await AiUsage.create({ userId: new Types.ObjectId(userId), ...u, day, month: monthOf(day) });
}

/** Seconds counted against the cap this month. */
export async function usedSecondsThisMonth(userId: string, now = new Date()): Promise<number> {
  const [row] = await AiUsage.aggregate<{ s: number }>([
    { $match: { userId: new Types.ObjectId(userId), month: monthOf(dayKey(now)), kind: { $in: MINUTE_KINDS } } },
    { $group: { _id: null, s: { $sum: "$seconds" } } },
  ]);
  return row?.s ?? 0;
}

/** Monthly allowance in seconds: the learner's override, else the global default. */
export async function monthlyCapSeconds(userId: string): Promise<number> {
  const u = await User.findById(userId).select("aiMonthlyMinutes").lean();
  if (u?.aiMonthlyMinutes != null) return u.aiMonthlyMinutes * 60;
  const s = await AppSettings.findOne({ key: "global" }).lean();
  return (s?.aiMonthlyMinutes ?? 60) * 60;
}

export async function remainingSeconds(userId: string, now = new Date()): Promise<number> {
  const [cap, used] = await Promise.all([monthlyCapSeconds(userId), usedSecondsThisMonth(userId, now)]);
  return Math.max(0, cap - used);
}

/** Throws AiQuotaError when the learner can't afford `seconds` more this month. */
export async function assertCanUse(userId: string, seconds: number, now = new Date()) {
  const left = await remainingSeconds(userId, now);
  if (left < seconds) throw new AiQuotaError(left);
}
