"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Loader2, Search, UserPlus, X } from "lucide-react";
import { AdminForm, Submit } from "@/components/admin/forms";
import { Input, Select, TextArea } from "@/components/admin/ui";
import { RichTextEditor } from "@/components/admin/rich-text-editor";
import { VoiceNoteField } from "@/components/admin/voice-note-field";
import {
  addResourceAction,
  addTaskAction,
  createCoachingAction,
  reviewCoachingChallengeAction,
  saveGoalAction,
  scheduleSessionAction,
  searchPeopleAction,
  setMembersAction,
  updateCoachingAction,
  updateSessionAction,
} from "@/app/coaching-actions";
import type { LearnerMatch } from "@/lib/admin/users";
import { DateTimeField, DocumentField } from "./controls";

/* The coach's forms in a coaching (English UI; what the coach writes stays as typed). */

type Opt = { value: string; label: string };
type Member = { id: string; fullName: string };

/** « For »: the whole coaching or one member (only shown for groups). */
function ForField({ members, defaultValue = "" }: { members: Member[]; defaultValue?: string }) {
  if (members.length < 2) return <input type="hidden" name="forUserId" value="" />;
  return <Select label="For" name="forUserId" defaultValue={defaultValue} options={[{ value: "", label: "The whole group" }, ...members.map((m) => ({ value: m.id, label: `Only ${m.fullName}` }))]} />;
}

export function GoalForm({ coachingId, members, goal, member }: { coachingId: string; members: Member[]; goal?: { id: string; title: string; details: string; forUserId: string }; member?: string }) {
  return (
    <AdminForm action={saveGoalAction} resetOnSuccess={!goal}>
      <input type="hidden" name="coachingId" value={coachingId} />
      {goal && <input type="hidden" name="id" value={goal.id} />}
      <Input label="Goal" name="title" required maxLength={200} defaultValue={goal?.title} placeholder="Présenter mon projet en 3 minutes sans notes" />
      <TextArea label="Details (optional)" name="details" rows={2} defaultValue={goal?.details} placeholder="Ce qui montrera que l'objectif est atteint." />
      <div className="grid gap-3 sm:grid-cols-2">
        <Input label="Target date (optional)" name="targetDate" type="date" />
        <ForField members={members} defaultValue={goal?.forUserId ?? member} />
      </div>
      <Submit className="w-fit">{goal ? "Save the goal" : "Add the goal"}</Submit>
    </AdminForm>
  );
}

export function ResourceForm({ coachingId, members, member }: { coachingId: string; members: Member[]; member?: string }) {
  const [mode, setMode] = useState<"file" | "link">("file");
  return (
    <AdminForm action={addResourceAction} resetOnSuccess>
      <input type="hidden" name="coachingId" value={coachingId} />
      <Input label="Title" name="title" required maxLength={200} placeholder="Modèle de présentation" />
      <div role="radiogroup" aria-label="Kind of resource" className="inline-flex w-fit rounded-xl border border-border p-0.5 text-sm font-semibold">
        {(["file", "link"] as const).map((m) => (
          <button key={m} type="button" role="radio" aria-checked={mode === m} onClick={() => setMode(m)} className={mode === m ? "rounded-lg bg-primary px-3 py-1.5 text-white" : "rounded-lg px-3 py-1.5 text-muted-foreground"}>
            {m === "file" ? "File (PDF, picture)" : "Link (website, video)"}
          </button>
        ))}
      </div>
      {mode === "file" ? <DocumentField name="mediaId" /> : <Input label="Link" name="url" type="url" placeholder="https://…" />}
      <TextArea label="Note (optional)" name="note" rows={2} placeholder="Pourquoi lire / regarder ceci." />
      <ForField members={members} defaultValue={member} />
      <Submit className="w-fit">Add the resource</Submit>
    </AdminForm>
  );
}

