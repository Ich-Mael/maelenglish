import type { ConversationSessionDoc } from "@/models";
import type { ConversationTurn, Debrief } from "@/lib/ai/types";
import type { Reward } from "@/lib/gamification/service";

/** What the browser shows once the call is over. */
export type FinishedRolePlay = {
  sessionId: string;
  status: "started" | "ended" | "debriefed" | "failed";
  note: string;
  transcript: ConversationTurn[];
  debrief: Debrief | null;
  score: number | null;
  durationS: number;
  reward: Reward | null;
  /** The learner's conversation minutes left this month after this call (null = not capped / unknown). */
  minutesLeft: number | null;
};

export const toFinished = (s: Pick<ConversationSessionDoc, "_id" | "status" | "note" | "transcript" | "debrief" | "score" | "durationS">, reward: Reward | null = null, minutesLeft: number | null = null): FinishedRolePlay => ({
  sessionId: String(s._id),
  status: s.status as FinishedRolePlay["status"],
  note: s.note ?? "",
  transcript: (s.transcript ?? []).map((t) => ({ role: t.role as "agent" | "user", text: t.text ?? "", t: t.t ?? 0 })),
  debrief: (s.debrief as Debrief | null) ?? null,
  score: s.score ?? null,
  durationS: s.durationS ?? 0,
  reward,
  minutesLeft,
});


/** The call ended less than 15 minutes ago: its recording may still be on its way. */
export const isRecentCall = (createdAt: Date | string) => Date.now() - new Date(createdAt).getTime() < 15 * 60_000;
