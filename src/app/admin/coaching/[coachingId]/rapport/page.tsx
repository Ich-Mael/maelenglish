import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { requireStaff } from "@/lib/admin/context";
import { CoachingError } from "@/lib/coaching/service";
import { coachingProgress, monthsOf, reportComment, type MemberProgress } from "@/lib/coaching/progress";
import { coachLabel } from "@/lib/coach-name";
import { User } from "@/models";
import { PageHeader } from "@/components/admin/ui";
import { PageSkeleton } from "@/components/learn/ui";
import { RichText } from "@/components/learn/rich-text";
import { monthLabel } from "@/components/coaching/progress";
import { PrintButton, ReportCommentForm } from "@/components/coaching/report-controls";
import { levelsFor } from "@/lib/coaching/assessment";
import { LevelChange, ScoreBars } from "@/components/coaching/assessment-ui";
import { cn } from "cn";

/*
 * The monthly coaching report for the company that pays (owner decision 2026-11-25): coach only,
 * the controls in English, the report itself in French (it leaves the platform, like the emails).
 * « Print / Save as PDF » prints the report alone (print styles below).
 */

export const metadata: Metadata = { title: "Coaching report" };

type P = { params: Promise<{ coachingId: string }>; searchParams: Promise<{ mois?: string }> };