export function TaskForm({ coachingId, members, options, member }: { coachingId: string; members: Member[]; options: { courses: Opt[]; lab: Opt[]; challenge: Opt[]; roleplay: Opt[] }; member?: string }) {
  const [kind, setKind] = useState<"lab" | "challenge" | "roleplay" | "course">("lab");
  const KINDS = [
    { value: "lab", label: "Lab practice activity" },
    { value: "challenge", label: "Speaking challenge" },
    { value: "roleplay", label: "Talk with Coach Ish role-play" },
    { value: "course", label: "A whole course (enrols them)" },
  ];
  const list = kind === "course" ? options.courses : options[kind];
  return (
    <AdminForm action={addTaskAction} resetOnSuccess>
      <input type="hidden" name="coachingId" value={coachingId} />
      <Select label="What to assign" name="kind" value={kind} onChange={(e) => setKind(e.target.value as typeof kind)} options={KINDS} />
      {list.length ? (
        <Select key={kind} label={kind === "course" ? "Course" : "Activity (ready in the Lab)"} name={kind === "course" ? "courseId" : "activityId"} options={list} />
      ) : (
        <p className="rounded-xl bg-muted p-3 text-sm text-muted-foreground">Nothing ready of this kind yet: create it in the Lab first.</p>
      )}
      <TextArea label="Note for them (optional)" name="note" rows={2} placeholder="À faire avant notre prochaine séance." />
      <div className="grid gap-3 sm:grid-cols-2">
        <Input label="Due date (optional)" name="dueDate" type="date" />
        <ForField members={members} defaultValue={member} />
      </div>
      <Submit className="w-fit">Assign</Submit>
    </AdminForm>
  );
}

export function SessionForm({ coachingId, members, member }: { coachingId: string; members: Member[]; member?: string }) {
  return (
    <AdminForm action={scheduleSessionAction} resetOnSuccess>
      <input type="hidden" name="coachingId" value={coachingId} />
      <div className="grid gap-3 sm:grid-cols-2">
        <DateTimeField name="startsAt" label="Date and time" />
        <Select label="Duration" name="durationMin" defaultValue="60" options={[30, 45, 60, 90, 120].map((m) => ({ value: String(m), label: `${m} min` }))} />
      </div>
      <Input label="Topic (optional)" name="title" maxLength={120} placeholder="Simulation d'entretien" />
      <ForField members={members} defaultValue={member} />
      <Submit className="w-fit">Schedule the session</Submit>
    </AdminForm>
  );
}

export function SessionSummaryForm({ sessionId, summary, nextSteps = [] }: { sessionId: string; summary: string; nextSteps?: string[] }) {
  return (
    <AdminForm action={updateSessionAction}>
      <input type="hidden" name="sessionId" value={sessionId} />
      <TextArea label="Session summary (posted in the feedback)" name="summary" rows={3} defaultValue={summary.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()} placeholder="Ce que nous avons travaillé, ce qui progresse." />
      <TextArea label="Next steps (one per line, max 8)" name="nextSteps" rows={3} defaultValue={nextSteps.join("\n")} hint="Each person gets them as a checklist to tick off before the next session." placeholder={"Refaire le pitch en 1 minute 30\nApprendre les 5 phrases pour gagner du temps"} />
      <Submit className="w-fit">Save the summary</Submit>
    </AdminForm>
  );
}

export function SessionStatusButtons({ sessionId }: { sessionId: string }) {
  return (
    <AdminForm action={updateSessionAction} className="flex flex-wrap gap-2">
      <input type="hidden" name="sessionId" value={sessionId} />
      <button type="submit" name="status" value="done" className="h-9 rounded-xl border border-border px-3 text-sm font-semibold text-brand-deep hover:bg-brand-soft">
        Mark as done
      </button>
      <button type="submit" name="status" value="missed" className="h-9 rounded-xl border border-border px-3 text-sm font-semibold text-brand-deep hover:bg-brand-soft">
        Missed
      </button>
      <button type="submit" name="status" value="cancelled" className="h-9 rounded-xl border border-destructive/30 px-3 text-sm font-semibold text-destructive hover:bg-destructive/5">
        Cancel
      </button>
    </AdminForm>
  );
}

