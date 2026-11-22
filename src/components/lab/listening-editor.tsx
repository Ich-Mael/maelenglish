"use client";

import { useRef, useState } from "react";
import { Crosshair, Play, X } from "lucide-react";
import { ItemListEditor, newItemId } from "./item-list-editor";
import { ClipField, type Clip } from "./clip-field";
import { btn, inputCls } from "@/components/admin/ui";
import { formatTime, parseTime, type ListeningContent, type ListeningQuestion } from "@/lib/lab/types";
import { cn } from "cn";

/*
 * Listening comprehension editor (Labo): the audio (upload a file or record in the browser —
 * stored as a « clip »), multiple-choice questions with the moment in the audio where each answer
 * is heard (replayed to the learner at correction), the transcript and the play limit.
 * Everything but the rich context is sent as JSON in « c_json » (cleaned on the server).
 */

type Q = Omit<ListeningQuestion, "startS"> & { start: string };

const letter = (k: number) => String.fromCharCode(97 + k);
const blankQuestion = (id = newItemId()): Q => ({
  id,
  text: "",
  options: [0, 1, 2].map((k) => ({ id: letter(k), text: "" })),
  correctOptionId: "",
  explanation: "",
  start: "",
});

function Field({ label, hint, children, className }: { label: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={cn("grid content-start gap-1 text-sm", className)}>
      <span className="font-medium">{label}</span>
      {children}
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </label>
  );
}

export function ListeningEditor({ initial, audioUrl: initialUrl }: { initial: Partial<ListeningContent>; audioUrl: string | null }) {
  const audio = useRef<HTMLAudioElement>(null);
  const [clip, setClip] = useState<Clip>({ id: initial.audioMediaId ?? "", durationS: initial.audioDurationS ?? 0, url: initialUrl });
  const audioUrl = clip.url;
  const [maxPlays, setMaxPlays] = useState(initial.maxPlays ?? 0);
  const [transcript, setTranscript] = useState(initial.transcript ?? "");
  const [questions, setQuestions] = useState<Q[]>(() =>
    initial.questions?.length ? initial.questions.map((q) => ({ ...q, start: q.startS === null ? "" : formatTime(q.startS) })) : [blankQuestion("q1")], // fixed id: a random one differs between the server render and hydration
  );

  const json = JSON.stringify({
    audioMediaId: clip.id,
    audioDurationS: clip.durationS,
    maxPlays,
    transcript,
    questions: questions.map(({ start, ...q }) => ({ ...q, startS: parseTime(start) })),
  });

  const playFrom = (t: number | null) => {
    const a = audio.current;
    if (!a || t === null) return;
    a.currentTime = t;
    void a.play();
  };

  return (
    <div className="grid gap-5">
      <input type="hidden" name="c_json" value={json} />

      <ClipField clip={clip} onChange={setClip} maxPlays={maxPlays} onMaxPlays={setMaxPlays} audioRef={audio} />

      <section className="grid gap-3">
        <h3 className="font-heading font-extrabold text-brand-deep">Questions ({questions.length})</h3>
        <p className="-mt-2 text-sm text-muted-foreground">One question per screen for the learner. Questions and answers in English (workplace content); the explanation in French.</p>
        <ItemListEditor
          items={questions}
          onChange={setQuestions}
          blank={blankQuestion}
          copy={(q) => ({ ...q, id: newItemId() })}
          noun="question"
          addLabel="Add a question"
          max={20}
          render={(q, up, i) => (
            <>
              <input className={inputCls} value={q.text} onChange={(e) => up({ text: e.target.value })} placeholder="E.g. Why is the shipment late?" aria-label={`Question ${i + 1}`} />
            <fieldset className="grid gap-2">
              <legend className="mb-1 text-xs font-medium text-muted-foreground">Answers: tick the correct one</legend>
              {q.options.map((o, k) => (
                <div key={o.id} className="flex items-center gap-2">
                  <input type="radio" name={`correct-${q.id}`} checked={q.correctOptionId === o.id} onChange={() => up({ correctOptionId: o.id })} className="size-4 accent-success" aria-label={`Correct answer: ${o.text || `answer ${k + 1}`}`} />
                  <input
                    className={inputCls}
                    value={o.text}
                    onChange={(e) => up({ options: q.options.map((x) => (x.id === o.id ? { ...x, text: e.target.value } : x)) })}
                    placeholder={`Answer ${k + 1}`}
                    aria-label={`Answer ${k + 1}`}
                  />
                  <button
                    type="button"
                    className={btn.icon}
                    disabled={q.options.length <= 2}
                    onClick={() => up({ options: q.options.filter((x) => x.id !== o.id), correctOptionId: q.correctOptionId === o.id ? "" : q.correctOptionId })}
                    aria-label="Delete answer"
                  >
                    <X className="size-4" aria-hidden />
                  </button>
                </div>
              ))}
              {q.options.length < 4 && (
                <button
                  type="button"
                  className="w-fit text-sm font-semibold text-primary"
                  onClick={() => {
                    const used = new Set(q.options.map((x) => x.id));
                    const id = [0, 1, 2, 3, 4, 5].map(letter).find((l) => !used.has(l))!;
                    up({ options: [...q.options, { id, text: "" }] });
                  }}
                >
                  + Add an answer
                </button>
              )}
            </fieldset>

            <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
              <Field label="Explanation at correction (optional)">
                <input className={inputCls} value={q.explanation} onChange={(e) => up({ explanation: e.target.value })} placeholder="E.g. On entend « now boarding at gate twelve »." />
              </Field>
              <Field label="Answer moment" hint="Replayed at correction.">
                <span className="flex items-center gap-1">
                  <input className={cn(inputCls, "w-20")} value={q.start} onChange={(e) => up({ start: e.target.value })} placeholder="0:42" aria-label="Answer moment (minutes:seconds)" />
                  <button type="button" className={btn.icon} disabled={!audioUrl} onClick={() => audio.current && up({ start: formatTime(audio.current.currentTime) })} title="Use the player's position" aria-label="Use the player's position">
                    <Crosshair className="size-4" aria-hidden />
                  </button>
                  <button type="button" className={btn.icon} disabled={!audioUrl || parseTime(q.start) === null} onClick={() => playFrom(parseTime(q.start))} title="Play from this moment" aria-label="Play from this moment">
                    <Play className="size-4" aria-hidden />
                  </button>
                </span>
              </Field>
            </div>
            {q.start && parseTime(q.start) === null && <p className="text-xs font-semibold text-coral-dark">Invalid moment: write minutes:seconds, e.g. 1:05.</p>}
            </>
          )}
        />
      </section>

      <Field label="Transcript (optional)" hint="One line per sentence. Start a line with its time, e.g. « [0:12] We are now boarding at gate 12. », to show that line in the feedback of the question whose answer moment falls in it. The full transcript is shown on the results screen.">
        <textarea className={cn(inputCls, "h-auto min-h-32 py-2 leading-relaxed")} lang="en" value={transcript} onChange={(e) => setTranscript(e.target.value)} placeholder={"[0:00] Good morning ladies and gentlemen.\n[0:03] Flight AF 512 to Paris is now boarding at gate 12."} />
      </Field>
    </div>
  );
}
