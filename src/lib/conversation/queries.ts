import "server-only";
import { Activity, ConversationSession, Enrollment, accessState, type ActivityDoc } from "@/models";
import type { CurrentUser } from "@/lib/auth/dal";
import { remainingSeconds } from "@/lib/ai/metering";
import { conversationEngine } from "@/lib/ai";
import type { RolePlayContent } from "@/lib/lab/types";
import type { PublicRolePlay } from "@/components/conversation/role-play-player";

/** Learners with an active enrolment, and staff, use the Speaking Partner page. */
export async function canUsePartner(me: CurrentUser): Promise<boolean> {
  if (me.isStaff) return true;
  const enrolments = await Enrollment.find({ userId: me.id }).select("status startDate endDate").lean();
  return enrolments.some((e) => accessState(e) === "active");
}

/** What the browser may know of a scenario: no twists, no voice settings. */
export function publicBrief(c: RolePlayContent): PublicRolePlay {
  return { aiRole: c.aiRole, learnerRole: c.learnerRole, setting: c.setting, goals: c.goals, targetPhrases: c.targetPhrases, difficulty: c.difficulty, maxMinutes: c.maxMinutes };
}

export async function partnerState(me: CurrentUser) {
  return {
    available: conversationEngine() !== null,
    minutesLeft: me.isStaff ? null : (await remainingSeconds(me.id)) / 60,
  };
}

/** Ready scenarios, optionally filtered by level and theme. */
export async function listScenarios(filter: { level?: string; theme?: string } = {}) {
  const q: Record<string, unknown> = { type: "role_play", status: "ready" };
  if (filter.level) q.level = filter.level;
  if (filter.theme) q.theme = filter.theme;
  return Activity.find(q).select("title level theme content durationMin").sort({ level: 1, title: 1 }).limit(200).lean<ActivityDoc[]>();
}

export async function recentSessions(userId: string, limit = 10) {
  return ConversationSession.find({ userId, status: { $in: ["ended", "debriefed"] } })
    .select("title activityId difficulty status score durationS createdAt stepId courseId")
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
}
