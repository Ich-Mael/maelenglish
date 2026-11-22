import { normalizeRich, plainText } from "@/lib/rich-text";
import { Types } from "mongoose";
import { videoSource } from "@/lib/learn/media";
import { MAX_PLAYS, MAX_SECONDS, PREP_SECONDS, PROMPT_TYPES, type PromptType, type ActivityContent, type ActivityType, type SpeakingChallengeContent, type ListeningContent, type ListeningQuestion, type GapsContent, type ListenGapsContent, GAP_HINTS, parseGaps } from "./types";

/*
 * Content rules per activity type (server: rich text is sanitised here). `cleanContent` turns what
 * the editor sent into the stored shape; `contentProblem` says what's missing before the activity
 * can be marked « prête » (null = complete).
 */

const pick = <T extends number>(allowed: readonly T[], v: unknown, dflt: T): T => (allowed.includes(Number(v) as T) ? (Number(v) as T) : dflt);

const str = (v: unknown, max = 2000) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const safeId = (v: unknown, fallback: string) => (typeof v === "string" && /^[a-z0-9_-]{1,32}$/i.test(v) ? v : fallback);
const rid = () => Math.random().toString(36).slice(2, 10);

function parseJson(v: unknown): Record<string, unknown> {
  if (typeof v !== "string") return {};
  try {
    const x = JSON.parse(v);
    return x && typeof x === "object" ? x : {};
  } catch {
    return {};
  }
}

function cleanListening(r: Record<string, unknown>): ListeningContent {
  // The editor sends its structured part as JSON (« c_json ») and the rich context separately.
  const j = typeof r.json === "string" ? parseJson(r.json) : r;
  const questions = (Array.isArray(j.questions) ? j.questions : []).slice(0, 30).map((q: Record<string, unknown>, i: number): ListeningQuestion => {
    const options = (Array.isArray(q.options) ? q.options : [])
      .slice(0, 6)
      .map((o: Record<string, unknown>, k: number) => ({ id: safeId(o?.id, String.fromCharCode(97 + k)), text: str(o?.text, 300) }))
      .filter((o) => o.text);
    const start = Number(q.startS);
    return {
      id: safeId(q.id, `q${i}${rid()}`),
      text: str(q.text, 500),
      options,
      correctOptionId: options.some((o) => o.id === q.correctOptionId) ? String(q.correctOptionId) : "",
      explanation: str(q.explanation, 1000),
      startS: q.startS !== null && q.startS !== "" && Number.isFinite(start) && start >= 0 ? Math.round(start * 10) / 10 : null,
    };
  });
  const audio = typeof j.audioMediaId === "string" && Types.ObjectId.isValid(j.audioMediaId) ? j.audioMediaId : "";
  return {
    audioMediaId: audio,
    audioDurationS: audio ? Math.max(0, Math.round(Number(j.audioDurationS) || 0)) : 0,
    context: normalizeRich(typeof r.context === "string" ? r.context : typeof j.context === "string" ? j.context : ""),
    transcript: str(j.transcript, 20000),
    maxPlays: pick(MAX_PLAYS, j.maxPlays, 0),
    questions,
  };
}

function cleanGaps(r: Record<string, unknown>): GapsContent {
  const j = typeof r.json === "string" ? parseJson(r.json) : r;
  const list = (v: unknown, max: number, len: number) => (Array.isArray(v) ? v : typeof v === "string" ? v.split(",") : []).map((x) => str(x, len)).slice(0, max);
  return {
    text: str(j.text, 6000),
    explanations: list(j.explanations, 60, 500),
    hint: GAP_HINTS.includes(j.hint as GapsContent["hint"]) ? (j.hint as GapsContent["hint"]) : "letters",
    wordBank: j.wordBank === true || j.wordBank === "on",
    distractors: list(j.distractors, 20, 60).filter(Boolean),
    typos: j.typos !== false && j.typos !== "off",
  };
}

function cleanListenGaps(r: Record<string, unknown>): ListenGapsContent {
  const j = typeof r.json === "string" ? parseJson(r.json) : r;
  const audio = typeof j.audioMediaId === "string" && Types.ObjectId.isValid(j.audioMediaId) ? j.audioMediaId : "";
  return {
    ...cleanGaps(r),
    // Listening is about hearing exact words (« manage » vs « manages »): no typo unless staff tick it.
    typos: j.typos === true || j.typos === "on",
    audioMediaId: audio,
    audioDurationS: audio ? Math.max(0, Math.round(Number(j.audioDurationS) || 0)) : 0,
    context: normalizeRich(typeof r.context === "string" ? r.context : typeof j.context === "string" ? j.context : ""),
    maxPlays: pick(MAX_PLAYS, j.maxPlays, 0),
  };
}

