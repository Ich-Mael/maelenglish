"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Loader2, Search } from "lucide-react";
import { ROLE_LABELS, btn, inputCls } from "./ui";
import { cn } from "cn";

/*
 * Users list filters. Live: the list updates as you type once the search has 3 characters
 * (or is cleared), 300 ms after the last key; role / status apply at once. Without JS it's a
 * plain GET form (« Filter »).
 */
const MIN = 3;

export function UserSearch({ q, role, status, roles }: { q: string; role: string; status: string; roles: readonly string[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, start] = useTransition();
  const [text, setText] = useState(q);
  const form = useRef<HTMLFormElement>(null);
  const last = useRef(q.trim());

  const apply = (next: { q?: string; role?: string; status?: string }) => {
    const v = { q: text.trim(), role, status, ...next };
    const p = new URLSearchParams();
    if (v.q) p.set("q", v.q);
    if (v.role) p.set("role", v.role);
    if (v.status) p.set("status", v.status);
    last.current = v.q;
    start(() => router.replace(p.size ? `${pathname}?${p}` : pathname, { scroll: false }));
  };

  useEffect(() => {
    const t = text.trim();
    if (t === last.current || (t.length > 0 && t.length < MIN)) return;
    const id = setTimeout(() => apply({ q: t }), 300);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-run on typing only
  }, [text]);

  const short = text.trim().length > 0 && text.trim().length < MIN;

  return (
    <form
      ref={form}
      role="search"
      className="mb-4 grid gap-2 sm:grid-cols-[1fr_auto_auto_auto]"
      onSubmit={(e) => {
        e.preventDefault();
        apply({ q: text.trim() });
      }}
    >
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <input
          name="q"
          type="search"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Name, username, email or number…"
          aria-label="Search"
          aria-describedby="user-search-hint"
          autoComplete="off"
          className={cn(inputCls, "pr-9 pl-9")}
        />
        {pending && <Loader2 className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-primary" aria-label="Searching" />}
        <span id="user-search-hint" className={cn("mt-1 block text-xs text-muted-foreground", !short && "sr-only")} aria-live="polite">
          {short ? `Type at least ${MIN} characters.` : "Results update as you type."}
        </span>
      </div>
      <select name="role" defaultValue={role} aria-label="Role" className={inputCls} onChange={(e) => apply({ role: e.target.value })}>
        <option value="">All roles</option>
        {roles.map((r) => (
          <option key={r} value={r}>
            {ROLE_LABELS[r]}
          </option>
        ))}
      </select>
      <select name="status" defaultValue={status} aria-label="Status" className={inputCls} onChange={(e) => apply({ status: e.target.value })}>
        <option value="">All</option>
        <option value="active">Active</option>
        <option value="inactive">Deactivated</option>
      </select>
      <button className={btn.secondary}>Filter</button>
    </form>
  );
}
