import Link from "next/link";
import { Photo } from "@/components/site/photo";
import { sendsAllowed, sendsLeft, sendsUsed } from "@/lib/learn/challenge";
import { headers } from "next/headers";
import { connection } from "next/server";
import { ChevronDown, ChevronLeft, ChevronRight, CircleCheck, Clock, Headphones, ListChecks, Lock, Mic, RotateCcw, Timer } from "lucide-react";
import { requireUser } from "@/lib/auth/dal";
import { courseAccess, courseTree } from "@/lib/learn/queries";
import { coursePath, examPath, stepPath } from "@/lib/learn/paths";
import { stepAfter, stepBefore } from "@/lib/learn/sequence";
import { ChallengeSubmission, type ChallengeSubmissionDoc } from "@/models";
import type { GapsContent, ListeningContent, SpeakingChallengeContent } from "@/lib/lab/types";
import { cleanLessonContent } from "@/lib/course/lesson-content";
import { mediaUrlFor } from "@/lib/media";
import { AccessProblem, formatDate } from "./ui";
import { RichText } from "./rich-text";
import { QuizRunner, type PublicQuestion } from "./quiz-runner";
import { ChallengeRecorder } from "./challenge-recorder";
import { CompleteButton } from "./complete-button";
import { LessonView, lessonMediaIds } from "./lesson-view";
import { PreviewBar, adminPaths } from "./preview-bar";
import { ListeningPlayer } from "@/components/lab/players/listening-player";
import { GapsPlayer } from "@/components/lab/players/gaps-player";

function Locked({ courseId, text }: { courseId: string; text: string }) {
  return (
    <div className="mx-auto max-w-md rounded-3xl border-2 border-border bg-card p-8 text-center">
      <Lock className="mx-auto size-12 text-muted-foreground" aria-hidden />
      <h1 className="mt-4 text-2xl font-extrabold text-brand-deep">Pas encore ouvert</h1>
      <p className="mt-2 text-muted-foreground">{text}</p>
      <Link href={coursePath(courseId)} className="mt-6 inline-flex h-11 items-center rounded-2xl bg-primary px-5 font-semibold text-white">
        Retour au parcours
      </Link>
    </div>
  );
}

const secs = (s: number) => (s >= 60 ? `${Math.floor(s / 60)} min${s % 60 ? ` ${s % 60} s` : ""}` : `${s} s`);
const KIND_LABEL = { lesson: "Leçon", activity: "Activité", challenge: "Défi oral" } as const;

/** Media id → URL (public staff media: lesson audio, listening clips, model answers). */
async function mediaUrls(viewerId: string, ids: string[]): Promise<Record<string, string>> {
  const entries = await Promise.all(ids.map(async (id) => [id, await mediaUrlFor({ id: viewerId, isAdmin: false }, id).catch(() => null)] as const));
  return Object.fromEntries(entries.filter((e): e is [string, string] => !!e[1]));
}

/**
 * Step player (owner spec §9.4): the unit's current step — a lesson (LessonView + « Continuer »),
 * an activity (its Lab player; below the pass score « Revoir la leçon ») or the speaking challenge —
 * with « Précédent » / « Suivant ».
 */
