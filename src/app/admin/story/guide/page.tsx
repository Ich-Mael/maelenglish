import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { ArrowRight, BookOpen, Clapperboard, Coins, Dumbbell, KeyRound, Map, MessagesSquare, Rocket, Sparkles, UserRound, type LucideIcon } from "lucide-react";
import { actorOf, requireStaff } from "@/lib/admin/context";
import { can } from "@/lib/admin/permissions";
import { PageHeader, btn } from "@/components/admin/ui";
import { PageSkeleton } from "@/components/learn/ui";
import { cn } from "cn";

export const metadata: Metadata = { title: "How Story Mode works" };

/* Admin → Story Mode → « How it works »: the guide for staff (English, owner decisions 2026-11-23). */

const STAGES: { icon: LucideIcon; title: string; text: string; tone: string }[] = [
  { icon: Clapperboard, title: "1. Watch", text: "A short video of the situation the learner is about to live (arriving at the airport, meeting a neighbour, a taxi ride…). Until it's filmed, learners see « Video coming soon » and continue.", tone: "from-brand-deep to-brand-dark" },
  { icon: Dumbbell, title: "2. Learn & practise", text: "The lessons and Lab activities of an existing course unit, in the unit's order, played with the usual screens. Nothing to rewrite: you pick the unit. Progress also counts in the course.", tone: "from-primary to-brand-deep" },
  { icon: MessagesSquare, title: "3. Talk", text: "A Talk with Coach Ish call with a story character (their name, personality, voice and avatar). The debrief score is the proof of mastery: at the pass score (60 by default) the story goes on.", tone: "from-coral-dark to-brand-deep" },
];

const STEPS: { icon: LucideIcon; title: string; body: React.ReactNode }[] = [
  {
    icon: BookOpen,
    title: "Create the season",
    body: (
      <>
        « New season » (or « Import JSON »): a title, a short name for the URL (it never changes), the <b>city</b>, the <b>level</b> and the <b>learning goal</b> in French — the promise learners buy, e.g. « Je me débrouille au quotidien en anglais ». Add a cover picture and a description in <i>Overview</i>.
      </>
    ),
  },
  {
    icon: UserRound,
    title: "Build the cast",
    body: (
      <>
        In <i>Cast</i>, create the characters: name, role, personality, speaking style (in English: they shape how the AI plays them), an <b>ElevenLabs voice</b> and an <b>avatar</b>. The « narrator » voices the narration. For a sequel, « Copy its characters » reuses a cast.
      </>
    ),
  },
  {
    icon: Map,
    title: "Place the city",
    body: (
      <>
        In <i>Places & map</i>, add the places of the story (airport, office, market…) with an icon, then click on the map to put each pin. Learners see their progress on this map.
      </>
    ),
  },
  {
    icon: Sparkles,
    title: "Write each episode",
    body: (
      <>
        In <i>Chapters & episodes</i>, create an episode, then fill it in: the place and characters, the <b>intro scene</b> (narration in French, character lines in English with a French translation — ▶ plays the character&apos;s voice), the <b>video</b>, the <b>course unit</b>, the <b>conversation</b> and the <b>outro scene</b> with a teaser for the next episode.
      </>
    ),
  },
  {
    icon: MessagesSquare,
    title: "Prepare the conversation",
    body: (
      <>
        Pick the character and an existing Lab <b>AI role-play</b>, or click « Create a conversation for this episode »: a Lab draft pre-filled from the character opens. Write the learner&apos;s goals, the opening line and the useful phrases (they go into the learner&apos;s notebook), then mark it <b>ready</b> in the Lab. Set the debrief score needed. Conversations made for a season stay in Story Mode (they aren&apos;t on the free Talk with Coach Ish page).
      </>
    ),
  },
  {
    icon: Coins,
    title: "Set the price",
    body: (
      <>
        In <i>Pricing & access</i>: the <b>conversation minutes included</b> per learner (about 7.5 per episode: a 5-minute call played about 1.5 times), the free preview episodes (0 by default: Story Mode is paid), the margin and the price. The page shows the real cost of a minute, the AI cost per learner and a suggested price in FCFA — you decide the final price.
      </>
    ),
  },
  {
    icon: Rocket,
    title: "Publish",
    body: (
      <>
        Mark each episode <b>ready</b> (only possible once nothing is left to fix: a unit with playable content, a ready role-play, the scenes), then <b>Publish</b> the season. Use the eye icon to play an episode as a learner first: staff see drafts, every episode is open, and nothing gives XP.
      </>
    ),
  },
  {
    icon: KeyRound,
    title: "Give access",
    body: (
      <>
        Story Mode is paid: on the learner&apos;s page (Users → the learner → <i>Story Mode</i>), « Give access » to a season, optionally until a date, and add <b>extra conversation minutes</b> when they&apos;ve used theirs. Learners without access see the season and its price, and can buy it online (« Buy the season », CinetPay) or ask on WhatsApp.
      </>
    ),
  },
];

