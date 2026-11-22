import type { AudioInput, DrillGrade, DrillGradeInput, FeedbackService, LlmUsage, WordTranslation, WordTranslationInput, WritingCorrection, WritingCorrectionInput, PronunciationResult, PronunciationService, SpeechService, SynthesizedAudio, Transcript, TtsService } from "./types";
import { normalizeEnglish, words } from "./text";

/*
 * Deterministic fake providers: tests and local development without API keys. They never call
 * the network. The « audio » a test sends can carry its intended text in `fakeText` (via
 * `fakeAudio`), so STT and pronunciation results are predictable.
 */

const FAKE_TEXT = new WeakMap<Uint8Array, string>();

/** Audio whose fake transcript will be `text` (tests). */
export function fakeAudio(text: string, durationS = Math.max(1, words(text).length * 0.4)): AudioInput {
  const data = new Uint8Array(16);
  FAKE_TEXT.set(data, text);
  return { data, mime: "audio/webm", durationS };
}

export class FakeSpeechService implements SpeechService {
  readonly name = "fake";
  async transcribe(audio: AudioInput): Promise<Transcript> {
    const text = FAKE_TEXT.get(audio.data) ?? "";
    const ws = text.split(/\s+/).filter(Boolean);
    const step = ws.length ? audio.durationS / ws.length : 0;
    return { text, durationS: audio.durationS, words: ws.map((w, i) => ({ text: w, start: i * step, end: (i + 1) * step - 0.05, confidence: 0.95 })) };
  }
}

export class FakePronunciationService implements PronunciationService {
  readonly name = "fake";
  async assess(audio: AudioInput, referenceText: string): Promise<PronunciationResult> {
    const said = new Set(words(FAKE_TEXT.get(audio.data) ?? referenceText));
    const ref = referenceText.split(/\s+/).filter(Boolean);
    const scored = ref.map((w) => {
      const ok = said.has(normalizeEnglish(w));
      return { word: w, accuracy: ok ? 90 : 0, error: ok ? ("none" as const) : ("omission" as const), phonemes: [] };
    });
    const completeness = ref.length ? Math.round((scored.filter((w) => w.error === "none").length / ref.length) * 100) : 0;
    const accuracy = completeness ? 90 : 0;
    return { overall: Math.round((accuracy + completeness + 85) / 3), accuracy, fluency: 85, completeness, prosody: 80, words: scored };
  }
}

export class FakeTtsService implements TtsService {
  readonly name = "fake";
  async synthesize(text: string): Promise<SynthesizedAudio> {
    // A valid, silent 8 kHz mono WAV whose length follows the text (~0.35 s per word).
    const durationS = Math.max(0.5, words(text).length * 0.35);
    const samples = Math.round(8000 * durationS);
    const buf = new ArrayBuffer(44 + samples);
    const v = new DataView(buf);
    const str = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
    str(0, "RIFF"); v.setUint32(4, 36 + samples, true); str(8, "WAVE"); str(12, "fmt ");
    v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, 8000, true);
    v.setUint32(28, 8000, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true); str(36, "data"); v.setUint32(40, samples, true);
    new Uint8Array(buf, 44).fill(128);
    return { data: new Uint8Array(buf), mime: "audio/wav", durationS };
  }
}

export class FakeFeedbackService implements FeedbackService {
  readonly name = "fake";
  async gradeDrill(input: DrillGradeInput): Promise<DrillGrade> {
    const answer = normalizeEnglish(input.answer);
    const accepted = input.acceptedAnswers.map(normalizeEnglish);
    const model = input.acceptedAnswers[0] ?? "";
    if (accepted.includes(answer)) return { verdict: "correct", explanation: "Bonne réponse.", modelAnswer: model };
    const close = accepted.some((a) => {
      const aw = new Set(a.split(" "));
      const hit = answer.split(" ").filter((w) => aw.has(w)).length;
      return aw.size > 0 && hit / aw.size >= 0.6;
    });
    return close
      ? { verdict: "almost", explanation: "Presque : vérifiez la structure demandée.", modelAnswer: model }
      : { verdict: "incorrect", explanation: "Ce n’est pas la structure demandée.", modelAnswer: model };
  }

  /** Deterministic: length in range + checklist words found; a lowercase « i » is the one « error ». */
  async correctWriting(input: WritingCorrectionInput): Promise<{ correction: WritingCorrection; usage: LlmUsage }> {
    const n = words(input.answer).length;
    const said = new Set(words(input.answer));
    const checklist = input.checklist.map((item) => {
      const met = words(item).some((w) => w.length > 3 && said.has(w));
      return { item, met, comment: met ? "Point traité." : "Point absent de votre texte." };
    });
    const inRange = n >= input.minWords && (!input.maxWords || n <= input.maxWords);
    const errors = /(^|\s)i(\s|')/.test(input.answer) ? [{ quote: "i", correction: "I", explanation: "« I » (je) s'écrit toujours en majuscule." }] : [];
    const met = checklist.filter((c) => c.met).length;
    const score = Math.max(0, Math.min(100, (inRange ? 50 : 25) + (checklist.length ? Math.round((met / checklist.length) * 40) : 40) + (errors.length ? 0 : 10)));
    return {
      correction: {
        score,
        summary: inRange ? "Bon travail : votre texte répond à la consigne." : `Votre texte fait ${n} mots : visez entre ${input.minWords} et ${input.maxWords}.`,
        strengths: n ? ["Votre message est clair."] : [],
        errors,
        checklist,
        corrected: input.answer.replace(/(^|\s)i(?=\s|')/g, "$1I"),
      },
      usage: { inputTokens: 0, outputTokens: 0, costMicros: 0, provider: "fake" },
    };
  }

  /** Deterministic: « [FR] word » (tests and development without a key). */
  async translateWord(input: WordTranslationInput): Promise<{ result: WordTranslation; usage: LlmUsage }> {
    return {
      // Deterministic: the first meaning; a sentence gives « [FR ctx] word ».
      result: input.sentence
        ? { translation: `[FR ctx] ${input.word}`, frNote: "Ici, dans cette phrase.", businessExample: "", sense: input.senses.length ? 1 : 0 }
        : { translation: `[FR] ${input.word}`, frNote: input.senses[0] ? `Sens : ${input.senses[0].definition.slice(0, 80)}` : "Mot courant au travail.", businessExample: `We use "${input.word}" at work every day.`, sense: input.senses.length ? 1 : 0 },
      usage: { inputTokens: 0, outputTokens: 0, costMicros: 0, provider: "fake" },
    };
  }
}
