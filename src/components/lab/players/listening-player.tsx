"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Headphones } from "lucide-react";
import { submitLabAttempt } from "@/app/(app)/learn-actions";
import { pushReward } from "@/components/gamify/reward-store";
import { playSound } from "@/components/gamify/sound";
import { checkItem, gradeActivity } from "@/lib/lab/grade";
import { starsFor } from "@/lib/lab/meta";
import { formatTime, lineAt, parseTranscript, type ListeningContent } from "@/lib/lab/types";
import { useExercise } from "../shell/use-exercise";
import { CheckBar, ExerciseHeader, FeedbackPanel, ResultsScreen, type ExerciseMeta } from "../shell/parts";
import { AudioPlayer, type AudioPlayerHandle } from "../ui/audio-player";
import { ChoiceCards } from "../ui/choice-cards";
import { reshuffle } from "../shell/shuffle";

/*
 * L1 — Listen & choose (catalogue): the audio stays pinned at the top, one question per screen,
 * « Vérifier » → right / wrong with the explanation, the transcript line where the answer is
 * heard and « Réécouter ce passage ». A right answer on the first try after exactly one play earns a
 * bonus. `maxPlays` (exam style) is lifted on the results screen, which also shows the full
 * transcript. « Recommencer » reshuffles the questions. Each item is checked here; the server recomputes the score (`submitLabAttempt`).
 * `preview` (Lab page): graded locally, nothing sent.
 */

type Result = { score: number; stars: number; bonus: number; bestScore?: number; xp?: number; items: { id: string; correct: boolean }[] };

