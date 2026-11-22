# Decisions

Technical choices for the learning-experience phase (spec `MaelEnglish_Platform_Spec.pdf` v1.2). The spec asks for these to be recorded here, together with deviations from its recommendations. Prices were checked on 2026-11-20 and must be re-checked before committing money.

## Deviations from the spec

| Spec recommendation | Decision | Why |
|---|---|---|
| PostgreSQL (Supabase) with row-level security | **Keep MongoDB** (Mongoose, Atlas) | The app, models, tests and deploy already run on it. Isolation (learner and coach) is enforced server-side in every page and action, the same as for courses today (`courseAccess`, `src/lib/admin/permissions.ts`), and covered by automated tests that stand in for RLS (`tests/coach-isolation.test.ts` once coaches are built). |
| Email + Google + phone OTP auth | **Keep the custom auth** | It already supports login by username, email or WhatsApp number, plus activation links (see CLAUDE.md). Google login can be added later. |
| FR + EN interface | **French only for now** | Learners are francophone; an English UI is deferred. Explanations stay in French, as the spec asks for A2–B1 learners. |
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

### Conversation engine (AI role-play): decision deferred to sub-phase 4, after measurement
- **Option A, the default to try first:** a streaming pipeline, Azure STT → Claude Haiku 5.5 (streamed) → Azure neural TTS (streamed). It reuses the same two vendors, keeps the scenario prompts and persona in Claude, and is cheap per minute.
- **Option B:** a real-time speech-to-speech API (e.g. OpenAI Realtime). It is billed per audio token: roughly $0.02 per minute of learner speech and $0.08 per minute of AI speech on the flagship model, lower on the mini model.
- **Rule:** keep A if the measured median response delay is under 1.5 s on a throttled 4G connection (spec AIC-01). Otherwise switch to B behind `ConversationEngine`.

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