const FAQ: { q: string; a: string }[] = [
  { q: "What does the learner see?", a: "« My Learning Space » → Story Mode: they create their character once (name, job, country, avatar), then see their seasons and the others with their price. A season shows the city map, « Continue the story », the episodes and their conversation time left. Each episode: intro scene → video → lessons and activities → conversation → outro scene." },
  { q: "Which unit activities are played?", a: "Lessons and the practice Lab activities (listening, gaps, matching, sentence builder, true / false, complete the words, repeat after, dictation). The unit's speaking challenge, writing tasks and role-plays are left out: the episode's conversation replaces them." },
  { q: "What if the learner fails the conversation?", a: "They read the debrief and try again. After 2 tries below the pass score, « Continue anyway » lets them go on, so nobody is stuck." },
  { q: "What happens when the minutes run out?", a: "The season's minutes count only its conversations (not the monthly Talk with Coach Ish minutes). When they're used up, the call can't start: the learner can continue the story anyway, or you add extra minutes on their page." },
  { q: "What do the characters remember?", a: "The learner's job, country and a few facts from the story. Learners see this list on the season page and can delete anything. Sensitive data is never kept." },
  { q: "Can I reuse a season file?", a: "Yes: « Export JSON » on a season, « Import JSON » on the Story Mode page (tick « Replace » to update a season with the same short name — learner progress is kept)." },
];

async function Guide() {
  await connection();
  const me = await requireStaff("/admin/story/guide");
  if (!can.editStory(actorOf(me))) redirect("/admin");
  return (
    <div className="grid max-w-5xl gap-6">
      <PageHeader title="How Story Mode works" back={{ href: "/admin/story", label: "Story Mode" }} subtitle="Paid seasons where the learner is the main character. Story Mode reuses what already exists — course units and Talk with Coach Ish — and adds the story around it." />

      <section className="relative overflow-clip rounded-[2rem] bg-white p-5 shadow-[0_1px_2px_rgb(20_31_77/0.06),0_24px_48px_-20px_rgb(20_31_77/0.3)] ring-1 ring-primary/10 sm:p-7">
        <span aria-hidden className="pointer-events-none absolute -top-24 -right-16 size-72 rounded-full bg-[radial-gradient(circle,rgb(54_79_171/0.14),transparent_70%)]" />
        <p className="text-xs font-bold tracking-widest text-coral-dark uppercase">An episode in 3 steps</p>
        <h2 className="mt-1 font-heading text-2xl font-extrabold text-brand-deep sm:text-3xl">
          <span className="text-primary">Watch</span>, <span className="text-primary">learn</span>, then <span className="text-coral">prove it by talking</span>
        </h2>
        <p className="mt-2 max-w-3xl text-ink/75">A season is a story in one city (Accra, Lagos, London…) with one learning goal. Each episode opens with a short scene, then the learner goes through three steps. The next episode opens when the conversation is mastered.</p>
        <ol className="mt-5 grid gap-3 md:grid-cols-3">
          {STAGES.map((s, i) => (
            <li key={s.title} className="relative">
              <div className={cn("grid h-full gap-2 rounded-3xl bg-gradient-to-br p-5 text-white", s.tone)}>
                <span className="flex size-11 items-center justify-center rounded-2xl border-2 border-coral bg-white text-coral">
                  <s.icon className="size-6" aria-hidden />
                </span>
                <p className="font-heading text-xl font-extrabold">{s.title}</p>
                <p className="text-sm text-white/85">{s.text}</p>
              </div>
              {i < STAGES.length - 1 ? <ArrowRight className="absolute top-1/2 -right-3 z-10 hidden size-6 -translate-y-1/2 rounded-full bg-white p-1 text-primary shadow md:block" aria-hidden /> : null}
            </li>
          ))}
        </ol>
        <div className="mt-4 grid gap-2 rounded-2xl bg-brand-soft/60 p-4 text-sm text-ink/80 sm:grid-cols-3">
          <p>
            <b className="text-brand-deep">You create:</b> the season, its characters, places, scenes and conversations.
          </p>
          <p>
            <b className="text-brand-deep">You reuse:</b> course units (lessons + Lab activities) and Lab AI role-plays.
          </p>
          <p>
            <b className="text-brand-deep">Learners pay for:</b> access to a season, with conversation minutes included.
          </p>
        </div>
      </section>

      <section aria-labelledby="steps" className="grid gap-3">
        <h2 id="steps" className="font-heading text-xl font-extrabold text-brand-deep">
          Build a season, step by step
        </h2>
        <ol className="grid gap-3 sm:grid-cols-2">
          {STEPS.map((s, i) => (
            <li key={s.title} className="flex gap-4 rounded-3xl border border-border bg-card p-5">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-brand-soft text-primary">
                <s.icon className="size-5" aria-hidden />
              </span>
              <div className="grid gap-1">
                <p className="font-heading text-lg font-extrabold text-brand-deep">
                  <span className="text-coral-dark">{i + 1}.</span> {s.title}
                </p>
                <p className="text-sm leading-relaxed text-ink/75">{s.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="faq" className="grid gap-3">
        <h2 id="faq" className="font-heading text-xl font-extrabold text-brand-deep">
          Good to know
        </h2>
        <div className="grid gap-2">
          {FAQ.map((f) => (
            <details key={f.q} className="group rounded-2xl border border-border bg-card">
              <summary className="cursor-pointer list-none px-5 py-4 font-semibold text-brand-deep marker:hidden">
                <span className="flex items-center justify-between gap-3">
                  {f.q}
                  <ArrowRight className="size-4 shrink-0 text-primary transition group-open:rotate-90" aria-hidden />
                </span>
              </summary>
              <p className="px-5 pb-4 text-sm leading-relaxed text-ink/75">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      <div className="flex flex-wrap gap-2">
        <Link href="/admin/story" className={btn.primary}>
          Go to the seasons <ArrowRight className="size-4" aria-hidden />
        </Link>
        <Link href="/admin/labo" className={btn.secondary}>
          Open the Lab (role-plays)
        </Link>
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Guide />
    </Suspense>
  );
}
