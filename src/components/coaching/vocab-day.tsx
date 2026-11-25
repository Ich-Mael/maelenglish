import { CheckCircle2, MessageSquareQuote, Sparkles } from "lucide-react";
import type { CoachingVocabDoc } from "@/models";
import { SENTENCES_PER_ITEM, type SharedSentence } from "@/lib/coaching/vocabulary";
import { Avatar } from "@/components/account/avatar";
import { DeleteSentence, EditItem, SentenceForm } from "./vocab-forms";
import { AccentSwitch, Listen, ShadowingModal } from "@/components/shadowing/listen";
import { ListenPair, ShadowList } from "@/components/shadowing/list";
import { Shadowing } from "@/components/shadowing/shadowing";
import { SHADOW_GOAL, coachingAudioSrc } from "@/lib/shadowing";
import { cn } from "cn";

/*
 * One day of a coaching's vocabulary: each expression (hear it — normal / slow, US / UK —,
 * translation, note, example read aloud), then one of the group's sentences (the viewer's latest
 * when they wrote one, so they see their correction, else the first) with « Practice Shadowing with Examples »
 * opening every sentence in a modal (bigger text, with shadowing practice on each corrected sentence), then the viewer's box while they still owe sentences.
 * Server component (no hooks).
 */
export function VocabDay({ vocab, sentences, viewerId, coach, coachingId, compact }: { vocab: CoachingVocabDoc; sentences: SharedSentence[]; viewerId: string; coach: boolean; coachingId: string; compact?: boolean }) {
  const vocabId = String(vocab._id);
  return (
    <ol className={cn("grid gap-4", !compact && "lg:grid-cols-3")}>
      {vocab.items.map((item, n) => {
        const list = sentences.filter((s) => s.vocabId === vocabId && s.itemId === item.id);
        const own = list.filter((s) => s.userId === viewerId);
        const left = SENTENCES_PER_ITEM - own.length;
        const preview = own.at(-1) ?? list[0];
        const target = { coachingId, vocabId, itemId: item.id };
        const row = (s: SharedSentence, big = false) => <SentenceRow key={s.id} s={s} viewerId={viewerId} coach={coach} coachingId={coachingId} target={target} big={big} />;
        return (
          <li key={item.id} className="grid content-start gap-3 overflow-hidden rounded-3xl border-2 border-border bg-card">
            <div className="grid gap-1.5 bg-gradient-to-br from-brand-deep to-primary p-4 text-white">
              <p className="flex items-center justify-between gap-2 text-xs font-bold tracking-wide text-white/75 uppercase">
                <span>Expression {n + 1}</span>
                {!coach && (
                  <span className={cn("rounded-full px-2 py-0.5 normal-case", left <= 0 ? "bg-white text-primary" : "bg-white/15 text-white")}>
                    {left <= 0 ? "✓ Done" : `${own.length} / ${SENTENCES_PER_ITEM}`}
                  </span>
                )}
              </p>
              <p lang="en" className="font-heading text-2xl leading-tight font-extrabold">
                {item.text}
              </p>
              {item.translation && (
                <p lang="fr" className="font-semibold text-white/90">
                  {item.translation}
                </p>
              )}
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <Listen src={coachingAudioSrc({ ...target, what: "text" })} text={item.text} label={`Hear « ${item.text} »`} tone="dark" className="size-10" iconClass="size-5" />
                <Listen src={coachingAudioSrc({ ...target, what: "text" })} text={item.text} slow label={`Hear « ${item.text} » slowly`} tone="dark" className="size-10" iconClass="size-5" />
                <span className="ml-auto">
                  <AccentSwitch tone="dark" />
                </span>
              </div>
            </div>
            <div className="grid gap-3 px-4">
              {item.frNote && (
                <p lang="fr" className="text-sm text-muted-foreground">
                  {item.frNote}
                </p>
              )}
              {item.example && (
                <div className="flex items-start gap-2 rounded-2xl bg-brand-soft/60 p-3 text-sm">
                  <Listen src={coachingAudioSrc({ ...target, what: "example" })} text={item.example} label="Hear the example" className="-ml-1 size-8 bg-white" />
                  <div className="min-w-0 flex-1">
                    <p lang="en" className="font-semibold text-brand-deep">
                      <Sparkles className="mr-1 inline size-3.5 text-primary" aria-hidden />
                      {item.example}
                    </p>
                    {item.exampleFr && (
                      <p lang="fr" className="mt-0.5 text-muted-foreground">
                        {item.exampleFr}
                      </p>
                    )}
                  </div>
                </div>
              )}
              {coach && <EditItem coachingId={coachingId} vocabId={vocabId} item={item} />}
            </div>
            <div className="grid gap-2 border-t border-border px-4 pt-3 pb-4">
              <p className="flex items-center gap-1.5 text-xs font-bold tracking-wide text-muted-foreground uppercase">
                <MessageSquareQuote className="size-4 text-primary" aria-hidden /> The group&apos;s sentences ({list.length})
              </p>
              {preview ? <ul className="grid gap-2">{row(preview)}</ul> : <p className="text-sm text-muted-foreground">No sentence yet.{!coach ? " Be the first!" : ""}</p>}
              {/* Shadowing: the expression's example first, then the group's sentences (corrected). */}
              {(item.example || list.length > 0) && (
                <ShadowingModal title={item.text} count={list.length + (item.example ? 1 : 0)} kicker="Examples" intro={`Listen to the example and the group's sentences (corrected), then say them the same way: reach ${SHADOW_GOAL}% to master them.`}>
                  <div className="grid gap-3">
                    {item.example && <ShadowList items={[{ id: "example", label: "Example", text: item.example, fr: item.exampleFr, src: coachingAudioSrc({ ...target, what: "example" }) }]} />}
                    {list.length > 0 && (
                      <>
                        <p className="mt-2 text-sm font-bold tracking-wide text-muted-foreground uppercase">The group&apos;s sentences ({list.length})</p>
                        <ul className="grid gap-3">{list.map((s) => row(s, true))}</ul>
                      </>
                    )}
                  </div>
                </ShadowingModal>
              )}
              {!coach && left > 0 && <SentenceForm coachingId={coachingId} vocabId={vocabId} itemId={item.id} text={item.text} left={left} />}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function SentenceRow({ s, viewerId, coach, coachingId, target, big }: { s: SharedSentence; viewerId: string; coach: boolean; coachingId: string; target: { coachingId: string; vocabId: string; itemId: string }; big?: boolean }) {
  const mine = s.userId === viewerId;
  const spoken = s.ok === false && s.corrected ? s.corrected : s.text;
  return (
    <li className={cn("flex rounded-2xl", big ? "gap-3 p-3 sm:p-4" : "gap-2 p-2.5", mine ? "bg-primary/8" : "bg-muted/60")}>
      {!big && <Avatar src={s.avatarUrl} name={s.firstName} className="size-7 text-xs" />}
      <div className={cn("min-w-0 flex-1", big ? "text-base" : "text-sm")}>
        <p className={cn("flex items-center justify-between gap-1 font-bold text-brand-deep", big ? "mb-1 text-base" : "text-xs")}>
          {big ? (
            <span className="flex items-center gap-2">
              <Avatar src={s.avatarUrl} name={s.firstName} className="size-9 text-sm" />
              {mine ? "You" : s.firstName}
            </span>
          ) : mine ? (
            "You"
          ) : (
            s.firstName
          )}
          <span className="flex items-center gap-0.5">
            <Listen src={coachingAudioSrc({ ...target, what: "sentence", sentenceId: s.id })} text={spoken} label={s.ok === false ? "Hear the corrected sentence" : "Hear the sentence"} className={big ? "size-11 bg-white" : "size-7"} iconClass={big ? "size-5" : "size-3.5"} />
            {(mine || coach) && <DeleteSentence coachingId={coachingId} id={s.id} />}
          </span>
        </p>
        <p lang="en" className={cn("text-ink", big && "text-lg leading-relaxed sm:text-xl")}>
          {s.text}
        </p>
        {s.ok === true && (
          <p className={cn("mt-1 flex items-center gap-1 font-semibold text-primary", big ? "text-base" : "text-xs")}>
            <CheckCircle2 className="size-3.5" aria-hidden /> Correct{s.explanation ? ` · ${s.explanation}` : ""}
          </p>
        )}
        {s.ok === false && (
          <div className={cn("mt-1 rounded-xl border border-coral/40 bg-white", big ? "mt-2 p-3 text-base" : "p-2 text-xs")}>
            <p lang="en" className={cn("font-semibold text-brand-deep", big && "text-lg sm:text-xl")}>
              → {s.corrected}
            </p>
            {s.explanation && (
              <p lang="fr" className="text-muted-foreground">
                {s.explanation}
              </p>
            )}
          </div>
        )}
        {big && (
          <Shadowing text={spoken} listen={<ListenPair src={coachingAudioSrc({ ...target, what: "sentence", sentenceId: s.id })} text={spoken} />} />
        )}
      </div>
    </li>
  );
}
