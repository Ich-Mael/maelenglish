import Link from "next/link";
import { BookOpen, ClipboardCheck, Inbox, LayoutDashboard, Mic, Users } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/dal";
import { can } from "@/lib/admin/permissions";

/** Role-aware admin navigation (reads the session → inside <Suspense>). */
export async function AdminNav({ mobile }: { mobile?: boolean }) {
  const me = await getCurrentUser();
  if (!me) return null;
  const a = { id: me.id, role: me.role };
  const items = [
    { href: "/admin", label: "Tableau de bord", icon: LayoutDashboard, show: true },
    { href: "/admin/demandes", label: "Demandes", icon: Inbox, show: can.manageUsers(a) },
    { href: "/admin/utilisateurs", label: "Utilisateurs", icon: Users, show: can.manageUsers(a) },
    { href: "/admin/cours", label: "Cours", icon: BookOpen, show: true },
    { href: "/admin/corrections", label: "Corrections", icon: ClipboardCheck, show: a.role !== "account-manager" },
    { href: "/admin/micro", label: "Tester le micro", icon: Mic, show: true },
  ].filter((i) => i.show);
  return (
    <nav aria-label="Administration" className={mobile ? "flex gap-1 overflow-x-auto" : "grid gap-1"}>
      {items.map((i) => (
        <Link
          key={i.href}
          href={i.href}
          className={
            mobile
              ? "flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold text-ink/80 hover:bg-brand-soft"
              : "flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold text-ink/80 hover:bg-brand-soft hover:text-brand-deep"
          }
        >
          <i.icon className="size-4.5" aria-hidden /> {i.label}
        </Link>
      ))}
    </nav>
  );
}
