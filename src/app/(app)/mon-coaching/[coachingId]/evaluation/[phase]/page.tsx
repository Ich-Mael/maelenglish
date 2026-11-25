import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { CheckCircle2, ChevronLeft, Clock, Mic } from "lucide-react";
import { requireUser } from "@/lib/auth/dal";
import { connectDB } from "@/lib/db";
import { CoachingError } from "@/lib/coaching/service";
import { assessmentsFor, isPhase, suggestedPrompts, type AssessmentRow } from "@/lib/coaching/assessment";
import { coachingAssessmentPath, coachingPath } from "@/lib/coaching/paths";
import { mediaUrlFor } from "@/lib/media";
import { User } from "@/models";
import { Avatar } from "@/components/account/avatar";
import { PageSkeleton } from "@/components/learn/ui";
import { AnswerQuestion, AssessmentReviewForm, AssessmentSetupForm, SendAssessment } from "@/components/coaching/assessment-forms";
import { LevelChange, ScoreBars } from "@/components/coaching/assessment-ui";
import { cn } from "cn";

export const metadata: Metadata = { title: "Speaking assessment", robots: { index: false } };

/*
 * The speaking assessment of a coaching, start or end (owner decision 2026-11-25). A member records
 * one answer per question and sends them; the coach sets the questions up, listens to everyone
 * (one member at a time with ?member=) and scores 5 criteria. Media are signed after the coaching's
 * access check (assessmentsFor).
 */

type P = { params: Promise<{ coachingId: string; phase: string }>; searchParams: Promise<{ member?: string }> };
const TITLE = { start: "Start speaking assessment", end: "End speaking assessment" } as const;

