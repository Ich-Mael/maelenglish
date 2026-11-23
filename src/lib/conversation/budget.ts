import { ADMIN_ROLES, AiUsage, AppSettings, DigestLog, User } from "@/models";
import { monthOf } from "@/lib/ai/metering";
import { dayKey } from "@/lib/gamification/rules";
import { sendAiBudgetEmail } from "@/lib/email";

/*
 * Platform-wide Talk with Coach Ish budget (owner decision 2026-11-23): the ElevenLabs plan gives a
 * fixed number of credits a month, shared by every learner. From the plan's credits and the
 * credits a call minute uses, the app knows the minutes in the pool and the real cost of a minute;
 * admins are emailed once a month at `warnPercent`, and new calls stop at `stopPercent` (before
 * ElevenLabs runs out mid-call for everyone). Framework-free (tests/conversation.test.ts).
 */

export type Budget = { planCredits: number; creditsPerMinute: number; planPriceUsd: number; warnPercent: number; stopPercent: number };
export const DEFAULT_BUDGET: Budget = { planCredits: 0, creditsPerMinute: 455, planPriceUsd: 0, warnPercent: 80, stopPercent: 95 };

export async function loadBudget(): Promise<Budget> {
  const s = await AppSettings.findOne({ key: "global" }).select("conversationBudget").lean();
  return { ...DEFAULT_BUDGET, ...(s?.conversationBudget ?? {}) } as Budget;
}

export class BudgetError extends Error {}

export async function saveBudget(raw: { planCredits?: unknown; creditsPerMinute?: unknown; planPriceUsd?: unknown; warnPercent?: unknown; stopPercent?: unknown }): Promise<Budget> {
  const num = (v: unknown) => Number(String(v ?? "").replace(/[\s,]/g, ""));
  const b: Budget = {
    planCredits: Math.round(num(raw.planCredits) || 0),
    creditsPerMinute: num(raw.creditsPerMinute) || DEFAULT_BUDGET.creditsPerMinute,
    planPriceUsd: Math.round((num(raw.planPriceUsd) || 0) * 100) / 100,
    warnPercent: Math.round(num(raw.warnPercent) || DEFAULT_BUDGET.warnPercent),
    stopPercent: Math.round(num(raw.stopPercent) || DEFAULT_BUDGET.stopPercent),
  };
  if (b.planCredits < 0 || b.planCredits > 100_000_000) throw new BudgetError("Enter the plan's monthly credits (0 = no budget).");
  if (b.creditsPerMinute < 1 || b.creditsPerMinute > 10_000) throw new BudgetError("Credits per minute: between 1 and 10,000.");
  if (b.planPriceUsd < 0 || b.planPriceUsd > 100_000) throw new BudgetError("Enter the plan's monthly price in US dollars.");
  if (b.warnPercent < 1 || b.stopPercent > 100 || b.warnPercent >= b.stopPercent) throw new BudgetError("The warning must come before the stop (e.g. 80 % and 95 %).");
  await AppSettings.updateOne({ key: "global" }, { $set: { conversationBudget: b } }, { upsert: true });
  return b;
}

/** Real cost of a call minute in micro-USD (plan price ÷ minutes in the plan), or null without a plan price. */
export const microsPerMinute = (b: Budget) => (b.planCredits > 0 && b.planPriceUsd > 0 ? Math.round((b.planPriceUsd * 1_000_000 * b.creditsPerMinute) / b.planCredits) : null);
export const poolMinutes = (b: Budget) => (b.planCredits > 0 ? b.planCredits / b.creditsPerMinute : 0);

export type BudgetState = {
  configured: boolean;
  budget: Budget;
  poolMinutes: number;
  usedMinutes: number;
  /** 0–100+ of the pool used this month. */
  percent: number;
  level: "off" | "ok" | "warn" | "stopped";
  /** Seconds left before the stop threshold (Infinity without a budget). */
  secondsLeft: number;
  microsPerMinute: number | null;
};

export async function budgetState(now = new Date()): Promise<BudgetState> {
  const budget = await loadBudget();
  const [row] = await AiUsage.aggregate<{ s: number }>([{ $match: { month: monthOf(dayKey(now)), kind: "conversation" } }, { $group: { _id: null, s: { $sum: "$seconds" } } }]);
  const usedMinutes = (row?.s ?? 0) / 60;
  const pool = poolMinutes(budget);
  if (!pool) return { configured: false, budget, poolMinutes: 0, usedMinutes, percent: 0, level: "off", secondsLeft: Infinity, microsPerMinute: null };
  const percent = (usedMinutes / pool) * 100;
  const secondsLeft = Math.max(0, Math.floor((pool * (budget.stopPercent / 100) - usedMinutes) * 60));
  const level = percent >= budget.stopPercent || secondsLeft < 60 ? "stopped" : percent >= budget.warnPercent ? "warn" : "ok";
  return { configured: true, budget, poolMinutes: pool, usedMinutes, percent, level, secondsLeft, microsPerMinute: microsPerMinute(budget) };
}

/** After a call: emails the admins once a month when the warning (then the stop) threshold is crossed. */
export async function alertIfNeeded(now = new Date()) {
  const st = await budgetState(now);
  if (st.level !== "warn" && st.level !== "stopped") return;
  const key = `ai-budget-${st.level}:${monthOf(dayKey(now))}`;
  try {
    await DigestLog.create({ key, sentAt: now });
  } catch {
    return; // already sent this month
  }
  const admins = await User.find({ role: { $in: ADMIN_ROLES }, isActive: { $ne: false }, email: { $exists: true, $ne: null } }).select("email").lean();
  const to = admins.map((a) => a.email).filter((e): e is string => !!e);
  if (to.length) await sendAiBudgetEmail(to, { percent: Math.round(st.percent), usedMinutes: Math.round(st.usedMinutes), poolMinutes: Math.round(st.poolMinutes), stopped: st.level === "stopped", stopPercent: st.budget.stopPercent });
}
