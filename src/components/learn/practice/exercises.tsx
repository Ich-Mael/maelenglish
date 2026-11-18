"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Mic, Play, Snail, Square, Volume2 } from "lucide-react";
import { seededShuffle, wordBank, type Exercise, type ExerciseResponse } from "@/lib/learn/exercises";
import { ListenButton, speak, useCanSpeak } from "@/components/site/speak";
import { cn } from "cn";

export type ExerciseProps = {
  exercise: Exercise;
  /** true once checked: inputs are frozen. */
  locked: boolean;
  onChange: (r: ExerciseResponse | null) => void;
  /** Enter in a text field. */
  onSubmit?: () => void;
};

const chip =
  "rounded-2xl border-2 border-border bg-card px-3.5 py-2 font-semibold text-ink shadow-[0_3px_0_0_var(--color-border)] transition active:translate-y-0.5 active:shadow-none disabled:cursor-default";

function Sentence({ text, translation }: { text?: string; translation?: string }) {
  if (!text) return null;
  return (
    <div className="flex items-start gap-3 rounded-3xl border-2 border-border bg-card p-4">
      <ListenButton text={text} />
      <div>
        <p lang="en" className="font-heading text-lg font-bold text-brand-deep">{text}</p>
        {translation && <p className="text-sm text-muted-foreground">{translation}</p>}
      </div>
    </div>
  );
}

