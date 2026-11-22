/*
 * Lab activity types (labels and descriptions are shown in the admin, in English) (shared by browser and server, no imports). Each type gets its own editor
 * (admin) and its own player (learner), designed one by one. Add a type here, then its content
 * rules in `content.ts`, its editor in components/lab/editors and its player in components/lab/players.
 */

export const ACTIVITY_TYPES = ["listen_choose", "fill_gaps", "listen_fill_gaps", "sentence_builder", "speaking_challenge"] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];

/** `challenge`: closes a unit (its last step, kind challenge); `practice`: an activity step practising a lesson. */
export type ActivityRole = "practice" | "challenge";

/**
 * Skill family of a type, for the learner's skill badges (src/lib/gamification/rules.ts): listening
 * (L…), language = grammar & vocabulary (V…), reading (R…), writing (W…), pronunciation (S1 repeat
 * after Mael), speaking (the unit challenge, counted separately).
 */
export const SKILL_FAMILIES = ["listening", "language", "reading", "writing", "pronunciation", "speaking"] as const;
export type SkillFamily = (typeof SKILL_FAMILIES)[number];

export const ACTIVITY_INFO: Record<ActivityType, { label: string; description: string; role: ActivityRole; skill: SkillFamily }> = {
  "listen_choose": {
    label: "Listening comprehension",
    description: "An audio clip and multiple-choice questions. At correction, the learner replays the exact passage of each answer.",
    role: "practice",
    skill: "listening",
  },
  "fill_gaps": {
    label: "Fill the gaps",
    description: "A text with blanks to complete. Each blank shows the shape of its answer (words and letters); optional word bank.",
    role: "practice",
    skill: "language",
  },
  "listen_fill_gaps": {
    label: "Listen and fill the gaps",
    description: "An audio clip and its transcript with blanks: the learner completes what they hear. At correction, each blank replays its sentence.",
    role: "practice",
    skill: "listening",
  },
  "sentence_builder": {
    label: "Sentence builder",
    description: "Word tiles to put back in order, one sentence per screen; optional French translation, distractor tiles and the sentence's audio.",
    role: "practice",
    skill: "language",
  },
  "speaking_challenge": {
    label: "Speaking challenge",
    description: "The learner records an answer to instructions; a coach gives feedback. Closes a unit.",
    role: "challenge",
    skill: "speaking",
  },
};

export const isActivityType = (t: unknown): t is ActivityType => ACTIVITY_TYPES.includes(t as ActivityType);

/**
 * Unit speaking challenge (owner spec: prompt, prep and record timers, « must include » checklist,
 * model answer). The model answer (text + optional audio) is shown once the recording is sent.
 */
/** What the learner reacts to: the instructions alone, or a picture to describe, a video or an audio to give an opinion on / answer questions about. */
export const PROMPT_TYPES = ["text", "image", "video", "audio"] as const;
export type PromptType = (typeof PROMPT_TYPES)[number];

export type SpeakingChallengeContent = {
  instructions: string;
  promptType: PromptType;
  /** Image (Media kind « image ») or audio (« model-audio ») of the prompt. */
  promptMediaId: string;
  /** Video link (YouTube, Vimeo or an .mp4 file). */
  promptVideoUrl: string;
  /** Picture description (screen readers, and a caption if the image doesn't load). */
  promptAlt: string;
  /** Optional questions the learner answers in the recording (French or English), one per line in the editor. */
  questions: string[];
  maxSeconds: number;
  prepSeconds: number;
  mustInclude: string[];
  modelAnswerText: string;
  modelAnswerAudioMediaId: string;
};

/** A question of a listening comprehension. `startS`: where the answer is heard (replayed at correction). */
export type ListeningQuestion = { id: string; text: string; options: { id: string; text: string }[]; correctOptionId: string; explanation: string; startS: number | null };

export type ListeningContent = {
  audioMediaId: string;
  audioDurationS: number;
  /** Rich text shown above the player (situation, in French). */
  context: string;
  /** Plain text, shown after the answers are sent. */
  transcript: string;
  /** 0 = unlimited; 2 or 3 for exam-style activities (lifted once the answers are sent). */
  maxPlays: number;
  questions: ListeningQuestion[];
};

/** What the learner's browser receives before answering: no answers, explanations or transcript. */
export type PublicListeningQuestion = Pick<ListeningQuestion, "id" | "text" | "options">;

/**
 * Fill the gaps: one text (one sentence or paragraph per line) where each answer is written in
 * square brackets — « I [am] the new sales manager. » —, alternatives separated by « | »
 * (« I [am|'m] from Ghana. »; the first one sets the blank's shape and is the answer shown).
 */
export type GapHint = "letters" | "first" | "words";
export const GAP_HINTS: readonly GapHint[] = ["letters", "first", "words"];
export type GapsContent = {
  text: string;
  /** One per blank, in order (French, optional). */
  explanations: string[];
  /** What each blank shows: one dash per letter (words apart) · the same with the first letter · only one box per word. */
  hint: GapHint;
  /** Answers (+ distractors) offered as tappable chips. */
  wordBank: boolean;
  distractors: string[];
  /** Accept one typo in answers of 4+ letters. */
  typos: boolean;
};
/**
 * Listen and fill the gaps (catalogue L3): the fill-the-gaps text is the transcript of an audio
 * clip. A line may start with the moment it is heard — « @0:12 I [work] for a telecom company. » —
 * to replay that sentence at correction. Same blanks, hints, word bank and scoring as `fill_gaps`.
 */
