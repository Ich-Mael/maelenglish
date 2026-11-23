# Decisions

Technical choices for the learning-experience phase (spec `MaelEnglish_Platform_Spec.pdf` v1.2). The spec asks for these to be recorded here, together with deviations from its recommendations. Prices were checked on 2026-11-20 and must be re-checked before committing money.

## Deviations from the spec

| Spec recommendation | Decision | Why |
|---|---|---|
| PostgreSQL (Supabase) with row-level security | **Keep MongoDB** (Mongoose, Atlas) | The app, models, tests and deploy already run on it. Isolation (learner and coach) is enforced server-side in every page and action, the same as for courses today (`courseAccess`, `src/lib/admin/permissions.ts`), and covered by automated tests that stand in for RLS (`tests/coach-isolation.test.ts` once coaches are built). |
| Email + Google + phone OTP auth | **Keep the custom auth** | It already supports login by username, email or WhatsApp number, plus activation links (see CLAUDE.md). Google login can be added later. |
| FR + EN interface | **English app, French explanations** (owner decision 2026-11-22) | The signed-in learner app and the admin are in English; feedback and explanations stay in French, as the spec asks for A2–B1 learners. The public site, auth pages and emails are still French. |
| Plans, payments, AI-minute metering per plan (BIL-01) | **Next phase** (user decision) | Until then, AI usage is metered with one default monthly cap per learner plus a per-learner override in admin. |
| Coach auto-assignment, backup coach, oversight dashboards (TEAM-03/04) | **Next phase** (user decision) | For now an admin assigns each learner's main coach by hand (`User.coachId`). |

## Providers

All providers sit behind internal interfaces in `src/lib/ai/` (`SpeechService`, `PronunciationService`, `TtsService`, `FeedbackService`, `ConversationEngine`). Fake implementations exist for tests, so CI never calls a live API, and each provider can be swapped.

### File storage: Cloudflare R2
- S3-compatible API, so the code uses `@aws-sdk/client-s3` and can move to any S3 service.
- **No egress fees.** That matters because learners and coaches replay audio constantly.
- Standard storage is about $0.015 per GB-month. Free tier: 10 GB, 1 M writes and 10 M reads per month.
- Browsers upload directly with short-lived presigned PUT URLs, so audio never goes through the Node server. Private files (learner recordings, voice notes) are read through short-lived signed GET URLs; public course media can use a public bucket or domain.

### Speech (STT, pronunciation assessment, neural voices): Azure AI Speech
- Since 2026-11-22 the **conversation partner** goes to ElevenLabs (see « Conversation engine »); Azure keeps pronunciation assessment, speech-to-text outside conversations and short neural audio (dictionary).
- One provider covers all three needs:
  - **pronunciation assessment** with accuracy, fluency, completeness and prosody scores at word and phoneme level;
  - **speech-to-text** with word timestamps;
  - **neural TTS** with the accents the spec asks for, including Nigerian, British, American, Indian and Kenyan voices.
- Pricing as published or reported on community threads: about $1–1.3 per audio hour in real time, lower with the short-audio or batch paths. Re-check in the Azure calculator for the chosen region (West Europe, close to the Render Frankfurt service).
- **Known limitation:** Azure scores against native-speaker models, and users report strict or inconsistent scores on learner speech. There is no independent benchmark of providers on French-accented English. Following spec §13, build a test set of 30+ real recordings from francophone learners. If Azure underperforms, compare it with **Speechace**, swapping it in behind `PronunciationService`.
- **Audio format:** browsers record `audio/webm;codecs=opus` (Chrome) or `audio/mp4` (Safari), but Azure's short-audio REST API wants WAV or Ogg/Opus. Convert before the speech calls, either with client-side Ogg/Opus encoding or with server-side conversion. **Decide in sub-phase 3**, the first feature that sends audio to Azure. Recordings only replayed by people, such as coach submissions and voice notes, keep the browser's format.

