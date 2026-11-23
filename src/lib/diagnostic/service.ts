import { createHash, randomBytes } from "node:crypto";
import { Diagnostic, type DiagnosticDoc } from "@/models";
import { aiServices } from "@/lib/ai";
import { normalizePhone } from "@/lib/phone";
import { QUESTION, SECTIONS, answersInWords, cleanAnswers, type Answers } from "./questions";
import { PROFILE_INFO, computeProfiles, type ProfileId } from "./profiles";
import { DiagnosticReportSchema, type DiagnosticReport } from "./report-types";
import { fallbackReport } from "./fallback-reports";

/*
 * Diagnostic sessions (DIAGNOSTIC_SPEC.md §3, §6, §7, §9). Framework-free (tests/diagnostic.test.ts).
 * The AI gets the first name, the field of work / study and the answers — never the last name, email or phone (§12).
 */

export class DiagnosticError extends Error {
  constructor(message: string, public field?: string) {
    super(message);
  }
}

const hash = (token: string) => createHash("sha256").update(token).digest("hex");
const clip = (v: unknown, n: number) => (typeof v === "string" ? v.trim().slice(0, n) : "");

export async function startDiagnostic(utm: { source?: string; medium?: string; campaign?: string } = {}): Promise<{ token: string }> {
  const token = randomBytes(24).toString("base64url");
  await Diagnostic.create({ tokenHash: hash(token), utmSource: clip(utm.source, 80), utmMedium: clip(utm.medium, 80), utmCampaign: clip(utm.campaign, 80) });
  return { token };
}

async function byToken(token: string) {
  if (typeof token !== "string" || token.length < 20 || token.length > 64) throw new DiagnosticError("Diagnostic introuvable : recommencez, s'il vous plaît.");
  const d = await Diagnostic.findOne({ tokenHash: hash(token) });
  if (!d) throw new DiagnosticError("Diagnostic introuvable : recommencez, s'il vous plaît.");
  return d;
}

/** After each section: the answers so far (cleaned) and the section reached. */
export async function saveProgress(token: string, rawAnswers: unknown, section: number) {
  const d = await byToken(token);
  if (d.completedAt) return;
  d.answers = cleanAnswers(rawAnswers);
  d.lastSection = Math.max(d.lastSection ?? 0, Math.min(SECTIONS.length, Math.max(0, Math.round(section) || 0)));
  d.markModified("answers");
  await d.save();
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export type LeadInput = { firstName?: string; lastName?: string; field?: string; email?: string; phone?: string; consentAnalysis?: boolean; consentMarketing?: boolean };
export type DiagnosticResult = { firstName: string; report: DiagnosticReport; primary: ProfileId; secondary: ProfileId[]; source: "ai" | "fallback" };

const labelsOf = (a: Answers, id: string) => (Array.isArray(a[id]) ? (a[id] as string[]) : []).map((v) => (v === "other" ? String(a[`${id}_other`] ?? "") : (QUESTION[id].options?.find((o) => o.value === v)?.label ?? v))).filter(Boolean);

/** The AI's report, validated; retried once; else the profile's ready-written report. */
async function writeReport(firstName: string, a: Answers, primary: ProfileId, secondary: ProfileId[], scores: Record<string, number>, field = ""): Promise<{ report: DiagnosticReport; source: "ai" | "fallback"; usage?: { provider: string; tokens: number; costMicros: number } }> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const r = await aiServices().feedback.diagnosticReport({
        firstName,
        answersText: `${field ? `Métier ou domaine d'études : ${field}\n\n` : ""}${answersInWords(a)}`,
        primary: { id: primary, name: PROFILE_INFO[primary].name, need: PROFILE_INFO[primary].need },
        secondary: secondary.map((p) => ({ id: p, name: PROFILE_INFO[p].name })),
        scores,
      });
      const parsed = DiagnosticReportSchema.safeParse(r.report);
      if (parsed.success) return { report: { ...parsed.data, profile_name: PROFILE_INFO[primary].name }, source: "ai", usage: { provider: r.usage.provider, tokens: r.usage.inputTokens + r.usage.outputTokens, costMicros: r.usage.costMicros } };
      console.error("[diagnostic] invalid report", parsed.error.issues.slice(0, 3));
    } catch (e) {
      console.error(`[diagnostic] report attempt ${attempt + 1} failed`, e);
    }
  }
  return { report: fallbackReport(primary, firstName, labelsOf(a, "q30"), labelsOf(a, "q31")), source: "fallback" };
}

