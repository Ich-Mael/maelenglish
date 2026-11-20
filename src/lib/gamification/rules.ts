/**
 * Gamification rules (pure — shared by server and UI, unit-tested).
 * XP is awarded once per item (idempotent keys); replaying a practice lesson
 * earns a small bonus at most once per lesson per day.
 */

export const XP = {
  lesson: 10,
  practiceBase: 10,
  /** + up to 10 according to the first-try score. */
  practiceScore: 10,
  practicePerfect: 5,
  practiceReplay: 5,
  quizPass: 25,
  quizPerfect: 10,
  examPass: 100,
  assignment: 15,
  /** When a coach validates an assignment / checkpoint. */
  assignmentGraded: 20,
  dailyGoal: 10,
} as const;

export const DEFAULT_DAILY_GOAL = 30;
export const DAILY_GOALS = [10, 20, 30, 50] as const;

export function practiceXp(score: number): number {
  return XP.practiceBase + Math.round((Math.max(0, Math.min(100, score)) / 100) * XP.practiceScore) + (score >= 100 ? XP.practicePerfect : 0);
}

/** Total XP needed to reach `level` (1-based): 0, 50, 150, 300, 500, 750… */
export function levelThreshold(level: number): number {
  return 25 * (level - 1) * level;
}

export function levelFor(xp: number): { level: number; current: number; next: number; progress: number } {
  let level = 1;
  while (xp >= levelThreshold(level + 1)) level++;
  const current = levelThreshold(level);
  const next = levelThreshold(level + 1);
  return { level, current, next, progress: Math.round(((xp - current) / (next - current)) * 100) };
}

const TZ = process.env.APP_TZ || "Africa/Ouagadougou";

/** Calendar day (YYYY-MM-DD) in the app time zone. */
export function dayKey(d: Date = new Date(), timeZone = TZ): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

export function previousDay(day: string): string {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/** Streak after activity on `today`. */
export function nextStreak(streak: number, lastActiveDay: string, today: string): { streak: number; extended: boolean } {
  if (lastActiveDay === today) return { streak: Math.max(streak, 1), extended: false };
  if (lastActiveDay && lastActiveDay === previousDay(today)) return { streak: streak + 1, extended: true };
  return { streak: 1, extended: true };
}

/** Streak as displayed today: kept if active today or yesterday, else lost. */
export function displayStreak(streak: number, lastActiveDay: string, today: string): { streak: number; activeToday: boolean } {
  if (lastActiveDay === today) return { streak, activeToday: true };
  if (lastActiveDay === previousDay(today)) return { streak, activeToday: false };
  return { streak: 0, activeToday: false };
}

/** Monday 00:00 (app time zone ≈ UTC+0 for Burkina Faso) of the current week, as a UTC date. */
export function weekStart(now: Date = new Date()): Date {
  const d = new Date(`${dayKey(now)}T00:00:00Z`);
  const dow = (d.getUTCDay() + 6) % 7; // Monday = 0
  d.setUTCDate(d.getUTCDate() - dow);
  return d;
}

export type StatCounters = {
  xp: number;
  longestStreak: number;
  lessonsCompleted: number;
  perfectPractices: number;
  quizzesPassed: number;
  examsPassed: number;
  assignmentsSubmitted: number;
};

export type BadgeIcon = "Footprints" | "BookOpen" | "Library" | "Flame" | "Zap" | "Crown" | "Target" | "Star" | "Trophy" | "GraduationCap" | "PenLine" | "Sparkles" | "Gem";

export type Badge = { id: string; name: string; description: string; icon: BadgeIcon; earned: (s: StatCounters) => boolean };

export const BADGES: readonly Badge[] = [
  { id: "first-lesson", name: "Premier pas", description: "Terminer votre première activité", icon: "Footprints", earned: (s) => s.lessonsCompleted >= 1 },
  { id: "lessons-10", name: "Lancé(e)", description: "Terminer 10 activités", icon: "BookOpen", earned: (s) => s.lessonsCompleted >= 10 },
  { id: "lessons-50", name: "Infatigable", description: "Terminer 50 activités", icon: "Library", earned: (s) => s.lessonsCompleted >= 50 },
  { id: "streak-3", name: "En rythme", description: "3 jours d'affilée", icon: "Flame", earned: (s) => s.longestStreak >= 3 },
  { id: "streak-7", name: "Une semaine pleine", description: "7 jours d'affilée", icon: "Zap", earned: (s) => s.longestStreak >= 7 },
  { id: "streak-30", name: "Habitude en or", description: "30 jours d'affilée", icon: "Crown", earned: (s) => s.longestStreak >= 30 },
  { id: "perfect-1", name: "Sans faute", description: "Réussir une pratique à 100 %", icon: "Target", earned: (s) => s.perfectPractices >= 1 },
  { id: "perfect-10", name: "Précision chirurgicale", description: "10 pratiques à 100 %", icon: "Gem", earned: (s) => s.perfectPractices >= 10 },
  { id: "quiz-1", name: "Premier quiz", description: "Réussir un quiz de module", icon: "Star", earned: (s) => s.quizzesPassed >= 1 },
  { id: "quiz-5", name: "As des quiz", description: "Réussir 5 quiz de module", icon: "Trophy", earned: (s) => s.quizzesPassed >= 5 },
  { id: "assignment-1", name: "Plume", description: "Envoyer un premier devoir", icon: "PenLine", earned: (s) => s.assignmentsSubmitted >= 1 },
  { id: "xp-1000", name: "Mille points", description: "Gagner 1 000 XP", icon: "Sparkles", earned: (s) => s.xp >= 1000 },
  { id: "graduate", name: "Diplômé(e)", description: "Réussir un examen final", icon: "GraduationCap", earned: (s) => s.examsPassed >= 1 },
];

/** Badges whose condition is met and that the learner doesn't own yet. */
export function newlyEarned(stats: StatCounters, owned: ReadonlySet<string>): Badge[] {
  return BADGES.filter((b) => !owned.has(b.id) && b.earned(stats));
}

/** « Awa Ouédraogo » → « Awa O. » (leaderboards). */
export function publicName(name: string, surname: string): string {
  return `${name} ${surname ? `${surname.charAt(0).toUpperCase()}.` : ""}`.trim();
}
