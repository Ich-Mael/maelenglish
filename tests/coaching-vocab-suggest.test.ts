import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { Coaching, CoachingVocab, User } from "@/models";
import { setAiServicesForTests } from "@/lib/ai";
import { FakeFeedbackService } from "@/lib/ai/fake";
import { createCoaching, type Viewer } from "@/lib/coaching/service";
import { MAX_PER_DAY, parseSuggestions, removeQueuedVocab, removeVocabItem, suggestVocab, todayVocab, writeCoachingSentence } from "@/lib/coaching/vocabulary";

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
beforeEach(async () => {
  setAiServicesForTests({ feedback: new FakeFeedbackService() });
  await Promise.all(mongoose.modelNames().map((n) => mongoose.model(n).deleteMany({})));
});

let n = 0;
async function user(role: Viewer["role"] = "user"): Promise<Viewer> {
  n++;
  const u = await User.create({ name: `S${n}`, surname: "T", username: `s${n}`, email: `s${n}@example.com`, role });
  return { id: String(u._id), role };
}
const DAY = 86_400_000;
const NOW = new Date("2026-11-26T10:00:00Z");

async function setup() {
  const admin = await user("admin");
  const coach = await user("english-coach");
  const awa = await user();
  const id = await createCoaching(admin, { kind: "group", memberIds: [awa.id], coachId: coach.id, title: "Pitch", goal: "<p>x</p>" });
  return { coach, awa, id };
}

describe("the coach suggests vocabulary", () => {
  it("reads one per line, with an optional French after « = »", () => {
    expect(parseSuggestions("walk you through\n a track record of = un parcours solide \n\nWalk you through\nfollow up\ton time")).toEqual([
      { text: "walk you through", translation: "" },
      { text: "a track record of", translation: "un parcours solide" },
      { text: "follow up", translation: "on time" },
    ]);
  });

  it("adds to today (completed by the AI, the coach's French kept), up to the day's limit; only the coach", async () => {
    const { coach, awa, id } = await setup();
    const today = (await todayVocab(awa, id, NOW))!;
    expect(today.items).toHaveLength(3);
    await expect(suggestVocab(awa, id, "pitch deck", "today", NOW)).rejects.toThrow("Only the coach");
    const r = await suggestVocab(coach, id, `pitch deck = support de présentation\n${today.items[0].text}`, "today", NOW);
    expect(r).toEqual({ added: 1, skipped: 1 });
    const day = (await CoachingVocab.findById(today._id).lean())!;
    expect(day.items.at(-1)).toMatchObject({ text: "pitch deck", translation: "support de présentation", example: "I use pitch deck for my goal.", by: "coach" });
    await expect(suggestVocab(coach, id, "a\nb\nc", "today", NOW)).rejects.toThrow(`Today can take ${MAX_PER_DAY - 4} more expressions`);
    await expect(suggestVocab(coach, id, "pitch deck", "next", NOW)).rejects.toThrow("already given");
  });

  it("planned expressions open the next days before the AI's; removal rules", async () => {
    const { coach, awa, id } = await setup();
    await suggestVocab(coach, id, "one\ntwo\nthree\nfour", "next", NOW);
    await suggestVocab(coach, id, "five", "next", NOW);
    await removeQueuedVocab(coach, id, (await Coaching.findById(id).lean())!.vocabQueue.find((q) => q.text === "five")!.id);

    const d1 = (await todayVocab(awa, id, NOW))!;
    expect(d1.items.map((i) => [i.text, i.by])).toEqual([["one", "coach"], ["two", "coach"], ["three", "coach"]]);
    const d2 = (await todayVocab(awa, id, new Date(NOW.getTime() + DAY)))!;
    expect(d2.items.map((i) => i.by)).toEqual(["coach", "ai", "ai"]);
    expect(d2.items[0].text).toBe("four");
    expect((await Coaching.findById(id).lean())!.vocabQueue).toEqual([]);

    // A written sentence protects an expression; others can go, never the last one.
    await writeCoachingSentence(awa, id, String(d1._id), d1.items[0].id, "I can say one at work today.");
    await expect(removeVocabItem(coach, id, String(d1._id), d1.items[0].id)).rejects.toThrow("already wrote");
    await removeVocabItem(coach, id, String(d1._id), d1.items[1].id);
    await expect(removeVocabItem(awa, id, String(d1._id), d1.items[2].id)).rejects.toThrow("Only the coach");
    expect((await CoachingVocab.findById(d1._id).lean())!.items.map((i) => i.text)).toEqual(["one", "three"]);
  });
});
