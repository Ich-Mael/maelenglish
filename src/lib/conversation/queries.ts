import "server-only";
import { Activity, ConversationSession, Enrollment, accessState, type ActivityDoc } from "@/models";
import type { CurrentUser } from "@/lib/auth/dal";
import { monthlyCapSeconds, remainingSeconds } from "@/lib/ai/metering";
import { conversationEngine } from "@/lib/ai";
import type { RolePlayContent } from "@/lib/lab/types";
import type { PublicRolePlay } from "@/components/conversation/role-play-player";

/** Learners with an active enrolment, and staff, use the Talk with Coach Ish page. */
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
    /** The learner's monthly allowance in minutes (null for staff). */
    capMinutes: me.isStaff ? null : (await monthlyCapSeconds(me.id)) / 60,
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

export type PastAttempt = { sessionId: string; score: number | null; at: string; difficulty: number; durationS: number; debriefed: boolean };

/** The learner's earlier conversations on one scenario (latest first), for « Your last result ». */
export async function attemptsOn(userId: string, activityId: string, limit = 6): Promise<PastAttempt[]> {
  const rows = await ConversationSession.find({ userId, activityId, status: { $in: ["ended", "debriefed"] } })
    .select("score createdAt difficulty durationS status")
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
  return rows.map((r) => ({ sessionId: String(r._id), score: r.score ?? null, at: new Date(r.createdAt).toISOString(), difficulty: r.difficulty ?? 2, durationS: r.durationS ?? 0, debriefed: r.status === "debriefed" }));
}

export type ScenarioCard = {
  activityId: string;
  title: string;
  level: string;
  theme: string;
  aiRole: string;
  maxMinutes: number;
  goals: number;
  difficulty: number;
  /** Best debrief score of the learner on this scenario (null = never debriefed). */
  best: number | null;
  /** Where it sits in a course, when it does. */
  where?: { stepId: string; unit: string; lesson: string };
};
export type ScenarioGroup = { key: string; course: string; module: string; cards: ScenarioCard[] };

/**
 * Scenarios grouped by lesson (owner decision 2026-11-23): those placed in the learner's courses
 * come first, in course order (module → unit → step), each under its module with the unit and the
 * lesson it practises; the others follow as « Free practice », easiest level first.
 * Staff see every course's placements.
 */
export async function scenariosByLesson(me: CurrentUser, filter: { level?: string; theme?: string } = {}): Promise<{ groups: ScenarioGroup[]; free: ScenarioCard[] }> {
  const { Course, Module, Unit, Step } = await import("@/models");
  const scenarios = await listScenarios(filter);
  const ids = scenarios.map((s) => s._id);
  const courseIds = me.isStaff
    ? (await Course.find({}).select("_id").lean()).map((c) => c._id)
    : (await Enrollment.find({ userId: me.id }).select("courseId status startDate endDate").lean()).filter((e) => ["active", "completed"].includes(accessState(e))).map((e) => e.courseId);
  const steps = await Step.find({ courseId: { $in: courseIds }, kind: "activity", activityId: { $in: ids } }).select("courseId moduleId unitId position activityId lessonId").lean();
  const [courses, modules, units, lessons, bests] = await Promise.all([
    Course.find({ _id: { $in: [...new Set(steps.map((s) => String(s.courseId)))] } }).select("title").sort({ createdAt: 1 }).lean(),
    Module.find({ _id: { $in: steps.map((s) => s.moduleId) } }).select("title order").lean(),
    Unit.find({ moduleId: { $in: steps.map((s) => s.moduleId) } }).select("title order moduleId").sort({ order: 1, _id: 1 }).lean(),
    Step.find({ _id: { $in: steps.map((s) => s.lessonId).filter((x): x is NonNullable<typeof x> => !!x) } }).select("title").lean<{ _id: unknown; title: string }[]>(),
    ConversationSession.aggregate<{ _id: unknown; best: number }>([{ $match: { userId: new (await import("mongoose")).Types.ObjectId(me.id), activityId: { $in: ids }, score: { $ne: null } } }, { $group: { _id: "$activityId", best: { $max: "$score" } } }]),
  ]);
  const byId = <T extends { _id: unknown }>(xs: T[]) => new Map(xs.map((x) => [String(x._id), x]));
  const [C, M, U, L] = [byId(courses), byId(modules), byId(units), byId(lessons)];
  const best = new Map(bests.map((b) => [String(b._id), b.best]));
  // « Unit N » = position of the unit in its module, as on the course map.
  const unitNumber = new Map<string, number>();
  const seen = new Map<string, number>();
  for (const u of units) {
    const n = (seen.get(String(u.moduleId)) ?? 0) + 1;
    seen.set(String(u.moduleId), n);
    unitNumber.set(String(u._id), n);
  }
  const card = (a: ActivityDoc): ScenarioCard => {
    const c = a.content as RolePlayContent;
    return { activityId: String(a._id), title: a.title, level: a.level ?? "", theme: a.theme ?? "", aiRole: c.aiRole, maxMinutes: c.maxMinutes, goals: c.goals.length, difficulty: c.difficulty, best: best.get(String(a._id)) ?? null };
  };
  const scenarioById = byId(scenarios);
  const courseOrder = new Map(courses.map((c, i) => [String(c._id), i]));
  const placed = steps
    .filter((s) => C.has(String(s.courseId)) && M.has(String(s.moduleId)) && U.has(String(s.unitId)))
    .sort((a, b) => (courseOrder.get(String(a.courseId))! - courseOrder.get(String(b.courseId))!) || (M.get(String(a.moduleId))!.order - M.get(String(b.moduleId))!.order) || (U.get(String(a.unitId))!.order - U.get(String(b.unitId))!.order) || a.position - b.position);
  const groups: ScenarioGroup[] = [];
  for (const s of placed) {
    const key = `${s.courseId}:${s.moduleId}`;
    let g = groups.find((x) => x.key === key);
    if (!g) groups.push((g = { key, course: C.get(String(s.courseId))!.title, module: M.get(String(s.moduleId))!.title, cards: [] }));
    const u = U.get(String(s.unitId))!;
    g.cards.push({ ...card(scenarioById.get(String(s.activityId))!), where: { stepId: String(s._id), unit: `Unit ${unitNumber.get(String(u._id))} · ${u.title}`, lesson: s.lessonId ? (L.get(String(s.lessonId))?.title ?? "") : "" } });
  }
  const used = new Set(placed.map((s) => String(s.activityId)));
  const LEVELS = ["A1", "A2", "B1", "B2", "C1"];
  const rank = (l: string) => (LEVELS.includes(l) ? LEVELS.indexOf(l) : 9);
  const free = scenarios.filter((a) => !used.has(String(a._id))).map(card).sort((a, b) => rank(a.level) - rank(b.level) || a.difficulty - b.difficulty || a.title.localeCompare(b.title));
  return { groups, free };
}
