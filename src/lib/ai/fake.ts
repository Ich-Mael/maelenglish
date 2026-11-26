import type { DailyWord, GapPracticeInput, GapPracticeText, GoalExpression, SentenceCheck, DiagnosticReportInput, ConversationAgentSpec, ConversationEngine, ConversationTurn, Debrief, FinishedConversation, HelpSuggestion, Persona, RolePlayBrief, Voice, AudioInput, DrillGrade, DrillGradeInput, FeedbackService, LlmUsage, WordTranslation, WordTranslationInput, WritingCorrection, WritingCorrectionInput, PronunciationResult, PronunciationService, SpeechService, SynthesizedAudio, Transcript, TtsService } from "./types";
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

  /** Deterministic: scores from how much the learner said; a goal is « achieved » when one of its long words was said. */
  async rolePlayDebrief(input: { brief: RolePlayBrief; transcript: ConversationTurn[]; persona: Persona }): Promise<{ debrief: Debrief; usage: LlmUsage }> {
    const learner = input.transcript.map((t, i) => ({ ...t, i })).filter((t) => t.role === "user");
    const said = new Set(learner.flatMap((t) => words(t.text)));
    const goals = input.brief.goals.map((goal) => {
      const hit = learner.find((t) => words(goal).some((w) => w.length > 4 && words(t.text).includes(w)));
      return { goal, achieved: !!hit, evidence: hit ? `« ${hit.text} »` : "Objectif non abordé." };
    });
    const level = Math.min(10, Math.round(said.size / 3));
    const done = goals.length ? Math.round((goals.filter((g) => g.achieved).length / goals.length) * 10) : 0;
    const bad = learner.find((t) => /\bi am agree\b/i.test(t.text));
    return {
      debrief: {
        summary: learner.length ? "Bonne conversation : vous avez tenu votre rôle." : "Vous avez très peu parlé.",
        scores: { grammar: level, vocabulary: level, fluency: level, pronunciation: null, tone: level, goalCompletion: done },
        goals,
        corrections: bad ? [{ turn: bad.i, original: "I am agree", corrected: "I agree", explanation: "« Agree » est un verbe : pas de « am ».", category: "grammar" }] : [],
        betterWays: learner.slice(0, 3).map((t) => ({ original: t.text, improved: t.text, why: "Déjà correct." })),
        phrasesToReuse: input.brief.targetPhrases.slice(0, 3),
        maelTip: "Préparez trois phrases clés avant chaque réunion.",
      },
      usage: { inputTokens: 0, outputTokens: 0, costMicros: 0, provider: "fake" },
    };
  }

  /** Deterministic: a valid report naming the first name and the given profile. */
  async diagnosticReport(input: DiagnosticReportInput): Promise<{ report: unknown; usage: LlmUsage }> {
    return {
      report: {
        headline: `${input.firstName}, voici ce qui vous freine.`,
        profile_name: input.primary.name,
        profile_summary: "Résumé de test.",
        what_holds_you_back: [{ title: "Frein 1", explanation: "Explication." }, { title: "Frein 2", explanation: "Explication." }],
        reframe: "Recadrage.",
        your_strengths: ["Atout 1", "Atout 2"],
        recommended_method: [{ title: "Étape 1", description: "D." }, { title: "Étape 2", description: "D." }, { title: "Étape 3", description: "D." }],
        first_step_this_week: "Une action.",
        goal_reminder: "Votre objectif.",
      },
      usage: { inputTokens: 0, outputTokens: 0, costMicros: 0, provider: "fake" },
    };
  }

  /** Deterministic: « <profession>word<a, b, c…> », skipping the words to avoid. */
  async dailyVocabulary(input: { profession: string; count: number; avoid: string[] }): Promise<{ words: DailyWord[]; usage: LlmUsage }> {
    const base = input.profession.toLowerCase().replace(/[^a-z]/g, "") || "job";
    const words: DailyWord[] = [];
    for (let n = 1; words.length < input.count; n++) {
      const w = `${base}word${String.fromCharCode(96 + n)}`;
      if (!input.avoid.includes(w)) words.push({ word: w, translation: `[FR] ${w}`, frNote: "Note.", example: `We use ${w} at work.`, examples: [{ en: `We use ${w} at work.`, fr: `[FR] exemple 1` }, { en: `I need ${w} today.`, fr: `[FR] exemple 2` }] });
    }
    return { words, usage: { inputTokens: 0, outputTokens: 0, costMicros: 0, provider: "fake" } };
  }

  /** Deterministic: « expression a, b, c… » for the coaching, skipping the ones to avoid. */
  async goalVocabulary(input: { title: string; count: number; avoid: string[] }): Promise<{ items: GoalExpression[]; usage: LlmUsage }> {
    const items: GoalExpression[] = [];
    for (let n = 1; items.length < input.count; n++) {
      const t = `expression ${n}`;
      if (!input.avoid.includes(t)) items.push({ text: t, translation: `[FR] ${t}`, frNote: "Note.", example: `I use ${t} for my goal.`, exampleFr: "[FR] exemple" });
    }
    return { items, usage: { inputTokens: 0, outputTokens: 0, costMicros: 0, provider: "fake" } };
  }

  /** Deterministic: one sentence per item, or a story of two items per paragraph. */
  async gapPractice(input: GapPracticeInput): Promise<{ text: GapPracticeText; usage: LlmUsage }> {
    const sentence = (t: string) => `At work today, I had to use [${t}] with a client.`;
    const lines =
      input.mode === "sentences"
        ? input.items.map((i) => ({ en: sentence(i.text), fr: `[FR] ${i.text}` }))
        : Array.from({ length: Math.ceil(input.items.length / 2) }, (_, n) => ({ en: input.items.slice(n * 2, n * 2 + 2).map((i) => sentence(i.text)).join(" "), fr: "[FR] paragraphe" }));
    return { text: { title: input.mode === "story" ? "A busy day" : "Expressions at work", lines }, usage: { inputTokens: 0, outputTokens: 0, costMicros: 0, provider: "fake" } };
  }

  /** Deterministic: ok when the sentence contains the word and starts with a capital. */
  async checkSentence(input: { word: string; sentence: string }): Promise<{ result: SentenceCheck; usage: LlmUsage }> {
    const has = input.sentence.toLowerCase().includes(input.word.toLowerCase());
    const ok = has && /^[A-Z]/.test(input.sentence.trim());
    const corrected = input.sentence.trim().replace(/^./, (c) => c.toUpperCase());
    return { result: { ok, corrected, explanation: has ? (ok ? "Très bien." : "Une phrase commence par une majuscule.") : "La phrase n'utilise pas le mot." }, usage: { inputTokens: 0, outputTokens: 0, costMicros: 0, provider: "fake" } };
  }

  async rolePlayHelp(input: { brief: RolePlayBrief }): Promise<{ suggestions: HelpSuggestion[]; usage: LlmUsage }> {
    const phrases = input.brief.targetPhrases.length ? input.brief.targetPhrases : ["Could you repeat that, please?"];
    return { suggestions: phrases.slice(0, 3).map((en) => ({ en, fr: `[FR] ${en}` })), usage: { inputTokens: 0, outputTokens: 0, costMicros: 0, provider: "fake" } };
  }
}

