import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import * as z from "zod/v4";
import type { DailyWord, GoalExpression, SentenceCheck, DiagnosticReportInput, ConversationTurn, Debrief, DrillGrade, DrillGradeInput, FeedbackService, HelpSuggestion, LlmUsage, Persona, RolePlayBrief, WordTranslation, WordTranslationInput, WritingCorrection, WritingCorrectionInput } from "./types";

/*
 * Claude feedback (DECISIONS.md: Claude for feedback): writing correction for the Lab « writing
 * task », in French, as structured output (validated against a Zod schema). Model: Claude Haiku
 * 5.5 (owner choice 2026-11-22: fast, cheapest per correction). Needs ANTHROPIC_API_KEY.
 */

export const CLAUDE_FEEDBACK_MODEL = "claude-haiku-5-5";
// Claude Haiku 5.5 prices (USD per million tokens, prompts up to 100K tokens): $0.10 in / $0.50 out.
const costMicros = (inTok: number, outTok: number) => Math.round(inTok * 0.1 + outTok * 0.5);

const WritingSchema = z.object({
  score: z.number().int().min(0).max(100),
  summary: z.string(),
  strengths: z.array(z.string()),
  errors: z.array(z.object({ quote: z.string(), correction: z.string(), explanation: z.string() })),
  checklist: z.array(z.object({ item: z.string(), met: z.boolean(), comment: z.string() })),
  corrected: z.string(),
});

const WordSchema = z.object({ sense: z.number().int(), translation: z.string(), frNote: z.string(), businessExample: z.string() });

// Frozen (cache-friendly).
const WORD_SYSTEM = `You help French-speaking professionals in West Africa (A2-B2 English) understand English words they meet in a business English course.

You get a word, the dictionary's numbered meanings (may be empty, may be in an unusual order: rare meanings can come first) and sometimes the sentence where the learner met the word.

First choose the meaning:
- With a sentence: the meaning the word has IN THAT SENTENCE (read the whole sentence: part of speech, what it refers to).
- Without a sentence: the word's most common, everyday meaning (what a learner most probably needs), not a rare or slang one.
- sense: the number of that meaning in the list, or 0 if none fits or the list is empty.

Then, for that meaning:
- translation: the usual French translation, 1 to 4 words (several separated by " / " only when really needed). With a sentence, the French word that fits that sentence. Proper French spelling and accents.
- frNote: one short sentence in simple French. With a sentence: what the word means here (e.g. « Ici, adverbe : les personnes font la chose en même temps. »). Without: how or when it is used at work (register, false friend, typical collocation), not starting with « Ici ». No English except the word itself.
- businessExample: without a sentence, one short, natural, grammatically correct English sentence using the word in that meaning in a professional context (office, aviation, banking, hospitality, health), 6 to 14 words. With a sentence: "".
If the word is not English or is not a real word, translation is "" and frNote says so in French.`;

/** Role-play debriefs: Claude Sonnet 5.5 (quality, DECISIONS.md), $2 in / $10 out per million tokens. */
export const CLAUDE_DEBRIEF_MODEL = "claude-sonnet-5-5";
const sonnetCost = (inTok: number, outTok: number) => Math.round(inTok * 2 + outTok * 10);

const score = z.number().int().min(0).max(10);
const DebriefSchema = z.object({
  summary: z.string(),
  scores: z.object({ grammar: score, vocabulary: score, fluency: score, tone: score, goalCompletion: score }),
  goals: z.array(z.object({ goal: z.string(), achieved: z.boolean(), evidence: z.string() })),
  corrections: z.array(z.object({ turn: z.number().int(), original: z.string(), corrected: z.string(), explanation: z.string(), category: z.enum(["grammar", "vocabulary", "tone"]) })),
  betterWays: z.array(z.object({ original: z.string(), improved: z.string(), why: z.string() })),
  phrasesToReuse: z.array(z.string()),
  maelTip: z.string(),
});
const HelpSchema = z.object({ suggestions: z.array(z.object({ en: z.string(), fr: z.string() })) });

const personaText = (p: Persona) =>
  [
    "You speak as Coach Ish (Ismaël Zerbo, founder of MaelEnglish, TEFL-certified, former aviation professional).",
    p.tone ? `Tone: ${p.tone}` : "Tone: warm, direct, encouraging, practical; celebrates progress, then gives one clear next step.",
    p.catchphrases.length ? `Catchphrases you may use (sparingly): ${p.catchphrases.join(" | ")}` : "",
    p.tips.length ? `Signature tips you like to give:\n${p.tips.map((t) => `- ${t}`).join("\n")}` : "",
  ]
    .filter(Boolean)
    .join("\n");

