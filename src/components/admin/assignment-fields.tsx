import { toEditorHtml } from "@/lib/rich-text";
import { RichTextEditor } from "./rich-text-editor";
import { Input, Select, isoDate } from "./ui";

type Assignment = { title?: string | null; instructions?: string | null; submissionType?: string | null; maxScore?: number | null; dueDate?: Date | null };

export function AssignmentFields({ a, withDueDate }: { a?: Assignment | null; withDueDate?: boolean }) {
  return (
    <>
      <Input label="Titre" name="title" defaultValue={a?.title ?? ""} />
      <RichTextEditor label="Consignes" name="instructions" defaultValue={toEditorHtml(a?.instructions)} hint="Laissez vide pour ne pas avoir de devoir." />
      <div className="grid gap-4 sm:grid-cols-3">
        <Select label="Réponse attendue" name="submissionType" defaultValue={a?.submissionType ?? "text"} options={[{ value: "text", label: "Texte" }, { value: "link", label: "Lien (audio, document…)" }]} />
        <Input label="Note maximale" name="maxScore" type="number" min={1} defaultValue={a?.maxScore ?? 100} />
        {withDueDate && <Input label="À rendre avant" name="dueDate" type="date" defaultValue={isoDate(a?.dueDate)} />}
      </div>
    </>
  );
}
