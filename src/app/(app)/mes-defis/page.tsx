import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { ArrowRight, BookOpen, CircleCheck, Clock, History, Layers, Mic, RotateCcw } from "lucide-react";
import { requireUser } from "@/lib/auth/dal";
import { connectDB } from "@/lib/db";
import { mediaUrlFor } from "@/lib/media";
import { sendsAllowed, sendsUsed } from "@/lib/learn/challenge";
import { coursePath, stepPath } from "@/lib/learn/paths";
import { Activity, ChallengeSubmission, Course, Module, Unit, User, type ChallengeSubmissionDoc } from "@/models";
import { RichText } from "@/components/learn/rich-text";
import { PageSkeleton, formatDate } from "@/components/learn/ui";
import { Photo } from "@/components/site/photo";
import { cn } from "cn";

export const metadata: Metadata = { title: "My Speaking Challenge", robots: { index: false } };

const STATUS = {
  pending: { label: "En attente de votre coach", icon: Clock, card: "border-primary/20", pill: "bg-brand-soft text-primary" },
  returned: { label: "À reprendre", icon: RotateCcw, card: "border-coral/40", pill: "border-2 border-coral bg-white text-coral-dark" },
  graded: { label: "Validé", icon: CircleCheck, card: "border-success/30", pill: "bg-success/12 text-success" },
} as const;