async function Assessment({ params, searchParams }: P) {
  await connection();
  const { coachingId, phase } = await params;
  if (!isPhase(phase)) notFound();
  const me = await requireUser(`/mon-coaching/${coachingId}/evaluation/${phase}`);
  await connectDB();
  const v = { id: me.id, role: me.role };
  let data;
  try {
    data = await assessmentsFor(v, coachingId);
  } catch (e) {
    if (e instanceof CoachingError) notFound();
    throw e;
  }
  const { coaching, role } = data;
  const coach = role === "coach";
  const cur = data[phase];
  const other = phase === "end" ? data.start : null;
  const back = coach ? `/admin/coaching/${coachingId}?tab=progress` : coachingPath(coachingId, "progress");
  const sign = (id: string) => mediaUrlFor({ id: me.id, isAdmin: false }, id, { sharedWith: [me.id] }).catch(() => null);

  const header = (
    <header className="grid gap-2">
      <Link href={back} className="inline-flex w-fit items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-primary">
        <ChevronLeft className="size-4" aria-hidden /> {coaching.title}
      </Link>
      <p className="flex items-center gap-1.5 text-xs font-bold tracking-wide text-coral-dark uppercase">
        <Mic className="size-4" aria-hidden /> Speaking assessment
      </p>
      <h1 className="text-2xl font-extrabold text-brand-deep sm:text-3xl">{TITLE[phase]}</h1>
      <p className="max-w-2xl text-muted-foreground">
        {coach ? (phase === "start" ? "Each person answers the questions out loud (one recording per question). Listen and score 5 criteria: it's their starting point, shown in the progress view and the monthly report." : "The same questions as at the start: score them again to show each person's progress, start → end.") : phase === "start" ? "A few questions to answer out loud, about 5 minutes. It's your starting point: the same questions come back at the end of the coaching to measure your progress." : "The same questions as at the start: answer them again and see how far you've come."}
      </p>
    </header>
  );

  // ── The coach ──
  if (coach) {
    const people = await User.find({ _id: { $in: coaching.memberIds ?? [] } }).select("name surname avatarUrl").lean();
    const name = (id: string) => {
      const u = people.find((x) => String(x._id) === id);
      return u ? `${u.name} ${u.surname ?? ""}`.trim() : "—";
    };
    const sp = await searchParams;
    const answered = cur.rows.some((r) => r.answers.length > 0);
    const suggestion = cur.assessment ? { prompts: cur.assessment.prompts.map((p) => p.text), maxSeconds: cur.assessment.maxSeconds } : await suggestedPrompts(coaching._id, phase);
    const shown = cur.rows.filter((r) => !sp.member || r.userId === sp.member);
    return (
      <div className="mx-auto grid max-w-4xl gap-5">
        {header}
        {!answered && (
          <section className="grid gap-3 rounded-3xl border-2 border-border bg-card p-4 sm:p-5">
            <h2 className="font-extrabold text-brand-deep">{cur.assessment ? "The questions" : "Set up the assessment"}</h2>
            {!cur.assessment && phase === "end" && data.start.assessment && <p className="text-sm text-muted-foreground">The start&apos;s questions are filled in: keep them to compare fairly.</p>}
            <AssessmentSetupForm coachingId={coachingId} phase={phase} prompts={suggestion.prompts} maxSeconds={suggestion.maxSeconds} open={!!cur.assessment} />
          </section>
        )}
        {cur.assessment && people.length > 1 && (
          <nav aria-label="Show" className="flex flex-wrap gap-1.5 text-sm">
            <Link href={coachingAssessmentPath(coachingId, phase)} className={cn("rounded-full px-3 py-1.5 font-semibold", !sp.member ? "bg-brand-deep text-white" : "bg-muted text-brand-deep hover:bg-brand-soft")}>
              Everyone
            </Link>
            {cur.rows.map((r) => (
              <Link key={r.userId} href={coachingAssessmentPath(coachingId, phase, r.userId)} className={cn("rounded-full px-3 py-1.5 font-semibold", sp.member === r.userId ? "bg-brand-deep text-white" : "bg-muted text-brand-deep hover:bg-brand-soft")}>
                {name(r.userId)}
              </Link>
            ))}
          </nav>
        )}
        {cur.assessment && (
          <section className="grid gap-4">
            <h2 className="text-lg font-extrabold text-brand-deep">
              Answers · {cur.rows.filter((r) => r.submitted).length} / {cur.rows.length} sent · {cur.rows.filter((r) => r.reviewed).length} scored
            </h2>
            {shown.map((r) => (
              <CoachRow key={r.userId} r={r} name={name(r.userId)} avatar={people.find((x) => String(x._id) === r.userId)?.avatarUrl ?? null} prompts={cur.assessment!.prompts} sign={sign} before={other?.rows.find((x) => x.userId === r.userId) ?? null} />
            ))}
          </section>
        )}
      </div>
    );
  }

  // ── A member ──
  const mine = cur.rows[0];
  if (!cur.assessment)
    return (
      <div className="mx-auto grid max-w-3xl gap-5">
        {header}
        <p className="rounded-3xl border-2 border-dashed border-border p-6 text-center text-muted-foreground">Your coach hasn&apos;t opened this assessment yet.</p>
      </div>
    );
  const urls = Object.fromEntries(await Promise.all(mine.answers.map(async (a) => [a.promptId, await sign(a.mediaId)] as const)));
  const left = cur.assessment.prompts.filter((p) => !mine.answers.some((a) => a.promptId === p.id)).length;
  const before = other?.rows[0];
  return (
    <div className="mx-auto grid max-w-3xl gap-5">
      {header}
      {mine.reviewed && mine.scores ? (
        <section className="grid gap-4 rounded-3xl border-2 border-primary/30 bg-card p-5">
          <p className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="font-extrabold text-brand-deep">Your result</span>
            {phase === "end" && before?.overall != null ? <LevelChange start={before.overall} end={mine.overall} className="text-lg" /> : <span className="font-heading text-2xl font-extrabold text-brand-deep">{mine.overall}/10</span>}
          </p>
          <ScoreBars scores={mine.scores} before={phase === "end" ? before?.scores : null} />
          {mine.comment && (
            <p lang="fr" className="rounded-2xl bg-brand-soft/60 p-3 text-[15px] whitespace-pre-line text-ink">
              {mine.comment}
            </p>
          )}
        </section>
      ) : mine.submitted ? (
        <p className="flex items-center gap-2 rounded-3xl bg-brand-soft p-5 font-semibold text-brand-deep">
          <Clock className="size-5 text-primary" aria-hidden /> Sent! Your coach will listen and give you your scores here.
        </p>
      ) : null}
      <ol className="grid gap-4">
        {cur.assessment.prompts.map((p, i) => (
          <li key={p.id} className="grid gap-3 rounded-3xl border-2 border-border bg-card p-4 sm:p-5">
            <p className="flex items-start gap-3">
              <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-full font-bold", urls[p.id] ? "bg-primary text-white" : "bg-brand-soft text-primary")}>{urls[p.id] ? <CheckCircle2 className="size-5" aria-hidden /> : i + 1}</span>
              <span lang="fr" className="pt-1 text-[17px] font-semibold text-brand-deep">
                {p.text}
              </span>
            </p>
            {mine.submitted ? urls[p.id] ? <audio controls preload="none" src={urls[p.id]!} className="h-10 w-full" /> : null : <AnswerQuestion coachingId={coachingId} phase={phase} promptId={p.id} maxSeconds={cur.assessment!.maxSeconds} recordedUrl={urls[p.id] ?? null} />}
          </li>
        ))}
      </ol>
      {!mine.submitted && <SendAssessment coachingId={coachingId} phase={phase} left={left} />}
    </div>
  );
}

