import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/dal";
import { cn } from "cn";

/*
 * The signed-in account's username, always visible in the navbars (user decision 2026-11-21):
 * learner top bar, admin sidebar / top row. Reads the session, so render it inside <Suspense>
 * (fallback: nothing). Links to the account page.
 */
export async function UserChip({ className, label = "Mon compte" }: { className?: string; label?: string }) {
  const me = await getCurrentUser();
  if (!me) return null;
  return (
    <Link
      href="/compte"
      title={`${label} · ${me.name} ${me.surname}`.trim()}
      className={cn("inline-flex h-9 min-w-0 items-center gap-1.5 rounded-xl px-1.5 text-sm font-semibold text-brand-deep hover:bg-brand-soft", className)}
    >
      <span aria-hidden className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary font-heading text-xs font-extrabold text-white uppercase">
        {(me.name || me.username).charAt(0)}
      </span>
      <span className="truncate">
        <span className="sr-only">{label} : </span>
        {me.username}
      </span>
    </Link>
  );
}
