import { AiNotConfiguredError, type FeedbackService, type PronunciationService, type SpeechService, type TtsService } from "./types";
import { FakeFeedbackService, FakePronunciationService, FakeSpeechService, FakeTtsService } from "./fake";

/*
 * Provider registry. Real implementations are plugged in here by the feature that first needs
 * them (DECISIONS.md: Azure AI Speech for speech, Claude for feedback), when their keys are set.
 * Without keys: fakes in development / tests, a clear error in production (never fake results
 * shown to real learners).
 */

export type AiServices = { speech: SpeechService; pronunciation: PronunciationService; tts: TtsService; feedback: FeedbackService };

let override: Partial<AiServices> | null = null;
/** Tests: replace providers. */
export function setAiServicesForTests(s: Partial<AiServices> | null) {
  override = s;
}

function fallback<T>(name: string, make: () => T): T {
  if (process.env.NODE_ENV === "production") throw new AiNotConfiguredError(name);
  return make();
}

export function aiServices(): AiServices {
  return {
    speech: override?.speech ?? fallback("reconnaissance vocale", () => new FakeSpeechService()),
    pronunciation: override?.pronunciation ?? fallback("évaluation de la prononciation", () => new FakePronunciationService()),
    tts: override?.tts ?? fallback("synthèse vocale", () => new FakeTtsService()),
    feedback: override?.feedback ?? fallback("correction IA", () => new FakeFeedbackService()),
  };
}

export * from "./types";
