"use server";

import { redirect } from "next/navigation";
import { connectDB } from "@/lib/db";
import { sendPasswordResetEmail } from "@/lib/email";
import { passwordProblem } from "@/lib/auth/password";
import { safeNext } from "@/lib/auth/cookies";
import { clientIp, endSession, startSession } from "@/lib/auth/session";
import { readCurrentUser } from "@/lib/auth/dal";
import { AccountError, bootstrapAdmin } from "@/lib/auth/accounts";
import {
  AUTH_ERRORS,
  authenticate,
  changePassword,
  clearRateLimit,
  deleteUserSessions,
  findByIdentifier,
  hitRateLimit,
  issueToken,
  redeemToken,
} from "@/lib/auth/service";
import { Types } from "mongoose";
import { Session } from "@/models";

export type FormState = { error?: string; success?: string; values?: Record<string, string> } | undefined;

const WINDOW = 15 * 60 * 1000;
const TOO_MANY = "Trop de tentatives. Réessayez dans quelques minutes.";
const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

// ── Login / logout ─────────────────────────────────────────────────────────

export async function login(_: FormState, form: FormData): Promise<FormState> {
  const identifier = str(form, "identifier");
  const password = String(form.get("password") ?? "");
  const values = { identifier };
  if (!identifier || !password) return { error: "Renseignez votre identifiant et votre mot de passe.", values };

  await connectDB();
  const ip = await clientIp();
  const idKey = `login:id:${identifier.toLowerCase()}`;
  const [byIp, byId] = await Promise.all([hitRateLimit(`login:ip:${ip}`, 30, WINDOW), hitRateLimit(idKey, 10, WINDOW)]);
  if (!byIp.allowed || !byId.allowed) return { error: TOO_MANY, values };

  const result = await authenticate(identifier, password);
  if (!result.ok) return { error: AUTH_ERRORS[result.reason], values };

  await clearRateLimit(idKey);
  await startSession(result.user._id);
  redirect(safeNext(str(form, "next"), "/compte"));
}

export async function logout() {
  await endSession();
  redirect("/connexion");
}

// ── Forgotten password (email link only — no WhatsApp) ─────────────────────

export async function requestPasswordReset(_: FormState, form: FormData): Promise<FormState> {
  const identifier = str(form, "identifier");
  if (!identifier) return { error: "Renseignez votre identifiant, email ou numéro." };

  await connectDB();
  const ip = await clientIp();
  const limit = await hitRateLimit(`reset:ip:${ip}`, 5, WINDOW);
  if (!limit.allowed) return { error: TOO_MANY, values: { identifier } };

  const found = await findByIdentifier(identifier);
  if (found.ambiguous) {
    return { error: "Plusieurs comptes utilisent ce numéro : indiquez votre nom d'utilisateur.", values: { identifier } };
  }
  const user = found.user;
  if (user?.email && user.isActive !== false) {
    const token = await issueToken(user._id, "reset");
    try {
      await sendPasswordResetEmail(user.email, { firstName: user.name, token });
    } catch (err) {
      console.error("Reset email error:", err);
      return { error: "L'email n'a pas pu être envoyé. Réessayez dans quelques minutes.", values: { identifier } };
    }
  }
  // Same answer whether or not the account exists (no account enumeration).
  return { success: "sent" };
}

// ── Activation / reset link: choose a password ─────────────────────────────

export async function setPasswordWithToken(_: FormState, form: FormData): Promise<FormState> {
  const token = str(form, "token");
  const purpose = str(form, "purpose") === "activation" ? "activation" : "reset";
  const password = String(form.get("password") ?? "");
  const confirm = String(form.get("confirm") ?? "");

  const problem = passwordProblem(password);
  if (problem) return { error: problem };
  if (password !== confirm) return { error: "Les deux mots de passe ne correspondent pas." };

  await connectDB();
  const limit = await hitRateLimit(`token:ip:${await clientIp()}`, 20, WINDOW);
  if (!limit.allowed) return { error: TOO_MANY };

  const user = await redeemToken(token, purpose, password);
  if (!user) return { error: "Ce lien est invalide ou a expiré. Demandez-en un nouveau." };

  await startSession(user._id);
  redirect("/compte?bienvenue=1");
}

// ── First admin ────────────────────────────────────────────────────────────

export async function createFirstAdmin(_: FormState, form: FormData): Promise<FormState> {
  const values = {
    name: str(form, "name"),
    surname: str(form, "surname"),
    username: str(form, "username").toLowerCase(),
    email: str(form, "email"),
    phoneNumber: str(form, "phoneNumber"),
  };
  const password = String(form.get("password") ?? "");
  if (!values.name || !values.surname || !values.username) return { error: "Nom, prénom et identifiant sont obligatoires.", values };
  const problem = passwordProblem(password);
  if (problem) return { error: problem, values };
  if (password !== String(form.get("confirm") ?? "")) return { error: "Les deux mots de passe ne correspondent pas.", values };

  await connectDB();
  try {
    const admin = await bootstrapAdmin({
      ...values,
      email: values.email || undefined,
      phoneNumber: values.phoneNumber || undefined,
      password,
    });
    await startSession(admin._id);
  } catch (err) {
    if (err instanceof AccountError) return { error: err.message, values };
    if (err instanceof Error && err.name === "ValidationError") {
      const first = Object.values((err as unknown as { errors: Record<string, { message: string }> }).errors)[0];
      return { error: first?.message ?? "Données invalides.", values };
    }
    throw err;
  }
  redirect("/compte");
}

// ── Account page ───────────────────────────────────────────────────────────

export async function updatePassword(_: FormState, form: FormData): Promise<FormState> {
  const me = await readCurrentUser();
  if (!me) redirect("/connexion?next=/compte");
  const current = String(form.get("current") ?? "");
  const password = String(form.get("password") ?? "");
  const problem = passwordProblem(password);
  if (problem) return { error: problem };
  if (password !== String(form.get("confirm") ?? "")) return { error: "Les deux mots de passe ne correspondent pas." };

  const limit = await hitRateLimit(`pwchange:${me.id}`, 10, WINDOW);
  if (!limit.allowed) return { error: TOO_MANY };
  const ok = await changePassword(me.id, current, password, me.sessionId);
  if (!ok) return { error: "Mot de passe actuel incorrect." };
  return { success: "Mot de passe modifié. Vos autres appareils ont été déconnectés." };
}

export async function revokeSession(form: FormData) {
  const me = await readCurrentUser();
  if (!me) redirect("/connexion?next=/compte");
  const id = str(form, "sessionId");
  if (id === "others") await deleteUserSessions(me.id, me.sessionId);
  else if (Types.ObjectId.isValid(id) && id !== me.sessionId) await Session.deleteOne({ _id: id, userId: me.id });
  redirect("/compte");
}
