"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Copy, Eye, Plus, Trash2 } from "lucide-react";
import { EXERCISE_KINDS, DEFAULT_PROMPTS, exerciseProblem, type Exercise, type ExerciseKind } from "@/lib/learn/exercises";
import { RichTextEditor } from "./rich-text-editor";
import { AdminForm, Submit } from "./forms";
import { btn, inputCls } from "./ui";
import { saveLessonAction } from "@/app/admin/actions";
import { cn } from "cn";

const KIND_LABELS: Record<ExerciseKind, string> = {
  choice: "QCM",
  build: "Construire la phrase",
  order: "Remettre dans l'ordre",
  match: "Associer les paires",
  listen: "Dictée",
  speak: "Prononciation",
  gap: "Texte à trou",
};

/** Editable form of an exercise: list fields as plain text (one per line / « gauche = droite »). */
type Draft = {
  key: string;
  _id?: string;
  kind: ExerciseKind;
  prompt: string;
  text: string;
  translation: string;
  explanation: string;
  audioUrl: string;
  options: { id: string; text: string }[];
  correctOptionId: string;
  distractors: string;
  items: string;
  pairs: string;
  answers: string;
};

const rid = () => Math.random().toString(36).slice(2, 8);
const lines = (s: string) => s.split("\n").map((x) => x.trim()).filter(Boolean);

function toDraft(e: Partial<Exercise> & { _id?: string }): Draft {
  const a = rid();
  return {
    key: e._id ?? rid(),
    _id: e._id,
    kind: (e.kind ?? "choice") as ExerciseKind,
    prompt: e.prompt ?? "",
    text: e.text ?? "",
    translation: e.translation ?? "",
    explanation: e.explanation ?? "",
    audioUrl: e.audioUrl ?? "",
    options: e.options?.length ? e.options : [{ id: a, text: "" }, { id: rid(), text: "" }],
    correctOptionId: e.correctOptionId ?? e.options?.[0]?.id ?? a,
    distractors: (e.distractors ?? []).join(", "),
    items: (e.items ?? []).join("\n"),
    pairs: (e.pairs ?? []).map((p) => `${p.left} = ${p.right}`).join("\n"),
    answers: (e.answers ?? []).join("\n"),
  };
}

function fromDraft(d: Draft): Partial<Exercise> & { _id?: string } {
  const base = { ...(d._id ? { _id: d._id } : {}), kind: d.kind, prompt: d.prompt.trim(), explanation: d.explanation.trim() };
  switch (d.kind) {
    case "choice":
      return { ...base, text: d.text.trim(), translation: d.translation.trim(), options: d.options.filter((o) => o.text.trim()), correctOptionId: d.correctOptionId };
    case "build":
      return { ...base, text: d.text.trim(), translation: d.translation.trim(), distractors: d.distractors.split(",").map((x) => x.trim()).filter(Boolean) };
    case "order":
      return { ...base, items: lines(d.items) };
    case "match":
      return {
        ...base,
        pairs: lines(d.pairs).map((l) => {
          const [left, ...rest] = l.split("=");
          return { left: left.trim(), right: rest.join("=").trim() };
        }),
      };
    case "listen":
      return { ...base, text: d.text.trim(), answers: lines(d.answers), audioUrl: d.audioUrl.trim() };
    case "speak":
      return { ...base, text: d.text.trim(), translation: d.translation.trim() };
    case "gap":
      return { ...base, text: d.text.trim(), translation: d.translation.trim(), answers: lines(d.answers) };
  }
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1 text-sm">
      <span className="font-medium">{label}</span>
      {children}
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </label>
  );
}

