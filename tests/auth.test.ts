import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { AuthToken, Course, Enrollment, Session, User } from "@/models";
import { hashPassword, passwordProblem, verifyPassword } from "@/lib/auth/password";
import {
  authenticate,
  changePassword,
  createSession,
  findByIdentifier,
  hitRateLimit,
  issueToken,
  redeemToken,
  setPassword,
  userForToken,
  validateSession,
} from "@/lib/auth/service";
import {
  AccountError,
  assignableRoles,
  bootstrapAdmin,
  createAccount,
  deactivateUser,
  restoreUser,
} from "@/lib/auth/accounts";
import { safeNext } from "@/lib/auth/cookies";
import { describeUserAgent } from "@/lib/auth/device";

let mongo: MongoMemoryServer;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  await Promise.all(mongoose.modelNames().map((n) => mongoose.model(n).syncIndexes()));
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo?.stop();
});

beforeEach(async () => {
  await Promise.all(mongoose.modelNames().map((n) => mongoose.model(n).deleteMany({})));
});

const PW = "anglais2026";
const admin = () =>
  bootstrapAdmin({ name: "Mael", surname: "Admin", username: "mael", email: "admin@example.com", password: PW });

describe("password", () => {
  it("hashes and verifies with scrypt", async () => {
    const h = await hashPassword(PW);
    expect(h.startsWith("scrypt$")).toBe(true);
    expect(await verifyPassword(PW, h)).toBe(true);
    expect(await verifyPassword("wrong-pass1", h)).toBe(false);
    expect(await verifyPassword(PW, "garbage")).toBe(false);
  });

  it("enforces length, a letter and a digit", () => {
    expect(passwordProblem("abc1")).toMatch(/8 caractères/);
    expect(passwordProblem("abcdefghij")).toMatch(/chiffre/);
    expect(passwordProblem(PW)).toBeNull();
  });
});

describe("accounts", () => {
  it("bootstraps a single admin, then refuses", async () => {
    const a = await admin();
    expect(a.role).toBe("admin");
    await expect(admin()).rejects.toThrow(AccountError);
  });

  it("applies role rules (no admin from the app, no escalation by managers)", async () => {
    const a = await admin();
    expect(assignableRoles(a)).toContain("instructor");
    expect(assignableRoles({ _id: a._id, role: "account-manager" })).toEqual(["user", "english-coach"]);
    expect(assignableRoles({ _id: a._id, role: "user" })).toEqual([]);
    await expect(
      createAccount(a, { name: "X", surname: "Y", username: "boss", email: "b@example.com", role: "admin" }),
    ).rejects.toThrow(/rôle/);
    await expect(
      createAccount({ _id: a._id, role: "account-manager" }, { name: "X", surname: "Y", username: "inst", email: "i@example.com", role: "instructor" }),
    ).rejects.toThrow(/rôle/);
  });

  it("creates a learner without password and an activation link", async () => {
    const a = await admin();
    const { user, activationToken } = await createAccount(a, { name: "Awa", surname: "O", username: "awa", phoneNumber: "70123456" });
    expect(user.isVerified).toBe(false);
    expect((await authenticate("awa", PW)).ok).toBe(false);
    expect(await authenticate("awa", PW)).toEqual({ ok: false, reason: "not-activated" });
    expect((await userForToken(activationToken, "activation"))?.username).toBe("awa");
    expect(await userForToken(activationToken, "reset")).toBeNull();

    expect(await redeemToken(activationToken, "activation", PW)).not.toBeNull();
    expect(await redeemToken(activationToken, "activation", PW)).toBeNull(); // single use
    const res = await authenticate("70 12 34 56", PW);
    expect(res.ok).toBe(true);
    expect((await User.findOne({ username: "awa" }))?.isVerified).toBe(true);
  });

  it("rejects duplicate usernames and invalid ones", async () => {
    const a = await admin();
    await expect(createAccount(a, { name: "A", surname: "B", username: "mael", email: "x@example.com" })).rejects.toThrow(/déjà pris/);
    await expect(createAccount(a, { name: "A", surname: "B", username: "a b", email: "x@example.com" })).rejects.toThrow(/caractères/);
  });

  it("deactivation blocks login, kills sessions and suspends enrolments; restore lifts only those", async () => {
    const a = await admin();
    const { user, activationToken } = await createAccount(a, { name: "Awa", surname: "O", username: "awa", email: "awa@example.com" });
    await redeemToken(activationToken, "activation", PW);
    const course = await Course.create({ title: "Aviation" });
    const other = await Course.create({ title: "Business" });
    await Enrollment.create({ userId: user._id, courseId: course._id });
    await Enrollment.create({ userId: user._id, courseId: other._id, status: "suspended", suspendedReason: "admin" });
    const { token } = await createSession(user._id);

    await deactivateUser(a, String(user._id));
    expect(await authenticate("awa", PW)).toEqual({ ok: false, reason: "inactive" });
    expect(await validateSession(token)).toBeNull();
    expect(await Session.countDocuments({ userId: user._id })).toBe(0);

    await restoreUser(String(user._id));
    const statuses = await Enrollment.find({ userId: user._id }).sort({ createdAt: 1 }).lean();
    expect(statuses.map((e) => e.status)).toEqual(["active", "suspended"]);
    expect((await authenticate("awa", PW)).ok).toBe(true);
  });

  it("an admin cannot deactivate themselves", async () => {
    const a = await admin();
    await expect(deactivateUser(a, String(a._id))).rejects.toThrow(/propre compte/);
  });
});

