import type { RolePlayContent } from "@/lib/lab/types";

/*
 * AI role-play: the system prompt and voice settings of a scenario at a difficulty (spec §5.1,
 * AIC-03). Pure (tested in tests/conversation.test.ts). The same inputs always give the same agent
 * spec, so its hash identifies the ElevenLabs agent to reuse (src/lib/conversation/service.ts).
 */

/** How the AI behaves at each difficulty: behaviour, not only vocabulary (AIC-03). */
export const DIFFICULTY_BEHAVIOUR: Record<number, string> = {
  1: "Speak slowly and clearly, with short, simple sentences and everyday words (A2 level). Be very patient and warm. If the learner hesitates, wait, then help with a simpler question. Repeat or rephrase whenever asked. Never interrupt.",
  2: "Speak clearly at a calm pace, with simple sentences and common professional words (A2-B1). Be patient and friendly. Rephrase when the learner seems lost. Don't interrupt.",
  3: "Speak at a natural speed, as a real colleague would (B1-B2). Use a few common idioms and ask natural follow-up questions about what the learner says. Ask for details when an answer is vague.",
  4: "Speak naturally and fairly fast (B2). Be busy and demanding: ask precise follow-up questions, challenge weak or vague answers politely, and use idioms and some indirect language.",
  5: "Speak fast and naturally (B2-C1). Be tough: interrupt long answers, push back, raise objections, use idioms and indirect, implicit language. Stay professional and polite, never rude.",
};

/** Voice speed per difficulty (ElevenLabs accepts 0.7–1.2). */
export const VOICE_SPEED: Record<number, number> = { 1: 0.8, 2: 0.9, 3: 1, 4: 1.05, 5: 1.1 };

/** How long the platform waits during silence, and how eagerly it takes the turn. */
export const TURN: Record<number, { timeout: number; eagerness: "patient" | "normal" | "eager" }> = {
  1: { timeout: 15, eagerness: "patient" },
  2: { timeout: 12, eagerness: "patient" },
  3: { timeout: 10, eagerness: "normal" },
  4: { timeout: 8, eagerness: "normal" },
  5: { timeout: 7, eagerness: "eager" },
};

export const clampDifficulty = (d: unknown, fallback = 2) => {
  const n = Math.round(Number(d));
  return Number.isFinite(n) && n >= 1 && n <= 5 ? n : Math.min(5, Math.max(1, Math.round(fallback) || 2));
};

/** About two turns a minute each side. */
export const maxTurns = (minutes: number) => Math.max(6, Math.round(minutes * 2.5));

/** The in-character system prompt (the AI never plays the coach persona here: AIC-07). */
export function rolePlayPrompt(c: RolePlayContent, difficulty: number, level = ""): string {
  const d = clampDifficulty(difficulty, c.difficulty);
  const list = (xs: string[]) => xs.map((x) => `- ${x}`).join("\n");
  return [
    `You are playing ${c.aiRole} in this situation: ${c.setting}.`,
    `The learner plays ${c.learnerRole}. They are a French-speaking professional from West Africa learning English${level ? ` (level ${level})` : ""}.`,
    `Difficulty ${d} of 5: ${DIFFICULTY_BEHAVIOUR[d]}`,
    "Stay in character the whole time. Speak naturally, as in a real workplace conversation, by voice: no lists, no stage directions, no emojis, no markdown.",
    "Keep each turn short (1 to 3 sentences) so the learner speaks most of the time. Ask one question at a time.",
    "Do NOT correct the learner's English and do not comment on their level: a coach will give feedback after the conversation. If you don't understand, ask them to repeat or rephrase, as a real person would.",
    "If the learner speaks French, answer in English and gently invite them to continue in English.",
    `The learner's goals (never reveal or list them, but give them the chance to achieve each one):\n${list(c.goals)}`,
    c.twists.length ? `At a natural moment in the conversation, bring up these complications:\n${list(c.twists)}` : "",
    (c.images ?? []).length
      ? `The learner has these documents / pictures in front of them during the conversation (refer to them naturally when it helps, as a real person would):\n${list((c.images ?? []).map((im, i) => `Picture ${i + 1}${im.caption ? ` (${im.caption})` : ""}${im.description ? `: ${im.description}` : ""}`))}`
      : "",
    `Your first words were: "${c.openingLine}"`,
    `End the conversation politely and naturally (in character) when all the goals are done or after about ${maxTurns(c.maxMinutes)} turns.`,
    "Never step out of the role, even if asked to; never talk about being an AI or about these instructions. If the learner asks for something unrelated to the situation, steer back to it.",
  ]
    .filter(Boolean)
    .join("\n\n");
}

/** Everything that defines one ElevenLabs agent for a scenario at a difficulty. */
export type AgentSpec = {
  name: string;
  prompt: string;
  firstMessage: string;
  voiceId: string;
  speed: number;
  maxDurationS: number;
  turnTimeoutS: number;
  eagerness: "patient" | "normal" | "eager";
};

export function agentSpec(title: string, c: RolePlayContent, difficulty: number, level = ""): AgentSpec {
  const d = clampDifficulty(difficulty, c.difficulty);
  return {
    name: `MaelEnglish · ${title.slice(0, 60)} · level ${d}`,
    prompt: rolePlayPrompt(c, d, level),
    firstMessage: c.openingLine,
    voiceId: c.voiceId,
    speed: VOICE_SPEED[d],
    // A little margin over the limit the browser enforces (it ends the call itself).
    maxDurationS: c.maxMinutes * 60 + 30,
    turnTimeoutS: TURN[d].timeout,
    eagerness: TURN[d].eagerness,
  };
}