function ExerciseFields({ d, set }: { d: Draft; set: (p: Partial<Draft>) => void }) {
  const text = (label: string, hint?: string) => (
    <Field label={label} hint={hint}>
      <input className={inputCls} value={d.text} onChange={(e) => set({ text: e.target.value })} lang="en" />
    </Field>
  );
  const translation = (
    <Field label="Traduction (facultatif)">
      <input className={inputCls} value={d.translation} onChange={(e) => set({ translation: e.target.value })} />
    </Field>
  );
  const area = (k: "items" | "pairs" | "answers", label: string, hint: string) => (
    <Field label={label} hint={hint}>
      <textarea className={cn(inputCls, "h-auto min-h-24 py-2")} value={d[k]} onChange={(e) => set({ [k]: e.target.value } as Partial<Draft>)} />
    </Field>
  );
  switch (d.kind) {
    case "choice":
      return (
        <>
          {text("Phrase ou question", "Ex. « Welcome on board! » avec la consigne « Que signifie cette phrase ? »")}
          <fieldset className="grid gap-2">
            <legend className="mb-1 text-sm font-medium">Réponses — cochez la bonne</legend>
            {d.options.map((o, k) => (
              <div key={o.id} className="flex items-center gap-2">
                <input type="radio" checked={d.correctOptionId === o.id} onChange={() => set({ correctOptionId: o.id })} className="size-4 accent-success" aria-label={`Bonne réponse ${k + 1}`} />
                <input className={inputCls} value={o.text} onChange={(e) => set({ options: d.options.map((x) => (x.id === o.id ? { ...x, text: e.target.value } : x)) })} placeholder={`Réponse ${String.fromCharCode(65 + k)}`} />
                <button type="button" className={btn.icon} disabled={d.options.length <= 2} onClick={() => set({ options: d.options.filter((x) => x.id !== o.id) })} aria-label="Retirer">
                  <Trash2 className="size-4" aria-hidden />
                </button>
              </div>
            ))}
            {d.options.length < 6 && (
              <button type="button" className="w-fit text-sm font-semibold text-primary hover:underline" onClick={() => set({ options: [...d.options, { id: rid(), text: "" }] })}>
                + Ajouter une réponse
              </button>
            )}
          </fieldset>
        </>
      );
    case "build":
      return (
        <>
          {text("Phrase à construire (anglais)", "Les mots sont mélangés automatiquement.")}
          {translation}
          <Field label="Mots pièges (facultatif)" hint="Séparés par des virgules, ex. : the, close">
            <input className={inputCls} value={d.distractors} onChange={(e) => set({ distractors: e.target.value })} lang="en" />
          </Field>
        </>
      );
    case "order":
      return area("items", "Éléments dans le BON ordre", "Un par ligne — ils sont mélangés pour l'apprenant.");
    case "match":
      return area("pairs", "Paires", "Une paire par ligne : pilot = pilote");
    case "listen":
      return (
        <>
          {text("Phrase dictée (anglais)", "Lue par la synthèse vocale du téléphone, ou par l'audio ci-dessous.")}
          {area("answers", "Autres écritures acceptées (facultatif)", "Une par ligne, ex. « I do not know » pour « I don't know ».")}
          <Field label="Fichier audio (lien, facultatif)">
            <input className={inputCls} type="url" value={d.audioUrl} onChange={(e) => set({ audioUrl: e.target.value })} />
          </Field>
        </>
      );
    case "speak":
      return (
        <>
          {text("Phrase à prononcer (anglais)")}
          {translation}
        </>
      );
    case "gap":
      return (
        <>
          {text("Phrase avec ___", "Écrivez ___ (trois tirets bas) à la place du mot manquant.")}
          {area("answers", "Réponses acceptées", "Une par ligne.")}
          {translation}
        </>
      );
  }
}

type LessonData = {
  id: string;
  type: "video" | "text" | "pdf" | "practice";
  title: string;
  description: string;
  isPublished: boolean;
  videoUrl: string;
  durationMinutes: number;
  content: string;
  fileUrl: string;
  fileName: string;
  exercises: (Partial<Exercise> & { _id?: string })[];
};

