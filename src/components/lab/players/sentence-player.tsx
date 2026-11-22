"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Blocks, Volume2 } from "lucide-react";
import { submitLabAttempt } from "@/app/(app)/learn-actions";
import { pushReward } from "@/components/gamify/reward-store";
import { playSound } from "@/components/gamify/sound";
import { checkItem, gradeActivity } from "@/lib/lab/grade";
import { starsFor } from "@/lib/lab/meta";
import { sentenceText, sentenceTiles, type SentenceContent, type SentenceItem } from "@/lib/lab/types";
import { useExercise } from "../shell/use-exercise";
import { CheckBar, ExerciseHeader, FeedbackPanel, ResultsScreen, type ExerciseMeta } from "../shell/parts";
import { reshuffle } from "../shell/shuffle";
import { cn } from "cn";

/*
 * V4 — Sentence builder (catalogue): one sentence per screen, its tiles (and distractors) shuffled
 * in a bank; the learner taps them in order (tap a placed tile to send it back), then « Vérifier ».
 * Optional French translation as the prompt; the sentence's audio is heard after checking (played
 * at once) or, in « before » mode, first — the learner rebuilds what they heard. Checked here, the
 * server recomputes the score (`submitLabAttempt`). `preview` (Lab page): graded locally.
 */

type Result = { score: number; stars: number; bestScore?: number; xp?: number; items: { id: string; correct: boolean }[] };

