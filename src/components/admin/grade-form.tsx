"use client";

import { useState } from "react";
import { AdminForm, Submit } from "./forms";
import { inputCls } from "./ui";
import { RichTextEditor } from "./rich-text-editor";
import { gradeAction } from "@/app/admin/actions";
import { cn } from "cn";

export function GradeForm({ submissionId, maxScore, isCheckpoint, initial }: { submissionId: string; maxScore: number; isCheckpoint: boolean; initial: { grade: number | null; feedback: string } }) {
  const [decision, setDecision] = useState<"graded" | "returned">("graded");
  return (
    <AdminForm action={gradeAction}>
      <input type="hidden" name="submissionId" value={submissionId} />
      <input type="hidden" name="decision" value={decision} />
      <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Décision">
        {(["graded", "returned"] as const).map((d) => (
          <button
            key={d}
            type="button"
            role="radio"
            aria-checked={decision === d}
            onClick={() => setDecision(d)}
            className={cn(
              "rounded-xl border-2 px-3 py-3 text-sm font-bold transition",
              decision === d ? (d === "graded" ? "border-success bg-success/10 text-success" : "border-coral bg-coral-soft text-coral-dark") : "border-border text-muted-foreground",
            )}
          >
            {d === "graded" ? (isCheckpoint ? "Valider (ouvre le jour suivant)" : "Valider") : "Renvoyer à l'apprenant"}
          </button>
        ))}
      </div>
      {decision === "graded" && (
        <label className="grid gap-1 text-sm">
          <span className="font-medium">Note sur {maxScore} (facultatif)</span>
          <input name="grade" type="number" min={0} max={maxScore} defaultValue={initial.grade ?? ""} className={cn(inputCls, "w-32")} />
        </label>
      )}
      <RichTextEditor
        label={`Commentaire pour l'apprenant${decision === "returned" ? " (obligatoire)" : ""}`}
        name="feedback"
        defaultValue={initial.feedback}
        minHeight={180}
        placeholder="Points forts, ce qu'il faut reprendre, un exemple, un conseil pour la suite…"
      />
      <p className="text-xs text-muted-foreground">Valider rapporte 20 XP à l&apos;apprenant (une seule fois).</p>
      <div>
        <Submit>{decision === "graded" ? "Valider" : "Renvoyer"}</Submit>
      </div>
    </AdminForm>
  );
}
