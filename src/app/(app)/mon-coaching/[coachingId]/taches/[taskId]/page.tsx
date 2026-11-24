import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { CheckCircle2, ChevronLeft } from "lucide-react";
import { requireUser } from "@/lib/auth/dal";
import { connectDB } from "@/lib/db";
import { CoachingError, openTask } from "@/lib/coaching/service";
import { loadSubmissions } from "@/lib/coaching/queries";
import { coachingCtxId, coachingPath } from "@/lib/coaching/paths";
import { attemptsOn, partnerState, publicBrief } from "@/lib/conversation/queries";
import type { RolePlayContent, SpeakingChallengeContent } from "@/lib/lab/types";
import { mediaUrlFor } from "@/lib/media";
import { User } from "@/models";
import { coachLabel } from "@/lib/coach-name";
import { activityPlayer } from "@/components/learn/step-pages";
import { RolePlayPlayer } from "@/components/conversation/role-play-player";
import { ChallengePrompt } from "@/components/learn/challenge-prompt";
import { CoachFeedback } from "@/components/learn/coach-feedback";
import { RichText } from "@/components/learn/rich-text";
import { PageSkeleton } from "@/components/learn/ui";
import { ChallengeTask } from "@/components/coaching/challenge-task";

export const metadata: Metadata = { title: "My Coaching", robots: { index: false } };

/* A task of a coaching: a Lab activity (regular players), a speaking challenge (sent to the coach) or a role-play. */

type P = { params: Promise<{ coachingId: string; taskId: string }> };

