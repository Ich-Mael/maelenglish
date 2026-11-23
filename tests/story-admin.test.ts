import mongoose, { Types } from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { Activity, AiUsage, Course, EpisodeProgress, Module, Step, StoryEpisode, StorySeason, Unit, User } from "@/models";
import { setAiServicesForTests } from "@/lib/ai";
import { FakeConversationEngine, FakeFeedbackService } from "@/lib/ai/fake";
import { cleanContent } from "@/lib/lab/content";
import { adminEpisode, adminSeason, copyCharacters, createEpisode, createEpisodeRolePlay, createSeason, deleteEpisode, deleteSeason, exportSeason, importSeason, reorderEpisodes, saveEpisode, saveSeason, setEpisodeStatus, setSeasonStatus, StoryAdminError } from "@/lib/story/admin";
import { getSeason, listSeasons } from "@/lib/story/content";
import { suggestedPriceFcfa, voiceMinutes } from "@/lib/story/minutes";
import { grantStory, storyState } from "@/lib/story/service";

let mongo: MongoMemoryServer;
beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  await Promise.all(mongoose.modelNames().map((n) => mongoose.model(n).syncIndexes()));
});
afterAll(async () => {
  setAiServicesForTests(null);
  await mongoose.disconnect();
  await mongo?.stop();
});

const FILE = JSON.parse(readFileSync("scripts/seed/story-s1-accra.json", "utf8"));
let unitId = "";
let rolePlayId = "";
beforeEach(async () => {
  setAiServicesForTests({ feedback: new FakeFeedbackService(), conversation: new FakeConversationEngine() });
  await Promise.all(mongoose.modelNames().map((n) => mongoose.model(n).deleteMany({})));
  const c = await Course.create({ title: "Everyday English" });
  const m = await Module.create({ courseId: c._id, order: 1, title: "Arriving" });
  const u = await Unit.create({ courseId: c._id, moduleId: m._id, order: 1, title: "Introductions" });
  await Step.create({ courseId: c._id, moduleId: m._id, unitId: u._id, position: 1, kind: "lesson", title: "Saying hello", content: {} });
  const rp = await Activity.create({ type: "role_play", title: "Passport control", status: "ready", content: cleanContent("role_play", { aiRole: "an officer", learnerRole: "a traveller", setting: "Airport", goals: ["Give your name"], openingLine: "Hello." }) });
  unitId = String(u._id);
  rolePlayId = String(rp._id);
});

/** Season 1 with every episode linked to the unit and the role-play (ready). */
const readyFile = () => ({
  ...FILE,
  episodes: FILE.episodes.map((e: Record<string, unknown>) => {
    const { role_play_draft: _d, ...rest } = e;
    void _d;
    return { ...rest, unit_id: unitId, conversation: { ...(e.conversation as object), role_play_id: rolePlayId }, status: "ready" };
  }),
});

let n = 0;
const learner = async () => ({ id: String((await User.create({ name: "Awa", surname: "T", username: `l${++n}`, email: `l${n}@example.com` }))._id), isStaff: false });
const staff = { id: String(new Types.ObjectId()), isStaff: true };

