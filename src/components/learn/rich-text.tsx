import { isHtml } from "@/lib/rich-detect";
import { Markdown, PROSE } from "./markdown";
import { cn } from "cn";

/**
 * Staff-written long text: HTML from the rich editor (sanitised when saved — see
 * src/lib/rich-text.ts) or older content, rendered as Markdown (`legacy="markdown"`) or
 * as plain text with line breaks (`legacy="text"`: descriptions, coach comments).
 */
/** `lang`: the language of the text when it differs from the page (staff instructions are French on the English learner pages). */
export function RichText({ children, legacy = "markdown", className, lang }: { children: string | null | undefined; legacy?: "markdown" | "text"; className?: string; lang?: string }) {
  const text = children ?? "";
  if (isHtml(text)) return <div lang={lang} className={cn(PROSE, className)} dangerouslySetInnerHTML={{ __html: text }} />;
  if (legacy === "text") return <p lang={lang} className={cn("whitespace-pre-line", className)}>{text}</p>;
  return lang ? <div lang={lang}><Markdown>{text}</Markdown></div> : <Markdown>{text}</Markdown>;
}
