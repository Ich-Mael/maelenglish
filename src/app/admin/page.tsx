import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { BookOpen, ClipboardCheck, GraduationCap, Inbox, UserPlus, Users } from "lucide-react";
import { requireStaff, actorOf, visibleCourseIds } from "@/lib/admin/context";
import { can } from "@/lib/admin/permissions";
import { ChallengeSubmission, Course, Enrollment, EnrollmentRequest, User } from "@/models";
import { Card, PageHeader, btn } from "@/components/admin/ui";
import { PageSkeleton } from "@/components/learn/ui";

export const metadata: Metadata = { title: "Dashboard" };

async function Dashboard() {
  await connection();
  const me = await requireStaff("/admin");
  const a = actorOf(me);
  const ids = await visibleCourseIds(me);
  const inCourses = ids ? { courseId: { $in: ids } } : {};
  const [requests, learners, courses, active, pending] = await Promise.all([
    can.manageUsers(a) ? EnrollmentRequest.countDocuments({ status: "new" }) : Promise.resolve(null),
    can.manageUsers(a) ? User.countDocuments({ role: "user", isActive: { $ne: false } }) : Promise.resolve(null),
    Course.countDocuments(ids ? { _id: { $in: ids } } : {}),
    Enrollment.countDocuments({ ...inCourses, status: "active" }),
    ChallengeSubmission.countDocuments({ ...inCourses, status: "pending" }),
  ]);
  const tiles = [
    requests !== null && { label: "New sign-up requests", value: requests, icon: Inbox, href: "/admin/demandes", highlight: requests > 0 },
    learners !== null && { label: "Active learners", value: learners, icon: Users, href: "/admin/utilisateurs?role=user" },
    { label: ids ? "My courses" : "Courses", value: courses, icon: BookOpen, href: "/admin/cours" },
    { label: "Active enrolments", value: active, icon: GraduationCap, href: "/admin/cours" },
    a.role !== "account-manager" && { label: "Submissions to grade", value: pending, icon: ClipboardCheck, href: "/admin/corrections", highlight: pending > 0 },
  ].filter(Boolean) as { label: string; value: number; icon: typeof Users; href: string; highlight?: boolean }[];

  return (
    <>
      <PageHeader title={`Hello ${me.name}`} subtitle="MaelEnglish administration" />
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
        <Card title="Shortcuts">
          <div className="flex flex-wrap gap-2">
            {can.manageUsers(a) && (
              <Link href="/admin/utilisateurs/nouveau" className={btn.primary}>
                <UserPlus className="size-4" aria-hidden /> Create an account
              </Link>
            )}
            {can.createCourse(a) && (
              <Link href="/admin/cours/nouveau" className={btn.secondary}>
                New course
              </Link>
            )}
            {a.role !== "account-manager" && (
              <Link href="/admin/corrections" className={btn.secondary}>
                Grade submissions
              </Link>
            )}
          </div>
        </Card>
        <Card title="Reminder">
          <p className="text-sm text-muted-foreground">
            Passwords never go through WhatsApp: when an account is created, the activation link is emailed if the person has an email;
            otherwise copy it and pass it on yourself.
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
