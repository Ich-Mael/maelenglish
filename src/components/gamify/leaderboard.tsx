import { Medal, Trophy } from "lucide-react";
import { weeklyLeaderboard } from "@/lib/gamification/service";
import { cn } from "cn";

const MEDALS = ["text-xp", "text-[#9aa3b8]", "text-[#c97b3d]"];

/** This week's XP ranking for one course (first name + initial only). */
export async function Leaderboard({ courseId, meId }: { courseId: string; meId: string }) {
  const rows = await weeklyLeaderboard(courseId, meId);
  return (
    <section className="rounded-3xl border-2 border-border bg-card p-5 sm:p-6" aria-labelledby="leaderboard-title">
      <h2 id="leaderboard-title" className="flex items-center gap-2 text-xl font-extrabold text-brand-deep">
        <Trophy className="size-5 text-xp" aria-hidden /> Classement de la semaine
      </h2>
      <p className="mb-4 text-sm text-muted-foreground">XP gagnés depuis lundi dans ce cours.</p>
      {rows.length === 0 ? (
        <p className="rounded-2xl bg-muted/50 p-4 text-center text-sm text-muted-foreground">Personne n&apos;a encore gagné d&apos;XP cette semaine. Prenez la tête !</p>
      ) : (
        <ol className="grid gap-1.5">
          {rows.map((r, i) => (
            <li
              key={r.userId}
              className={cn(
                "flex items-center gap-3 rounded-2xl px-3 py-2",
                r.me ? "bg-brand-soft ring-2 ring-primary/30" : i % 2 === 0 ? "bg-muted/40" : "",
                i > 0 && rows[i - 1].rank + 1 !== r.rank && "mt-3",
              )}
            >
              <span className="w-7 text-center font-heading font-extrabold text-ink/70">
                {r.rank <= 3 ? <Medal className={cn("mx-auto size-6", MEDALS[r.rank - 1])} aria-label={`${r.rank}e`} /> : r.rank}
              </span>
              <span className={cn("flex-1 truncate font-semibold", r.me ? "text-primary" : "text-ink")}>
                {r.name}
                {r.me && " (vous)"}
              </span>
              <span className="font-heading font-bold text-[#9a6200]">{r.xp} XP</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
