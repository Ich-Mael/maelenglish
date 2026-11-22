"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Headphones, SpellCheck } from "lucide-react";
import { submitLabAttempt } from "@/app/(app)/learn-actions";
import { pushReward } from "@/components/gamify/reward-store";
import { playSound } from "@/components/gamify/sound";
import { checkItem, gradeActivity } from "@/lib/lab/grade";
import { starsFor } from "@/lib/lab/meta";
import { parseGaps, type CompleteWordsContent, type Gap } from "@/lib/lab/types";
import { CheckBar, ExerciseHeader, ResultsScreen, type ExerciseMeta } from "../shell/parts";
import { AudioPlayer } from "../ui/audio-player";
import { cn } from "cn";

/*
 * Complete the words (« C-test »): the whole paragraph on one screen, each cut word showing its
 * beginning followed by one box per missing letter. Typing a letter moves to the next box (and on
 * to the next word), Backspace goes back, arrows move, pasting fills the boxes. « Vérifier » marks
 * each word (blue right / red wrong); « Réessayer » empties only the wrong ones; the score counts
 * the first check. Results: the words to review and the full corrected text. Checked here, the
 * server recomputes the score (`submitLabAttempt`). `preview` (Lab page): graded locally.
 */

type Result = { score: number; stars: number; bestScore?: number; xp?: number; items: { id: string; correct: boolean }[] };

