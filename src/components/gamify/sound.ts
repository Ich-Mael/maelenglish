"use client";

import { useSyncExternalStore } from "react";

/**
 * Feedback sounds synthesised with the Web Audio API (no audio files to
 * download — light on mobile data). Muted state is a per-device preference.
 */
export type SoundName = "correct" | "wrong" | "complete" | "levelup" | "badge" | "tap";

const KEY = "me-sound-muted";
const listeners = new Set<() => void>();
let ctx: AudioContext | null = null;

function isMuted(): boolean {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function setMuted(muted: boolean) {
  try {
    localStorage.setItem(KEY, muted ? "1" : "0");
  } catch {
    /* storage unavailable: keep default */
  }
  listeners.forEach((l) => l());
}

export function useMuted(): boolean {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    isMuted,
    () => false,
  );
}

type Note = { f: number; t: number; d: number; type?: OscillatorType; v?: number };

const SOUNDS: Record<SoundName, Note[]> = {
  tap: [{ f: 660, t: 0, d: 0.05, type: "triangle", v: 0.08 }],
  correct: [
    { f: 784, t: 0, d: 0.1, type: "triangle" },
    { f: 1175, t: 0.09, d: 0.18, type: "triangle" },
  ],
  wrong: [
    { f: 220, t: 0, d: 0.12, type: "square", v: 0.06 },
    { f: 185, t: 0.11, d: 0.2, type: "square", v: 0.06 },
  ],
  complete: [
    { f: 523, t: 0, d: 0.12 },
    { f: 659, t: 0.1, d: 0.12 },
    { f: 784, t: 0.2, d: 0.12 },
    { f: 1047, t: 0.3, d: 0.3 },
  ],
  levelup: [
    { f: 523, t: 0, d: 0.1 },
    { f: 784, t: 0.1, d: 0.1 },
    { f: 1047, t: 0.2, d: 0.1 },
    { f: 1319, t: 0.3, d: 0.1 },
    { f: 1568, t: 0.4, d: 0.45 },
  ],
  badge: [
    { f: 988, t: 0, d: 0.12, type: "sine" },
    { f: 1319, t: 0.12, d: 0.35, type: "sine" },
  ],
};

export function playSound(name: SoundName) {
  if (typeof window === "undefined" || isMuted()) return;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === "suspended") void ctx.resume();
    const now = ctx.currentTime;
    for (const n of SOUNDS[name]) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = n.type ?? "triangle";
      osc.frequency.value = n.f;
      const v = n.v ?? 0.12;
      gain.gain.setValueAtTime(0, now + n.t);
      gain.gain.linearRampToValueAtTime(v, now + n.t + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + n.t + n.d);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now + n.t);
      osc.stop(now + n.t + n.d + 0.02);
    }
  } catch {
    /* audio not available */
  }
}

/** Confetti burst (lazy-loaded; disabled with prefers-reduced-motion). */
export async function confetti(kind: "small" | "big" = "small") {
  if (typeof window === "undefined") return;
  const { default: fire } = await import("canvas-confetti");
  const colors = ["#364fab", "#ff5757", "#ffb020", "#1fa971", "#ffffff"];
  if (kind === "small") {
    void fire({ particleCount: 70, spread: 70, origin: { y: 0.7 }, colors, disableForReducedMotion: true });
    return;
  }
  void fire({ particleCount: 120, spread: 100, origin: { y: 0.6 }, colors, disableForReducedMotion: true });
  setTimeout(() => void fire({ particleCount: 60, angle: 60, spread: 60, origin: { x: 0 }, colors, disableForReducedMotion: true }), 250);
  setTimeout(() => void fire({ particleCount: 60, angle: 120, spread: 60, origin: { x: 1 }, colors, disableForReducedMotion: true }), 400);
}
