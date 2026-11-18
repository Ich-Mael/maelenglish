import { Types } from "mongoose";
import { AuthToken, RateLimit, Session, User, isAccountActive, type AuthTokenPurpose, type UserDoc } from "@/models";
import { looksLikePhone, normalizePhone } from "@/lib/phone";
import { hashPassword, verifyPassword } from "./password";
import { hashToken, newToken } from "./tokens";
import { describeUserAgent } from "./device";

/*
 * Auth core, framework-free (no Next.js imports) so it is unit-tested directly.
 * Cookies / redirects live in `session.ts` and the server actions.
 */

export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days, sliding
const SESSION_REFRESH_MS = 24 * 60 * 60 * 1000; // extend at most once a day
export const TOKEN_TTL_MS: Record<AuthTokenPurpose, number> = {
  activation: 7 * 24 * 60 * 60 * 1000,
  reset: 60 * 60 * 1000,
};

type Id = Types.ObjectId | string;

// ── Identifier lookup ──────────────────────────────────────────────────────

export type IdentifierResult = { user: UserDoc | null; ambiguous?: boolean };

/** Username, email or WhatsApp number. A number shared by several accounts (family phone) is ambiguous. */
export async function findByIdentifier(raw: string, withPassword = false): Promise<IdentifierResult> {
  const id = (raw || "").trim().toLowerCase();
  if (!id) return { user: null };
  const select = withPassword ? "+passwordHash" : "";

  if (id.includes("@")) return { user: await User.findOne({ email: id }).select(select).lean<UserDoc>() };

  const byUsername = await User.findOne({ username: id }).select(select).lean<UserDoc>();
  if (byUsername || !looksLikePhone(id)) return { user: byUsername };

  const e164 = normalizePhone(id);
  if (!e164) return { user: null };
  const matches = await User.find({ phoneE164: e164 }).select(select).limit(2).lean<UserDoc[]>();
  if (matches.length > 1) return { user: null, ambiguous: true };
  return { user: matches[0] ?? null };
}

// ── Login ──────────────────────────────────────────────────────────────────

export type AuthResult =
  | { ok: true; user: UserDoc }
  | { ok: false; reason: "invalid" | "ambiguous" | "inactive" | "not-activated" };

export const AUTH_ERRORS: Record<Exclude<AuthResult, { ok: true }>["reason"], string> = {
  invalid: "Identifiant ou mot de passe incorrect.",
  ambiguous: "Plusieurs comptes utilisent ce numéro : connectez-vous avec votre nom d'utilisateur.",
  inactive: "Ce compte a été désactivé. Contactez l'équipe MaelEnglish.",
  "not-activated":
    "Votre compte n'est pas encore activé : utilisez le lien d'activation reçu, ou demandez-en un nouveau à l'équipe MaelEnglish.",
};

// Verified against when the user doesn't exist, so response time doesn't reveal valid identifiers.
let dummyHash: Promise<string> | null = null;

export async function authenticate(identifier: string, password: string): Promise<AuthResult> {
  const found = await findByIdentifier(identifier, true);
  if (found.ambiguous) return { ok: false, reason: "ambiguous" };
  const user = found.user;
  if (!user || !user.passwordHash) {
    dummyHash ??= hashPassword("dummy-password-1");
    await verifyPassword(password, await dummyHash);
    if (user && !user.passwordHash && isAccountActive(user)) return { ok: false, reason: "not-activated" };
    return { ok: false, reason: "invalid" };
  }
  if (!(await verifyPassword(password, user.passwordHash))) return { ok: false, reason: "invalid" };
  if (!isAccountActive(user)) return { ok: false, reason: "inactive" };
  return { ok: true, user };
}

// ── Sessions ───────────────────────────────────────────────────────────────

export type SessionMeta = { deviceId?: string; userAgent?: string; ipAddress?: string };

/** Creates a session and records the device; returns the raw cookie token. */
export async function createSession(userId: Id, meta: SessionMeta = {}): Promise<{ token: string; expiresAt: Date }> {
  const { token, hash } = newToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await Session.create({
    tokenHash: hash,
    userId,
    deviceId: meta.deviceId ?? "",
    userAgent: (meta.userAgent ?? "").slice(0, 500),
    ipAddress: meta.ipAddress ?? "",
    expiresAt,
  });
  await User.updateOne({ _id: userId }, { $set: { lastLoginAt: new Date() } });
  if (meta.deviceId) await trackDevice(userId, meta.deviceId, meta.userAgent ?? "", meta.ipAddress ?? "");
  return { token, expiresAt };
}

/**
 * Device registry (`User.devices`). As in the original app this is informational —
 * shown to the learner and to admins — and never blocks a login.
 */
export async function trackDevice(userId: Id, deviceId: string, userAgent: string, ipAddress: string) {
  const now = new Date();
  const updated = await User.updateOne(
    { _id: userId, "devices.deviceId": deviceId },
    {
      $set: {
        "devices.$.lastLogin": now,
        "devices.$.isActive": true,
        "devices.$.ipAddress": ipAddress,
        "devices.$.userAgent": userAgent.slice(0, 500),
      },
    },
  );
  if (updated.matchedCount === 0) {
    const info = describeUserAgent(userAgent);
    await User.updateOne(
      { _id: userId },
      {
        $push: {
          devices: {
            deviceId,
            deviceType: info.deviceType,
            browser: info.browser,
            os: info.os,
            userAgent: userAgent.slice(0, 500),
            ipAddress,
            firstSeen: now,
            lastLogin: now,
            isActive: true,
          },
        },
      },
    );
  }
}

