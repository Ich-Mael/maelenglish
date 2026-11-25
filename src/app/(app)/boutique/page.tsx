import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { BookOpen, CheckCircle2, Clock, MapPin, ShieldCheck } from "lucide-react";
import { requireUser } from "@/lib/auth/dal";
import { connectDB } from "@/lib/db";
import { Payment } from "@/models";
import { paymentProvider, shopFor, type ShopItem } from "@/lib/payments/service";
import { fcfa } from "@/lib/payments/notify";
import { BuyButton } from "@/components/shop/buy-button";
import { PageSkeleton } from "@/components/learn/ui";
import { waLink } from "@/lib/site";
import { cn } from "cn";

export const metadata: Metadata = { title: "Shop", robots: { index: false } };

/* Shop (owner decisions 2026-11-24): courses, Story Mode seasons and AI minute packs, one-time prices. */

function Item({ i, icon: Icon, available, tone }: { i: ShopItem; icon: typeof BookOpen; available: boolean; tone: "navy" | "blue" | "white" }) {
  return (
    <li className={cn("grid content-between gap-4 rounded-3xl border-2 p-5", tone === "navy" ? "border-transparent bg-gradient-to-br from-brand-deep to-brand-dark text-white" : tone === "blue" ? "border-transparent bg-gradient-to-br from-primary to-brand-deep text-white" : "border-border bg-card")}>
      <div className="flex items-start gap-3">
        <span className={cn("flex size-12 shrink-0 items-center justify-center rounded-2xl", tone === "white" ? "bg-brand-soft text-primary" : "border-2 border-coral bg-white text-coral")}>
          <Icon className="size-6" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className={cn("text-xs font-bold tracking-wide uppercase", tone === "white" ? "text-coral-dark" : "text-white/75")}>{i.subtitle}</p>
          <p className={cn("text-lg font-extrabold break-words", tone === "white" ? "text-brand-deep" : "text-white")}>{i.title}</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className={cn("font-heading text-2xl font-extrabold", tone === "white" ? "text-brand-deep" : "text-white")}>{fcfa(i.amount)}</p>
        {i.owned ? (
          <span className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-bold", tone === "white" ? "bg-brand-soft text-primary" : "bg-white/15 text-white")}>
            <CheckCircle2 className="size-4" aria-hidden /> You have it
          </span>
        ) : available ? (
          <BuyButton kind={i.kind} itemId={i.itemId} />
        ) : null}
      </div>
    </li>
  );
}

async function Shop() {
  await connection();
  const me = await requireUser("/boutique");
  await connectDB();
  const [shop, history] = await Promise.all([shopFor(me.id), Payment.find({ userId: me.id, status: { $in: ["paid", "pending"] } }).sort({ createdAt: -1 }).limit(10).lean()]);
  const available = paymentProvider() !== null;
  const empty = !shop.courses.length && !shop.seasons.length && !shop.packs.length;
  return (
    <div className="mx-auto grid max-w-5xl gap-8">
      <header className="grid gap-2">
        <h1 className="text-3xl font-extrabold text-brand-deep">Shop</h1>
        <p className="flex items-center gap-2 text-muted-foreground">
          <ShieldCheck className="size-5 text-primary" aria-hidden /> Secure payment with Orange Money, Moov Money or a bank card. One payment, no subscription.
        </p>
        {!available && (
          <p className="rounded-2xl border-2 border-coral/40 bg-white p-3 text-sm font-semibold text-brand-deep">
            Online payment isn&apos;t open yet.{" "}
            <a href={waLink("Bonjour, je voudrais acheter un accès MaelEnglish.")} className="text-primary underline">
              Contact us on WhatsApp
            </a>{" "}
            to pay.
          </p>
        )}
      </header>
      {shop.packs.length > 0 && (
        <section className="grid gap-3">
          <h2 className="flex items-center gap-2 text-xl font-extrabold text-brand-deep">
            <Clock className="size-5 text-primary" aria-hidden /> More time with Coach Ish
          </h2>
          <ul className="grid gap-4 sm:grid-cols-2">
            {shop.packs.map((i) => (
              <Item key={i.itemId} i={i} icon={Clock} available={available} tone="blue" />
            ))}
          </ul>
        </section>
      )}
      {shop.courses.length > 0 && (
        <section className="grid gap-3">
          <h2 className="flex items-center gap-2 text-xl font-extrabold text-brand-deep">
            <BookOpen className="size-5 text-primary" aria-hidden /> Courses
          </h2>
          <ul className="grid gap-4 sm:grid-cols-2">
            {shop.courses.map((i) => (
              <Item key={i.itemId} i={i} icon={BookOpen} available={available} tone="white" />
            ))}
          </ul>
        </section>
      )}
      {shop.seasons.length > 0 && (
        <section className="grid gap-3">
          <h2 className="flex items-center gap-2 text-xl font-extrabold text-brand-deep">
            <MapPin className="size-5 text-primary" aria-hidden /> Story Mode seasons
          </h2>
          <ul className="grid gap-4 sm:grid-cols-2">
            {shop.seasons.map((i) => (
              <Item key={i.itemId} i={i} icon={MapPin} available={available} tone="navy" />
            ))}
          </ul>
        </section>
      )}
      {empty && <p className="rounded-3xl border-2 border-dashed border-border p-8 text-center text-muted-foreground">Nothing for sale yet.</p>}
      {history.length > 0 && (
        <section className="grid gap-2">
          <h2 className="text-lg font-extrabold text-brand-deep">My payments</h2>
          <ul className="divide-y divide-border rounded-2xl border-2 border-border bg-card">
            {history.map((p) => (
              <li key={String(p._id)} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                <span className="font-semibold text-brand-deep">{p.label}</span>
                <span className="text-muted-foreground">
                  {fcfa(p.amount)} · {new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(p.createdAt)} ·{" "}
                  {p.status === "paid" ? (
                    "Paid"
                  ) : (
                    <Link href={`/paiement/${p.transactionId}`} className="font-semibold text-primary">
                      Waiting
                    </Link>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Shop />
    </Suspense>
  );
}