/** Tests: agents and calls kept in memory; `script` sets what a call's transcript will be. */
export class FakeConversationEngine implements ConversationEngine {
  readonly name = "fake";
  agents = new Map<string, ConversationAgentSpec>();
  deleted: string[] = [];
  calls = new Map<string, FinishedConversation>();
  private n = 0;
  async createAgent(spec: ConversationAgentSpec) {
    const id = `agent_${++this.n}`;
    this.agents.set(id, spec);
    return id;
  }
  async deleteAgent(id: string) {
    this.agents.delete(id);
    this.deleted.push(id);
  }
  async signedUrl(id: string) {
    return `wss://fake.example/convai?agent_id=${id}&token=t${++this.n}`;
  }
  script(conversationId: string, c: Partial<FinishedConversation> & { agentId: string }) {
    this.calls.set(conversationId, { status: "done", transcript: [], durationS: 0, costMicros: null, ...c });
  }
  async fetchConversation(id: string): Promise<FinishedConversation> {
    const c = this.calls.get(id);
    if (!c) throw new Error("ElevenLabs 404: conversation not found");
    return c;
  }
  audio = new Map<string, Uint8Array>();
  async fetchAudio(id: string) {
    const a = this.audio.get(id);
    return a ? { data: a, mime: "audio/mpeg" } : null;
  }
  async listVoices(): Promise<Voice[]> {
    return [{ id: "voice_us", name: "Jessica", accent: "american", gender: "female", previewUrl: "" }];
  }
}
