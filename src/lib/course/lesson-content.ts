import { SECTION_TYPES, type LessonContent, type LessonSection, type SectionType } from "./types";

/*
 * Lesson step content: cleaning (anything → a well-formed LessonContent) and the « is there
 * something to teach » check used by validateUnit. Pure (browser and server). The rich intro is
 * sanitised separately on the server (normalizeRich) before saving.
 */

const str = (v: unknown, max = 2000) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const id = (v: unknown, i: number) => str(v, 40) || `s${i + 1}`;

export const emptyLesson = (): LessonContent => ({ intro: "", videoUrl: "", audioMediaId: "", sections: [] });

function cleanSection(raw: unknown, i: number): LessonSection | null {
  const r = obj(raw);
  const type = r.type as SectionType;
  if (!SECTION_TYPES.includes(type)) return null;
  const sid = id(r.id, i);
  switch (type) {
    case "vocabulary":
      return {
        id: sid,
        type,
        items: arr(r.items)
          .slice(0, 40)
          .map((x) => obj(x))
          .map((x, k) => ({ id: id(x.id, k), term: str(x.term, 200), meaning: str(x.meaning, 300), example: str(x.example, 500), audioMediaId: str(x.audioMediaId, 40) }))
          .filter((x) => x.term || x.meaning || x.example),
      };
    case "grammar_rule": {
      const table = arr(r.table)
        .slice(0, 12)
        .map((row) => arr(row).slice(0, 6).map((c) => str(c, 200)))
        .filter((row) => row.some(Boolean));
      const width = Math.max(0, ...table.map((row) => row.length));
      return {
        id: sid,
        type,
        rule: str(r.rule, 1000),
        table: table.map((row) => [...row, ...Array(width - row.length).fill("")]),
        examples: arr(r.examples).slice(0, 20).map((e) => str(e, 500)).filter(Boolean),
      };
    }
    case "dialogue":
      return {
        id: sid,
        type,
        audioMediaId: str(r.audioMediaId, 40),
        lines: arr(r.lines)
          .slice(0, 40)
          .map((x) => obj(x))
          .map((x, k) => ({ id: id(x.id, k), speaker: str(x.speaker, 60), text: str(x.text, 600) }))
          .filter((x) => x.text),
      };
    case "tip":
      return { id: sid, type, text: str(r.text, 1000) };
  }
}

/** Anything → LessonContent (unknown fields dropped, lengths capped). `intro` is kept as given (sanitised by the caller). */
export function cleanLessonContent(raw: unknown): LessonContent {
  const r = obj(raw);
  return {
    intro: typeof r.intro === "string" ? r.intro : "",
    videoUrl: str(r.videoUrl, 500),
    audioMediaId: str(r.audioMediaId, 40),
    sections: arr(r.sections)
      .slice(0, 20)
      .map(cleanSection)
      .filter((s): s is LessonSection => s !== null),
  };
}

/** True when a section has something to show. */
export function sectionHasContent(s: LessonSection): boolean {
  switch (s.type) {
    case "vocabulary":
      return s.items.some((i) => i.term);
    case "grammar_rule":
      return !!s.rule || s.table.length > 0 || s.examples.length > 0;
    case "dialogue":
      return s.lines.length > 0;
    case "tip":
      return !!s.text;
  }
}

/** A lesson teaches something: an intro (plain text, i.e. without the HTML tags), a video or a non-empty section. */
export function lessonHasContent(c: LessonContent, introText = c.intro.replace(/<[^>]*>/g, "").trim()): boolean {
  return !!introText || !!c.videoUrl || c.sections.some(sectionHasContent);
}
