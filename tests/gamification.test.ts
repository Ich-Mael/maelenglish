import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { Course, User, UserBadge, UserStats, XpEvent } from "@/models";
import { award, badgesFor, statsFor, weeklyLeaderboard, xpByDay } from "@/lib/gamification/service";
import { BADGES, BADGE_GROUPS, dayKey, displayStreak, levelFor, levelThreshold, metricsFromSources, nextStreak, practiceXp, previousDay, publicName, weekStart } from "@/lib/gamification/rules";

describe("rules", () => {
  it("levels", () => {
    expect([1, 2, 3, 4].map(levelThreshold)).toEqual([0, 50, 150, 300]);
    expect(levelFor(0)).toMatchObject({ level: 1, progress: 0 });
    expect(levelFor(49).level).toBe(1);
    expect(levelFor(50)).toMatchObject({ level: 2, current: 50, next: 150, progress: 0 });
    expect(levelFor(100).progress).toBe(50);
  });

  it("practice XP grows with the score", () => {
    expect(practiceXp(0)).toBe(10);
    expect(practiceXp(70)).toBe(17);
    expect(practiceXp(100)).toBe(25);
  });

  it("streaks", () => {
    expect(previousDay("2026-03-01")).toBe("2026-02-28");
    expect(nextStreak(0, "", "2026-11-18")).toEqual({ streak: 1, extended: true });
    expect(nextStreak(4, "2026-11-17", "2026-11-18")).toEqual({ streak: 5, extended: true });
    expect(nextStreak(5, "2026-11-18", "2026-11-18")).toEqual({ streak: 5, extended: false });
    expect(nextStreak(5, "2026-11-15", "2026-11-18")).toEqual({ streak: 1, extended: true });
    expect(displayStreak(5, "2026-11-17", "2026-11-18")).toEqual({ streak: 5, activeToday: false });
    expect(displayStreak(5, "2026-11-16", "2026-11-18")).toEqual({ streak: 0, activeToday: false });
  });

  it("days and weeks in the app time zone", () => {
    expect(dayKey(new Date("2026-11-18T23:30:00Z"), "Africa/Ouagadougou")).toBe("2026-11-18");
    expect(dayKey(new Date("2026-11-18T23:30:00Z"), "Europe/Paris")).toBe("2026-11-19");
    expect(weekStart(new Date("2026-11-18T10:00:00Z")).toISOString()).toBe("2026-11-16T00:00:00.000Z"); // Wednesday → Monday
    expect(publicName("Awa", "ouédraogo")).toBe("Awa O.");
  });
});

let mongo: MongoMemoryServer;
beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  await Promise.all(mongoose.modelNames().map((n) => mongoose.model(n).syncIndexes()));
});
afterAll(async () => {
  await mongoose.disconnect();
  await mongo?.stop();
});
beforeEach(async () => {
  await Promise.all(mongoose.modelNames().map((n) => mongoose.model(n).deleteMany({})));
});

const learner = (username: string, name = "Awa") => User.create({ name, surname: "Ouédraogo", username, email: `${username}@example.com` });
const day = (iso: string) => new Date(`${iso}T10:00:00Z`);

