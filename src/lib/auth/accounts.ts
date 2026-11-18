import { Enrollment, User, ADMIN_ROLES, hasRole, type Role, type UserDoc } from "@/models";
import { deleteUserSessions, issueToken, setPassword } from "./service";

/*
 * Account administration rules (carried over from the original MaelEnglish app):
 * - accounts are created by staff, never by self sign-up;
 * - while no admin exists, one bootstrap admin can be created (`/installation`);
 * - admin / super-admin roles are never assigned from the app (database only);
 * - account managers cannot escalate (no instructor / account-manager).
 */

const ASSIGNABLE_BY_ADMIN: readonly Role[] = ["user", "english-coach", "instructor", "account-manager"];
const ASSIGNABLE_BY_MANAGER: readonly Role[] = ["user", "english-coach"];

type Actor = Pick<UserDoc, "_id" | "role">;

export function assignableRoles(actor: Actor | null | undefined): readonly Role[] {
  if (hasRole(actor, ADMIN_ROLES)) return ASSIGNABLE_BY_ADMIN;
  if (hasRole(actor, ["account-manager"])) return ASSIGNABLE_BY_MANAGER;
  return [];
}

export function canManageAccounts(actor: Actor | null | undefined): boolean {
  return assignableRoles(actor).length > 0;
}

export async function adminExists(): Promise<boolean> {
  return (await User.exists({ role: { $in: ADMIN_ROLES } })) !== null;
}

export class AccountError extends Error {}

export type NewAccount = {
  name: string;
  surname: string;
  username: string;
  email?: string;
  phoneNumber?: string;
  role?: Role;
};

/**
 * Creates a learner / staff account without a password and returns the
 * activation token: the link `/activer/<token>` lets the person choose their
 * password. It is emailed when there is an email, otherwise the admin passes
 * it on (no WhatsApp message).
 */
export async function createAccount(actor: Actor, data: NewAccount): Promise<{ user: UserDoc; activationToken: string }> {
  const role = data.role ?? "user";
  if (!assignableRoles(actor).includes(role)) throw new AccountError("Vous ne pouvez pas attribuer ce rôle.");
  await assertUnique(data);
  const user = await User.create({ ...data, role, isVerified: false });
  const activationToken = await issueToken(user._id, "activation");
  return { user: user.toObject() as UserDoc, activationToken };
}

/** First admin, with a password, only while no admin exists. */
export async function bootstrapAdmin(data: Omit<NewAccount, "role"> & { password: string }): Promise<UserDoc> {
  if (await adminExists()) throw new AccountError("Un administrateur existe déjà.");
  const { password, ...profile } = data;
  await assertUnique(profile);
  const user = await User.create({ ...profile, role: "admin", isVerified: true });
  await setPassword(user._id, password);
  return user.toObject() as UserDoc;
}

async function assertUnique(data: Pick<NewAccount, "username" | "email">) {
  const username = data.username.trim().toLowerCase();
  if (!/^[a-z0-9._-]{3,30}$/.test(username)) {
    throw new AccountError("Nom d'utilisateur : 3 à 30 caractères (lettres, chiffres, point, tiret).");
  }
  if (await User.exists({ username })) throw new AccountError("Ce nom d'utilisateur est déjà pris.");
  const email = data.email?.trim().toLowerCase();
  if (email && (await User.exists({ email }))) throw new AccountError("Cette adresse email est déjà utilisée.");
}

/** New activation link (e.g. the first one expired). Only for accounts that never set a password. */
export async function reissueActivation(userId: string): Promise<string> {
  const user = await User.findById(userId).select("+passwordHash").lean<UserDoc>();
  if (!user) throw new AccountError("Compte introuvable.");
  if (user.passwordHash) throw new AccountError("Ce compte est déjà activé : utilisez la réinitialisation du mot de passe.");
  return issueToken(user._id, "activation");
}

/** Reset link created by staff for a learner without email. */
export async function issueResetForUser(userId: string): Promise<string> {
  const user = await User.findById(userId).lean<UserDoc>();
  if (!user) throw new AccountError("Compte introuvable.");
  return issueToken(user._id, "reset");
}

/** Soft delete: blocks login, signs out every session, suspends active enrolments (tagged so restore lifts only those). */
export async function deactivateUser(actor: Actor, userId: string) {
  if (String(actor._id) === userId) throw new AccountError("Vous ne pouvez pas désactiver votre propre compte.");
  const target = await User.findById(userId).lean<UserDoc>();
  if (!target) throw new AccountError("Compte introuvable.");
  if (hasRole(target, ADMIN_ROLES)) throw new AccountError("Un compte administrateur ne peut pas être désactivé ici.");
  await User.updateOne({ _id: userId }, { $set: { isActive: false, deactivatedAt: new Date(), deactivatedBy: actor._id } });
  await deleteUserSessions(userId);
  await Enrollment.updateMany(
    { userId, status: "active" },
    { $set: { status: "suspended", suspendedReason: "account-deactivated" } },
  );
}

export async function restoreUser(userId: string) {
  await User.updateOne({ _id: userId }, { $set: { isActive: true, deactivatedAt: null, deactivatedBy: null } });
  await Enrollment.updateMany(
    { userId, status: "suspended", suspendedReason: "account-deactivated" },
    { $set: { status: "active", suspendedReason: "" } },
  );
}
