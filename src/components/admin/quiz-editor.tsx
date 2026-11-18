"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { AdminForm, Submit } from "./forms";
import { btn, inputCls } from "./ui";
import { saveQuizAction } from "@/app/admin/actions";
import { cn } from "cn";

export type EditableQuestion = { _id?: string; text: string; options: { id: string; text: string }[]; correctOptionId: string; explanation: string };
export type EditableQuiz = { title: string; passingScore: number; timeLimit: number; questions: EditableQuestion[] };

const newId = () => Math.random().toString(36).slice(2, 8);
const blankQuestion = (): EditableQuestion => {
  const a = newId();
  return { text: "", options: [{ id: a, text: "" }, { id: newId(), text: "" }], correctOptionId: a, explanation: "" };
};

/** Module quiz / final exam editor. Saves the whole quiz as JSON; the model validates it. */
export function QuizEditor({ target, initial, label = "quiz" }: { target: { moduleId?: string; courseId?: string }; initial: EditableQuiz; label?: string }) {
  const [quiz, setQuiz] = useState<EditableQuiz>(initial);
  const setQ = (i: number, patch: Partial<EditableQuestion>) => setQuiz((q) => ({ ...q, questions: q.questions.map((x, k) => (k === i ? { ...x, ...patch } : x)) }));
  const move = (i: number, d: -1 | 1) =>
    setQuiz((q) => {
      const list = [...q.questions];
      const j = i + d;
      if (j < 0 || j >= list.length) return q;
      [list[i], list[j]] = [list[j], list[i]];
      return { ...q, questions: list };
    });

  return (
    <AdminForm action={saveQuizAction}>
      {target.moduleId && <input type="hidden" name="moduleId" value={target.moduleId} />}
      {target.courseId && <input type="hidden" name="courseId" value={target.courseId} />}
      <input type="hidden" name="quiz" value={JSON.stringify(quiz)} />
      <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
        <label className="grid gap-1 text-sm">
          <span className="font-medium">Titre</span>
          <input className={inputCls} value={quiz.title} onChange={(e) => setQuiz({ ...quiz, title: e.target.value })} placeholder={`Titre du ${label}`} />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-medium">Score requis (%)</span>
          <input className={cn(inputCls, "w-28")} type="number" min={0} max={100} value={quiz.passingScore} onChange={(e) => setQuiz({ ...quiz, passingScore: Number(e.target.value) })} />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-medium">Durée (min, 0 = libre)</span>
          <input className={cn(inputCls, "w-28")} type="number" min={0} value={quiz.timeLimit} onChange={(e) => setQuiz({ ...quiz, timeLimit: Number(e.target.value) })} />
        </label>
      </div>

      <ol className="grid gap-4">
        {quiz.questions.map((q, i) => (
          <li key={q._id ?? i} className="rounded-xl border border-border p-4">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-sm font-bold text-brand-deep">Question {i + 1}</span>
              <span className="flex gap-1">
                <button type="button" className={btn.icon} onClick={() => move(i, -1)} aria-label="Monter" disabled={i === 0}>
                  <ArrowUp className="size-4" aria-hidden />
                </button>
                <button type="button" className={btn.icon} onClick={() => move(i, 1)} aria-label="Descendre" disabled={i === quiz.questions.length - 1}>
                  <ArrowDown className="size-4" aria-hidden />
                </button>
                <button type="button" className={btn.icon} onClick={() => setQuiz({ ...quiz, questions: quiz.questions.filter((_, k) => k !== i) })} aria-label="Supprimer la question">
                  <Trash2 className="size-4" aria-hidden />
                </button>
              </span>
            </div>
            <textarea className={cn(inputCls, "h-auto min-h-16 py-2")} value={q.text} onChange={(e) => setQ(i, { text: e.target.value })} placeholder="Énoncé de la question" aria-label={`Énoncé de la question ${i + 1}`} />
            <fieldset className="mt-3 grid gap-2">
              <legend className="mb-1 text-xs text-muted-foreground">Réponses — cochez la bonne</legend>
              {q.options.map((o, k) => (
                <div key={o.id} className="flex items-center gap-2">
                  <input type="radio" name={`correct-${i}`} checked={q.correctOptionId === o.id} onChange={() => setQ(i, { correctOptionId: o.id })} className="size-4 accent-success" aria-label={`Bonne réponse : ${o.text || `réponse ${k + 1}`}`} />
                  <input
                    className={inputCls}
                    value={o.text}
                    onChange={(e) => setQ(i, { options: q.options.map((x) => (x.id === o.id ? { ...x, text: e.target.value } : x)) })}
                    placeholder={`Réponse ${String.fromCharCode(65 + k)}`}
                  />
                  <button type="button" className={btn.icon} disabled={q.options.length <= 2} onClick={() => setQ(i, { options: q.options.filter((x) => x.id !== o.id), correctOptionId: q.correctOptionId === o.id ? q.options.find((x) => x.id !== o.id)!.id : q.correctOptionId })} aria-label="Retirer la réponse">
                    <Trash2 className="size-4" aria-hidden />
                  </button>
                </div>
              ))}
              {q.options.length < 6 && (
                <button type="button" className="w-fit text-sm font-semibold text-primary hover:underline" onClick={() => setQ(i, { options: [...q.options, { id: newId(), text: "" }] })}>
                  + Ajouter une réponse
                </button>
              )}
            </fieldset>
            <input className={cn(inputCls, "mt-3")} value={q.explanation} onChange={(e) => setQ(i, { explanation: e.target.value })} placeholder="Explication affichée après la correction (facultatif)" />
          </li>
        ))}
      </ol>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={btn.secondary} onClick={() => setQuiz({ ...quiz, questions: [...quiz.questions, blankQuestion()] })}>
          <Plus className="size-4" aria-hidden /> Ajouter une question
        </button>
        <Submit>Enregistrer le {label}</Submit>
      </div>
    </AdminForm>
  );
}
