import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { AiUsage, DictionaryContext, DictionaryEntry, User, VocabWord } from "@/models";
import { DICTIONARY_URL, ENRICH_VERSION, LOOKUPS_PER_HOUR, wordAudio, lemmaOf, listWords, lookup, normalizeWord, removeWord, reviewWord, saveWord, hasWord } from "@/lib/dictionary";
import { setAiServicesForTests } from "@/lib/ai";
import { FakeFeedbackService, FakeTtsService } from "@/lib/ai/fake";
import { ssml } from "@/lib/ai/azure";
import { rm } from "node:fs/promises";
import path from "node:path";

let mongo: MongoMemoryServer;
beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  await Promise.all(mongoose.modelNames().map((n) => mongoose.model(n).syncIndexes()));
});
afterAll(async () => {
  setAiServicesForTests(null);
  vi.unstubAllGlobals();
  await rm(path.join(process.cwd(), ".uploads", "courses_audios", "dictionary"), { recursive: true, force: true });
  await mongoose.disconnect();
  await mongo?.stop();
});

// The Free Dictionary API, stubbed: knows « delay » and « booking ».
const known: Record<string, unknown> = {
  delay: [{ word: "delay", phonetic: "/dɪˈleɪ/", phonetics: [{ text: "/dɪˈleɪ/", audio: "https://api.dictionaryapi.dev/media/pronunciations/en/delay-uk.mp3" }, { audio: "https://api.dictionaryapi.dev/media/pronunciations/en/delay-us.mp3" }], meanings: [{ partOfSpeech: "noun", definitions: [{ definition: "A period of time by which something is late.", example: "a delay of two hours" }, { definition: "b" }, { definition: "c" }, { definition: "d" }] }, { partOfSpeech: "verb", definitions: [{ definition: "To put off until later." }] }] }],
  booking: [{ word: "booking", phonetics: [], meanings: [{ partOfSpeech: "noun", definitions: [{ definition: "A reservation." }] }] }],
};
const calls: string[] = [];
const fetchStub = vi.fn(async (url: string) => {
  const word = decodeURIComponent(String(url).replace(DICTIONARY_URL, ""));
  calls.push(word);
  return word in known ? new Response(JSON.stringify(known[word]), { status: 200 }) : new Response(JSON.stringify({ title: "No Definitions Found" }), { status: 404 });
});

beforeEach(async () => {
  calls.length = 0;
  vi.stubGlobal("fetch", fetchStub);
  setAiServicesForTests({ feedback: new FakeFeedbackService() });
  await Promise.all(mongoose.modelNames().map((n) => mongoose.model(n).deleteMany({})));
});

const learner = () => User.create({ name: "Awa", surname: "T", username: "awa", email: "awa@example.com" });

