import { Types } from "mongoose";
import { Enrollment, Session, User, ADMIN_ROLES, ROLES, hasRole, type Role, type UserDoc } from "@/models";
import { assignableRoles } from "@/lib/auth/accounts";
import { AdminError } from "./errors";
import { normalizeRich } from "@/lib/rich-text";
import { isEnglishLevel } from "@/lib/levels";

type Actor = Pick<UserDoc, "_id" | "role">;

export type UserEdit = {
  name: string;
  surname: string;
  username: string;
  email?: string;
  phoneNumber?: string;
  role?: Role;
  englishLevel?: string;
  about?: string;
  maxDevices?: number;
  /** Monthly AI minutes override; null = the default (AppSettings). Undefined = unchanged. */
  aiMonthlyMinutes?: number | null;
};

/**
 * Profile edit by staff. Role rules (from the original app): admin / super-admin roles are
 * never granted or removed from the app, and the role must be assignable by
 * the actor (account managers cannot escalate).
 */
export async function updateAccount(actor: Actor, userId: string, data: UserEdit): Promise<void> {
  const user = await User.findById(userId);
  if (!user) throw new AdminError("Account not found.");
  if (hasRole(user, ADMIN_ROLES) && !hasRole(actor, ADMIN_ROLES)) throw new AdminError("Only an administrator can edit this account.");

  if (data.role && data.role !== user.role) {
    if (hasRole(user, ADMIN_ROLES)) throw new AdminError("An administrator's role can only be changed in the database.");
    if (!assignableRoles(actor).includes(data.role)) throw new AdminError("You can't assign this role.");
    user.role = data.role;
  }
  const username = data.username.trim().toLowerCase();
  if (!/^[a-z0-9._-]{3,30}$/.test(username)) throw new AdminError("Username: 3 to 30 characters (letters, digits, dot, dash).");
  if (username !== user.username && (await User.exists({ username, _id: { $ne: user._id } }))) throw new AdminError("This username is already taken.");
  const email = data.email?.trim().toLowerCase() || undefined;
  if (email && (await User.exists({ email, _id: { $ne: user._id } }))) throw new AdminError("This email address is already in use.");

  user.name = data.name.trim();
  user.surname = data.surname.trim();
  user.username = username;
  user.email = email;
  user.phoneNumber = data.phoneNumber?.trim() || undefined;
  const level = data.englishLevel?.trim() || undefined;
  if (level && level !== user.englishLevel && !isEnglishLevel(level)) throw new AdminError("English level: choose one of the CEFR levels (A1 to C2).");
  user.englishLevel = level;
  user.about = normalizeRich(data.about);
  if (data.maxDevices) user.maxDevices = Math.max(1, Math.min(20, Math.round(data.maxDevices)));
  if (data.aiMonthlyMinutes !== undefined) {
    const m = data.aiMonthlyMinutes;
    if (m !== null && (!Number.isFinite(m) || m < 0 || m > 10000)) throw new AdminError("AI minutes: enter a number between 0 and 10,000, or leave empty.");
    user.aiMonthlyMinutes = m === null ? null : Math.round(m);
  }
  await user.save();
}

export type UserListItem = {
  id: string;
  name: string;
  surname: string;
  username: string;
  email: string | null;
  phoneE164: string | null;
  role: Role;
  active: boolean;
  activated: boolean;
  lastLoginAt: Date | null;
};

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Search by name, username, email or phone digits; filter by role / status; 25 per page. */
export type LearnerMatch = { id: string; name: string; surname: string; username: string; contact: string; staff: boolean; enrolled: boolean };

/**
 * Accounts matching `q` (name, surname, username, email, WhatsApp number) for the enrolment
 * picker: active accounts only, learners first, with whether they're already in `courseId`.
 */
