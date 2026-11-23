import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { notFound, redirect } from "next/navigation";
import { Types } from "mongoose";
import { ArrowLeft, Briefcase, Footprints, Heart, Sparkles, Target, TriangleAlert } from "lucide-react";
import { actorOf, requireStaff } from "@/lib/admin/context";
import { can } from "@/lib/admin/permissions";
import { Diagnostic } from "@/models";
import { PROFILE_INFO, type ProfileId } from "@/lib/diagnostic/profiles";
import { OTHER, QUESTION, SCALE_LABELS, SECTIONS, type Answers } from "@/lib/diagnostic/questions";
import type { DiagnosticReport } from "@/lib/diagnostic/report-types";
import { displayPhone } from "@/lib/phone";
import { fmtDate } from "@/components/admin/ui";
import { DiagnosticActions } from "@/components/admin/diagnostic-actions";
import { PageSkeleton } from "@/components/learn/ui";
import { cn } from "cn";

export const metadata: Metadata = { title: "Diagnostic" };

const label = (a: Answers, id: string, v: unknown) => {
  const q = QUESTION[id];
  const one = (x: string) => (x === OTHER ? `Autre : ${a[`${id}_other`] ?? ""}` : (q.options?.find((o) => o.value === x)?.label ?? x));
  if (q.type === "scale") return `${v} / 5 · ${SCALE_LABELS[Number(v) - 1]}`;
  if (Array.isArray(v)) return v.map(one).join(" · ");
  return q.type === "text" ? `« ${v} »` : one(String(v));
};

