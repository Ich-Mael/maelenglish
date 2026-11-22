import { Select, TextArea } from "@/components/admin/ui";
import { RichTextEditor } from "@/components/admin/rich-text-editor";
import { MAX_SECONDS, PREP_SECONDS, type ActivityType, type SpeakingChallengeContent, type ListeningContent, type GapsContent, type ListenGapsContent, type MatchContent, type SentenceContent, type TfngContent, type CompleteWordsContent } from "@/lib/lab/types";
import { reviewMediaUrl } from "@/lib/media";
import { ListeningEditor } from "./listening-editor";
import { GapsEditor } from "./gaps-editor";
import { ListenGapsEditor } from "./listen-gaps-editor";
import { SentenceEditor } from "./sentence-editor";
import { MatchEditor } from "./match-editor";
import { TfngEditor } from "./tfng-editor";
import { CompleteWordsEditor } from "./complete-words-editor";
import { PromptField } from "./prompt-field";
import { AudioInput } from "./audio-input";

/*
 * Type-specific fields of a Labo activity, inside the activity form. Field names start with
 * « c_ » (collected into `content` by saveActivityAction, then cleaned by src/lib/lab/content.ts).
 * One editor per type, designed type by type.
 */

const seconds = (n: number) => (n === 0 ? "None" : n < 60 ? `${n} seconds` : n === 60 ? "1 minute" : n % 60 ? `${Math.floor(n / 60)} min ${n % 60}` : `${n / 60} minutes`);

export async function ActivityFields({ type, content }: { type: ActivityType; content: unknown }) {
  switch (type) {
    case "listen_choose": {
      const c = content as Partial<ListeningContent>;
      // Staff page (Labo rights checked by the page): clips are course content.
      const audioUrl = c.audioMediaId ? await reviewMediaUrl(c.audioMediaId).catch(() => null) : null;
      return (
        <>
          <RichTextEditor
            label="Situation (optional)"
            name="c_context"
            minHeight={140}
            defaultValue={c.context ?? ""}
            hint="In French, shown above the player. E.g. « Vous attendez votre vol à l'aéroport. Écoutez l'annonce. »"
          />
          <ListeningEditor initial={c} audioUrl={audioUrl} />
        </>
      );
    }
    case "fill_gaps":
      return <GapsEditor initial={content as Partial<GapsContent>} />;
    case "true_false_ng": {
      const c = content as Partial<TfngContent>;
      const imageUrl = c.imageMediaId ? await reviewMediaUrl(c.imageMediaId).catch(() => null) : null;
      const ids = [...new Set((c.statements ?? []).map((s) => s.audioMediaId ?? "").filter(Boolean))];
      const audioUrls = Object.fromEntries(await Promise.all(ids.map(async (id) => [id, await reviewMediaUrl(id).catch(() => null)] as const)));
      return <TfngEditor initial={c} imageUrl={imageUrl} audioUrls={audioUrls} />;
    }
    case "complete_words": {
      const c = content as Partial<CompleteWordsContent>;
      const audioUrl = c.audioMediaId ? await reviewMediaUrl(c.audioMediaId).catch(() => null) : null;
      return (
        <>
          <CompleteWordsEditor initial={c} />
          <AudioInput name="c_audioMediaId" label="Audio of the whole text (optional: learners can play it on the results page)" initialId={c.audioMediaId ?? ""} initialUrl={audioUrl} />
        </>
      );
    }
    case "sentence_builder": {
      const c = content as Partial<SentenceContent>;
      const ids = [...new Set((c.items ?? []).map((i) => i.audioMediaId).filter(Boolean))];
      const audioUrls = Object.fromEntries(await Promise.all(ids.map(async (id) => [id, await reviewMediaUrl(id).catch(() => null)] as const)));
      return <SentenceEditor initial={c} audioUrls={audioUrls} />;
    }
    case "match_pairs":
    case "listen_match": {
      const c = content as Partial<MatchContent>;
      const ids = [...new Set((c.pairs ?? []).flatMap((p) => [p.audioMediaId, p.rightAudioMediaId ?? ""]).filter(Boolean))];
      const audioUrls = Object.fromEntries(await Promise.all(ids.map(async (id) => [id, await reviewMediaUrl(id).catch(() => null)] as const)));
      return <MatchEditor initial={c} audioUrls={audioUrls} listen={type === "listen_match"} />;
    }
    case "listen_fill_gaps": {
      const c = content as Partial<ListenGapsContent>;
      const audioUrl = c.audioMediaId ? await reviewMediaUrl(c.audioMediaId).catch(() => null) : null;
      return (
        <>
          <RichTextEditor
            label="Situation (optional)"
            name="c_context"
            minHeight={120}
            defaultValue={c.context ?? ""}
            hint="In French, shown above the player. E.g. « Fatou présente son travail à un nouveau collègue. Écoutez et complétez. »"
          />
          <ListenGapsEditor initial={c} audioUrl={audioUrl} />
        </>
      );
    }
    case "speaking_challenge": {
      const c = content as Partial<SpeakingChallengeContent>;
      const [modelUrl, promptUrl] = await Promise.all([
        c.modelAnswerAudioMediaId ? reviewMediaUrl(c.modelAnswerAudioMediaId).catch(() => null) : null,
        c.promptMediaId ? reviewMediaUrl(c.promptMediaId).catch(() => null) : null,
      ]);
      return <SpeakingChallengeFields c={c} modelUrl={modelUrl} promptUrl={promptUrl} />;
    }
  }
}