describe("award", () => {
  it("is idempotent per key and updates counters, level and badges", async () => {
    const u = await learner("awa");
    const r = await award(u._id, [{ key: "lesson:1", source: "lesson", amount: 10, counters: { lessonsCompleted: 1 } }], day("2026-11-16"));
    expect(r).toMatchObject({ xpGained: 10, xp: 10, level: 1, streak: 1, streakExtended: true });
    expect(r?.badges.map((b) => b.id)).toEqual(["first-lesson"]);

    expect(await award(u._id, [{ key: "lesson:1", source: "lesson", amount: 10 }], day("2026-11-16"))).toBeNull();
    expect(await XpEvent.countDocuments({ userId: u._id })).toBe(1);
  });

  it("counts skill badges from the XP history (past work too), and flags skills without exercises as coming soon", async () => {
    const u = await learner("awa");
    expect(metricsFromSources({ listen_choose: 1, listen_match: 1, listen_fill_gaps: 1, fill_gaps: 2, match_pairs: 1, challenge_validated: 1, daily_goal: 4, practice_replay: 2, speaking_challenge: 9 })).toEqual({ listening: 3, language: 3, reading: 0, writing: 0, pronunciation: 0, challengesValidated: 1, dailyGoals: 4, replays: 2 });
    // Activity steps done before these badges existed: granted when the page is opened.
    await XpEvent.create([
      { userId: u._id, key: "step:1", source: "listen_choose", amount: 10, day: "2026-11-16" },
      { userId: u._id, key: "graded:1", source: "challenge_validated", amount: 20, day: "2026-11-16" },
    ]);
    const all = (await badgesFor(u._id)).flatMap((g) => g.badges);
    const get = (id: string) => all.find((b) => b.id === id)!;
    expect([!!get("listen-1").earnedAt, !!get("validated-1").earnedAt, get("listen-10").value, !!get("lang-1").earnedAt]).toEqual([true, true, 1, false]);
    expect([get("listen-1").available, get("read-1").available, get("write-1").available, get("pron-1").available]).toEqual([true, true, true, true]);
    expect(await UserBadge.countDocuments({ userId: u._id })).toBe(2);
    // Every badge belongs to a group, ids are unique.
    expect(new Set(BADGES.map((b) => b.id)).size).toBe(BADGES.length);
    expect(BADGES.every((b) => BADGE_GROUPS.some((g) => g.id === b.group))).toBe(true);
  });

  it("adds the daily goal bonus once, and levels up", async () => {
    const u = await learner("awa");
    const r1 = await award(u._id, [{ key: "a", source: "lesson", amount: 25 }], day("2026-11-16"));
    expect(r1?.dailyGoalReached).toBe(false);
    const r2 = await award(u._id, [{ key: "b", source: "lesson", amount: 10 }], day("2026-11-16"));
    expect(r2).toMatchObject({ dailyGoalReached: true, xpGained: 20, todayXp: 45, xp: 45 });
    const r3 = await award(u._id, [{ key: "c", source: "lesson", amount: 10 }], day("2026-11-16"));
    expect(r3).toMatchObject({ dailyGoalReached: false, xp: 55, level: 2, leveledUp: true });
  });

  it("keeps the streak across consecutive days and resets after a gap", async () => {
    const u = await learner("awa");
    for (const [i, d] of ["2026-11-16", "2026-11-17", "2026-11-18"].entries()) {
      const r = await award(u._id, [{ key: `k${i}`, source: "lesson", amount: 5 }], day(d));
      expect(r?.streak).toBe(i + 1);
    }
    const s = await UserStats.findOne({ userId: u._id }).lean();
    expect(s?.longestStreak).toBe(3);
    expect((await badgesFor(u._id)).flatMap((g) => g.badges).find((b) => b.id === "streak-3")?.earnedAt).toBeInstanceOf(Date);

    const r = await award(u._id, [{ key: "late", source: "lesson", amount: 5 }], day("2026-11-21"));
    expect(r?.streak).toBe(1);
    expect((await statsFor(u._id, day("2026-11-21"))).longestStreak).toBe(3);
    expect((await statsFor(u._id, day("2026-11-25"))).streak).toBe(0);
  });

  it("weekly leaderboard per course, with public names", async () => {
    const [a, b, c] = await Promise.all([learner("a", "Awa"), learner("b", "Bintou"), learner("c", "Cheick")]);
    const course = await Course.create({ title: "Aviation", program: "aviation" });
    const other = await Course.create({ title: "Business", program: "business" });
    await award(a._id, [{ key: "1", source: "lesson", amount: 30, courseId: course._id }]);
    await award(b._id, [{ key: "1", source: "lesson", amount: 50, courseId: course._id }]);
    await award(c._id, [{ key: "1", source: "lesson", amount: 99, courseId: other._id }]);
    await XpEvent.create({ userId: c._id, courseId: course._id, key: "old", source: "lesson", amount: 500, day: "2020-01-01", createdAt: new Date("2020-01-01") });

    const board = await weeklyLeaderboard(course._id, a._id);
    expect(board.map((r) => [r.rank, r.name, r.me])).toEqual([[1, "Bintou O.", false], [2, "Awa O.", true]]);
    expect(board[0].xp).toBe(50);

    const series = await xpByDay(a._id, 7);
    expect(series).toHaveLength(7);
    expect(series.at(-1)?.xp).toBeGreaterThanOrEqual(30);
  });
});