const briefText = (b: RolePlayBrief) =>
  [
    `Scenario: ${b.title}`,
    `The AI played: ${b.aiRole}. The learner played: ${b.learnerRole}. Setting: ${b.setting}.`,
    `Difficulty: ${b.difficulty}/5.${b.level ? ` Target level: ${b.level}.` : ""}`,
    `Learner's goals:\n${b.goals.map((g, i) => `${i + 1}. ${g}`).join("\n")}`,
    b.targetPhrases.length ? `Target phrases:\n${b.targetPhrases.map((p) => `- ${p}`).join("\n")}` : "",
  ]
    .filter(Boolean)
    .join("\n");

const transcriptText = (t: ConversationTurn[]) => t.map((x, i) => `[${i}] ${x.role === "user" ? "LEARNER" : "AI"}: ${x.text}`).join("\n");

// Frozen (cache-friendly).
const DEBRIEF_SYSTEM = `You write the debrief of a spoken role-play between an English learner and an AI playing a professional counterpart. Learners are French-speaking professionals in West Africa (A2-B2). The transcript comes from speech recognition: ignore punctuation, capitals and obvious recognition glitches; never invent words the learner did not say.

Write every explanation, the summary and the tip in simple, encouraging French. Keep English only for quotes, corrections, improved sentences and phrases.

- summary: 2-3 sentences in French: overall impression, what went well, the main thing to work on.
- scores (integers 0-10, at the learner's target level): grammar, vocabulary (range and precision), fluency (length and ease of turns, judged from the transcript), tone (professional, polite, appropriate), goalCompletion (share of goals achieved, and how well). A learner who barely spoke gets low scores.
- goals: for each goal given, in the same order: achieved or not, and evidence: the learner's words that show it (quoted), or in French why it wasn't achieved.
- corrections: the learner's real mistakes, most important first, at most 10. turn = the [index] of the LEARNER turn; original = the learner's exact words (a few words); corrected = the corrected wording; explanation = one short French sentence with the rule; category grammar | vocabulary | tone.
- betterWays: 3 to 6 of the learner's own sentences rewritten as a confident professional would say them (original = learner's words, improved = English rewrite, why = short French reason). Prefer sentences that were correct but basic.
- phrasesToReuse: exactly 3 short, useful English phrases for this situation (from the target phrases or the better ways).
- maelTip: one practical tip in French, in Coach Ish's voice (starts naturally, no "Coach Ish's tip:" prefix).`;

const HELP_SYSTEM = `A French-speaking learner of English is in the middle of a spoken role-play and pressed « Help ». Suggest 3 different short things (5-15 words each) they could say NEXT, in natural, simple professional English at their level, that answer the last thing the AI said and move toward their goals. For each, give a short French translation (fr). No explanations.`;

const DailySchema = z.object({ words: z.array(z.object({ word: z.string(), translation: z.string(), frNote: z.string(), examples: z.array(z.object({ en: z.string(), fr: z.string() })) })) });
const GoalVocabSchema = z.object({ items: z.array(z.object({ text: z.string(), translation: z.string(), frNote: z.string(), example: z.string(), exampleFr: z.string() })) });
const SentenceSchema = z.object({ ok: z.boolean(), corrected: z.string(), explanation: z.string() });

// Frozen (cache-friendly).
const DAILY_SYSTEM = `You choose English vocabulary for French-speaking professionals in West Africa (A2-B2) who learn the English of their job.
Given a profession (or field of study), return the requested number of genuinely useful, common English words that this person meets at work (not rare jargon, not basic words like "work" or "good").
- word: ONE English word, lowercase, no spaces (a hyphen is allowed). Never one of the words to avoid. Never a word spelled the same (or almost) in French with the same meaning (e.g. "patient", "important", "hospital"): the learner must learn something new.
- translation: the French translation, 1 to 3 words, correct accents.
- frNote: one short sentence in simple French on when or how it is used in this job.
- examples: exactly 2 different, natural English sentences (8-16 words) using the word in real situations of this job ("en"), each with its natural French translation ("fr").`;

