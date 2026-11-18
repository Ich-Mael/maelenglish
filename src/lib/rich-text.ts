import sanitizeHtml from "sanitize-html";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypeStringify from "rehype-stringify";
import { isHtml } from "./rich-detect";

/*
 * Long staff-written texts (lesson text, course description, assignment instructions, coach
 * comments) are edited with HugeRTE and stored as HTML. Older content is Markdown: it keeps
 * rendering as Markdown and is converted to HTML when it is opened in the editor.
 *
 * Every save goes through `normalizeRich`, which sanitises the HTML with an allowlist
 * (instructors and coaches can write content that learners and admins then display).
 * Framework-free and server-side only (sanitize-html is too heavy for the browser).
 */

export { isHtml };

const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: ["p", "br", "h2", "h3", "h4", "strong", "b", "em", "i", "u", "s", "ul", "ol", "li", "blockquote", "a", "code", "pre", "hr", "table", "thead", "tbody", "tr", "th", "td", "span", "sub", "sup"],
  allowedAttributes: { a: ["href", "title", "target", "rel"], th: ["colspan", "rowspan"], td: ["colspan", "rowspan"] },
  allowedSchemes: ["http", "https", "mailto", "tel"],
  allowProtocolRelative: false,
  transformTags: {
    // Old-style tags and stray headings mapped onto the allowed set.
    h1: "h2",
    h5: "h4",
    h6: "h4",
    div: "p",
    a: (tagName, attribs) => ({ tagName, attribs: { ...attribs, target: "_blank", rel: "noopener noreferrer" } }),
  },
  exclusiveFilter: (frame) => frame.tag === "span" && !frame.text.trim(),
};

export function sanitizeRich(html: string): string {
  return sanitizeHtml(html, OPTIONS)
    .replace(/<p>(?:\s|&nbsp;|\u00a0|<br\s*\/?>)*<\/p>/g, "") // empty paragraphs (e.g. left by a removed image)
    .trim();
}

/** Markdown (GFM) → sanitised HTML. Raw HTML inside the Markdown is dropped. */
export function markdownToHtml(md: string): string {
  const html = String(unified().use(remarkParse).use(remarkGfm).use(remarkRehype).use(rehypeStringify).processSync(md));
  return sanitizeRich(html);
}

const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Plain text → paragraphs (blank line) and line breaks (single newline). */
export function textToHtml(text: string): string {
  return text
    .trim()
    .split(/\n\s*\n/)
    .map((para) => `<p>${escape(para.trim()).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

/**
 * Value to load into the editor: HTML as is (sanitised), older content converted —
 * `from: "markdown"` (lesson text, instructions) or `"text"` (description, coach comments).
 */
export function toEditorHtml(text: string | null | undefined, from: "markdown" | "text" = "markdown"): string {
  const t = (text ?? "").trim();
  if (!t) return "";
  if (isHtml(t)) return sanitizeRich(t);
  return from === "markdown" ? markdownToHtml(t) : textToHtml(t);
}

/** Text without tags (to check that a required rich field isn't empty). */
export function plainText(text: string | null | undefined): string {
  return sanitizeHtml(text ?? "", { allowedTags: [], allowedAttributes: {} })
    .replace(/&nbsp;| /g, " ")
    .replace(/&amp;/g, "&")
    .trim();
}

/** Value to store: sanitised HTML, or '' when the editor is empty. Plain text / Markdown is kept as typed. */
export function normalizeRich(text: string | null | undefined): string {
  const t = (text ?? "").trim();
  if (!t) return "";
  if (!isHtml(t)) return t;
  const clean = sanitizeRich(t);
  return plainText(clean) ? clean : "";
}