export function LessonEditor({ lesson, previewHref }: { lesson: LessonData; previewHref: string }) {
  const [drafts, setDrafts] = useState<Draft[]>(() => lesson.exercises.map(toDraft));
  const exercises = drafts.map(fromDraft);
  const problems = exercises.map((e) => exerciseProblem(e as Exercise));

  const update = (i: number, p: Partial<Draft>) => setDrafts((ds) => ds.map((d, k) => (k === i ? { ...d, ...p } : d)));
  const move = (i: number, dir: -1 | 1) =>
    setDrafts((ds) => {
      const list = [...ds];
      const j = i + dir;
      if (j < 0 || j >= list.length) return ds;
      [list[i], list[j]] = [list[j], list[i]];
      return list;
    });

  return (
    <AdminForm action={saveLessonAction}>
      <input type="hidden" name="lessonId" value={lesson.id} />
      {lesson.type === "practice" && <input type="hidden" name="exercises" value={JSON.stringify(exercises)} />}

      <div className="grid gap-4 rounded-2xl border border-border bg-card p-5">
        <Field label="Titre">
          <input name="title" className={inputCls} defaultValue={lesson.title} required />
        </Field>
        <Field label="Description courte (facultatif)">
          <input name="description" className={inputCls} defaultValue={lesson.description} />
        </Field>
        {lesson.type === "video" && (
          <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
            <Field label="Lien de la vidéo" hint="YouTube, Vimeo ou fichier .mp4.">
              <input name="videoUrl" type="url" className={inputCls} defaultValue={lesson.videoUrl} />
            </Field>
            <Field label="Durée (min)">
              <input name="durationMinutes" type="number" min={0} className={cn(inputCls, "w-28")} defaultValue={lesson.durationMinutes} />
            </Field>
          </div>
        )}
        {lesson.type === "pdf" && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Lien du PDF">
              <input name="fileUrl" type="url" className={inputCls} defaultValue={lesson.fileUrl} />
            </Field>
            <Field label="Nom du fichier">
              <input name="fileName" className={inputCls} defaultValue={lesson.fileName} />
            </Field>
          </div>
        )}
        <RichTextEditor
          label={lesson.type === "text" ? "Contenu" : "Texte d'accompagnement (facultatif)"}
          name="content"
          defaultValue={lesson.content}
          minHeight={lesson.type === "text" ? 320 : 200}
          placeholder="Rédigez la leçon : titres, listes, encadrés « astuce », tableaux…"
        />
      </div>

      {lesson.type === "practice" && (
        <div className="grid gap-3">
          <h2 className="text-lg font-bold text-brand-deep">Exercices ({drafts.length})</h2>
          {drafts.map((d, i) => (
            <div key={d.key} className={cn("grid gap-3 rounded-2xl border bg-card p-4", problems[i] ? "border-xp/60" : "border-border")}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="flex size-7 items-center justify-center rounded-lg bg-brand-soft text-xs font-bold text-primary">{i + 1}</span>
                <select className={cn(inputCls, "w-auto")} value={d.kind} onChange={(e) => update(i, { kind: e.target.value as ExerciseKind })} aria-label="Type d'exercice">
                  {EXERCISE_KINDS.map((k) => (
                    <option key={k} value={k}>
                      {KIND_LABELS[k]}
                    </option>
                  ))}
                </select>
                <span className="ml-auto flex gap-1">
                  <button type="button" className={btn.icon} onClick={() => move(i, -1)} disabled={i === 0} aria-label="Monter">
                    <ArrowUp className="size-4" aria-hidden />
                  </button>
                  <button type="button" className={btn.icon} onClick={() => move(i, 1)} disabled={i === drafts.length - 1} aria-label="Descendre">
                    <ArrowDown className="size-4" aria-hidden />
                  </button>
                  <button type="button" className={btn.icon} onClick={() => setDrafts((ds) => [...ds.slice(0, i + 1), { ...d, key: rid(), _id: undefined }, ...ds.slice(i + 1)])} aria-label="Dupliquer">
                    <Copy className="size-4" aria-hidden />
                  </button>
                  <button type="button" className={btn.icon} onClick={() => setDrafts((ds) => ds.filter((_, k) => k !== i))} aria-label="Supprimer l'exercice">
                    <Trash2 className="size-4" aria-hidden />
                  </button>
                </span>
              </div>
              <Field label="Consigne (facultatif)">
                <input className={inputCls} value={d.prompt} onChange={(e) => update(i, { prompt: e.target.value })} placeholder={DEFAULT_PROMPTS[d.kind]} />
              </Field>
              <ExerciseFields d={d} set={(p) => update(i, p)} />
              <Field label="Explication après correction (facultatif)">
                <input className={inputCls} value={d.explanation} onChange={(e) => update(i, { explanation: e.target.value })} />
              </Field>
              {problems[i] && <p className="text-sm font-medium text-[#7a4d00]">⚠ {problems[i]}</p>}
            </div>
          ))}
          <div className="flex flex-wrap gap-2">
            {(["choice", "build", "match", "gap", "listen", "speak", "order"] as ExerciseKind[]).map((k) => (
              <button key={k} type="button" className={btn.secondary} onClick={() => setDrafts((ds) => [...ds, toDraft({ kind: k })])}>
                <Plus className="size-4" aria-hidden /> {KIND_LABELS[k]}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="sticky bottom-0 -mx-4 flex flex-wrap items-center gap-3 border-t border-border bg-background/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-10 lg:px-10">
        <label className="flex items-center gap-2 text-sm font-medium">
          <input type="checkbox" name="isPublished" defaultChecked={lesson.isPublished} className="size-4 accent-primary" /> Publiée
        </label>
        <Submit>Enregistrer la leçon</Submit>
        <a href={previewHref} target="_blank" rel="noopener" className={btn.secondary}>
          <Eye className="size-4" aria-hidden /> Aperçu apprenant
        </a>
        {problems.some(Boolean) && <span className="text-sm text-[#7a4d00]">Certains exercices sont incomplets.</span>}
      </div>
    </AdminForm>
  );
}
