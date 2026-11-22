"use client";

import { useLayoutEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, Ear, Link2, Loader2, Pause, Play, Volume2 } from "lucide-react";
import { submitLabAttempt } from "@/app/(app)/learn-actions";
import { pushReward } from "@/components/gamify/reward-store";
import { playSound } from "@/components/gamify/sound";
import { gradeActivity } from "@/lib/lab/grade";
import { starsFor } from "@/lib/lab/meta";
import { matchScreens, type MatchContent, type MatchPair } from "@/lib/lab/types";
import { ExerciseHeader, ResultsScreen, type ExerciseMeta } from "../shell/parts";
import { partnerColumn, reshuffle, seededOrder } from "../shell/shuffle";
import { cn } from "cn";

/*
 * V1 — Matching pairs (catalogue): a few pairs per screen, two shuffled columns (English on the
 * left) apart, an SVG layer between them. Tap a card on each side: a right pair draws a curved
 * blue arrow from the English card to its partner (it stays); a wrong one sends a red arrow that
 * stops half way and fades while the cards shake. Card positions are measured (ResizeObserver),
 * so the arrows follow wrapping text and screen sizes. The first
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
  listen,
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
  /** « Listen and match »: the right cards are audio (their text is the transcript, shown in the results). */
  listen?: boolean;
}) {
  const router = useRouter();
  const audio = useRef<HTMLAudioElement>(null);
  const startedAt = useRef<number | null>(null);
  const [pairs, setPairs] = useState(content.pairs);
  const [round, setRound] = useState(0);
  const [screen, setScreen] = useState(0);
  const [matched, setMatched] = useState<string[]>([]);
  const [selected, setSelected] = useState<{ side: Side; id: string } | null>(null);
  const [wrong, setWrong] = useState<{ left: string; right: string; n: number } | null>(null);
  // Arrow anchors: right edge of each left card, left edge of each right card (board coordinates).
  const board = useRef<HTMLDivElement>(null);
  const cardEls = useRef(new Map<string, HTMLElement>());
  // Which audio is playing (`left:<id>` / `right:<id>`), to animate its card.
  const [playing, setPlaying] = useState<string | null>(null);
  const [anchors, setAnchors] = useState<Record<string, { x: number; y: number }>>({});
  const [firstTry, setFirstTry] = useState<Record<string, string>>({});
  const [mistakes, setMistakes] = useState(0);
  const [result, setResult] = useState<Result | null>(null);
  const [timeS, setTimeS] = useState(0);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  const screens = matchScreens(pairs, content.perScreen);
  const current = screens[screen] ?? [];
  const left = seededOrder(current.length, `${round}:${screen}:L`).map((i) => current[i]);
  const right = partnerColumn(left, `${round}:${screen}:R`);
  const screenDone = current.length > 0 && current.every((p) => matched.includes(p.id));
  const isLast = screen === screens.length - 1;
  useLayoutEffect(() => {
    const el = board.current;
    if (!el) return;
    const measure = () => {
      const b = el.getBoundingClientRect();
      const next: Record<string, { x: number; y: number }> = {};
      for (const [key, card] of cardEls.current) {
        const r = card.getBoundingClientRect();
        next[key] = { x: (key.startsWith("left:") ? r.right : r.left) - b.left, y: r.top + r.height / 2 - b.top };
      }
      setAnchors(next);
    };
    // Called by the observer (on observe, then on every resize): cards wrapping, screen rotation…
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    for (const card of cardEls.current.values()) ro.observe(card);
    return () => ro.disconnect();
  }, [screen, round, result]);

  const meta: ExerciseMeta = listen
    ? { title, typeLabel: "Écouter et associer", icon: Ear, level, skills, instructions: instructions || "Écoutez chaque audio, puis associez-le au bon mot." }
    : { title, typeLabel: "Associer les paires", icon: Link2, level, skills, instructions: instructions || "Associez chaque mot à sa traduction." };

  const play = (p: MatchPair, side: Side = "left") => {
    const id = side === "left" ? p.audioMediaId : p.rightAudioMediaId;
    const src = id ? audioUrls[id] : undefined;
    const a = audio.current;
    if (!a || !src) return;
    startedAt.current ??= Date.now();
    if (a.getAttribute("src") !== src) a.src = src;
    a.currentTime = 0;
    setPlaying(`${side}:${p.id}`);
    void a.play().catch(() => setPlaying(null));
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
      setWrong({ left: l, right: r, n: mistakes + 1 });
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
        <audio ref={audio} preload="none" onEnded={() => setPlaying(null)} onPause={() => setPlaying(null)} />
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
            {listen && (
              <div className="grid gap-2">
                <p className="text-sm font-semibold text-brand-deep">Transcription des audios</p>
                <ul className="grid gap-2">
                  {pairs.map((p) => {
                    const ok = result.items.find((i) => i.id === p.id)?.correct;
                    return (
                      <li key={p.id} className="flex items-start gap-3 rounded-2xl bg-muted/50 px-3 py-2.5">
                        <span aria-hidden className={cn("mt-1.5 size-2.5 shrink-0 rounded-full", ok ? "bg-primary" : "bg-coral")} />
                        <span className="grid min-w-0 flex-1 gap-0.5">
                          <span lang="en" className="font-semibold text-brand-deep">
                            {p.left}
                          </span>
                          <span lang="en" className="text-ink">
                            « {p.right} »
                          </span>
                          {!ok && p.explanation && <span className="text-sm text-muted-foreground">{p.explanation}</span>}
                        </span>
                        {p.rightAudioMediaId && audioUrls[p.rightAudioMediaId] && (
                          <button type="button" onClick={() => play(p, "right")} className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-soft text-primary" aria-label={`Réécouter l'audio de « ${p.left} »`}>
                            <Volume2 className="size-4" aria-hidden />
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
            {!listen && missed.length > 0 && (
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
    matched: "cursor-default border-primary bg-brand-soft text-brand-deep",
  } as const;
  const anchorRef = (side: Side, p: MatchPair) => (el: HTMLElement | null) => {
    const k = `${side}:${p.id}`;
    if (el) cardEls.current.set(k, el);
    else cardEls.current.delete(k);
  };
  const renderCard = (side: Side, p: MatchPair) => {
    const st = cardState(side, p);
    if (listen && side === "right") {
      // Audio card: ▶ listens (as often as needed), the rest of the card chooses it.
      const n = right.indexOf(p) + 1;
      const isPlaying = playing === `right:${p.id}`;
      return (
        <div key={p.id} ref={anchorRef(side, p)} className={cn(card, "min-w-0 gap-0 overflow-hidden p-0", cls[st])}>
          <button
            type="button"
            onClick={() => (isPlaying ? audio.current?.pause() : play(p, "right"))}
            className={cn("m-1.5 flex size-9 shrink-0 items-center justify-center rounded-full transition sm:size-10", st === "matched" ? "bg-white text-primary" : "bg-primary text-white shadow-[0_3px_0_0_var(--color-brand-dark)] active:translate-y-0.5 active:shadow-none")}
            aria-label={isPlaying ? `Arrêter l'audio ${n}` : `Écouter l'audio ${n}`}
          >
            {isPlaying ? <Pause className="size-4" aria-hidden /> : <Play className="size-4 translate-x-px" aria-hidden />}
          </button>
          <button type="button" onClick={() => tap(side, p)} disabled={st === "matched" || readOnly} aria-pressed={st === "selected"} className="flex min-h-14 min-w-0 flex-1 items-center gap-2 py-2 pr-2.5 pl-1 text-left sm:pr-3">
            <span className="hidden h-6 min-w-0 flex-1 items-center gap-[3px] overflow-hidden sm:flex" aria-hidden>
              {[40, 75, 55, 95, 65, 85, 45, 70].map((h, k) => (
                <span key={k} className={cn("w-1 rounded-full", st === "matched" ? "bg-primary/50" : "bg-primary/35", isPlaying && "animate-pulse bg-primary")} style={{ height: `${h}%`, animationDelay: `${k * 90}ms` }} />
              ))}
            </span>
            <span className="flex-1 text-sm font-bold whitespace-nowrap sm:flex-none">Audio {n}</span>
            {st === "matched" && <Check className="size-4 shrink-0 text-primary" aria-hidden />}
          </button>
        </div>
      );
    }
    return (
      <button
        key={p.id}
        ref={anchorRef(side, p)}
        type="button"
        lang={side === "left" ? "en" : undefined} onClick={() => tap(side, p)} disabled={st === "matched" || readOnly} aria-pressed={st === "selected"} className={cn(card, cls[st])}>
        <span className="min-w-0 flex-1 break-words">{side === "left" ? p.left : p.right}</span>
        {st === "matched" ? <Check className="size-4 shrink-0 text-primary" aria-hidden /> : side === "left" && p.audioMediaId && audioUrls[p.audioMediaId] ? <Volume2 className="size-4 shrink-0 text-primary/60" aria-hidden /> : null}
      </button>
    );
  };

  return (
    <div className="mx-auto grid max-w-2xl gap-4">
      <audio ref={audio} preload="none" onEnded={() => setPlaying(null)} onPause={() => setPlaying(null)} />
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
        <div ref={board} className="relative grid grid-cols-[minmax(0,1fr)_clamp(2.75rem,16%,7rem)_minmax(0,1fr)]" role="group" aria-label={listen ? "Écoutez un audio à droite, puis associez-le à un mot à gauche" : "Touchez un mot à gauche puis sa traduction à droite"}>
          <div className="grid content-start gap-2.5 sm:gap-3">{left.map((p) => renderCard("left", p))}</div>
          <div aria-hidden />
          <div className="grid content-start gap-2.5 sm:gap-3">{right.map((p) => renderCard("right", p))}</div>
          <svg aria-hidden className="pointer-events-none absolute inset-0 size-full overflow-visible">
            {current
              .filter((p) => matched.includes(p.id))
              .map((p) => {
                const a = anchors[`left:${p.id}`];
                const b = anchors[`right:${p.id}`];
                return a && b ? <Arrow key={`${round}:${p.id}`} a={a} b={b} /> : null;
              })}
            {wrong && anchors[`left:${wrong.left}`] && anchors[`right:${wrong.right}`] && <Arrow key={`miss:${wrong.n}`} a={anchors[`left:${wrong.left}`]} b={anchors[`right:${wrong.right}`]} miss />}
          </svg>
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

/** Curved arrow between two cards (board coordinates): drawn on a right match, half way then fading on a wrong one. */
function Arrow({ a, b, miss }: { a: { x: number; y: number }; b: { x: number; y: number }; miss?: boolean }) {
  const start = { x: a.x + 3, y: a.y };
  const tip = { x: b.x - 2, y: b.y };
  const end = { x: tip.x - 8, y: tip.y };
  const dx = end.x - start.x;
  // Same row: bow upwards a little so it still reads as a curve.
  const bow = Math.abs(end.y - start.y) < 12 ? -Math.max(14, dx * 0.35) : 0;
  const d = `M ${start.x} ${start.y} C ${start.x + dx * 0.55} ${start.y + bow}, ${end.x - dx * 0.55} ${end.y + bow}, ${end.x} ${end.y}`;
  const color = miss ? "var(--color-coral)" : "var(--color-primary)";
  return (
    <g>
      <circle cx={start.x} cy={start.y} r={3.5} fill={color} className={miss ? "match-miss" : undefined} />
      <path d={d} pathLength={1} fill="none" stroke={color} strokeWidth={3} strokeLinecap="round" className={miss ? "match-miss" : "match-draw"} />
      {!miss && <polygon points={`${end.x - 1},${tip.y - 6} ${tip.x},${tip.y} ${end.x - 1},${tip.y + 6}`} fill={color} className="match-head" />}
    </g>
  );
}
