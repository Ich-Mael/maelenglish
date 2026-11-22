"use client";

import { useState } from "react";
import { ItemListEditor, newItemId } from "./item-list-editor";
import { inputCls } from "@/components/admin/ui";
import { ImageField } from "@/components/admin/image-field";
import { TFNG_ANSWERS, docSentences, type TfngAnswer, type TfngContent, type TfngStatement } from "@/lib/lab/types";
import { cn } from "cn";

/*
 * R1 true / false / not given editor (Labo, English): the document — a picture (e.g. a screenshot of
 * an email) and / or its text (English, one sentence per line, numbered live) —, an optional title
 * shown to learners (French), and the statements — each with its
 * answer, the sentence that proves it (true / false) and a French explanation.
 * Sent as JSON in « c_json » (cleaned on the server).
 */

const LABEL: Record<TfngAnswer, string> = { true: "True", false: "False", not_given: "Not given" };
const blank = (id = newItemId()): TfngStatement => ({ id, text: "", answer: "true", evidence: null, explanation: "" });

export function TfngEditor({ initial, imageUrl }: { initial: Partial<TfngContent>; imageUrl: string | null }) {
  const [docTitle, setDocTitle] = useState(initial.docTitle ?? "");
  const [text, setText] = useState(initial.text ?? "");
  const [image, setImage] = useState({ id: initial.imageMediaId ?? "", url: imageUrl });
  const [imageAlt, setImageAlt] = useState(initial.imageAlt ?? "");
  const [statements, setStatements] = useState<TfngStatement[]>(() => (initial.statements?.length ? initial.statements : [blank("t1")])); // fixed id: a random one differs between the server render and hydration
  const sentences = docSentences(text);
  // With 2+ sentences of text, proofs are picked from it; a picture alone takes a typed quote.
  const hasText = sentences.length >= 2;
  const json = JSON.stringify({ docTitle, text, statements, imageMediaId: image.id, imageAlt });

  return (
    <section className="grid gap-4">
      <input type="hidden" name="c_json" value={json} />
      <div className="grid gap-3 rounded-2xl border border-border p-4">
        <h3 className="font-heading font-extrabold text-brand-deep">The document</h3>
        <label className="grid gap-1 text-sm sm:max-w-md">
          <span className="font-medium">Title shown to learners (optional, French)</span>
          <input className={inputCls} value={docTitle} maxLength={120} onChange={(e) => setDocTitle(e.target.value)} placeholder="E-mail de la DRH" />
        </label>
        <div className="grid gap-2">
          <span className="text-sm font-medium">Picture of the document (optional): a screenshot of an email, a notice, a form…</span>
          <ImageField value={image.id} url={image.url} alt={imageAlt} maxSide={2000} noun="document picture" onChange={(id, url) => setImage({ id, url })} />
          {image.id && (
            <label className="grid gap-1 text-sm sm:max-w-xl">
              <span className="font-medium">Picture description (optional, French)</span>
              <input className={inputCls} value={imageAlt} maxLength={300} onChange={(e) => setImageAlt(e.target.value)} placeholder="Capture d'un e-mail de demande de demi-journée de congé" />
              <span className="text-xs text-muted-foreground">Read by screen readers. Kept sharp up to 2000 px so small text stays readable.</span>
            </label>
          )}
        </div>
        <label className="grid gap-1 text-sm">
          <span className="font-medium">{image.id ? "Text of the document (optional: the transcript — proofs are then highlighted in it)" : "Text (English), one sentence per line"}</span>
          <textarea
            lang="en"
            className={cn(inputCls, "h-auto py-2 leading-relaxed")}
            rows={8}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={"Dear team,\nThe Monday meeting is moved to Tuesday at 10 a.m.\nPlease bring your sales figures for October.\nLunch will be served after the meeting."}
          />
          <span className="text-xs text-muted-foreground">A real work document works best: an email, a notice, a memo, a job ad. Each line is a sentence learners can be shown as proof.</span>
        </label>
        {sentences.length > 0 && (
          <ol className="grid gap-1 rounded-xl bg-muted/40 p-3 text-sm" lang="en">
            {sentences.map((s, i) => (
              <li key={i} className="flex gap-2">
                <span className="w-5 shrink-0 text-right font-mono text-xs leading-5 text-muted-foreground">{i + 1}</span>
                <span>{s}</span>
              </li>
            ))}
          </ol>
        )}
      </div>

      <ItemListEditor
        items={statements}
        onChange={setStatements}
        blank={() => blank()}
        copy={(s) => ({ ...s, id: newItemId() })}
        addLabel="Add a statement"
        noun="statement"
        max={15}
        render={(s, update) => (
          <div className="grid gap-3">
            <label className="grid gap-1 text-sm">
              <span className="font-medium">Statement (English)</span>
              <input lang="en" className={inputCls} value={s.text} maxLength={300} onChange={(e) => update({ text: e.target.value })} placeholder="The meeting is on Monday." />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-1 text-sm">
                <span className="font-medium">Answer</span>
                <div className="flex gap-1.5" role="radiogroup" aria-label="Answer">
                  {TFNG_ANSWERS.map((a) => (
                    <button
                      key={a}
                      type="button"
                      role="radio"
                      aria-checked={s.answer === a}
                      onClick={() => update({ answer: a, evidence: a === "not_given" ? null : s.evidence })}
                      className={cn("h-10 flex-1 rounded-xl border-2 text-sm font-semibold transition", s.answer === a ? "border-primary bg-primary text-white" : "border-border bg-card text-brand-deep hover:border-primary/40")}
                    >
                      {LABEL[a]}
                    </button>
                  ))}
                </div>
              </div>
              {hasText ? (
              <label className="grid gap-1 text-sm">
                <span className="font-medium">Proof in the text</span>
                <select
                  className={inputCls}
                  value={s.evidence === null ? "" : String(s.evidence)}
                  disabled={s.answer === "not_given"}
                  onChange={(e) => update({ evidence: e.target.value === "" ? null : Number(e.target.value) })}
                >
                  <option value="">{s.answer === "not_given" ? "None: the text doesn't say" : "Pick the sentence…"}</option>
                  {sentences.map((x, i) => (
                    <option key={i} value={i}>
                      {i + 1}. {x.length > 70 ? `${x.slice(0, 70)}…` : x}
                    </option>
                  ))}
                </select>
              </label>
              ) : (
                <label className="grid gap-1 text-sm">
                  <span className="font-medium">Proof (optional): quote it from the picture</span>
                  <input lang="en" className={inputCls} value={s.quote ?? ""} maxLength={300} disabled={s.answer === "not_given"} onChange={(e) => update({ quote: e.target.value })} placeholder={s.answer === "not_given" ? "None: the document doesn't say" : "I will be back at the office in the afternoon."} />
                </label>
              )}
            </div>
            <label className="grid gap-1 text-sm">
              <span className="font-medium">Explanation (optional, French)</span>
              <input className={inputCls} value={s.explanation} maxLength={300} onChange={(e) => update({ explanation: e.target.value })} placeholder="La réunion est déplacée au mardi." />
            </label>
          </div>
        )}
      />
    </section>
  );
}
