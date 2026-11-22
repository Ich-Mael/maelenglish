import { AiNotConfiguredError, type ConversationEngine, type FeedbackService, type PronunciationService, type SpeechService, type TtsService } from "./types";
import { FakeFeedbackService, FakePronunciationService, FakeSpeechService, FakeTtsService } from "./fake";
import { ClaudeFeedbackService } from "./claude";
import { AzureTtsService, isAzureSpeechConfigured } from "./azure";
import { ElevenLabsConversationEngine, isElevenLabsConfigured } from "./elevenlabs";

/*
 * Provider registry. Real implementations are plugged in here by the feature that first needs
 * them (DECISIONS.md: Azure AI Speech for speech, Claude for feedback), when their keys are set.
 * Without keys: fakes in development / tests, a clear error in production (never fake results
 * shown to real learners).
 */

export type AiServices = { speech: SpeechService; pronunciation: PronunciationService; tts: TtsService; feedback: FeedbackService };

let override: (Partial<AiServices> & { conversation?: ConversationEngine }) | null = null;
/** Tests: replace providers. */
export function setAiServicesForTests(s: (Partial<AiServices> & { conversation?: ConversationEngine }) | null) {
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
    // Azure neural voices when AZURE_SPEECH_KEY + AZURE_SPEECH_REGION are set.
    tts: override?.tts ?? (isAzureSpeechConfigured() ? new AzureTtsService() : fallback("synthèse vocale", () => new FakeTtsService())),
    // Claude when ANTHROPIC_API_KEY is set (also in development), else the fake (never in production).
    feedback: override?.feedback ?? (process.env.ANTHROPIC_API_KEY ? new ClaudeFeedbackService() : fallback("correction IA", () => new FakeFeedbackService())),
  };
}

/**
 * A real voice, or null: features that can fall back on something else (the dictionary falls back
 * on recordings / the browser's voice) never use the silent fake. Tests can inject one.
 */
export function realTts(): TtsService | null {
  return override?.tts ?? (isAzureSpeechConfigured() ? new AzureTtsService() : null);
}

/**
 * The AI speaking partner's provider (ElevenLabs when ELEVENLABS_API_KEY is set), or null: there is
 * no fake for a live voice call, so pages say it isn't available. Tests can inject one.
 */
export function conversationEngine(): ConversationEngine | null {
  return override?.conversation ?? (isElevenLabsConfigured() ? new ElevenLabsConversationEngine() : null);
}

export * from "./types";
