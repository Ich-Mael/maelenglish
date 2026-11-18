import { Types } from "mongoose";
import { User, UserBadge, UserStats, XpEvent, type UserStatsDoc } from "@/models";
import { BADGES, DEFAULT_DAILY_GOAL, XP, dayKey, displayStreak, levelFor, newlyEarned, nextStreak, publicName, weekStart, type StatCounters } from "./rules";

/*
 * Awards XP and keeps streaks, daily goal and badges up to date.
 * Framework-free (tested in tests/gamification.test.ts). Called by the
 * learner actions after a successful, saved step (never in staff preview).
 */

type Id = Types.ObjectId | string;
type Counter = "lessonsCompleted" | "perfectPractices" | "quizzesPassed" | "examsPassed" | "assignmentsSubmitted";

export type AwardInput = {
  key: string;
  source: string;
  amount: number;
  courseId?: Id | null;
  counters?: Partial<Record<Counter, number>>;
};

export type Reward = {
  xpGained: number;
  xp: number;
  level: number;
  leveledUp: boolean;
  levelProgress: number;
  streak: number;
  streakExtended: boolean;
  todayXp: number;
  dailyGoal: number;
  dailyGoalReached: boolean;
  badges: { id: string; name: string; description: string; icon: string }[];
};

function counters(s: Partial<UserStatsDoc> | null): StatCounters {
  return {
    xp: s?.xp ?? 0,
    longestStreak: s?.longestStreak ?? 0,
    lessonsCompleted: s?.lessonsCompleted ?? 0,
    perfectPractices: s?.perfectPractices ?? 0,
    quizzesPassed: s?.quizzesPassed ?? 0,
    examsPassed: s?.examsPassed ?? 0,
    assignmentsSubmitted: s?.assignmentsSubmitted ?? 0,
  };
}

/** Awards a batch of items (each idempotent by key). Returns null when nothing new was earned. */
export async function award(userId: Id, items: AwardInput[], now: Date = new Date()): Promise<Reward | null> {
  const today = dayKey(now);
  const fresh: AwardInput[] = [];
  for (const item of items) {
    try {
      await XpEvent.create({ userId, courseId: item.courseId ?? null, key: item.key, source: item.source, amount: item.amount, day: today });
      fresh.push(item);
    } catch (e) {
      if ((e as { code?: number }).code !== 11000) throw e; // duplicate key = already awarded
    }
  }
  if (!fresh.length) return null;

  const before = await UserStats.findOne({ userId }).lean<UserStatsDoc>();
  const gained = fresh.reduce((n, i) => n + i.amount, 0);
  const goal = before?.dailyGoal ?? DEFAULT_DAILY_GOAL;
  const todayBefore = before?.todayDay === today ? (before?.todayXp ?? 0) : 0;
  const streak = nextStreak(before?.streak ?? 0, before?.lastActiveDay ?? "", today);

  const inc: Record<string, number> = { xp: gained };
  for (const item of fresh) for (const [k, v] of Object.entries(item.counters ?? {})) inc[k] = (inc[k] ?? 0) + (v ?? 0);

  let todayXp = todayBefore + gained;
  let bonus = 0;
  const goalReached = todayBefore < goal && todayXp >= goal;
  if (goalReached) {
    try {
      await XpEvent.create({ userId, key: `goal:${today}`, source: "daily_goal", amount: XP.dailyGoal, day: today });
      bonus = XP.dailyGoal;
      inc.xp += bonus;
      todayXp += bonus;
    } catch (e) {
      if ((e as { code?: number }).code !== 11000) throw e;
    }
  }

  const after = await UserStats.findOneAndUpdate(
    { userId },
    {
      $inc: inc,
      $set: { streak: streak.streak, lastActiveDay: today, todayDay: today, todayXp },
      $max: { longestStreak: streak.streak },
    },
    { upsert: true, returnDocument: "after" },
  ).lean<UserStatsDoc>();

  const owned = new Set((await UserBadge.find({ userId }).select("badgeId").lean()).map((b) => b.badgeId));
  const earned = newlyEarned(counters(after), owned);
  const badges: Reward["badges"] = [];
  for (const b of earned) {
    try {
      await UserBadge.create({ userId, badgeId: b.id });
      badges.push({ id: b.id, name: b.name, description: b.description, icon: b.icon });
    } catch (e) {
      if ((e as { code?: number }).code !== 11000) throw e;
    }
  }

  const lvlBefore = levelFor(before?.xp ?? 0).level;
  const lvl = levelFor(after!.xp);
  return {
    xpGained: gained + bonus,
    xp: after!.xp,
    level: lvl.level,
    leveledUp: lvl.level > lvlBefore,
    levelProgress: lvl.progress,
    streak: after!.streak,
    streakExtended: streak.extended,
    todayXp,
    dailyGoal: goal,
    dailyGoalReached: goalReached,
    badges,
  };
}