export async function searchLearners(q: string, courseId: string, limit = 8): Promise<LearnerMatch[]> {
  const term = q.trim();
  if (term.length < 2) return [];
  const re = new RegExp(escapeRe(term), "i");
  const digits = term.replace(/\D/g, "");
  // « Awa Diallo » also matches name + surname typed together.
  const [first, ...rest] = term.split(/\s+/);
  const full = rest.length ? [{ name: new RegExp(escapeRe(first), "i"), surname: new RegExp(escapeRe(rest.join(" ")), "i") }] : [];
  const users = await User.find({
    isActive: { $ne: false },
    $or: [{ name: re }, { surname: re }, { username: re }, { email: re }, ...full, ...(digits.length >= 4 ? [{ phoneE164: new RegExp(digits) }] : [])],
  })
    .select("name surname username email phoneNumber role")
    .limit(limit * 3)
    .lean();
  const enrolled = new Set(
    Types.ObjectId.isValid(courseId)
      ? (await Enrollment.find({ courseId: new Types.ObjectId(courseId), userId: { $in: users.map((u) => u._id) } }).select("userId").lean()).map((e) => String(e.userId))
      : [],
  );
  return users
    .map((u) => ({
      id: String(u._id),
      name: u.name,
      surname: u.surname,
      username: u.username,
      contact: u.email || u.phoneNumber || "",
      staff: (u.role ?? "user") !== "user",
      enrolled: enrolled.has(String(u._id)),
    }))
    .sort((a, b) => Number(a.staff) - Number(b.staff) || Number(a.enrolled) - Number(b.enrolled) || a.name.localeCompare(b.name, "fr"))
    .slice(0, limit);
}

export async function listUsers(opts: { q?: string; role?: string; status?: string; page?: number }) {
  const filter: Record<string, unknown> = {};
  const q = opts.q?.trim();
  if (q) {
    const re = new RegExp(escapeRe(q), "i");
    const digits = q.replace(/\D/g, "");
    filter.$or = [{ name: re }, { surname: re }, { username: re }, { email: re }, ...(digits.length >= 4 ? [{ phoneE164: new RegExp(digits) }] : [])];
  }
  if (opts.role && (ROLES as readonly string[]).includes(opts.role)) filter.role = opts.role;
  if (opts.status === "inactive") filter.isActive = false;
  else if (opts.status === "active") filter.isActive = { $ne: false };
  const page = Math.max(1, opts.page ?? 1);
  const [total, users] = await Promise.all([
    User.countDocuments(filter),
    User.find(filter).select("+passwordHash").sort({ createdAt: -1 }).skip((page - 1) * 25).limit(25).lean<(UserDoc & { passwordHash?: string })[]>(),
  ]);
  const items: UserListItem[] = users.map((u) => ({
    id: String(u._id),
    name: u.name,
    surname: u.surname,
    username: u.username,
    email: u.email ?? null,
    phoneE164: u.phoneE164 ?? null,
    role: (u.role ?? "user") as Role,
    active: u.isActive !== false,
    activated: !!u.passwordHash,
    lastLoginAt: u.lastLoginAt ?? null,
  }));
  return { items, total, page, pages: Math.max(1, Math.ceil(total / 25)) };
}

export async function userDetail(userId: string) {
  if (!Types.ObjectId.isValid(userId)) return null;
  const user = await User.findById(userId).select("+passwordHash").lean<UserDoc & { passwordHash?: string }>();
  if (!user) return null;
  const [sessions, enrollments] = await Promise.all([
    Session.countDocuments({ userId, expiresAt: { $gt: new Date() } }),
    Enrollment.find({ userId }).populate<{ courseId: { _id: Types.ObjectId; title: string } }>("courseId", "title").sort({ startDate: -1 }).lean(),
  ]);
  return { user, activated: !!user.passwordHash, sessions, enrollments };
}

export async function revokeDevice(userId: string, deviceId: string) {
  await User.updateOne({ _id: userId }, { $pull: { devices: { deviceId } } });
  await Session.deleteMany({ userId, deviceId });
}
