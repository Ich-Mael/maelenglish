"use client";

import { useState } from "react";
import { AudioLines, ClipboardPaste, Loader2 } from "lucide-react";
import { generateModelAudioAction } from "@/app/admin/labo/actions";
import { TtsVoiceProvider, useTtsVoice, type TtsVoices } from "./tts-voice";
import { ItemListEditor, newItemId } from "./item-list-editor";
import { AudioField } from "@/components/admin/audio-field";
import { btn, inputCls } from "@/components/admin/ui";
import type { RepeatContent, RepeatPhrase } from "@/lib/lab/types";
import { cn } from "cn";

/*
 * S1 « Repeat after Coach Ish » editor (Labo, English): short phrases, each with the model audio
 * (required: record it in the browser, upload it, or generate it with an ElevenLabs voice) and an optional French translation; « Paste a
 * list » adds many at once (one per line, « = » before the translation). Sent as « c_json ».
 */

type Phrase = RepeatPhrase & { audioUrl: string | null };
const blank = (id = newItemId()): Phrase => ({ id, text: "", translation: "", audioMediaId: "", audioUrl: null });

export function RepeatEditor(props: { initial: Partial<RepeatContent>; audioUrls: Record<string, string | null>; tts?: TtsVoices }) {
  return (
    <TtsVoiceProvider tts={props.tts ?? null}>
      <RepeatFields {...props} />
    </TtsVoiceProvider>
  );
}

/** « Generate all missing »: every phrase written without audio, one after another. */
function GenerateMissing({ phrases, setAudio }: { phrases: Phrase[]; setAudio: (id: string, mediaId: string, url: string) => void }) {
  const tts = useTtsVoice();
  const [left, setLeft] = useState(0);
  const [error, setError] = useState("");
  const missing = phrases.filter((p) => p.text.trim() && !p.audioMediaId);
  if (!tts || (!missing.length && !left)) return null;
  return (
    <span className="grid gap-1">
      <button
        type="button"
        className={btn.secondary}
        disabled={left > 0}
        onClick={async () => {
          setError("");
          setLeft(missing.length);
          for (const p of missing) {
            const r = await generateModelAudioAction(p.text, tts.voiceId).catch(() => ({ ok: false as const, error: "Something went wrong: try again." }));
            if (!r.ok) {
              setError(r.error);
              break;
            }
            setAudio(p.id, r.mediaId, r.url);
            setLeft((n) => n - 1);
          }
          setLeft(0);
        }}
      >
        {left ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <AudioLines className="size-4" aria-hidden />} {left ? `Generating… ${left} left` : `Generate the ${missing.length} missing audio${missing.length > 1 ? "s" : ""}`}
      </button>
      {error && <span className="text-xs font-semibold text-coral-dark">{error}</span>}
    </span>
  );
}

function RepeatFields({ initial, audioUrls }: { initial: Partial<RepeatContent>; audioUrls: Record<string, string | null> }) {
  const [phrases, setPhrases] = useState<Phrase[]>(() => (initial.phrases?.length ? initial.phrases.map((p) => ({ ...p, audioUrl: p.audioMediaId ? (audioUrls[p.audioMediaId] ?? null) : null })) : [blank("r1")])); // fixed id: a random one differs between the server render and hydration
  const [paste, setPaste] = useState("");
  const [pasteOpen, setPasteOpen] = useState(false);
  const json = JSON.stringify({ phrases: phrases.map((p) => ({ id: p.id, text: p.text, translation: p.translation, audioMediaId: p.audioMediaId })) });
  const parsed = paste
    .split("\n")
    .map((l) => l.split(/ = |=|\t/))
    .filter((parts) => parts[0]?.trim())
    .map((parts) => ({ ...blank(), text: parts[0].trim(), translation: (parts[1] ?? "").trim() }));

  return (
    <section className="grid gap-4">
      <input type="hidden" name="c_json" value={json} />
      <div className="flex flex-wrap items-center gap-2">
        <p className="flex-1 text-xs text-muted-foreground">Short, useful phrases (3–12 words) said at natural speed. Learners repeat after your audio; the browser&apos;s speech recognition shows which words it understood.</p>
        <GenerateMissing phrases={phrases} setAudio={(id, mediaId, url) => setPhrases((cur) => cur.map((x) => (x.id === id ? { ...x, audioMediaId: mediaId, audioUrl: url } : x)))} />
        <button type="button" className={btn.secondary} onClick={() => setPasteOpen((o) => !o)}>
          <ClipboardPaste className="size-4" aria-hidden /> Paste a list
        </button>
      </div>
      {pasteOpen && (
        <div className="grid gap-2 rounded-2xl border border-primary/25 bg-brand-soft/50 p-3">
          <label className="grid gap-1 text-sm">
            <span className="font-medium">One phrase per line, optionally « = » and the French translation</span>
            <textarea lang="en" className={cn(inputCls, "h-auto py-2")} rows={5} value={paste} onChange={(e) => setPaste(e.target.value)} placeholder={"Good morning, how can I help you? = Bonjour, que puis-je pour vous ?\nCould you spell your name, please? = Pouvez-vous épeler votre nom ?"} />
          </label>
          <button
            type="button"
            className={cn(btn.primary, "w-fit")}
            disabled={!parsed.length}
            onClick={() => {
              setPhrases((cur) => [...cur.filter((p) => p.text.trim()), ...parsed].slice(0, 20));
              setPaste("");
              setPasteOpen(false);
            }}
          >
            Add {parsed.length || ""} phrase{parsed.length === 1 ? "" : "s"}
          </button>
          <span className="text-xs text-muted-foreground">Then record the audio of each phrase below, or generate it with an ElevenLabs voice. 20 phrases at most.</span>
        </div>
      )}
      <ItemListEditor
        items={phrases}
        onChange={setPhrases}
        blank={() => blank()}
        copy={(p) => ({ ...p, id: newItemId() })}
        addLabel="Add a phrase"
        noun="phrase"
        max={20}
        render={(p, update) => (
          <div className="grid gap-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1 text-sm">
                <span className="font-medium">Phrase (English)</span>
                <input lang="en" className={inputCls} value={p.text} maxLength={200} onChange={(e) => update({ text: e.target.value })} placeholder="Good morning, how can I help you?" />
              </label>
              <label className="grid gap-1 text-sm">
                <span className="font-medium">Translation (optional, French)</span>
                <input className={inputCls} value={p.translation} maxLength={200} onChange={(e) => update({ translation: e.target.value })} placeholder="Bonjour, que puis-je pour vous ?" />
              </label>
            </div>
            <AudioField label="Your audio (required: learners repeat after it)" value={p.audioMediaId} url={p.audioUrl} onChange={(id, url) => update({ audioMediaId: id, audioUrl: url })} speakText={p.text} compact />
          </div>
        )}
      />
    </section>
  );
}
