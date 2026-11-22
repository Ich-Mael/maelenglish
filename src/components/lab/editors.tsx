import { Input, Select, TextArea } from "@/components/admin/ui";
import { RichTextEditor } from "@/components/admin/rich-text-editor";
import { MAX_SECONDS, PREP_SECONDS, type ActivityType, type SpeakingChallengeContent, type ListeningContent, type GapsContent, type ListenGapsContent, type MatchContent, type SentenceContent, type TfngContent, type CompleteWordsContent, type RepeatContent, type WritingTaskContent, type DictationContent, type RolePlayContent, WRITING_MIN_WORDS, WRITING_MAX_WORDS, ROLEPLAY_DIFFICULTIES, ROLEPLAY_MINUTES, DIFFICULTY_LABEL } from "@/lib/lab/types";
import { conversationEngine } from "@/lib/ai";
import { VoicePicker } from "./voice-picker";
import { reviewMediaUrl } from "@/lib/media";
import { ListeningEditor } from "./listening-editor";
import { GapsEditor } from "./gaps-editor";
import { ListenGapsEditor } from "./listen-gaps-editor";
import { SentenceEditor } from "./sentence-editor";
import { MatchEditor } from "./match-editor";
import { TfngEditor } from "./tfng-editor";
import { CompleteWordsEditor } from "./complete-words-editor";
import { RepeatEditor } from "./repeat-editor";
import { ImageInput } from "./image-input";
import { DictationEditor } from "./dictation-editor";
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
    case "dictation": {
      const c = content as Partial<DictationContent>;
      const ids = [...new Set((c.items ?? []).map((i) => i.audioMediaId).filter(Boolean))];
      const audioUrls = Object.fromEntries(await Promise.all(ids.map(async (id) => [id, await reviewMediaUrl(id).catch(() => null)] as const)));
      return <DictationEditor initial={c} audioUrls={audioUrls} />;
    }
    case "role_play": {
      const c = content as Partial<RolePlayContent>;
      const voices = await (conversationEngine()?.listVoices() ?? Promise.resolve([])).catch((e) => (console.error("[roleplay] voices", e), []));
      return (
        <>
          <RichTextEditor label="Situation (for the learner)" name="c_situation" minHeight={140} defaultValue={c.situation ?? ""} hint="In French, shown first. E.g. « Vous passez un premier entretien en visio pour un poste de chargé(e) de projet dans une ONG. »" />
          <div className="grid gap-3 sm:grid-cols-2">
            <Input label="The AI plays" name="c_aiRole" defaultValue={c.aiRole ?? ""} placeholder="HR manager at an international NGO" hint="In English. The AI stays in this role." />
            <Input label="The learner plays" name="c_learnerRole" defaultValue={c.learnerRole ?? ""} placeholder="Candidate for a Project Officer position" />
          </div>
          <Input label="Setting" name="c_setting" defaultValue={c.setting ?? ""} placeholder="Video call, first-round interview, 10 minutes" />
          <TextArea label="Learner's goals" name="c_goals" rows={4} defaultValue={(c.goals ?? []).join("\n")} placeholder={"Introduce yourself in under 60 seconds\nExplain why you want this role\nGive one example of teamwork\nAsk one question about the role"} hint="One per line, 8 max. Shown to the learner as their mission; the AI makes room for each one; the debrief says which were achieved." />
          <TextArea label="Useful phrases (optional)" name="c_targetPhrases" rows={3} defaultValue={(c.targetPhrases ?? []).join("\n")} placeholder={"I have X years of experience in...\nWhat attracted me to this role is..."} hint="In English, one per line. Shown before the call and used in the debrief." />
          <TextArea label="Twists (hidden from the learner)" name="c_twists" rows={2} defaultValue={(c.twists ?? []).join("\n")} placeholder={"Ask about a gap in the CV\nAsk about salary expectations"} hint="Complications the AI brings up at a natural moment. One per line, 5 max." />
          <Input label="AI's opening line" name="c_openingLine" defaultValue={c.openingLine ?? ""} placeholder="Hello, thanks for joining. Can you hear me well?" hint="In English: the first thing the learner hears." />
          <div className="grid gap-3 sm:grid-cols-3">
            <Select label="Default difficulty" name="c_difficulty" defaultValue={String(c.difficulty ?? 2)} options={ROLEPLAY_DIFFICULTIES.map((d) => ({ value: String(d), label: `${d} · ${DIFFICULTY_LABEL[d]}` }))} />
            <Select label="Maximum length" name="c_maxMinutes" defaultValue={String(c.maxMinutes ?? 5)} options={ROLEPLAY_MINUTES.map((m) => ({ value: String(m), label: `${m} minutes` }))} />
            <VoicePicker voices={voices} initialId={c.voiceId ?? ""} initialName={c.voiceName ?? ""} />
          </div>
          <p className="rounded-xl bg-brand-soft px-3 py-2 text-xs text-brand-deep">
            The learner talks with the AI by voice (ElevenLabs, Claude Haiku 5.5 as the brain) and may pick a difficulty from 1 (very patient, slow) to 5 (fast, interrupts, pushes back). The AI never corrects during the call. At the end, Claude Sonnet 5.5 writes the debrief: scores, goals achieved, corrections, better ways to say it, 3 phrases to reuse and Mael&apos;s tip (persona in AI usage → Mael persona). Calls count against the learner&apos;s monthly AI minutes. Learners find ready role-plays on the Speaking Partner page, and you can add them to a unit as an activity.
          </p>
        </>
      );
    }
    case "writing_task": {
      const c = content as Partial<WritingTaskContent>;
      const imageUrl = c.imageMediaId ? await reviewMediaUrl(c.imageMediaId).catch(() => null) : null;
      return (
        <>
          <RichTextEditor
            label="Prompt (what the learner must write)"
            name="c_prompt"
            minHeight={180}
            defaultValue={c.prompt ?? ""}
            hint="In French, for learners. E.g. « Vous devez vous absenter vendredi. Écrivez un e-mail à votre chef pour demander un jour de congé : donnez la raison et proposez une solution pour votre travail. »"
          />
          <ImageInput name="c_imageMediaId" label="Picture (optional): something to describe or react to" initialId={c.imageMediaId ?? ""} initialUrl={imageUrl} />
          <TextArea
            label="Points to cover (optional checklist)"
            name="c_checklist"
            rows={4}
            defaultValue={(c.checklist ?? []).join("\n")}
            placeholder={"une formule de salutation\nla raison de l'absence\nune solution pour le travail\nune formule de politesse pour finir"}
            hint="One per line, 8 max. Shown to the learner, and Claude checks each point."
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <Select label="Minimum length" name="c_minWords" defaultValue={String(c.minWords ?? 60)} options={WRITING_MIN_WORDS.map((n) => ({ value: String(n), label: `${n} words` }))} />
            <Select label="Maximum length" name="c_maxWords" defaultValue={String(c.maxWords ?? 120)} options={WRITING_MAX_WORDS.map((n) => ({ value: String(n), label: `${n} words` }))} />
          </div>
          <TextArea
            label="Model answer (optional)"
            name="c_modelAnswer"
            rows={6}
            defaultValue={c.modelAnswer ?? ""}
            placeholder={"Dear Mr Traoré,\n\nI am writing to ask for a day off on Friday…"}
            hint="In English. Shown to the learner after their first correction."
          />
          <p className="rounded-xl bg-brand-soft px-3 py-2 text-xs text-brand-deep">
            Learners send their text to their coach (3 versions per activity). Each version gets an AI correction draft (Claude Haiku 5.5: score, errors with their rule, checklist, corrected text) that only the coach sees: the coach edits it, adds a comment and sends it from Grading → Writing review. Learners see it as their coach&apos;s feedback.
          </p>
        </>
      );
    }
    case "repeat_after": {
      const c = content as Partial<RepeatContent>;
      const ids = [...new Set((c.phrases ?? []).map((p) => p.audioMediaId).filter(Boolean))];
      const audioUrls = Object.fromEntries(await Promise.all(ids.map(async (id) => [id, await reviewMediaUrl(id).catch(() => null)] as const)));
      return <RepeatEditor initial={c} audioUrls={audioUrls} />;
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
