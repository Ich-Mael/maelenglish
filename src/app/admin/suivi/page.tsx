import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { AlertTriangle, ExternalLink, Mail } from "lucide-react";
import { actorOf, requireStaff } from "@/lib/admin/context";
import { can } from "@/lib/admin/permissions";
import { GRADING_DUE_HOURS, coachStats } from "@/lib/admin/coaching";
import { gradingQueue } from "@/lib/admin/grading";
import { lastDigest } from "@/lib/notifications";
import { isEmailConfigured } from "@/lib/email";
import { plainText } from "@/lib/rich-text";
import { User } from "@/models";
import { Card, EmptyState, PageHeader, Pill, fmtDate } from "@/components/admin/ui";
import { AdminForm, Submit } from "@/components/admin/forms";
import { PageSkeleton } from "@/components/learn/ui";
import { sendDigestNowAction } from "../actions";
import { cn } from "cn";

export const metadata: Metadata = { title: "Coach oversight" };

const hours = (h: number | null) => (h === null ? "—" : h >= 48 ? `${Math.round((h / 24) * 10) / 10} days` : `${Math.round(h)} h`);
const waited = (h: number) => (h >= 48 ? `${Math.floor(h / 24)} days` : `${Math.max(1, Math.round(h))} h`);

/**
 * Admins: are learners' speaking challenges reviewed well and on time? Per coach (last 30 days):
 * learners, waiting / late, reviews, average response time, average grade, share returned; the late
 * challenges; the latest feedback to read; learners without a main coach; the daily digest.
 */