async function Task({ params }: P) {
  await connection();
  const { coachingId, taskId } = await params;
  const me = await requireUser(`/mon-coaching/${coachingId}/taches/${taskId}`);
  await connectDB();
  const v = { id: me.id, role: me.role };
  let t;
  try {
    t = await openTask(v, taskId);
  } catch (e) {
    if (e instanceof CoachingError) notFound();
    throw e;
  }
  if (String(t.coaching._id) !== coachingId) notFound();
  const back = t.role === "coach" ? `/admin/coaching/${coachingId}?tab=tasks` : coachingPath(coachingId, "tasks");
  if (t.task.kind === "course") redirect(`/apprendre/${t.task.courseId}`);
  const a = t.activity;
  if (!a) notFound();
  const url = (id: string | null | undefined) => (id ? mediaUrlFor({ id: me.id, isAdmin: me.isStaff }, id).catch(() => null) : Promise.resolve(null));

  const header = (
    <header className="grid gap-2">
      <Link href={back} className="inline-flex w-fit items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-primary">
        <ChevronLeft className="size-4" aria-hidden /> {t.coaching.title}
      </Link>
      {t.role === "coach" && <p className="rounded-xl bg-brand-soft px-3 py-2 text-sm font-semibold text-brand-deep">Coach preview: you can try it, nothing is saved.</p>}
      {t.task.note && (
        <p lang="fr" className="rounded-2xl border-2 border-coral/40 bg-white p-3 text-sm text-brand-deep">
          <span className="font-bold">Note from your coach: </span>
          {t.task.note}
        </p>
      )}
    </header>
  );

  if (t.task.kind === "lab") {
    const player = await activityPlayer(a, { viewerId: me.id, courseId: coachingCtxId(taskId), stepId: taskId, passScore: null, lessonHref: null, courseHref: back, nextHref: back, readOnly: false, header });
    return player ?? notFound();
  }

  if (t.task.kind === "roleplay") {
    const c = a.content as RolePlayContent;
    const [state, attempts, briefAudioUrl] = await Promise.all([partnerState(me), attemptsOn(me.id, String(a._id)), url(c.briefAudioMediaId)]);
    const images = (await Promise.all((c.images ?? []).map(async (im) => ({ url: await url(im.mediaId), caption: im.caption })))).filter((x): x is { url: string; caption: string } => !!x.url);
    return (
      <div className="mx-auto grid max-w-5xl gap-4">
        {header}
        <RolePlayPlayer
          coachingTaskId={taskId}
          preview={t.role === "coach"}
          briefAudioUrl={briefAudioUrl}
          images={images}
          activityId={String(a._id)}
          title={a.title}
          level={a.level ?? ""}
          situation={c.situation ? <RichText lang="fr">{c.situation}</RichText> : null}
          brief={publicBrief(c)}
          available={state.available}
          minutesLeft={state.minutesLeft}
          capMinutes={state.capMinutes}
          courseHref={back}
          nextHref={back}
          attempts={attempts}
        />
      </div>
    );
  }

  // Speaking challenge.
  const c = a.content as SpeakingChallengeContent;
  const [promptUrl, modelUrl, subs, coachUser] = await Promise.all([url(c.promptType === "image" || c.promptType === "audio" ? c.promptMediaId : null), url(c.modelAnswerAudioMediaId), loadSubmissions(v, t.coaching, t.role, taskId), User.findById(t.coaching.coachId).select("name coachName avatarUrl").lean()]);
  const mine = t.role === "member" ? subs.find((x) => x.userId === me.id) : null;
  const canSend = t.role === "member" && mine?.status !== "validated";
  return (
    <div className="mx-auto grid max-w-2xl gap-5">
      {header}
      <h1 className="text-3xl font-extrabold text-brand-deep">{a.title}</h1>
      {c.instructions && <RichText lang="fr">{c.instructions}</RichText>}
      <ChallengePrompt c={c} mediaUrl={promptUrl} title={a.title} />
      {c.mustInclude?.length ? (
        <section className="rounded-2xl bg-brand-soft/60 p-4">
          <h2 className="font-bold text-brand-deep">In your answer, remember to…</h2>
          <ul className="mt-2 grid gap-1.5 text-sm">
            {c.mustInclude.map((m) => (
              <li key={m} lang="fr" className="flex gap-2">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden /> {m}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {mine && mine.status !== "pending" && (
        <CoachFeedback
          d={{
            status: mine.status === "validated" ? "graded" : "returned",
            grade: mine.grade,
            maxScore: 10,
            feedback: mine.comment,
            coach: coachUser ? { name: coachLabel(coachUser), avatarUrl: coachUser.avatarUrl ?? null } : null,
            voiceNote: mine.voiceUrl ? { url: mine.voiceUrl, seed: mine.id } : null,
          }}
        />
      )}
      {mine?.status === "pending" && <p className="rounded-2xl bg-brand-soft p-4 font-semibold text-brand-deep">Sent {mine.submitted}: your coach will listen and answer here. You can record it again until then.</p>}
      {mine?.recordingUrl && (
        <div className="grid gap-1">
          <p className="text-sm font-semibold text-muted-foreground">Your last recording</p>
          <audio src={mine.recordingUrl} controls preload="none" className="h-10 w-full" />
        </div>
      )}
      {canSend && <ChallengeTask taskId={taskId} maxSeconds={c.maxSeconds || 120} prepSeconds={c.prepSeconds || 0} label={mine ? "Send this new version" : "Send to my coach"} />}
      {t.role === "coach" && <p className="text-sm text-muted-foreground">Recordings sent by the people you coach appear in the coaching&apos;s Tasks tab, ready for your feedback.</p>}
      {(mine?.status === "validated" || t.role === "coach") && (c.modelAnswerText || modelUrl) && (
        <section className="grid gap-2 rounded-2xl border-2 border-border p-4">
          <h2 className="font-bold text-brand-deep">Example answer</h2>
          {modelUrl && <audio src={modelUrl} controls preload="none" className="h-10 w-full" />}
          {c.modelAnswerText && (
            <p lang="en" className="text-sm whitespace-pre-line">
              {c.modelAnswerText}
            </p>
          )}
        </section>
      )}
    </div>
  );
}

export default function Page(props: P) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Task {...props} />
    </Suspense>
  );
}
