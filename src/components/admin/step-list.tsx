"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { AlertTriangle, ArrowDown, ArrowUp, BookOpen, CircleCheck, GripVertical, Mic, Sparkles, Trash2, EyeOff } from "lucide-react";
import { draftNotices, validateUnit, type UnitStepInput } from "@/lib/course/validate-unit";
import type { StepKind } from "@/lib/course/types";
import { reorderStepsAction, deleteStepAction, saveActivityStepAction } from "@/app/admin/actions";
import { ActionButton, AdminForm, Submit } from "./forms";
import { Input, Pill, Select, btn } from "./ui";
import { cn } from "cn";

/*
 * A unit's steps (admin): drag to reorder (mouse, touch, or keyboard: focus the handle, Space,
 * arrows, Space), or use the arrows. The unit rules (validateUnit) are re-checked on the current
 * order at once, so staff see the problems while arranging; the order is saved right away.
 * An invalid unit stays saved but hidden from learners.
 */

export type StepRow = UnitStepInput & {
  href: string;
  /** Activity type label, or "Lesson" / "Speaking challenge". */
  typeLabel: string;
  passScore: number;
  estimatedMinutes: number;
};

const KIND: Record<StepKind, { label: string; icon: React.ComponentType<{ className?: string }>; tone: string }> = {
  lesson: { label: "Lesson", icon: BookOpen, tone: "bg-brand-soft text-primary" },
  activity: { label: "Activity", icon: Sparkles, tone: "bg-amber-50 text-amber-800" },
  challenge: { label: "Challenge", icon: Mic, tone: "bg-coral-soft text-coral-dark" },
};