/** Stable pseudo-random order (same on the server and in the browser: no hydration mismatch), never the right order. */
function tileOrder(n: number, seed: string): number[] {
  let h = 2166136261;
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  const rand = () => {
    h = (Math.imul(h ^ (h >>> 15), 2246822507) + 0x9e3779b9) >>> 0;
    return h / 4294967296;
  };
  const out = Array.from({ length: n }, (_, i) => i);
  for (let attempt = 0; attempt < 8; attempt++) {
    for (let i = n - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    if (n < 2 || out.some((x, i) => x !== i)) break;
  }
  return out;
}

const tileCls = "rounded-xl border-2 px-3 py-2 text-base font-semibold leading-tight transition select-none";

export function SentencePlayer({
  courseId,
  stepId,
  passScore,
  lessonHref,
  title,
  level,
  skills,
  instructions,
  maelTip,
  content,
  audioUrls,
  courseHref,
  nextHref,
  readOnly,
  preview,
}: {
  courseId?: string;
  stepId?: string;
  passScore?: number | null;
  lessonHref?: string | null;
  title: string;
  level?: string;
  skills?: string[];
  instructions?: string;
  maelTip?: string;
  content: SentenceContent;
  /** Media id → playable URL of each sentence's audio. */
  audioUrls: Record<string, string>;
  courseHref: string;
  nextHref: string;
  readOnly?: boolean;
  preview?: boolean;
}) {
  const router = useRouter();
  const audio = useRef<HTMLAudioElement>(null);
  const [items, setItems] = useState(content.items);
  const [round, setRound] = useState(0);
  const ex = useExercise<string>(items.map((i) => i.id));
  const [picked, setPicked] = useState<number[]>([]);
  const [result, setResult] = useState<Result | null>(null);
  const [timeS, setTimeS] = useState(0);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  const meta: ExerciseMeta = { title, typeLabel: "Phrases en ordre", icon: Blocks, level, skills, instructions: instructions || "Remettez les mots dans le bon ordre." };
  const item = items[ex.index] as SentenceItem | undefined;
  const right = item ? sentenceTiles(item.sentence) : [];
  const tiles = item ? [...right, ...item.distractors] : [];
  const order = item ? tileOrder(tiles.length, `${item.id}:${round}`) : [];
  const url = item?.audioMediaId ? audioUrls[item.audioMediaId] : undefined;
  const before = content.audioWhen === "before" && !!url;
  const revealed = ex.phase === "feedback";

  const play = (src?: string) => {
    const a = audio.current;
    if (!a || !src) return;
    ex.touch();
    if (a.getAttribute("src") !== src) a.src = src;
    a.currentTime = 0;
    void a.play().catch(() => {});
  };

  const setTiles = (next: number[]) => {
    setPicked(next);
    ex.setAnswer(next.length ? next.map((i) => tiles[i]).join(" ") : undefined);
  };
  const add = (i: number) => !revealed && !readOnly && setTiles([...picked, i]);
  const remove = (k: number) => !revealed && !readOnly && setTiles(picked.filter((_, x) => x !== k));

  const onCheck = () => {
    if (!item) return;
    const ok = checkItem("sentence_builder", content, item.id, ex.answer);
    playSound(ok ? "correct" : "wrong");
    ex.check(ok);
    // Hearing the right sentence once it's built (after the click: autoplay is allowed).
    if (content.audioWhen === "after" && url) window.setTimeout(() => play(url), ok ? 350 : 700);
  };
  const retry = () => {
    setPicked([]);
    ex.retry();
  };
  const next = () => {
    audio.current?.pause();
    setPicked([]);
    ex.next();
  };

  const finish = () => {
    audio.current?.pause();
    const answers = { ...ex.firstTry };
    const timeSpentS = ex.elapsedS();
    setTimeS(timeSpentS);
    if (preview || !courseId || !stepId) {
      const g = gradeActivity("sentence_builder", content, answers);
      setResult({ score: g.score, stars: starsFor(g.score), items: g.items });
      ex.next();
      return;
    }
    setError("");
    start(async () => {
      const r = await submitLabAttempt(courseId, stepId, { answers, timeSpentS });
      if (!r.ok) return setError(r.error);
      pushReward(r.result.reward);
      setResult({ ...r.result, xp: r.result.reward?.xpGained });
      ex.next();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  };

  const restart = () => {
    setItems((cur) => reshuffle(content.items, cur));
    setRound((r) => r + 1);
    setPicked([]);
    ex.restart();
    setResult(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (ex.phase === "done" && result) {
    const review = result.items
      .filter((i) => !i.correct)
      .map((i) => items.find((x) => x.id === i.id)!)
      .map((it) => ({ title: it.translation || "Phrase à remettre en ordre", answer: sentenceText(it.sentence) }));
    return (
      <div className="mx-auto grid max-w-2xl gap-5">
        <audio ref={audio} preload="none" />
        <ExerciseHeader meta={meta} courseHref={courseHref} index={items.length} total={items.length} done />
        <ResultsScreen
          score={result.score}
          stars={result.stars}
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
          <details className="rounded-3xl border-2 border-border bg-card p-5" open={result.score < 100}>
            <summary className="cursor-pointer font-heading font-extrabold text-brand-deep">Toutes les phrases</summary>
            <ol className="mt-3 grid gap-2">
              {items.map((it) => {
                const u = it.audioMediaId ? audioUrls[it.audioMediaId] : undefined;
                const ok = result.items.find((x) => x.id === it.id)?.correct;
                return (
                  <li key={it.id} className="flex items-start gap-3 rounded-2xl bg-muted/50 px-3 py-2.5">
                    <span aria-hidden className={cn("mt-1.5 size-2.5 shrink-0 rounded-full", ok ? "bg-primary" : "bg-coral")} />
                    <span className="grid min-w-0 flex-1">
                      <span lang="en" className="font-semibold text-ink">
                        {sentenceText(it.sentence)}
                      </span>
                      {it.translation && <span className="text-sm text-muted-foreground">{it.translation}</span>}
                    </span>
                    {u && (
                      <button type="button" onClick={() => play(u)} className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-soft text-primary" aria-label="Écouter la phrase">
                        <Volume2 className="size-4" aria-hidden />
                      </button>
                    )}
                  </li>
                );
              })}
            </ol>
          </details>
        </ResultsScreen>
      </div>
    );
  }

  if (!item) return null;
  const correct = ex.correct;

  return (
    <div className="mx-auto grid max-w-2xl gap-4">
      <audio ref={audio} preload="none" />
      <ExerciseHeader meta={meta} courseHref={courseHref} index={ex.index} total={items.length} />

      <section className="grid gap-4 rounded-3xl border-2 border-border bg-card p-4 sm:p-5">
        <p className="text-xs font-bold tracking-wide text-muted-foreground uppercase">
          Phrase {ex.index + 1} sur {items.length}
        </p>

        {before ? (
          <button type="button" onClick={() => play(url)} className="flex items-center gap-3 rounded-2xl border-2 border-primary/25 bg-brand-soft p-3 text-left">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary text-white shadow-[0_4px_0_0_var(--color-brand-dark)]">
              <Volume2 className="size-6" aria-hidden />
            </span>
            <span>
              <span className="block font-heading font-extrabold text-brand-deep">Écoutez la phrase</span>
              <span className="text-sm text-muted-foreground">Puis remettez les mots dans l&apos;ordre entendu. Réécoutez autant que vous voulez.</span>
            </span>
          </button>
        ) : (
          item.translation && (
            <p className="font-heading text-xl font-extrabold text-brand-deep">
              <span className="text-primary">« </span>
              {item.translation}
              <span className="text-primary"> »</span>
            </p>
          )
        )}
        {before && item.translation && <p className="text-sm text-muted-foreground">Indice : {item.translation}</p>}

        {/* The sentence being built: tap a tile to send it back. */}
        <div
          aria-label="Votre phrase"
          className={cn(
            "flex min-h-28 flex-wrap content-start gap-2 rounded-2xl border-2 border-dashed p-3 transition",
            !revealed ? "border-border bg-background" : correct ? "border-primary bg-brand-soft/60" : "border-coral bg-coral-soft/50",
          )}
        >
          {picked.length === 0 && <span className="self-center text-sm text-muted-foreground">Touchez les mots dans l&apos;ordre…</span>}
          {picked.map((ti, k) => (
            <button
              key={`${ti}-${k}`}
              type="button"
              lang="en"
              onClick={() => remove(k)}
              disabled={revealed || readOnly}
              aria-label={`${tiles[ti]} (retirer)`}
              className={cn(tileCls, "bg-white shadow-[0_3px_0_0_var(--color-border)] disabled:cursor-default", revealed ? (correct ? "border-primary text-primary" : "border-coral text-ink") : "border-border text-ink hover:border-primary/40 active:translate-y-0.5 active:shadow-none")}
            >
              {tiles[ti]}
            </button>
          ))}
        </div>

        {/* The bank: a used tile leaves its place empty, so the others don't move. */}
        <div aria-label="Mots disponibles" className="flex flex-wrap justify-center gap-2">
          {order.map((ti) =>
            picked.includes(ti) ? (
              <span key={ti} aria-hidden lang="en" className={cn(tileCls, "border-transparent bg-muted text-transparent")}>
                {tiles[ti]}
              </span>
            ) : (
              <button
                key={ti}
                type="button"
                lang="en"
                onClick={() => add(ti)}
                disabled={revealed || readOnly}
                className={cn(tileCls, "border-border bg-white text-ink shadow-[0_3px_0_0_var(--color-border)] hover:border-primary/40 active:translate-y-0.5 active:shadow-none disabled:opacity-60")}
              >
                {tiles[ti]}
              </button>
            ),
          )}
        </div>

        {revealed && correct !== null && (
          <FeedbackPanel correct={correct} answer={<span lang="en">{sentenceText(item.sentence)}</span>} explanation={item.explanation}>
            {url && (
              <button type="button" onClick={() => play(url)} className="inline-flex w-fit items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-bold text-white">
                <Volume2 className="size-3.5" aria-hidden /> Écouter la phrase
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
        <p className="text-sm text-muted-foreground">Cours terminé : l&apos;activité reste consultable, mais plus rien n&apos;est enregistré.</p>
      ) : (
        <CheckBar phase={revealed ? "feedback" : "answer"} canCheck={picked.length > 0} correct={correct} isLast={ex.isLast} pending={pending} onCheck={onCheck} onRetry={retry} onNext={ex.isLast ? finish : next} />
      )}
    </div>
  );
}
