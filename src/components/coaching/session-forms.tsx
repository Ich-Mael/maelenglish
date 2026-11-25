"use client";

import { useState, useTransition } from "react";
import { Check, Loader2, Mail, UserCheck } from "lucide-react";
import { prepareSessionAction, setAttendanceAction, setWeeklyEmailAction, toggleNextStepAction } from "@/app/coaching-actions";
import { AdminForm, Submit } from "@/components/admin/forms";
import { Checkbox, TextArea } from "@/components/admin/ui";
import { cn } from "cn";

/** Before a session: the agenda and what to prepare (the coach). */
export function PrepareForm({ sessionId, agenda, prep }: { sessionId: string; agenda: string; prep: string }) {
  return (
    <AdminForm action={prepareSessionAction}>
      <input type="hidden" name="sessionId" value={sessionId} />
      <TextArea label="Agenda (one point per line)" name="agenda" rows={3} maxLength={2000} defaultValue={agenda} placeholder={"Se présenter en 2 minutes\nLes questions difficiles\nVos questions au recruteur"} />
      <TextArea label="To prepare before the session" name="prep" rows={2} maxLength={1000} defaultValue={prep} placeholder="Relisez l'offre d'emploi et notez 3 réussites à raconter." />
      <Checkbox label="Email it to the people concerned now" name="notify" defaultChecked={!agenda && !prep} hint="It's also in the reminders (the day before and 1 hour before)." />
      <Submit variant="secondary" className="w-fit">
        Save
      </Submit>
    </AdminForm>
  );
}

/** After a session: who was there (the coach). Ticked by default: the people who joined from the app. */
export function AttendanceForm({ sessionId, people, present, confirmed }: { sessionId: string; people: { id: string; name: string }[]; present: string[]; confirmed: boolean }) {
  const [here, setHere] = useState(() => new Set(present));
  const [saved, setSaved] = useState(confirmed);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  return (
    <div className="grid gap-2 rounded-2xl bg-muted/60 p-3">
      <p className="flex items-center gap-1.5 text-sm font-bold text-brand-deep">
        <UserCheck className="size-4 text-primary" aria-hidden /> Who was there?
        {!saved && <span className="text-xs font-semibold text-muted-foreground">(ticked: joined from the app)</span>}
      </p>
      <div className="flex flex-wrap gap-2">
        {people.map((p) => {
          const on = here.has(p.id);
          return (
            <button
              key={p.id}
              type="button"
              aria-pressed={on}
              onClick={() => {
                const next = new Set(here);
                if (on) next.delete(p.id);
                else next.add(p.id);
                setHere(next);
                setSaved(false);
              }}
              className={cn("inline-flex h-9 items-center gap-1.5 rounded-full border-2 px-3 text-sm font-semibold", on ? "border-primary bg-primary text-white" : "border-coral bg-white text-coral-dark")}
            >
              {on ? <Check className="size-4" aria-hidden /> : null} {p.name}
              {!on && <span className="text-xs font-normal">· absent</span>}
            </button>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              setError("");
              const r = await setAttendanceAction(sessionId, [...here]);
              if (r.ok) setSaved(true);
              else setError(r.error);
            })
          }
          className="inline-flex h-9 w-fit items-center gap-2 rounded-xl bg-primary px-3 text-sm font-semibold text-white disabled:opacity-60"
        >
          {pending && <Loader2 className="size-4 animate-spin" aria-hidden />} Confirm attendance
        </button>
        {saved && <span className="text-xs font-semibold text-primary">✓ Confirmed</span>}
        {error && <span className="text-xs font-semibold text-coral-dark">{error}</span>}
      </div>
    </div>
  );
}

/** A member ticks a next step from a session. */
export function NextStepCheck({ sessionId, id, text, done }: { sessionId: string; id: string; text: string; done: boolean }) {
  const [on, setOn] = useState(done);
  const [pending, start] = useTransition();
  return (
    <label className={cn("flex cursor-pointer items-start gap-2.5 rounded-xl px-2 py-1.5 hover:bg-brand-soft/50", pending && "opacity-60")}>
      <input
        type="checkbox"
        checked={on}
        disabled={pending}
        onChange={(e) => {
          const next = e.target.checked;
          setOn(next);
          start(async () => {
            const r = await toggleNextStepAction(sessionId, id, next);
            if (!r.ok) setOn(!next);
          });
        }}
        className="mt-0.5 size-5 shrink-0 accent-[var(--color-primary)]"
      />
      <span lang="fr" className={cn("text-sm", on ? "text-muted-foreground line-through" : "text-ink")}>
        {text}
      </span>
    </label>
  );
}

/** A member turns the Monday summary email on or off. */
export function WeeklyEmailToggle({ coachingId, on: initial }: { coachingId: string; on: boolean }) {
  const [on, setOn] = useState(initial);
  const [pending, start] = useTransition();
  return (
    <label className={cn("flex w-fit cursor-pointer items-center gap-2 text-sm text-muted-foreground", pending && "opacity-60")}>
      <Mail className="size-4 text-primary" aria-hidden />
      <input
        type="checkbox"
        checked={on}
        disabled={pending}
        onChange={(e) => {
          const next = e.target.checked;
          setOn(next);
          start(async () => {
            const r = await setWeeklyEmailAction(coachingId, next);
            if (!r.ok) setOn(!next);
          });
        }}
        className="size-4 accent-[var(--color-primary)]"
      />
      Send me a summary of my week by email (Mondays)
    </label>
  );
}