describe("dictionary", () => {
  it("normalises one word and finds a simple lemma", () => {
    expect([normalizeWord(" Delay, "), normalizeWord("don’t"), normalizeWord("two words"), normalizeWord("12"), normalizeWord("check-in")]).toEqual(["delay", "don't", null, null, "check-in"]);
    expect([lemmaOf("bookings"), lemmaOf("boxes"), lemmaOf("companies"), lemmaOf("delayed"), lemmaOf("booking"), lemmaOf("go")]).toEqual(["booking", "box", "company", "delay", "book", null]);
  });

  it("looks a word up once (dictionary + translation), then serves it from the cache", async () => {
    const u = await learner();
    const e = await lookup(String(u._id), "Delay");
    expect([e.found, e.phonetic, e.audioUrl.endsWith("delay-us.mp3"), e.meanings.length, e.meanings[0].definitions.length, e.translation, e.source]).toEqual([true, "/dɪˈleɪ/", true, 2, 3, "[FR] delay", "dictionary"]);
    await lookup(String(u._id), "delay");
    expect([calls, await AiUsage.countDocuments({ feature: "dictionary" })]).toEqual([["delay"], 1]);
  });

  it("retries on a lemma, falls back to an AI-only entry, and caches unknown words", async () => {
    const u = await learner();
    const b = await lookup(String(u._id), "bookings");
    expect([b.found, b.headword, b.translation]).toEqual([true, "booking", "[FR] bookings"]);
    expect(calls).toEqual(["bookings", "booking"]);
    calls.length = 0;
    const j = await lookup(String(u._id), "onboarding");
    expect([j.found, j.source, j.translation, j.meanings]).toEqual([false, "ai", "[FR] onboarding", []]);
    await lookup(String(u._id), "onboarding");
    expect(calls).toEqual(["onboarding", "onboard"]);
    await expect(lookup(String(u._id), "two words")).rejects.toThrow(/one English word/);
  });

  it("limits lookups per hour (cached words don't count)", async () => {
    const u = await learner();
    for (let i = 0; i < LOOKUPS_PER_HOUR; i++) await lookup(String(u._id), `word${"x".repeat(i % 5)}${String.fromCharCode(97 + (i % 26))}${String.fromCharCode(97 + Math.floor(i / 26))}`).catch(() => {});
    await expect(lookup(String(u._id), "newword")).rejects.toThrow(/a few minutes/);
    await DictionaryEntry.create({ word: "cached", found: true, translation: "en cache", enrichVersion: ENRICH_VERSION });
    expect((await lookup(String(u._id), "cached")).translation).toBe("en cache");
  });

  it("gives the meaning in the tapped sentence (cached per word + sentence) and the main sense", async () => {
    const u = await learner();
    const e = await lookup(String(u._id), "delay", "  The flight had a long   DELAY this morning. ");
    expect([e.translation, e.sense, e.inContext?.translation, e.inContext?.sense, e.inContext?.sentence]).toEqual(["[FR] delay", { m: 0, d: 0 }, "[FR ctx] delay", { m: 0, d: 0 }, "The flight had a long DELAY this morning."]);
    await lookup(String(u._id), "delay", "The flight had a long delay this morning.");
    expect([await AiUsage.countDocuments({ feature: "dictionary" }), await DictionaryContext.countDocuments()]).toEqual([2, 1]);
    // A sentence without the word is ignored; no sentence = the usual translation only.
    expect((await lookup(String(u._id), "delay", "Nothing to see here.")).inContext).toBeNull();
    expect((await lookup(String(u._id), "delay")).inContext).toBeNull();
    expect(calls).toEqual(["delay"]);
  });

  it("re-enriches entries from an older enrichment without fetching the dictionary again", async () => {
    const u = await learner();
    await lookup(String(u._id), "delay");
    await DictionaryEntry.updateOne({ word: "delay" }, { $set: { translation: "cohérent", enrichVersion: 1 } });
    calls.length = 0;
    const e = await lookup(String(u._id), "delay");
    expect([e.translation, calls, (await DictionaryEntry.findOne({ word: "delay" }).lean())?.enrichVersion]).toEqual(["[FR] delay", [], ENRICH_VERSION]);
  });

  it("builds Azure SSML (voice per accent, slower rate, escaped text)", () => {
    expect(ssml("R&D <team>", { accent: "british", rate: 0.75 })).toBe('<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-GB"><voice name="en-GB-SoniaNeural"><prosody rate="-25%">R&amp;D &lt;team&gt;</prosody></voice></speak>');
    expect(ssml("delay")).toContain('<voice name="en-US-JennyNeural">delay</voice>');
  });

  it("makes pronunciation audio once per text / voice / speed (shared cache), a new example gets its own audio", async () => {
    const u = await learner();
    const tts = new FakeTtsService();
    const spy = vi.spyOn(tts, "synthesize");
    setAiServicesForTests({ feedback: new FakeFeedbackService(), tts });
    const e = await lookup(String(u._id), "delay");
    expect(e.voices).toBe(true);
    const url = await wordAudio(String(u._id), "Delay", { voice: "gb", slow: true });
    expect(url).toMatch(/\/api\/media\/local\?/);
    await wordAudio(String(u._id), "delay", { voice: "gb", slow: true });
    await wordAudio(String(u._id), "delay", { voice: "us" });
    await wordAudio(String(u._id), "delay", { voice: "us", what: "example" });
    expect((spy.mock.calls as unknown as [string, { accent?: string; rate?: number }?][]).map(([t, o]) => [t, o?.accent, o?.rate])).toEqual([["delay", "british", 0.75], ["delay", "american", 1], ['We use "delay" at work every day.', "american", 1]]);
    expect(await AiUsage.countDocuments({ kind: "tts" })).toBe(3);
    // A word the dictionary doesn't know (e.g. a daily word) can still be read aloud.
    expect(await wordAudio(String(u._id), "unknownword", { voice: "us" })).toMatch(/\/api\/media\/local\?/);
    // No voice configured: nothing generated (the browser falls back).
    setAiServicesForTests({ feedback: new FakeFeedbackService() });
    expect([await wordAudio(String(u._id), "otherword", { voice: "gb" }), (await lookup(String(u._id), "delay")).voices]).toEqual([null, false]);
  });

  it("notebook: save once (with context), list with entries, review, remove", async () => {
    const u = await learner();
    await lookup(String(u._id), "delay");
    await saveWord(String(u._id), "Delay", { context: "  Flight AF 512 is   delayed.  ", translation: "retard" });
    await saveWord(String(u._id), "delay", { context: "other" });
    expect(await VocabWord.countDocuments()).toBe(1);
    expect(await hasWord(String(u._id), "DELAY")).toBe(true);
    let list = await listWords(String(u._id));
    expect([list[0].context, list[0].translation, list[0].entry?.translation]).toEqual(["Flight AF 512 is delayed.", "retard", "[FR] delay"]);
    await reviewWord(String(u._id), "delay", true);
    list = await listWords(String(u._id), "known");
    expect([list.length, list[0].reviews, (await listWords(String(u._id), "learning")).length]).toEqual([1, 1, 0]);
    await removeWord(String(u._id), "delay");
    expect(await VocabWord.countDocuments()).toBe(0);
  });
});

describe("vocabulary voices setting", () => {
  it("defaults to Jessica (US) / George (UK) and keeps the admin's choice", async () => {
    const { vocabularyVoices, saveVocabularyVoices, DEFAULT_VOCAB_VOICES } = await import("@/lib/ai/spoken");
    expect(await vocabularyVoices()).toEqual(DEFAULT_VOCAB_VOICES);
    await saveVocabularyVoices({ us: { id: "abc-123", name: "Sarah" }, gb: { id: "" } });
    expect(await vocabularyVoices()).toEqual({ us: { id: "abc-123", name: "Sarah" }, gb: DEFAULT_VOCAB_VOICES.gb });
  });
});
