import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { requireStaff } from "@/lib/admin/context";
import { User } from "@/models";
import { listPayments, minutePacks, paymentProvider } from "@/lib/payments/service";
import { fcfa } from "@/lib/payments/notify";
import { Card, EmptyState, Input, PageHeader, Pill } from "@/components/admin/ui";
import { AdminForm, Submit } from "@/components/admin/forms";
import { PageSkeleton } from "@/components/learn/ui";
import { cn } from "cn";
import { recheckPaymentAction, saveMinutePacksAction } from "./actions";

export const metadata: Metadata = { title: "Payments" };

const KIND: Record<string, string> = { course: "Course", story: "Story Mode", minutes: "AI minutes" };
const STATUS_TONE = { paid: "blue", pending: "amber", failed: "red", cancelled: "grey" } as const;

async function Payments({ searchParams }: { searchParams: Promise<{ status?: string; q?: string }> }) {
  await connection();
  const me = await requireStaff("/admin/paiements");
  if (!me.isAdmin) redirect("/admin");
  const sp = await searchParams;
  const status = ["paid", "pending", "failed"].includes(sp.status ?? "") ? sp.status : undefined;
  const [{ rows, totals }, packs] = await Promise.all([listPayments({ status, q: sp.q?.slice(0, 60) }), minutePacks()]);
  const users = await User.find({ _id: { $in: rows.map((r) => r.userId) } }).select("name surname username").lean();
  const who = (id: unknown) => users.find((u) => String(u._id) === String(id));
  const provider = paymentProvider();
  const monthTotal = totals.reduce((n, t) => n + t.amount, 0);
  const packRows = [...packs, ...Array.from({ length: Math.max(0, 4 - packs.length) }, () => null)];

  return (
    <div className="grid max-w-6xl gap-5">
      <PageHeader title="Payments" subtitle="Online payments by learners (CinetPay: Orange Money, Moov Money, cards). Access is given automatically once the operator confirms." />
      <div className="grid gap-3 sm:grid-cols-4">
        <div className="rounded-2xl bg-gradient-to-br from-brand-deep to-primary p-4 text-white">
          <p className="text-xs font-bold tracking-wide text-white/75 uppercase">This month</p>
          <p className="font-heading text-2xl font-extrabold">{fcfa(monthTotal)}</p>
        </div>
        {(["course", "story", "minutes"] as const).map((k) => {
          const t = totals.find((x) => x._id === k);
          return (
            <div key={k} className="rounded-2xl border-2 border-border bg-card p-4">
              <p className="text-xs font-bold tracking-wide text-muted-foreground uppercase">{KIND[k]}</p>
              <p className="font-heading text-xl font-extrabold text-brand-deep">{fcfa(t?.amount ?? 0)}</p>
              <p className="text-xs text-muted-foreground">{t?.n ?? 0} payment(s)</p>
            </div>
          );
        })}
      </div>
      {!provider || provider.name !== "cinetpay" ? (
        <p className="rounded-xl bg-coral-soft px-3 py-2 text-sm text-coral-dark">{provider ? "Simulation mode (development): add CINETPAY_API_KEY and CINETPAY_SITE_ID for real payments." : "Online payment is off: add CINETPAY_API_KEY and CINETPAY_SITE_ID (CinetPay dashboard → Integration)."}</p>
      ) : null}

      <Card title="Payments">
        <form className="mb-4 flex flex-wrap items-center gap-2 text-sm">
          {[
            ["", "All"],
            ["paid", "Paid"],
            ["pending", "Waiting"],
            ["failed", "Failed"],
          ].map(([v, l]) => (
            <Link key={v} href={`/admin/paiements${v ? `?status=${v}` : ""}`} className={cn("rounded-full px-3 py-1.5 font-semibold", (status ?? "") === v ? "bg-brand-deep text-white" : "bg-muted text-brand-deep hover:bg-brand-soft")}>
              {l}
            </Link>
          ))}
          <input name="q" defaultValue={sp.q ?? ""} placeholder="Reference or item" className="ml-auto h-9 rounded-xl border border-input bg-background px-3" />
          {status && <input type="hidden" name="status" value={status} />}
          <button className="h-9 rounded-xl border border-border px-3 font-semibold">Search</button>
        </form>
        {rows.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="text-xs text-muted-foreground uppercase">
                <tr>
                  <th className="py-2">Date</th>
                  <th>Learner</th>
                  <th>Item</th>
                  <th className="text-right">Amount</th>
                  <th>Status</th>
                  <th>Reference</th>
                  <th />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((p) => {
                  const u = who(p.userId);
                  return (
                    <tr key={String(p._id)}>
                      <td className="py-2 whitespace-nowrap">{new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: process.env.APP_TZ || "Africa/Ouagadougou" }).format(p.createdAt)}</td>
                      <td>{u ? <Link href={`/admin/utilisateurs/${u._id}`} className="font-semibold text-primary hover:underline">{`${u.name} ${u.surname ?? ""}`.trim()}</Link> : "—"}</td>
                      <td>
                        <span className="text-xs text-muted-foreground">{KIND[p.kind]} · </span>
                        {p.label}
                      </td>
                      <td className="text-right font-semibold whitespace-nowrap">{fcfa(p.amount)}</td>
                      <td>
                        <Pill tone={STATUS_TONE[p.status as keyof typeof STATUS_TONE] ?? "grey"}>{p.status}</Pill>
                        {p.method && <span className="ml-1 text-xs text-muted-foreground">{p.method}</span>}
                        {p.error && <span className="block text-xs text-coral-dark">{p.error}</span>}
                      </td>
                      <td className="font-mono text-xs">{p.transactionId}</td>
                      <td>
                        {p.status === "pending" && (
                          <AdminForm action={recheckPaymentAction}>
                            <input type="hidden" name="tx" value={p.transactionId} />
                            <Submit variant="secondary" className="h-8 px-3 text-xs">
                              Check again
                            </Submit>
                          </AdminForm>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState>No payment yet.</EmptyState>
        )}
      </Card>

      <Card title="AI minute packs" description="What learners can buy in the Shop to talk longer with Coach Ish. Bought minutes are used after the monthly minutes and stay valid 90 days. Prices are rounded to 5 FCFA; leave a row empty to remove it.">
        <AdminForm action={saveMinutePacksAction} className="grid gap-3">
          {packRows.map((p, i) => (
            <div key={i} className="grid gap-3 sm:grid-cols-[1fr_1fr]">
              <Input label={`Pack ${i + 1}: minutes`} name="minutes" type="number" min={1} defaultValue={p?.minutes ?? ""} />
              <Input label="Price (FCFA)" name="priceFcfa" inputMode="numeric" defaultValue={p?.priceFcfa ?? ""} />
            </div>
          ))}
          <Submit className="w-fit">Save the packs</Submit>
        </AdminForm>
      </Card>
    </div>
  );
}

export default function Page({ searchParams }: { searchParams: Promise<{ status?: string; q?: string }> }) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Payments searchParams={searchParams} />
    </Suspense>
  );
}
