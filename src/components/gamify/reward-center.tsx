"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Flame, Sparkles, Target, X } from "lucide-react";
import type { Reward } from "@/lib/gamification/service";
import { useRewards } from "./reward-store";
import { confetti, playSound } from "./sound";
import { BadgeIcon } from "./badge-icon";

type Modal = { kind: "level"; level: number } | { kind: "badge"; badge: Reward["badges"][number] };

/**
 * Celebrates rewards pushed by the learner screens: an XP toast for every
 * reward, then full-screen moments for level-ups and new badges.
 */
export function RewardCenter() {
  const { queue, shift } = useRewards();
  const reduce = useReducedMotion();
  const [toast, setToast] = useState<Reward | null>(null);
  const [modals, setModals] = useState<Modal[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const r = queue[0];
    if (!r) return;
    shift();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- consuming an external queue
    setToast(r);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), 3200);
    const next: Modal[] = [];
    if (r.leveledUp) next.push({ kind: "level", level: r.level });
    for (const b of r.badges) next.push({ kind: "badge", badge: b });
    if (next.length) setModals((m) => [...m, ...next]);
    else if (r.dailyGoalReached) {
      playSound("complete");
      void confetti("small");
    }
  }, [queue, shift]);

  const modal = modals[0];
  useEffect(() => {
    if (!modal) return;
    playSound(modal.kind === "level" ? "levelup" : "badge");
    void confetti("big");
  }, [modal]);

  return (
    <>
      <div className="pointer-events-none fixed inset-x-0 top-16 z-50 flex justify-center px-4" aria-live="polite">
        <AnimatePresence>
          {toast && (
            <motion.div
              key={toast.xp}
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: -20, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10 }}
              className="pointer-events-auto flex items-center gap-3 rounded-2xl border-2 border-xp/40 bg-card px-4 py-2.5 shadow-xl"
            >
              <span className="flex items-center gap-1 font-heading text-lg font-extrabold text-[#9a6200]">
                <Sparkles className="size-5 text-xp" aria-hidden /> +{toast.xpGained} XP
              </span>
              {toast.streakExtended && toast.streak > 0 && (
                <span className="flex items-center gap-1 text-sm font-bold text-coral-dark">
                  <Flame className="size-4" aria-hidden /> {toast.streak} jour{toast.streak > 1 ? "s" : ""}
                </span>
              )}
              {toast.dailyGoalReached && (
                <span className="flex items-center gap-1 text-sm font-bold text-success">
                  <Target className="size-4" aria-hidden /> Objectif du jour !
                </span>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {modal && (
          <motion.div
            key={modal.kind === "level" ? `l${modal.level}` : modal.badge.id}
            className="fixed inset-0 z-[60] flex items-center justify-center bg-brand-deep/70 p-4 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="reward-title"
            onClick={() => setModals((m) => m.slice(1))}
          >
            <motion.div
              initial={reduce ? false : { scale: 0.7, rotate: -4 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 260, damping: 16 }}
              className="relative w-full max-w-sm rounded-[2rem] bg-card p-8 text-center shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <button type="button" onClick={() => setModals((m) => m.slice(1))} className="absolute top-3 right-3 flex size-9 items-center justify-center rounded-full text-muted-foreground hover:bg-muted" aria-label="Fermer">
                <X className="size-5" aria-hidden />
              </button>
              {modal.kind === "level" ? (
                <>
                  <div className="mx-auto flex size-28 items-center justify-center rounded-full border-4 border-coral bg-white font-heading text-5xl font-extrabold text-coral shadow-[0_8px_0_0_var(--color-coral)]">
                    {modal.level}
                  </div>
                  <h2 id="reward-title" className="mt-6 text-3xl font-extrabold text-brand-deep">Niveau {modal.level} !</h2>
                  <p className="mt-2 text-muted-foreground">Votre anglais progresse. Continuez sur cette lancée !</p>
                </>
              ) : (
                <>
                  <div className="mx-auto flex size-28 items-center justify-center rounded-3xl bg-primary text-white shadow-[0_8px_0_0_var(--color-brand-dark)]">
                    <BadgeIcon name={modal.badge.icon} className="size-14" />
                  </div>
                  <p className="mt-6 text-xs font-bold tracking-wide text-coral-dark uppercase">Nouveau badge</p>
                  <h2 id="reward-title" className="text-3xl font-extrabold text-brand-deep">{modal.badge.name}</h2>
                  <p className="mt-2 text-muted-foreground">{modal.badge.description}</p>
                </>
              )}
              <button type="button" autoFocus onClick={() => setModals((m) => m.slice(1))} className="mt-7 inline-flex h-12 w-full items-center justify-center rounded-2xl border-2 border-coral bg-white text-[19px] font-bold text-coral hover:bg-coral-soft shadow-[0_5px_0_0_var(--color-coral)] transition active:translate-y-1 active:shadow-[0_1px_0_0_var(--color-coral)]">
                Super !
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
