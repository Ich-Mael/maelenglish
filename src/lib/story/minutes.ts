import { Types } from "mongoose";
import { AiUsage, AppSettings, StoryEntitlement } from "@/models";
import type { LoadedSeason } from "./content";

/*
 * Story Mode voice minutes and pricing (owner decisions 2026-11-23). Each season includes
 * `aiMinutesIncluded` minutes of conversation per learner (+ staff-added `extraMinutes`): the
 * episodes' Talk with Coach Ish role-play calls, recorded in AiUsage with `ref` = « story:<slug> »
 * (they don't use the monthly Talk with Coach Ish minutes). Once used up, the conversation can't be
 * started (« Continue anyway » lets the learner go on). Scene audio is shared by everyone (cached):
 * a content cost, not the learner's.
 */

export const storyRef = (slug: string) => `story:${slug}`;
/** Story voice minutes = the episodes' role-play calls (Talk with Coach Ish). */
const VOICE_KINDS = ["conversation"];

export { MINUTES_PER_EPISODE, DEFAULT_PRICING, suggestedPriceFcfa, voicingChars, type StoryPricing } from "./pricing";
import { DEFAULT_PRICING, MINUTES_PER_EPISODE, suggestedPriceFcfa, voicingChars, type StoryPricing } from "./pricing";
import { budgetState } from "@/lib/conversation/budget";

export async function pricingSettings(): Promise<StoryPricing> {
  const s = await AppSettings.findOne({ key: "global" }).select("storyPricing").lean();
  return { ...DEFAULT_PRICING, ...((s?.storyPricing as Partial<StoryPricing> | undefined) ?? {}) };
}

export async function savePricingSettings(raw: Partial<Record<keyof StoryPricing, unknown>>) {
  const cur = await pricingSettings();
  const next = { ...cur };
  for (const k of Object.keys(DEFAULT_PRICING) as (keyof StoryPricing)[]) {
    const v = Number(raw[k]);
    if (raw[k] !== undefined && raw[k] !== "" && Number.isFinite(v) && v >= 0) next[k] = v;
  }
  await AppSettings.updateOne({ key: "global" }, { $set: { storyPricing: next } }, { upsert: true });
  return next;
}

/** Real cost of a story conversation minute over the last 30 days (story calls + their debriefs ÷ minutes), or null with too little data. */
export async function measuredCostPerMinute(now = new Date()): Promise<{ usd: number; minutes: number } | null> {
  const since = new Date(now.getTime() - 30 * 86_400_000);
  const [row] = await AiUsage.aggregate<{ cost: number; seconds: number }>([
    { $match: { ref: { $regex: /^story:/ }, createdAt: { $gte: since } } },
    { $group: { _id: null, cost: { $sum: "$costMicros" }, seconds: { $sum: { $cond: [{ $in: ["$kind", VOICE_KINDS] }, "$seconds", 0] } } } },
  ]);
  if (!row || row.seconds < 30 * 60) return null;
  return { usd: row.cost / 1e6 / (row.seconds / 60), minutes: Math.round(row.seconds / 60) };
}

/** The « Pricing » card of a season. */
export async function seasonEstimate(s: LoadedSeason) {
  const [pricing, measured, pool] = await Promise.all([pricingSettings(), measuredCostPerMinute(), budgetState()]);
  // Measured on story calls, else the ElevenLabs plan's real cost per minute (Talk with Coach Ish budget), else the setting.
  const planPerMin = pool.microsPerMinute !== null ? pool.microsPerMinute / 1e6 : null;
  const costPerMin = measured?.usd ?? planPerMin ?? pricing.convUsdPerMin;
  const episodes = s.chapterList.reduce((n, c) => n + c.episodeList.length, 0);
  const margin = s.marginPct ?? pricing.defaultMarginPct;
  return {
    pricing,
    costPerMin,
    costSource: measured ? `measured on ${measured.minutes} min of story calls` : planPerMin !== null ? "ElevenLabs plan (Talk with Coach Ish budget)" : "pricing settings",
    episodes,
    typicalMinutes: Math.round(episodes * MINUTES_PER_EPISODE),
    aiCostUsd: s.aiMinutesIncluded * costPerMin,
    margin,
    suggestedFcfa: suggestedPriceFcfa(s.aiMinutesIncluded, costPerMin, margin, pricing.usdToFcfa),
    voicingUsd: (voicingChars(s) / 1000) * pricing.ttsUsdPerKChar,
  };
}

// ── A learner's pot ──────────────────────────────────────────────────────

export async function storySecondsUsed(userId: string, slug: string): Promise<number> {
  const [row] = await AiUsage.aggregate<{ s: number }>([
    { $match: { userId: new Types.ObjectId(userId), ref: storyRef(slug), kind: { $in: VOICE_KINDS } } },
    { $group: { _id: null, s: { $sum: "$seconds" } } },
  ]);
  return row?.s ?? 0;
}

export type VoiceMinutes = { usedS: number; allowanceS: number; leftS: number };

/** The learner's voice minutes in a season (null for staff: never limited). */
export async function voiceMinutes(viewer: { id: string; isStaff: boolean }, s: Pick<LoadedSeason, "id" | "aiMinutesIncluded">): Promise<VoiceMinutes | null> {
  if (viewer.isStaff) return null;
  const [used, ent] = await Promise.all([storySecondsUsed(viewer.id, s.id), StoryEntitlement.findOne({ userId: viewer.id, storyId: s.id }).select("extraMinutes").lean()]);
  const allowanceS = Math.round((s.aiMinutesIncluded + (ent?.extraMinutes ?? 0)) * 60);
  return { usedS: Math.round(used), allowanceS, leftS: Math.max(0, allowanceS - Math.round(used)) };
}

