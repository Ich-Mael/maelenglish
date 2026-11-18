import { Types } from "mongoose";
import { Enrollment, Session, User, ADMIN_ROLES, ROLES, hasRole, type Role, type UserDoc } from "@/models";
import { assignableRoles } from "@/lib/auth/accounts";
import { AdminError } from "./errors";

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
};

/**
 * Profile edit by staff. Role rules (legacy): admin / super-admin roles are
 * never granted or removed from the app, and the role must be assignable by
 * the actor (account managers cannot escalate).
 */
export async function updateAccount(actor: Actor, userId: string, data: UserEdit): Promise<void> {
  const user = await User.findById(userId);
  if (!user) throw new AdminError("Compte introuvable.");
  if (hasRole(user, ADMIN_ROLES) && !hasRole(actor, ADMIN_ROLES)) throw new AdminError("Seul un administrateur peut modifier ce compte.");

  if (data.role && data.role !== user.role) {
    if (hasRole(user, ADMIN_ROLES)) throw new AdminError("Le rôle d'un administrateur se change directement dans la base de données.");
    if (!assignableRoles(actor).includes(data.role)) throw new AdminError("Vous ne pouvez pas attribuer ce rôle.");
    user.role = data.role;
  }
  const username = data.username.trim().toLowerCase();
  if (!/^[a-z0-9._-]{3,30}$/.test(username)) throw new AdminError("Nom d'utilisateur : 3 à 30 caractères (lettres, chiffres, point, tiret).");
  if (username !== user.username && (await User.exists({ username, _id: { $ne: user._id } }))) throw new AdminError("Ce nom d'utilisateur est déjà pris.");
  const email = data.email?.trim().toLowerCase() || undefined;
  if (email && (await User.exists({ email, _id: { $ne: user._id } }))) throw new AdminError("Cette adresse email est déjà utilisée.");

  user.name = data.name.trim();
  user.surname = data.surname.trim();
  user.username = username;
  user.email = email;
  user.phoneNumber = data.phoneNumber?.trim() || undefined;
  user.englishLevel = data.englishLevel?.trim() || undefined;
  user.about = data.about?.trim() ?? "";
  if (data.maxDevices) user.maxDevices = Math.max(1, Math.min(20, Math.round(data.maxDevices)));
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
