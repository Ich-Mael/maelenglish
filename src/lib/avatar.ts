import "server-only";
import { Types } from "mongoose";
import { ADMIN_ROLES, Media, User } from "@/models";
import { deleteObject } from "./storage";

/*
 * Profile photos. The browser resizes the picture (320 px square, components/account/avatar-picker.tsx)
 * and uploads it as Media kind `avatar` (public to signed-in users, bucket folder profile_photos/);
 * `setAvatar` then links it to the account. Pages show `User.avatarUrl` = `/api/avatar/<id>?v=<mediaId>`
 * (a stable URL that redirects to a signed storage URL; `v` changes with the photo, so caches refresh).
 */

export class AvatarError extends Error {}

type Actor = { id: string; role: string; canManageUsers: boolean };

/** Sets (mediaId) or removes (null) a profile photo: one's own, or any account for user managers (admins' only by admins). */
export async function setAvatar(actor: Actor, userId: string, mediaId: string | null) {
  if (!Types.ObjectId.isValid(userId)) throw new AvatarError("not-found");
  const user = await User.findById(userId).select("role avatarMediaId").lean();
  if (!user) throw new AvatarError("not-found");
  const self = actor.id === userId;
  if (!self && (!actor.canManageUsers || (ADMIN_ROLES.includes(user.role as never) && !ADMIN_ROLES.includes(actor.role as never)))) throw new AvatarError("forbidden");

  let media = null;
  if (mediaId) {
    media = Types.ObjectId.isValid(mediaId) ? await Media.findById(mediaId).select("kind status ownerId").lean() : null;
    if (!media || media.kind !== "avatar" || media.status !== "ready" || String(media.ownerId) !== actor.id) throw new AvatarError("bad-file");
  }
  const old = user.avatarMediaId;
  await User.updateOne({ _id: userId }, media ? { $set: { avatarMediaId: media._id, avatarUrl: `/api/avatar/${userId}?v=${media._id}` } } : { $set: { avatarMediaId: null }, $unset: { avatarUrl: 1 } });

  // The previous photo is no longer used: remove it (best effort).
  if (old && String(old) !== mediaId) {
    const m = await Media.findOneAndDelete({ _id: old, kind: "avatar" }).lean();
    if (m) await deleteObject(m.key).catch((e) => console.error("[avatar] delete", e));
  }
}

/** Storage key of an account's photo (for /api/avatar), or null. */
export async function avatarKey(userId: string): Promise<string | null> {
  if (!Types.ObjectId.isValid(userId)) return null;
  const u = await User.findById(userId).select("avatarMediaId isActive").lean();
  if (!u?.avatarMediaId || u.isActive === false) return null;
  const m = await Media.findOne({ _id: u.avatarMediaId, kind: "avatar", status: "ready" }).select("key").lean();
  return m?.key ?? null;
}
