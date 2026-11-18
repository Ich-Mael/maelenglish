"use client";

import { LogOut } from "lucide-react";
import { logout } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";
import { clearQueue } from "./offline-queue";

/** Logout that also forgets this learner's offline pages and pending results (shared devices). */
export function LogoutButton() {
  return (
    <form
      action={logout}
      onSubmit={() => {
        clearQueue();
        void caches?.keys().then((keys) => keys.filter((k) => k.startsWith("me-pages-")).forEach((k) => void caches.delete(k)));
        try {
          localStorage.removeItem("me-downloaded-courses-v3");
        } catch {}
      }}
    >
      <Button type="submit" variant="outline" className="rounded-xl">
        <LogOut className="size-4" aria-hidden /> Me déconnecter
      </Button>
    </form>
  );
}
