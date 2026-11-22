import { normalizeRich, plainText } from "@/lib/rich-text";
import { Types } from "mongoose";
import { videoSource } from "@/lib/learn/media";
import { MAX_PLAYS, MAX_SECONDS, PREP_SECONDS, PROMPT_TYPES, SENTENCE_AUDIO_WHEN, MATCH_PER_SCREEN, TFNG_ANSWERS, docSentences, type CompleteWordsContent, type RepeatContent, type WritingTaskContent, WRITING_MIN_WORDS, WRITING_MAX_WORDS, type DictationContent, DICTATION_PLAYS, type RolePlayContent, ROLEPLAY_MINUTES, ROLEPLAY_DIFFICULTIES, type TfngAnswer, type TfngContent, type TfngStatement, sentenceTiles, type MatchContent, type MatchPair, type PromptType, type SentenceContent, type SentenceItem, type ActivityContent, type ActivityType, type SpeakingChallengeContent, type ListeningContent, type ListeningQuestion, type GapsContent, type ListenGapsContent, GAP_HINTS, parseGaps } from "./types";

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

/** Sentence builder: the editor sends `json` ({ audioWhen, items }); lists may come as « / »-separated text or arrays. */
function cleanSentences(r: Record<string, unknown>): SentenceContent {
  let j: Record<string, unknown> = r;
  if (typeof r.json === "string") {
    try {
      j = JSON.parse(r.json) as Record<string, unknown>;
    } catch {
      j = {};
    }
  }
  const list = (v: unknown, sep: RegExp, n: number, max: number) =>
    (Array.isArray(v) ? v : str(v, 2000).split(sep))
      .map((x) => str(x, max))
      .filter(Boolean)
      .slice(0, n);
  const seen = new Set<string>();
  const items: SentenceItem[] = (Array.isArray(j.items) ? j.items : []).slice(0, 20).map((raw, i) => {
    const it = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
    let id = str(it.id, 40).replace(/[^\w-]/g, "") || `s${i + 1}`;
    if (seen.has(id)) id = `s${i + 1}-${seen.size}`;
    seen.add(id);
    return {
      id,
      sentence: str(it.sentence, 300),
      translation: str(it.translation, 300),
      distractors: list(it.distractors, /\//, 4, 40),
      alternatives: list(it.alternatives, /\n/, 5, 300),
      explanation: str(it.explanation, 300),
      audioMediaId: typeof it.audioMediaId === "string" && Types.ObjectId.isValid(it.audioMediaId) ? it.audioMediaId : "",
    };
  });
  return { items, audioWhen: SENTENCE_AUDIO_WHEN.includes(j.audioWhen as "after") ? (j.audioWhen as SentenceContent["audioWhen"]) : "after" };
}

/** Matching pairs: the editor sends `json` ({ perScreen, pairs }). */
function cleanPairs(r: Record<string, unknown>): MatchContent {
  let j: Record<string, unknown> = r;
  if (typeof r.json === "string") {
    try {
      j = JSON.parse(r.json) as Record<string, unknown>;
    } catch {
      j = {};
    }
  }
  const seen = new Set<string>();
  const pairs: MatchPair[] = (Array.isArray(j.pairs) ? j.pairs : []).slice(0, 30).map((raw, i) => {
    const p = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
    let id = str(p.id, 40).replace(/[^\w-]/g, "") || `p${i + 1}`;
    if (seen.has(id)) id = `p${i + 1}-${seen.size}`;
    seen.add(id);
    const media = (v: unknown) => (typeof v === "string" && Types.ObjectId.isValid(v) ? v : "");
    return { id, left: str(p.left, 160), right: str(p.right, 300), explanation: str(p.explanation, 300), audioMediaId: media(p.audioMediaId), rightAudioMediaId: media(p.rightAudioMediaId) };
  });
  return { pairs, perScreen: pick(MATCH_PER_SCREEN, j.perScreen, 5) };
}

function pairsProblem(c: Partial<MatchContent>): string | null {
  const pairs = c.pairs ?? [];
  if (pairs.length < 2) return "Add at least 2 pairs.";
  for (const [i, p] of pairs.entries()) if (!p.left || !p.right) return `Pair ${i + 1}: fill in both sides.`;
  // Two identical cards on one side would make two right answers.
  for (const side of ["left", "right"] as const) {
    const texts = pairs.map((p) => p[side].trim().toLowerCase());
    const dup = texts.findIndex((t, i) => texts.indexOf(t) !== i);
    if (dup >= 0) return `Pair ${dup + 1}: « ${pairs[dup][side]} » appears twice on the ${side} side.`;
  }
  return null;
}

/** True / false / not given: the editor sends `json` ({ docTitle, text, statements }). */
function cleanTfng(r: Record<string, unknown>): TfngContent {
  let j: Record<string, unknown> = r;
  if (typeof r.json === "string") {
    try {
      j = JSON.parse(r.json) as Record<string, unknown>;
    } catch {
      j = {};
    }
  }
  const text = (typeof j.text === "string" ? j.text : "").replace(/\r/g, "").slice(0, 6000);
  const lines = docSentences(text).length;
  const seen = new Set<string>();
  const statements: TfngStatement[] = (Array.isArray(j.statements) ? j.statements : []).slice(0, 15).map((raw, i) => {
    const st = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
    let id = str(st.id, 40).replace(/[^\w-]/g, "") || `t${i + 1}`;
    if (seen.has(id)) id = `t${i + 1}-${seen.size}`;
    seen.add(id);
    const answer: TfngAnswer = TFNG_ANSWERS.includes(st.answer as TfngAnswer) ? (st.answer as TfngAnswer) : "true";
    const ev = Number(st.evidence);
    // « Not given » has no proof in the text; an index outside the text is dropped.
    const evidence = answer !== "not_given" && st.evidence !== null && st.evidence !== "" && Number.isInteger(ev) && ev >= 0 && ev < lines ? ev : null;
    return { id, text: str(st.text, 300), answer, evidence, explanation: str(st.explanation, 300), quote: answer === "not_given" ? "" : str(st.quote, 300), audioMediaId: typeof st.audioMediaId === "string" && Types.ObjectId.isValid(st.audioMediaId) ? st.audioMediaId : "" };
  });
  const imageMediaId = typeof j.imageMediaId === "string" && Types.ObjectId.isValid(j.imageMediaId) ? j.imageMediaId : "";
  return { docTitle: str(j.docTitle, 120), text, statements, imageMediaId, imageAlt: imageMediaId ? str(j.imageAlt, 300) : "" };
}

function tfngProblem(c: Partial<TfngContent>): string | null {
  // The document: a text (2+ sentences), a picture, or both (the text then serves as the transcript).
  const hasText = docSentences(c.text ?? "").length >= 2;
  if (!hasText && !c.imageMediaId) return "Add the document: a picture (e.g. a screenshot of an email) or its text, at least 2 sentences, one per line.";
  if (!c.statements?.length) return "Add at least one statement.";
  for (const [i, st] of c.statements.entries()) {
    if (!st.text) return `Statement ${i + 1}: write it.`;
    if (hasText && st.answer !== "not_given" && st.evidence === null) return `Statement ${i + 1}: pick the sentence of the text that proves it.`;
  }
  return null;
}

function sentencesProblem(c: Partial<SentenceContent>): string | null {
  if (!c.items?.length) return "Add at least one sentence.";
  for (const [i, it] of c.items.entries()) {
    const tiles = sentenceTiles(it.sentence ?? "");
    if (tiles.length < 2) return `Sentence ${i + 1}: write it with « / » between the tiles (at least 2 tiles).`;
    if (tiles.length > 14) return `Sentence ${i + 1}: 14 tiles at most (group words into one tile with « / »).`;
    const lower = new Set(tiles.map((t) => t.toLowerCase()));
    if (it.distractors?.some((d) => lower.has(d.toLowerCase()))) return `Sentence ${i + 1}: a distractor is also a tile of the sentence.`;
    if (c.audioWhen === "before" && !it.audioMediaId) return `Sentence ${i + 1}: add its audio (the learner hears it before building it).`;
  }
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
    case "sentence_builder":
      return cleanSentences(r) as ActivityContent[T];
    case "match_pairs":
    case "listen_match":
      return cleanPairs(r) as ActivityContent[T];
    case "true_false_ng":
      return cleanTfng(r) as ActivityContent[T];
    case "dictation": {
      let j: Record<string, unknown> = r;
      if (typeof r.json === "string") {
        try {
          j = JSON.parse(r.json) as Record<string, unknown>;
        } catch {
          j = {};
        }
      }
      const seen = new Set<string>();
      const items = (Array.isArray(j.items) ? j.items : []).slice(0, 20).map((raw, i) => {
        const it = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
        let id = str(it.id, 40).replace(/[^\w-]/g, "") || `d${i + 1}`;
        if (seen.has(id)) id = `d${i + 1}-${seen.size}`;
        seen.add(id);
        return { id, text: str(it.text, 300), translation: str(it.translation, 300), audioMediaId: typeof it.audioMediaId === "string" && Types.ObjectId.isValid(it.audioMediaId) ? it.audioMediaId : "" };
      });
      return { items, maxPlays: pick(DICTATION_PLAYS, j.maxPlays, 0) } satisfies DictationContent as ActivityContent[T];
    }
    case "role_play": {
      const lines = (v: unknown, n: number, max = 300) =>
        (Array.isArray(v) ? v : str(v, 6000).split("\n"))
          .map((x) => str(x, max))
          .filter(Boolean)
          .slice(0, n);
      return {
        situation: normalizeRich(typeof r.situation === "string" ? r.situation : ""),
        aiRole: str(r.aiRole, 300),
        learnerRole: str(r.learnerRole, 300),
        setting: str(r.setting, 500),
        goals: lines(r.goals, 8),
        targetPhrases: lines(r.targetPhrases, 10, 200),
        twists: lines(r.twists, 5),
        openingLine: str(r.openingLine, 300),
        difficulty: pick(ROLEPLAY_DIFFICULTIES, r.difficulty, 2),
        maxMinutes: pick(ROLEPLAY_MINUTES, r.maxMinutes, 5),
        voiceId: str(r.voiceId, 64).replace(/[^\w-]/g, ""),
        voiceName: str(r.voiceName, 100),
      } satisfies RolePlayContent as ActivityContent[T];
    }
    case "writing_task": {
      const minWords = pick(WRITING_MIN_WORDS, r.minWords, 60);
      const maxWords = Math.max(pick(WRITING_MAX_WORDS, r.maxWords, 120), minWords + 20);
      return {
        prompt: normalizeRich(typeof r.prompt === "string" ? r.prompt : ""),
        imageMediaId: typeof r.imageMediaId === "string" && Types.ObjectId.isValid(r.imageMediaId) ? r.imageMediaId : "",
        checklist: (Array.isArray(r.checklist) ? r.checklist : str(r.checklist, 3000).split("\n"))
          .map((x) => str(x, 200))
          .filter(Boolean)
          .slice(0, 8),
        minWords,
        maxWords,
        modelAnswer: str(r.modelAnswer, 4000),
      } satisfies WritingTaskContent as ActivityContent[T];
    }
    case "repeat_after": {
      let j: Record<string, unknown> = r;
      if (typeof r.json === "string") {
        try {
          j = JSON.parse(r.json) as Record<string, unknown>;
        } catch {
          j = {};
        }
      }
      const seen = new Set<string>();
      const phrases = (Array.isArray(j.phrases) ? j.phrases : []).slice(0, 20).map((raw, i) => {
        const p = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
        let id = str(p.id, 40).replace(/[^\w-]/g, "") || `r${i + 1}`;
        if (seen.has(id)) id = `r${i + 1}-${seen.size}`;
        seen.add(id);
        return { id, text: str(p.text, 200), translation: str(p.translation, 200), audioMediaId: typeof p.audioMediaId === "string" && Types.ObjectId.isValid(p.audioMediaId) ? p.audioMediaId : "" };
      });
      return { phrases } satisfies RepeatContent as ActivityContent[T];
    }
    case "complete_words":
      return {
        text: (typeof r.text === "string" ? r.text : "").replace(/\r/g, "").slice(0, 6000),
        audioMediaId: typeof r.audioMediaId === "string" && Types.ObjectId.isValid(r.audioMediaId) ? r.audioMediaId : "",
      } satisfies CompleteWordsContent as ActivityContent[T];
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
    case "sentence_builder":
      return sentencesProblem(content as Partial<SentenceContent>);
    case "match_pairs":
      return pairsProblem(content as Partial<MatchContent>);
    case "true_false_ng":
      return tfngProblem(content as Partial<TfngContent>);
    case "dictation": {
      const items = (content as Partial<DictationContent>).items ?? [];
      if (!items.length) return "Add at least one sentence.";
      for (const [i, it] of items.entries()) {
        if (!it.text) return `Sentence ${i + 1}: write it (what learners must type).`;
        if (!it.audioMediaId) return `Sentence ${i + 1}: add its audio.`;
      }
      return null;
    }
    case "role_play": {
      const c = content as Partial<RolePlayContent>;
      if (!c.aiRole) return "Write the AI's role (who the AI plays).";
      if (!c.learnerRole) return "Write the learner's role.";
      if (!c.setting) return "Describe the setting.";
      if (!c.goals?.length) return "Add at least one goal for the learner.";
      if (!c.openingLine) return "Write the AI's opening line.";
      return null;
    }
    case "writing_task":
      return plainText((content as Partial<WritingTaskContent>).prompt ?? "") ? null : "Write the prompt: what the learner must write.";
    case "repeat_after": {
      const phrases = (content as Partial<RepeatContent>).phrases ?? [];
      if (!phrases.length) return "Add at least one phrase.";
      for (const [i, p] of phrases.entries()) {
        if (!p.text) return `Phrase ${i + 1}: write it.`;
        if (!p.audioMediaId) return `Phrase ${i + 1}: add your audio (learners repeat after it).`;
      }
      return null;
    }
    case "complete_words": {
      const { gaps } = parseGaps({ text: (content as Partial<CompleteWordsContent>).text ?? "", explanations: [] });
      if (gaps.length < 2) return "Cut at least 2 words: write the missing letters in brackets, e.g. destin[ations] — or use « Blank automatically ».";
      const bad = gaps.find((g) => g.answers.some((a) => /\s/.test(a) || a.length > 20));
      if (bad) return `Word ${bad.index + 1}: the brackets hold the missing letters of one word (no spaces, 20 letters max).`;
      return null;
    }
    case "listen_match": {
      const c = content as Partial<MatchContent>;
      const missing = (c.pairs ?? []).findIndex((p) => !p.rightAudioMediaId);
      if (missing >= 0) return `Pair ${missing + 1}: add the audio of the meaning.`;
      return pairsProblem(c);
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
