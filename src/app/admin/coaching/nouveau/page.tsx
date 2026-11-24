import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Types } from "mongoose";
import { requireStaff } from "@/lib/admin/context";
import { User } from "@/models";
import { isManager } from "@/lib/coaching/service";
import { Card, PageHeader } from "@/components/admin/ui";
import { NewCoachingForm } from "@/components/coaching/coach-forms";
import { PageSkeleton } from "@/components/learn/ui";

export const metadata: Metadata = { title: "New coaching" };

async function New({ searchParams }: { searchParams: Promise<{ user?: string }> }) {
  await connection();
  const me = await requireStaff("/admin/coaching/nouveau");
  if (!isManager({ id: me.id, role: me.role })) redirect("/admin/coaching");
  const sp = await searchParams;
  const [coaches, first] = await Promise.all([
    User.find({ role: { $in: ["english-coach", "instructor", "admin", "super-admin"] }, isActive: { $ne: false } }).select("name surname coachName").sort({ name: 1 }).lean(),
    sp.user && Types.ObjectId.isValid(sp.user) ? User.findById(sp.user).select("name surname").lean() : null,
  ]);
  // The signed-in admin first when they coach too.
  const options = coaches.map((u) => ({ value: String(u._id), label: `${u.name} ${u.surname ?? ""}`.trim() + (u.coachName ? ` (${u.coachName})` : "") })).sort((a, b) => Number(b.value === me.id) - Number(a.value === me.id));
  return (
    <div className="grid max-w-3xl gap-5">
      <PageHeader title="New coaching" subtitle="For one person or a group, with one coach." back={{ href: "/admin/coaching", label: "Coaching" }} />
      <Card>
        <NewCoachingForm coaches={options} initial={first ? { id: String(first._id), fullName: `${first.name} ${first.surname ?? ""}`.trim() } : null} />
      </Card>
    </div>
  );
}

export default function Page({ searchParams }: { searchParams: Promise<{ user?: string }> }) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <New searchParams={searchParams} />
    </Suspense>
  );
}