function gapsProblem(c: Partial<GapsContent>): string | null {
  const { gaps } = parseGaps({ text: c.text ?? "", explanations: c.explanations ?? [] });
  if (!gaps.length) return "Write the text with at least one answer in [square brackets].";
  if (gaps.length > 40) return "Keep it to 40 blanks at most.";
  return null;
}

export function cleanContent<T extends ActivityType>(type: T, raw: unknown): ActivityContent[T] {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  switch (type) {
    case "listen_choose":
      return cleanListening(r) as ActivityContent[T];
    case "fill_gaps":
      return cleanGaps(r) as ActivityContent[T];
    case "listen_fill_gaps":
      return cleanListenGaps(r) as ActivityContent[T];
    case "speaking_challenge": {
      const promptType: PromptType = PROMPT_TYPES.includes(r.promptType as PromptType) ? (r.promptType as PromptType) : "text";
      const lines = (v: unknown, n: number) =>
        (Array.isArray(v) ? v : str(v, 4000).split("\n"))
          .map((x) => str(x, 300))
          .filter(Boolean)
          .slice(0, n);
      return {
        instructions: normalizeRich(typeof r.instructions === "string" ? r.instructions : ""),
        promptType,
        // Only what the chosen prompt uses is kept.
        promptMediaId: (promptType === "image" || promptType === "audio") && typeof r.promptMediaId === "string" && Types.ObjectId.isValid(r.promptMediaId) ? r.promptMediaId : "",
        promptVideoUrl: promptType === "video" ? str(r.promptVideoUrl, 500) : "",
        promptAlt: promptType === "image" ? str(r.promptAlt, 300) : "",
        questions: lines(r.questions, 10),
        maxSeconds: pick(MAX_SECONDS, r.maxSeconds, 60),
        prepSeconds: pick(PREP_SECONDS, r.prepSeconds, 0),
        // The editor sends the checklist one item per line.
        mustInclude: (Array.isArray(r.mustInclude) ? r.mustInclude : str(r.mustInclude, 4000).split("\n"))
          .map((x) => str(x, 200))
          .filter(Boolean)
          .slice(0, 12),
        modelAnswerText: str(r.modelAnswerText, 4000),
        modelAnswerAudioMediaId: typeof r.modelAnswerAudioMediaId === "string" && Types.ObjectId.isValid(r.modelAnswerAudioMediaId) ? r.modelAnswerAudioMediaId : "",
      } satisfies SpeakingChallengeContent as ActivityContent[T];
    }
  }
  throw new Error("Unknown activity type.");
}

export function contentProblem(type: ActivityType, content: unknown): string | null {
  switch (type) {
    case "listen_choose": {
      const c = content as Partial<ListeningContent>;
      if (!c.audioMediaId) return "Add the audio.";
      if (!c.questions?.length) return "Add at least one question.";
      for (const [i, q] of c.questions.entries()) {
        if (!q.text) return `Question ${i + 1}: write the question.`;
        if (q.options.length < 2) return `Question ${i + 1}: give at least 2 answers.`;
        if (!q.correctOptionId) return `Question ${i + 1}: tick the correct answer.`;
      }
      return null;
    }
    case "fill_gaps":
      return gapsProblem(content as Partial<GapsContent>);
    case "listen_fill_gaps": {
      const c = content as Partial<ListenGapsContent>;
      if (!c.audioMediaId) return "Add the audio.";
      return gapsProblem(c);
    }
    case "speaking_challenge": {
      const c = content as Partial<SpeakingChallengeContent>;
      if (!plainText(c.instructions ?? "")) return "Write the challenge instructions.";
      if (c.promptType === "image" && !c.promptMediaId) return "Add the picture the learner describes.";
      if (c.promptType === "audio" && !c.promptMediaId) return "Add the audio the learner listens to.";
      if (c.promptType === "video" && !videoSource(c.promptVideoUrl)) return "Add a valid video link (YouTube, Vimeo or an .mp4 file).";
      return null;
    }
  }
  return "Unknown activity type.";
}