### LLM (drill feedback, challenge feedback, debriefs, coach help): Claude
- Official `@anthropic-ai/sdk`. Debriefs and challenge feedback use **Claude Sonnet 5.5** (`claude-sonnet-5-5`) for quality. Fast grading and in-conversation turns use **Claude Haiku 5.5** (`claude-haiku-5-5`) for latency and cost.
- Every JSON output is validated with **Zod** (already in the project), retried once if invalid, then shown in a reduced form (spec AIC-04).

### Conversation engine (AI speaking partner): ElevenLabs for the conversation, Azure for scoring (owner decision 2026-11-22)
- **Split by job:**

  | Job | Provider | Why |
  |---|---|---|
  | AI speaking partner: voice, listening, turn-taking, interruptions | **ElevenLabs** (Agents platform, Claude as the LLM) | Most natural, expressive voices for a 10-minute conversation; the real-time turn-taking is handled by the platform instead of being built by hand; a **cloned « Coach Ish » voice** (from Ismaël's recordings, with his consent) fits the personal branding; voice library with African English accents. |
  | Pronunciation assessment (word / phoneme scores) | **Azure AI Speech** | ElevenLabs doesn't score pronunciation against a reference text. |
  | Single-word / short audio (dictionary, already built) | **Azure neural TTS** | A fraction of ElevenLabs' price per character; expressiveness barely matters for one word. |

- **The brain stays Claude:** scenario prompts, persona and coaching style live in Claude (Haiku 5.5 for turns, Sonnet 5.5 for the debrief), plugged into ElevenLabs as a custom LLM, so the provider of the voice can change without rewriting the scenarios. Keep it behind `ConversationEngine`.
- **Before building (sub-phase 4), verify:**
  - current ElevenLabs Agents pricing per minute (last known: on the order of $0.10 / min, plus Claude) against the monthly AI-minutes cap (`aiMonthlyMinutes`);
  - recognition of French-accented English: run the 30+ learner-recording test set on ElevenLabs' speech-to-text and Azure's;
  - latency on a throttled 4G connection from West Africa (spec AIC-01: median response under 1.5 s), and a **degraded mode** for weak connections (record a turn → get the reply, no live streaming);
  - the voice clone's terms (consent, commercial use) before using Coach Ish's voice.
- **As built (2026-11-22):**
  - **The LLM is Claude Haiku 5.5 run by ElevenLabs** (`agent.prompt.llm: "claude-haiku-5-5"`, in their model list), not our own « custom LLM » endpoint: a custom LLM needs a public OpenAI-compatible streaming endpoint (not testable locally, one more service to keep fast). The prompt still comes from our scenario data (`src/lib/conversation/prompt.ts`), so the scenarios don't depend on ElevenLabs. Its cost is billed by ElevenLabs with the call.
  - **One private agent per scenario version × difficulty**, created through the API on first use and reused (`ConversationAgent`, key = hash of the agent spec; older versions deleted). The browser only gets a 15-minute signed URL: the prompt can't be changed from the client (ElevenLabs' per-session « overrides » are sent by the browser, so they weren't used).
  - The transcript, duration and cost are read **from ElevenLabs' server** after the call, never from the browser. Calls the browser never reported finished are metered when the learner starts the next one.
  - **No push-to-talk**: ElevenLabs always detects turns by voice. The learner has « Mute » instead, and difficulty 1–2 make the agent wait longer (`turn_eagerness: patient`, longer `turn_timeout`). Deviation from spec AIC-01 (push-to-talk by default).
  - **Debrief by Claude Sonnet 5.5** (Zod schema close to spec §10.3, retried once; the transcript is kept when it fails and the debrief can be retried). Pronunciation is « coming soon » in the debrief until Azure scores audio.
  - Not built yet: degraded mode for weak connections (record a turn → reply), « Retry this moment » (AIC-04), phrases to reuse added to a review deck (needs spaced repetition), custom interview prep (AIC-05), a cloned « Coach Ish » voice (create it in ElevenLabs, then pick it in the scenario's voice list).
  - **Cost and budget (2026-11-23):** a real call used ~455 ElevenLabs credits per minute (1,700 credits for 3 min 44 s, voice + Claude Haiku included). On Pro (600k credits / month, $37.13 / month the first year billed annually, then $82.50) that is ~1,320 minutes a month for the whole platform, ~$0.03 a minute the first year and ~$0.06 after (Scale: 1.8M credits, $249.17, ~3,960 minutes, ~$0.06). Prices are set on the post-promotion cost. The plan's credits are a shared pool: a platform budget in admin stops new calls before it runs out and emails admins at the warning threshold. Suggested offer (owner to decide): 20 min / month included with every course (≈ 800 FCFA cost), packs of 60 min ≈ 5,000 FCFA, 120 min / month ≈ 10,000 FCFA; selling packs needs the payments phase.
  - **Recordings (2026-11-23):** every call's audio is copied from ElevenLabs to our R2 after the call (≈ 1 MB per minute, ~$0.015 per GB-month: negligible), private to the learner, their coach and admins. Learners are told before the call; only admins can delete a recording (owner decision — the spec's « learner can delete any recording » applies to challenge recordings, not to role-play calls).
  - SDK: `@elevenlabs/react` 1.20.3 (published 2026-11-02), loaded only on the call screen.
- **Superseded:** the earlier default « Option A: Azure STT → Claude → Azure TTS pipeline » (more engineering, flatter voice). Fallbacks if ElevenLabs fails the checks: that Azure pipeline, or a real-time speech-to-speech API (e.g. OpenAI Realtime, billed per audio token).

## Metering
- `AiUsage` records every paid call: learner, kind, units (audio seconds or tokens), estimated cost, day.
- Before any paid call, check the learner's monthly cap. The default is set in admin and can be overridden per learner. Staff previews don't count against learner caps.
- An admin page shows cost per learner and per day.

## Packages (exact versions, published at least 2 weeks before installation)
- `@aws-sdk/client-s3` 3.1163.0, `@aws-sdk/s3-request-presigner` 3.1163.0 (2026-11-05)
- `@anthropic-ai/sdk` ^1.12.0, installed 2026-11-22 with the Lab « writing task » (first feature calling Claude: correction by **Claude Haiku 5.5**, owner choice — fast, cheapest; structured output with Zod, `src/lib/ai/claude.ts`)
- `zod` 4.6.7, already installed

### Dictionary: Free Dictionary API + Claude (2026-11-22)
- English definitions, phonetics and native audio from the **Free Dictionary API** (dictionaryapi.dev): free, no key, no service guarantee and patchy on business jargon. Mitigated by caching every word (`DictionaryEntry`, one call per word ever) and by an AI-only entry when the word is missing.
- French translation, French usage note and a business example from **Claude Haiku 5.5** (cheapest model, cached per word).
- Alternatives considered: Merriam-Webster (commercial licence needed, English only), Oxford / Collins (paid).

### Dictionary pronunciation: Azure neural voices (2026-11-22)
- The Free Dictionary API's recordings (Wiktionary uploads) are missing for many words and uneven in accent and quality; the browser's voice is robotic on low-end Android.
- Words and their « At work » example are read by **Azure AI Speech neural voices** (US Jenny, UK Sonia), normal and 75 % speed — the provider already chosen for speech. Generated on first play, stored in R2 and shared, so each audio is paid once (~$15 per million characters; a word is under 10).
- Considered: Google Cloud TTS / Amazon Polly (same quality, a second vendor), ElevenLabs / OpenAI voices (overkill for single words), Merriam-Webster / Oxford (human recordings, commercial licence, MW US-only), Forvo (uneven speakers).
