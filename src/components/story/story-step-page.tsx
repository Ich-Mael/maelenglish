import Link from "next/link";
import { connection } from "next/server";
import { ChevronLeft, ChevronRight, Lock } from "lucide-react";
import { requireUser } from "@/lib/auth/dal";
import { cleanLessonContent } from "@/lib/course/lesson-content";
import { mediaUrlFor } from "@/lib/media";
import { StoryError, storyStep } from "@/lib/story/service";
import { episodePath, storyCtxId, storyStepPath } from "@/lib/story/paths";
import { activityPlayer } from "@/components/learn/step-pages";
import { LessonView, lessonMediaIds } from "@/components/learn/lesson-view";
import { CompleteButton } from "@/components/learn/complete-button";
import { PreviewBar } from "@/components/learn/preview-bar";

/*
 * A lesson or Lab activity of an episode's unit, played inside Story Mode with the regular
 * players (progress saved as in the course). Next = the following step, then back to the episode.
 */

async function mediaUrls(viewerId: string, ids: string[]): Promise<Record<string, string>> {
  const entries = await Promise.all(ids.map(async (id) => [id, await mediaUrlFor({ id: viewerId, isAdmin: false }, id).catch(() => null)] as const));
  return Object.fromEntries(entries.filter((e): e is [string, string] => !!e[1]));
}

function Problem({ text, href }: { text: string; href: string }) {
  return (
    <div className="mx-auto max-w-md rounded-3xl border-2 border-border bg-card p-8 text-center">
      <Lock className="mx-auto size-12 text-muted-foreground" aria-hidden />
      <p className="mt-4 text-lg font-semibold text-brand-deep">{text}</p>
      <Link href={href} className="mt-6 inline-flex h-11 items-center rounded-2xl bg-primary px-5 font-semibold text-white">
        Back to the episode
      </Link>
    </div>
  );
}

export async function StoryStepPage({ storyId, episodeId, stepId }: { storyId: string; episodeId: string; stepId: string }) {
  await connection();
  const back = episodePath(storyId, episodeId);
  const me = await requireUser(storyStepPath(storyId, episodeId, stepId));
  const viewer = { id: me.id, isStaff: me.isStaff };
  let ctx;
  try {
    ctx = await storyStep(viewer, storyId, episodeId, stepId);
  } catch (e) {
    if (e instanceof StoryError) return <Problem text={e.message} href={back} />;
    throw e;
  }
  const { steps, at, current, episode } = ctx;
  const next = steps[at + 1];
  const prev = steps[at - 1];
  const prevHref = prev ? storyStepPath(storyId, episodeId, String(prev.step._id)) : back;
  const nextHref = next ? storyStepPath(storyId, episodeId, String(next.step._id)) : back;
  const ctxId = storyCtxId(storyId, episodeId);
  const step = current.step;

  const header = (
    <header className="grid gap-3">
      {me.isStaff ? <PreviewBar text="Staff preview: your progress is saved for testing, without XP." editHref={current.activity ? `/admin/labo/${current.activity._id}` : `/admin`} /> : null}
      <nav aria-label="Activities" className="flex items-center justify-between gap-2 text-sm font-semibold">
        <Link href={prevHref} className="inline-flex items-center gap-1 text-muted-foreground hover:text-primary">
          <ChevronLeft className="size-4" aria-hidden /> {prev ? "Previous" : episode.title}
        </Link>
        <Link href={back} className="hidden text-muted-foreground hover:text-primary sm:inline">
          Episode overview
        </Link>
        <Link href={nextHref} className="inline-flex items-center gap-1 text-primary hover:underline">
          {next ? "Next" : "Back to the episode"} <ChevronRight className="size-4" aria-hidden />
        </Link>
      </nav>
      <div>
        <p className="text-xs font-bold tracking-wide text-coral-dark uppercase">
          Episode {episode.order} · Learn &amp; practise
        </p>
        {/* Each segment opens its step: learners move back and forth freely. */}
        <div className="mt-2 flex gap-1" aria-label={`Activity ${at + 1} of ${steps.length}`}>
          {steps.map((s, i) => (
            <Link key={String(s.step._id)} href={storyStepPath(storyId, episodeId, String(s.step._id))} aria-label={`${s.step.kind === "lesson" ? "Lesson" : "Activity"} ${i + 1}: ${s.step.title}`} aria-current={i === at ? "step" : undefined} className="flex flex-1 items-center py-1.5">
              <span className={`h-1.5 w-full rounded-full transition hover:opacity-80 ${i === at ? "bg-coral" : s.state === "completed" ? "bg-primary" : "bg-border"}`} />
            </Link>
          ))}
        </div>
        <p className="mt-2 text-xs font-semibold text-muted-foreground">
          {step.kind === "lesson" ? "Lesson" : "Activity"} · {at + 1} / {steps.length}
          {step.estimatedMinutes ? ` · ${step.estimatedMinutes} min` : ""}
        </p>
      </div>
    </header>
  );

  if (step.kind === "lesson") {
    const content = cleanLessonContent(step.content);
    const audio = await mediaUrls(me.id, lessonMediaIds(content));
    return (
      <article className="mx-auto grid max-w-3xl gap-6">
        {header}
        <h1 className="-mt-2 text-3xl font-extrabold text-brand-deep">{step.title}</h1>
        <LessonView title={step.title} content={content} audio={audio} />
        <div className="flex justify-end">
          <CompleteButton courseId={ctxId} stepId={stepId} done={current.state === "completed"} nextHref={nextHref} />
        </div>
      </article>
    );
  }
  if (!current.activity) return <Problem text="Activity not found." href={back} />;
  const lessonIn = step.lessonId && steps.some((s) => String(s.step._id) === String(step.lessonId));
  const player = await activityPlayer(current.activity, {
    viewerId: me.id,
    courseId: ctxId,
    stepId,
    passScore: step.passScore ?? null,
    lessonHref: lessonIn ? storyStepPath(storyId, episodeId, String(step.lessonId)) : null,
    courseHref: back,
    nextHref,
    readOnly: false,
    header,
  });
  return player ?? <Problem text="This activity can't be played here." href={back} />;
}
