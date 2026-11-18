import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { BookOpen, ClipboardCheck, GraduationCap, UserPlus, Users } from "lucide-react";
import { requireStaff, actorOf, visibleCourseIds } from "@/lib/admin/context";
import { can } from "@/lib/admin/permissions";
import { AssignmentSubmission, Course, Enrollment, User } from "@/models";
import { Card, PageHeader, btn } from "@/components/admin/ui";
import { PageSkeleton } from "@/components/learn/ui";

export const metadata: Metadata = { title: "Tableau de bord" };

async function Dashboard() {
  await connection();
  const me = await requireStaff("/admin");
  const a = actorOf(me);
  const ids = await visibleCourseIds(me);
  const inCourses = ids ? { courseId: { $in: ids } } : {};
  const [learners, courses, active, pending] = await Promise.all([
    can.manageUsers(a) ? User.countDocuments({ role: "user", isActive: { $ne: false } }) : Promise.resolve(null),
    Course.countDocuments(ids ? { _id: { $in: ids } } : {}),
    Enrollment.countDocuments({ ...inCourses, status: "active" }),
    AssignmentSubmission.countDocuments({ ...inCourses, status: "pending" }),
  ]);
  const tiles = [
    learners !== null && { label: "Apprenants actifs", value: learners, icon: Users, href: "/admin/utilisateurs?role=user" },
    { label: ids ? "Mes cours" : "Cours", value: courses, icon: BookOpen, href: "/admin/cours" },
    { label: "Inscriptions actives", value: active, icon: GraduationCap, href: "/admin/cours" },
    a.role !== "account-manager" && { label: "Devoirs à corriger", value: pending, icon: ClipboardCheck, href: "/admin/corrections", highlight: pending > 0 },
  ].filter(Boolean) as { label: string; value: number; icon: typeof Users; href: string; highlight?: boolean }[];

  return (
    <>
      <PageHeader title={`Bonjour ${me.name}`} subtitle="Administration MaelEnglish" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {tiles.map((t) => (
          <Link key={t.label} href={t.href} className={`rounded-2xl border bg-card p-5 transition hover:-translate-y-0.5 hover:shadow-md ${t.highlight ? "border-coral/40" : "border-border"}`}>
            <t.icon className={`size-6 ${t.highlight ? "text-coral" : "text-primary"}`} aria-hidden />
            <p className="mt-3 font-heading text-3xl font-extrabold text-brand-deep">{t.value}</p>
            <p className="text-sm text-muted-foreground">{t.label}</p>
          </Link>
        ))}
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card title="Raccourcis">
          <div className="flex flex-wrap gap-2">
            {can.manageUsers(a) && (
              <Link href="/admin/utilisateurs/nouveau" className={btn.primary}>
                <UserPlus className="size-4" aria-hidden /> Créer un compte
              </Link>
            )}
            {can.createCourse(a) && (
              <Link href="/admin/cours/nouveau" className={btn.secondary}>
                Nouveau cours
              </Link>
            )}
            {a.role !== "account-manager" && (
              <Link href="/admin/corrections" className={btn.secondary}>
                Corriger les devoirs
              </Link>
            )}
          </div>
        </Card>
        <Card title="Rappel">
          <p className="text-sm text-muted-foreground">
            Les mots de passe ne passent jamais par WhatsApp : à la création d&apos;un compte, le lien d&apos;activation est envoyé par email si la
            personne en a un, sinon copiez-le et transmettez-le vous-même.
          </p>
        </Card>
      </div>
    </>
  );
}

export default function AdminHome() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Dashboard />
    </Suspense>
  );
}
