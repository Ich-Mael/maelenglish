import type { Episode } from "./schema";
import type { LoadedSeason } from "./content";

/*
 * Story Mode content checks (pure, browser + server): shown live in the admin editors, and
 * required to be empty to mark an episode « ready » / publish a season.
 */

/**
 * Problems of one episode inside its season (pure). `refs` = what the server found for the picked
 * unit and role-play (null = not checked here, e.g. in the browser before saving).
 */
export function episodeProblems(
  season: Pick<LoadedSeason, "characters" | "locations" | "chapterList">,
  e: Episode,
  chapterId?: string,
  refs?: { unitSteps: number | null; rolePlay: "ready" | "draft" | "missing" | null } | null,
): string[] {
  const p: string[] = [];
  const chars = new Set(season.characters.map((c) => c.id));
  if (chapterId && !season.chapterList.some((c) => c.id === chapterId)) p.push(`Unknown chapter « ${chapterId} ».`);
  if (!e.title.trim()) p.push("Give the episode a title.");
  if (!season.locations.some((l) => l.id === e.location_id)) p.push("Choose the place (map pin) of the episode.");
  for (const ch of e.characters) if (!chars.has(ch)) p.push(`Character « ${ch} » isn't in the season's cast.`);
  if (!e.intro_scene.lines.length) p.push("Intro scene: add at least one line.");
  for (const [name, sc] of [["Intro", e.intro_scene], ["Outro", e.outro_scene]] as const) for (const line of sc.lines) if (line.speaker !== "narrator" && !chars.has(line.speaker)) p.push(`${name} scene: speaker « ${line.speaker} » isn't in the cast.`);
  if (!e.unit_id) p.push("Learn & practise: choose the course unit.");
  else if (refs && refs.unitSteps === 0) p.push("Learn & practise: this unit has no lesson or ready Lab activity that can be played here.");
  if (!e.conversation.npc || !chars.has(e.conversation.npc) || e.conversation.npc === "narrator") p.push("Conversation: choose the character who plays the role.");
  if (!e.conversation.role_play_id) p.push("Conversation: choose or create the AI role-play.");
  else if (refs?.rolePlay === "missing") p.push("Conversation: this role-play no longer exists.");
  else if (refs?.rolePlay === "draft") p.push("Conversation: the role-play is still a draft in the Lab (mark it ready there).");
  if (JSON.stringify(e).includes("TODO")) p.push("Some fields still contain « TODO ».");
  return p;
}

/** Season-level problems (publishing needs none, plus at least one ready episode). */
export function seasonProblems(season: Pick<LoadedSeason, "title" | "promise_fr" | "city" | "characters" | "locations" | "chapterList" | "episodeStatus">): string[] {
  const p: string[] = [];
  if (!season.title.trim()) p.push("Give the season a title.");
  if (!season.promise_fr.trim()) p.push("Write the season's learning goal.");
  if (!season.city.name.trim()) p.push("Set the city.");
  if (!season.characters.some((c) => c.id === "narrator")) p.push("Add a « narrator » character (it voices the narration).");
  if (!season.locations.length) p.push("Add at least one place.");
  if (!season.chapterList.length) p.push("Add a chapter.");
  const ids = new Set<string>();
  for (const c of season.characters) {
    if (ids.has(c.id)) p.push(`Two characters have the id « ${c.id} ».`);
    ids.add(c.id);
  }
  if (!Object.values(season.episodeStatus).includes("ready")) p.push("Mark at least one episode « ready ».");
  return p;
}
