/*
 * Provider-independent interfaces for every paid AI / speech service (DECISIONS.md).
 * Implementations: real ones per provider (added with the first feature that needs them) and
 * deterministic fakes (`fake.ts`) used in tests and in development without API keys.
 * Framework-free.
 */

/** Audio sent to a provider. */
export type AudioInput = { data: Uint8Array; mime: string; durationS: number };

export type TimedWord = { text: string; start: number; end: number; confidence?: number };
export type Transcript = { text: string; words: TimedWord[]; durationS: number };

export interface SpeechService {
  readonly name: string;
  transcribe(audio: AudioInput, opts?: { phrases?: readonly string[] }): Promise<Transcript>;
}

export type WordError = "none" | "mispronunciation" | "omission" | "insertion";
export type WordAssessment = {
  word: string;
  /** 0–100 */
  accuracy: number;
  error: WordError;
  phonemes: { phoneme: string; accuracy: number }[];
  start?: number;
  end?: number;
};
export type PronunciationResult = {
  /** All 0–100. */
  overall: number;
  accuracy: number;
  fluency: number;
  completeness: number;
  prosody: number | null;
  words: WordAssessment[];
};

export interface PronunciationService {
  readonly name: string;
  assess(audio: AudioInput, referenceText: string): Promise<PronunciationResult>;
}

/** Accents the spec asks for (LIS-01) — mapped to concrete voices by each TTS implementation. */
export const ACCENTS = ["american", "british", "nigerian", "ghanaian", "indian", "kenyan"] as const;
export type Accent = (typeof ACCENTS)[number];

export type SynthesizedAudio = { data: Uint8Array; mime: string; durationS: number };

export interface TtsService {
  readonly name: string;
  synthesize(text: string, opts?: { accent?: Accent; gender?: "female" | "male"; rate?: number }): Promise<SynthesizedAudio>;
}

export type DrillVerdict = "correct" | "almost" | "incorrect";
export type DrillGradeInput = {
  /** The task, e.g. « Make this a polite request: Send me the file. » */
  prompt: string;
  targetStructure: string;
  acceptedAnswers: readonly string[];
  /** What the learner said (STT). */
  answer: string;
  cefrLevel: string;
};
export type DrillGrade = { verdict: DrillVerdict; explanation: string; modelAnswer: string };

/** A learner's written answer to a writing task, to correct (feedback in French). */
export type WritingCorrectionInput = {
  /** The task, as plain text (French instructions). */
  prompt: string;
  /** Points the answer should cover (French or English). */
  checklist: readonly string[];
  minWords: number;
  maxWords: number;
  /** CEFR level of the activity ("" = not set). */
  level: string;
  /** What the learner wrote (English). */
  answer: string;
};
export type WritingError = { quote: string; correction: string; explanation: string };
export type WritingCorrection = {
  /** 0–100 */
  score: number;
  /** One or two encouraging sentences in French. */
  summary: string;
  strengths: string[];
  errors: WritingError[];
  checklist: { item: string; met: boolean; comment: string }[];
  /** The learner's text, corrected (English), keeping their ideas. */
  corrected: string;
};
/** What a correction cost (tokens), for metering. */
export type LlmUsage = { inputTokens: number; outputTokens: number; costMicros: number; provider: string };

/** Dictionary enrichment: French translation of an English word in its (first) meaning. */
/**
 * Dictionary enrichment. `senses`: the dictionary's meanings, numbered from 1 in this order
 * (empty when the dictionary doesn't know the word). Without `sentence`: the word's most common
 * everyday meaning; with it: the meaning in that sentence.
 */
export type WordTranslationInput = { word: string; senses: { partOfSpeech: string; definition: string }[]; sentence?: string };
/** `sense`: number of the meaning used (1-based in `senses`), 0 when none fits. `businessExample` only without a sentence. */
export type WordTranslation = { translation: string; frNote: string; businessExample: string; sense: number };

/** One turn of a role-play transcript. `t`: seconds since the start of the call. */
export type ConversationTurn = { role: "agent" | "user"; text: string; t: number };

/** Coach Ish persona (AIC-07): used by the coach voice (help, debrief), never by in-character roles. */
export type Persona = { tone: string; catchphrases: string[]; tips: string[] };

