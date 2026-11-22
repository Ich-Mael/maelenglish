"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, Link2, Loader2, Volume2 } from "lucide-react";
import { submitLabAttempt } from "@/app/(app)/learn-actions";
import { pushReward } from "@/components/gamify/reward-store";
import { playSound } from "@/components/gamify/sound";
import { gradeActivity } from "@/lib/lab/grade";
import { starsFor } from "@/lib/lab/meta";
import { matchScreens, type MatchContent, type MatchPair } from "@/lib/lab/types";
import { ExerciseHeader, ResultsScreen, type ExerciseMeta } from "../shell/parts";
import { reshuffle, seededOrder } from "../shell/shuffle";
import { cn } from "cn";

/*
 * V1 — Matching pairs (catalogue): a few pairs per screen, two shuffled columns (English on the
 * left). Tap a card on each side: a right pair locks in blue, a wrong one shakes red. The first
 * card a left card is matched with counts for the score (a pair missed once is a mistake); the
 * results show mistakes and time, and the pairs to review with their explanation and audio. Tapping
 * an English card plays its audio. Checked here, the server recomputes the score
 * (`submitLabAttempt`). `preview` (Lab page): graded locally.
 */

type Result = { score: number; stars: number; bestScore?: number; xp?: number; items: { id: string; correct: boolean }[] };
type Side = "left" | "right";

const card =
  "flex min-h-14 w-full items-center gap-2 rounded-2xl border-2 px-3 py-2.5 text-left text-sm font-semibold leading-snug transition select-none sm:text-base";

