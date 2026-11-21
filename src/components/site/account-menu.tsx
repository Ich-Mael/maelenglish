"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { BookOpen, ChevronDown, CircleUserRound, LayoutDashboard } from "lucide-react";
import { LogoutButton } from "@/components/pwa/logout-button";

/**
 * Public header account menu for a signed-in user: username button → Mes cours, Mon compte,
 * Admin (staff), Déconnexion. A <details> (opens without JavaScript); JS only closes it on an
 * outside click, Escape or after choosing a link.
 */
export function AccountMenu({ username, name, isStaff }: { username: string; name: string; isStaff: boolean }) {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const close = (e: Event) => {
      const el = ref.current;
      if (!el?.open) return;
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !el.contains(e.target as Node)) {
        el.open = false;
        if (e instanceof KeyboardEvent) el.querySelector("summary")?.focus();
      }
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", close);
    };
  }, []);
  const item = "flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold text-brand-deep hover:bg-brand-soft";
  const done = () => {
    if (ref.current) ref.current.open = false;
  };

  return (
    <details ref={ref} className="group/acc relative">
      <summary
        className="flex h-10 cursor-pointer list-none items-center gap-2 rounded-xl px-2.5 text-sm font-semibold text-brand-deep transition-colors hover:bg-brand-soft group-data-[scrolled=true]/hdr:text-white group-data-[scrolled=true]/hdr:hover:bg-white/10 [&::-webkit-details-marker]:hidden"
        aria-label={`Mon compte (${username})`}
      >
        <span aria-hidden className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary font-heading text-xs font-extrabold text-white uppercase">
          {username.slice(0, 1)}
        </span>
        <span className="max-w-28 truncate sm:max-w-36">{username}</span>
        <ChevronDown className="size-4 transition group-open/acc:rotate-180" aria-hidden />
      </summary>
      <div className="absolute right-0 z-50 mt-2 w-60 rounded-2xl border border-border bg-card p-2 text-ink shadow-xl">
        <p className="px-3 pt-1.5 pb-2 text-xs text-muted-foreground">
          Connecté(e) : <span className="font-semibold text-brand-deep">{name || username}</span>
        </p>
        <Link href="/mes-cours" className={item} onClick={done}>
          <BookOpen className="size-4 text-primary" aria-hidden /> Mes cours
        </Link>
        <Link href="/compte" className={item} onClick={done}>
          <CircleUserRound className="size-4 text-primary" aria-hidden /> Mon compte
        </Link>
        {isStaff && (
          <Link href="/admin" className={item} onClick={done}>
            <LayoutDashboard className="size-4 text-primary" aria-hidden /> Admin
          </Link>
        )}
        <div className="mt-1 border-t border-border pt-1">
          <LogoutButton variant="menu" />
        </div>
      </div>
    </details>
  );
}
