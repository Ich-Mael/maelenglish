"use server";

import { refresh } from "next/cache";
import { readCurrentUser } from "@/lib/auth/dal";
import type { StageKey } from "@/lib/story/progress";
import { StoryError, contentAudio, continueAnyway, deleteFact, markIntroSeen, markRecapSeen, recordVideo, saveProfile, type Viewer } from "@/lib/story/service";

/* Story Mode actions (signed-in learners and staff). Every one re-checks access in the service. English messages. */

type Fail = { ok: false; error: string };
async function viewer(): Promise<Viewer> {
  const u = await readCurrentUser();
  if (!u) throw new StoryError("Your session has expired: sign in again.");
  return { id: u.id, isStaff: u.isStaff };
}
const fail = (e: unknown): Fail => {
  if (!(e instanceof StoryError)) console.error("[story action]", e);
  return { ok: false, error: e instanceof StoryError ? e.message : "Something went wrong: try again in a moment." };
};
async function run<T>(fn: (v: Viewer) => Promise<T>, doRefresh = false): Promise<({ ok: true } & T) | Fail> {
  try {
    const r = await fn(await viewer());
    if (doRefresh) refresh();
    return { ok: true, ...r };
  } catch (e) {
    return fail(e);
  }
}

export async function saveProfileAction(input: { characterName: string; job: string; country: string; avatar: unknown; pacePerWeek: number }) {
  return run(async (v) => (await saveProfile(v.id, input), {}), true);
}
export async function introSeenAction(storyId: string, episodeId: string) {
  return run(async (v) => (await markIntroSeen(v, storyId, episodeId), {}));
}
export async function recapSeenAction(storyId: string) {
  return run(async (v) => (await markRecapSeen(v, storyId), {}));
}
export async function videoAction(storyId: string, episodeId: string, maxSeconds: number) {
  return run((v) => recordVideo(v, storyId, episodeId, maxSeconds));
}
export async function continueAnywayAction(storyId: string, episodeId: string, stage: StageKey) {
  return run((v) => continueAnyway(v, storyId, episodeId, stage));
}
export async function audioAction(storyId: string, episodeId: string, ref: string) {
  return run(async (v) => ({ url: await contentAudio(v, storyId, episodeId, ref) }));
}
export async function deleteFactAction(key: string) {
  return run(async (v) => (await deleteFact(v.id, key), {}), true);
}
