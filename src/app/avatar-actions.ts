"use server";

import { refresh } from "next/cache";
import { readCurrentUser } from "@/lib/auth/dal";
import { AvatarError, setAvatar } from "@/lib/avatar";
import { can } from "@/lib/admin/permissions";

/** Sets or removes a profile photo (components/account/avatar-picker.tsx). Messages follow `locale`: staff pages in English, learners in French. */
export async function setAvatarAction(userId: string, mediaId: string | null, locale: "fr" | "en" = "en"): Promise<{ ok: true } | { ok: false; error: string }> {
  const en = locale === "en";
  try {
    const me = await readCurrentUser();
    if (!me) return { ok: false, error: en ? "Please sign in again." : "Connectez-vous à nouveau." };
    await setAvatar({ id: me.id, role: me.role, canManageUsers: can.manageUsers({ id: me.id, role: me.role }) }, String(userId), mediaId ? String(mediaId) : null);
    refresh();
    return { ok: true };
  } catch (e) {
    if (e instanceof AvatarError) {
      const msg = {
        "not-found": en ? "Account not found." : "Compte introuvable.",
        forbidden: en ? "You can't change this person's photo." : "Vous ne pouvez pas modifier cette photo.",
        "bad-file": en ? "The photo couldn't be used. Try again." : "La photo n’a pas pu être utilisée. Réessayez.",
      }[e.message];
      return { ok: false, error: msg ?? e.message };
    }
    console.error("avatar action", e);
    return { ok: false, error: en ? "Couldn't save the photo. Try again." : "Impossible d’enregistrer la photo. Réessayez." };
  }
}