export function ListeningPlayer({
  courseId,
  stepId,
  passScore,
  lessonHref,
  title,
  level,
  skills,
  instructions,
  maelTip,
  context,
  audioUrl,
  content,
  courseHref,
  nextHref,
  readOnly,
  preview,
}: {
  courseId?: string;
  stepId?: string;
  /** Activity step: pass score and the lesson it practises (« Revoir la leçon »). */
  passScore?: number | null;
  lessonHref?: string | null;
  title: string;
  level?: string;
  skills?: string[];
  instructions?: string;
  maelTip?: string;
  context: React.ReactNode;
  audioUrl: string | null;
  content: ListeningContent;
  courseHref: string;
  nextHref: string;
  readOnly?: boolean;
  preview?: boolean;
}) {
  const router = useRouter();
  const player = useRef<AudioPlayerHandle>(null);
  // First try in the order set by staff; « Recommencer » reshuffles.
  const [questions, setQuestions] = useState(content.questions);
  const ex = useExercise<string>(questions.map((q) => q.id));
  const [plays, setPlays] = useState(0);
  const [bonus, setBonus] = useState<string[]>([]);
  const [result, setResult] = useState<Result | null>(null);
  const [timeS, setTimeS] = useState(0);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const lines = parseTranscript(content.transcript);

  const meta: ExerciseMeta = { title, typeLabel: "Listening comprehension", icon: Headphones, level, skills, instructions };
  const q = questions[ex.index];

  const onCheck = () => {
    const ok = checkItem("listen_choose", content, q.id, ex.answer);
    if (ok && ex.tries === 0 && plays === 1) setBonus((b) => [...b, q.id]);
    playSound(ok ? "correct" : "wrong");
    ex.check(ok);
  };

  const finish = () => {
    const answers = { ...ex.firstTry };
    const timeSpentS = ex.elapsedS();
    setTimeS(timeSpentS);
    if (preview || !courseId || !stepId) {
      const g = gradeActivity("listen_choose", content, answers);
      setResult({ score: g.score, stars: starsFor(g.score), bonus: bonus.length, items: g.items });
      ex.next();
      return;
    }
    setError("");
    start(async () => {
      const r = await submitLabAttempt(courseId, stepId, { answers, bonus, timeSpentS, plays });
      if (!r.ok) return setError(r.error);
      pushReward(r.result.reward);
      setResult({ ...r.result, xp: r.result.reward?.xpGained });
      player.current?.pause();
      ex.next();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  };

  const restart = () => {
    setQuestions((cur) => reshuffle(content.questions, cur));
    ex.restart();
    setBonus([]);
    setResult(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const replay = (t: number) => player.current?.playFrom(t);
  const answerText = (qq: (typeof questions)[number]) => qq.options.find((o) => o.id === qq.correctOptionId)?.text ?? "";

  if (ex.phase === "done" && result) {
    const review = result.items
      .filter((i) => !i.correct)
      .map((i) => questions.find((x) => x.id === i.id)!)
      .map((qq) => ({ title: qq.text, answer: answerText(qq) }));
    return (
      <div className="mx-auto grid max-w-2xl gap-5">
        <ExerciseHeader meta={meta} courseHref={courseHref} index={questions.length} total={questions.length} done />
        <AudioPlayer ref={player} src={audioUrl} />
        <ResultsScreen
          score={result.score}
          stars={result.stars}
          bonus={result.bonus}
          timeS={timeS}
          xp={result.xp}
          bestScore={result.bestScore}
          review={review}
          maelTip={maelTip}
          preview={preview}
          passScore={passScore}
          lessonHref={lessonHref}
          onRetry={restart}
          onContinue={() => router.push(nextHref)}
        >
          {lines.length > 0 && (
            <details className="rounded-3xl border-2 border-border bg-card p-5" open={result.score < 100}>
              <summary className="cursor-pointer font-heading font-extrabold text-brand-deep">Transcription</summary>
              <div lang="en" className="mt-3 grid gap-1.5 leading-relaxed text-ink">
                {lines.map((l, i) => (
                  <p key={i} className="flex gap-2">
                    {l.startS !== null && audioUrl ? (
                      <button type="button" onClick={() => replay(l.startS!)} className="h-fit shrink-0 rounded-md bg-brand-soft px-1.5 font-mono text-xs font-semibold text-primary" aria-label={`Listen from ${formatTime(l.startS)}`}>
                        {formatTime(l.startS)}
                      </button>
                    ) : null}
                    <span>{l.text}</span>
                  </p>
                ))}
              </div>
            </details>
          )}
        </ResultsScreen>
      </div>
    );
  }

  const revealed = ex.phase === "feedback";
  const line = revealed ? lineAt(lines, q.startS) : -1;

  return (
    <div className="mx-auto grid max-w-2xl gap-4">
      <ExerciseHeader meta={meta} courseHref={courseHref} index={ex.index} total={questions.length} />
      {ex.index === 0 && ex.phase === "answer" && context && <div className="rounded-3xl border-2 border-border bg-card p-4 text-sm sm:p-5">{context}</div>}
      <AudioPlayer
        ref={player}
        src={audioUrl}
        maxPlays={content.maxPlays}
        limited
        onPlaysChange={(n) => {
          ex.touch();
          setPlays(n);
        }}
      />

      <section className="grid gap-3 rounded-3xl border-2 border-border bg-card p-4 sm:p-5">
        <p className="text-xs font-bold tracking-wide text-muted-foreground uppercase">
          Question {ex.index + 1} of {questions.length}
        </p>
        <h2 id={`q-${q.id}`} className="font-heading text-xl font-extrabold text-brand-deep">
          {q.text}
        </h2>
        <ChoiceCards options={q.options} value={ex.answer} onChange={(id) => !readOnly && ex.setAnswer(id)} reveal={revealed ? { correctId: q.correctOptionId } : null} labelledBy={`q-${q.id}`} />
        {revealed && ex.correct !== null && (
          <FeedbackPanel correct={ex.correct} answer={answerText(q)} explanation={q.explanation}>
            {line >= 0 && (
              <p lang="en" className="rounded-xl bg-white/70 px-3 py-2 text-sm text-ink">
                <span className="mr-1 text-muted-foreground">
                  In the audio:
                </span>
                « {lines[line].text} »
              </p>
            )}
            {q.startS !== null && audioUrl && (
              <button type="button" onClick={() => replay(q.startS!)} className="inline-flex w-fit items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-bold text-white">
                <Headphones className="size-3.5" aria-hidden /> Replay this part ({formatTime(q.startS)})
              </button>
            )}
          </FeedbackPanel>
        )}
      </section>

      {error && (
        <p role="alert" className="text-sm font-semibold text-coral-dark">
          {error}
        </p>
      )}
      {readOnly ? (
        <p className="text-sm text-muted-foreground">Course completed: you can still view the activity, but nothing is saved any more.</p>
      ) : (
        <CheckBar
          phase={ex.phase === "feedback" ? "feedback" : "answer"}
          canCheck={ex.answer !== undefined}
          correct={ex.correct}
          isLast={ex.isLast}
          pending={pending}
          onCheck={onCheck}
          onRetry={ex.retry}
          onNext={ex.isLast ? finish : ex.next}
        />
      )}
    </div>
  );
}
