import { Types } from "mongoose";
import { CoachingEntry, CoachingReport, CoachingSentence, CoachingSession, CoachingSubmission, CoachingTask, CoachingTaskProgress, CoachingVocab, ConversationSession, User, VocabWord, type CoachingDoc, type CoachingGoalDoc, type CoachingTaskDoc } from "@/models";
import { CoachingError, goalsOf, openCoaching, taskStates, type Viewer } from "./service";
import { SENTENCES_PER_ITEM } from "./vocabulary";

/*
 * Coaching progress (owner decision 2026-11-25): what each member did over a period — the daily
 * vocabulary (sentences written / expected, correct share, expressions in the notebook), tasks,
 * speaking challenges, Talk with Coach Ish calls, live sessions attended, goals, messages —, for the
 * coach's « Progress » tab (members see their own) and the monthly report the coach sends to the
 * company (/admin/coaching/[id]/rapport). Tasks, challenges and goals are their state today;
 * everything else counts what happened in the period. Framework-free (tests/coaching-progress.test.ts).
 */

const TZ = () => process.env.APP_TZ || "Africa/Ouagadougou";
const DAY = 86_400_000;

/** The UTC instant of midnight on the 1st of a month in APP_TZ. */
function monthStart(y: number, m: number) {
  const guess = Date.UTC(y, m - 1, 1);
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: TZ(), year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(guess)).map((p) => [p.type, p.value]));
  const wall = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute));
  return new Date(guess - (wall - guess));
}
export const monthKey = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ(), year: "numeric", month: "2-digit" }).format(d).slice(0, 7);
const shift = (key: string, n: number) => {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
};

export type Period = { key: string; from: Date; to: Date; month: string | null };

/** « YYYY-MM » → that month; « all » → the whole coaching (from its start); anything else → this month. */
export function periodOf(raw: string | undefined, coaching: Pick<CoachingDoc, "startDate" | "createdAt">, now = new Date()): Period {
  if (raw === "all") return { key: "all", from: coaching.startDate ?? coaching.createdAt ?? new Date(0), to: now, month: null };
  const key = raw && /^\d{4}-(0[1-9]|1[0-2])$/.test(raw) && raw <= monthKey(now) ? raw : monthKey(now);
  const [y, m] = key.split("-").map(Number);
  const next = shift(key, 1).split("-").map(Number);
  return { key, from: monthStart(y, m), to: new Date(Math.min(monthStart(next[0], next[1]).getTime(), now.getTime())), month: key };
}

/** The months to choose from: the coaching's first month to this one, newest first (≤ 24). */
export function monthsOf(coaching: Pick<CoachingDoc, "startDate" | "createdAt">, now = new Date()) {
  const first = monthKey(coaching.startDate && coaching.startDate < now ? coaching.startDate : (coaching.createdAt ?? now));
  const out: string[] = [];
  for (let k = monthKey(now); k >= first && out.length < 24; k = shift(k, -1)) out.push(k);
  return out;
}

export type Flag = "inactive" | "vocab_low" | "tasks_late" | "redo";

export type MemberProgress = {
  id: string;
  firstName: string;
  fullName: string;
  avatarUrl: string | null;
  vocab: { days: number; expected: number; written: number; correct: number; checked: number; activeDays: number; rate: number };
  notebook: { saved: number; known: number };
  tasks: { total: number; done: number; late: number; avgScore: number | null };
  challenges: { sent: number; validated: number; redo: number; avgGrade: number | null };
  calls: { count: number; avgScore: number | null };
  sessions: { held: number; attended: number };
  goals: { total: number; done: number; inProgress: number };
  messages: number;
  lastActive: string | null;
  flags: Flag[];
};

const avg = (xs: (number | null | undefined)[]) => {
  const ok = xs.filter((x): x is number => typeof x === "number");
  return ok.length ? Math.round((ok.reduce((a, b) => a + b, 0) / ok.length) * 10) / 10 : null;
};
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);
const concerns = (item: { forUserId?: unknown }, m: string) => !item.forUserId || String(item.forUserId) === m;
const latest = (...ds: (Date | null | undefined)[]) => ds.reduce<Date | null>((b, d) => (d && (!b || d > b) ? d : b), null);

/**
 * Each member's progress over the period. The coach gets every member (or `member` only); a
 * member gets their own row only. `rawPeriod`: a Period, or « YYYY-MM » / « all » (see periodOf).
 */