// ── choice ─────────────────────────────────────────────────────────────────
export function ChoiceExercise({ exercise: ex, locked, onChange }: ExerciseProps) {
  const [picked, setPicked] = useState<string | null>(null);
  return (
    <div className="grid gap-5">
      <Sentence text={ex.text} translation={ex.translation} />
      <div className="grid gap-2.5" role="radiogroup">
        {(ex.options ?? []).map((o, i) => (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={picked === o.id}
            disabled={locked}
            onClick={() => {
              setPicked(o.id);
              onChange({ kind: "choice", optionId: o.id });
            }}
            className={cn(
              "flex items-center gap-3 rounded-2xl border-2 px-4 py-3.5 text-left font-medium transition",
              picked === o.id ? "border-primary bg-brand-soft text-brand-deep shadow-[0_3px_0_0_var(--color-primary)]" : "border-border bg-card shadow-[0_3px_0_0_var(--color-border)] hover:border-primary/40",
              !locked && "active:translate-y-0.5 active:shadow-none",
            )}
          >
            <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-lg border-2 text-xs font-bold", picked === o.id ? "border-primary text-primary" : "border-border text-muted-foreground")}>
              {String.fromCharCode(65 + i)}
            </span>
            {o.text}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── build: tap words ───────────────────────────────────────────────────────
export function BuildExercise({ exercise: ex, locked, onChange }: ExerciseProps) {
  const bank = useMemo(() => wordBank(ex), [ex]);
  const [chosen, setChosen] = useState<number[]>([]);
  const update = (next: number[]) => {
    setChosen(next);
    onChange(next.length ? { kind: "build", words: next.map((i) => bank[i]) } : null);
  };
  return (
    <div className="grid gap-6">
      {ex.translation && (
        <p className="rounded-3xl border-2 border-border bg-card p-4 text-lg font-semibold text-ink">« {ex.translation} »</p>
      )}
      <div className="flex min-h-28 flex-wrap content-start gap-2 border-b-2 border-border pb-4" aria-label="Votre phrase" aria-live="polite">
        {chosen.map((i) => (
          <button key={i} type="button" disabled={locked} onClick={() => update(chosen.filter((c) => c !== i))} className={cn(chip, "animate-pop")} lang="en">
            {bank[i]}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap justify-center gap-2" aria-label="Mots disponibles">
        {bank.map((w, i) => {
          const used = chosen.includes(i);
          return (
            <button
              key={i}
              type="button"
              disabled={locked || used}
              onClick={() => update([...chosen, i])}
              className={cn(chip, used && "border-transparent bg-muted text-transparent shadow-none")}
              aria-hidden={used}
              lang="en"
            >
              {w}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── order: drag & drop ─────────────────────────────────────────────────────
function SortableItem({ id, index, locked }: { id: string; index: number; locked: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, disabled: locked });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "flex touch-none items-center gap-3 rounded-2xl border-2 bg-card px-4 py-3.5 font-medium select-none",
        isDragging ? "z-10 border-primary shadow-xl" : "border-border shadow-[0_3px_0_0_var(--color-border)]",
        !locked && "cursor-grab active:cursor-grabbing",
      )}
      {...attributes}
      {...listeners}
      aria-roledescription="élément déplaçable"
    >
      <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-xs font-bold text-primary">{index + 1}</span>
      <span className="flex-1" lang="en">{id}</span>
      {!locked && <GripVertical className="size-5 text-muted-foreground" aria-hidden />}
    </li>
  );
}

export function OrderExercise({ exercise: ex, locked, onChange }: ExerciseProps) {
  const [items, setItems] = useState(() => seededShuffle(ex.items ?? [], ex.id));
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  // Any order is an answer: report the initial one so « Vérifier » is enabled.
  useEffect(() => {
    onChange({ kind: "order", items });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  function onDragEnd(e: DragEndEvent) {
    if (!e.over || e.active.id === e.over.id) return;
    const next = arrayMove(items, items.indexOf(String(e.active.id)), items.indexOf(String(e.over.id)));
    setItems(next);
    onChange({ kind: "order", items: next });
  }
  return (
    <div className="grid gap-3">
      <p className="text-sm text-muted-foreground">Faites glisser les éléments (ou utilisez Espace puis les flèches).</p>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={items} strategy={verticalListSortingStrategy}>
          <ol className="grid gap-2.5">
            {items.map((id, i) => (
              <SortableItem key={id} id={id} index={i} locked={locked} />
            ))}
          </ol>
        </SortableContext>
      </DndContext>
    </div>
  );
}

// ── match: tap pairs ───────────────────────────────────────────────────────
const PAIR_COLORS = ["bg-primary", "bg-coral", "bg-success", "bg-xp", "bg-brand-dark", "bg-coral-dark"];

export function MatchExercise({ exercise: ex, locked, onChange }: ExerciseProps) {
  const pairs = useMemo(() => ex.pairs ?? [], [ex.pairs]);
  const lefts = useMemo(() => pairs.map((p) => p.left), [pairs]);
  const rights = useMemo(() => seededShuffle(pairs.map((p) => p.right), ex.id), [pairs, ex.id]);
  const [links, setLinks] = useState<Record<string, string>>({});
  const [active, setActive] = useState<string | null>(null);

  const update = (next: Record<string, string>) => {
    setLinks(next);
    const done = Object.keys(next).length === pairs.length;
    onChange(done ? { kind: "match", pairs: Object.entries(next).map(([left, right]) => ({ left, right })) } : null);
  };
  const colorOf = (left: string) => PAIR_COLORS[lefts.indexOf(left) % PAIR_COLORS.length];
  const leftOfRight = (right: string) => Object.keys(links).find((l) => links[l] === right);

  function tapLeft(l: string) {
    if (links[l]) {
      const next = { ...links };
      delete next[l];
      update(next);
      setActive(l);
      return;
    }
    setActive(active === l ? null : l);
  }
  function tapRight(r: string) {
    if (!active) {
      const l = leftOfRight(r);
      if (l) {
        const next = { ...links };
        delete next[l];
        update(next);
      }
      return;
    }
    const next = { ...links };
    const previous = leftOfRight(r);
    if (previous) delete next[previous];
    next[active] = r;
    update(next);
    setActive(null);
  }

  const cell = "flex min-h-14 w-full items-center gap-2 rounded-2xl border-2 px-3 py-2.5 text-left font-medium transition";
  return (
    <div className="grid gap-3">
      <p className="text-sm text-muted-foreground">Touchez un mot à gauche, puis sa traduction à droite.</p>
      <div className="grid grid-cols-2 gap-2.5">
        <ul className="grid gap-2.5">
          {lefts.map((l) => (
            <li key={l}>
              <button type="button" disabled={locked} onClick={() => tapLeft(l)} aria-pressed={active === l} lang="en"
                className={cn(cell, active === l ? "border-primary bg-brand-soft" : links[l] ? "border-border bg-card" : "border-border bg-card shadow-[0_3px_0_0_var(--color-border)]")}>
                {links[l] && <span className={cn("size-3 shrink-0 rounded-full", colorOf(l))} aria-hidden />}
                {l}
              </button>
            </li>
          ))}
        </ul>
        <ul className="grid gap-2.5">
          {rights.map((r) => {
            const l = leftOfRight(r);
            return (
              <li key={r}>
                <button type="button" disabled={locked} onClick={() => tapRight(r)} aria-label={l ? `${r} (associé à ${l})` : r}
                  className={cn(cell, l ? "border-border bg-card" : "border-border bg-card shadow-[0_3px_0_0_var(--color-border)]", active && !l && "border-primary/40")}>
                  {l && <span className={cn("size-3 shrink-0 rounded-full", colorOf(l))} aria-hidden />}
                  {r}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

// ── listen: dictation ──────────────────────────────────────────────────────
function useAudio(ex: Exercise) {
  const audio = useRef<HTMLAudioElement | null>(null);
  const canSpeak = useCanSpeak();
  return {
    available: !!ex.audioUrl || canSpeak,
    play(slow = false) {
      if (ex.audioUrl) {
        audio.current ??= new Audio(ex.audioUrl);
        audio.current.playbackRate = slow ? 0.7 : 1;
        audio.current.currentTime = 0;
        void audio.current.play();
      } else if (ex.text) {
        speakAt(ex.text, slow ? 0.6 : 0.92);
      }
    },
  };
}

function speakAt(text: string, rate: number) {
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "en-US";
  u.rate = rate;
  const voice = window.speechSynthesis.getVoices().find((v) => v.lang.startsWith("en"));
  if (voice) u.voice = voice;
  window.speechSynthesis.speak(u);
}

export function ListenExercise({ exercise: ex, locked, onChange, onSubmit }: ExerciseProps) {
  const audio = useAudio(ex);
  const [value, setValue] = useState("");
  return (
    <div className="grid gap-5">
      {audio.available ? (
        <div className="flex items-center justify-center gap-4">
          <button type="button" onClick={() => audio.play()} className="flex size-24 items-center justify-center rounded-3xl bg-primary text-white shadow-[0_6px_0_0_var(--color-brand-dark)] transition active:translate-y-1 active:shadow-[0_2px_0_0_var(--color-brand-dark)]" aria-label="Écouter">
            <Volume2 className="size-11" aria-hidden />
          </button>
          <button type="button" onClick={() => audio.play(true)} className="flex size-16 items-center justify-center rounded-2xl bg-brand-soft text-primary transition active:translate-y-0.5" aria-label="Écouter lentement">
            <Snail className="size-7" aria-hidden />
          </button>
        </div>
      ) : (
        <p className="rounded-2xl bg-muted p-4 text-sm text-muted-foreground">Votre navigateur ne peut pas lire le son. Phrase : <span lang="en" className="font-semibold">{ex.text}</span></p>
      )}
      <textarea
        value={value}
        disabled={locked}
        onChange={(e) => {
          setValue(e.target.value);
          onChange(e.target.value.trim() ? { kind: "listen", text: e.target.value } : null);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            onSubmit?.();
          }
        }}
        rows={3}
        lang="en"
        autoCapitalize="sentences"
        spellCheck={false}
        placeholder="Écrivez en anglais…"
        aria-label="Ce que vous entendez"
        className="w-full resize-none rounded-2xl border-2 border-border bg-card p-4 text-lg outline-none focus:border-primary"
      />
    </div>
  );
}

// ── gap: fill in ───────────────────────────────────────────────────────────
export function GapExercise({ exercise: ex, locked, onChange, onSubmit }: ExerciseProps) {
  const [before, after] = (ex.text ?? "").split("___");
  const [value, setValue] = useState("");
  return (
    <div className="grid gap-4">
      <div className="flex items-start gap-3 rounded-3xl border-2 border-border bg-card p-5">
        {ex.text && <ListenButton text={ex.text.replace("___", ex.answers?.[0] ?? "")} />}
        <p lang="en" className="flex-1 font-heading text-xl leading-loose font-bold text-brand-deep">
          {before}
          <input
            value={value}
            disabled={locked}
            onChange={(e) => {
              setValue(e.target.value);
              onChange(e.target.value.trim() ? { kind: "gap", text: e.target.value } : null);
            }}
            onKeyDown={(e) => e.key === "Enter" && onSubmit?.()}
            aria-label="Mot manquant"
            autoCapitalize="none"
            autoComplete="off"
            spellCheck={false}
            size={Math.max(6, value.length + 1)}
            className="mx-1 inline-block border-b-4 border-primary bg-brand-soft/60 px-2 text-center text-primary outline-none focus:bg-brand-soft"
          />
          {after}
        </p>
      </div>
      {ex.translation && <p className="text-sm text-muted-foreground">{ex.translation}</p>}
    </div>
  );
}

// ── speak: record + recognise ──────────────────────────────────────────────
type Recognition = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
};
type RecognitionCtor = new () => Recognition;

function recognitionCtor(): RecognitionCtor | null {
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function SpeakExercise({ exercise: ex, locked, onChange }: ExerciseProps) {
  const [recording, setRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [canRecognise, setCanRecognise] = useState(false);
  const recorder = useRef<MediaRecorder | null>(null);
  const recognition = useRef<Recognition | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- browser capability, known only after mount
    setCanRecognise(!!recognitionCtor());
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function start() {
    setError(null);
    setTranscript(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const chunks: Blob[] = [];
      const rec = new MediaRecorder(stream);
      rec.ondataavailable = (e) => chunks.push(e.data);
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const url = URL.createObjectURL(new Blob(chunks, { type: rec.mimeType }));
        setAudioUrl((old) => {
          if (old) URL.revokeObjectURL(old);
          return url;
        });
      };
      rec.start();
      recorder.current = rec;

      const Ctor = recognitionCtor();
      if (Ctor) {
        const r = new Ctor();
        r.lang = "en-US";
        r.interimResults = false;
        r.maxAlternatives = 1;
        r.onresult = (e) => {
          const text = Array.from(e.results).map((res) => res[0]?.transcript ?? "").join(" ").trim();
          setTranscript(text);
          if (text) onChange({ kind: "speak", transcript: text });
        };
        r.onerror = (e) => {
          if (e.error === "no-speech") setError("Nous n'avons rien entendu. Réessayez en parlant près du micro.");
        };
        r.start();
        recognition.current = r;
      }
      setRecording(true);
    } catch {
      setError("Le micro n'est pas accessible. Autorisez-le dans votre navigateur, ou passez l'exercice.");
    }
  }

  function stop() {
    recorder.current?.stop();
    recognition.current?.stop();
    setRecording(false);
  }

  return (
    <div className="grid gap-5">
      <Sentence text={ex.text} translation={ex.translation} />
      <div className="flex flex-col items-center gap-3">
        <button
          type="button"
          disabled={locked}
          onClick={recording ? stop : start}
          className={cn(
            "relative flex size-24 items-center justify-center rounded-full text-white transition active:translate-y-1",
            recording ? "bg-destructive" : "bg-coral shadow-[0_6px_0_0_var(--color-coral-dark)]",
          )}
          aria-label={recording ? "Arrêter l'enregistrement" : "Parler"}
        >
          {recording && <span className="absolute inset-0 animate-ping rounded-full bg-destructive/40 motion-reduce:animate-none" aria-hidden />}
          {recording ? <Square className="size-9" aria-hidden /> : <Mic className="size-10" aria-hidden />}
        </button>
        <p className="text-sm font-semibold text-muted-foreground" aria-live="polite">
          {recording ? "Je vous écoute… touchez pour arrêter." : audioUrl ? "Réécoutez-vous, ou recommencez." : "Touchez le micro et lisez la phrase."}
        </p>
        {audioUrl && !recording && (
          <button type="button" onClick={() => void new Audio(audioUrl).play()} className="inline-flex items-center gap-2 rounded-2xl bg-brand-soft px-4 py-2 font-semibold text-primary">
            <Play className="size-4" aria-hidden /> Ma voix
          </button>
        )}
        {transcript && (
          <p className="text-center text-sm">
            Nous avons entendu : <span lang="en" className="font-semibold">« {transcript} »</span>
          </p>
        )}
        {error && <p className="text-center text-sm text-destructive">{error}</p>}
      </div>
      {audioUrl && !recording && !canRecognise && !locked && (
        <div className="grid gap-2 sm:grid-cols-2">
          <button type="button" onClick={() => onChange({ kind: "speak", selfCheck: true })} className={chip}>
            Je l&apos;ai bien dit
          </button>
          <button type="button" onClick={() => speak(ex.text ?? "")} className={chip}>
            Comparer avec le modèle
          </button>
        </div>
      )}
      {!locked && !recording && (
        <button type="button" onClick={() => onChange({ kind: "speak", selfCheck: false })} className="mx-auto text-sm font-semibold text-muted-foreground underline-offset-4 hover:underline">
          Je ne peux pas parler maintenant · Passer
        </button>
      )}
    </div>
  );
}

export const EXERCISE_COMPONENTS = {
  choice: ChoiceExercise,
  build: BuildExercise,
  order: OrderExercise,
  match: MatchExercise,
  listen: ListenExercise,
  speak: SpeakExercise,
  gap: GapExercise,
} satisfies Record<Exercise["kind"], React.ComponentType<ExerciseProps>>;
