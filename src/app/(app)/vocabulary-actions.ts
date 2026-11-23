"use server";

import { refresh } from "next/cache";
import { readCurrentUser } from "@/lib/auth/dal";
import { award, type Reward } from "@/lib/gamification/service";
import { dayKey } from "@/lib/gamification/rules";
import type { SentenceCheck } from "@/lib/ai/types";
import { VocabError, deleteSentence, recordTest, saveDailyWord, setProfession, writeSentence } from "@/lib/vocabulary";

/* « The Vocabulary I Need » (signed-in learners and staff). English messages. */

async function me() {
  const u = await readCurrentUser();
  if (!u) throw new VocabError("Your session has expired: sign in again.");
  return u;
}
const fail = (e: unknown) => ({ ok: false as const, error: e instanceof VocabError ? e.message : "Something went wrong: try again in a moment." });

export async function setProfessionAction(profession: string): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await setProfession((await me()).id, profession);
    refresh();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function saveDailyWordAction(word: string): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await saveDailyWord((await me()).id, word);
    refresh();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function writeSentenceAction(word: string, text: string): Promise<{ ok: true; result: SentenceCheck } | { ok: false; error: string }> {
  try {
    const result = await writeSentence((await me()).id, word, text);
    refresh();
    return { ok: true, result };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteSentenceAction(word: string, sentenceId: string): Promise<{ ok: boolean }> {
  try {
    await deleteSentence((await me()).id, word, sentenceId);
    refresh();
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

/** A finished test: the server checks every answer, moves each word on, and gives 10 XP once a day (staff: nothing saved as progress, XP neither). */
export async function finishTestAction(answers: { word: string; kind: string; answer: string }[]): Promise<{ ok: true; right: number; total: number; score: number; results: { word: string; correct: boolean }[]; reward: Reward | null } | { ok: false; error: string }> {
  try {
    const u = await me();
    const r = await recordTest(u.id, Array.isArray(answers) ? answers.map((a) => ({ word: String(a.word ?? ""), kind: String(a.kind ?? ""), answer: String(a.answer ?? "").slice(0, 100) })) : []);
    let reward: Reward | null = null;
    if (r.total && !u.isStaff) {
      reward = await award(u.id, [{ key: `vocab-test:${dayKey()}`, source: "vocab_test", amount: 10 }]).catch((e) => (console.error("award failed", e), null));
    }
    refresh();
    return { ok: true, right: r.right, total: r.total, score: r.score, results: r.results.map(({ word, correct }) => ({ word, correct })), reward };
  } catch (e) {
    return fail(e);
  }
}
