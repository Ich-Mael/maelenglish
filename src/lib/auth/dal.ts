import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connectDB } from "@/lib/db";
import { STAFF_ROLES, ADMIN_ROLES, type Role } from "@/models";
import { SESSION_COOKIE } from "./cookies";
import { validateSession } from "./service";

/*
 * Data Access Layer: the only place pages and actions read "who is signed in".
 * Always re-checks the database (sessions can be revoked, accounts deactivated).
 * Reads cookies, so callers must render inside <Suspense> (Cache Components).
 */

export type CurrentUser = {
  id: string;
  sessionId: string;
  username: string;
  name: string;
  surname: string;
  role: Role;
  email: string | null;
  phoneE164: string | null;
  avatarUrl: string | null;
  isStaff: boolean;
  isAdmin: boolean;
};

/** Uncached read — use this in Server Actions (sharing the render cache with an action trips a Next.js invariant). */
export async function readCurrentUser(): Promise<CurrentUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  await connectDB();
  const session = await validateSession(token);
  if (!session) return null;
  const u = session.user;
  const role = (u.role ?? "user") as Role;
  return {
    id: String(u._id),
    sessionId: String(session.sessionId),
    username: u.username,
    name: u.name,
    surname: u.surname,
    role,
    email: u.email ?? null,
    phoneE164: u.phoneE164 ?? null,
    avatarUrl: u.avatarUrl ?? null,
    isStaff: STAFF_ROLES.includes(role),
    isAdmin: ADMIN_ROLES.includes(role),
  };
}

/** Per-render memoised read — use this in Server Components. */
export const getCurrentUser = cache(readCurrentUser);

/** Signed-in user or redirect to the login page (coming back to `next` afterwards). */
export async function requireUser(next = "/"): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect(`/connexion?next=${encodeURIComponent(next)}`);
  return user;
}

/** Signed-in user with one of `roles`, else home. */
export async function requireRole(roles: readonly Role[], next = "/"): Promise<CurrentUser> {
  const user = await requireUser(next);
  if (!roles.includes(user.role)) redirect("/");
  return user;
}
