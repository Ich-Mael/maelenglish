import { Lightbulb, MessagesSquare, Table2, Volume2, BookA } from "lucide-react";
import type { LessonContent, LessonSection } from "@/lib/course/types";
import { SECTION_LABEL } from "@/lib/course/types";
import { videoSource } from "@/lib/learn/media";
import { RichText } from "./rich-text";
import { TvPlayer } from "./tv-player";
import { AudioButton } from "./audio-button";
import { cn } from "cn";

/*
 * Lesson step page (owner spec §6 LessonView): the intro, Mael's video, an optional audio, then the
 * sections in order. Labels are French; the taught content is English (`lang="en"`).
 * `audio`: media id → playable URL (resolved by the page).
 */

function SectionTitle({ icon: Icon, children }: { icon: React.ComponentType<{ className?: string }>; children: React.ReactNode }) {
  return (
    <h2 className="flex items-center gap-2 font-heading text-lg font-extrabold text-brand-deep">
      <Icon className="size-5 text-primary" aria-hidden /> {children}
    </h2>
  );
}

function Section({ s, audio }: { s: LessonSection; audio: Record<string, string> }) {
  switch (s.type) {
    case "vocabulary":
      return (
        <section className="grid gap-3">
          <SectionTitle icon={BookA}>{SECTION_LABEL.vocabulary.learner}</SectionTitle>
          <ul className="grid gap-3 sm:grid-cols-2">
            {s.items.map((i) => (
              <li key={i.id} className="flex gap-3 rounded-2xl border-2 border-border bg-card p-4">
                <div className="min-w-0 flex-1">
                  <p lang="en" className="font-heading text-lg font-extrabold text-brand-deep">
                    {i.term}
                  </p>
                  {i.meaning && <p className="text-sm text-muted-foreground">{i.meaning}</p>}
                  {i.example && (
                    <p lang="en" className="mt-1.5 border-l-4 border-brand-soft pl-2 text-ink italic">
                      {i.example}
                    </p>
                  )}
                </div>
                {i.audioMediaId && audio[i.audioMediaId] && <AudioButton src={audio[i.audioMediaId]} label={`Listen to "${i.term}"`} />}
              </li>
            ))}
          </ul>
        </section>
      );
    case "grammar_rule": {
      const [head, ...rows] = s.table;
      return (
        <section className="grid gap-3 rounded-3xl border-2 border-border bg-card p-5 sm:p-6">
          <SectionTitle icon={Table2}>{SECTION_LABEL.grammar_rule.learner}</SectionTitle>
          {s.rule && (
            <p lang="en" className="rounded-2xl bg-brand-soft px-4 py-3 font-semibold text-brand-deep">
              {s.rule}
            </p>
          )}
          {head && (
            <div className="overflow-x-auto">
              <table lang="en" className="w-full min-w-max border-collapse text-sm">
                <thead>
                  <tr>
                    {head.map((c, k) => (
                      <th key={k} scope="col" className="border-b-2 border-border px-3 py-2 text-left font-bold text-brand-deep">
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, k) => (
                    <tr key={k} className="even:bg-muted/40">
                      {r.map((c, j) => (
                        <td key={j} className={cn("border-b border-border px-3 py-2", j === 0 && "font-semibold")}>
                          {c}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {s.examples.length > 0 && (
            <ul lang="en" className="grid gap-1.5">
              {s.examples.map((e, k) => (
                <li key={k} className="flex gap-2 text-ink">
                  <span className="font-bold text-primary" aria-hidden>
                    →
                  </span>
                  {e}
                </li>
              ))}
            </ul>
          )}
        </section>
      );
    }
    case "dialogue": {
      const speakers = [...new Set(s.lines.map((l) => l.speaker))];
      return (
        <section className="grid gap-3 rounded-3xl border-2 border-border bg-card p-5 sm:p-6">
          <SectionTitle icon={MessagesSquare}>{SECTION_LABEL.dialogue.learner}</SectionTitle>
          {s.audioMediaId && audio[s.audioMediaId] && <audio src={audio[s.audioMediaId]} controls preload="none" className="w-full" aria-label="Listen to the dialogue" />}
          <ol lang="en" className="grid gap-2">
            {s.lines.map((l) => {
              const right = speakers.indexOf(l.speaker) % 2 === 1;
              return (
                <li key={l.id} className={cn("max-w-[85%] rounded-2xl px-4 py-2.5", right ? "justify-self-end rounded-br-sm bg-primary text-white" : "rounded-bl-sm bg-muted text-ink")}>
                  {l.speaker && <span className={cn("block text-xs font-bold", right ? "text-white/80" : "text-primary")}>{l.speaker}</span>}
                  {l.text}
                </li>
              );
            })}
          </ol>
        </section>
      );
    }
    case "tip":
      return (
        <section className="flex gap-3 rounded-3xl border-2 border-primary/20 bg-brand-soft p-5">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-white" aria-hidden>
            <Lightbulb className="size-5" />
          </span>
          <div>
            <h2 className="font-heading font-extrabold text-brand-deep">{SECTION_LABEL.tip.learner}</h2>
            <p className="mt-1 text-ink">{s.text}</p>
          </div>
        </section>
      );
  }
}

export function LessonView({ title, content, audio }: { title: string; content: LessonContent; audio: Record<string, string> }) {
  const video = content.videoUrl ? videoSource(content.videoUrl) : null;
  return (
    <div className="grid gap-6">
      {content.intro.replace(/<[^>]*>/g, "").trim() && (
        <div className="rounded-3xl border-2 border-border bg-card p-5 sm:p-8">
          <RichText>{content.intro}</RichText>
        </div>
      )}
      {video && <TvPlayer source={video} title={title} />}
      {content.audioMediaId && audio[content.audioMediaId] && (
        <div className="grid gap-2 rounded-3xl border-2 border-border bg-card p-4">
          <p className="flex items-center gap-2 text-sm font-bold text-brand-deep">
            <Volume2 className="size-4 text-primary" aria-hidden /> Listen
          </p>
          <audio src={audio[content.audioMediaId]} controls preload="none" className="w-full" />
        </div>
      )}
      {content.sections.map((s) => (
        <Section key={s.id} s={s} audio={audio} />
      ))}
    </div>
  );
}

/** Every media id a lesson uses (to resolve their URLs). */
export function lessonMediaIds(c: LessonContent): string[] {
  const ids = [c.audioMediaId];
  for (const s of c.sections) {
    if (s.type === "vocabulary") ids.push(...s.items.map((i) => i.audioMediaId));
    if (s.type === "dialogue") ids.push(s.audioMediaId);
  }
  return [...new Set(ids.filter(Boolean))];
}