type Sub = ChallengeSubmissionDoc;

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
  const mainCoach = await User.findById(me.id).select("coachId").lean().then((u) => (u?.coachId ? User.findById(u.coachId).select("name surname").lean() : null));
  const [courses, modules, units, activities, coaches] = await Promise.all([
    Course.find({ _id: { $in: subs.map((s) => s.courseId) } }).select("title").lean(),
    Module.find({ _id: { $in: subs.map((s) => s.moduleId) } }).select("title order").lean(),
    Unit.find({ _id: { $in: subs.map((s) => s.unitId) } }).select("title order").lean(),
    Activity.find({ _id: { $in: subs.flatMap((s) => (s.activityId ? [s.activityId] : [])) } }).select("title").lean(),
    User.find({ _id: { $in: subs.flatMap((s) => (s.gradedBy ? [s.gradedBy] : [])) } }).select("name").lean(),
  ]);
  const find = <T extends { _id: unknown }>(list: T[], id: unknown) => list.find((x) => String(x._id) === String(id));
  // Every recording: the latest and the history (the learner owns them).
  const ids = [...new Set(subs.flatMap((s) => [String(s.mediaId), ...(s.history ?? []).map((h) => String(h.mediaId))]))];
  const urls: Record<string, string | null> = Object.fromEntries(await Promise.all(ids.map(async (id) => [id, await mediaUrlFor({ id: me.id, isAdmin: false }, id).catch(() => null)] as const)));

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
      validated: list.filter((s) => s.status === "graded").length,
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
  const totals = [
    { label: "Envoyés", value: subs.length },
    { label: "Validés", value: count("graded") },
    { label: "En attente", value: count("pending") },
    average !== null ? { label: "Note moyenne", value: `${average} %` } : { label: "À reprendre", value: count("returned") },
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
            <p className="inline-flex w-fit items-center gap-2 rounded-full bg-white/15 px-3 py-1.5 text-sm font-semibold">
              <span aria-hidden className="flex size-6 items-center justify-center rounded-full bg-white font-heading text-xs font-extrabold text-primary">
                {mainCoach.name?.slice(0, 1)}
              </span>
              Votre coach : {mainCoach.name} {mainCoach.surname}
            </p>
          )}
          {subs.length > 0 && (
            <dl className="mt-1 grid grid-cols-4 gap-2">
              {totals.map((t) => (
                <div key={t.label} className="flex flex-col-reverse rounded-2xl bg-white/12 px-3 py-2.5">
                  <dt className="text-[11px] leading-tight font-semibold text-white/75">{t.label}</dt>
                  <dd className="font-heading text-xl font-extrabold tabular-nums sm:text-2xl">{t.value}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      </section>

      {subs.length === 0 ? (
        <p className="rounded-3xl border-2 border-dashed border-border p-8 text-center text-muted-foreground">
          Pas encore de défi envoyé. Chaque unité se termine par un défi oral : il apparaîtra ici avec le retour de votre coach.
        </p>
      ) : (
        groups.map((g) => (
          <section key={g.courseId} aria-labelledby={`c-${g.courseId}`} className="grid gap-5">
            <div className="flex flex-wrap items-end justify-between gap-2 border-b-2 border-border pb-2">
              <h2 id={`c-${g.courseId}`} className="flex items-center gap-2 text-2xl font-extrabold text-brand-deep">
                <BookOpen className="size-6 text-primary" aria-hidden /> {g.title}
              </h2>
              <Link href={coursePath(g.courseId)} className="text-sm font-semibold text-primary hover:underline">
                {g.validated} / {g.total} validé{g.validated > 1 ? "s" : ""} · Voir le cours
              </Link>
            </div>
            {g.modules.map((m) => (
              <div key={m.moduleId} className="grid gap-3">
                <h3 className="flex items-center gap-2 text-sm font-bold tracking-wide text-primary uppercase">
                  <Layers className="size-4" aria-hidden />
                  {m.number < 999 ? `Module ${m.number} · ` : ""}
                  <span className="normal-case">{m.title}</span>
                </h3>
                <ol className="grid gap-3">
                  {m.subs.map((s) => (
                    <ChallengeCard key={String(s._id)} s={s} unit={find(units, s.unitId)?.title ?? ""} title={find(activities, s.activityId)?.title ?? "Défi oral"} coach={find(coaches, s.gradedBy)?.name ?? ""} urls={urls} />
                  ))}
                </ol>
              </div>
            ))}
          </section>
        ))
      )}
    </div>
  );
}

function ChallengeCard({ s, unit, title, coach, urls }: { s: Sub; unit: string; title: string; coach: string; urls: Record<string, string | null> }) {
  const st = STATUS[s.status as keyof typeof STATUS] ?? STATUS.pending;
  const earlier = (s.history ?? []).slice(0, -1).reverse();
  const latest = urls[String(s.mediaId)];
  return (
    <li className={cn("rounded-3xl border-2 bg-card p-5", st.card)}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-muted-foreground">{unit}</p>
          <h4 className="font-heading text-lg font-extrabold text-brand-deep">{title}</h4>
        </div>
        <span className={cn("inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold", st.pill)}>
          <st.icon className="size-3.5" aria-hidden /> {st.label}
        </span>
      </div>

      {s.status !== "pending" && (s.feedback || s.grade !== null) && (
        <div className="mt-3 rounded-2xl bg-muted/50 p-4">
          <p className="text-xs font-bold tracking-wide text-primary uppercase">
            Retour de {coach ? `votre coach ${coach}` : "votre coach"}
            {s.status === "graded" && s.grade !== null && s.grade !== undefined && (
              <span className="ml-2 rounded-full bg-success/12 px-2 py-0.5 text-success normal-case">
                {s.grade} / {s.maxScore}
              </span>
            )}
          </p>
          {s.feedback ? (
            <RichText legacy="text" className="mt-1 text-ink">
              {s.feedback}
            </RichText>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">Pas de commentaire écrit.</p>
          )}
          {s.gradedAt && <p className="mt-1 text-xs text-muted-foreground">Le {formatDate(s.gradedAt)}</p>}
        </div>
      )}

      <div className="mt-3">
        <p className="mb-1 text-sm font-semibold text-brand-deep">
          Dernier envoi · {formatDate(s.updatedAt)} · {sendsUsed(s)} / {sendsAllowed(s)} envois
        </p>
        {latest ? <audio src={latest} controls preload="none" className="w-full" /> : <p className="text-sm text-muted-foreground">Enregistrement indisponible.</p>}
      </div>

      {earlier.length > 0 && (
        <details className="mt-3">
          <summary className="flex cursor-pointer items-center gap-1.5 text-sm font-semibold text-primary">
            <History className="size-4" aria-hidden /> Mes essais précédents ({earlier.length})
          </summary>
          <ul className="mt-2 grid gap-2">
            {earlier.map((h, i) => (
              <li key={i} className="grid gap-1">
                <span className="text-xs text-muted-foreground">
                  Envoi {earlier.length - i} · {formatDate(h.sentAt)}
                </span>
                {urls[String(h.mediaId)] ? <audio src={urls[String(h.mediaId)]!} controls preload="none" className="w-full" /> : <span className="text-sm text-muted-foreground">Indisponible.</span>}
              </li>
            ))}
          </ul>
        </details>
      )}

      <Link href={stepPath(String(s.courseId), String(s.stepId))} className="mt-4 inline-flex items-center gap-1.5 text-sm font-bold text-coral-dark hover:underline">
        {s.status === "returned" ? "Reprendre le défi" : "Ouvrir le défi"} <ArrowRight className="size-4" aria-hidden />
      </Link>
    </li>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <MyChallenges />
    </Suspense>
  );
}
