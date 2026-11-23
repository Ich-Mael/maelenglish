"use server";

import { after } from "next/server";
import { connectDB } from "@/lib/db";
import { clientIp } from "@/lib/auth/session";
import { hitRateLimit } from "@/lib/auth/service";
import { DiagnosticError, emailReport, getDiagnostic, saveProgress, startDiagnostic, submitDiagnostic, type DiagnosticResult, type LeadInput } from "@/lib/diagnostic/service";

/* Public learning-path diagnostic (DIAGNOSTIC_SPEC.md): no account needed, rate-limited per IP. Leads stay in the platform (Admin → Diagnostics): no email to admins (owner decision 2026-11-23). */

export async function startDiagnosticAction(utm: { source?: string; medium?: string; campaign?: string }): Promise<{ ok: true; token: string } | { ok: false; error: string }> {
  await connectDB();
  const rl = await hitRateLimit(`diag-start:${await clientIp()}`, 20, 3600_000);
  if (!rl.allowed) return { ok: false, error: "Trop de diagnostics commencés : réessayez dans une heure." };
  return { ok: true, ...(await startDiagnostic(utm)) };
}

export async function saveDiagnosticAction(token: string, answers: unknown, section: number): Promise<{ ok: boolean }> {
  try {
    await connectDB();
    await saveProgress(token, answers, section);
    return { ok: true };
  } catch {
    return { ok: false }; // progress is also kept on the device
  }
}

export async function submitDiagnosticAction(token: string, answers: unknown, lead: LeadInput): Promise<{ ok: true; result: DiagnosticResult } | { ok: false; error: string; field?: string }> {
  try {
    await connectDB();
    const rl = await hitRateLimit(`diag-submit:${await clientIp()}`, 8, 3600_000);
    if (!rl.allowed) return { ok: false, error: "Trop de rapports demandés : réessayez dans une heure." };
    const done = await submitDiagnostic(token, answers, lead);
    const result: DiagnosticResult = { firstName: done.firstName, report: done.report, primary: done.primary, secondary: done.secondary, source: done.source };
    // The report is also emailed to the person, after the response (never delays the screen).
    if (done.isNew) after(() => emailReport(token).then(() => undefined).catch((e) => console.error("[diagnostic] report email", e)));
    return { ok: true, result };
  } catch (e) {
    if (e instanceof DiagnosticError) return { ok: false, error: e.message, field: e.field };
    console.error("[diagnostic] submit", e);
    return { ok: false, error: "Une erreur est survenue : réessayez dans un instant." };
  }
}

export async function getDiagnosticAction(token: string): Promise<DiagnosticResult | null> {
  await connectDB();
  return getDiagnostic(token);
}