export type StatsSummary = {
  xp: number;
  level: ReturnType<typeof levelFor>;
  streak: number;
  activeToday: boolean;
  longestStreak: number;
  todayXp: number;
  dailyGoal: number;
  counters: StatCounters;
};

export async function statsFor(userId: Id, now: Date = new Date()): Promise<StatsSummary> {
  const s = await UserStats.findOne({ userId }).lean<UserStatsDoc>();
  const today = dayKey(now);
  const streak = displayStreak(s?.streak ?? 0, s?.lastActiveDay ?? "", today);
  return {
    xp: s?.xp ?? 0,
    level: levelFor(s?.xp ?? 0),
    streak: streak.streak,
    activeToday: streak.activeToday,
    longestStreak: s?.longestStreak ?? 0,
    todayXp: s?.todayDay === today ? (s?.todayXp ?? 0) : 0,
    dailyGoal: s?.dailyGoal ?? DEFAULT_DAILY_GOAL,
    counters: counters(s),
  };
}

export async function setDailyGoal(userId: Id, goal: number) {
  await UserStats.updateOne({ userId }, { $set: { dailyGoal: goal } }, { upsert: true });
}

export async function badgesFor(userId: Id) {
  const owned = new Map((await UserBadge.find({ userId }).lean()).map((b) => [b.badgeId, b.earnedAt]));
  return BADGES.map((b) => ({ id: b.id, name: b.name, description: b.description, icon: b.icon, earnedAt: owned.get(b.id) ?? null }));
}

/** XP per day for the last `days` days (oldest first). */
export async function xpByDay(userId: Id, days = 7, now: Date = new Date()) {
  const keys = Array.from({ length: days }, (_, i) => dayKey(new Date(now.getTime() - (days - 1 - i) * 86400_000)));
  const rows = await XpEvent.aggregate<{ _id: string; xp: number }>([
    { $match: { userId: new Types.ObjectId(String(userId)), day: { $in: keys } } },
    { $group: { _id: "$day", xp: { $sum: "$amount" } } },
  ]);
  return keys.map((day) => ({ day, xp: rows.find((r) => r._id === day)?.xp ?? 0 }));
}

export type LeaderboardRow = { rank: number; userId: string; name: string; xp: number; me: boolean };

/** This week's XP in a course (Monday → now): top `limit`, plus the learner's row if outside it. */
export async function weeklyLeaderboard(courseId: Id, meId: Id, limit = 10, now: Date = new Date()): Promise<LeaderboardRow[]> {
  const rows = await XpEvent.aggregate<{ _id: Types.ObjectId; xp: number }>([
    { $match: { courseId: new Types.ObjectId(String(courseId)), createdAt: { $gte: weekStart(now) } } },
    { $group: { _id: "$userId", xp: { $sum: "$amount" } } },
    { $sort: { xp: -1, _id: 1 } },
  ]);
  const ranked = rows.map((r, i) => ({ rank: i + 1, userId: String(r._id), xp: r.xp }));
  const mine = ranked.find((r) => r.userId === String(meId));
  const shown = ranked.slice(0, limit);
  if (mine && mine.rank > limit) shown.push(mine);
  const users = await User.find({ _id: { $in: shown.map((r) => r.userId) } }).select("name surname").lean();
  return shown.map((r) => {
    const u = users.find((x) => String(x._id) === r.userId);
    return { ...r, name: u ? publicName(u.name, u.surname) : "Apprenant", me: r.userId === String(meId) };
  });
}