function SpeakingChallengeFields({ c, modelUrl, promptUrl }: { c: Partial<SpeakingChallengeContent>; modelUrl: string | null; promptUrl: string | null }) {
  return (
    <>
      <RichTextEditor
        label="Instructions"
        name="c_instructions"
        minHeight={200}
        defaultValue={c.instructions ?? ""}
        hint="What the learner must say, reusing the unit's vocabulary (in French, for learners). E.g. « Vous êtes chef de cabine : accueillez les passagers, annoncez la destination et la durée du vol. » or « Décrivez cette photo : le lieu, les personnes, ce qu'elles font. »"
      />
      <PromptField initial={{ type: c.promptType ?? "text", mediaId: c.promptMediaId ?? "", videoUrl: c.promptVideoUrl ?? "", alt: c.promptAlt ?? "" }} mediaUrl={promptUrl} />
      <TextArea
        label="Questions to answer (optional)"
        name="c_questions"
        rows={3}
        defaultValue={(c.questions ?? []).join("\n")}
        placeholder={"What is the woman doing?\nWhat would you do in her place? Why?"}
        hint="One question per line, up to 10. The learner answers them in the recording; shown numbered under the prompt and to the coach while grading."
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <Select label="Maximum length" name="c_maxSeconds" defaultValue={String(c.maxSeconds ?? 60)} options={MAX_SECONDS.map((n) => ({ value: String(n), label: seconds(n) }))} />
        <Select label="Preparation time" name="c_prepSeconds" defaultValue={String(c.prepSeconds ?? 0)} options={PREP_SECONDS.map((n) => ({ value: String(n), label: seconds(n) }))} />
      </div>
      <TextArea
        label="Must include (checklist)"
        name="c_mustInclude"
        rows={4}
        defaultValue={(c.mustInclude ?? []).join("\n")}
        placeholder={"une salutation\nvotre nom\nvotre métier et votre entreprise (verbe to be)\nune formule de politesse pour finir"}
        hint="One item per line (French). Shown to the learner before recording and to the coach while grading."
      />
      <TextArea
        label="Model answer (optional)"
        name="c_modelAnswerText"
        rows={4}
        defaultValue={c.modelAnswerText ?? ""}
        placeholder="Good evening, nice to meet you. I'm Mael. I'm an English coach…"
        hint="In English. Shown to the learner once their recording is sent."
      />
      <AudioInput name="c_modelAnswerAudioMediaId" label="Model answer audio (optional)" initialId={c.modelAnswerAudioMediaId ?? ""} initialUrl={modelUrl} />
    </>
  );
}
