import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { ArrowRight, BookOpen, ChevronDown, ChevronRight, CircleCheck, Clock, Layers, Mic, RotateCcw } from "lucide-react";
import { requireUser } from "@/lib/auth/dal";
import { connectDB } from "@/lib/db";
import { feedbackAudioUrl, mediaUrlFor } from "@/lib/media";
import { sendsAllowed, sendsLeft, sendsUsed } from "@/lib/learn/challenge";
import { previousAttempts, type AttemptItem } from "@/lib/learn/attempt-history";
import { AttemptHistory } from "@/components/learn/attempt-history";
import { ChallengeDialog } from "@/components/learn/challenge-dialog";
import { coursePath, stepPath } from "@/lib/learn/paths";
import { findProgram, programPhoto } from "@/lib/catalog";
import { Activity, ChallengeSubmission, Course, Module, Unit, User, type ChallengeSubmissionDoc } from "@/models";
import { AwaitingCoach, CoachFeedback, hasCoachFeedback } from "@/components/learn/coach-feedback";
import { PageSkeleton, formatDate } from "@/components/learn/ui";
import { Photo } from "@/components/site/photo";
import { Avatar } from "@/components/account/avatar";
import { coachInitialName, coachLabel } from "@/lib/coach-name";
import { cn } from "cn";

export const metadata: Metadata = { title: "My Speaking Challenge", robots: { index: false } };

const STATUS = {
  pending: { label: "En attente de votre coach", icon: Clock, row: "border-l-primary/40", dot: "bg-primary/40", pill: "bg-brand-soft text-primary", badge: "bg-brand-soft text-primary" },
  returned: { label: "À reprendre", icon: RotateCcw, row: "border-l-coral", dot: "bg-coral", pill: "border border-coral bg-white text-coral-dark", badge: "bg-coral-soft text-coral-dark" },
  graded: { label: "Validé", icon: CircleCheck, row: "border-l-brand-deep", dot: "bg-gradient-to-br from-primary to-brand-deep", pill: "bg-gradient-to-br from-primary to-brand-deep text-white", badge: "bg-gradient-to-br from-primary to-brand-deep text-white" },
} as const;

type Sub = ChallengeSubmissionDoc;
/** Validated once (kept while a redo is reviewed; older rows: status « graded »). */
const isValidated = (s: Sub) => s.status === "graded" || !!s.validatedAt;

/**
 * « My Speaking Challenge »: the learner's speaking challenges, grouped by course then module (in
 * course order) — status, coach feedback and grade, the last recording and the earlier ones, to
 * hear their progress. Header: photo of someone speaking, encouragement, totals.
 */