const GOAL_VOCAB_SYSTEM = `You choose English vocabulary for a coaching: French-speaking professionals in West Africa (A2-B2) preparing one precise goal in English (a job interview, a client presentation, a negotiation, an exam…).
Given the coaching's title, goal and steps, return the requested number of words or expressions they will really need to reach that goal — favour useful multi-word expressions and collocations ("walk you through", "to follow up on", "a track record of") over single basic words.
- text: the English word or expression, as it is used (lowercase unless it needs a capital). Never one of the items to avoid, never a word spelled the same in French with the same meaning.
- translation: natural French equivalent, correct accents.
- frNote: one short sentence in simple French: when and how to use it for this goal.
- example: one natural English sentence (8-18 words) using it in the situation of the goal; exampleFr: its French translation.
The items of one day must be different from each other and varied (verbs, phrases, nouns).`;

const SENTENCE_SYSTEM = `A French-speaking learner of English (A2-B2) wrote a sentence using a word from their vocabulary notebook. Check it.
- ok: true if the sentence is correct, natural English AND uses the word with the right meaning (small punctuation issues don't count).
- corrected: the sentence corrected and natural, keeping the learner's idea and the word; the same sentence if it was already correct.
- explanation: one short, encouraging sentence in simple French: what was wrong and the rule, or why it is good.
If the sentence doesn't use the word, ok is false and explanation says so in French.`;

const DrillSchema = z.object({ verdict: z.enum(["correct", "almost", "incorrect"]), explanation: z.string(), modelAnswer: z.string() });

// Frozen (cache-friendly): the per-request details go in the user message.
const WRITING_SYSTEM = `You are an experienced business English teacher at MaelEnglish. Your learners are French-speaking professionals in West Africa (aviation, banking, health, hospitality, administration...), mostly at A2-B2 level. You correct short professional texts they write (emails, messages, short answers) in response to a task.

Write all your feedback in simple, encouraging French (they are learners, not linguists). Keep English only for quotes, corrections and the corrected text.

How to correct:
- score: 0-100 for how well the text does the task at the learner's level: task achieved and checklist covered, clarity and organisation, grammar and vocabulary, appropriate professional tone. A clear, polite text that does the task with a few small errors deserves 70-85; reserve 90+ for texts with almost no errors. If the text is off-topic, nearly empty or not in English, give under 30 and say why.
- summary: one or two sentences: the overall impression and the one most useful thing to improve.
- strengths: 1 to 3 short, specific things done well.
- errors: the most important mistakes, at most 8, in order of importance. "quote" must copy the learner's words exactly as written (a few words, enough to find them); "correction" is the corrected wording; "explanation" is one short sentence in French with the rule. Ignore tiny stylistic preferences.
- checklist: for each required point given in the task, in the same order: whether the text covers it, with a short comment in French. Empty list when there is no checklist.
- corrected: the learner's text rewritten in correct, natural professional English, keeping their ideas, structure and length. Do not add new content.
- Words that are not in English, or a text much shorter than asked, should be reflected in the score and the summary.`;

export class ClaudeFeedbackService implements FeedbackService {
  readonly name = "claude";
  private client = new Anthropic();

  async correctWriting(input: WritingCorrectionInput): Promise<{ correction: WritingCorrection; usage: LlmUsage }> {
    const task = [
      `Task given to the learner (French):\n${input.prompt}`,
      input.checklist.length ? `Required points (checklist):\n${input.checklist.map((c, i) => `${i + 1}. ${c}`).join("\n")}` : "Required points: none.",
      `Expected length: ${input.minWords}-${input.maxWords} words.`,
      input.level ? `Learner's target level (CEFR): ${input.level}.` : "",
    ]
      .filter(Boolean)
      .join("\n\n");
    const response = await this.client.messages.parse({
      model: CLAUDE_FEEDBACK_MODEL,
      max_tokens: 6000,
      output_config: { effort: "medium", format: zodOutputFormat(WritingSchema) },
      system: WRITING_SYSTEM,
      messages: [{ role: "user", content: `${task}\n\nThe learner's answer:\n<answer>\n${input.answer}\n</answer>` }],
    });
    if (response.stop_reason === "refusal") throw new Error("La correction automatique n'a pas pu traiter ce texte. Reformulez-le, ou attendez le retour de votre coach.");
    if (response.stop_reason === "max_tokens" || !response.parsed_output) throw new Error("La correction automatique a échoué : réessayez dans un instant.");
    const usage = { inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens, costMicros: costMicros(response.usage.input_tokens, response.usage.output_tokens), provider: `anthropic:${CLAUDE_FEEDBACK_MODEL}` };
    return { correction: response.parsed_output, usage };
  }