/** Email + consent, then profiles and the report (stored). Idempotent once completed. */
export async function submitDiagnostic(token: string, rawAnswers: unknown, lead: LeadInput, now = new Date()): Promise<DiagnosticResult & { isNew: boolean; usage?: { provider: string; tokens: number; costMicros: number } }> {
  const d = await byToken(token);
  if (d.completedAt && d.report && d.lead) {
    return { firstName: d.lead.firstName, report: d.report as DiagnosticReport, primary: d.primaryProfile as ProfileId, secondary: (d.secondaryProfiles ?? []) as ProfileId[], source: (d.reportSource || "ai") as "ai" | "fallback", isNew: false };
  }
  const firstName = clip(lead.firstName, 60);
  const email = clip(lead.email, 200).toLowerCase();
  const lastName = clip(lead.lastName, 60);
  const field = clip(lead.field, 120);
  if (!firstName) throw new DiagnosticError("Indiquez votre prénom.", "firstName");
  if (!lastName) throw new DiagnosticError("Indiquez votre nom.", "lastName");
  if (!field) throw new DiagnosticError("Indiquez votre métier ou votre domaine d'études.", "field");
  if (!EMAIL_RE.test(email)) throw new DiagnosticError("Indiquez une adresse email valide.", "email");
  const phoneRaw = clip(lead.phone, 40);
  if (phoneRaw && !normalizePhone(phoneRaw)) throw new DiagnosticError("Numéro WhatsApp invalide (ajoutez l'indicatif si vous n'êtes pas au Burkina Faso).", "phone");
  if (!lead.consentAnalysis) throw new DiagnosticError("Merci d'accepter l'analyse de vos réponses pour recevoir votre rapport.", "consentAnalysis");

  const answers = cleanAnswers(rawAnswers);
  const { primary, secondary, scores } = computeProfiles(answers);
  const normalized = Object.fromEntries(Object.entries(scores).map(([k, v]) => [k, v.normalized]));
  const written = await writeReport(firstName, answers, primary, secondary, normalized, field);

  d.answers = answers;
  d.markModified("answers");
  d.lastSection = SECTIONS.length;
  d.profileScores = scores;
  d.primaryProfile = primary;
  d.secondaryProfiles = secondary;
  d.report = written.report;
  d.reportSource = written.source;
  d.lead = { firstName, lastName, field, email, phone: phoneRaw ? (normalizePhone(phoneRaw) ?? phoneRaw) : "", consentAnalysis: true, consentMarketing: !!lead.consentMarketing, createdAt: now };
  d.completedAt = now;
  await d.save();
  return { firstName, report: written.report, primary, secondary, source: written.source, isNew: true, usage: written.usage };
}

/** The stored report (page reloaded after the report). */
export async function getDiagnostic(token: string): Promise<DiagnosticResult | null> {
  const d = await byToken(token).catch(() => null);
  if (!d?.completedAt || !d.report || !d.lead) return null;
  return { firstName: d.lead.firstName, report: d.report as DiagnosticReport, primary: d.primaryProfile as ProfileId, secondary: (d.secondaryProfiles ?? []) as ProfileId[], source: (d.reportSource || "ai") as "ai" | "fallback" };
}

/** Emails the report to the person (once), with a link back to it. `token`: the browser's token (in the link). */
export async function emailReport(token: string, now = new Date()): Promise<boolean> {
  const { sendDiagnosticReportEmail, appUrl } = await import("@/lib/email");
  const d = await byToken(token).catch(() => null);
  if (!d?.lead || !d.report || d.reportEmailedAt) return false;
  const r = d.report as DiagnosticReport;
  const res = await sendDiagnosticReportEmail(d.lead.email, {
    firstName: d.lead.firstName,
    profileName: r.profile_name,
    headline: r.headline,
    holdsBack: r.what_holds_you_back.map((x) => x.title),
    reframe: r.reframe,
    method: r.recommended_method,
    firstStep: r.first_step_this_week,
    url: appUrl(`/diagnostic/rapport/${token}`),
  });
  if (res.simulated) return false;
  await Diagnostic.updateOne({ _id: d._id }, { $set: { reportEmailedAt: now } });
  return true;
}

export type DiagnosticRow = Pick<DiagnosticDoc, "_id" | "createdAt" | "completedAt" | "primaryProfile" | "secondaryProfiles" | "lead" | "lastSection" | "status" | "reportSource" | "utmSource">;

/**
 * Staff list (Admin → Diagnostics): completed diagnostics, newest first, filtered by a search (name,
 * email, phone, field), the follow-up status and the main profile; plus overall counts and where
 * unfinished diagnostics stopped.
 */
export async function listDiagnostics(filter: { q?: string; status?: string; profile?: string } = {}, limit = 300) {
  const match: Record<string, unknown> = { completedAt: { $ne: null } };
  if (filter.status && ["new", "contacted", "closed"].includes(filter.status)) match.status = filter.status;
  if (filter.profile) match.primaryProfile = filter.profile;
  const q = (filter.q ?? "").trim().slice(0, 80);
  if (q) {
    const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    const digits = q.replace(/\D/g, "");
    match.$or = [{ "lead.firstName": re }, { "lead.lastName": re }, { "lead.email": re }, { "lead.field": re }, ...(digits.length >= 4 ? [{ "lead.phone": new RegExp(digits) }] : [])];
  }
  const [done, started, completed, byStatus, bySection] = await Promise.all([
    Diagnostic.find(match).select("createdAt completedAt primaryProfile secondaryProfiles lead status reportSource reportEmailedAt utmSource").sort({ completedAt: -1 }).limit(limit).lean(),
    Diagnostic.countDocuments({}),
    Diagnostic.countDocuments({ completedAt: { $ne: null } }),
    Diagnostic.aggregate<{ _id: string; n: number }>([{ $match: { completedAt: { $ne: null } } }, { $group: { _id: "$status", n: { $sum: 1 } } }]),
    Diagnostic.aggregate<{ _id: number; n: number }>([{ $match: { completedAt: null } }, { $group: { _id: "$lastSection", n: { $sum: 1 } } }, { $sort: { _id: 1 } }]),
  ]);
  return {
    done,
    started,
    completed,
    status: Object.fromEntries(byStatus.map((x) => [x._id ?? "new", x.n])) as Record<string, number>,
    abandoned: bySection.map((b) => ({ section: b._id ?? 0, count: b.n })),
  };
}

export async function setDiagnosticStatus(id: string, status: string) {
  if (!["new", "contacted", "closed"].includes(status)) throw new DiagnosticError("Invalid status.");
  await Diagnostic.updateOne({ _id: id }, { $set: { status } });
}
