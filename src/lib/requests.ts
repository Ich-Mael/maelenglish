import { Types } from "mongoose";
import { EnrollmentRequest, REQUEST_LEVELS, REQUEST_STATUSES, User, ADMIN_ROLES, type EnrollmentRequestDoc } from "@/models";
import { PROGRAM_SLUGS, findProgram } from "@/lib/catalog";
import { normalizePhone } from "@/lib/phone";

/* Public sign-up requests (framework-free; tested in tests/requests.test.ts). */

export const OTHER_OFFERS: Record<string, string> = { coaching: "MaelEnglish Coaching (premium, cours individuels)", challenge: "MaelEnglish Challenge (une mission par jour)" };

export function offerName(slug: string): string {
  return findProgram(slug)?.name ?? OTHER_OFFERS[slug] ?? "À définir avec un conseiller";
}

export type RequestInput = {
  firstName: string;
  lastName: string;
  phoneNumber: string;
  email?: string;
  program?: string;
  kind?: string;
  level?: string;
  profession?: string;
  message?: string;
  consent?: boolean;
};

export class RequestError extends Error {
  constructor(message: string, public field?: string) {
    super(message);
  }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function createRequest(input: RequestInput): Promise<EnrollmentRequestDoc> {
  const firstName = input.firstName?.trim() ?? "";
  const lastName = input.lastName?.trim() ?? "";
  if (!firstName) throw new RequestError("Indiquez votre prénom.", "firstName");
  if (!lastName) throw new RequestError("Indiquez votre nom.", "lastName");
  const phoneE164 = normalizePhone(input.phoneNumber ?? "");
  if (!phoneE164) throw new RequestError("Indiquez un numéro WhatsApp valide (avec l'indicatif si vous n'êtes pas au Burkina Faso).", "phoneNumber");
  const email = input.email?.trim().toLowerCase() ?? "";
  if (email && !EMAIL_RE.test(email)) throw new RequestError("Adresse email invalide.", "email");
  if (!input.consent) throw new RequestError("Merci d'accepter que nous vous recontactions.", "consent");
  const program = input.program && (PROGRAM_SLUGS.includes(input.program) || input.program in OTHER_OFFERS) ? input.program : "";

  const doc = await EnrollmentRequest.create({
    firstName,
    lastName,
    phoneNumber: input.phoneNumber.trim(),
    phoneE164,
    email,
    program,
    kind: input.kind === "notify" ? "notify" : "enroll",
    level: ((REQUEST_LEVELS as readonly string[]).includes(input.level ?? "") ? input.level : "unknown") as EnrollmentRequestDoc["level"],
    profession: input.profession?.trim().slice(0, 120) ?? "",
    message: input.message?.trim().slice(0, 2000) ?? "",
  });
  return doc.toObject() as EnrollmentRequestDoc;
}

export async function listRequests(status?: string) {
  const filter = status && (REQUEST_STATUSES as readonly string[]).includes(status) ? { status: status as EnrollmentRequestDoc["status"] } : {};
  return EnrollmentRequest.find(filter).sort({ createdAt: -1 }).limit(200).lean<EnrollmentRequestDoc[]>();
}

export async function countNewRequests() {
  return EnrollmentRequest.countDocuments({ status: "new" });
}

export async function updateRequest(id: string, actorId: string, change: { status?: string; notes?: string }) {
  if (!Types.ObjectId.isValid(id)) throw new RequestError("Demande introuvable.");
  const set: Record<string, unknown> = { handledBy: new Types.ObjectId(actorId) };
  if (change.status && (REQUEST_STATUSES as readonly string[]).includes(change.status)) set.status = change.status;
  if (change.notes !== undefined) set.notes = change.notes.slice(0, 2000);
  const res = await EnrollmentRequest.updateOne({ _id: id }, { $set: set });
  if (!res.matchedCount) throw new RequestError("Demande introuvable.");
}

/** Emails of the admins to notify about a new request. */
export async function adminEmails(): Promise<string[]> {
  const admins = await User.find({ role: { $in: ADMIN_ROLES }, isActive: { $ne: false }, email: { $exists: true, $ne: "" } }).select("email").lean();
  return admins.map((a) => a.email!).filter(Boolean);
}