async function Detail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await requireStaff(`/admin/diagnostics/${id}`);
  const actor = actorOf(me);
  if (!can.manageUsers(actor)) redirect("/admin");
  await connection();
  if (!Types.ObjectId.isValid(id)) notFound();
  const d = await Diagnostic.findById(id).lean();
  if (!d) notFound();
  const r = d.report as DiagnosticReport | null;
  const a = (d.answers ?? {}) as Answers;
  const l = d.lead;
  const scores = Object.entries((d.profileScores ?? {}) as Record<string, { points: number; normalized: number }>).sort((x, y) => y[1].normalized - x[1].normalized);
  const profileName = PROFILE_INFO[d.primaryProfile as ProfileId]?.name ?? d.primaryProfile;

  return (
    <div className="grid max-w-5xl gap-5">
      <Link href="/admin/diagnostics" className="inline-flex w-fit items-center gap-1.5 text-sm font-semibold text-primary hover:underline">
        <ArrowLeft className="size-4" aria-hidden /> Diagnostics
      </Link>

      {/* Who + how to reach them. */}
      <section className="grid gap-4 rounded-3xl border border-border bg-card p-5 sm:p-6">
        <div className="flex flex-wrap items-start gap-4">
          <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-brand-deep font-heading text-lg font-extrabold text-white">{`${l?.firstName?.[0] ?? "?"}${l?.lastName?.[0] ?? ""}`.toUpperCase()}</span>
          <div className="min-w-0 flex-1">
            <h1 className="font-heading text-2xl font-extrabold text-brand-deep">{l ? `${l.firstName} ${l.lastName ?? ""}` : "Unfinished diagnostic"}</h1>
            {l?.field && (
              <p className="flex items-center gap-1.5 text-ink/75">
                <Briefcase className="size-4" aria-hidden /> {l.field}
              </p>
            )}
            <p className="mt-1 text-sm text-muted-foreground">
              {[l?.email, l?.phone ? displayPhone(l.phone) : "", `completed ${fmtDate(d.completedAt ?? d.createdAt)}`, d.utmSource ? `via ${d.utmSource}` : "", l?.consentMarketing ? "newsletter: yes" : "newsletter: no", d.reportEmailedAt ? `report emailed ${fmtDate(d.reportEmailedAt)}` : "report not emailed"].filter(Boolean).join(" · ")}
            </p>
          </div>
        </div>
        {l && <DiagnosticActions size="lg" lead={{ id: String(d._id), status: d.status ?? "new", firstName: l.firstName, lastName: l.lastName ?? "", email: l.email, phone: l.phone ?? "", profile: profileName }} createHref={`/admin/utilisateurs/nouveau?${new URLSearchParams({ prenom: l.firstName, nom: l.lastName ?? "", tel: l.phone ?? "", email: l.email })}`} />}
      </section>

      <div className="grid items-start gap-5 lg:grid-cols-[1fr_20rem]">
        <div className="grid gap-5">
          {r && (
            <section lang="fr" className="grid gap-4 rounded-3xl border border-border bg-card p-5 sm:p-6">
              <div>
                <p className="text-xs font-bold tracking-wide text-primary uppercase">Report shown to them {d.reportSource === "fallback" ? "(ready-written version)" : "(AI)"}</p>
                <h2 className="mt-1 font-heading text-xl font-extrabold text-brand-deep">{r.headline}</h2>
                <p className="mt-2 text-ink/85">{r.profile_summary}</p>
              </div>
              <div className="grid gap-2">
                <p className="flex items-center gap-2 text-sm font-bold text-brand-deep">
                  <TriangleAlert className="size-4 text-coral" aria-hidden /> What holds them back
                </p>
                {r.what_holds_you_back.map((x, i) => (
                  <p key={i} className="rounded-xl bg-brand-soft/50 px-3 py-2 text-sm">
                    <strong className="text-brand-deep">{x.title}.</strong> {x.explanation}
                  </p>
                ))}
              </div>
              <p className="flex gap-2 rounded-xl border-2 border-coral/40 px-3 py-2 text-sm">
                <Heart className="mt-0.5 size-4 shrink-0 text-coral" aria-hidden /> {r.reframe}
              </p>
              <p className="flex flex-wrap items-center gap-1.5 text-sm">
                <Sparkles className="size-4 text-primary" aria-hidden />
                {r.your_strengths.map((x, i) => (
                  <span key={i} className="rounded-full bg-brand-soft px-2.5 py-0.5 text-primary">
                    {x}
                  </span>
                ))}
              </p>
              <ol className="grid gap-2 text-sm sm:grid-cols-3">
                {r.recommended_method.map((m, i) => (
                  <li key={i} className="rounded-xl border border-border p-3">
                    <p className="font-bold text-brand-deep">
                      {i + 1}. {m.title}
                    </p>
                    <p className="text-ink/75">{m.description}</p>
                  </li>
                ))}
              </ol>
              <p className="flex gap-2 text-sm">
                <Footprints className="mt-0.5 size-4 shrink-0 text-coral" aria-hidden /> {r.first_step_this_week}
              </p>
              <p className="flex gap-2 text-sm">
                <Target className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden /> {r.goal_reminder}
              </p>
            </section>
          )}

          <section lang="fr" className="grid gap-4 rounded-3xl border border-border bg-card p-5 sm:p-6">
            <h2 className="font-heading text-xl font-extrabold text-brand-deep">Answers</h2>
            {SECTIONS.map((s) => {
              const shown = s.questions.filter((q) => a[q.id] !== undefined);
              if (!shown.length) return null;
              return (
                <div key={s.id} className="grid gap-2">
                  <p className="text-xs font-bold tracking-wide text-primary uppercase">{s.title}</p>
                  <dl className="grid gap-2">
                    {shown.map((q) => (
                      <div key={q.id} className="rounded-xl bg-muted/40 px-3 py-2 text-sm">
                        <dt className="text-muted-foreground">{q.label}</dt>
                        <dd className="font-semibold text-brand-deep">{label(a, q.id, a[q.id])}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              );
            })}
          </section>
        </div>

        <aside className="grid gap-3 rounded-3xl border border-border bg-card p-5 lg:sticky lg:top-6">
          <h2 className="font-heading text-lg font-extrabold text-brand-deep">Profiles</h2>
          <ul className="grid gap-2.5">
            {scores.map(([p, s]) => {
              const main = p === d.primaryProfile;
              const sec = (d.secondaryProfiles ?? []).includes(p);
              return (
                <li key={p} className="grid gap-1">
                  <p className="flex items-center justify-between gap-2 text-sm">
                    <span className={cn(main ? "font-bold text-brand-deep" : sec ? "font-semibold text-ink" : "text-muted-foreground")}>
                      {PROFILE_INFO[p as ProfileId]?.name ?? p}
                      {main ? " · main" : sec ? " · secondary" : ""}
                    </span>
                    <span className="tabular-nums text-muted-foreground">{Math.round(s.normalized * 100)} %</span>
                  </p>
                  <span className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
                    <span className={cn("block h-full rounded-full", main ? "bg-coral" : sec ? "bg-primary" : "bg-primary/30")} style={{ width: `${Math.round(s.normalized * 100)}%` }} />
                  </span>
                </li>
              );
            })}
          </ul>
          <p className="text-xs text-muted-foreground">{PROFILE_INFO[d.primaryProfile as ProfileId]?.need}</p>
        </aside>
      </div>
    </div>
  );
}

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Detail params={params} />
    </Suspense>
  );
}
