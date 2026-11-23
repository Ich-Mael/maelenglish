import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { Briefcase, Download, Search, Users } from "lucide-react";
import { actorOf, requireStaff } from "@/lib/admin/context";
import { can } from "@/lib/admin/permissions";
import { listDiagnostics } from "@/lib/diagnostic/service";
import { PROFILES, PROFILE_INFO, type ProfileId } from "@/lib/diagnostic/profiles";
import { SECTIONS } from "@/lib/diagnostic/questions";
import { displayPhone } from "@/lib/phone";
import { EmptyState, PageHeader, fmtDate, inputCls } from "@/components/admin/ui";
import { DiagnosticActions } from "@/components/admin/diagnostic-actions";
import { PageSkeleton } from "@/components/learn/ui";
import { cn } from "cn";

export const metadata: Metadata = { title: "Diagnostics" };

const name = (p: string) => PROFILE_INFO[p as ProfileId]?.name ?? p;
const initials = (a: string, b: string) => `${a.slice(0, 1)}${b.slice(0, 1)}`.toUpperCase() || "?";

async function Diagnostics({ searchParams }: { searchParams: Promise<{ q?: string; statut?: string; profil?: string }> }) {
  const me = await requireStaff("/admin/diagnostics");
  const actor = actorOf(me);
  if (!can.manageUsers(actor)) redirect("/admin");
  await connection();
  const sp = await searchParams;
  const q = (sp.q ?? "").slice(0, 80);
  const status = ["new", "contacted", "closed"].includes(sp.statut ?? "") ? sp.statut! : "";
  const profile = (PROFILES as readonly string[]).includes(sp.profil ?? "") ? sp.profil! : "";
  const r = await listDiagnostics({ q, status, profile });
  const href = (p: Record<string, string>) => {
    const u = new URLSearchParams({ ...(q ? { q } : {}), ...(status ? { statut: status } : {}), ...(profile ? { profil: profile } : {}), ...p });
    for (const [k, v] of [...u.entries()]) if (!v) u.delete(k);
    return `/admin/diagnostics${u.size ? `?${u}` : ""}`;
  };
  const exportHref = `/admin/diagnostics/export${href({}).replace("/admin/diagnostics", "")}`;
  const tabs = [
    { value: "", label: "All", n: r.completed },
    { value: "new", label: "To contact", n: r.status.new ?? 0 },
    { value: "contacted", label: "Contacted", n: r.status.contacted ?? 0 },
    { value: "closed", label: "Closed", n: r.status.closed ?? 0 },
  ];

  return (
    <div className="grid max-w-6xl gap-5">
      <PageHeader
        title="Diagnostics"
        subtitle="People who took the free learning-path diagnostic (/diagnostic) without an account: contact them while the report is fresh."
        actions={
          <a href={exportHref} className="inline-flex h-10 items-center gap-2 rounded-xl border-2 border-border bg-white px-3.5 text-sm font-semibold text-brand-deep hover:border-primary/40">
            <Download className="size-4" aria-hidden /> Export CSV
          </a>
        }
      />

      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Leads (completed)", value: r.completed, accent: false },
          { label: "To contact", value: r.status.new ?? 0, accent: (r.status.new ?? 0) > 0 },
          { label: "Started", value: r.started, accent: false },
          { label: "Completion rate", value: r.started ? `${Math.round((r.completed / r.started) * 100)} %` : "—", accent: false },
        ].map((x) => (
          <div key={x.label} className={cn("flex flex-col-reverse rounded-2xl border bg-card px-4 py-3", x.accent ? "border-coral/50" : "border-border")}>
            <dt className="text-xs font-semibold text-muted-foreground">{x.label}</dt>
            <dd className={cn("font-heading text-2xl font-extrabold tabular-nums", x.accent ? "text-coral-dark" : "text-brand-deep")}>{x.value}</dd>
          </div>
        ))}
      </dl>

      <div className="grid gap-3 rounded-2xl border border-border bg-card p-3">
        <form action="/admin/diagnostics" className="flex flex-wrap gap-2">
          {status && <input type="hidden" name="statut" value={status} />}
          <label className="relative min-w-0 flex-1">
            <span className="sr-only">Search</span>
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <input name="q" defaultValue={q} placeholder="Search a name, email, phone or field (e.g. comptable)…" className={cn(inputCls, "pl-9")} />
          </label>
          <select name="profil" defaultValue={profile} className={cn(inputCls, "w-auto")} aria-label="Profile">
            <option value="">All profiles</option>
            {PROFILES.map((p) => (
              <option key={p} value={p}>
                {PROFILE_INFO[p].name}
              </option>
            ))}
          </select>
          <button type="submit" className="h-10 rounded-xl bg-primary px-4 text-sm font-bold text-white hover:brightness-110">
            Search
          </button>
          {(q || profile) && (
            <Link href={href({ q: "", profil: "" })} className="inline-flex h-10 items-center rounded-xl px-3 text-sm font-semibold text-muted-foreground hover:bg-muted">
              Clear
            </Link>
          )}
        </form>
        <nav aria-label="Follow-up status" className="flex flex-wrap gap-1.5">
          {tabs.map((t) => (
            <Link key={t.value || "all"} href={href({ statut: t.value })} className={cn("inline-flex items-center gap-1.5 rounded-full border-2 px-3 py-1 text-sm font-semibold", status === t.value ? "border-primary bg-primary text-white" : "border-border bg-white text-brand-deep hover:border-primary/40")}>
              {t.label}
              <span className={cn("rounded-full px-1.5 text-xs tabular-nums", status === t.value ? "bg-white/20" : "bg-muted")}>{t.n}</span>
            </Link>
          ))}
        </nav>
      </div>

      {r.done.length === 0 ? (
        <EmptyState>{q || status || profile ? "No diagnostic matches these filters." : "No completed diagnostic yet. Share the link: /diagnostic"}</EmptyState>
      ) : (
        <ul className="grid gap-3">
          {r.done.map((d) => {
            const l = d.lead!;
            const createHref = can.manageUsers(actor) ? `/admin/utilisateurs/nouveau?${new URLSearchParams({ prenom: l.firstName, nom: l.lastName ?? "", tel: l.phone ?? "", email: l.email })}` : null;
            return (
              <li key={String(d._id)} className={cn("grid gap-3 rounded-2xl border bg-card p-4", d.status === "new" ? "border-coral/40" : "border-border")}>
                <div className="flex flex-wrap items-start gap-3">
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-brand-deep font-heading text-sm font-extrabold text-white">{initials(l.firstName, l.lastName ?? "")}</span>
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-x-2">
                      <Link href={`/admin/diagnostics/${d._id}`} className="font-heading text-lg font-extrabold text-brand-deep hover:text-primary">
                        {l.firstName} {l.lastName}
                      </Link>
                      {l.field && (
                        <span className="inline-flex items-center gap-1 text-sm text-ink/70">
                          <Briefcase className="size-3.5" aria-hidden /> {l.field}
                        </span>
                      )}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {l.email}
                      {l.phone ? ` · ${displayPhone(l.phone)}` : ""} · {fmtDate(d.completedAt)}
                      {d.utmSource ? ` · via ${d.utmSource}` : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <span className="rounded-full bg-brand-soft px-2.5 py-1 text-xs font-bold text-primary">{name(d.primaryProfile)}</span>
                    {(d.secondaryProfiles ?? []).map((p) => (
                      <span key={p} className="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">
                        {name(p)}
                      </span>
                    ))}
                    {l.consentMarketing && <span className="rounded-full border border-primary/30 px-2.5 py-1 text-xs font-semibold text-primary">Newsletter</span>}
                    {d.reportEmailedAt && <span className="rounded-full border border-border px-2.5 py-1 text-xs font-semibold text-muted-foreground">Report emailed</span>}
                  </div>
                </div>
                <DiagnosticActions lead={{ id: String(d._id), status: d.status ?? "new", firstName: l.firstName, lastName: l.lastName ?? "", email: l.email, phone: l.phone ?? "", profile: name(d.primaryProfile) }} createHref={createHref} detailHref={`/admin/diagnostics/${d._id}`} />
              </li>
            );
          })}
        </ul>
      )}

      {r.abandoned.length > 0 && (
        <details className="rounded-2xl border border-border bg-card p-4">
          <summary className="flex cursor-pointer items-center gap-2 text-sm font-bold text-brand-deep">
            <Users className="size-4 text-primary" aria-hidden /> Unfinished diagnostics: where people stop ({r.started - r.completed})
          </summary>
          <ul className="mt-3 flex flex-wrap gap-2 text-sm">
            {r.abandoned.map((a) => (
              <li key={a.section} className="rounded-full bg-muted px-3 py-1">
                {a.section === 0 ? "During section 1" : `After « ${SECTIONS[a.section - 1]?.title ?? a.section} »`}: <strong>{a.count}</strong>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

export default function Page({ searchParams }: { searchParams: Promise<{ q?: string; statut?: string; profil?: string }> }) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Diagnostics searchParams={searchParams} />
    </Suspense>
  );
}
