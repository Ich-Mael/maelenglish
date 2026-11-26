import Link from "next/link";
import { BookText, ListOrdered } from "lucide-react";
import { cn } from "cn";

/** « Sentences » / « Story » switch of a fill-the-gaps practice (links: `href(mode)`). */
export function GapModes({ mode, href }: { mode: "sentences" | "story"; href: (m: "sentences" | "story") => string }) {
  const tabs = [
    { m: "sentences" as const, label: "Sentences", hint: "one per expression", icon: ListOrdered },
    { m: "story" as const, label: "Story", hint: "all of them in one text", icon: BookText },
  ];
  return (
    <nav aria-label="Practice mode" className="mx-auto grid w-full max-w-2xl grid-cols-2 gap-2">
      {tabs.map((t) => (
        <Link key={t.m} href={href(t.m)} aria-current={mode === t.m ? "page" : undefined} className={cn("flex items-center gap-2.5 rounded-2xl border-2 px-3 py-2.5 transition", mode === t.m ? "border-primary bg-brand-soft" : "border-border bg-card hover:border-primary/40")}>
          <t.icon className={cn("size-5 shrink-0", mode === t.m ? "text-primary" : "text-muted-foreground")} aria-hidden />
          <span className="grid">
            <span className="font-bold text-brand-deep">{t.label}</span>
            <span className="text-xs text-muted-foreground">{t.hint}</span>
          </span>
        </Link>
      ))}
    </nav>
  );
}