async function MyChallenges() {
  await connection();
  const me = await requireUser("/mes-defis");
  await connectDB();
  const subs = await ChallengeSubmission.find({ userId: me.id }).sort({ updatedAt: -1 }).lean<Sub[]>();
  const mainCoach = await User.findById(me.id).select("coachId").lean().then((u) => (u?.coachId ? User.findById(u.coachId).select("name coachName avatarUrl").lean() : null));
  const [courses, modules, units, activities, coaches] = await Promise.all([
    Course.find({ _id: { $in: subs.map((s) => s.courseId) } }).select("title imageUrl program").lean(),
    Module.find({ _id: { $in: subs.map((s) => s.moduleId) } }).select("title order").lean(),
    Unit.find({ _id: { $in: subs.map((s) => s.unitId) } }).select("title order").lean(),
    Activity.find({ _id: { $in: subs.flatMap((s) => (s.activityId ? [s.activityId] : [])) } }).select("title").lean(),
    User.find({ _id: { $in: subs.flatMap((s) => (s.gradedBy ? [s.gradedBy] : [])) } }).select("name coachName avatarUrl").lean(),
  ]);
  const find = <T extends { _id: unknown }>(list: T[], id: unknown) => list.find((x) => String(x._id) === String(id));
  // The latest recordings (the learner owns them; earlier ones come with `previousAttempts`).
  const ids = [...new Set(subs.map((s) => String(s.mediaId)))];
  const urls: Record<string, string | null> = Object.fromEntries(await Promise.all(ids.map(async (id) => [id, await mediaUrlFor({ id: me.id, isAdmin: false }, id).catch(() => null)] as const)));
  // Coach voice notes (shared with this learner by their submission).
  const notes: Record<string, string | null> = Object.fromEntries(await Promise.all(subs.filter((s) => s.feedbackAudioMediaId).map(async (s) => [String(s._id), await feedbackAudioUrl(me.id, s)] as const)));
  // Earlier sends with the coach's review of each (ids come from the learner's own submissions).
  const ownUrl = (id: string) => mediaUrlFor({ id: me.id, isAdmin: false }, id, { sharedWith: [me.id] });
  const earlierBySub: Record<string, AttemptItem[]> = Object.fromEntries(await Promise.all(subs.map(async (s) => [String(s._id), await previousAttempts(s, ownUrl)] as const)));

  // Course (most recent activity first) → module (course order) → challenges (unit order).
  const byCourse = new Map<string, Sub[]>();
  for (const s of subs) byCourse.set(String(s.courseId), [...(byCourse.get(String(s.courseId)) ?? []), s]);
  const groups = [...byCourse.entries()].map(([courseId, list]) => {
    const byModule = new Map<string, Sub[]>();
    for (const s of list) byModule.set(String(s.moduleId), [...(byModule.get(String(s.moduleId)) ?? []), s]);
    const order = (id: unknown, l: { _id: unknown; order?: number | null }[]) => find(l, id)?.order ?? 999;
    return {
      courseId,
      title: find(courses, courseId)?.title ?? "Cours",
      // The course picture, else its catalogue programme's photo (as on the course page).
      image: (() => {
        const c = find(courses, courseId);
        const program = findProgram(c?.program ?? "");
        return c?.imageUrl || (program ? programPhoto(program).small : null);
      })(),
      validated: list.filter(isValidated).length,
      total: list.length,
      modules: [...byModule.entries()]
        .sort(([a], [b]) => order(a, modules) - order(b, modules))
        .map(([moduleId, ms]) => ({
          moduleId,
          title: find(modules, moduleId)?.title ?? "Module",
          number: order(moduleId, modules),
          subs: [...ms].sort((a, b) => order(a.unitId, units) - order(b.unitId, units)),
        })),
    };
  });

  const count = (st: keyof typeof STATUS) => subs.filter((s) => s.status === st).length;
  const graded = subs.filter((s) => s.status === "graded" && s.grade !== null && s.grade !== undefined);
  const average = graded.length ? Math.round(graded.reduce((n, s) => n + ((s.grade ?? 0) / (s.maxScore || 100)) * 100, 0) / graded.length) : null;
  const totals: { label: string; value: number; unit?: string }[] = [
    { label: "Envoyés", value: subs.length },
    { label: "Validés", value: subs.filter(isValidated).length },
    { label: "En attente", value: count("pending") },
    average !== null ? { label: "Note moyenne", value: average, unit: "%" } : { label: "À reprendre", value: count("returned") },
  ];

  return (
    <div className="mx-auto grid max-w-3xl gap-8">
      {/* Header: someone speaking (photo), encouragement, totals. */}
      <section className="relative isolate overflow-clip rounded-3xl bg-brand-deep text-white">
        <div className="absolute inset-0 -z-20 sm:left-1/3">
          <Photo name="speaker" alt="" sizes="(max-width: 639px) 100vw, 520px" position="60% 30%" eager />
        </div>
        <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-t from-brand-deep via-brand-deep/85 to-brand-deep/30 sm:bg-gradient-to-r sm:from-brand-deep sm:via-brand-deep/90 sm:to-brand-deep/10" />
        <div className="grid gap-4 p-5 pt-40 sm:max-w-[62%] sm:p-8">
          <p className="inline-flex w-fit items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-bold tracking-wide uppercase">
            <Mic className="size-3.5" aria-hidden /> Défis oraux
          </p>
          <h1 lang="en" className="text-3xl leading-tight font-extrabold text-white sm:text-4xl">
            My Speaking Challenge
          </h1>
          <p className="leading-relaxed text-white/90">
            <strong className="text-white">Lancez-vous, chaque défi compte !</strong> C&apos;est en parlant qu&apos;on progresse : enregistrez-vous sans avoir peur de l&apos;erreur, votre coach est là pour vous guider. Réécoutez vos premiers essais : vous entendrez le chemin parcouru.
          </p>
          {mainCoach && (
            <p className="inline-flex w-fit items-center gap-2 rounded-full bg-white/15 py-1 pr-3.5 pl-1 text-sm font-semibold">
              <Avatar src={mainCoach.avatarUrl} name={coachInitialName(coachLabel(mainCoach))} className="size-7 bg-white text-xs text-primary" />
              Suivi par {coachLabel(mainCoach)}
            </p>
          )}
          {subs.length > 0 && (
            <dl className="mt-1 grid grid-cols-4 gap-2">
              {totals.map((t) => (
                <div key={t.label} className="flex flex-col-reverse rounded-2xl bg-white/12 px-3 py-2.5">
                  <dt className="text-[11px] leading-tight font-semibold text-white/75">{t.label}</dt>
                  <dd className="font-heading text-xl font-extrabold whitespace-nowrap tabular-nums sm:text-2xl">
                    {t.value}
                    {t.unit && <span className="ml-0.5 text-sm sm:text-base">{t.unit}</span>}
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      </section>

      {subs.length === 0 ? (
        <p className="rounded-3xl border-2 border-dashed border-border p-8 text-center text-muted-foreground">Pas encore de défi envoyé. Chaque unité se termine par un défi oral : il apparaîtra ici avec le retour de votre coach.</p>
      ) : (
        groups.map((g) => (
          <section key={g.courseId} aria-labelledby={`c-${g.courseId}`} className="grid overflow-clip rounded-3xl border-2 border-border bg-card sm:grid-cols-5">
            {/* Course card: picture (2/5 of the width; a banner on phones), then title, progress and one dropdown per module listing its unit challenges. */}
            <div className="relative h-36 bg-brand-soft sm:col-span-2 sm:h-auto sm:min-h-48">
              {g.image ? (
                // eslint-disable-next-line @next/next/no-img-element -- pre-sized catalogue photo or course image link, no image optimiser
                <img src={g.image} alt="" loading="lazy" className="absolute inset-0 size-full object-cover" />
              ) : (
                <span aria-hidden className="absolute inset-0 flex items-center justify-center bg-[radial-gradient(circle_at_30%_20%,var(--color-brand-soft),var(--color-primary)_140%)]">
                  <BookOpen className="size-12 text-primary/50" />
                </span>
              )}
            </div>
            <div className="grid min-w-0 content-start gap-4 p-4 sm:col-span-3 sm:p-6">
              <div className="grid gap-2">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <h2 id={`c-${g.courseId}`} className="flex min-w-0 items-center gap-2 text-xl font-extrabold text-brand-deep sm:text-2xl">
                    <BookOpen className="size-6 shrink-0 text-primary" aria-hidden /> {g.title}
                  </h2>
                  <Link href={coursePath(g.courseId)} className="text-sm font-semibold text-primary hover:underline">
                    Voir le cours
                  </Link>
                </div>
                <div className="flex items-center gap-3">
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-brand-soft" role="progressbar" aria-valuemin={0} aria-valuemax={g.total} aria-valuenow={g.validated} aria-label="Défis validés">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-primary to-brand-deep"
                      style={{
                        width: `${Math.round((g.validated / g.total) * 100)}%`,
                      }}
                    />
                  </div>
                  <span className="shrink-0 text-sm font-semibold text-muted-foreground tabular-nums">
                    {g.validated} / {g.total} validé{g.validated > 1 ? "s" : ""}
                  </span>
                </div>
              </div>
              <div className="grid gap-2">
                {g.modules.map((m, mi) => {
                  const toDo = m.subs.filter((s) => s.status !== "graded").length;
                  return (
                    // Open: modules with something waiting or to redo (else the first one).
                    <details key={m.moduleId} open={toDo > 0 || (mi === 0 && g.modules.every((x) => x.subs.every((s) => s.status === "graded")))} className="group rounded-2xl border border-border bg-background">
                      <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
                        <Layers className="size-5 shrink-0 text-primary" aria-hidden />
                        <span className="grid min-w-0 flex-1">
                          {m.number < 999 && <span className="text-xs font-bold tracking-wide text-primary uppercase">Module {m.number}</span>}
                          <span className="font-semibold text-brand-deep">{m.title}</span>
                        </span>
                        <span className="flex shrink-0 items-center gap-1" aria-label={`${m.subs.length} défi${m.subs.length > 1 ? "s" : ""}`}>
                          {m.subs.map((s) => (
                            <span key={String(s._id)} aria-hidden className={cn("size-2.5 rounded-full", STATUS[s.status as keyof typeof STATUS]?.dot ?? STATUS.pending.dot)} />
                          ))}
                        </span>
                        <ChevronDown className="size-5 shrink-0 text-muted-foreground transition group-open:rotate-180 motion-reduce:transition-none" aria-hidden />
                      </summary>
                      <ol className="grid gap-2 border-t border-border p-2">
                        {m.subs.map((s) => {
                          const unit = find(units, s.unitId);
                          const title = find(activities, s.activityId)?.title ?? "Défi oral";
                          const unitLabel = `${unit?.order ? `Unité ${unit.order} · ` : ""}${unit?.title ?? ""}`;
                          return (
                            <li key={String(s._id)}>
                              <ChallengeDialog id={String(s._id)} title={title} subtitle={unitLabel} trigger={<ChallengeRow s={s} unit={unitLabel} title={title} />}>
                                <ChallengeDetails s={s} coach={find(coaches, s.gradedBy) ?? null} mainCoach={mainCoach ? coachLabel(mainCoach) : ""} latest={urls[String(s.mediaId)] ?? null} voiceNote={notes[String(s._id)] ?? null} earlier={earlierBySub[String(s._id)] ?? []} />
                              </ChallengeDialog>
                            </li>
                          );
                        })}
                      </ol>
                    </details>
                  );
                })}
              </div>
            </div>
          </section>
        ))
      )}
    </div>
  );
}

type Coach = {
  name?: string | null;
  coachName?: string | null;
  avatarUrl?: string | null;
};

const statusLabel = (s: Sub) => (s.status === "pending" && s.validatedAt ? "Validé · nouvelle version" : (STATUS[s.status as keyof typeof STATUS] ?? STATUS.pending).label);

/** One challenge in its module's list: status, unit, title, grade; opens the details in a modal. */
function ChallengeRow({ s, unit, title }: { s: Sub; unit: string; title: string }) {
  const st = STATUS[s.status as keyof typeof STATUS] ?? STATUS.pending;
  return (
    <span className={cn("flex items-center gap-3 rounded-xl border-l-4 bg-card px-3 py-2.5 transition hover:bg-brand-soft/60", st.row)}>
      <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-full", st.badge)}>
        <st.icon className="size-4" aria-hidden />
      </span>
      <span className="grid min-w-0 flex-1">
        <span className="truncate text-xs text-muted-foreground">{unit}</span>
        <span className="font-semibold break-words text-brand-deep">{title}</span>
        <span className={cn("mt-0.5 w-fit rounded-full px-2 py-0.5 text-[11px] font-bold", st.pill)}>
          {statusLabel(s)}
          {s.status === "graded" && s.grade != null ? ` · ${s.grade}/${s.maxScore || 100}` : ""}
        </span>
      </span>
      <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
    </span>
  );
}

/** Inside the modal: coach feedback (or waiting), the latest recording, earlier sends, and the way back to the challenge. */
function ChallengeDetails({ s, coach, mainCoach, latest, voiceNote, earlier }: { s: Sub; coach: Coach | null; mainCoach: string; latest: string | null; voiceNote: string | null; earlier: AttemptItem[] }) {
  const feedback = {
    status: s.status,
    grade: s.grade,
    maxScore: s.maxScore,
    feedback: s.feedback,
    gradedAt: s.gradedAt,
    coach: coach ? { name: coachLabel(coach), avatarUrl: coach.avatarUrl } : null,
    voiceNote: voiceNote
      ? {
          url: voiceNote,
          seed: String(s.feedbackAudioMediaId),
          durationS: s.feedbackAudioDurationS,
        }
      : null,
  };
  const st = STATUS[s.status as keyof typeof STATUS] ?? STATUS.pending;
  return (
    <>
      <span className={cn("inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold", st.pill)}>
        <st.icon className="size-3.5" aria-hidden /> {statusLabel(s)}
      </span>

      {s.status === "pending" ? <AwaitingCoach coachName={mainCoach || undefined} /> : hasCoachFeedback(feedback) && <CoachFeedback d={feedback} />}

      <div>
        <p className="mb-1 text-sm font-semibold text-brand-deep">
          Dernier envoi · {formatDate(s.submittedAt ?? s.updatedAt)} · {sendsUsed(s)} / {sendsAllowed(s)} envois
        </p>
        {latest ? <audio src={latest} controls preload="none" className="w-full" /> : <p className="text-sm text-muted-foreground">Enregistrement indisponible.</p>}
      </div>

      <AttemptHistory items={earlier} />

      <Link href={stepPath(String(s.courseId), String(s.stepId))} className="inline-flex items-center gap-1.5 text-sm font-bold text-coral-dark hover:underline">
        {s.status === "returned" ? "Reprendre le défi" : s.status === "graded" && sendsLeft(s) > 0 ? "Refaire le défi" : "Ouvrir le défi"} <ArrowRight className="size-4" aria-hidden />
      </Link>
    </>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <MyChallenges />
    </Suspense>
  );
}
