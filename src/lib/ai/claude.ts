import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import * as z from "zod/v4";
import type { DrillGrade, DrillGradeInput, FeedbackService, LlmUsage, WordTranslation, WordTranslationInput, WritingCorrection, WritingCorrectionInput } from "./types";

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
