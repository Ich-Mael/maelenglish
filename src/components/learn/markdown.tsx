import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/** Reading styles shared by Markdown and rich-text (HTML) content. */
export const PROSE =
  "grid gap-4 text-[1.0625rem] leading-relaxed text-ink/90 [&_a]:font-semibold [&_a]:text-primary [&_a]:underline [&_blockquote]:rounded-2xl [&_blockquote]:border-l-4 [&_blockquote]:border-coral [&_blockquote]:bg-coral-soft [&_blockquote]:px-4 [&_blockquote]:py-3 [&_code]:rounded [&_code]:bg-brand-soft [&_code]:px-1.5 [&_h2]:mt-2 [&_h2]:text-2xl [&_h2]:font-extrabold [&_h2]:text-brand-deep [&_h3]:text-xl [&_h3]:font-bold [&_h3]:text-brand-deep [&_li]:my-1 [&_ol]:list-decimal [&_ol]:pl-6 [&_strong]:text-brand-deep [&_table]:w-full [&_table]:overflow-hidden [&_table]:rounded-xl [&_td]:border [&_td]:border-border [&_td]:px-3 [&_td]:py-2 [&_th]:border [&_th]:border-border [&_th]:bg-brand-soft [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_ul]:list-disc [&_ul]:pl-6 [&_table]:block [&_table]:overflow-x-auto [&_p:empty]:hidden [&_h4]:text-lg [&_h4]:font-bold [&_h4]:text-brand-deep [&_span[style*=color]_strong]:text-inherit [&_span[style*=background]]:rounded-sm [&_span[style*=background]]:px-0.5 [&_sup]:text-xs [&_sub]:text-xs";

/** Lesson text: Markdown without raw HTML (react-markdown drops it), styled for reading on phones. */
export function Markdown({ children }: { children: string }) {
  return (
    <div className={PROSE}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          ),
          table: ({ children }) => (
            <div className="overflow-x-auto">
              <table>{children}</table>
            </div>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