export async function coachingProgress(v: Viewer, coachingId: string, rawPeriod: Period | string | undefined, opts: { member?: string; now?: Date } = {}) {
  const now = opts.now ?? new Date();
  const { coaching, role } = await openCoaching(v, coachingId);
  const period = typeof rawPeriod === "object" ? rawPeriod : periodOf(rawPeriod, coaching, now);
  const all = (coaching.memberIds ?? []).map(String);
  const ids = role === "member" ? [v.id] : opts.member && all.includes(opts.member) ? [opts.member] : all;
  const users = await User.find({ _id: { $in: ids } }).select("name surname avatarUrl").lean();
  const oids = ids.map((id) => new Types.ObjectId(id));
  const range = { $gte: period.from, $lt: period.to };
  const dayFrom = new Intl.DateTimeFormat("en-CA", { timeZone: TZ() }).format(period.from);
  const dayTo = new Intl.DateTimeFormat("en-CA", { timeZone: TZ() }).format(new Date(period.to.getTime() - 1));

  const [vocabs, tasks, goals, sessions, entries, calls, subs, labs, notebook] = await Promise.all([
    CoachingVocab.find({ coachingId: coaching._id, day: { $gte: dayFrom, $lte: dayTo } }).select("day items.id").lean(),
    CoachingTask.find({ coachingId: coaching._id, createdAt: { $lt: period.to } }).lean<CoachingTaskDoc[]>(),
    goalsOf(v, coaching._id, "coach"),
    CoachingSession.find({ coachingId: coaching._id, startsAt: range, status: "done" }).select("forUserId joinedIds startsAt").lean(),
    CoachingEntry.find({ coachingId: coaching._id, authorId: { $in: oids }, createdAt: range }).select("authorId createdAt").lean(),
    ConversationSession.find({ userId: { $in: oids }, status: "debriefed", createdAt: range }).select("userId activityId score createdAt").lean(),
    CoachingSubmission.find({ coachingId: coaching._id, userId: { $in: oids } }).select("userId status grade submittedAt").lean(),
    CoachingTaskProgress.find({ userId: { $in: oids } }).select("taskId userId updatedAt").lean(),
    VocabWord.find({ userId: { $in: oids }, source: "coaching", coachingId: coaching._id }).select("userId known").lean(),
  ]);
  const sentences = vocabs.length ? await CoachingSentence.find({ vocabId: { $in: vocabs.map((x) => x._id) }, userId: { $in: oids } }).select("userId vocabId ok createdAt").lean() : [];
  // Sentences written in the period on any day (members may catch up on earlier days): activity only.
  const recent = await CoachingSentence.find({ coachingId: coaching._id, userId: { $in: oids }, createdAt: range }).select("userId createdAt").lean();
  const states = await taskStates(tasks, ids);
  const roleplayIds = new Set(tasks.filter((t) => t.kind === "roleplay" && t.activityId).map((t) => String(t.activityId)));
  const taskIds = new Set(tasks.map((t) => String(t._id)));
  const vocabDay = new Map(vocabs.map((x) => [String(x._id), x.day]));

  const rows: MemberProgress[] = ids.map((m) => {
    const u = users.find((x) => String(x._id) === m);
    const mine = sentences.filter((s) => String(s.userId) === m);
    const expected = vocabs.reduce((n, d) => n + d.items.length * SENTENCES_PER_ITEM, 0);
    const checked = mine.filter((s) => s.ok != null);
    const vocab = {
      days: vocabs.length,
      expected,
      written: Math.min(mine.length, expected),
      correct: checked.filter((s) => s.ok).length,
      checked: checked.length,
      activeDays: new Set(mine.map((s) => vocabDay.get(String(s.vocabId)))).size,
      rate: pct(Math.min(mine.length, expected), expected),
    };
    const myTasks = tasks.filter((t) => concerns(t, m));
    const st = myTasks.map((t) => ({ t, s: states[String(t._id)]?.[m] }));
    const late = st.filter(({ t, s }) => !s?.done && t.dueDate && t.dueDate < now).length;
    const mySubs = subs.filter((s) => String(s.userId) === m);
    const myCalls = calls.filter((c) => String(c.userId) === m && roleplayIds.has(String(c.activityId)));
    const mySessions = sessions.filter((s) => concerns(s, m));
    const myGoals = goals.filter((g) => concerns(g, m)).map((g) => goalStatus(g, m));
    const myEntries = entries.filter((e) => String(e.authorId) === m);
    const lastActive = latest(
      ...recent.filter((s) => String(s.userId) === m).map((s) => s.createdAt),
      ...myEntries.map((e) => e.createdAt),
      ...myCalls.map((c) => c.createdAt),
      ...mySubs.map((s) => s.submittedAt),
      ...labs.filter((l) => String(l.userId) === m && taskIds.has(String(l.taskId))).map((l) => l.updatedAt),
      ...mySessions.filter((s) => (s.joinedIds ?? []).some((j) => String(j) === m)).map((s) => s.startsAt),
    );
    const row: MemberProgress = {
      id: m,
      firstName: u?.name ?? "—",
      fullName: `${u?.name ?? ""} ${u?.surname ?? ""}`.trim() || "—",
      avatarUrl: u?.avatarUrl ?? null,
      vocab,
      notebook: { saved: notebook.filter((w) => String(w.userId) === m).length, known: notebook.filter((w) => String(w.userId) === m && w.known).length },
      tasks: { total: myTasks.length, done: st.filter(({ s }) => s?.done).length, late, avgScore: avg(st.map(({ s }) => s?.score)) },
      challenges: { sent: mySubs.length, validated: mySubs.filter((s) => s.status === "validated").length, redo: mySubs.filter((s) => s.status === "returned").length, avgGrade: avg(mySubs.filter((s) => s.status === "validated").map((s) => s.grade)) },
      calls: { count: myCalls.length, avgScore: avg(myCalls.map((c) => c.score)) },
      sessions: { held: mySessions.length, attended: mySessions.filter((s) => (s.joinedIds ?? []).some((j) => String(j) === m)).length },
      goals: { total: myGoals.length, done: myGoals.filter((s) => s === "done").length, inProgress: myGoals.filter((s) => s === "in_progress").length },
      messages: myEntries.length,
      lastActive: lastActive ? lastActive.toISOString() : null,
      flags: [],
    };
    row.flags = flagsFor(row, now, period);
    return row;
  });
  return { coaching, role, period, members: rows, group: groupTotals(rows) };
}
export type CoachingProgress = Awaited<ReturnType<typeof coachingProgress>>;