const TZ = process.env.APP_TZ || "Africa/Ouagadougou";
const frDay = (d: Date) => new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: TZ }).format(d);
const frMonth = (k: string) => monthLabel(k, "fr-FR");
const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)} %` : "—");

async function Report({ params, searchParams }: P) {
  await connection();
  const { coachingId } = await params;
  const me = await requireStaff(`/admin/coaching/${coachingId}/rapport`);
  const viewer = { id: me.id, role: me.role };
  const now = new Date();
  let data;
  try {
    data = await coachingProgress(viewer, coachingId, (await searchParams).mois, { now });
  } catch (e) {
    if (e instanceof CoachingError) notFound();
    throw e;
  }
  const { coaching, role, period, members, group } = data;
  if (role !== "coach") notFound();
  const month = period.month ?? monthsOf(coaching, now)[0];
  const [comment, coachUser, levels] = await Promise.all([reportComment(viewer, coachingId, month), User.findById(coaching.coachId).select("name surname coachName").lean(), levelsFor(coaching, members.map((m) => m.id))]);
  const tested = members.filter((m) => levels[m.id]?.start || levels[m.id]?.end);
  const mean = (xs: (number | null | undefined)[]) => {
    const ok = xs.filter((x): x is number => typeof x === "number");
    return ok.length ? Math.round((ok.reduce((a, b) => a + b, 0) / ok.length) * 10) / 10 : null;
  };
  const both = tested.filter((m) => levels[m.id]?.start?.overall != null && levels[m.id]?.end?.overall != null);
  const back = `/admin/coaching/${coachingId}?tab=progress&period=${month}`;
  const last = new Date(period.to.getTime() - 1);

  return (
    <div className="grid max-w-5xl gap-5">
      <style>{`@media print {
        body * { visibility: hidden !important; }
        #coaching-report, #coaching-report * { visibility: visible !important; }
        #coaching-report { position: absolute; left: 0; top: 0; width: 100%; border: 0 !important; box-shadow: none !important; padding: 0 !important; }
        #coaching-report .avoid-break { break-inside: avoid; }
        @page { margin: 14mm; }
      }`}</style>
      <PageHeader title="Monthly report" subtitle="For the company: print it or save it as a PDF, then send it." back={{ href: back, label: "Progress" }} actions={<PrintButton />} />

      <nav aria-label="Month" className="flex flex-wrap gap-1.5 text-sm">
        {monthsOf(coaching, now).map((m) => (
          <Link key={m} href={`?mois=${m}`} aria-current={m === month ? "page" : undefined} className={cn("rounded-full px-3 py-1.5 font-semibold", m === month ? "bg-brand-deep text-white" : "bg-muted text-brand-deep hover:bg-brand-soft")}>
            {monthLabel(m)}
          </Link>
        ))}
      </nav>

      <div className="rounded-3xl border-2 border-border bg-card p-4 sm:p-5">
        <ReportCommentForm key={month} coachingId={coachingId} month={month} comment={comment} />
      </div>

      <article id="coaching-report" lang="fr" className="grid gap-6 rounded-3xl border-2 border-border bg-white p-5 text-ink shadow-sm sm:p-8">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b-2 border-brand-soft pb-5">
          <div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/maelenglish-logo.webp" alt="MaelEnglish" className="h-9 w-auto" />
            <p className="mt-3 text-xs font-bold tracking-wide text-primary uppercase">Rapport de coaching · {frMonth(month)}</p>
            <h2 className="text-2xl font-extrabold text-brand-deep sm:text-3xl">{coaching.title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Du {frDay(period.from)} au {frDay(last)} · {members.length > 1 ? `${members.length} participants` : "Coaching individuel"}
            </p>
          </div>
          <div className="text-right text-sm">
            <p className="text-muted-foreground">Coach</p>
            <p className="font-bold text-brand-deep">{coachUser ? coachLabel(coachUser) : "—"}</p>
            <p className="mt-2 text-muted-foreground">Rapport établi le {frDay(now)}</p>
          </div>
        </header>

        {coaching.goal && (
          <section className="avoid-break grid gap-1">
            <h3 className="text-sm font-bold tracking-wide text-muted-foreground uppercase">Objectif du coaching</h3>
            <div className="text-[15px]">
              <RichText lang="fr">{coaching.goal}</RichText>
            </div>
          </section>
        )}

        <section className="avoid-break grid gap-3">
          <h3 className="text-sm font-bold tracking-wide text-muted-foreground uppercase">Le mois en chiffres</h3>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Figure label="Séances en direct" value={`${group.sessionsHeld}`} hint={group.sessionsHeld ? `présence ${pct(members.reduce((n, m) => n + m.sessions.attended, 0), members.reduce((n, m) => n + m.sessions.held, 0))}` : "aucune séance ce mois-ci"} />
            <Figure label="Expressions travaillées" value={`${group.expressions}`} hint={`${group.sentences} phrases écrites · ${group.vocabRate} % du travail demandé`} />
            <Figure label="Exercices réalisés" value={`${group.tasksDone} / ${group.tasksTotal}`} hint={`${group.validated} défis oraux validés`} />
            <Figure label="Objectifs atteints" value={`${group.goalsDone} / ${group.goalsTotal}`} hint={`${group.calls} conversations avec Coach Ish`} />
          </div>
        </section>

        {comment && (
          <section className="avoid-break grid gap-2 rounded-2xl bg-brand-soft/50 p-4">
            <h3 className="text-sm font-bold tracking-wide text-primary uppercase">Le mot du coach</h3>
            {comment.split(/\n{2,}/).map((p, i) => (
              <p key={i} className="text-[15px] leading-relaxed whitespace-pre-line">
                {p}
              </p>
            ))}
          </section>
        )}

        {tested.length > 0 && (
          <section className="avoid-break grid gap-3">
            <h3 className="text-sm font-bold tracking-wide text-muted-foreground uppercase">Évaluation orale (début → fin du coaching)</h3>
            <p className="text-sm text-muted-foreground">Les mêmes questions au début et à la fin, réponses enregistrées et notées par le coach sur 10 (aisance, vocabulaire, grammaire, prononciation, clarté du message).</p>
            {both.length > 1 && (
              <p className="text-[15px]">
                Moyenne du groupe : <LevelChange fr start={mean(both.map((m) => levels[m.id].start!.overall))} end={mean(both.map((m) => levels[m.id].end!.overall))} />
              </p>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              {tested.map((m) => {
                const l = levels[m.id];
                const latest = l.end ?? l.start;
                return (
                  <div key={m.id} className="avoid-break grid gap-2 rounded-2xl border-2 border-border p-4">
                    <p className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="font-bold text-brand-deep">{m.fullName}</span>
                      <LevelChange fr start={l.start?.overall} end={l.end?.overall} />
                    </p>
                    {latest && <ScoreBars fr scores={latest.scores} before={l.end ? l.start?.scores : null} />}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        <section className="grid gap-3">
          <h3 className="text-sm font-bold tracking-wide text-muted-foreground uppercase">{members.length > 1 ? "Par participant" : "Détail"}</h3>
          <div className="grid gap-3">
            {members.map((m) => (
              <MemberBlock key={m.id} m={m} />
            ))}
          </div>
        </section>

        <footer className="border-t border-border pt-4 text-xs text-muted-foreground">
          <p>
            <strong>Comment lire ce rapport.</strong> Vocabulaire : chaque jour, 3 expressions liées à l&apos;objectif ; chaque participant écrit 2 phrases par expression, corrigées aussitôt. « Correctes du premier coup » = phrases justes avant correction. Présence : confirmée par le coach après chaque séance (à défaut, connexion à la séance depuis l&apos;application). Exercices, défis et objectifs : état à la date du rapport.
          </p>
          <p className="mt-2">MaelEnglish · Speak the Language of Your Profession</p>
        </footer>
      </article>
    </div>
  );
}

function Figure({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-2xl border-2 border-brand-soft p-3">
      <p className="text-xs font-bold text-muted-foreground">{label}</p>
      <p className="font-heading text-2xl font-extrabold text-brand-deep">{value}</p>
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

function MemberBlock({ m }: { m: MemberProgress }) {
  const cells: [string, string, string?][] = [
    ["Vocabulaire", m.vocab.expected ? `${m.vocab.written} / ${m.vocab.expected} phrases` : "—", m.vocab.expected ? `${m.vocab.rate} % · ${m.vocab.activeDays} jour${m.vocab.activeDays > 1 ? "s" : ""} actif${m.vocab.activeDays > 1 ? "s" : ""}` : undefined],
    ["Correctes du premier coup", pct(m.vocab.correct, m.vocab.checked), m.notebook.saved ? `${m.notebook.saved} expression${m.notebook.saved > 1 ? "s" : ""} à réviser dans son carnet` : undefined],
    ["Séances", m.sessions.held ? `${m.sessions.attended} / ${m.sessions.held}` : "—", m.sessions.held ? `présence ${pct(m.sessions.attended, m.sessions.held)}` : undefined],
    ["Exercices", m.tasks.total ? `${m.tasks.done} / ${m.tasks.total}` : "—", m.tasks.late ? `${m.tasks.late} en retard` : undefined],
    ["Défis oraux", m.challenges.sent ? `${m.challenges.validated} validé${m.challenges.validated > 1 ? "s" : ""}` : "—", m.challenges.avgGrade != null ? `note moyenne ${String(m.challenges.avgGrade).replace(".", ",")}/10` : undefined],
    ["Conversations IA", `${m.calls.count}`, m.calls.avgScore != null ? `score moyen ${String(m.calls.avgScore).replace(".", ",")}/10` : undefined],
    ["Objectifs", m.goals.total ? `${m.goals.done} / ${m.goals.total} atteints` : "—", m.goals.inProgress ? `${m.goals.inProgress} en cours` : undefined],
  ];
  return (
    <div className="avoid-break rounded-2xl border-2 border-border p-4">
      <p className="font-bold text-brand-deep">{m.fullName}</p>
      <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
        {cells.map(([k, v, h]) => (
          <div key={k}>
            <dt className="text-xs text-muted-foreground">{k}</dt>
            <dd className="font-bold text-brand-deep">{v}</dd>
            {h && <dd className="text-xs text-muted-foreground">{h}</dd>}
          </div>
        ))}
      </dl>
    </div>
  );
}

export default function Page(props: P) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Report {...props} />
    </Suspense>
  );
}
