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

export interface FeedbackService {
  readonly name: string;
  gradeDrill(input: DrillGradeInput): Promise<DrillGrade>;
}

/** Thrown when a provider isn't configured (production without keys). */
export class AiNotConfiguredError extends Error {
  constructor(service: string) {
    super(`Service IA non configuré : ${service}.`);
    this.name = "AiNotConfiguredError";
  }
}