  async translateWord(input: WordTranslationInput): Promise<{ result: WordTranslation; usage: LlmUsage }> {
    const response = await this.client.messages.parse({
      model: CLAUDE_FEEDBACK_MODEL,
      max_tokens: 1000,
      output_config: { effort: "low", format: zodOutputFormat(WordSchema) },
      system: WORD_SYSTEM,
      messages: [
        {
          role: "user",
          content: `Word: ${input.word}\nMeanings:\n${input.senses.map((s, i) => `${i + 1}. (${s.partOfSpeech}) ${s.definition}`).join("\n") || "(none)"}${input.sentence ? `\nSentence: ${input.sentence}` : "\nNo sentence."}`,
        },
      ],
    });
    if (response.stop_reason === "refusal" || !response.parsed_output) throw new Error("Traduction indisponible.");
    return { result: response.parsed_output, usage: { inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens, costMicros: costMicros(response.usage.input_tokens, response.usage.output_tokens), provider: `anthropic:${CLAUDE_FEEDBACK_MODEL}` } };
  }

  async rolePlayDebrief(input: { brief: RolePlayBrief; transcript: ConversationTurn[]; persona: Persona }): Promise<{ debrief: Debrief; usage: LlmUsage }> {
    const response = await this.client.messages.parse({
      model: CLAUDE_DEBRIEF_MODEL,
      max_tokens: 8000,
      output_config: { effort: "medium", format: zodOutputFormat(DebriefSchema) },
      system: `${DEBRIEF_SYSTEM}\n\n${personaText(input.persona)}`,
      messages: [{ role: "user", content: `${briefText(input.brief)}\n\nTranscript:\n<transcript>\n${transcriptText(input.transcript)}\n</transcript>` }],
    });
    if (response.stop_reason === "refusal" || !response.parsed_output) throw new Error("Debrief generation failed.");
    const d = response.parsed_output;
    return {
      debrief: { ...d, scores: { ...d.scores, pronunciation: null } },
      usage: { inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens, costMicros: sonnetCost(response.usage.input_tokens, response.usage.output_tokens), provider: `anthropic:${CLAUDE_DEBRIEF_MODEL}` },
    };
  }

  async rolePlayHelp(input: { brief: RolePlayBrief; transcript: ConversationTurn[]; persona: Persona }): Promise<{ suggestions: HelpSuggestion[]; usage: LlmUsage }> {
    const response = await this.client.messages.parse({
      model: CLAUDE_FEEDBACK_MODEL,
      max_tokens: 1000,
      output_config: { effort: "low", format: zodOutputFormat(HelpSchema) },
      system: HELP_SYSTEM,
      messages: [{ role: "user", content: `${briefText(input.brief)}\n\nConversation so far:\n${transcriptText(input.transcript.slice(-12)) || "(the AI has just greeted the learner)"}` }],
    });
    if (!response.parsed_output) throw new Error("Help unavailable.");
    return {
      suggestions: response.parsed_output.suggestions.slice(0, 3),
      usage: { inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens, costMicros: costMicros(response.usage.input_tokens, response.usage.output_tokens), provider: `anthropic:${CLAUDE_FEEDBACK_MODEL}` },
    };
  }

  /** Diagnostic report (DIAGNOSTIC_SPEC.md §7): model from ANTHROPIC_MODEL (default Claude Sonnet 5.5), 30 s timeout. */
  async diagnosticReport(input: DiagnosticReportInput): Promise<{ report: unknown; usage: LlmUsage }> {
    const model = process.env.ANTHROPIC_MODEL || CLAUDE_DEBRIEF_MODEL;
    const { DiagnosticReportSchema } = await import("@/lib/diagnostic/report-types");
    const { REPORT_SYSTEM } = await import("@/lib/diagnostic/prompt");
    const response = await this.client.messages.parse(
      {
        model,
        max_tokens: 6000,
        output_config: { effort: "low", format: zodOutputFormat(DiagnosticReportSchema) },
        system: REPORT_SYSTEM,
        messages: [
          {
            role: "user",
            content: [
              `Prénom : ${input.firstName}`,
              `Profil principal (imposé) : ${input.primary.name} (${input.primary.id}) — besoin principal : ${input.primary.need}`,
              `Profils secondaires : ${input.secondary.map((p) => `${p.name} (${p.id})`).join(", ") || "aucun"}`,
              `Scores normalisés : ${Object.entries(input.scores).map(([k, v]) => `${k} ${v}`).join(", ")}`,
              "",
              "Réponses de l'apprenant :",
              input.answersText,
            ].join("\n"),
          },
        ],
      },
      { timeout: 30_000, maxRetries: 0 },
    );
    if (response.stop_reason === "refusal" || !response.parsed_output) throw new Error("Diagnostic report: no valid output.");
    const cost = model.includes("haiku") ? costMicros(response.usage.input_tokens, response.usage.output_tokens) : sonnetCost(response.usage.input_tokens, response.usage.output_tokens);
    return { report: response.parsed_output, usage: { inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens, costMicros: cost, provider: `anthropic:${model}` } };
  }