export async function StepPage({ courseId, stepId }: { courseId: string; stepId: string }) {
  await connection();
  const here = stepPath(courseId, stepId);
  const me = await requireUser(here);
  const access = await courseAccess(me, courseId);
  if (!access.ok) return <AccessProblem reason={access.reason} startDate={access.enrollment?.startDate} />;
  const tree = await courseTree(me, access);
  const { outline, steps, activities } = tree;

  const mod = outline.modules.find((m) => m.units.some((u) => u.steps.some((s) => s.id === stepId)));
  const unit = mod?.units.find((u) => u.steps.some((s) => s.id === stepId));
  const at = unit?.steps.findIndex((s) => s.id === stepId) ?? -1;
  const so = unit?.steps[at];
  const step = steps.find((s) => String(s._id) === stepId);
  if (!mod || !unit || !so || !step) return <AccessProblem reason="not-found" />;

  let state = so.state;
  // Offline download (service worker): steps of an open module are fetched ahead of order so they
  // can be done offline; completions are replayed in order and re-checked by the server.
  if (state === "locked" && mod.state !== "locked" && (await headers()).get("x-me-offline") === "1") state = "available";
  if (state === "locked" && !(so.kind === "challenge" && so.status)) return <Locked courseId={courseId} text="Terminez les activités précédentes pour ouvrir celle-ci." />;

  const prevHref = stepBefore(courseId, outline, here);
  const nextHref = stepAfter(courseId, outline, here);
  const course = coursePath(courseId);
  const activity = step.activityId ? activities.find((a) => String(a._id) === String(step.activityId)) : undefined;
  const editHref = so.kind === "lesson" ? adminPaths.step(courseId, stepId) : activity ? `/admin/labo/${activity._id}` : adminPaths.unit(courseId, unit.id);

  const header = (
    <header className="grid gap-3">
      {access.preview && <PreviewBar text={unit.hidden ? "Staff preview: this unit breaks the unit rules, learners don't see it. Nothing is saved." : "Staff preview: nothing is saved."} editHref={editHref} />}
      <nav aria-label="Activités" className="flex items-center justify-between gap-2 text-sm font-semibold">
        <Link href={prevHref} className="inline-flex items-center gap-1 text-muted-foreground hover:text-primary">
          <ChevronLeft className="size-4" aria-hidden /> {prevHref === course ? mod.title : "Précédent"}
        </Link>
        {(so.state === "completed" || (so.kind === "challenge" && so.status)) && nextHref !== course && (
          <Link href={nextHref} className="inline-flex items-center gap-1 text-primary">
            Suivant <ChevronRight className="size-4" aria-hidden />
          </Link>
        )}
      </nav>
      <div>
        <p className="text-xs font-bold tracking-wide text-primary uppercase">
          Unité {unit.index + 1} · {unit.title}
        </p>
        <div className="mt-2 flex gap-1" aria-label={`Activité ${at + 1} sur ${unit.steps.length}`} role="img">
          {unit.steps.map((s, i) => (
            <span key={s.id} className={`h-1.5 flex-1 rounded-full ${i === at ? "bg-coral" : s.state === "completed" || (s.kind === "challenge" && s.status) ? "bg-primary" : "bg-border"}`} />
          ))}
        </div>
        <p className="mt-2 text-xs font-semibold text-muted-foreground">
          {KIND_LABEL[so.kind]} · {at + 1} / {unit.steps.length}
          {so.estimatedMinutes ? ` · ${so.estimatedMinutes} min` : ""}
        </p>
      </div>
    </header>
  );

  // ── Lesson ──
  if (so.kind === "lesson") {
    const content = cleanLessonContent(step.content);
    const audio = await mediaUrls(me.id, lessonMediaIds(content));
    return (
      <article className="mx-auto grid max-w-3xl gap-6">
        {header}
        <h1 className="-mt-2 text-3xl font-extrabold text-brand-deep">{step.title}</h1>
        <LessonView title={step.title} content={content} audio={audio} />
        <div className="flex justify-end">
          {access.readOnly ? (
            <Link href={nextHref} className="inline-flex h-12 items-center rounded-2xl bg-primary px-6 font-semibold text-white">
              Activité suivante
            </Link>
          ) : (
            <CompleteButton courseId={courseId} stepId={stepId} done={so.state === "completed"} nextHref={nextHref} />
          )}
        </div>
      </article>
    );
  }

  if (!activity) return <AccessProblem reason="not-found" />;

  // ── Activity: its Lab player ──
  if (so.kind === "activity" && activity.type === "fill_gaps") {
    return (
      <div className="mx-auto grid max-w-2xl gap-4">
        {header}
        <div>
          <GapsPlayer
            courseId={courseId}
            stepId={stepId}
            passScore={so.passScore}
            lessonHref={so.lessonId ? stepPath(courseId, so.lessonId) : null}
            title={activity.title}
            level={activity.level ?? ""}
            skills={activity.skills ?? []}
            instructions={activity.instructions ?? ""}
            maelTip={activity.maelTip ?? ""}
            content={activity.content as GapsContent}
            courseHref={course}
            nextHref={nextHref}
            readOnly={access.readOnly}
          />
        </div>
      </div>
    );
  }
  if (so.kind === "activity") {
    if (activity.type !== "listen_choose") return <AccessProblem reason="not-found" />;
    const c = activity.content as ListeningContent;
    const audio = await mediaUrls(me.id, c.audioMediaId ? [c.audioMediaId] : []);
    return (
      <div className="mx-auto grid max-w-2xl gap-4">
        {header}
        {/* A block wrapper: the player centres itself (mx-auto), which would shrink it inside a grid cell. */}
        <div>
          <ListeningPlayer
          courseId={courseId}
          stepId={stepId}
          passScore={so.passScore}
          lessonHref={so.lessonId ? stepPath(courseId, so.lessonId) : null}
          title={activity.title}
          level={activity.level ?? ""}
          skills={activity.skills ?? []}
          instructions={activity.instructions ?? ""}
          maelTip={activity.maelTip ?? ""}
          context={c.context ? <RichText>{c.context}</RichText> : null}
          audioUrl={audio[c.audioMediaId] ?? null}
          content={c}
          courseHref={course}
          nextHref={nextHref}
          readOnly={access.readOnly}
          />
        </div>
      </div>
    );
  }

  // ── Speaking challenge ──
  const c = activity.content as SpeakingChallengeContent;
  const submission = access.preview ? null : await ChallengeSubmission.findOne({ userId: me.id, unitId: unit.id }).lean<ChallengeSubmissionDoc>();
  const mine = submission?.mediaId ? await mediaUrlFor({ id: me.id, isAdmin: false }, String(submission.mediaId)).catch(() => null) : null;
  const model = c.modelAnswerAudioMediaId ? (await mediaUrls(me.id, [c.modelAnswerAudioMediaId]))[c.modelAnswerAudioMediaId] : undefined;
  const mustInclude = c.mustInclude ?? [];
  const used = sendsUsed(submission);
  const allowed = sendsAllowed(submission);
  const left = sendsLeft(submission);

  return (
    <div className="mx-auto grid max-w-3xl gap-6">
      {header}
      {/* Banner: someone speaking (same photo as « My Speaking Challenge »). */}
      <div className="relative isolate -mt-2 overflow-clip rounded-3xl bg-brand-deep text-white">
        <div className="absolute inset-0 -z-20 sm:left-1/3">
          <Photo name="speaker" alt="" sizes="(max-width: 639px) 100vw, 520px" position="60% 30%" />
        </div>
        <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-t from-brand-deep via-brand-deep/85 to-brand-deep/25 sm:bg-gradient-to-r sm:from-brand-deep sm:via-brand-deep/90 sm:to-brand-deep/10" />
        <div className="grid gap-2 p-5 pt-32 sm:max-w-[65%] sm:p-7">
          <p className="inline-flex w-fit items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-bold tracking-wide uppercase">
            <Mic className="size-3.5" aria-hidden /> Défi oral · à vous de parler
          </p>
          <h1 className="text-2xl leading-tight font-extrabold text-white sm:text-3xl">{activity.title || "Défi oral"}</h1>
          <p className="inline-flex items-center gap-1.5 text-sm text-white/85">
            <Timer className="size-4 shrink-0" aria-hidden /> {secs(c.maxSeconds ?? 60)} maximum{c.prepSeconds ? ` · ${secs(c.prepSeconds)} pour vous préparer` : ""} · votre coach vous fait un retour
          </p>
        </div>
      </div>

      <section className="rounded-3xl border-2 border-border bg-card p-5 sm:p-8">
        <RichText>{c.instructions}</RichText>
      </section>

      {mustInclude.length > 0 && (
        <section className="rounded-3xl border-2 border-primary/20 bg-brand-soft p-5">
          <h2 className="flex items-center gap-2 font-heading font-extrabold text-brand-deep">
            <ListChecks className="size-5 text-primary" aria-hidden /> Dans votre réponse, pensez à…
          </h2>
          <ul className="mt-2 grid gap-1.5">
            {mustInclude.map((m, i) => (
              <li key={i} className="flex gap-2 text-ink">
                <CircleCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden /> {m}
              </li>
            ))}
          </ul>
        </section>
      )}

      {submission && (
        <section
          className={
            submission.status === "graded"
              ? "rounded-3xl border-2 border-success/30 bg-success/10 p-5"
              : submission.status === "returned"
                ? "rounded-3xl border-2 border-coral/30 bg-coral-soft p-5"
                : "rounded-3xl border-2 border-primary/20 bg-brand-soft p-5"
          }
        >
          <p className="flex items-center gap-2 font-heading text-lg font-bold text-brand-deep">
            {submission.status === "graded" ? <CircleCheck className="size-5 text-success" aria-hidden /> : submission.status === "returned" ? <RotateCcw className="size-5 text-coral-dark" aria-hidden /> : <Clock className="size-5 text-primary" aria-hidden />}
            {submission.status === "graded" ? "Validé par votre coach" : submission.status === "returned" ? "À reprendre : votre coach vous a fait un retour" : "Envoyé · votre coach va vous écouter"}
          </p>
          {submission.feedback && (
            <RichText legacy="text" className="mt-2 text-ink">
              {submission.feedback}
            </RichText>
          )}
          {mine && (
            <div className="mt-3">
              <p className="mb-1 text-sm font-semibold text-brand-deep">Votre enregistrement</p>
              <audio src={mine} controls preload="none" className="w-full" />
            </div>
          )}
          <p className="mt-2 text-xs text-muted-foreground">Envoyé le {formatDate(submission.updatedAt)}</p>
        </section>
      )}

      {/* Example answer: available from the start, folded so the learner tries first; open once they have sent. */}
      {(c.modelAnswerText || model) && (
        <details open={!!submission} className="group rounded-3xl border-2 border-border bg-card">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-5 font-heading font-extrabold text-brand-deep [&::-webkit-details-marker]:hidden">
            <span className="flex items-center gap-2">
              <Headphones className="size-5 text-primary" aria-hidden /> Écouter un exemple de réponse
            </span>
            <ChevronDown className="size-5 transition group-open:rotate-180 motion-reduce:transition-none" aria-hidden />
          </summary>
          <div className="border-t border-border px-5 pt-3 pb-5">
            {!submission && <p className="mb-2 text-sm text-muted-foreground">Conseil : essayez d&apos;abord seul(e), puis comparez.</p>}
            {model && <audio src={model} controls preload="none" className="w-full" />}
            {c.modelAnswerText && (
              <p lang="en" className="mt-2 whitespace-pre-line text-ink">
                {c.modelAnswerText}
              </p>
            )}
          </div>
        </details>
      )}

      {submission?.status === "graded" ? (
        <Link href={nextHref} className="inline-flex h-12 w-fit items-center rounded-2xl bg-primary px-6 font-semibold text-white">
          Activité suivante
        </Link>
      ) : access.readOnly ? (
        <p className="text-muted-foreground">Cours terminé : les envois sont fermés.</p>
      ) : (
        <section className="grid gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-xl font-extrabold text-brand-deep">{submission ? (left > 0 ? "Vous pouvez vous réenregistrer" : "Envois terminés") : "À vous de parler"}</h2>
            <SendsLeft used={used} allowed={allowed} />
          </div>
          {left > 0 ? (
            <>
              <p className="text-sm text-muted-foreground">
                {submission?.status === "pending" ? "Tant que votre coach n’a pas validé, un nouvel envoi remplace le précédent. " : ""}
                {left === 1 ? "C'est votre dernier envoi : prenez le temps de vous réécouter avant d'envoyer." : `Il vous reste ${left} envois pour ce défi.`}
              </p>
              <ChallengeRecorder courseId={courseId} stepId={stepId} maxSeconds={c.maxSeconds ?? 60} prepSeconds={c.prepSeconds ?? 0} preview={access.preview} resend={!!submission} courseHref={course} />
            </>
          ) : (
            <p className="rounded-2xl border-2 border-border bg-card p-4 text-ink">
              Vous avez utilisé vos {allowed} envois. Votre coach va écouter le dernier et vous faire un retour ; s&apos;il vous demande de le reprendre, un nouvel envoi s&apos;ouvrira.
            </p>
          )}
          <Link href="/mes-defis" className="w-fit text-sm font-semibold text-primary hover:underline">
            Voir « My Speaking Challenge » : tous mes défis et les retours de mon coach
          </Link>
        </section>
      )}
    </div>
  );
}

