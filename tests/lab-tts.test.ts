import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { AiUsage, Media, User } from "@/models";
import { generateModelAudio } from "@/lib/lab/tts";

// Nothing leaves the test: storage is faked.
const stored = vi.hoisted(() => [] as { key: string; size: number }[]);
vi.mock("@/lib/storage", () => ({
  putObject: async (key: string, data: Uint8Array) => void stored.push({ key, size: data.length }),
  signedReadUrl: async (key: string) => `https://files.test/${key}`,
}));

let mongo: MongoMemoryServer;
beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
});
afterAll(async () => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  await mongoose.disconnect();
  await mongo?.stop();
});

describe("Lab model audio with ElevenLabs", () => {
  it("reads the phrase with the chosen voice and stores it as model audio owned by the staff member", async () => {
    const staff = String((await User.create({ name: "Ish", surname: "Z", username: "ish", email: "ish@example.com", role: "english-coach" }))._id);
    vi.stubEnv("ELEVENLABS_API_KEY", "");
    await expect(generateModelAudio(staff, "Hello", "v1")).rejects.toThrow("isn't configured");
    vi.stubEnv("ELEVENLABS_API_KEY", "test");
    const fetchMock = vi.fn(async (_url: unknown, _init?: unknown) => (void _url, void _init, new Response(new Uint8Array(16000), { status: 200, headers: { "Content-Type": "audio/mpeg" } })));
    vi.stubGlobal("fetch", fetchMock);
    await expect(generateModelAudio(staff, "   ", "v1")).rejects.toThrow("Write the phrase first");
    const r = await generateModelAudio(staff, " Good  morning, how can I help you? ", "voice123");
    expect(String(fetchMock.mock.calls[0][0])).toContain("/v1/text-to-speech/voice123");
    expect(JSON.parse(String((fetchMock.mock.calls[0][1] as RequestInit).body)).text).toBe("Good morning, how can I help you?");
    const m = await Media.findById(r.mediaId).lean();
    expect(m).toMatchObject({ kind: "model-audio", status: "ready", visibility: "public", mime: "audio/mpeg", size: 16000, durationS: 2 });
    expect(String(m!.ownerId)).toBe(staff);
    expect(m!.key).toMatch(/^courses_audios\/model-audio\/\d{4}-\d{2}\/[a-f0-9]{24}\.mp3$/);
    expect(stored).toEqual([{ key: m!.key, size: 16000 }]);
    expect(r.url).toBe(`https://files.test/${m!.key}`);
    expect(await AiUsage.countDocuments({ feature: "lab_audio", kind: "tts" })).toBe(1);
  }, 20_000);
});
