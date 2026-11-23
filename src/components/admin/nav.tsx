import Link from "next/link";
import { BookOpen, ClipboardCheck, Cpu, FlaskConical, Gauge, Inbox, LayoutDashboard, Stethoscope, MessagesSquare, Mic, Users } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/dal";
import { can } from "@/lib/admin/permissions";

/** Role-aware admin navigation (reads the session → inside <Suspense>). */
export async function AdminNav({ mobile }: { mobile?: boolean }) {
  const me = await getCurrentUser();
  if (!me) return null;
  const a = { id: me.id, role: me.role };
  const items = [
    { href: "/admin", label: "Dashboard", icon: LayoutDashboard, show: true },
    { href: "/admin/demandes", label: "Requests", icon: Inbox, show: can.manageUsers(a) },
    { href: "/admin/diagnostics", label: "Diagnostics", icon: Stethoscope, show: can.manageUsers(a) },
    { href: "/admin/utilisateurs", label: "Users", icon: Users, show: can.manageUsers(a) },
    { href: "/admin/cours", label: "Courses", icon: BookOpen, show: true },
    { href: "/admin/labo", label: "Lab", icon: FlaskConical, show: can.useLab(a) },
    { href: "/admin/corrections", label: "Grading", icon: ClipboardCheck, show: a.role !== "account-manager" },
    { href: "/admin/conversations", label: "AI conversations", icon: MessagesSquare, show: ["admin", "super-admin", "english-coach", "instructor"].includes(a.role) },
    { href: "/admin/suivi", label: "Coach oversight", icon: Gauge, show: can.overseeCoaches(a) },
    { href: "/admin/usage-ia", label: "AI usage", icon: Cpu, show: ["admin", "super-admin"].includes(a.role) },
    { href: "/admin/micro", label: "Microphone test", icon: Mic, show: true },
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