export function ReviewForm({ submissionId }: { submissionId: string }) {
  return (
    <AdminForm action={reviewCoachingChallengeAction}>
      <input type="hidden" name="submissionId" value={submissionId} />
      <TextArea label="Comment" name="comment" rows={3} placeholder="Ce qui est réussi, ce qu'il faut améliorer." />
      <VoiceNoteField name="audioMediaId" initialId="" initialUrl={null} />
      <Input label="Grade out of 10 (optional)" name="grade" type="number" min={0} max={10} className="max-w-40" />
      <div className="flex flex-wrap gap-2">
        <button type="submit" name="decision" value="validated" className="inline-flex h-10 items-center rounded-xl bg-primary px-4 text-sm font-semibold text-white hover:brightness-110">
          Validate
        </button>
        <button type="submit" name="decision" value="returned" className="inline-flex h-10 items-center rounded-xl border-2 border-coral bg-white px-4 text-sm font-bold text-coral-dark hover:bg-coral-soft">
          Ask to redo
        </button>
      </div>
    </AdminForm>
  );
}

export function SettingsForm({ c, coaches, manager }: { c: { id: string; title: string; goal: string; startDate: string; endDate: string; sessionsPlanned: string; meetingUrl: string; status: string; coachId: string }; coaches: Opt[]; manager: boolean }) {
  return (
    <AdminForm action={updateCoachingAction}>
      <input type="hidden" name="coachingId" value={c.id} />
      <Input label="Title" name="title" required defaultValue={c.title} maxLength={120} />
      <RichTextEditor label="Goal (what they want to achieve, and by when)" name="goal" defaultValue={c.goal} minHeight={160} />
      <div className="grid gap-3 sm:grid-cols-3">
        <Input label="Start" name="startDate" type="date" defaultValue={c.startDate} />
        <Input label="End" name="endDate" type="date" defaultValue={c.endDate} />
        <Input label="Sessions planned" name="sessionsPlanned" type="number" min={0} defaultValue={c.sessionsPlanned} />
      </div>
      <Input label="Backup video link (optional)" name="meetingUrl" type="url" defaultValue={c.meetingUrl} placeholder="https://meet.google.com/…" hint="Used for sessions when the built-in video call isn't set up." />
      <div className="grid gap-3 sm:grid-cols-2">
        <Select
          label="Status"
          name="status"
          defaultValue={c.status}
          options={[
            { value: "active", label: "Active" },
            { value: "paused", label: "Paused" },
            { value: "completed", label: "Completed" },
          ]}
        />
        {manager && <Select label="Coach" name="coachId" defaultValue={c.coachId} options={coaches} />}
      </div>
      <Submit className="w-fit">Save</Submit>
    </AdminForm>
  );
}

