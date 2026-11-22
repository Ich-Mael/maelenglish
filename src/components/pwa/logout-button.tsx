"use client";

import { LogOut } from "lucide-react";
import { logout } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";
import { clearQueue } from "./offline-queue";

/** Logout that also forgets this learner's offline pages and pending results (shared devices). */
export function LogoutButton({ variant = "default", className, label = "Déconnexion" }: { variant?: "default" | "compact" | "nav" | "menu"; className?: string; /** « Sign out » in the (English) admin. */ label?: string }) {
  return (
    <form
      action={logout}
      className={className}
      onSubmit={() => {
        clearQueue();
        void caches?.keys().then((keys) => keys.filter((k) => k.startsWith("me-pages-")).forEach((k) => void caches.delete(k)));
        try {
          localStorage.removeItem("me-downloaded-courses-v3");
        } catch {}
      }}
    >
      {variant === "default" ? (
        <Button type="submit" variant="outline" className="rounded-xl">
          <LogOut className="size-4" aria-hidden /> Me déconnecter
        </Button>
      ) : variant === "compact" ? (
        // top bar: icon, plus the label on wide screens (the username chip needs the room)
        <button
          type="submit"
          title={label}
          className="flex h-9 items-center gap-1.5 rounded-xl px-2 text-sm font-semibold text-ink/75 hover:bg-coral-soft hover:text-coral-dark group-data-[scrolled=true]/hdr:text-white/80 group-data-[scrolled=true]/hdr:hover:bg-white/10 group-data-[scrolled=true]/hdr:hover:text-white"
        >
          <LogOut className="size-4.5" aria-hidden />
          <span className="sr-only xl:not-sr-only">{label}</span>
        </button>
      ) : variant === "menu" ? (
        // dropdown item (public header account menu)
        <button type="submit" className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold text-coral-dark hover:bg-coral-soft">
          <LogOut className="size-4" aria-hidden /> {label}
        </button>
      ) : (
        // sidebar link style
        <button type="submit" className="flex items-center gap-2 px-3 text-sm text-muted-foreground hover:text-coral-dark">
          <LogOut className="size-4" aria-hidden /> {label}
        </button>
      )}
    </form>
  );
}
