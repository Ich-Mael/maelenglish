"use client";

import { useActionState } from "react";
import { submitAssignment } from "@/app/(app)/learn-actions";
import { FormMessage, SubmitButton } from "@/components/auth/form-parts";

export function AssignmentForm({
  courseId,
  moduleId,
  type,
  initial,
  label,
}: {
  courseId: string;
  moduleId: string;
  type: "text" | "link";
  initial: string;
  label: string;
}) {
  const [state, action] = useActionState(submitAssignment, undefined);
  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="courseId" value={courseId} />
      <input type="hidden" name="moduleId" value={moduleId} />
      <FormMessage error={state?.error} success={state?.success} />
      {type === "link" ? (
        <input
          name="content"
          type="url"
          required
          defaultValue={initial}
          placeholder="https://…"
          aria-label="Lien vers votre travail"
          className="h-12 rounded-2xl border-2 border-border bg-card px-4 text-base outline-none focus:border-primary"
        />
      ) : (
        <textarea
          name="content"
          required
          rows={10}
          maxLength={20000}
          defaultValue={initial}
          lang="en"
          placeholder="Write your answer in English…"
          aria-label="Votre réponse"
          className="w-full rounded-2xl border-2 border-border bg-card p-4 text-base leading-relaxed outline-none focus:border-primary"
        />
      )}
      <SubmitButton className="sm:w-fit sm:px-8">{label}</SubmitButton>
    </form>
  );
}