/** Search accounts and pick several (members of a coaching). */
function PeoplePicker({ picked, setPicked }: { picked: Member[]; setPicked: (m: Member[]) => void }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<LearnerMatch[]>([]);
  const [pending, start] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => {
    clearTimeout(timer.current);
    if (q.trim().length < 2) return;
    timer.current = setTimeout(() => start(async () => setResults(await searchPeopleAction(q))), 250);
    return () => clearTimeout(timer.current);
  }, [q]);
  const shown = q.trim().length < 2 ? [] : results;
  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap gap-2">
        {picked.map((m) => (
          <span key={m.id} className="inline-flex items-center gap-1.5 rounded-full bg-brand-soft py-1 pr-1.5 pl-3 text-sm font-semibold text-brand-deep">
            {m.fullName}
            <button type="button" onClick={() => setPicked(picked.filter((x) => x.id !== m.id))} className="rounded-full p-0.5 hover:bg-white" aria-label={`Remove ${m.fullName}`}>
              <X className="size-3.5" aria-hidden />
            </button>
          </span>
        ))}
      </div>
      <label className="relative block">
        <span className="sr-only">Find a person</span>
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, email, username or WhatsApp number" className="h-10 w-full rounded-xl border border-input bg-background pr-9 pl-9 text-sm outline-none focus:border-primary focus:ring-3 focus:ring-ring/30" />
        {pending && <Loader2 className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-muted-foreground" aria-hidden />}
      </label>
      {shown.length > 0 && (
        <ul className="grid divide-y divide-border overflow-hidden rounded-xl border border-border">
          {shown.map((r) => {
            const already = picked.some((p) => p.id === r.id);
            return (
              <li key={r.id}>
                <button
                  type="button"
                  disabled={already}
                  onClick={() => {
                    setPicked([...picked, { id: r.id, fullName: `${r.name} ${r.surname}`.trim() }]);
                    setQ("");
                  }}
                  className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-brand-soft disabled:opacity-50"
                >
                  <UserPlus className="size-4 text-primary" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="font-semibold text-brand-deep">
                      {r.name} {r.surname}
                    </span>{" "}
                    <span className="text-muted-foreground">
                      @{r.username}
                      {r.contact ? ` · ${r.contact}` : ""}
                    </span>
                  </span>
                  {already && <span className="text-xs font-semibold text-muted-foreground">Added</span>}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function NewCoachingForm({ coaches, initial }: { coaches: Opt[]; initial?: Member | null }) {
  const [picked, setPicked] = useState<Member[]>(initial ? [initial] : []);
  const [kind, setKind] = useState<"individual" | "group">("individual");
  return (
    <AdminForm action={createCoachingAction}>
      <div role="radiogroup" aria-label="Kind of coaching" className="grid gap-2 sm:grid-cols-2">
        {(
          [
            ["individual", "One person", "One-on-one coaching for one goal."],
            ["group", "A group", "A team coached together (e.g. a company's sales team)."],
          ] as const
        ).map(([v, t, d]) => (
          <button key={v} type="button" role="radio" aria-checked={kind === v} onClick={() => setKind(v)} className={kind === v ? "rounded-2xl border-2 border-primary bg-brand-soft p-3 text-left" : "rounded-2xl border-2 border-border p-3 text-left hover:border-primary/40"}>
            <span className="block font-bold text-brand-deep">{t}</span>
            <span className="text-sm text-muted-foreground">{d}</span>
          </button>
        ))}
      </div>
      <input type="hidden" name="kind" value={kind} />
      <div className="grid gap-1.5">
        <span className="text-sm font-semibold text-brand-deep">{kind === "group" ? "Members" : "Person coached"}</span>
        <PeoplePicker picked={kind === "individual" ? picked.slice(0, 1) : picked} setPicked={(m) => setPicked(kind === "individual" ? m.slice(-1) : m)} />
        {(kind === "individual" ? picked.slice(0, 1) : picked).map((m) => (
          <input key={m.id} type="hidden" name="memberIds" value={m.id} />
        ))}
      </div>
      <Select label="Coach" name="coachId" options={coaches} />
      <Input label="Title" name="title" required maxLength={120} placeholder={kind === "group" ? "Équipe commerciale — présentations clients" : "Entretien d'embauche — Total Energies"} />
      <RichTextEditor label="Goal (what they want to achieve, and by when)" name="goal" minHeight={140} />
      <div className="grid gap-3 sm:grid-cols-3">
        <Input label="Start" name="startDate" type="date" />
        <Input label="End (optional)" name="endDate" type="date" />
        <Input label="Sessions planned (optional)" name="sessionsPlanned" type="number" min={0} />
      </div>
      <Input label="Backup video link (optional)" name="meetingUrl" type="url" placeholder="https://meet.google.com/…" hint="Used for sessions when the built-in video call isn't set up." />
      <Submit className="w-fit">Open the coaching</Submit>
    </AdminForm>
  );
}

export function MembersEditor({ coachingId, members }: { coachingId: string; members: Member[] }) {
  const [picked, setPicked] = useState<Member[]>(members);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState("");
  const changed = picked.map((m) => m.id).join() !== members.map((m) => m.id).join();
  return (
    <div className="grid gap-3">
      <PeoplePicker picked={picked} setPicked={setPicked} />
      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={!changed || pending}
          onClick={() =>
            start(async () => {
              const r = await setMembersAction(
                coachingId,
                picked.map((m) => m.id),
              );
              setMsg(r.ok ? "Members saved." : r.error);
            })
          }
          className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-white disabled:opacity-50"
        >
          {pending && <Loader2 className="size-4 animate-spin" aria-hidden />} Save the members
        </button>
        {msg && <span className="text-sm font-semibold text-brand-deep">{msg}</span>}
      </div>
    </div>
  );
}
