import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { requireStaff } from "@/lib/admin/context";
import { usageReport } from "@/lib/ai/metering";
import { Card, EmptyState, Input, PageHeader, TextArea } from "@/components/admin/ui";
import { AdminForm, Submit } from "@/components/admin/forms";
import { PageSkeleton } from "@/components/learn/ui";
import { saveAiSettingsAction, saveBudgetAction, savePersonaAction } from "../actions";
import { budgetState } from "@/lib/conversation/budget";
import { cn } from "cn";

export const metadata: Metadata = { title: "AI usage" };

const minutes = (s: number) => `${(s / 60).toFixed(s < 600 ? 1 : 0)} min`;
const usd = (micros: number) => `US$ ${(micros / 1_000_000).toFixed(2)}`;

async function Usage() {
  const me = await requireStaff("/admin/usage-ia");
  if (!me.isAdmin) redirect("/admin");
  await connection();
  const [r, pool] = await Promise.all([usageReport(), budgetState()]);
  const b = pool.budget;
  return (
    <div className="grid max-w-5xl gap-5">
      <PageHeader title="AI usage" subtitle={`AI services usage (speech, pronunciation, conversation, feedback) — month ${r.month}. Estimated costs.`} />
      <Card title="Speaking Partner budget" description="Your ElevenLabs plan's credits are shared by every learner. From the credits a call minute uses, the app knows how many minutes the plan holds and what a minute really costs. Admins are emailed at the warning threshold; new conversations stop at the stop threshold, until the 1st or until you raise the credits.">
        {pool.configured ? (
          <div className="mb-4 grid gap-2">
            <p className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
              <span>
                <strong className="font-heading text-2xl text-brand-deep">{Math.round(pool.usedMinutes)}</strong> <span className="text-muted-foreground">/ {Math.round(pool.poolMinutes)} min used this month ({Math.round(pool.percent)} %)</span>
              </span>
              <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-bold", pool.level === "stopped" ? "border-2 border-coral bg-white text-coral-dark" : pool.level === "warn" ? "bg-coral-soft text-coral-dark" : "bg-brand-soft text-primary")}>
                {pool.level === "stopped" ? "Paused: new calls refused" : pool.level === "warn" ? "Warning" : "OK"}
              </span>
            </p>
            <span className="relative h-3 overflow-hidden rounded-full bg-muted" aria-hidden>
              <span className={cn("absolute inset-y-0 left-0 rounded-full", pool.level === "ok" ? "bg-primary" : "bg-coral")} style={{ width: `${Math.min(100, pool.percent)}%` }} />
              <span className="absolute inset-y-0 w-0.5 bg-ink/40" style={{ left: `${b.warnPercent}%` }} />
              <span className="absolute inset-y-0 w-0.5 bg-coral-dark" style={{ left: `${b.stopPercent}%` }} />
            </span>
            <p className="text-xs text-muted-foreground">
              {pool.microsPerMinute !== null ? `A call minute costs about US$ ${(pool.microsPerMinute / 1_000_000).toFixed(3)} (${Math.round(b.creditsPerMinute)} credits). A 5-minute conversation ≈ US$ ${((pool.microsPerMinute * 5) / 1_000_000).toFixed(2)} + the debrief (~US$ 0.03).` : "Add the plan's price to see the real cost of a minute."}
            </p>
          </div>
        ) : (
          <p className="mb-4 rounded-xl bg-coral-soft px-3 py-2 text-sm text-coral-dark">No budget set: conversations are only limited by each learner&apos;s monthly minutes.</p>
        )}
        <AdminForm action={saveBudgetAction} className="grid gap-3 sm:grid-cols-3">
          <Input label="Plan credits per month" name="planCredits" inputMode="numeric" defaultValue={b.planCredits || ""} placeholder="600000" hint="From your ElevenLabs plan. Empty or 0 = no budget." />
          <Input label="Credits per call minute" name="creditsPerMinute" inputMode="decimal" defaultValue={b.creditsPerMinute} hint="Measured: credits used ÷ minutes (ElevenLabs → Usage)." />
          <Input label="Plan price (US$ / month)" name="planPriceUsd" inputMode="decimal" defaultValue={b.planPriceUsd || ""} placeholder="37.13" hint="For the real cost of a minute." />
          <Input label="Warn admins at (%)" name="warnPercent" type="number" min={1} max={99} defaultValue={b.warnPercent} />
          <Input label="Stop new calls at (%)" name="stopPercent" type="number" min={2} max={100} defaultValue={b.stopPercent} />
          <div className="self-end">
            <Submit>Save the budget</Submit>
          </div>
        </AdminForm>
      </Card>

      <Card title="AI minutes per learner" description="Speech analysed and AI conversations, per month. Written feedback isn't counted.">
        <AdminForm action={saveAiSettingsAction} className="max-w-sm">
          <Input label="Minutes per month (default)" name="aiMonthlyMinutes" type="number" min={0} max={10000} defaultValue={r.defaultMinutes} hint="Can be changed for one learner on their profile. Keep it in line with the plan: e.g. 20 minutes (4 conversations)." />
          <div>
            <Submit>Save</Submit>
          </div>
        </AdminForm>
      </Card>

      <Card title="Mael persona" description="Coach Mael's voice in the AI role-play debriefs (« Mael's tip ») and the « Help » suggestions. The roles the AI plays (interviewer, client…) don't use it.">
        <AdminForm action={savePersonaAction} className="grid gap-3">
          <TextArea label="Tone" name="tone" rows={2} defaultValue={r.persona.tone} placeholder="Warm, direct and encouraging. Celebrates progress, then gives one clear, practical next step." />
          <TextArea label="Catchphrases (one per line)" name="catchphrases" rows={3} defaultValue={r.persona.catchphrases.join("\n")} placeholder={"Speak the language of your profession!\nOne step at a time."} />
          <TextArea label="Signature tips (one per line)" name="tips" rows={4} defaultValue={r.persona.tips.join("\n")} placeholder={"Prepare three key sentences before every meeting.\nPause and breathe: a short silence sounds confident."} />
          <div>
            <Submit>Save the persona</Submit>
          </div>
        </AdminForm>
      </Card>

      <Card title="This month, per learner">
        {r.rows.length === 0 ? (
          <EmptyState>No AI usage this month.</EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground">
                <tr>
                  <th className="py-2 pr-4 font-semibold">Learner</th>
                  <th className="py-2 pr-4 font-semibold">Minutes</th>
                  <th className="py-2 pr-4 font-semibold">Calls</th>
                  <th className="py-2 font-semibold">Estimated cost</th>
                </tr>
              </thead>
              <tbody>
                {r.rows.map((u) => (
                  <tr key={u.userId} className="border-t border-border">
                    <td className="py-2 pr-4">
                      <Link href={`/admin/utilisateurs/${u.userId}`} className="font-semibold text-brand-deep hover:text-primary">
                        {u.name}
                      </Link>
                      <span className="ml-2 text-muted-foreground">{u.username}</span>
                    </td>
                    <td className="py-2 pr-4 tabular-nums">{minutes(u.seconds)}</td>
                    <td className="py-2 pr-4 tabular-nums">{u.calls}</td>
                    <td className="py-2 tabular-nums">{usd(u.costMicros)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title="Last 14 days">
        {r.days.length === 0 ? (
          <EmptyState>Nothing in this period.</EmptyState>
        ) : (
          <ul className="grid gap-1 text-sm">
            {r.days.map((d) => (
              <li key={d.day} className="flex justify-between gap-4 border-t border-border py-1.5 first:border-0">
                <span className="font-semibold">{d.day}</span>
                <span className="tabular-nums text-muted-foreground">
                  {minutes(d.seconds)} · {d.calls} calls · {usd(d.costMicros)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Usage />
    </Suspense>
  );
}
