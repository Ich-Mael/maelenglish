"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Check, Search, UserRound, X } from "lucide-react";
import type { LearnerMatch } from "@/lib/admin/users";
import { searchLearnersAction } from "@/app/admin/actions";
import { inputCls } from "./ui";
import { cn } from "cn";

/*
 * Enrolment picker: staff type a name, email or WhatsApp number and choose the account from the
 * suggestions — the username is filled in automatically (hidden input `name`). Keyboard: ↑ ↓ to
 * move, Entrée to choose, Échap to close. Typing an exact username / email / number without
 * choosing still works (the typed text is sent). A form reset clears the choice.
 */
export function LearnerPicker({ courseId, name = "identifier", label = "Apprenant" }: { courseId: string; name?: string; label?: string }) {
  const id = useId();
  const box = useRef<HTMLDivElement>(null);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<LearnerMatch[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(false);
  const [picked, setPicked] = useState<LearnerMatch | null>(null);
  const seq = useRef(0);

  // Search as the user types (debounced; late answers to older queries are ignored).
  useEffect(() => {
    if (picked) return;
    const term = q.trim();
    const n = ++seq.current;
    const t = setTimeout(async () => {
      if (term.length < 2) {
        if (n === seq.current) setResults([]);
        return;
      }
      setLoading(true);
      try {
        const r = await searchLearnersAction(courseId, term);
        if (n === seq.current) {
          setResults(r);
          setActive(Math.max(0, r.findIndex((x) => !x.enrolled)));
          setOpen(true);
        }
      } finally {
        if (n === seq.current) setLoading(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [q, courseId, picked]);

  // Close on outside click; clear on form reset (after a successful enrolment).
  useEffect(() => {
    const onDown = (e: PointerEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    const form = box.current?.closest("form");
    const onReset = () => {
      setPicked(null);
      setQ("");
      setResults([]);
    };
    document.addEventListener("pointerdown", onDown);
    form?.addEventListener("reset", onReset);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      form?.removeEventListener("reset", onReset);
    };
  }, []);

  const choose = (m: LearnerMatch) => {
    if (m.enrolled) return;
    setPicked(m);
    setOpen(false);
  };

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || results.length === 0) return;
    if (e.key === "ArrowDown") setActive((a) => Math.min(results.length - 1, a + 1));
    else if (e.key === "ArrowUp") setActive((a) => Math.max(0, a - 1));
    else if (e.key === "Enter") choose(results[active]);
    else if (e.key === "Escape") setOpen(false);
    else return;
    e.preventDefault();
  };

  return (
    <div ref={box} className="relative grid content-start gap-1 text-sm">
      <label htmlFor={`${id}-q`} className="font-medium">
        {label}
      </label>
      <input type="hidden" name={name} value={picked ? picked.username : q.trim()} />
      {picked ? (
        <div className="flex h-10 items-center gap-2 rounded-xl border border-primary/40 bg-brand-soft px-3">
          <UserRound className="size-4 shrink-0 text-primary" aria-hidden />
          <span className="min-w-0 flex-1 truncate">
            <span className="font-semibold text-brand-deep">
              {picked.name} {picked.surname}
            </span>{" "}
            <span className="text-muted-foreground">· {picked.username}</span>
          </span>
          <button type="button" onClick={() => { setPicked(null); setQ(""); }} className="rounded-lg p-1 text-muted-foreground hover:bg-white hover:text-brand-deep" aria-label="Changer d’apprenant">
            <X className="size-4" aria-hidden />
          </button>
        </div>
      ) : (
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <input
            id={`${id}-q`}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onFocus={() => results.length && setOpen(true)}
            onKeyDown={onKey}
            placeholder="Nom, email ou numéro WhatsApp"
            autoComplete="off"
            role="combobox"
            aria-expanded={open}
            aria-controls={`${id}-list`}
            aria-activedescendant={open && results[active] ? `${id}-opt-${active}` : undefined}
            required
            className={cn(inputCls, "pl-9")}
          />
        </div>
      )}
      <span className="text-xs text-muted-foreground" aria-live="polite">
        {picked ? "Identifiant rempli automatiquement." : loading ? "Recherche…" : q.trim().length >= 2 && open && results.length === 0 ? "Aucun compte trouvé : créez-le d’abord dans Utilisateurs." : "Tapez au moins 2 lettres, puis choisissez dans la liste."}
      </span>
      {open && !picked && results.length > 0 && (
        <ul id={`${id}-list`} role="listbox" className="absolute top-[4.25rem] right-0 left-0 z-20 grid max-h-72 gap-0.5 overflow-auto rounded-xl border border-border bg-card p-1 shadow-xl">
          {results.map((m, i) => (
            <li
              key={m.id}
              id={`${id}-opt-${i}`}
              role="option"
              aria-selected={i === active}
              aria-disabled={m.enrolled}
              onPointerDown={(e) => e.preventDefault()}
              onClick={() => choose(m)}
              onMouseEnter={() => setActive(i)}
              className={cn(
                "flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2",
                i === active && !m.enrolled && "bg-brand-soft",
                m.enrolled && "cursor-not-allowed opacity-55",
              )}
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold text-brand-deep">
                  {m.name} {m.surname}
                  {m.staff && <span className="ml-2 rounded-full bg-muted px-1.5 py-0.5 text-[11px] font-bold text-muted-foreground">Équipe</span>}
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  {m.username}
                  {m.contact && ` · ${m.contact}`}
                </span>
              </span>
              {m.enrolled ? (
                <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-muted-foreground">
                  <Check className="size-3.5" aria-hidden /> Déjà inscrit(e)
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
