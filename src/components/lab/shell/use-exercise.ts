"use client";

import { useRef, useState } from "react";

/*
 * Item-by-item flow shared by every Lab exercise (catalogue: one task per screen, « Vérifier »,
 * explained feedback, « Réessayer »). Only the first try of each item counts for the score; a
 * wrong answer can be retried for practice, then the learner moves on.
 */

export type Phase = "answer" | "feedback" | "done";

/** Monotonic clock, called from handlers only. */
const now = () => Date.now();

export function useExercise<A>(ids: string[]) {
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>("answer");
  const [answer, setAnswer] = useState<A | undefined>(undefined);
  const [firstTry, setFirstTry] = useState<Record<string, A>>({});
  const [correct, setCorrect] = useState<boolean | null>(null);
  const [tries, setTries] = useState(0);
  const startedAt = useRef<number | null>(null);

  const id = ids[index];
  const isLast = index === ids.length - 1;

  /** Records the learner's check of the current item (the caller decides if it's right). */
  const check = (isCorrect: boolean) => {
    startedAt.current ??= now();
    if (tries === 0 && answer !== undefined) setFirstTry((f) => ({ ...f, [id]: answer }));
    setCorrect(isCorrect);
    setTries((t) => t + 1);
    setPhase("feedback");
  };
  const retry = () => {
    setAnswer(undefined);
    setCorrect(null);
    setPhase("answer");
  };
  const next = () => {
    if (isLast) return setPhase("done");
    setIndex((i) => i + 1);
    setAnswer(undefined);
    setCorrect(null);
    setTries(0);
    setPhase("answer");
  };
  const restart = () => {
    setIndex(0);
    setAnswer(undefined);
    setFirstTry({});
    setCorrect(null);
    setTries(0);
    setPhase("answer");
    startedAt.current = null;
  };
  const elapsedS = () => (startedAt.current ? Math.round((now() - startedAt.current) / 1000) : 0);
  /** Called when the learner first interacts (starts the timer). */
  const touch = () => {
    startedAt.current ??= now();
  };

  /** Choosing an answer also starts the timer. */
  const choose = (a: A | undefined) => {
    startedAt.current ??= now();
    setAnswer(a);
  };

  return { index, id, total: ids.length, isLast, phase, answer, setAnswer: choose, firstTry, correct, tries, check, retry, next, restart, elapsedS, touch };
}
