"use client";

import { LogOut } from "lucide-react";
import { logout } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";
import { clearQueue } from "./offline-queue";

/** Logout that also forgets this learner's offline pages and pending results (shared devices). */
export function LogoutButton({ variant = "default", className }: { variant?: "default" | "compact" | "nav"; className?: string }) {
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
        // top bar: icon on phones, icon + label from lg
        <button
          type="submit"
          title="Déconnexion"
          className="flex h-9 items-center gap-1.5 rounded-xl px-2 text-sm font-semibold text-ink/75 hover:bg-coral-soft hover:text-coral-dark"
        >
          <LogOut className="size-4.5" aria-hidden />
          <span className="sr-only lg:not-sr-only">Déconnexion</span>
        </button>
      ) : (
        // sidebar link style
        <button type="submit" className="flex items-center gap-2 px-3 text-sm text-muted-foreground hover:text-coral-dark">
          <LogOut className="size-4" aria-hidden /> Déconnexion
        </button>
      )}
    </form>
  );
}