export function StepList({ unitId, steps, edit }: { unitId: string; steps: StepRow[]; edit: boolean }) {
  const [order, setOrder] = useState(() => steps.map((s) => s.id));
  const [error, setError] = useState("");
  const [, start] = useTransition();
  const byId = new Map(steps.map((s) => [s.id, s]));
  const rows = order.map((id) => byId.get(id)!).filter(Boolean);
  const problems = validateUnit(rows);
  const drafts = draftNotices(rows);
  const lessons = rows.filter((r) => r.kind === "lesson");
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  const save = (next: string[]) => {
    const before = order;
    setOrder(next);
    setError("");
    start(async () => {
      const r = await reorderStepsAction(unitId, next);
      if (r.error) {
        setOrder(before);
        setError(r.error);
      }
    });
  };
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    save(arrayMove(order, order.indexOf(String(active.id)), order.indexOf(String(over.id))));
  };
  const move = (i: number, d: -1 | 1) => i + d >= 0 && i + d < order.length && save(arrayMove(order, i, i + d));

  return (
    <div className="grid gap-4">
      {problems.length === 0 ? (
        <p className="flex items-center gap-2 rounded-xl border border-success/30 bg-success/10 px-3 py-2.5 text-sm font-semibold text-success">
          <CircleCheck className="size-4 shrink-0" aria-hidden /> Follows the unit rules: learners see this unit.
        </p>
      ) : (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2.5 text-sm text-amber-900" role="status">
          <p className="flex items-center gap-2 font-semibold">
            <AlertTriangle className="size-4 shrink-0" aria-hidden /> Hidden from learners until these are fixed:
          </p>
          <ul className="mt-1 list-disc pl-6">
            {problems.map((p, i) => (
              <li key={i}>{p.message}</li>
            ))}
          </ul>
        </div>
      )}
      {drafts.length > 0 && (
        <div className="rounded-xl border border-primary/25 bg-brand-soft px-3 py-2.5 text-sm text-brand-deep" role="status">
          <p className="flex items-center gap-2 font-semibold">
            <EyeOff className="size-4 shrink-0" aria-hidden /> Skipped for learners until ready in the Lab:
          </p>
          <ul className="mt-1 list-disc pl-6">
            {drafts.map((p, i) => (
              <li key={i}>{p.message}</li>
            ))}
          </ul>
        </div>
      )}
      {error && <p className="text-sm font-semibold text-destructive">{error}</p>}

      {rows.length > 0 && (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={order} strategy={verticalListSortingStrategy}>
            <ol className="grid gap-2">
              {rows.map((s, i) => (
                <Row key={s.id} s={s} n={i + 1} edit={edit} lessons={lessons} flagged={problems.some((p) => p.stepId === s.id)} onMove={(d) => move(i, d)} first={i === 0} last={i === rows.length - 1} />
              ))}
            </ol>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}

function Row({ s, n, edit, lessons, flagged, onMove, first, last }: { s: StepRow; n: number; edit: boolean; lessons: StepRow[]; flagged: boolean; onMove: (d: -1 | 1) => void; first: boolean; last: boolean }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: s.id, disabled: !edit });
  const K = KIND[s.kind];
  const practised = lessons.find((l) => l.id === s.lessonId);
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("rounded-xl border bg-card px-2 py-2", flagged ? "border-amber-300" : "border-border", isDragging && "relative z-10 shadow-lg", s.kind === "activity" && "ml-6")}
    >
      <div className="flex items-center gap-2">
        {edit && (
          <button type="button" ref={setActivatorNodeRef} {...attributes} {...listeners} className={cn(btn.icon, "cursor-grab touch-none active:cursor-grabbing")} aria-label={`Move step ${n}: ${s.title}`}>
            <GripVertical className="size-4" aria-hidden />
          </button>
        )}
        <span className="w-5 text-center text-xs font-bold text-muted-foreground">{n}</span>
        <span className={cn("inline-flex size-8 shrink-0 items-center justify-center rounded-lg", K.tone)} title={K.label}>
          <K.icon className="size-4" aria-hidden />
        </span>
        <Link href={s.href} className="min-w-0 flex-1">
          <span className="block truncate font-semibold text-brand-deep hover:underline">{s.title}</span>
          <span className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            {s.typeLabel}
            {s.kind === "activity" && <> · practises {practised ? `“${practised.title}”` : <strong className="text-amber-800">no lesson</strong>} · pass {s.passScore} %</>}
            {s.estimatedMinutes > 0 && <> · {s.estimatedMinutes} min</>}
            {s.ready === false && <Pill tone="amber">Draft in the Lab</Pill>}
            {s.hasContent === false && <Pill tone="amber">Empty</Pill>}
          </span>
        </Link>
        {edit && (
          <span className="flex items-center">
            <button type="button" className={btn.icon} onClick={() => onMove(-1)} disabled={first} aria-label="Move up" title="Move up">
              <ArrowUp className="size-4" aria-hidden />
            </button>
            <button type="button" className={btn.icon} onClick={() => onMove(1)} disabled={last} aria-label="Move down" title="Move down">
              <ArrowDown className="size-4" aria-hidden />
            </button>
            <ActionButton
              action={deleteStepAction}
              fields={{ stepId: s.id }}
              label={s.kind === "lesson" ? "Delete lesson" : "Remove from unit"}
              confirm={s.kind === "lesson" ? `Delete the lesson “${s.title}”? Its activities stay, without a lesson.` : `Remove “${s.title}” from this unit? (It stays in the Lab; learners' results on this step are deleted.)`}
            >
              <Trash2 className="size-4" aria-hidden />
            </ActionButton>
          </span>
        )}
      </div>
      {edit && s.kind === "activity" && (
        <details className="mt-1 ml-[4.75rem] text-sm">
          <summary className="cursor-pointer text-xs font-semibold text-primary">Step settings</summary>
          <AdminForm action={saveActivityStepAction} className="mt-2">
            <input type="hidden" name="stepId" value={s.id} />
            <div className="grid gap-3 sm:grid-cols-[1fr_8rem_8rem_auto] sm:items-end">
              <Select label="Practises the lesson" name="lessonId" defaultValue={s.lessonId ?? ""} options={[{ value: "", label: "— Pick a lesson —" }, ...lessons.map((l) => ({ value: l.id, label: l.title }))]} />
              <Input label="Pass score (%)" name="passScore" type="number" min={0} max={100} defaultValue={s.passScore} />
              <Input label="Minutes" name="estimatedMinutes" type="number" min={0} defaultValue={s.estimatedMinutes || ""} />
              <Submit variant="secondary">Save</Submit>
            </div>
          </AdminForm>
        </details>
      )}
    </li>
  );
}
