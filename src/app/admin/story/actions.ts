"use server";

import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { actorOf, staffOrThrow } from "@/lib/admin/context";
import { can } from "@/lib/admin/permissions";
import { errorMessage } from "@/lib/admin/errors";
import * as story from "@/lib/story/admin";
import { savePricingSettings } from "@/lib/story/minutes";
import { ttsCached } from "@/lib/story/service";

/* Story Mode admin actions (English). Admins manage seasons; coaches / instructors edit content. */

type State = { error?: string; success?: string; data?: Record<string, string> } | undefined;
type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
function message(e: unknown) {
  if (e instanceof story.StoryAdminError) return e.message;
  try {
    return errorMessage(e);
  } catch {
    console.error("[story admin]", e);
    return "Something went wrong: try again in a moment.";
  }
}

async function staff(need: "manage" | "edit") {
  const me = await staffOrThrow();
  const a = actorOf(me);
  if (!(need === "manage" ? can.manageStory(a) : can.editStory(a))) throw new story.StoryAdminError(need === "manage" ? "Only admins do this." : "You can't edit Story Mode.");
  return me;
}
async function run<T extends object>(need: "manage" | "edit", fn: () => Promise<T>): Promise<Result<T>> {
  try {
    await staff(need);
    const r = await fn();
    refresh();
    return { ok: true, ...r };
  } catch (e) {
    return { ok: false, error: message(e) };
  }
}

export async function createSeasonAction(_: State, form: FormData): Promise<State> {
  let id: string;
  try {
    await staff("manage");
    id = await story.createSeason({ slug: str(form, "slug"), title: str(form, "title"), city: str(form, "city"), country: str(form, "country"), learningGoal: str(form, "learningGoal"), level: str(form, "level") });
  } catch (e) {
    return { error: message(e) };
  }
  redirect(`/admin/story/${id}`);
}

export async function importSeasonAction(_: State, form: FormData): Promise<State> {
  let id: string;
  try {
    await staff("manage");
    const file = form.get("file");
    const text = file instanceof Blob && file.size ? await file.text() : str(form, "json");
    if (!text) return { error: "Choose a .json file or paste its content." };
    if (text.length > 2_000_000) return { error: "This file is too big." };
    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch {
      return { error: "This isn't valid JSON." };
    }
    const me = await staffOrThrow();
    id = (await story.importSeason(raw, { replace: form.get("replace") === "on", actorId: me.id })).id;
  } catch (e) {
    return { error: message(e) };
  }
  redirect(`/admin/story/${id}`);
}

export async function saveSeasonAction(id: string, section: story.SeasonSection, data: unknown) {
  return run(section === "sale" ? "manage" : "edit", async () => ({ problems: await story.saveSeason(id, section, data) }));
}
export async function setSeasonStatusAction(id: string, status: "draft" | "published") {
  return run("manage", async () => (await story.setSeasonStatus(id, status), {}));
}
export async function deleteSeasonAction(id: string): Promise<Result> {
  try {
    await staff("manage");
    await story.deleteSeason(id);
  } catch (e) {
    return { ok: false, error: message(e) };
  }
  redirect("/admin/story");
}
export async function copyCharactersAction(targetId: string, sourceId: string) {
  return run("edit", async () => ({ added: await story.copyCharacters(targetId, sourceId) }));
}
export async function createEpisodeAction(seasonId: string, title: string, chapterId: string): Promise<Result> {
  let id: string;
  try {
    await staff("edit");
    id = await story.createEpisode(seasonId, { title, chapterId });
  } catch (e) {
    return { ok: false, error: message(e) };
  }
  redirect(`/admin/story/${seasonId}/episodes/${id}`);
}
export async function saveEpisodeAction(id: string, content: unknown, chapterId: string) {
  return run("edit", async () => ({ problems: await story.saveEpisode(id, { content, chapterId }) }));
}
/** « Create a conversation for this episode » → the new Lab role-play (to finish in the Lab). */
export async function createEpisodeRolePlayAction(episodeId: string) {
  return run("edit", async () => {
    const me = await staffOrThrow();
    return { activityId: await story.createEpisodeRolePlay(episodeId, me.id) };
  });
}
export async function setEpisodeStatusAction(id: string, status: "draft" | "ready") {
  return run("edit", async () => (await story.setEpisodeStatus(id, status), {}));
}
export async function reorderEpisodesAction(seasonId: string, items: { id: string; chapterId: string }[]) {
  return run("edit", async () => (await story.reorderEpisodes(seasonId, items), {}));
}
export async function duplicateEpisodeAction(id: string) {
  return run("edit", async () => ({ id: await story.duplicateEpisode(id) }));
}
export async function deleteEpisodeAction(id: string) {
  return run("edit", async () => (await story.deleteEpisode(id), {}));
}
export async function savePricingSettingsAction(data: Record<string, unknown>) {
  return run("manage", async () => ({ pricing: await savePricingSettings(data) }));
}
/** ▶ in the editors: the line in that character's voice (cached, the same audio learners will hear). */
export async function previewVoiceAction(voiceId: string, text: string): Promise<Result<{ url: string | null }>> {
  try {
    await staff("edit");
    const t = String(text ?? "").slice(0, 600);
    return { ok: true, url: (await ttsCached(String(voiceId ?? ""), t))?.url ?? null };
  } catch (e) {
    return { ok: false, error: e instanceof story.StoryAdminError ? e.message : "Voice preview unavailable." };
  }
}