export type ValidSession = { sessionId: Types.ObjectId; user: UserDoc; expiresAt: Date; refreshed: boolean };

/** Resolves a cookie token; null if unknown, expired, or the account is deactivated. Slides the expiry daily. */
export async function validateSession(token: string | undefined | null): Promise<ValidSession | null> {
  if (!token) return null;
  const tokenHash = hashToken(token);
  const session = await Session.findOne({ tokenHash }).lean();
  if (!session) return null;
  const now = Date.now();
  if (session.expiresAt.getTime() <= now) {
    await Session.deleteOne({ _id: session._id });
    return null;
  }
  const user = await User.findById(session.userId).lean<UserDoc>();
  if (!user || !isAccountActive(user)) {
    await Session.deleteMany({ userId: session.userId });
    return null;
  }
  let expiresAt = session.expiresAt;
  let refreshed = false;
  if (now - new Date(session.lastSeenAt).getTime() > SESSION_REFRESH_MS) {
    expiresAt = new Date(now + SESSION_TTL_MS);
    refreshed = true;
    await Session.updateOne({ _id: session._id }, { $set: { lastSeenAt: new Date(now), expiresAt } });
  }
  return { sessionId: session._id, user, expiresAt, refreshed };
}

export async function deleteSession(token: string | undefined | null) {
  if (token) await Session.deleteOne({ tokenHash: hashToken(token) });
}

/** Signs the user out everywhere (optionally keeping one session). */
export async function deleteUserSessions(userId: Id, keepSessionId?: Id) {
  await Session.deleteMany({ userId, ...(keepSessionId ? { _id: { $ne: keepSessionId } } : {}) });
}

// ── Passwords & one-time links ─────────────────────────────────────────────

/** Sets the password, marks the account verified and signs out every other session. */
export async function setPassword(userId: Id, password: string, keepSessionId?: Id) {
  await User.updateOne(
    { _id: userId },
    { $set: { passwordHash: await hashPassword(password), passwordChangedAt: new Date(), isVerified: true } },
  );
  await deleteUserSessions(userId, keepSessionId);
  await AuthToken.deleteMany({ userId });
}

export async function changePassword(userId: Id, current: string, next: string, keepSessionId?: Id) {
  const user = await User.findById(userId).select("+passwordHash").lean<UserDoc>();
  if (!user || !(await verifyPassword(current, user.passwordHash))) return false;
  await setPassword(userId, next, keepSessionId);
  return true;
}

/** Issues a single-use link token, replacing any previous one for the same purpose. Returns the raw token. */
export async function issueToken(userId: Id, purpose: AuthTokenPurpose): Promise<string> {
  await AuthToken.deleteMany({ userId, purpose });
  const { token, hash } = newToken();
  await AuthToken.create({ tokenHash: hash, userId, purpose, expiresAt: new Date(Date.now() + TOKEN_TTL_MS[purpose]) });
  return token;
}

/** The (active) account a link token belongs to, or null if invalid / expired. Does not consume it. */
export async function userForToken(token: string, purpose: AuthTokenPurpose): Promise<UserDoc | null> {
  if (!token) return null;
  const record = await AuthToken.findOne({ tokenHash: hashToken(token), purpose }).lean();
  if (!record || record.expiresAt.getTime() <= Date.now()) return null;
  const user = await User.findById(record.userId).lean<UserDoc>();
  return user && isAccountActive(user) ? user : null;
}

/** Uses a link token to set the password. Returns the user, or null if the token is invalid. */
export async function redeemToken(token: string, purpose: AuthTokenPurpose, password: string): Promise<UserDoc | null> {
  const user = await userForToken(token, purpose);
  if (!user) return null;
  // Atomic: a token can only be redeemed once even with concurrent submits.
  const removed = await AuthToken.deleteOne({ tokenHash: hashToken(token), purpose });
  if (removed.deletedCount !== 1) return null;
  await setPassword(user._id, password);
  return user;
}

// ── Rate limiting ──────────────────────────────────────────────────────────

/** Fixed-window counter in MongoDB (works across instances). Each call counts one hit. */
export async function hitRateLimit(key: string, limit: number, windowMs: number): Promise<{ allowed: boolean; retryAfterMs: number }> {
  const now = new Date();
  const doc = await RateLimit.findOneAndUpdate(
    { key, expiresAt: { $gt: now } },
    { $inc: { count: 1 } },
    { returnDocument: "after" },
  ).lean();
  if (doc) return { allowed: doc.count <= limit, retryAfterMs: doc.expiresAt.getTime() - now.getTime() };
  const expiresAt = new Date(now.getTime() + windowMs);
  // Expired or missing window: start a new one.
  await RateLimit.findOneAndUpdate({ key }, { $set: { count: 1, expiresAt } }, { upsert: true });
  return { allowed: 1 <= limit, retryAfterMs: windowMs };
}

export async function clearRateLimit(key: string) {
  await RateLimit.deleteOne({ key });
}