async function CoachRow({ r, name, avatar, prompts, sign, before }: { r: AssessmentRow; name: string; avatar: string | null; prompts: { id: string; text: string }[]; sign: (id: string) => Promise<string | null>; before: AssessmentRow | null }) {
  const urls = Object.fromEntries(await Promise.all(r.answers.map(async (a) => [a.promptId, await sign(a.mediaId)] as const)));
  return (
    <article className="grid gap-3 rounded-3xl border-2 border-border bg-card p-4 sm:p-5">
      <header className="flex flex-wrap items-center gap-3">
        <Avatar src={avatar} name={name} className="size-10" />
        <span className="min-w-0 flex-1 font-bold text-brand-deep">{name}</span>
        <span className={cn("rounded-full px-2.5 py-1 text-xs font-bold", r.reviewed ? "bg-primary text-white" : r.submitted ? "border border-coral bg-white text-coral-dark" : "bg-muted text-muted-foreground")}>{r.reviewed ? `Scored · ${r.overall}/10` : r.submitted ? "To score" : r.answers.length ? `Answering · ${r.answers.length} / ${prompts.length}` : "Not started"}</span>
      </header>
      {before?.overall != null && (
        <p className="text-sm text-muted-foreground">
          Start: <LevelChange start={before.overall} end={r.overall} />
        </p>
      )}
      {r.answers.length > 0 && (
        <ol className="grid gap-2">
          {prompts.map((p, i) => (
            <li key={p.id} className="grid gap-1 rounded-2xl bg-muted/50 p-3">
              <p lang="fr" className="text-sm font-semibold text-brand-deep">
                {i + 1}. {p.text}
              </p>
              {urls[p.id] ? <audio controls preload="none" src={urls[p.id]!} className="h-10 w-full" /> : <p className="text-xs text-muted-foreground">No answer yet.</p>}
            </li>
          ))}
        </ol>
      )}
      {r.submitted && r.id && <AssessmentReviewForm answerId={r.id} scores={r.scores} comment={r.comment} />}
    </article>
  );
}

export default function Page(props: P) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Assessment {...props} />
    </Suspense>
  );
}
