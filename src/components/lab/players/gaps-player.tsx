"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, TextCursorInput, X } from "lucide-react";
import { submitLabAttempt } from "@/app/(app)/learn-actions";
import { pushReward } from "@/components/gamify/reward-store";
import { playSound } from "@/components/gamify/sound";
import { checkItem, gradeActivity } from "@/lib/lab/grade";
import { normalizeEnglish } from "@/lib/ai/text";
import { starsFor } from "@/lib/lab/meta";
import { parseGaps, type GapsContent, type GapSegment } from "@/lib/lab/types";
import { CheckBar, ExerciseHeader, ResultsScreen, type ExerciseMeta } from "../shell/parts";
import { GapText, type GapState } from "../ui/gap-text";
import { cn } from "cn";

/*
 * Fill the gaps (learner): the whole text on one screen, each blank showing the shape of its
 * answer. « Vérifier » marks every blank right / wrong (right answer + explanation for the wrong
 * ones); « Réessayer » empties only the wrong blanks to practise — the score counts the first
 * check. Optional word bank: tap a word to put it in the selected (or first empty) blank.
 * Checked here; the server recomputes the score (`submitLabAttempt`). `preview`: nothing sent.
 */

type Result = { score: number; stars: number; bestScore?: number; xp?: number; items: { id: string; correct: boolean }[] };

const joined = (w: string[] | undefined) => (w ?? []).map((x) => x.trim()).filter(Boolean).join(" ");

/** The line holding a blank, with « ___ » in place of every blank (results review). */
function lineWith(lines: GapSegment[][], gapId: string): string {
  const line = lines.find((l) => l.some((s) => s.kind === "gap" && s.gap.id === gapId)) ?? [];
  return line.map((s) => (s.kind === "text" ? s.text : s.gap.id === gapId ? "___" : "…")).join("").trim();
}

