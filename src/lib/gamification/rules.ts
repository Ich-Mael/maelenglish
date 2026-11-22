/**
 * Gamification rules (pure — shared by server and UI, unit-tested).
 * XP is awarded once per item (idempotent keys); replaying an activity step
 * earns a small bonus at most once per step per day.
 */

import { ACTIVITY_INFO, isActivityType } from "@/lib/lab/types";

export const XP = {
  /** Lesson step (« Continuer »). */
  lesson: 10,
  /** Activity step: base + score bonus (+ perfect). */
  practiceBase: 10,
  /** + up to 10 according to the first-try score. */
  practiceScore: 10,
  practicePerfect: 5,
  practiceReplay: 5,
  examPass: 100,
  /** Unit speaking challenge sent. */
  challenge: 15,
  /** When a coach validates a speaking challenge. */
  challengeValidated: 20,
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

/**
 * What badges measure. Stored counters (UserStats; names kept from the first course structure:
 * `lessonsCompleted` counts completed steps — lessons and activities —, `perfectPractices`
 * activities at 100 %, `assignmentsSubmitted` speaking challenges sent; `quizzesPassed` is no longer
 * incremented) plus counts from the XP history (`XpEvent.source`, see `metricsFromSources`): first
 * completions per skill family, coach validations, daily goals reached, replays. Counting from the
 * history makes new badges count past work too.
 */
export type StatCounters = {
  xp: number;
  longestStreak: number;
  lessonsCompleted: number;
  perfectPractices: number;
  quizzesPassed: number;
  examsPassed: number;
  assignmentsSubmitted: number;
  listening?: number;
  language?: number;
  reading?: number;
  writing?: number;
  pronunciation?: number;
  challengesValidated?: number;
  dailyGoals?: number;
  replays?: number;
};
export type BadgeMetric = Exclude<keyof StatCounters, "quizzesPassed"> | "level";

/** History counts by XpEvent source: activity steps carry their Lab type as source (first completion). */
export function metricsFromSources(bySource: Record<string, number>): Pick<StatCounters, "listening" | "language" | "reading" | "writing" | "pronunciation" | "challengesValidated" | "dailyGoals" | "replays"> {
  const out = { listening: 0, language: 0, reading: 0, writing: 0, pronunciation: 0, challengesValidated: bySource.challenge_validated ?? 0, dailyGoals: bySource.daily_goal ?? 0, replays: bySource.practice_replay ?? 0 };
  for (const [source, n] of Object.entries(bySource)) {
    const skill = isActivityType(source) ? ACTIVITY_INFO[source].skill : null;
    if (skill && skill !== "speaking") out[skill] += n;
  }
  return out;
}

export const metricValue = (s: StatCounters, m: BadgeMetric): number => (m === "level" ? levelFor(s.xp).level : (s[m] ?? 0));

export type BadgeIcon =
  | "Footprints" | "Route" | "Library" | "Mountain" | "GraduationCap"
  | "Flame" | "Zap" | "CalendarCheck" | "Crown" | "Goal" | "Medal"
  | "Headphones" | "Ear" | "AudioLines"
  | "Puzzle" | "Blocks" | "PenLine"
  | "BookOpen" | "Eye"
  | "Mail" | "Feather"
  | "Mic" | "Trophy" | "Megaphone" | "BadgeCheck" | "Award" | "Speech"
  | "Target" | "Gem" | "Diamond" | "RefreshCw"
  | "Star" | "Sparkles" | "Rocket";

export const BADGE_GROUPS = [
  { id: "parcours", name: "Parcours", description: "Avancer dans vos cours, activité après activité.", icon: "Footprints" },
  { id: "regularite", name: "Régularité", description: "Revenir chaque jour : c'est le secret des progrès.", icon: "Flame" },
  { id: "oral", name: "Prise de parole", description: "Parler, se réenregistrer, convaincre votre coach.", icon: "Mic" },
  { id: "ecoute", name: "Écoute", description: "Comprendre l'anglais du travail à vitesse réelle.", icon: "Headphones" },
  { id: "langue", name: "Grammaire & vocabulaire", description: "Le mot juste et des phrases bien construites.", icon: "Puzzle" },
  { id: "lecture", name: "Lecture", description: "E-mails, rapports, consignes : lire vite et bien.", icon: "BookOpen" },
  { id: "ecrit", name: "Écrit professionnel", description: "Rédiger des e-mails clairs et polis.", icon: "Mail" },
  { id: "precision", name: "Précision", description: "Viser le sans-faute et revenir sur ses erreurs.", icon: "Target" },
  { id: "niveaux", name: "Niveaux & XP", description: "Chaque activité vous rapporte des points.", icon: "Sparkles" },
] as const satisfies readonly { id: string; name: string; description: string; icon: BadgeIcon }[];
export type BadgeGroup = (typeof BADGE_GROUPS)[number]["id"];

/** `tier` 1–3: how hard it is (shown as 1–3 stars and a stronger medal). */
export type Badge = { id: string; name: string; description: string; icon: BadgeIcon; group: BadgeGroup; metric: BadgeMetric; goal: number; tier: 1 | 2 | 3 };

const b = (group: BadgeGroup, id: string, name: string, description: string, icon: BadgeIcon, metric: BadgeMetric, goal: number, tier: 1 | 2 | 3): Badge => ({ id, name, description, icon, group, metric, goal, tier });

/** Badge catalogue (ids are stored in UserBadge: never rename one). Skills without a Lab type yet show as « bientôt ». */
export const BADGES: readonly Badge[] = [
  b("parcours", "first-lesson", "Premier pas", "Terminer votre première activité", "Footprints", "lessonsCompleted", 1, 1),
  b("parcours", "lessons-10", "Lancé(e)", "Terminer 10 activités", "Route", "lessonsCompleted", 10, 1),
  b("parcours", "lessons-50", "Infatigable", "Terminer 50 activités", "Library", "lessonsCompleted", 50, 2),
  b("parcours", "lessons-100", "Marathonien(ne)", "Terminer 100 activités", "Mountain", "lessonsCompleted", 100, 3),
  b("parcours", "graduate", "Diplômé(e)", "Réussir un examen final", "GraduationCap", "examsPassed", 1, 3),

  b("regularite", "streak-3", "En rythme", "3 jours d'affilée", "Flame", "longestStreak", 3, 1),
  b("regularite", "streak-7", "Une semaine pleine", "7 jours d'affilée", "Zap", "longestStreak", 7, 2),
  b("regularite", "streak-14", "Deux semaines d'élan", "14 jours d'affilée", "CalendarCheck", "longestStreak", 14, 2),
  b("regularite", "streak-30", "Habitude en or", "30 jours d'affilée", "Crown", "longestStreak", 30, 3),
  b("regularite", "goal-5", "Objectif tenu", "Atteindre 5 fois votre objectif du jour", "Goal", "dailyGoals", 5, 1),
  b("regularite", "goal-25", "Discipline de pro", "Atteindre 25 fois votre objectif du jour", "Medal", "dailyGoals", 25, 3),

  b("oral", "challenge-1", "Première prise de parole", "Envoyer votre premier défi oral", "Mic", "assignmentsSubmitted", 1, 1),
  b("oral", "challenge-5", "Orateur", "Envoyer 5 défis oraux", "Trophy", "assignmentsSubmitted", 5, 2),
  b("oral", "challenge-15", "Voix de leader", "Envoyer 15 défis oraux", "Megaphone", "assignmentsSubmitted", 15, 3),
  b("oral", "validated-1", "Validé par le coach", "Faire valider un défi oral par votre coach", "BadgeCheck", "challengesValidated", 1, 1),
  b("oral", "validated-10", "Coach conquis", "Faire valider 10 défis oraux", "Award", "challengesValidated", 10, 3),
  b("oral", "pron-1", "Bonne prononciation", "Terminer un exercice « Répétez après Mael »", "Speech", "pronunciation", 1, 1),
  b("oral", "pron-20", "Accent maîtrisé", "Terminer 20 exercices de prononciation", "AudioLines", "pronunciation", 20, 2),

  b("ecoute", "listen-1", "Oreille tendue", "Terminer votre première activité d'écoute", "Headphones", "listening", 1, 1),
  b("ecoute", "listen-10", "Oreille fine", "Terminer 10 activités d'écoute", "Ear", "listening", 10, 2),
  b("ecoute", "listen-30", "Oreille d'or", "Terminer 30 activités d'écoute", "AudioLines", "listening", 30, 3),

  b("langue", "lang-1", "Le mot juste", "Terminer votre première activité de grammaire ou de vocabulaire", "Puzzle", "language", 1, 1),
  b("langue", "lang-10", "Bâtisseur de phrases", "Terminer 10 activités de grammaire ou de vocabulaire", "Blocks", "language", 10, 2),
  b("langue", "lang-30", "Maître des mots", "Terminer 30 activités de grammaire ou de vocabulaire", "PenLine", "language", 30, 3),

  b("lecture", "read-1", "Lecteur attentif", "Terminer votre première activité de lecture", "BookOpen", "reading", 1, 1),
  b("lecture", "read-10", "Œil de lynx", "Terminer 10 activités de lecture", "Eye", "reading", 10, 2),

  b("ecrit", "write-1", "Premier e-mail pro", "Rédiger votre premier e-mail dans le Labo", "Mail", "writing", 1, 1),
  b("ecrit", "write-10", "Plume d'affaires", "Rédiger 10 e-mails professionnels", "Feather", "writing", 10, 2),

  b("precision", "perfect-1", "Sans faute", "Réussir une activité à 100 %", "Target", "perfectPractices", 1, 1),
  b("precision", "perfect-10", "Précision chirurgicale", "10 activités à 100 %", "Gem", "perfectPractices", 10, 2),
  b("precision", "perfect-25", "Zéro défaut", "25 activités à 100 %", "Diamond", "perfectPractices", 25, 3),
  b("precision", "replays-10", "Perfectionniste", "Refaire 10 fois une activité déjà terminée", "RefreshCw", "replays", 10, 2),

  b("niveaux", "level-5", "Niveau 5", "Atteindre le niveau 5", "Star", "level", 5, 1),
  b("niveaux", "xp-1000", "Mille points", "Gagner 1 000 XP", "Sparkles", "xp", 1000, 2),
  b("niveaux", "level-10", "Niveau 10", "Atteindre le niveau 10", "Award", "level", 10, 2),
  b("niveaux", "xp-5000", "Cinq mille points", "Gagner 5 000 XP", "Rocket", "xp", 5000, 3),
];

/** Skill families with at least one Lab type: badges of the others are « bientôt » (exercise not built yet). */
const LIVE_SKILLS = new Set<string>(Object.values(ACTIVITY_INFO).map((i) => i.skill));
const SKILL_METRICS = new Set<BadgeMetric>(["listening", "language", "reading", "writing", "pronunciation"]);
export const badgeAvailable = (badge: Badge) => !SKILL_METRICS.has(badge.metric) || LIVE_SKILLS.has(badge.metric);

export const badgeEarned = (badge: Badge, s: StatCounters) => metricValue(s, badge.metric) >= badge.goal;

/** Badges whose condition is met and that the learner doesn't own yet. */
export function newlyEarned(stats: StatCounters, owned: ReadonlySet<string>): Badge[] {
  return BADGES.filter((x) => !owned.has(x.id) && badgeEarned(x, stats));
}

/** « Awa Ouédraogo » → « Awa O. » (leaderboards). */
export function publicName(name: string, surname: string): string {
  return `${name} ${surname ? `${surname.charAt(0).toUpperCase()}.` : ""}`.trim();
}
