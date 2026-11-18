import Link from "next/link";
import { CircleUserRound, LogIn } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/dal";

const cls =
  "inline-flex h-10 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-brand-deep transition-colors hover:bg-brand-soft";

/** Header account entry — reads the session, so it renders inside <Suspense> (fallback: the logged-out link). */
export async function AccountLink() {
  const me = await getCurrentUser();
  if (!me) return <LoginLink />;
  return (
    <Link href="/mes-cours" className={cls}>
      <CircleUserRound className="size-4.5" aria-hidden />
      <span className="max-w-28 truncate">{me.name}</span>
    </Link>
  );
}

export function LoginLink() {
  return (
    <Link href="/connexion" className={cls}>
      <LogIn className="size-4.5" aria-hidden />
      Connexion
    </Link>
  );
}
