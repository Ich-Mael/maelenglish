import Link from "next/link";
import { LogIn, UserPlus } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/dal";
import { AccountMenu } from "./account-menu";

const cls =
  "inline-flex h-10 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-brand-deep transition-colors hover:bg-brand-soft group-data-[scrolled=true]/hdr:text-white group-data-[scrolled=true]/hdr:hover:bg-white/10";
const signupCls = "hidden h-10 items-center gap-2 rounded-xl border-2 border-coral bg-white px-4 text-sm font-bold text-coral-dark transition hover:bg-coral-soft sm:inline-flex";

/**
 * Header account area — reads the session, so it renders inside <Suspense> (fallback: the
 * logged-out version, so public pages stay prerendered). Signed in: the account menu (with
 * « Déconnexion ») and no « S'inscrire »; signed out: « Connexion » + « S'inscrire ».
 */
export async function AccountLink() {
  const me = await getCurrentUser();
  if (!me) return <LoggedOut />;
  return <AccountMenu username={me.username} name={`${me.name} ${me.surname}`.trim()} isStaff={me.isStaff} />;
}

export function LoggedOut() {
  return (
    <>
      <Link href="/connexion" className={cls}>
        <LogIn className="size-4.5" aria-hidden />
        Connexion
      </Link>
      <Link href="/inscription" className={signupCls}>
        <UserPlus className="size-4" aria-hidden /> S&apos;inscrire
      </Link>
    </>
  );
}

/** Mobile menu's « S'inscrire », only for visitors (same Suspense rule). */
export async function MobileSignup() {
  if (await getCurrentUser()) return null;
  return <MobileSignupLink />;
}

export function MobileSignupLink() {
  return (
    <Link href="/inscription" className="mt-1 flex items-center gap-2 rounded-xl border-2 border-coral bg-white px-3 py-2.5 font-bold text-coral-dark hover:bg-coral-soft">
      <UserPlus className="size-4" aria-hidden /> S&apos;inscrire
    </Link>
  );
}
