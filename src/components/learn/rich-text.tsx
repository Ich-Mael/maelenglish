import { isHtml } from "@/lib/rich-detect";
import { Markdown, PROSE } from "./markdown";
import { cn } from "cn";

/**
 * Staff-written long text: HTML from the rich editor (sanitised when saved — see
 * src/lib/rich-text.ts) or older content, rendered as Markdown (`legacy="markdown"`) or
 * as plain text with line breaks (`legacy="text"`: descriptions, coach comments).
 */
export function RichText({ children, legacy = "markdown", className }: { children: string | null | undefined; legacy?: "markdown" | "text"; className?: string }) {
  const text = children ?? "";
  if (isHtml(text)) return <div className={cn(PROSE, className)} dangerouslySetInnerHTML={{ __html: text }} />;
  if (legacy === "text") return <p className={cn("whitespace-pre-line", className)}>{text}</p>;
  return <Markdown>{text}</Markdown>;
}