const goalStatus = (g: CoachingGoalDoc, m: string) => (g.forUserId ? g.status : (((g.memberStatus as unknown as Map<string, string> | Record<string, string>) instanceof Map ? (g.memberStatus as unknown as Map<string, string>).get(m) : (g.memberStatus as unknown as Record<string, string>)?.[m]) ?? "todo"));

/** What needs the coach's attention (pure). */
export function flagsFor(r: Pick<MemberProgress, "vocab" | "tasks" | "challenges" | "lastActive">, now: Date, period: Pick<Period, "from">): Flag[] {
  const out: Flag[] = [];
  const since = r.lastActive ? new Date(r.lastActive) : null;
  // No activity for 7 days (only once the period is a week old, so a new month isn't flagged on the 2nd).
  if ((!since || now.getTime() - since.getTime() > 7 * DAY) && now.getTime() - period.from.getTime() > 7 * DAY) out.push("inactive");
  if (r.vocab.days >= 3 && r.vocab.rate < 50) out.push("vocab_low");
  if (r.tasks.late > 0) out.push("tasks_late");
  if (r.challenges.redo > 0) out.push("redo");
  return out;
}

/** The group's totals and averages (the report's first block). */
export function groupTotals(rows: MemberProgress[]) {
  const sum = (f: (r: MemberProgress) => number) => rows.reduce((n, r) => n + f(r), 0);
  return {
    members: rows.length,
    expressions: rows[0]?.vocab.days ? rows[0].vocab.expected / SENTENCES_PER_ITEM : 0,
    sentences: sum((r) => r.vocab.written),
    vocabRate: rows.length ? Math.round(sum((r) => r.vocab.rate) / rows.length) : 0,
    correctRate: pct(sum((r) => r.vocab.correct), sum((r) => r.vocab.checked)),
    saved: sum((r) => r.notebook.saved),
    tasksDone: sum((r) => r.tasks.done),
    tasksTotal: sum((r) => r.tasks.total),
    validated: sum((r) => r.challenges.validated),
    calls: sum((r) => r.calls.count),
    sessionsHeld: Math.max(0, ...rows.map((r) => r.sessions.held)),
    attendanceRate: pct(sum((r) => r.sessions.attended), sum((r) => r.sessions.held)),
    goalsDone: sum((r) => r.goals.done),
    goalsTotal: sum((r) => r.goals.total),
  };
}

// ── The monthly report's comment ─────────────────────────────────────────

export async function reportComment(v: Viewer, coachingId: string, month: string) {
  const { coaching, role } = await openCoaching(v, coachingId);
  if (role !== "coach") throw new CoachingError("Only the coach can do this.");
  return (await CoachingReport.findOne({ coachingId: coaching._id, month }).lean())?.comment ?? "";
}

export async function saveReportComment(v: Viewer, coachingId: string, month: string, raw: unknown) {
  const { coaching, role } = await openCoaching(v, coachingId);
  if (role !== "coach") throw new CoachingError("Only the coach can do this.");
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new CoachingError("Choose a month.");
  const comment = String(raw ?? "").replace(/\r/g, "").trim().slice(0, 4000);
  await CoachingReport.updateOne({ coachingId: coaching._id, month }, { $set: { comment, updatedBy: new Types.ObjectId(v.id) } }, { upsert: true });
}
