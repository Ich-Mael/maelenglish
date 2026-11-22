"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Expand, FileSearch, FileText } from "lucide-react";
import { submitLabAttempt } from "@/app/(app)/learn-actions";
import { pushReward } from "@/components/gamify/reward-store";
import { playSound } from "@/components/gamify/sound";
import { checkItem, gradeActivity } from "@/lib/lab/grade";
import { starsFor } from "@/lib/lab/meta";
import { TFNG_ANSWERS, TFNG_LABEL, docSentences, type TfngContent } from "@/lib/lab/types";
import { useExercise } from "../shell/use-exercise";
import { CheckBar, ExerciseHeader, FeedbackPanel, ResultsScreen, type ExerciseMeta } from "../shell/parts";
import { ChoiceCards } from "../ui/choice-cards";
import { reshuffle } from "../shell/shuffle";
import { cn } from "cn";

/*
 * R1 — True / false / not given (catalogue): the work document stays at the top (foldable), one
 * statement per screen with Vrai / Faux / Non mentionné. At correction the sentence that proves
 * the answer is highlighted in the document and quoted in the feedback. The results show the
 * document with every proof. Checked here, the server recomputes the score (`submitLabAttempt`).
 * `preview` (Lab page): graded locally.
 */

type Result = { score: number; stars: number; bestScore?: number; xp?: number; items: { id: string; correct: boolean }[] };

const OPTIONS = TFNG_ANSWERS.map((id) => ({ id, text: TFNG_LABEL[id] }));

/** The document, one sentence per line; `highlight` = indexes of the proving sentences. */
function Doc({ title, sentences, highlight, tone = "right" }: { title: string; sentences: string[]; highlight: number[]; tone?: "right" | "wrong" }) {
  return (
    <div lang="en" className="grid gap-1.5 leading-relaxed text-ink">
      {title && (
        <p lang="fr" className="mb-1 font-heading font-extrabold text-brand-deep">
          {title}
        </p>
      )}
      {sentences.map((s, i) => (
        <p key={i} className={cn("rounded-lg px-1.5 py-0.5 transition-colors", highlight.includes(i) && (tone === "right" ? "bg-brand-soft font-semibold text-brand-deep ring-2 ring-primary/30" : "bg-coral-soft/70 font-semibold ring-2 ring-coral/40"))}>
          {s}
        </p>
      ))}
    </div>
  );
}

/** The document picture: full width, tap to open it full size (small text in screenshots). */
function DocImage({ url, alt }: { url: string; alt: string }) {
  return (
    <a href={url} target="_blank" rel="noopener" className="group relative block overflow-clip rounded-2xl border border-border bg-muted" aria-label="Ouvrir le document en grand">
      {/* eslint-disable-next-line @next/next/no-img-element -- signed storage URL, no image optimiser */}
      <img src={url} alt={alt} className="w-full object-contain" />
      <span aria-hidden className="absolute right-2 bottom-2 flex items-center gap-1 rounded-full bg-white/95 px-2.5 py-1 text-xs font-bold text-brand-deep shadow">
        <Expand className="size-3.5" /> Agrandir
      </span>
    </a>
  );
}

