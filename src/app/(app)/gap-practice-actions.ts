"use server";

import { refresh } from "next/cache";
import { readCurrentUser } from "@/lib/auth/dal";
import { award, type Reward } from "@/lib/gamification/service";
import { dayKey } from "@/lib/gamification/rules";
import { GapPracticeError, isGapMode, submitPractice, vocabPractice } from "@/lib/gap-practice";

/* Fill the gaps with my expressions (The Vocabulary I Need and coachings). English messages. */

async function me() {
  const u = await readCurrentUser();
  if (!u) throw new GapPracticeError("Your session has expired: sign in again.");
  return u;
}
const fail = (e: unknown) => {
  if (!(e instanceof GapPracticeError)) console.error("[gap practice]", e);
  return { ok: false as const, error: e instanceof GapPracticeError ? e.message : "Something went wrong: try again in a moment." };
};

/** Sends the first check's answers: graded on the server, spaced review moved on, 10 XP once a day. */
export async function submitGapPracticeAction(practiceId: string, answers: Record<string, string>): Promise<{ ok: true; result: { score: number; stars: number; items: { id: string; correct: boolean }[]; reward: Reward | null } } | { ok: false; error: string }> {
  try {
    const u = await me();
    const r = await submitPractice({ id: u.id, role: u.role }, String(practiceId), answers && typeof answers === "object" ? answers : {});
    let reward: Reward | null = null;
    if (r.saved && r.total && !u.isStaff) reward = await award(u.id, [{ key: `gap-practice:${dayKey()}`, source: "gap_practice", amount: 10 }]).catch((e) => (console.error("award failed", e), null));
    return { ok: true, result: { score: r.score, stars: r.stars, items: r.items, reward } };
  } catch (e) {
    return fail(e);
  }
}

/** « New practice » (The Vocabulary I Need): another text with the learner's words. */
export async function newGapPracticeAction(mode: string): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    if (!isGapMode(mode)) throw new GapPracticeError("Choose sentences or a story.");
    await vocabPractice((await me()).id, mode, { fresh: true });
    refresh();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}