export function MatchPlayer({
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
  content: MatchContent;
  /** Media id → playable URL of each English word / phrase. */
  audioUrls: Record<string, string>;
  courseHref: string;
  nextHref: string;
  readOnly?: boolean;
  preview?: boolean;
}) {
  const router = useRouter();
  const audio = useRef<HTMLAudioElement>(null);
  const startedAt = useRef<number | null>(null);
  const [pairs, setPairs] = useState(content.pairs);
  const [round, setRound] = useState(0);
  const [screen, setScreen] = useState(0);
  const [matched, setMatched] = useState<string[]>([]);
  const [selected, setSelected] = useState<{ side: Side; id: string } | null>(null);
  const [wrong, setWrong] = useState<{ left: string; right: string } | null>(null);
  const [firstTry, setFirstTry] = useState<Record<string, string>>({});
  const [mistakes, setMistakes] = useState(0);
  const [result, setResult] = useState<Result | null>(null);
  const [timeS, setTimeS] = useState(0);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  const screens = matchScreens(pairs, content.perScreen);
  const current = screens[screen] ?? [];
  const left = seededOrder(current.length, `${round}:${screen}:L`).map((i) => current[i]);
  const right = seededOrder(current.length, `${round}:${screen}:R`).map((i) => current[i]);
  const screenDone = current.length > 0 && current.every((p) => matched.includes(p.id));
  const isLast = screen === screens.length - 1;
  const meta: ExerciseMeta = { title, typeLabel: "Associer les paires", icon: Link2, level, skills, instructions: instructions || "Associez chaque mot à sa traduction." };

  const play = (p: MatchPair) => {
    const src = p.audioMediaId ? audioUrls[p.audioMediaId] : undefined;
    const a = audio.current;
    if (!a || !src) return;
    if (a.getAttribute("src") !== src) a.src = src;
    a.currentTime = 0;
    void a.play().catch(() => {});
  };

  const tap = (side: Side, p: MatchPair) => {
    if (readOnly || matched.includes(p.id) || wrong) return;
    startedAt.current ??= Date.now();
    if (side === "left") play(p);
    if (!selected || selected.side === side) {
      setSelected(selected?.side === side && selected.id === p.id ? null : { side, id: p.id });
      return;
    }
    const l = side === "left" ? p.id : selected.id;
    const r = side === "right" ? p.id : selected.id;
    setSelected(null);
    setFirstTry((f) => (l in f ? f : { ...f, [l]: r }));
    if (l === r) {
      playSound("correct");
      setMatched((m) => [...m, l]);
    } else {
      playSound("wrong");
      setMistakes((n) => n + 1);
      setWrong({ left: l, right: r });
      window.setTimeout(() => setWrong(null), 650);
    }
  };

  const finish = () => {
    audio.current?.pause();
    const answers = { ...firstTry };
    const timeSpentS = startedAt.current ? Math.round((Date.now() - startedAt.current) / 1000) : 0;
    setTimeS(timeSpentS);
    if (preview || !courseId || !stepId) {
      const g = gradeActivity("match_pairs", content, answers);
      setResult({ score: g.score, stars: starsFor(g.score), items: g.items });
      return;
    }
    setError("");
    start(async () => {
      const r = await submitLabAttempt(courseId, stepId, { answers, timeSpentS });
      if (!r.ok) return setError(r.error);
      pushReward(r.result.reward);
      setResult({ ...r.result, xp: r.result.reward?.xpGained });
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  };
  const nextScreen = () => {
    setScreen((s) => s + 1);
    setSelected(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const restart = () => {
    setPairs((cur) => reshuffle(content.pairs, cur));
    setRound((r) => r + 1);
    setScreen(0);
    setMatched([]);
    setSelected(null);
    setFirstTry({});
    setMistakes(0);
    setResult(null);
    startedAt.current = null;
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (result) {
    const missed = result.items.filter((i) => !i.correct).map((i) => pairs.find((p) => p.id === i.id)!);
    return (
      <div className="mx-auto grid max-w-2xl gap-5">
        <audio ref={audio} preload="none" />
        <ExerciseHeader meta={meta} courseHref={courseHref} index={screens.length} total={screens.length} done />
        <ResultsScreen
          score={result.score}
          stars={result.stars}
          timeS={timeS}
          xp={result.xp}
          bestScore={result.bestScore}
          review={[]}
          maelTip={maelTip}
          preview={preview}
          passScore={passScore}
          lessonHref={lessonHref}
          onRetry={restart}
          onContinue={() => router.push(nextHref)}
        >
          <section className="grid gap-3 rounded-3xl border-2 border-border bg-card p-5">
            <h2 className="font-heading text-lg font-extrabold text-brand-deep">
              {mistakes === 0 ? "Aucune erreur, bravo !" : `${mistakes} erreur${mistakes > 1 ? "s" : ""} · ${missed.length} paire${missed.length > 1 ? "s" : ""} à revoir`}
            </h2>
            {missed.length > 0 && (
              <ul className="grid gap-2">
                {missed.map((p) => (
                  <li key={p.id} className="flex items-start gap-3 rounded-2xl bg-muted/50 px-3 py-2.5">
                    <span className="grid min-w-0 flex-1 gap-0.5">
                      <span className="font-semibold text-ink">
                        <span lang="en">{p.left}</span> <span className="text-primary">→</span> {p.right}
                      </span>
                      {p.explanation && <span className="text-sm text-muted-foreground">{p.explanation}</span>}
                    </span>
                    {p.audioMediaId && audioUrls[p.audioMediaId] && (
                      <button type="button" onClick={() => play(p)} className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-soft text-primary" aria-label={`Écouter « ${p.left} »`}>
                        <Volume2 className="size-4" aria-hidden />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </ResultsScreen>
      </div>
    );
  }

  const cardState = (side: Side, p: MatchPair) => {
    if (matched.includes(p.id)) return "matched";
    if (wrong && wrong[side] === p.id) return "wrong";
    if (selected?.side === side && selected.id === p.id) return "selected";
    return "idle";
  };
  const cls = {
    idle: "border-border bg-white text-ink shadow-[0_3px_0_0_var(--color-border)] hover:border-primary/40 active:translate-y-0.5 active:shadow-none",
    selected: "border-primary bg-brand-soft text-brand-deep ring-4 ring-primary/15 shadow-[0_3px_0_0_var(--color-primary)]",
    wrong: "animate-shake border-coral bg-coral-soft text-coral-dark motion-reduce:animate-none",
    matched: "cursor-default border-transparent bg-gradient-to-br from-primary to-brand-deep text-white opacity-90",
  } as const;
  const renderCard = (side: Side, p: MatchPair) => {
    const st = cardState(side, p);
    return (
      <button key={p.id} type="button" lang={side === "left" ? "en" : undefined} onClick={() => tap(side, p)} disabled={st === "matched" || readOnly} aria-pressed={st === "selected"} className={cn(card, cls[st])}>
        <span className="min-w-0 flex-1 break-words">{side === "left" ? p.left : p.right}</span>
        {st === "matched" ? <Check className="size-4 shrink-0" aria-hidden /> : side === "left" && p.audioMediaId && audioUrls[p.audioMediaId] ? <Volume2 className="size-4 shrink-0 text-primary/60" aria-hidden /> : null}
      </button>
    );
  };

  return (
    <div className="mx-auto grid max-w-2xl gap-4">
      <audio ref={audio} preload="none" />
      <ExerciseHeader meta={meta} courseHref={courseHref} index={screen} total={screens.length} />

      <section className="grid gap-3 rounded-3xl border-2 border-border bg-card p-3 sm:p-5">
        <div className="flex items-center justify-between gap-2 px-1">
          <p className="text-xs font-bold tracking-wide text-muted-foreground uppercase">
            {screens.length > 1 ? `Série ${screen + 1} sur ${screens.length} · ` : ""}
            {current.filter((p) => matched.includes(p.id)).length} / {current.length} paires
          </p>
          {mistakes > 0 && (
            <p className="text-xs font-bold text-coral-dark">
              {mistakes} erreur{mistakes > 1 ? "s" : ""}
            </p>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2 sm:gap-3" role="group" aria-label="Touchez un mot à gauche puis sa traduction à droite">
          <div className="grid content-start gap-2 sm:gap-3">
            {left.map((p) => renderCard("left", p))}
          </div>
          <div className="grid content-start gap-2 sm:gap-3">
            {right.map((p) => renderCard("right", p))}
          </div>
        </div>
      </section>

      {error && (
        <p role="alert" className="text-sm font-semibold text-coral-dark">
          {error}
        </p>
      )}
      {readOnly ? (
        <p className="text-sm text-muted-foreground">Cours terminé : l&apos;activité reste consultable, mais plus rien n&apos;est enregistré.</p>
      ) : (
        screenDone && (
          <div className="sticky bottom-[var(--checkbar-bottom,4rem)] z-10 -mx-4 border-t border-border bg-background/95 px-4 py-3 md:bottom-0">
            <div className="mx-auto flex max-w-2xl">
              <button
                type="button"
                onClick={isLast ? finish : nextScreen}
                disabled={pending}
                className="inline-flex h-13 flex-1 items-center justify-center gap-2 rounded-2xl bg-primary px-6 text-lg font-bold text-white shadow-[0_5px_0_0_var(--color-brand-dark)] transition active:translate-y-1 active:shadow-[0_1px_0_0_var(--color-brand-dark)] disabled:opacity-50"
              >
                {pending && <Loader2 className="size-5 animate-spin" aria-hidden />}
                {isLast ? "Voir mon résultat" : "Série suivante"} {!pending && <ArrowRight className="size-5" aria-hidden />}
              </button>
            </div>
          </div>
        )
      )}
    </div>
  );
}
