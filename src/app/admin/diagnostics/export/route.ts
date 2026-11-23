import { readCurrentUser } from "@/lib/auth/dal";
import { can } from "@/lib/admin/permissions";
import { connectDB } from "@/lib/db";
import { listDiagnostics } from "@/lib/diagnostic/service";
import { PROFILE_INFO, type ProfileId } from "@/lib/diagnostic/profiles";

/** CSV of the diagnostic leads (same filters as the list), for admins and account managers. */
export async function GET(req: Request) {
  const me = await readCurrentUser();
  if (!me || !can.manageUsers({ id: me.id, role: me.role })) return new Response("Forbidden", { status: 403 });
  await connectDB();
  const sp = new URL(req.url).searchParams;
  const { done } = await listDiagnostics({ q: sp.get("q") ?? "", status: sp.get("statut") ?? "", profile: sp.get("profil") ?? "" }, 5000);
  const cell = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const name = (p: string) => PROFILE_INFO[p as ProfileId]?.name ?? p;
  const rows = [
    ["Date", "First name", "Last name", "Field", "Email", "WhatsApp", "Profile", "Secondary profiles", "Newsletter", "Status", "Source"],
    ...done.map((d) => [d.completedAt?.toISOString().slice(0, 10), d.lead?.firstName, d.lead?.lastName, d.lead?.field, d.lead?.email, d.lead?.phone, name(d.primaryProfile), (d.secondaryProfiles ?? []).map(name).join(" / "), d.lead?.consentMarketing ? "yes" : "no", d.status, d.utmSource]),
  ];
  // BOM so Excel opens the accents correctly.
  return new Response("﻿" + rows.map((r) => r.map(cell).join(",")).join("\r\n"), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="diagnostics-${new Date().toISOString().slice(0, 10)}.csv"`, "Cache-Control": "no-store" },
  });
}
