import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { rm } from "node:fs/promises";
import path from "node:path";
import { Media, User } from "@/models";
import { extensionFor, mimeForKey, storageKey, uploadProblem, visibilityFor } from "@/lib/media-rules";
import { isSafeKey, verifyLocalSignature, writeLocal } from "@/lib/storage";
import { MediaError, confirmUpload, mediaUrlFor, startUpload } from "@/lib/media";

describe("upload rules", () => {
  it("accepts browser recording formats and refuses the rest", () => {
    expect(extensionFor("recording", "audio/webm;codecs=opus")).toBe("webm");
    expect(extensionFor("recording", "audio/mp4")).toBe("m4a");
    expect(extensionFor("recording", "video/mp4")).toBeNull();
    expect(extensionFor("instruction", "video/mp4")).toBe("mp4");
    // Challenge prompt pictures: images only, staff only, public, own folder.
    expect([extensionFor("image", "image/webp"), extensionFor("image", "audio/mpeg")]).toEqual(["webp", null]);
    expect(uploadProblem("image", "image/jpeg", 1000, { isStaff: false })).toMatch(/not allowed/);
    expect(uploadProblem("image", "image/jpeg", 1000, { isStaff: true })).toBeNull();
    expect([visibilityFor("image"), storageKey("image", "x", "webp", new Date("2026-11-22")).split("/")[0]]).toEqual(["public", "courses_images"]);
    expect(extensionFor("recording", "application/pdf")).toBeNull();
  });

  it("lets learners upload only their recordings, within size limits", () => {
    const learner = { isStaff: false };
    expect(uploadProblem("recording", "audio/webm", 200_000, learner)).toBeNull();
    expect(uploadProblem("voice-note", "audio/webm", 200_000, learner)).toMatch(/not allowed/);
    expect(uploadProblem("clip", "audio/mpeg", 1_000, learner)).toMatch(/not allowed/);
    expect(uploadProblem("voice-note", "audio/webm", 200_000, { isStaff: true })).toBeNull();
    expect(uploadProblem("recording", "audio/webm", 50 * 1024 * 1024, learner)).toMatch(/too large/);
    expect(uploadProblem("recording", "audio/webm", 0, learner)).toMatch(/Empty/);
    expect(visibilityFor("recording")).toBe("private");
    expect(visibilityFor("clip")).toBe("public");
  });

  it("builds safe keys and signs local URLs that expire", () => {
    const key = storageKey("recording", "0123456789abcdef01234567", "webm", new Date("2026-11-20T00:00:00Z"));
    expect(key).toBe("students_audio/recording/2026-11/0123456789abcdef01234567.webm");
    expect(storageKey("clip", "0123456789abcdef01234567", "mp3", new Date("2026-11-20T00:00:00Z"))).toBe("courses_audios/clip/2026-11/0123456789abcdef01234567.mp3");
    expect(isSafeKey(key)).toBe(true);
    expect(isSafeKey("recording/2026-11/0123456789abcdef01234567.webm")).toBe(true); // older keys
    expect(isSafeKey("other/recording/2026-11/0123456789abcdef01234567.webm")).toBe(false);
    expect(mimeForKey("courses_audios/instruction/2026-11/0123456789abcdef01234567.webm")).toBe("video/webm");
    expect(isSafeKey("../etc/passwd")).toBe(false);
    expect(isSafeKey("recording/2026-11/../../x.webm")).toBe(false);
    expect(mimeForKey(key)).toBe("audio/webm");
    expect(verifyLocalSignature("get", key, Math.floor(Date.now() / 1000) + 60, "forged")).toBe(false);
  });
});

describe("media service (local driver)", () => {
  let mongo: MongoMemoryServer;
  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri());
    await Promise.all(mongoose.modelNames().map((n) => mongoose.model(n).syncIndexes()));
  });
  afterAll(async () => {
    await mongoose.disconnect();
    await mongo?.stop();
    await rm(path.join(process.cwd(), ".uploads", "recording"), { recursive: true, force: true });
  });
  beforeEach(async () => {
    await Promise.all(mongoose.modelNames().map((n) => mongoose.model(n).deleteMany({})));
  });

  const mk = (username: string, extra: object = {}) => User.create({ name: username, surname: "T", username, email: `${username}@example.com`, ...extra });

  it("uploads, confirms and serves a private recording only to the owner, their coach and admins", async () => {
    const coach = await mk("coach", { role: "english-coach" });
    const otherCoach = await mk("other", { role: "english-coach" });
    const learner = await mk("awa", { coachId: coach._id });
    const me = { id: String(learner._id), isStaff: false };

    const { mediaId, uploadUrl } = await startUpload(me, "recording", "audio/webm;codecs=opus", 1234, 3.2);
    expect(uploadUrl).toMatch(/^\/api\/media\/local\?op=put&key=students_audio%2Frecording%2F/);
    await expect(confirmUpload(me, mediaId)).rejects.toBeInstanceOf(MediaError); // nothing uploaded yet

    const m = await Media.findById(mediaId).lean();
    await writeLocal(m!.key, new Uint8Array(1234));
    const ready = await confirmUpload(me, mediaId);
    expect(ready.status).toBe("ready");
    expect(ready.visibility).toBe("private");

    expect(await mediaUrlFor({ id: me.id, isAdmin: false }, mediaId)).toMatch(/op=get/);
    expect(await mediaUrlFor({ id: String(coach._id), isAdmin: false }, mediaId)).toMatch(/op=get/);
    expect(await mediaUrlFor({ id: "000000000000000000000000", isAdmin: true }, mediaId)).toMatch(/op=get/);
    expect(await mediaUrlFor({ id: String(otherCoach._id), isAdmin: false }, mediaId)).toBeNull();
    expect(await mediaUrlFor(null, mediaId)).toBeNull();
    // Someone else can't confirm (or hijack) the upload.
    await expect(confirmUpload({ id: String(otherCoach._id), isStaff: true }, mediaId)).rejects.toBeInstanceOf(MediaError);
  });

  it("refuses uploads that break the rules", async () => {
    const learner = await mk("kofi");
    await expect(startUpload({ id: String(learner._id), isStaff: false }, "voice-note", "audio/webm", 100)).rejects.toThrow(/not allowed/);
    await expect(startUpload({ id: String(learner._id), isStaff: false }, "recording", "text/html", 100)).rejects.toThrow(/format not supported/);
  });
});
