"use client";

import { useState, type ComponentProps } from "react";
import { useFormStatus } from "react-dom";
import { Eye, EyeOff, Loader2, CircleAlert, CircleCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "cn";

export function Field({
  label,
  hint,
  className,
  ...props
}: ComponentProps<typeof Input> & { label: string; hint?: string; name: string }) {
  const id = props.id ?? props.name;
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} className={cn("h-11 rounded-xl bg-background px-3.5 text-base", className)} {...props} />
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function PasswordField({
  label,
  hint,
  ...props
}: ComponentProps<typeof Input> & { label: string; hint?: string; name: string }) {
  const [visible, setVisible] = useState(false);
  const id = props.id ?? props.name;
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          type={visible ? "text" : "password"}
          className="h-11 rounded-xl bg-background pr-11 pl-3.5 text-base"
          {...props}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-xl text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
          aria-label={visible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
          aria-pressed={visible}
        >
          {visible ? <EyeOff className="size-4.5" /> : <Eye className="size-4.5" />}
        </button>
      </div>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function SubmitButton({ children, className }: { children: React.ReactNode; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" disabled={pending} className={cn("h-11 w-full rounded-xl text-base", className)}>
      {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {children}
    </Button>
  );
}

export function FormMessage({ error, success }: { error?: string; success?: string }) {
  if (!error && !success) return null;
  return (
    <div
      role={error ? "alert" : "status"}
      className={cn(
        "flex items-start gap-2 rounded-xl border px-3.5 py-3 text-sm",
        error ? "border-destructive/30 bg-destructive/5 text-destructive" : "border-success/30 bg-success/10 text-success",
      )}
    >
      {error ? <CircleAlert className="mt-0.5 size-4 shrink-0" /> : <CircleCheck className="mt-0.5 size-4 shrink-0" />}
      <span>{error ?? success}</span>
    </div>
  );
}