describe("seasons in the admin", () => {
  it("a new season can't be published until it's complete; an episode needs a unit and a role-play", async () => {
    const id = await createSeason({ slug: "lagos-1", title: "Lagos calling", city: "Lagos", country: "Nigeria", learningGoal: "Je travaille en anglais" });
    const a = (await adminSeason(id))!;
    expect(a.season.characters.map((c) => c.id)).toEqual(["narrator"]);
    expect(a.problems).toContain("Add at least one place.");
    await expect(setSeasonStatus(id, "published")).rejects.toThrow(StoryAdminError);
    await expect(createSeason({ slug: "lagos-1", title: "x" })).rejects.toThrow("already");

    await saveSeason(id, "cast", { characters: a.season.characters.concat([{ ...a.season.characters[0], id: "tunde", name: "Tunde", role: "Your manager" }]), locations: [{ id: "office", name: "The office", map_position: { x: 0.5, y: 0.5 }, icon: "Briefcase" }], chapters: [{ id: "ch01", order: 1, title: "First week" }] });
    const epId = await createEpisode(id, { title: "First day" });
    let ep = (await adminEpisode(epId))!;
    expect(ep.episode!.conversation.npc).toBe("tunde");
    expect(ep.problems).toContain("Learn & practise: choose the course unit.");
    expect(ep.problems).toContain("Conversation: choose or create the AI role-play.");
    await expect(setEpisodeStatus(epId, "ready")).rejects.toThrow("Fix these first");

    // « Create a conversation for this episode »: a Lab role-play draft from the character.
    const rpId = await createEpisodeRolePlay(epId, staff.id);
    const rp = await Activity.findById(rpId).lean();
    expect(rp!.status).toBe("draft");
    expect((rp!.content as { aiRole: string }).aiRole).toContain("Tunde");
    ep = (await adminEpisode(epId))!;
    expect(ep.problems.join(" ")).toContain("still a draft in the Lab");

    const content = { ...ep.episode!, unit_id: unitId, intro_scene: { lines: [{ speaker: "narrator", text_fr: "Premier jour." }] }, conversation: { ...ep.episode!.conversation, role_play_id: rolePlayId } };
    const left = await saveEpisode(epId, { content });
    expect(left, left.join(" | ")).toEqual([]);
    await setEpisodeStatus(epId, "ready");
    await setSeasonStatus(id, "published");
    expect((await getSeason("lagos-1"))!.city.name).toBe("Lagos");
  });

  it("learners only get published seasons and ready episodes; paid with a preview per season", async () => {
    const { id } = await importSeason(readyFile());
    expect(await getSeason("s1-arrival")).toBeNull();
    expect(await listSeasons()).toEqual([]);
    expect((await getSeason("s1-arrival", { drafts: true }))!.chapterList[0].episodeList).toHaveLength(3);
    await setSeasonStatus(id, "published");
    const ep3 = await StoryEpisode.findOne({ slug: "ep03-taxi" });
    await setEpisodeStatus(String(ep3!._id), "draft");
    expect((await getSeason("s1-arrival"))!.chapterList[0].episodeList.map((e) => e.id)).toEqual(["ep01-airport", "ep02-neighbour"]);
    const me = await learner();
    expect((await storyState(me, "s1-arrival")).items.map((x) => x.lock)).toEqual(["no_access", "no_access"]);
    expect((await storyState(staff, "s1-arrival")).items.map((x) => x.lock)).toEqual(["open", "open", "open"]);
    await saveSeason(id, "sale", { freeEpisodes: 1, aiMinutesIncluded: 30, priceFcfa: 15000, marginPct: null });
    expect((await storyState(me, "s1-arrival")).items.map((x) => x.lock)).toEqual(["open", "no_access"]);
  });

  it("import / export round-trips; replacing needs the flag", async () => {
    const { id } = await importSeason(readyFile());
    const out = await exportSeason(id);
    expect(out.episodes.map((e) => e.id)).toEqual(FILE.episodes.map((e: { id: string }) => e.id));
    expect(out.episodes[0].unit_id).toBe(unitId);
    expect(out.characters).toEqual(FILE.characters);
    await expect(importSeason(out)).rejects.toThrow("Replace");
    await importSeason({ ...out, title: "Renamed" }, { replace: true });
    expect((await StorySeason.findById(id))!.title).toBe("Renamed");
  });

  it("episodes: reorder, delete; copy a cast; delete a played season is refused", async () => {
    const { id } = await importSeason(readyFile());
    const eps = await StoryEpisode.find({ seasonId: id }).sort({ order: 1 });
    await reorderEpisodes(id, [eps[2], eps[0], eps[1]].map((e) => ({ id: String(e._id), chapterId: "ch01" })));
    expect((await StoryEpisode.find({ seasonId: id }).sort({ order: 1 })).map((e) => e.slug)).toEqual(["ep03-taxi", "ep01-airport", "ep02-neighbour"]);
    await deleteEpisode(String(eps[1]._id));
    expect(await StoryEpisode.countDocuments({ seasonId: id })).toBe(2);

    const other = await createSeason({ slug: "s2", title: "Season 2" });
    expect(await copyCharacters(other, id)).toBe(FILE.characters.length - 1); // narrator already there

    await EpisodeProgress.create({ userId: new Types.ObjectId(), storyId: "s1-arrival", episodeId: "ep01-airport" });
    await expect(deleteSeason(id)).rejects.toThrow("unpublish");
  });
});

describe("conversation minutes and pricing", () => {
  it("the season's minutes (+ extra) count its role-play calls only", async () => {
    const { id } = await importSeason({ ...readyFile(), ai_minutes_included: 1 });
    await setSeasonStatus(id, "published");
    const me = await learner();
    await grantStory(me.id, "s1-arrival", staff.id);
    await AiUsage.create({ userId: me.id, kind: "conversation", feature: "story_roleplay", seconds: 60, ref: "story:s1-arrival", day: "2026-11-23", month: "2026-11" });
    await AiUsage.create({ userId: me.id, kind: "conversation", feature: "roleplay", seconds: 300, day: "2026-11-23", month: "2026-11" });
    expect((await voiceMinutes(me, { id: "s1-arrival", aiMinutesIncluded: 1 }))!.leftS).toBe(0);
    await grantStory(me.id, "s1-arrival", staff.id, { extraMinutes: 5 });
    expect((await voiceMinutes(me, { id: "s1-arrival", aiMinutesIncluded: 1 }))!.leftS).toBe(300);
    expect(await voiceMinutes(staff, { id: "s1-arrival", aiMinutesIncluded: 1 })).toBeNull();
  });

  it("suggests a price from the minutes, the cost per minute and the margin", () => {
    expect(suggestedPriceFcfa(60, 0.04, 200, 600)).toBe(4500); // 60 × 0.04 × 3 × 600 = 4320 → 4500
    expect(suggestedPriceFcfa(0, 0.04, 200, 600)).toBe(500);
  });
});
