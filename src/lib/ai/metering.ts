import { Types } from "mongoose";
import { AiTopUp, AiUsage, AppSettings, User, type AiKind } from "@/models";
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
  u: { kind: AiKind; feature: string; provider: string; seconds?: number; tokens?: number; costMicros?: number; ref?: string },
  now = new Date(),
) {
  const day = dayKey(now);
  await AiUsage.create({ userId: new Types.ObjectId(userId), ...u, day, month: monthOf(day) });
  // Seconds beyond the monthly allowance come out of bought minutes (oldest first).
  if (MINUTE_KINDS.includes(u.kind) && !u.ref && u.seconds) {
    const [cap, used] = await Promise.all([monthlyCapSeconds(userId), usedSecondsThisMonth(userId, now)]);
    const over = Math.min(u.seconds, Math.max(0, used - cap));
    if (over > 0) await consumeTopUps(userId, over, now);
  }
}

/** Bought minutes still valid (seconds). */
export async function topUpSeconds(userId: string, now = new Date()): Promise<number> {
  const [row] = await AiTopUp.aggregate<{ s: number }>([{ $match: { userId: new Types.ObjectId(userId), expiresAt: { $gt: now }, secondsLeft: { $gt: 0 } } }, { $group: { _id: null, s: { $sum: "$secondsLeft" } } }]);
  return row?.s ?? 0;
}

async function consumeTopUps(userId: string, seconds: number, now: Date) {
  let left = seconds;
  const packs = await AiTopUp.find({ userId, expiresAt: { $gt: now }, secondsLeft: { $gt: 0 } }).sort({ expiresAt: 1 });
  for (const p of packs) {
    if (left <= 0) break;
    const take = Math.min(left, p.secondsLeft);
    p.secondsLeft -= take;
    left -= take;
    await p.save();
  }
}

/** Seconds counted against the cap this month. */
export async function usedSecondsThisMonth(userId: string, now = new Date()): Promise<number> {
  const [row] = await AiUsage.aggregate<{ s: number }>([
    // Story Mode rows (`ref`) use their season's own pot, not the monthly minutes.
    { $match: { userId: new Types.ObjectId(userId), month: monthOf(dayKey(now)), kind: { $in: MINUTE_KINDS }, ref: { $in: [null, ""] } } },
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

/** Monthly minutes left plus bought minutes still valid. */
export async function remainingSeconds(userId: string, now = new Date()): Promise<number> {
  const [cap, used, bought] = await Promise.all([monthlyCapSeconds(userId), usedSecondsThisMonth(userId, now), topUpSeconds(userId, now)]);
  return Math.max(0, cap - used) + bought;
}

/** Throws AiQuotaError when the learner can't afford `seconds` more this month. */
export async function assertCanUse(userId: string, seconds: number, now = new Date()) {
  const left = await remainingSeconds(userId, now);
  if (left < seconds) throw new AiQuotaError(left);
}

// ── Admin report ──────────────────────────────────────────────────────────

export type UsageRow = { userId: string; name: string; username: string; seconds: number; costMicros: number; calls: number };

/** Month totals per learner (most expensive first) and per day (last `days` days). */
export async function usageReport(now = new Date(), days = 14) {
  const month = monthOf(dayKey(now));
  const since = dayKey(new Date(now.getTime() - (days - 1) * 86_400_000));
  const [perUser, perDay, settings] = await Promise.all([
    AiUsage.aggregate<{ _id: Types.ObjectId; seconds: number; costMicros: number; calls: number }>([
      { $match: { month } },
      { $group: { _id: "$userId", seconds: { $sum: { $cond: [{ $in: ["$kind", MINUTE_KINDS] }, "$seconds", 0] } }, costMicros: { $sum: "$costMicros" }, calls: { $sum: 1 } } },
      { $sort: { costMicros: -1, seconds: -1 } },
      { $limit: 100 },
    ]),
    AiUsage.aggregate<{ _id: string; seconds: number; costMicros: number; calls: number }>([
      { $match: { day: { $gte: since } } },
      { $group: { _id: "$day", seconds: { $sum: { $cond: [{ $in: ["$kind", MINUTE_KINDS] }, "$seconds", 0] } }, costMicros: { $sum: "$costMicros" }, calls: { $sum: 1 } } },
      { $sort: { _id: -1 } },
    ]),
    AppSettings.findOne({ key: "global" }).lean(),
  ]);
  const persona = { tone: settings?.persona?.tone ?? "", catchphrases: settings?.persona?.catchphrases ?? [], tips: settings?.persona?.tips ?? [] };
  const users = await User.find({ _id: { $in: perUser.map((r) => r._id) } }).select("name surname username").lean();
  const byId = new Map(users.map((u) => [String(u._id), u]));
  const rows: UsageRow[] = perUser.map((r) => {
    const u = byId.get(String(r._id));
    return { userId: String(r._id), name: u ? `${u.name} ${u.surname}` : "Compte supprimé", username: u?.username ?? "", seconds: r.seconds, costMicros: r.costMicros, calls: r.calls };
  });
  return {
    month,
    defaultMinutes: settings?.aiMonthlyMinutes ?? 60,
    persona,
    rows,
    days: perDay.map((d) => ({ day: d._id, seconds: d.seconds, costMicros: d.costMicros, calls: d.calls })),
  };
}

/** Coach Ish persona (spec AIC-07), edited on the AI usage page. */
export async function savePersona(raw: { tone?: string; catchphrases?: string; tips?: string }) {
  const lines = (v: string | undefined, n: number) => (v ?? "").split("\n").map((x) => x.trim().slice(0, 300)).filter(Boolean).slice(0, n);
  const persona = { tone: (raw.tone ?? "").trim().slice(0, 1000), catchphrases: lines(raw.catchphrases, 10), tips: lines(raw.tips, 15) };
  await AppSettings.updateOne({ key: "global" }, { $set: { persona } }, { upsert: true });
  return persona;
}

export async function setDefaultMonthlyMinutes(minutes: number) {
  if (!Number.isFinite(minutes) || minutes < 0 || minutes > 10000) throw new Error("Indiquez un nombre de minutes entre 0 et 10 000.");
  await AppSettings.updateOne({ key: "global" }, { $set: { aiMonthlyMinutes: Math.round(minutes) } }, { upsert: true });
}
