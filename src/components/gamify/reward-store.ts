"use client";

import { create } from "zustand";
import type { Reward } from "@/lib/gamification/service";

/** Rewards waiting to be celebrated (kept in the app shell, so they survive client navigation). */
type RewardStore = {
  queue: Reward[];
  push: (r: Reward | null | undefined) => void;
  shift: () => void;
};

export const useRewards = create<RewardStore>((set) => ({
  queue: [],
  push: (r) => {
    if (r && (r.xpGained > 0 || r.badges.length)) set((s) => ({ queue: [...s.queue, r] }));
  },
  shift: () => set((s) => ({ queue: s.queue.slice(1) })),
}));

export const pushReward = (r: Reward | null | undefined) => useRewards.getState().push(r);