export type ListenGapsContent = GapsContent & {
  audioMediaId: string;
  audioDurationS: number;
  /** Rich text shown above the player (situation, in French). */
  context: string;
  /** 0 = unlimited; 2 or 3 = exam style (no seeking until the first check). */
  maxPlays: number;
};
export type Gap = { id: string; index: number; answers: string[]; explanation: string };
export type GapSegment = { kind: "text"; text: string } | { kind: "gap"; gap: Gap };

/** « @0:12 » at the start of a line (listen and fill the gaps). */
export const LINE_TIME = /^\s*@\s*(\d+:\d{1,2}(?:[.,]\d)?)\s*/;

/**
 * The text as lines of segments, and its blanks (ids g1, g2… in reading order). `timed`: lines may
 * start with « @m:ss » (listen and fill the gaps), returned in `times` (null = no time) and removed
 * from the text; blank ids are the same either way.
 */
export function parseGaps(c: Pick<GapsContent, "text" | "explanations">, opts: { timed?: boolean } = {}): { lines: GapSegment[][]; gaps: Gap[]; times: (number | null)[] } {
  const gaps: Gap[] = [];
  const times: (number | null)[] = [];
  const lines = c.text
    .split(/\r?\n/)
    .filter((l) => l.trim())
    .map((raw) => {
      const t = opts.timed ? raw.match(LINE_TIME) : null;
      times.push(t ? parseTime(t[1]) : null);
      const line = t ? raw.slice(t[0].length) : raw;
      const out: GapSegment[] = [];
      let last = 0;
      for (const m of line.matchAll(/\[([^\[\]]*)\]/g)) {
        const answers = m[1].split("|").map((a) => a.trim().replace(/\s+/g, " ")).filter(Boolean);
        if (!answers.length) continue;
        if (m.index! > last) out.push({ kind: "text", text: line.slice(last, m.index) });
        const gap: Gap = { id: `g${gaps.length + 1}`, index: gaps.length, answers, explanation: c.explanations?.[gaps.length] ?? "" };
        gaps.push(gap);
        out.push({ kind: "gap", gap });
        last = m.index! + m[0].length;
      }
      if (last < line.length) out.push({ kind: "text", text: line.slice(last) });
      return out;
    });
  return { lines, gaps, times };
}

/** Index of the line holding a blank, or -1. */
export const lineOfGap = (lines: GapSegment[][], gapId: string) => lines.findIndex((l) => l.some((s) => s.kind === "gap" && s.gap.id === gapId));

/**
 * V4 — Sentence builder: the sentence is written with « / » between its tiles (« I / would like /
 * to book / a meeting. » — a tile may hold several words; without « / » every word is a tile).
 * `alternatives`: other accepted sentences (plain text); `distractors`: extra wrong tiles;
 * `translation`: French hint; `audioMediaId`: the sentence read aloud (model-audio).
 */
export type SentenceItem = { id: string; sentence: string; translation: string; distractors: string[]; alternatives: string[]; explanation: string; audioMediaId: string };
/** `audioWhen`: « after » = heard once answered (reward / model); « before » = heard first, the learner rebuilds what they heard. */
export const SENTENCE_AUDIO_WHEN = ["after", "before"] as const;
export type SentenceContent = { items: SentenceItem[]; audioWhen: (typeof SENTENCE_AUDIO_WHEN)[number] };

/** Tiles of a sentence, in the right order. */
export function sentenceTiles(sentence: string): string[] {
  const s = sentence.trim();
  return (s.includes("/") ? s.split("/") : s.split(/\s+/)).map((t) => t.trim().replace(/\s+/g, " ")).filter(Boolean);
}
/** The sentence as read: its tiles joined by spaces. */
export const sentenceText = (sentence: string) => sentenceTiles(sentence).join(" ");

export type ActivityContent = { "listen_choose": ListeningContent; "fill_gaps": GapsContent; "listen_fill_gaps": ListenGapsContent; "sentence_builder": SentenceContent; "speaking_challenge": SpeakingChallengeContent };

export const MAX_PLAYS = [0, 2, 3] as const;

/** « 1:05 » → 65; « 42 » → 42; empty or invalid → null. */
export function parseTime(v: string): number | null {
  const m = v.trim().match(/^(?:(\d+):)?(\d+(?:[.,]\d)?)$/);
  if (!m) return null;
  const sec = Number(m[2].replace(",", "."));
  if (m[1] && sec >= 60) return null;
  return (m[1] ? Number(m[1]) * 60 : 0) + sec;
}
export const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

export const MAX_SECONDS = [30, 45, 60, 90, 120, 180] as const;
export const PREP_SECONDS = [0, 10, 15, 30, 60] as const;

/**
 * Transcript lines, each optionally starting with its time: « [0:12] Flight 512 is now boarding. »
 * Used to highlight the line where an answer is heard.
 */
export type TranscriptLine = { startS: number | null; text: string };
export function parseTranscript(text: string): TranscriptLine[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const m = l.match(/^\[(\d+:\d{1,2}(?:[.,]\d)?|\d+(?:[.,]\d)?)\]\s*(.*)$/);
      return m ? { startS: parseTime(m[1]), text: m[2] } : { startS: null, text: l };
    });
}
/** Index of the timed line playing at `t` (the last line starting at or before it), or -1. */
export function lineAt(lines: TranscriptLine[], t: number | null): number {
  if (t === null) return -1;
  let best = -1;
  lines.forEach((l, i) => {
    if (l.startS !== null && l.startS <= t + 0.05 && (best === -1 || l.startS >= (lines[best].startS ?? 0))) best = i;
  });
  return best;
}
