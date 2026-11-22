/*
 * Lab activity types (labels and descriptions are shown in the admin, in English) (shared by browser and server, no imports). Each type gets its own editor
 * (admin) and its own player (learner), designed one by one. Add a type here, then its content
 * rules in `content.ts`, its editor in components/lab/editors and its player in components/lab/players.
 */

export const ACTIVITY_TYPES = ["listen_choose", "fill_gaps", "listen_fill_gaps", "sentence_builder", "match_pairs", "listen_match", "true_false_ng", "complete_words", "repeat_after", "writing_task", "dictation", "role_play", "speaking_challenge"] as const;
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
  "match_pairs": {
    label: "Matching pairs",
    description: "Two columns to match: English words or phrases and their translation, definition or reply. A few pairs per screen; mistakes and time are shown at the end.",
    role: "practice",
    skill: "language",
  },
  "listen_match": {
    label: "Listen and match",
    description: "Matching pairs where the meanings are heard, not read: written English words on the left, audio cards on the right. The results show each audio's transcript.",
    role: "practice",
    skill: "listening",
  },
  "true_false_ng": {
    label: "True / false / not given",
    description: "A short work document (email, notice, memo…) and statements to judge: true, false or not given. At correction, the sentence that proves the answer is highlighted.",
    role: "practice",
    skill: "reading",
  },
  "complete_words": {
    label: "Complete the words",
    description: "A paragraph where some words keep only their beginning: the learner types the missing letters, one box per letter (« C-test »). Automatic blanking available.",
    role: "practice",
    skill: "language",
  },
  "repeat_after": {
    label: "Repeat after Mael",
    description: "Short phrases to hear and repeat: the browser's speech recognition shows which words were understood (self-assessment where it isn't available).",
    role: "practice",
    skill: "pronunciation",
  },
  "writing_task": {
    label: "Writing task",
    description: "A prompt, the learner writes their answer (an email, a message…) and sends it to their coach, who corrects it starting from an AI draft.",
    role: "practice",
    skill: "writing",
  },
  "dictation": {
    label: "Dictation",
    description: "Sentences to hear and type: each word is checked (right, wrong, missing). Slow replay and a first-letters hint.",
    role: "practice",
    skill: "listening",
  },
  "role_play": {
    label: "AI role-play",
    description: "A spoken conversation with an AI that plays a professional counterpart (interviewer, client, manager…), followed by a debrief: scores, corrections, better ways to say it, Mael's tip.",
    role: "practice",
    skill: "speaking",
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

/**
 * V1 — Matching pairs: `left` (English word / phrase / situation) ↔ `right` (French translation,
 * definition or the reply), optional French `explanation` (shown for missed pairs) and audio of the
 * English side (model-audio, played when the card is tapped). `perScreen` pairs per screen.
 */
export type MatchPair = { id: string; left: string; right: string; explanation: string; audioMediaId: string; /** listen_match: the right side as audio (`right` = its transcript). */ rightAudioMediaId?: string };
export const MATCH_PER_SCREEN = [4, 5, 6] as const;
export type MatchContent = { pairs: MatchPair[]; perScreen: (typeof MATCH_PER_SCREEN)[number] };

/** Pairs split into screens of about `perScreen`, balanced (7 pairs by 5 → 4 + 3, never 5 + 2… nor a screen of 1). */
export function matchScreens<T>(pairs: readonly T[], perScreen: number): T[][] {
  if (!pairs.length) return [];
  const n = Math.ceil(pairs.length / Math.max(2, perScreen));
  const base = Math.floor(pairs.length / n);
  let extra = pairs.length % n;
  const out: T[][] = [];
  for (let i = 0, at = 0; i < n; i++) {
    const size = base + (extra-- > 0 ? 1 : 0);
    out.push(pairs.slice(at, at + size));
    at += size;
  }
  return out;
}

/**
 * R1 — True / false / not given: `text` = the document in English, one sentence per line
 * (`docSentences`); `docTitle` optional (« E-mail de la DRH »). Each statement has its answer and,
 * for true / false, `evidence` = index of the sentence that proves it (highlighted at correction).
 * The document may also (or only) be a picture — `imageMediaId`, e.g. a screenshot of an email —:
 * without text, `quote` (typed by staff) is the proof shown in the feedback.
 */
export const TFNG_ANSWERS = ["true", "false", "not_given"] as const;
export type TfngAnswer = (typeof TFNG_ANSWERS)[number];
/** `audioMediaId`: the statement read aloud (model-audio): heard first, its text folded under « Afficher le texte ». */
export type TfngStatement = { id: string; text: string; answer: TfngAnswer; evidence: number | null; explanation: string; quote?: string; audioMediaId?: string };
export type TfngContent = { docTitle: string; text: string; statements: TfngStatement[]; imageMediaId?: string; imageAlt?: string };
/** Answer labels: the English exam wording, even in the French learner UI (user decision 2026-11-22). */
export const TFNG_LABEL: Record<TfngAnswer, string> = { true: "True", false: "False", not_given: "Not given" };

/** The document's sentences (non-empty lines), as numbered by `evidence`. */
export const docSentences = (text: string) => text.split("\n").map((l) => l.trim()).filter(Boolean);

/**
 * Complete the words (« C-test »): `text` with each cut word written `destin[ations]` — the
 * beginning shown, the letters in brackets typed by the learner (one box per letter); one paragraph
 * per line. Parsed with `parseGaps` (same bracket syntax as fill the gaps).
 */
/** `audioMediaId`: optional recording of the whole text (model-audio), played on the results page. */
export type CompleteWordsContent = { text: string; audioMediaId: string };

/**
 * Automatic C-test blanking of a plain text: the first sentence stays whole, then every second word
 * of 3+ letters loses its second half (« destinations » → « destin[ations] »). Text already holding
 * brackets is returned unchanged.
 */
export function autoBlank(text: string): string {
  if (/\[[^\]]*\]/.test(text)) return text;
  const firstEnd = text.search(/[.!?](\s|$)/);
  const head = firstEnd >= 0 ? text.slice(0, firstEnd + 1) : "";
  let n = 0;
  const tail = text.slice(head.length).replace(/[A-Za-z][A-Za-z']*/g, (w) => {
    if (w.length < 3 || n++ % 2 === 0) return w;
    const keep = Math.max(1, Math.floor(w.length / 2));
    return `${w.slice(0, keep)}[${w.slice(keep)}]`;
  });
  return head + tail;
}

