import mongoose, { Types } from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { Media, User, type Role } from "@/models";
import { extensionFor, storageKey, uploadProblem, visibilityFor } from "@/lib/media-rules";
import { isSafeKey } from "@/lib/storage";
import { avatarKey, setAvatar } from "@/lib/avatar";
import { updateAccount } from "@/lib/admin/users";
import { isEnglishLevel, levelLabel } from "@/lib/levels";

describe("profile photo rules and English levels", () => {
  it("accepts small images from anyone, public, in profile_photos/", () => {
    expect(extensionFor("avatar", "image/webp")).toBe("webp");
    expect(extensionFor("avatar", "image/jpeg")).toBe("jpg");
    expect(extensionFor("avatar", "audio/webm")).toBeNull();
    expect(extensionFor("recording", "image/png")).toBeNull();
    expect(uploadProblem("avatar", "image/webp", 20_000, { isStaff: false })).toBeNull();
    expect(uploadProblem("avatar", "image/webp", 5 * 1024 * 1024, { isStaff: false })).toMatch(/trop lourd/);
    expect(visibilityFor("avatar")).toBe("public");
    const key = storageKey("avatar", "0123456789abcdef01234567", "webp", new Date("2026-11-21T00:00:00Z"));
    expect(key).toBe("profile_photos/avatar/2026-11/0123456789abcdef01234567.webp");
    expect(isSafeKey(key)).toBe(true);
  });

  it("knows the six CEFR levels", () => {
    expect(["A1", "A2", "B1", "B2", "C1", "C2"].every(isEnglishLevel)).toBe(true);
    expect(isEnglishLevel("intermediate")).toBe(false);
    expect(levelLabel("B1")).toBe("B1 · Intermédiaire");
    expect(levelLabel("C2", "en")).toBe("C2 · Proficient");
    expect(levelLabel("")).toBe("");
  });
});

let mongo: MongoMemoryServer;
beforeAll(async () => {
  process.env.STORAGE_DRIVER = "local";
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
});
afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});
beforeEach(async () => {
  await Promise.all([User.deleteMany({}), Media.deleteMany({})]);
});

const mk = (username: string, role: Role = "user") => User.create({ name: username, surname: "T", username, email: `${username}@example.com`, role });
const photo = (ownerId: Types.ObjectId, extra: object = {}) => {
  const _id = new Types.ObjectId();
  return Media.create({ _id, ownerId, kind: "avatar", key: storageKey("avatar", String(_id), "webp"), mime: "image/webp", size: 20_000, status: "ready", visibility: "public", ...extra });
};
const actor = (u: { _id: unknown; role: string }, canManageUsers = false) => ({ id: String(u._id), role: u.role, canManageUsers });

describe("setAvatar", () => {
  it("sets one's own photo, replaces it (old file removed) and clears it", async () => {
    const awa = await mk("awa");
    const p1 = await photo(awa._id);
    await setAvatar(actor(awa), String(awa._id), String(p1._id));
    let u = await User.findById(awa._id).lean();
    expect(u?.avatarUrl).toBe(`/api/avatar/${awa._id}?v=${p1._id}`);
    expect(await avatarKey(String(awa._id))).toBe(p1.key);

    const p2 = await photo(awa._id);
    await setAvatar(actor(awa), String(awa._id), String(p2._id));
    expect(await Media.exists({ _id: p1._id })).toBeNull();

    await setAvatar(actor(awa), String(awa._id), null);
    u = await User.findById(awa._id).lean();
    expect(u?.avatarUrl).toBeUndefined();
    expect(u?.avatarMediaId).toBeNull();
    expect(await avatarKey(String(awa._id))).toBeNull();
  });

  it("lets user managers change other accounts (admins' only by admins) and checks the file", async () => {
    const [awa, ali, manager, boss] = [await mk("awa"), await mk("ali"), await mk("mgr", "account-manager"), await mk("boss", "admin")];
    await expect(setAvatar(actor(ali), String(awa._id), String((await photo(ali._id))._id))).rejects.toThrow("forbidden");
    await setAvatar(actor(manager, true), String(awa._id), String((await photo(manager._id))._id));
    await expect(setAvatar(actor(manager, true), String(boss._id), String((await photo(manager._id))._id))).rejects.toThrow("forbidden");

    // Someone else's upload, an audio file, an unfinished upload.
    await expect(setAvatar(actor(awa), String(awa._id), String((await photo(ali._id))._id))).rejects.toThrow("bad-file");
    await expect(setAvatar(actor(awa), String(awa._id), String((await photo(awa._id, { kind: "recording" }))._id))).rejects.toThrow("bad-file");
    await expect(setAvatar(actor(awa), String(awa._id), String((await photo(awa._id, { status: "pending" }))._id))).rejects.toThrow("bad-file");
  });

  it("only saves CEFR levels (older free text stays until changed)", async () => {
    const [awa, boss] = [await mk("awa"), await mk("boss", "admin")];
    const edit = (englishLevel: string) => updateAccount(boss, String(awa._id), { name: "awa", surname: "T", username: "awa", email: "awa@example.com", englishLevel });
    await edit("B2");
    expect((await User.findById(awa._id).lean())?.englishLevel).toBe("B2");
    await expect(edit("very good")).rejects.toThrow(/CEFR/);
    await User.updateOne({ _id: awa._id }, { englishLevel: "intermédiaire" });
    await edit("intermédiaire");
    await edit("");
    expect((await User.findById(awa._id).lean())?.englishLevel).toBeUndefined();
  });
});