  async dailyVocabulary(input: { profession: string; count: number; avoid: string[] }): Promise<{ words: DailyWord[]; usage: LlmUsage }> {
    const response = await this.client.messages.parse({
      model: CLAUDE_FEEDBACK_MODEL,
      max_tokens: 6000,
      output_config: { effort: "low", format: zodOutputFormat(DailySchema) },
      system: DAILY_SYSTEM,
      messages: [{ role: "user", content: `Profession: ${input.profession}\nNumber of words: ${input.count}\nWords to avoid (already given): ${input.avoid.join(", ") || "none"}` }],
    });
    if (!response.parsed_output) throw new Error("Daily vocabulary unavailable.");
    const words = response.parsed_output.words.map((w) => ({ ...w, examples: w.examples.slice(0, 2), example: w.examples[0]?.en ?? "" }));
    return { words, usage: { inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens, costMicros: costMicros(response.usage.input_tokens, response.usage.output_tokens), provider: `anthropic:${CLAUDE_FEEDBACK_MODEL}` } };
  }

  async goalVocabulary(input: { title: string; goal: string; steps: string[]; count: number; avoid: string[] }): Promise<{ items: GoalExpression[]; usage: LlmUsage }> {
    const response = await this.client.messages.parse({
      model: CLAUDE_FEEDBACK_MODEL,
      max_tokens: 3000,
      output_config: { effort: "low", format: zodOutputFormat(GoalVocabSchema) },
      system: GOAL_VOCAB_SYSTEM,
      messages: [
        {
          role: "user",
          content: `Coaching: ${input.title}\nGoal: ${input.goal || "(not written yet: infer it from the title)"}\nSteps: ${input.steps.join(" | ") || "none"}\nNumber of items: ${input.count}\nItems to avoid (already given): ${input.avoid.join(", ") || "none"}`,
        },
      ],
    });
    if (!response.parsed_output) throw new Error("Coaching vocabulary unavailable.");
    return { items: response.parsed_output.items.slice(0, input.count), usage: { inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens, costMicros: costMicros(response.usage.input_tokens, response.usage.output_tokens), provider: `anthropic:${CLAUDE_FEEDBACK_MODEL}` } };
  }

  async checkSentence(input: { word: string; translation: string; sentence: string }): Promise<{ result: SentenceCheck; usage: LlmUsage }> {
    const response = await this.client.messages.parse({
      model: CLAUDE_FEEDBACK_MODEL,
      max_tokens: 800,
      output_config: { effort: "low", format: zodOutputFormat(SentenceSchema) },
      system: SENTENCE_SYSTEM,
      messages: [{ role: "user", content: `Word: ${input.word}${input.translation ? ` (French: ${input.translation})` : ""}\nSentence: ${input.sentence}` }],
    });
    if (!response.parsed_output) throw new Error("Correction unavailable.");
    return { result: response.parsed_output, usage: { inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens, costMicros: costMicros(response.usage.input_tokens, response.usage.output_tokens), provider: `anthropic:${CLAUDE_FEEDBACK_MODEL}` } };
  }

  async gradeDrill(input: DrillGradeInput): Promise<DrillGrade> {
    const response = await this.client.messages.parse({
      model: CLAUDE_FEEDBACK_MODEL,
      max_tokens: 2000,
      output_config: { effort: "low", format: zodOutputFormat(DrillSchema) },
      system: "You grade short English drill answers from French-speaking professionals. Explanations in simple French, one sentence. modelAnswer: the best correct English answer.",
      messages: [
        {
          role: "user",
          content: `Task: ${input.prompt}\nTarget structure: ${input.targetStructure}\nAccepted answers: ${input.acceptedAnswers.join(" | ")}\nLevel: ${input.cefrLevel}\nLearner's answer: ${input.answer}`,
        },
      ],
    });
    if (!response.parsed_output) throw new Error("La correction automatique a échoué : réessayez dans un instant.");
    return response.parsed_output;
  }
}
