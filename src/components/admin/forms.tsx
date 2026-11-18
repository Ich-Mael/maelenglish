"use client";

import { createContext, useActionState, useContext, useEffect, useRef, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { FormMessage } from "@/components/auth/form-parts";
import { btn } from "./ui";
import { cn } from "cn";

export type ActionState = { error?: string; success?: string; data?: Record<string, string> } | undefined;
type Action = (prev: ActionState, form: FormData) => Promise<ActionState>;

/** Pending state of the surrounding AdminForm (submitted with onSubmit, so useFormStatus doesn't see it). */
const PendingContext = createContext(false);

/**
 * Form bound to a server action, with inline success / error message.
 * Submitted through onSubmit + a transition instead of `action={…}`: React 19 resets a form after
 * every action submission — even when the server answers with an error — which wiped what staff
 * had typed. Here the fields keep their values (reset only with `resetOnSuccess`).
 */
export function AdminForm({
  action,
  children,
  className,
  resetOnSuccess,
  onSuccess,
}: {
  action: Action;
  children: React.ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
  onSuccess?: (s: NonNullable<ActionState>) => React.ReactNode;
}) {
  const [state, formAction] = useActionState(action, undefined);
  const [pending, startTransition] = useTransition();
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.success && resetOnSuccess) ref.current?.reset();
  }, [state, resetOnSuccess]);
  return (
    <form
      ref={ref}
      className={cn("grid gap-4", className)}
      onSubmit={(e) => {
        e.preventDefault();
        if (pending) return;
        const data = new FormData(e.currentTarget, (e.nativeEvent as SubmitEvent).submitter);
        startTransition(() => formAction(data));
      }}
    >
      <PendingContext.Provider value={pending}>
        <FormMessage error={state?.error} success={state?.success && !onSuccess ? state.success : undefined} />
        {state?.success && onSuccess ? onSuccess(state) : null}
        {children}
      </PendingContext.Provider>
    </form>
  );
}

export function Submit({ children, variant = "primary", className, confirm }: { children: React.ReactNode; variant?: keyof typeof btn; className?: string; confirm?: string }) {
  const status = useFormStatus();
  const inAdminForm = useContext(PendingContext);
  const pending = status.pending || inAdminForm;
  return (
    <button
      type="submit"
      disabled={pending}
      className={cn(btn[variant], className)}
      onClick={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
    >
      {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}

/** Small one-button form for row actions (move, delete…), with optional confirmation. */
export function ActionButton({
  action,
  fields,
  children,
  variant = "icon",
  confirm,
  label,
  className,
}: {
  action: (form: FormData) => Promise<void>;
  fields: Record<string, string>;
  children: React.ReactNode;
  variant?: keyof typeof btn;
  confirm?: string;
  label?: string;
  className?: string;
}) {
  return (
    <form action={action} className="contents">
      {Object.entries(fields).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <ActionSubmit variant={variant} confirm={confirm} label={label} className={className}>
        {children}
      </ActionSubmit>
    </form>
  );
}

function ActionSubmit({ children, variant, confirm, label, className }: { children: React.ReactNode; variant: keyof typeof btn; confirm?: string; label?: string; className?: string }) {
  const status = useFormStatus();
  const inAdminForm = useContext(PendingContext);
  const pending = status.pending || inAdminForm;
  return (
    <button
      type="submit"
      disabled={pending}
      aria-label={label}
      title={label}
      className={cn(btn[variant], className)}
      onClick={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
    >
      {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : children}
    </button>
  );
}

/** Copy-to-clipboard field (activation / reset links). */
export function CopyField({ value, label }: { value: string; label: string }) {
  return (
    <div className="grid gap-1 text-sm">
      <span className="font-medium">{label}</span>
      <div className="flex gap-2">
        <input readOnly value={value} className="h-10 min-w-0 flex-1 rounded-xl border border-input bg-muted px-3 font-mono text-xs" onFocus={(e) => e.currentTarget.select()} />
        <button type="button" className={btn.secondary} onClick={() => void navigator.clipboard?.writeText(value)}>
          Copier
        </button>
      </div>
    </div>
  );
}