export function GapsPlayer({
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
  content: GapsContent;
  courseHref: string;
  nextHref: string;
  readOnly?: boolean;
  preview?: boolean;
}) {
  const router = useRouter();
  const { lines, gaps } = useMemo(() => parseGaps(content), [content]);
  const [values, setValues] = useState<Record<string, string[]>>({});
  const [states, setStates] = useState<Record<string, GapState>>({});
  const [firstTry, setFirstTry] = useState<Record<string, string> | null>(null);
  const [phase, setPhase] = useState<"answer" | "feedback" | "done">("answer");
  const [focused, setFocused] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [timeS, setTimeS] = useState(0);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const startedAt = useRef<number | null>(null);

  const meta: ExerciseMeta = { title, typeLabel: "Texte à trous", icon: TextCursorInput, level, skills, instructions };
  const open = gaps.filter((g) => states[g.id] !== "right");
  const filled = gaps.filter((g) => joined(values[g.id])).length;
  const allRight = gaps.length > 0 && gaps.every((g) => states[g.id] === "right");

  const change = (id: string, words: string[]) => {
    startedAt.current ??= Date.now();
    setValues((v) => ({ ...v, [id]: words }));
  };

  // Word bank: every blank's answer + distractors, in alphabetical order (stable between server and browser).
  const chips = useMemo(() => (content.wordBank ? [...gaps.map((g) => g.answers[0]), ...content.distractors].sort((a, b) => a.localeCompare(b, "en")) : []), [content, gaps]);
  const usedChips = useMemo(() => {
    const placed = gaps.map((g) => normalizeEnglish(joined(values[g.id]))).filter(Boolean);
    return chips.map((c, i) => {
      const before = chips.slice(0, i).filter((x) => x === c).length;
      return placed.filter((p) => p === normalizeEnglish(c)).length > before;
    });
  }, [chips, gaps, values]);
  const pickChip = (text: string) => {
    if (phase !== "answer" || readOnly) return;
    const target = (focused && states[focused] !== "right" && open.find((g) => g.id === focused)) || open.find((g) => !joined(values[g.id]));
    if (!target) return;
    change(target.id, text.split(" "));
    const nextEmpty = open.find((g) => g.id !== target.id && !joined(values[g.id]));
    setFocused(nextEmpty?.id ?? null);
  };

  const onCheck = () => {
    const answers = Object.fromEntries(gaps.map((g) => [g.id, joined(values[g.id])]));
    const next: Record<string, GapState> = {};
    for (const g of gaps) next[g.id] = checkItem("fill_gaps", content, g.id, answers[g.id]) ? "right" : "wrong";
    setStates(next);
    if (!firstTry) setFirstTry(answers);
    playSound(gaps.every((g) => next[g.id] === "right") ? "correct" : "wrong");
    setPhase("feedback");
  };

  const retry = () => {
    setValues((v) => Object.fromEntries(Object.entries(v).filter(([id]) => states[id] === "right")));
    setStates((s) => Object.fromEntries(Object.entries(s).filter(([, st]) => st === "right")));
    setPhase("answer");
  };

  const finish = () => {
    const answers = firstTry ?? {};
    const timeSpentS = startedAt.current ? Math.round((Date.now() - startedAt.current) / 1000) : 0;
    setTimeS(timeSpentS);
    if (preview || !courseId || !stepId) {
      const g = gradeActivity("fill_gaps", content, answers);
      setResult({ score: g.score, stars: starsFor(g.score), items: g.items });
      setPhase("done");
      return;
    }
    setError("");
    start(async () => {
      const r = await submitLabAttempt(courseId, stepId, { answers, timeSpentS });
      if (!r.ok) return setError(r.error);
      pushReward(r.result.reward);
      setResult({ ...r.result, xp: r.result.reward?.xpGained });
      setPhase("done");
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  };

  const restart = () => {
    setValues({});
    setStates({});
    setFirstTry(null);
    setResult(null);
    setPhase("answer");
    startedAt.current = null;
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (phase === "done" && result) {
    const review = result.items.filter((i) => !i.correct).map((i) => ({ title: lineWith(lines, i.id), answer: gaps.find((g) => g.id === i.id)?.answers[0] ?? "" }));
    return (
      <div className="mx-auto grid max-w-2xl gap-5">
        <ExerciseHeader meta={meta} courseHref={courseHref} index={gaps.length} total={gaps.length} done />
        <ResultsScreen
          score={result.score}
          stars={result.stars}
          bonus={0}
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
        />
      </div>
    );
  }

  const wrong = phase === "feedback" ? gaps.filter((g) => states[g.id] === "wrong") : [];
  const firstCheck = firstTry !== null && Object.keys(states).length > 0;

  return (
    <div className="mx-auto grid max-w-2xl gap-4">
      <ExerciseHeader meta={meta} courseHref={courseHref} index={filled} total={gaps.length} />

      <section className="grid gap-4 rounded-3xl border-2 border-border bg-card p-4 sm:p-6">
        <p className="text-xs font-bold tracking-wide text-muted-foreground uppercase">
          {gaps.length} trou{gaps.length > 1 ? "s" : ""} à compléter · un tiret par lettre
        </p>
        <GapText lines={lines} hint={content.hint} values={values} states={phase === "feedback" ? states : Object.fromEntries(Object.entries(states).filter(([, s]) => s === "right"))} disabled={readOnly || phase === "feedback"} onChange={change} onFocusGap={setFocused} />

        {chips.length > 0 && (
          <div className="border-t border-border pt-4">
            <p className="mb-2 text-xs font-bold tracking-wide text-muted-foreground uppercase">Banque de mots</p>
            <div lang="en" className="flex flex-wrap gap-2">
              {chips.map((c, i) => (
                <button
                  key={`${c}-${i}`}
                  type="button"
                  disabled={usedChips[i] || phase !== "answer" || readOnly}
                  onClick={() => pickChip(c)}
                  className={cn(
                    "rounded-xl border-2 px-3 py-1.5 font-bold transition",
                    usedChips[i] ? "border-dashed border-border bg-muted text-muted-foreground/60" : "border-primary/30 bg-white text-brand-deep shadow-[0_3px_0_0_rgb(54_79_171/0.25)] hover:border-primary active:translate-y-0.5 active:shadow-none",
                  )}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      {phase === "feedback" && (
        <div role="status" className={cn("grid gap-3 rounded-2xl border-2 p-4 animate-pop motion-reduce:animate-none", allRight ? "border-success/40 bg-success/10" : "border-coral/40 bg-coral-soft")}>
          <p className={cn("flex items-center gap-2 font-heading text-lg font-extrabold", allRight ? "text-success" : "text-coral-dark")}>
            {allRight ? <Check className="size-5" aria-hidden /> : <X className="size-5" aria-hidden />}
            {allRight ? "Tout est juste !" : `${gaps.length - wrong.length} / ${gaps.length} juste${gaps.length - wrong.length > 1 ? "s" : ""}`}
          </p>
          {wrong.length > 0 && (
            <ul className="grid gap-2 text-sm text-ink">
              {wrong.map((g) => (
                <li key={g.id} className="rounded-xl bg-white/70 px-3 py-2">
                  <span className="font-semibold text-muted-foreground">Trou {g.index + 1} · </span>
                  <span lang="en">
                    <s className="text-coral-dark">{joined(values[g.id]) || "—"}</s> → <strong className="text-success">{g.answers[0]}</strong>
                  </span>
                  {g.explanation && <span className="mt-0.5 block">{g.explanation}</span>}
                </li>
              ))}
            </ul>
          )}
          {firstCheck && !allRight && <p className="text-xs text-muted-foreground">Réessayez les trous en rouge pour vous entraîner : le score retient votre première vérification.</p>}
        </div>
      )}

      {error && (
        <p role="alert" className="text-sm font-semibold text-coral-dark">
          {error}
        </p>
      )}
      {readOnly ? (
        <p className="text-sm text-muted-foreground">Cours terminé : l&apos;activité reste consultable, mais plus rien n&apos;est enregistré.</p>
      ) : (
        <CheckBar
          phase={phase === "feedback" ? "feedback" : "answer"}
          canCheck={open.every((g) => joined(values[g.id]))}
          correct={phase === "feedback" ? allRight : null}
          isLast
          pending={pending}
          onCheck={onCheck}
          onRetry={retry}
          onNext={finish}
        />
      )}
    </div>
  );
}