/** « Envoi 2 / 3 » as dots. */
function SendsLeft({ used, allowed }: { used: number; allowed: number }) {
  return (
    <p className="flex items-center gap-2 text-sm font-semibold text-muted-foreground" aria-label={`${used} envoi(s) utilisé(s) sur ${allowed}`}>
      <span className="flex gap-1" aria-hidden>
        {Array.from({ length: allowed }, (_, i) => (
          <span key={i} className={i < used ? "size-2.5 rounded-full bg-primary" : "size-2.5 rounded-full border-2 border-primary/40"} />
        ))}
      </span>
      {used} / {allowed} envois
    </p>
  );
}

/** Course final exam (opens once every module is complete). */
export async function ExamStep({ courseId }: { courseId: string }) {
  await connection();
  const here = examPath(courseId);
  const me = await requireUser(here);
  const access = await courseAccess(me, courseId);
  if (!access.ok) return <AccessProblem reason={access.reason} startDate={access.enrollment?.startDate} />;
  const { outline } = await courseTree(me, access);
  const quiz = access.course.finalExam;
  const step = outline.finalExam;
  if (!quiz?.questions?.length || !step) return <AccessProblem reason="not-found" />;
  if (step.state === "locked") return <Locked courseId={courseId} text="L'examen final s'ouvre quand tous les modules sont terminés." />;

  // Never send the answers to the browser.
  const questions: PublicQuestion[] = quiz.questions.map((q) => ({
    id: String((q as unknown as { _id: unknown })._id),
    text: q.text,
    options: q.options.map((o) => ({ id: o.id, text: o.text })),
  }));
  return (
    <>
      {access.preview && <PreviewBar text="Staff preview: the result isn't saved." editHref={adminPaths.finals(courseId)} className="mx-auto mb-6 max-w-2xl" />}
      <QuizRunner
        courseId={courseId}
        title={quiz.title || "Examen final"}
        questions={questions}
        passingScore={quiz.passingScore ?? 70}
        timeLimit={quiz.timeLimit ?? 0}
        bestScore={step.bestScore}
        courseHref={coursePath(courseId)}
        nextHref={stepAfter(courseId, outline, here)}
        readOnly={access.readOnly}
      />
    </>
  );
}
