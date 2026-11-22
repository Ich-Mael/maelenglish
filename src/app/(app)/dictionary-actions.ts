"use server";

import { readCurrentUser } from "@/lib/auth/dal";
import { DictionaryError, hasWord, lookup, removeWord, reviewWord, saveWord, type WordEntry } from "@/lib/dictionary";
import { refresh } from "next/cache";

/*
 * Dictionary & « My Notebook » actions (signed-in users, learners and staff). Errors come back as
 * English messages (English UI for new features, owner decision 2026-11-22).
 */

async function me() {
  const u = await readCurrentUser();
  if (!u) throw new DictionaryError("Your session has expired: sign in again.");
  return u;
}
const fail = (e: unknown) => ({ ok: false as const, error: e instanceof DictionaryError ? e.message : "The dictionary is unavailable: try again in a moment." });

/** `context`: the sentence the word was tapped in (gives its meaning there). */
export async function lookupWordAction(word: string, context = ""): Promise<{ ok: true; entry: WordEntry; saved: boolean } | { ok: false; error: string }> {
  try {
    const u = await me();
    const entry = await lookup(u.id, word, context);
    return { ok: true, entry, saved: await hasWord(u.id, entry.word) };
  } catch (e) {
    if (!(e instanceof DictionaryError)) console.error("[dictionary] lookup", e);
    return fail(e);
  }
}

/** Saves a word; `where` = the page it was found on (a step URL gives the course and step). */
export async function saveWordAction(word: string, context: string, where: string, translation = ""): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const u = await me();
    const m = where.match(/^\/apprendre\/([a-f0-9]{24})\/etapes\/([a-f0-9]{24})/);
    await saveWord(u.id, word, { context, translation, courseId: m?.[1] ?? null, stepId: m?.[2] ?? null });
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function removeWordAction(word: string): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const u = await me();
    await removeWord(u.id, word);
    refresh();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function reviewWordAction(word: string, known: boolean): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const u = await me();
    await reviewWord(u.id, word, known);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}
