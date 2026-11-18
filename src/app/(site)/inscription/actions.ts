"use server";

import { connectDB } from "@/lib/db";
import { clientIp } from "@/lib/auth/session";
import { hitRateLimit } from "@/lib/auth/service";
import { RequestError, adminEmails, createRequest, offerName } from "@/lib/requests";
import { sendNewRequestEmail } from "@/lib/email";
import { displayPhone } from "@/lib/phone";

export type SignupState =
  | { error?: string; field?: string; values?: Record<string, string> }
  | { ok: true; firstName: string; offer: string; kind: string; summary: string }
  | undefined;

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

export async function submitSignup(_: SignupState, form: FormData): Promise<SignupState> {
  const values = {
    firstName: str(form, "firstName"),
    lastName: str(form, "lastName"),
    phoneNumber: str(form, "phoneNumber"),
    email: str(form, "email"),
    program: str(form, "program"),
    kind: str(form, "kind"),
    level: str(form, "level"),
    profession: str(form, "profession"),
    message: str(form, "message"),
  };
  // Honeypot: real people never fill this hidden field.
  if (str(form, "website")) return { ok: true, firstName: values.firstName, offer: "", kind: values.kind, summary: "" };

  try {
    await connectDB();
    const limit = await hitRateLimit(`signup:ip:${await clientIp()}`, 5, 60 * 60 * 1000);
    if (!limit.allowed) return { error: "Vous avez déjà envoyé plusieurs demandes. Réessayez plus tard ou écrivez-nous sur WhatsApp.", values };

    const r = await createRequest({ ...values, consent: form.get("consent") === "on" });
    const offer = offerName(r.program ?? "");
    try {
      const to = await adminEmails();
      if (to.length) {
        await sendNewRequestEmail(to, { name: `${r.firstName} ${r.lastName}`, phone: displayPhone(r.phoneE164), email: r.email ?? "", offer, kind: r.kind ?? "enroll", message: r.message ?? "" });
      }
    } catch (e) {
      console.error("signup notification", e); // the request is saved anyway
    }
    const summary = [
      `Bonjour, je viens d'envoyer une demande ${r.kind === "notify" ? "d'information" : "d'inscription"} sur le site MaelEnglish.`,
      `Nom : ${r.firstName} ${r.lastName}`,
      `Programme : ${offer}`,
    ].join("\n");
    return { ok: true, firstName: r.firstName, offer, kind: r.kind ?? "enroll", summary };
  } catch (e) {
    if (e instanceof RequestError) return { error: e.message, field: e.field, values };
    throw e;
  }
}