export type RolePlayBrief = {
  title: string;
  aiRole: string;
  learnerRole: string;
  setting: string;
  goals: string[];
  targetPhrases: string[];
  difficulty: number;
  /** CEFR level of the activity ("" = not set). */
  level: string;
};

/** Debrief of a role-play (spec §10.3). Scores 0–10; `pronunciation` null (not scored from a transcript). */
export type DebriefScores = { grammar: number; vocabulary: number; fluency: number; pronunciation: number | null; tone: number; goalCompletion: number };
export type Debrief = {
  scores: DebriefScores;
  goals: { goal: string; achieved: boolean; evidence: string }[];
  /** `turn`: index in the transcript of the learner's turn concerned. */
  corrections: { turn: number; original: string; corrected: string; explanation: string; category: "grammar" | "vocabulary" | "tone" }[];
  betterWays: { original: string; improved: string; why: string }[];
  phrasesToReuse: string[];
  maelTip: string;
  summary: string;
};
/** Help button (AIC-01): 2–3 things the learner could say now, English + French gloss. */
export type HelpSuggestion = { en: string; fr: string };

/** Diagnostic report input: never the learner's email or phone (spec §12). */
export type DiagnosticReportInput = { firstName: string; answersText: string; primary: { id: string; name: string; need: string }; secondary: { id: string; name: string }[]; scores: Record<string, number> };

export interface FeedbackService {
  readonly name: string;
  gradeDrill(input: DrillGradeInput): Promise<DrillGrade>;
  correctWriting(input: WritingCorrectionInput): Promise<{ correction: WritingCorrection; usage: LlmUsage }>;
  translateWord(input: WordTranslationInput): Promise<{ result: WordTranslation; usage: LlmUsage }>;
  rolePlayDebrief(input: { brief: RolePlayBrief; transcript: ConversationTurn[]; persona: Persona }): Promise<{ debrief: Debrief; usage: LlmUsage }>;
  rolePlayHelp(input: { brief: RolePlayBrief; transcript: ConversationTurn[]; persona: Persona }): Promise<{ suggestions: HelpSuggestion[]; usage: LlmUsage }>;
  /** Learning-path diagnostic report (JSON validated by the caller against DiagnosticReportSchema). */
  diagnosticReport(input: DiagnosticReportInput): Promise<{ report: unknown; usage: LlmUsage }>;
}

/** What the conversation provider needs to run one agent (src/lib/conversation/prompt.ts AgentSpec). */
export type ConversationAgentSpec = {
  name: string;
  prompt: string;
  firstMessage: string;
  voiceId: string;
  speed: number;
  maxDurationS: number;
  turnTimeoutS: number;
  eagerness: "patient" | "normal" | "eager";
};
export type FinishedConversation = {
  /** "done" = transcript final; "processing" = the provider is still finishing it; "failed". */
  status: "done" | "processing" | "failed";
  /** The agent that ran it (checked: a learner can't attach someone else's call). */
  agentId: string;
  transcript: ConversationTurn[];
  durationS: number;
  /** Provider's cost in micro-USD when it reports it, else null (estimated by the caller). */
  costMicros: number | null;
};
export type Voice = { id: string; name: string; accent: string; gender: string; previewUrl: string };

/**
 * Real-time voice conversation provider (DECISIONS.md: ElevenLabs Agents, Claude as the LLM).
 * The browser connects with `signedUrl`; the server reads the transcript afterwards.
 */
export interface ConversationEngine {
  readonly name: string;
  createAgent(spec: ConversationAgentSpec): Promise<string>;
  deleteAgent(agentId: string): Promise<void>;
  signedUrl(agentId: string): Promise<string>;
  fetchConversation(conversationId: string): Promise<FinishedConversation>;
  /** The call's audio once the provider has it, else null (not ready yet / no audio). */
  fetchAudio(conversationId: string): Promise<{ data: Uint8Array; mime: string } | null>;
  listVoices(): Promise<Voice[]>;
}

/** Thrown when a provider isn't configured (production without keys). */
export class AiNotConfiguredError extends Error {
  constructor(service: string) {
    super(`Service IA non configuré : ${service}.`);
    this.name = "AiNotConfiguredError";
  }
}