/** S1 — Répétez après Mael: phrases (English), each with its model audio (required) and an optional French translation. */
export type RepeatPhrase = { id: string; text: string; translation: string; audioMediaId: string };
export type RepeatContent = { phrases: RepeatPhrase[] };

/**
 * Writing task: `prompt` (rich, French) and optional picture, checklist of points to cover, word
 * range, optional model answer (English, shown with the coach's feedback). Each version sent gets an
 * AI draft for the coach, who edits and sends it (src/lib/lab/writing.ts, Grading → Writing review).
 */
export const WRITING_MIN_WORDS = [20, 40, 60, 80, 100, 150] as const;
export const WRITING_MAX_WORDS = [60, 80, 100, 120, 150, 200, 300] as const;
export type WritingTaskContent = { prompt: string; imageMediaId: string; checklist: string[]; minWords: number; maxWords: number; modelAnswer: string };

/**
 * L2 — Dictation: sentences (English), each with its audio (required) and an optional French
 * translation shown after checking. `maxPlays` per sentence (0 = unlimited). Checked word by word
 * (`phraseAccuracy`, src/lib/lab/speech.ts): a sentence is right from DICTATION_PASS % of its words.
 */
export const DICTATION_PLAYS = [0, 3, 5] as const;
export type DictationItem = { id: string; text: string; translation: string; audioMediaId: string };
export type DictationContent = { items: DictationItem[]; maxPlays: number };
/** « Good morning, how can I help? » → « G___ m______, h__ c__ I h___? » (first letter, one dash per letter left). */
export const firstLetters = (text: string) => text.replace(/[A-Za-z]+/g, (w) => w[0] + (w.length > 1 ? "_".repeat(w.length - 1) : ""));

export type ActivityContent = { "listen_choose": ListeningContent; "fill_gaps": GapsContent; "listen_fill_gaps": ListenGapsContent; "sentence_builder": SentenceContent; "match_pairs": MatchContent; "listen_match": MatchContent; "true_false_ng": TfngContent; "complete_words": CompleteWordsContent; "repeat_after": RepeatContent; "writing_task": WritingTaskContent; "dictation": DictationContent; "role_play": RolePlayContent; "speaking_challenge": SpeakingChallengeContent };

/**
 * AI role-play (spec §5 AIC-01–04): the AI plays `aiRole` (in English, never shown as is to the
 * learner), the learner plays `learnerRole`, in `setting`. `situation` (rich, French) is what the
 * learner reads first. `goals` = what the learner must achieve (shown as their mission, judged in the
 * debrief), `targetPhrases` (English, shown as « Useful phrases »), `twists` (hidden: the AI brings
 * them up at a natural moment), `openingLine` (the AI's first words), `difficulty` 1–5 (default; the
 * learner may change it), `maxMinutes`, `voiceId` (an ElevenLabs voice, "" = the default one).
 * The prompt is built by src/lib/conversation/prompt.ts.
 */
export const ROLEPLAY_MINUTES = [3, 5, 8, 10] as const;
export const ROLEPLAY_DIFFICULTIES = [1, 2, 3, 4, 5] as const;
export type RolePlayContent = {
  situation: string;
  aiRole: string;
  learnerRole: string;
  setting: string;
  goals: string[];
  targetPhrases: string[];
  twists: string[];
  openingLine: string;
  difficulty: number;
  maxMinutes: number;
  voiceId: string;
  voiceName: string;
};
/** Learner-facing names of the difficulty levels (AIC-03). */
export const DIFFICULTY_LABEL: Record<number, string> = { 1: "Very patient", 2: "Patient", 3: "Natural", 4: "Demanding", 5: "Tough" };
export const DIFFICULTY_HINT: Record<number, string> = { 1: "Slow, simple words, repeats when asked", 2: "Clear and calm, rephrases if you're lost", 3: "Normal speed, asks follow-up questions", 4: "Fast, precise questions, challenges vague answers", 5: "Interrupts, pushes back, uses idioms" };

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