export function TfngPlayer({
  courseId,
  stepId,
  passScore,
  lessonHref,
  title,
  level,
  skills,
  instructions,
  maelTip,
  content,
  imageUrl,
  courseHref,
  nextHref,
  readOnly,
  preview,
}: {
  courseId?: string;
  stepId?: string;
  passScore?: number | null;
  lessonHref?: string | null;
  title: string;
  level?: string;
  skills?: string[];
  instructions?: string;
  maelTip?: string;
  content: TfngContent;
  /** The document as a picture (optional; the text, if any, is then its transcript). */
  imageUrl?: string | null;
  courseHref: string;
  nextHref: string;
  readOnly?: boolean;
  preview?: boolean;
}) {
  const router = useRouter();
  const [statements, setStatements] = useState(content.statements);
  const ex = useExercise<string>(statements.map((s) => s.id));
  const [docOpen, setDocOpen] = useState(true);
  const statementBox = useRef<HTMLElement>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [timeS, setTimeS] = useState(0);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  const sentences = docSentences(content.text);
  const hasText = sentences.length > 0;
  /** The proof of a statement: its sentence of the text, else the quote typed by staff (picture only). */
  const proofOf = (s: TfngContent["statements"][number]) => (s.evidence !== null && sentences[s.evidence]) || s.quote || "";
  const meta: ExerciseMeta = { title, typeLabel: "Vrai, faux ou non mentionné", icon: FileSearch, level, skills, instructions: instructions || "Lisez le document, puis dites si chaque phrase est vraie, fausse ou non mentionnée." };
  const st = statements[ex.index];
  const revealed = ex.phase === "feedback";

  const onCheck = () => {
    const ok = checkItem("true_false_ng", content, st.id, ex.answer);
    playSound(ok ? "correct" : "wrong");
    setDocOpen(true);
    ex.check(ok);
    // Phones: the document above pushes the feedback down — bring it into view.
    window.setTimeout(() => statementBox.current?.scrollIntoView({ behavior: "smooth", block: "end" }), 80);
  };

  const finish = () => {
    const answers = { ...ex.firstTry };
    const timeSpentS = ex.elapsedS();
    setTimeS(timeSpentS);
    if (preview || !courseId || !stepId) {
      const g = gradeActivity("true_false_ng", content, answers);
      setResult({ score: g.score, stars: starsFor(g.score), items: g.items });
      ex.next();
      return;
    }
    setError("");
    start(async () => {
      const r = await submitLabAttempt(courseId, stepId, { answers, timeSpentS });
      if (!r.ok) return setError(r.error);
      pushReward(r.result.reward);
      setResult({ ...r.result, xp: r.result.reward?.xpGained });
      ex.next();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  };

  const restart = () => {
    setStatements((cur) => reshuffle(content.statements, cur));
    ex.restart();
    setResult(null);
    setDocOpen(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (ex.phase === "done" && result) {
    const review = result.items
      .filter((i) => !i.correct)
      .map((i) => statements.find((x) => x.id === i.id)!)
      .map((s) => ({ title: s.text, answer: TFNG_LABEL[s.answer] }));
    return (
      <div className="mx-auto grid max-w-2xl gap-5">
        <ExerciseHeader meta={meta} courseHref={courseHref} index={statements.length} total={statements.length} done />
        <ResultsScreen
          score={result.score}
          stars={result.stars}
          timeS={timeS}
          xp={result.xp}
          bestScore={result.bestScore}
          review={review}
          maelTip={maelTip}
          preview={preview}
          passScore={passScore}
          lessonHref={lessonHref}
          onRetry={restart}
          onContinue={() => router.push(nextHref)}
        >
          <details className="rounded-3xl border-2 border-border bg-card p-5" open={result.score < 100}>
            <summary className="cursor-pointer font-heading font-extrabold text-brand-deep">Le document et les preuves</summary>
            <div className="mt-3 grid gap-3">
              {imageUrl && <DocImage url={imageUrl} alt={content.imageAlt || content.docTitle || "Document"} />}
              {hasText && <Doc title={imageUrl ? "" : content.docTitle} sentences={sentences} highlight={statements.flatMap((s) => (s.evidence === null ? [] : [s.evidence]))} />}
            </div>
            <ul className="mt-4 grid gap-2">
              {statements.map((s) => (
                <li key={s.id} className="rounded-2xl bg-muted/50 px-3 py-2 text-sm">
                  <span lang="en" className="font-semibold text-ink">
                    {s.text}
                  </span>{" "}
                  → <strong className="text-primary">{TFNG_LABEL[s.answer]}</strong>
                  {proofOf(s) && (
                    <span lang="en" className="block text-ink/80">
                      « {proofOf(s)} »
                    </span>
                  )}
                  {s.explanation && <span className="block text-muted-foreground">{s.explanation}</span>}
                </li>
              ))}
            </ul>
          </details>
        </ResultsScreen>
      </div>
    );
  }

  const proof = revealed && st.evidence !== null ? [st.evidence] : [];

  return (
    <div className="mx-auto grid max-w-2xl gap-4">
      <ExerciseHeader meta={meta} courseHref={courseHref} index={ex.index} total={statements.length} />

      {/* The document: open at first, foldable to keep the statement in view on phones. */}
      <section className="rounded-3xl border-2 border-border bg-card">
        <button type="button" onClick={() => setDocOpen((o) => !o)} aria-expanded={docOpen} className="flex w-full items-center gap-3 px-4 py-3 text-left sm:px-5">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-dark to-brand-deep text-white">
            <FileText className="size-4.5" aria-hidden />
          </span>
          <span className="flex-1 font-heading font-extrabold text-brand-deep">{content.docTitle || "Le document"}</span>
          <span className="text-xs font-semibold text-muted-foreground">{docOpen ? "Replier" : "Relire le texte"}</span>
          <ChevronDown className={cn("size-5 shrink-0 text-muted-foreground transition", docOpen && "rotate-180")} aria-hidden />
        </button>
        {docOpen && (
          <div className="grid max-h-[55vh] gap-3 overflow-y-auto border-t border-border px-4 py-3 sm:max-h-none sm:px-5">
            {imageUrl && <DocImage url={imageUrl} alt={content.imageAlt || content.docTitle || "Document"} />}
            {hasText &&
              (imageUrl ? (
                // With a picture, the text is its transcript: folded, opened to show the proof.
                <details open={proof.length > 0} className="rounded-2xl bg-muted/40 px-3 py-2">
                  <summary className="cursor-pointer text-sm font-semibold text-brand-deep">Le texte du document</summary>
                  <div className="mt-2">
                    <Doc title="" sentences={sentences} highlight={proof} tone={ex.correct === false ? "wrong" : "right"} />
                  </div>
                </details>
              ) : (
                <Doc title="" sentences={sentences} highlight={proof} tone={ex.correct === false ? "wrong" : "right"} />
              ))}
          </div>
        )}
      </section>

      <section ref={statementBox} className="grid scroll-mb-28 gap-3 rounded-3xl border-2 border-border bg-card p-4 sm:p-5">
        <p className="text-xs font-bold tracking-wide text-muted-foreground uppercase">
          Affirmation {ex.index + 1} sur {statements.length}
        </p>
        <h2 id={`s-${st.id}`} lang="en" className="font-heading text-xl font-extrabold text-brand-deep">
          {st.text}
        </h2>
        <ChoiceCards options={OPTIONS} value={ex.answer} onChange={(id) => !readOnly && ex.setAnswer(id)} reveal={revealed ? { correctId: st.answer } : null} labelledBy={`s-${st.id}`} />
        {revealed && ex.correct !== null && (
          <FeedbackPanel correct={ex.correct} answer={TFNG_LABEL[st.answer]} explanation={st.explanation}>
            {proofOf(st) ? (
              <p lang="en" className="rounded-xl bg-white/70 px-3 py-2 text-sm text-ink">
                <span lang="fr" className="mr-1 text-muted-foreground">
                  Dans le document :
                </span>
                « {proofOf(st)} »
              </p>
            ) : (
              st.answer === "not_given" && <p className="text-sm text-ink">Le texte ne dit rien à ce sujet : ni vrai, ni faux.</p>
            )}
          </FeedbackPanel>
        )}
      </section>

      {error && (
        <p role="alert" className="text-sm font-semibold text-coral-dark">
          {error}
        </p>
      )}
      {readOnly ? (
        <p className="text-sm text-muted-foreground">Cours terminé : l&apos;activité reste consultable, mais plus rien n&apos;est enregistré.</p>
      ) : (
        <CheckBar phase={revealed ? "feedback" : "answer"} canCheck={ex.answer !== undefined} correct={ex.correct} isLast={ex.isLast} pending={pending} onCheck={onCheck} onRetry={ex.retry} onNext={ex.isLast ? finish : ex.next} />
      )}
    </div>
  );
}