describe("login & identifiers", () => {
  it("finds by username, email or phone; a shared phone is ambiguous", async () => {
    await User.create({ name: "A", surname: "B", username: "kadi", email: "kadi@example.com", phoneNumber: "70000001" });
    await User.create({ name: "C", surname: "D", username: "sali", phoneNumber: "+22670000002" });
    await User.create({ name: "E", surname: "F", username: "sali2", phoneNumber: "70000002" });
    expect((await findByIdentifier("KADI")).user?.username).toBe("kadi");
    expect((await findByIdentifier("Kadi@Example.com")).user?.username).toBe("kadi");
    expect((await findByIdentifier("70 00 00 01")).user?.username).toBe("kadi");
    expect(await findByIdentifier("70000002")).toEqual({ user: null, ambiguous: true });
    expect((await findByIdentifier("nobody")).user).toBeNull();
  });

  it("rejects a wrong password and unknown accounts the same way", async () => {
    const a = await admin();
    expect(await authenticate("mael", "wrong-pass1")).toEqual({ ok: false, reason: "invalid" });
    expect(await authenticate("ghost", PW)).toEqual({ ok: false, reason: "invalid" });
    const ok = await authenticate("admin@example.com", PW);
    expect(ok.ok && String(ok.user._id)).toBe(String(a._id));
  });
});

describe("sessions", () => {
  it("creates, validates and tracks the device", async () => {
    const a = await admin();
    const ua = "Mozilla/5.0 (Linux; Android 13; SM-A135F) AppleWebKit/537.36 Chrome/120.0 Mobile Safari/537.36";
    const { token } = await createSession(a._id, { deviceId: "dev-1", userAgent: ua, ipAddress: "1.2.3.4" });
    await createSession(a._id, { deviceId: "dev-1", userAgent: ua });
    const v = await validateSession(token);
    expect(v?.user.username).toBe("mael");
    const u = await User.findById(a._id).lean();
    expect(u?.devices).toHaveLength(1);
    expect(u?.devices[0]).toMatchObject({ deviceType: "mobile", browser: "Chrome", os: "Android 13" });
    expect(u?.lastLoginAt).toBeInstanceOf(Date);
    expect(await Session.findOne({ tokenHash: token })).toBeNull(); // only the hash is stored
  });

  it("rejects unknown and expired tokens", async () => {
    const a = await admin();
    expect(await validateSession("nope")).toBeNull();
    const { token } = await createSession(a._id);
    await Session.updateMany({}, { $set: { expiresAt: new Date(Date.now() - 1000) } });
    expect(await validateSession(token)).toBeNull();
  });

  it("slides the expiry once a day", async () => {
    const a = await admin();
    const { token } = await createSession(a._id);
    expect((await validateSession(token))?.refreshed).toBe(false);
    await Session.updateMany({}, { $set: { lastSeenAt: new Date(Date.now() - 2 * 86400_000) } });
    expect((await validateSession(token))?.refreshed).toBe(true);
  });

  it("changing the password signs out the other sessions only", async () => {
    const a = await admin();
    const mine = await createSession(a._id);
    const other = await createSession(a._id);
    const current = await validateSession(mine.token);
    expect(await changePassword(a._id, "wrong-pass1", "nouveau2026")).toBe(false);
    expect(await changePassword(a._id, PW, "nouveau2026", current!.sessionId)).toBe(true);
    expect(await validateSession(mine.token)).not.toBeNull();
    expect(await validateSession(other.token)).toBeNull();
    expect((await authenticate("mael", "nouveau2026")).ok).toBe(true);
  });
});

describe("reset links", () => {
  it("issues one live link per purpose, expires, and is cleared by a password change", async () => {
    const a = await admin();
    const first = await issueToken(a._id, "reset");
    const second = await issueToken(a._id, "reset");
    expect(await userForToken(first, "reset")).toBeNull();
    expect(await userForToken(second, "reset")).not.toBeNull();

    await AuthToken.updateMany({}, { $set: { expiresAt: new Date(Date.now() - 1) } });
    expect(await redeemToken(second, "reset", "nouveau2026")).toBeNull();

    const third = await issueToken(a._id, "reset");
    await setPassword(a._id, "autre2026x");
    expect(await userForToken(third, "reset")).toBeNull();
  });
});

describe("rate limit", () => {
  it("allows `limit` hits per window", async () => {
    for (let i = 0; i < 3; i++) expect((await hitRateLimit("k", 3, 60_000)).allowed).toBe(true);
    expect((await hitRateLimit("k", 3, 60_000)).allowed).toBe(false);
    expect((await hitRateLimit("other", 3, 60_000)).allowed).toBe(true);
  });
});

describe("helpers", () => {
  it("only accepts same-site relative redirects", () => {
    expect(safeNext("/compte")).toBe("/compte");
    expect(safeNext("https://evil.com")).toBe("/");
    expect(safeNext("//evil.com")).toBe("/");
    expect(safeNext("/\\evil.com")).toBe("/");
    expect(safeNext(null, "/compte")).toBe("/compte");
  });

  it("describes common user agents", () => {
    expect(describeUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) Safari/604.1")).toMatchObject({
      deviceType: "mobile",
      os: "iOS 17.2",
      browser: "Safari",
    });
    expect(describeUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0 Safari/537.36")).toMatchObject({
      deviceType: "desktop",
      os: "Windows",
      browser: "Chrome",
    });
  });
});