export function CompleteWordsPlayer({
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
  audioUrl,
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
  content: CompleteWordsContent;
  /** The whole text read aloud (optional), played on the results page. */
  audioUrl?: string | null;
  courseHref: string;
  nextHref: string;
  readOnly?: boolean;
  preview?: boolean;
}) {
  const router = useRouter();
  const { lines, gaps } = parseGaps({ text: content.text, explanations: [] });
  const size = (g: Gap) => g.answers[0].length;
  const blank = () => Object.fromEntries(gaps.map((g) => [g.id, Array<string>(size(g)).fill("")]));
  const [values, setValues] = useState<Record<string, string[]>>(blank);
  const [marks, setMarks] = useState<Record<string, boolean> | null>(null);
  const [firstCheck, setFirstCheck] = useState<Record<string, string> | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [timeS, setTimeS] = useState(0);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const startedAt = useRef<number | null>(null);
  const boxes = useRef(new Map<string, HTMLInputElement>());
  // Box order across the text, for moving from one word to the next.
  const order = gaps.flatMap((g) => Array.from({ length: size(g) }, (_, k) => `${g.id}:${k}`));

  const meta: ExerciseMeta = { title, typeLabel: "Complete the words", icon: SpellCheck, level, skills, instructions: instructions || "Complete the words: one box = one letter." };
  const word = (id: string) => (values[id] ?? []).join("");
  const locked = (id: string) => marks?.[id] === true;
  const focusAt = (i: number) => {
    const key = order[i];
    if (key) boxes.current.get(key)?.focus();
  };

  const setLetter = (g: Gap, k: number, ch: string) => {
    startedAt.current ??= Date.now();
    setValues((v) => ({ ...v, [g.id]: v[g.id].map((x, i) => (i === k ? ch : x)) }));
    // A letter typed on a word marked wrong clears its mark.
    if (marks && marks[g.id] === false) setMarks((m) => (m ? Object.fromEntries(Object.entries(m).filter(([id]) => id !== g.id)) : m));
  };

  const onInput = (g: Gap, k: number, raw: string, old: string) => {
    // Typing into a filled box (cursor before or after its letter) keeps only the new letter.
    let v = raw.replace(/\s+/g, "");
    if (old && v.length === 2 && v.startsWith(old)) v = v.slice(1);
    else if (old && v.length === 2 && v.endsWith(old)) v = v.slice(0, 1);
    const chars = v.split("");
    if (chars.length > 1) {
      // Paste or fast typing: fill from this box on.
      const at = order.indexOf(`${g.id}:${k}`);
      chars.forEach((ch, n) => {
        const key = order[at + n];
        if (!key) return;
        const [gid, kk] = key.split(":");
        const gg = gaps.find((x) => x.id === gid)!;
        if (!locked(gid)) setLetter(gg, Number(kk), ch);
      });
      focusAt(at + chars.length);
      return;
    }
    setLetter(g, k, chars[0] ?? "");
    if (chars[0]) focusAt(order.indexOf(`${g.id}:${k}`) + 1);
  };

  const onKey = (g: Gap, k: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    const at = order.indexOf(`${g.id}:${k}`);
    if (e.key === "Backspace" && !values[g.id][k]) {
      e.preventDefault();
      const prev = order[at - 1];
      if (prev) {
        const [gid, kk] = prev.split(":");
        if (!locked(gid)) setLetter(gaps.find((x) => x.id === gid)!, Number(kk), "");
        focusAt(at - 1);
      }
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      focusAt(at - 1);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      focusAt(at + 1);
    }
  };

  const onCheck = () => {
    const m = Object.fromEntries(gaps.map((g) => [g.id, checkItem("complete_words", content, g.id, word(g.id))]));
    if (!firstCheck) setFirstCheck(Object.fromEntries(gaps.map((g) => [g.id, word(g.id)])));
    setMarks(m);
    playSound(Object.values(m).every(Boolean) ? "correct" : "wrong");
  };
  const retry = () => {
    // Empty only the wrong words, keep the right ones.
    setValues((v) => Object.fromEntries(gaps.map((g) => [g.id, marks?.[g.id] ? v[g.id] : v[g.id].map(() => "")])));
    setMarks((m) => (m ? Object.fromEntries(Object.entries(m).filter(([, ok]) => ok)) : m));
    const firstWrong = gaps.find((g) => !marks?.[g.id]);
    if (firstWrong) window.setTimeout(() => boxes.current.get(`${firstWrong.id}:0`)?.focus(), 30);
  };

  const finish = () => {
    const answers = firstCheck ?? Object.fromEntries(gaps.map((g) => [g.id, word(g.id)]));
    const timeSpentS = startedAt.current ? Math.round((Date.now() - startedAt.current) / 1000) : 0;
    setTimeS(timeSpentS);
    if (preview || !courseId || !stepId) {
      const g = gradeActivity("complete_words", content, answers);
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
  const restart = () => {
    setValues(blank());
    setMarks(null);
    setFirstCheck(null);
    setResult(null);
    startedAt.current = null;
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  /** The text with each cut word: its beginning kept on the same line as its boxes (or, `solved`, the answer). */
  const renderText = (solved: boolean) =>
    lines.map((line, li) => (
      <p key={li} lang="en" className="leading-[2.6] text-ink sm:text-lg">
        {line.map((seg, si) => {
          const next = line[si + 1];
          if (seg.kind === "text") {
            // The last word before a cut belongs to it (rendered with the boxes, never split from them).
            const text = next?.kind === "gap" ? seg.text.replace(/[A-Za-z']*$/, "") : seg.text;
            return <span key={si}>{text}</span>;
          }
          const g = seg.gap;
          const prev = line[si - 1];
          const stem = prev?.kind === "text" ? (prev.text.match(/[A-Za-z']*$/)?.[0] ?? "") : "";
          if (solved) {
            const ok = result?.items.find((i) => i.id === g.id)?.correct;
            const given = firstCheck?.[g.id] ?? "";
            return (
              <span key={si} className="whitespace-nowrap">
                {stem}
                <span className={cn("rounded-r font-bold", ok ? "bg-brand-soft text-primary" : "bg-coral-soft/70 text-coral-dark")}>{g.answers[0]}</span>
                {!ok && given && <s className="ml-1 text-xs text-coral-dark/70">{stem + given}</s>}
              </span>
            );
          }
          const mark = marks?.[g.id];
          return (
            <span key={si} className="whitespace-nowrap">
              {stem}
              <span className="ml-0.5 inline-flex gap-0.5 align-middle" role="group" aria-label={`Word ${g.index + 1}: ${stem}… ${size(g)} missing letter${size(g) > 1 ? "s" : ""}`}>
              {values[g.id].map((ch, k) => (
                <input
                  key={k}
                  ref={(el) => {
                    const key = `${g.id}:${k}`;
                    if (el) boxes.current.set(key, el);
                    else boxes.current.delete(key);
                  }}
                  value={ch}
                  onChange={(e) => onInput(g, k, e.target.value, ch)}
                  onKeyDown={(e) => onKey(g, k, e)}
                  onFocus={(e) => e.target.select()}
                  disabled={readOnly || mark === true}
                  maxLength={20}
                  inputMode="text"
                  autoCapitalize="off"
                  autoCorrect="off"
                  autoComplete="off"
                  spellCheck={false}
                  aria-label={`Letter ${k + 1}`}
                  className={cn(
                    "h-9 w-6 rounded-md border-2 border-b-[3px] bg-white p-0 text-center font-semibold text-brand-deep outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/25 sm:h-10 sm:w-8 sm:text-lg",
                    mark === true ? "border-primary bg-brand-soft text-primary" : mark === false ? "border-coral bg-coral-soft/60 text-coral-dark" : ch ? "border-primary/40" : "border-border",
                  )}
                />
              ))}
              </span>
            </span>
          );
        })}
      </p>
    ));

  if (result) {
    const review = result.items
      .filter((i) => !i.correct)
      .map((i) => gaps.find((g) => g.id === i.id)!)
      .map((g) => {
        const line = lines.find((l) => l.some((s) => s.kind === "gap" && s.gap.id === g.id)) ?? [];
        const at = line.findIndex((s) => s.kind === "gap" && s.gap.id === g.id);
        const before = at > 0 && line[at - 1].kind === "text" ? (line[at - 1] as { text: string }).text : "";
        const stem = before.match(/[A-Za-z']*$/)?.[0] ?? "";
        return { title: `${stem}…`, answer: `${stem}${g.answers[0]}` };
      });
    return (
      <div className="mx-auto grid max-w-3xl gap-5">
        <ExerciseHeader meta={meta} courseHref={courseHref} index={1} total={1} done />
        <ResultsScreen score={result.score} stars={result.stars} timeS={timeS} xp={result.xp} bestScore={result.bestScore} review={review} maelTip={maelTip} preview={preview} passScore={passScore} lessonHref={lessonHref} onRetry={restart} onContinue={() => router.push(nextHref)}>
          <section className="grid gap-2 rounded-3xl border-2 border-border bg-card p-5">
            <h2 className="font-heading text-lg font-extrabold text-brand-deep">The corrected text</h2>
            {audioUrl && (
              <div className="grid gap-1">
                <p className="flex items-center gap-1.5 text-sm font-semibold text-primary">
                  <Headphones className="size-4" aria-hidden /> Listen to the whole text
                </p>
                <AudioPlayer src={audioUrl} />
              </div>
            )}
            {renderText(true)}
          </section>
        </ResultsScreen>
      </div>
    );
  }

  const checked = marks !== null && gaps.every((g) => marks[g.id] !== undefined);
  const allRight = checked && gaps.every((g) => marks[g.id]);
  const filled = gaps.some((g) => word(g.id));
  const right = marks ? gaps.filter((g) => marks[g.id]).length : 0;

  return (
    <div className="mx-auto grid max-w-3xl gap-4">
      <ExerciseHeader meta={meta} courseHref={courseHref} index={checked ? 1 : 0} total={1} />
      <section className="grid gap-3 rounded-3xl border-2 border-border bg-card p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-bold tracking-wide text-muted-foreground uppercase">
            {gaps.length} words to complete · one box = one letter
          </p>
          {marks && (
            <p className={cn("text-xs font-bold", allRight ? "text-primary" : "text-coral-dark")}>
              {right} / {gaps.length} words correct
            </p>
          )}
        </div>
        {renderText(false)}
      </section>
      {error && (
        <p role="alert" className="text-sm font-semibold text-coral-dark">
          {error}
        </p>
      )}
      {readOnly ? (
        <p className="text-sm text-muted-foreground">Course completed: you can still view the activity, but nothing is saved any more.</p>
      ) : (
        <CheckBar phase={checked ? "feedback" : "answer"} canCheck={filled} correct={checked ? allRight : null} isLast pending={pending} onCheck={onCheck} onRetry={retry} onNext={finish} />
      )}
    </div>
  );
}