async function Oversight() {
  await connection();
  const me = await requireStaff("/admin/suivi");
  if (!can.overseeCoaches(actorOf(me))) redirect("/admin");
  const now = new Date();
  const [stats, late, recent, digest, unassigned] = await Promise.all([
    coachStats(now),
    gradingQueue({ courseIds: null, status: "pending", lateOnly: true }, now),
    gradingQueue({ courseIds: null, status: "graded" }, now).then(async (g) => [...g, ...(await gradingQueue({ courseIds: null, status: "returned" }, now))].sort((a, b) => new Date(b.gradedAt ?? 0).getTime() - new Date(a.gradedAt ?? 0).getTime()).slice(0, 12)),
    lastDigest(),
    User.countDocuments({ role: "user", isActive: { $ne: false }, coachId: null }),
  ]);
  const totalPending = stats.reduce((n, s) => n + s.pending, 0);

  return (
    <div className="grid max-w-6xl gap-5">
      <PageHeader title="Coach oversight" subtitle={`Speaking challenges should be reviewed within ${GRADING_DUE_HOURS} hours. Figures over the last 30 days.`} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Waiting for a coach", value: totalPending, href: "/admin/corrections" },
          { label: `Late (> ${GRADING_DUE_HOURS} h)`, value: late.length, href: "/admin/corrections?late=1", alert: late.length > 0 },
          { label: "Reviews (30 days)", value: stats.reduce((n, s) => n + s.reviewed, 0) },
          { label: "Learners without a main coach", value: unassigned, href: "/admin/utilisateurs" },
        ].map((t) => {
          const body = (
            <>
              <span className={cn("block font-heading text-3xl font-extrabold tabular-nums", t.alert ? "text-coral-dark" : "text-brand-deep")}>{t.value}</span>
              <span className="text-xs font-semibold text-muted-foreground">{t.label}</span>
            </>
          );
          const cls = cn("rounded-2xl border bg-card p-4", t.alert ? "border-coral/60" : "border-border");
          return t.href ? (
            <Link key={t.label} href={t.href} className={cn(cls, "hover:shadow-sm")}>
              {body}
            </Link>
          ) : (
            <div key={t.label} className={cls}>
              {body}
            </div>
          );
        })}
      </div>

      <Card title="Coaches" description="Response time = from the recording being sent to the coach's review. Return rate = share of reviews asking the learner to redo.">
        {stats.length === 0 ? (
          <EmptyState>No coach activity yet. Assign main coaches from a learner&apos;s page or a course&apos;s enrolments.</EmptyState>
        ) : (
          <div className="-mx-5 overflow-x-auto px-5">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="py-2 pr-3 font-semibold">Coach</th>
                  <th className="px-3 py-2 text-right font-semibold">Learners</th>
                  <th className="px-3 py-2 text-right font-semibold">Waiting</th>
                  <th className="px-3 py-2 text-right font-semibold">Late</th>
                  <th className="px-3 py-2 text-right font-semibold">Reviews</th>
                  <th className="px-3 py-2 text-right font-semibold">Avg. response</th>
                  <th className="px-3 py-2 text-right font-semibold">Avg. grade</th>
                  <th className="px-3 py-2 text-right font-semibold">Returned</th>
                  <th className="py-2 pl-3 text-right font-semibold">Last review</th>
                </tr>
              </thead>
              <tbody>
                {stats.map((s) => (
                  <tr key={s.coachId} className="border-b border-border last:border-0">
                    <td className="py-2.5 pr-3">
                      <Link href={`/admin/corrections?coach=${s.coachId}`} className="font-semibold text-brand-deep hover:underline">
                        {s.name || "—"}
                      </Link>
                      {!s.email && <span className="block text-xs text-amber-800">No email: no digest</span>}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{s.learners}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{s.pending}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{s.late ? <Pill tone="red">{s.late}</Pill> : "0"}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{s.reviewed}</td>
                    <td className={cn("px-3 py-2.5 text-right tabular-nums", s.avgResponseH !== null && s.avgResponseH > GRADING_DUE_HOURS && "font-semibold text-coral-dark")}>{hours(s.avgResponseH)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{s.avgGradePct === null ? "—" : `${s.avgGradePct} %`}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{s.returnRatePct === null ? "—" : `${s.returnRatePct} %`}</td>
                    <td className="py-2.5 pl-3 text-right text-muted-foreground">{s.lastReviewAt ? fmtDate(s.lastReviewAt) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title={`Late challenges (${late.length})`} description="Oldest first.">
          {late.length === 0 ? (
            <EmptyState>Nothing late. 👏</EmptyState>
          ) : (
            <ul className="grid gap-2">
              {late.slice(0, 15).map((s) => (
                <li key={String(s._id)}>
                  <Link href={`/admin/corrections/${s._id}`} className="flex items-center gap-3 rounded-xl border border-coral/40 px-3 py-2 text-sm hover:bg-coral-soft/50">
                    <AlertTriangle className="size-4 shrink-0 text-coral-dark" aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold text-brand-deep">{s.user ? `${s.user.name} ${s.user.surname}` : "Learner"}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {s.course?.title} · Coach: {s.responsible.map((c) => c.name).filter(Boolean).join(", ") || "none"}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs font-semibold text-coral-dark">{waited(s.hoursWaiting)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Latest feedback" description="Read what coaches tell learners, to check the quality of their reviews.">
          {recent.length === 0 ? (
            <EmptyState>No review yet.</EmptyState>
          ) : (
            <ul className="grid gap-2">
              {recent.map((s) => (
                <li key={String(s._id)}>
                  <Link href={`/admin/corrections/${s._id}`} className="block rounded-xl border border-border px-3 py-2 text-sm hover:bg-brand-soft/40">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-brand-deep">{s.reviewer || "—"}</span>
                      <span className="text-muted-foreground">→ {s.user ? `${s.user.name} ${s.user.surname}` : "Learner"}</span>
                      {s.status === "graded" ? <Pill tone="green">{s.grade !== null && s.grade !== undefined ? `${s.grade} / ${s.maxScore}` : "Validated"}</Pill> : <Pill tone="amber">Returned</Pill>}
                      <span className="ml-auto text-xs text-muted-foreground">{s.gradedAt ? fmtDate(s.gradedAt) : ""}</span>
                    </span>
                    <span className="mt-1 line-clamp-2 block text-ink/80">{plainText(s.feedback ?? "") || <em className="text-muted-foreground">No written feedback</em>}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card title="Daily email digest" description={`Every day from 8:00 (${process.env.APP_TZ || "Africa/Ouagadougou"}), each coach with challenges waiting gets one email listing them, late ones first; admins get the list of late challenges. Learners get an email as soon as their challenge is reviewed.`}>
        <div className="grid gap-3 text-sm">
          {!isEmailConfigured() && <p className="rounded-xl bg-xp/20 px-3 py-2 font-semibold text-[#7a4d00]">Email isn&apos;t configured (EMAIL_* settings): emails are only logged, not sent.</p>}
          <p className="text-muted-foreground">
            {digest ? (
              <>
                Last digest: {fmtDate(digest.sentAt)} · {digest.emails} email(s) · {digest.pending} waiting · {digest.late} late
              </>
            ) : (
              "No digest sent yet."
            )}
          </p>
          <AdminForm action={sendDigestNowAction}>
            <div>
              <Submit variant="secondary">
                <Mail className="size-4" aria-hidden /> Send the digest now
              </Submit>
            </div>
          </AdminForm>
          <Link href="/admin/corrections" className="inline-flex w-fit items-center gap-1 text-primary hover:underline">
            Open the grading queue <ExternalLink className="size-3.5" aria-hidden />
          </Link>
        </div>
      </Card>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Oversight />
    </Suspense>
  );
}
