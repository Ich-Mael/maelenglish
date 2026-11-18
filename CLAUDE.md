@AGENTS.md

# CLAUDE.md

**MaelEnglish** — interactive, gamified English learning platform (slogan « Speak the Language of Your Profession »), built around its founder Ismaël Zerbo (« Coach Ish »). Next.js app, installable as a PWA. All UI text is in **French**; learners are mostly French-speaking professionals in West Africa, often on low-end Android phones with expensive data — keep pages light.

## Commands

```bash
npm run dev     # Next.js dev server (http://localhost:3001)
npm run build   # production build — must pass before committing
npm run lint    # ESLint — must pass before committing
npm start       # serve the production build
npm test        # Vitest (tests/); model tests run on an in-memory MongoDB (mongodb-memory-server)
npm run typecheck
npm run seed:demo   # demo courses + accounts demo / demo-coach / demo-admin, password « anglais2026 » (refuses an APP_DB containing « afrohk »)
```

## Stack

Next.js 16 (App Router, `src/`), React 19, TypeScript, Tailwind CSS 4 + shadcn/ui (`components.json`, style base-nova, icons lucide), Mongoose (`src/lib/db.ts` → `connectDB()`, cached on `globalThis`, server-only). Motion (`motion/react`), dnd-kit, react-markdown + remark-gfm (lesson text, no raw HTML). canvas-confetti, Zustand (reward queue). Feedback sounds are synthesised with Web Audio (no audio files). Auth is custom (see below). Service worker hand-written (`public/sw.js`). Hosting: Render (`render.yaml`, Node 22) — see Deployment.

Next.js 16 differs from older versions — read `node_modules/next/dist/docs/` before using an API you're unsure about (see `AGENTS.md`).

## Data model (`src/models/`, import from `@/models`)

Mongoose 9 — **pre-hooks take no `next()`** (throw or `this.invalidate(...)` instead). Models are registered as `models.X || model(...)` (safe with Next.js hot reload); types via `InferSchemaType`.

- `User` — profile, roles and `passwordHash` (scrypt, `select: false`; empty until activation). Needs an **email OR a WhatsApp number**; `phoneE164` = `normalizePhone(phoneNumber)` (`src/lib/phone.ts`, default country 226), not unique (family phones). `username`/`email` lowercased, email unique + sparse. `ROLES`: user, english-coach, instructor, account-manager, admin, super-admin (`ADMIN_ROLES`, `STAFF_ROLES`, `hasRole`). Soft-delete: `isActive` (undefined = active, `isAccountActive`), `deactivatedAt/By`. Devices + `maxDevices` (3).
- `Course` — `program` = catalogue slug (validated against `PROGRAM_SLUGS`, `''` = none), `level`, `isPublished`, default cohort `startDate/endDate`, `instructors`, `finalExam`, `finalProject`, `isChallenge` + `challenge.themeLabel`.
- `Module` (`courseId`, `order`, `quiz`, `assignment`, `isCheckpointRequired`) → `Lesson` (`courseId`, `moduleId`, `order`, `isPublished`, `type` video | text | pdf | practice; `content` = Markdown; practice lessons hold `exercises[]`, see Learner app). Children point to parents; no id arrays on parents.
- `Enrollment` — **the only source of course access** (one record per learner and course): unique (userId, courseId), own `startDate`/`endDate` (null = open), `status` active | suspended | completed, `suspendedReason` (`account-deactivated` = lifted on account restore). `accessState(e, now)` → active | not-started | expired | suspended | completed.
- `LessonProgress`, `QuizAttempt`, `AssignmentSubmission` (`src/models/Progress.ts`), `TeachingResource` (staff material per module).
- `Session`, `AuthToken`, `RateLimit` (`src/models/Auth.ts`) — see Auth. All three have TTL indexes on `expiresAt`, but code always re-checks `expiresAt` (TTL deletion is lazy).
- Quiz questions (`src/models/shared.ts`): `options: [{ id, text }]` (≥ 2), `correctOptionId` must match an option.

## Auth (custom, `src/lib/auth/`)

No auth library: Better Auth needs an email per account, and many learners only have WhatsApp.
- **No self sign-up.** Staff create accounts without a password (`accounts.ts` → `createAccount`, returns an activation token); the person opens `/activer/<token>` (7 days) and chooses a password. The link is emailed when the account has an email, otherwise staff pass it on by hand. **Passwords never go through WhatsApp** (no WhatsApp activation or reset-code messages).
- **First admin**: `/installation`, open only while no admin / super-admin exists (`bootstrapAdmin`).
- **Role rules** (`assignableRoles`): admins assign user, english-coach, instructor, account-manager; account managers only user, english-coach; admin / super-admin are granted only in the database.
- **Login** (`/connexion`) by username, email or WhatsApp number (`findByIdentifier`; a number shared by several accounts asks for the username). Rate-limited in MongoDB (`hitRateLimit`: 30 / 15 min per IP, 10 per identifier).
- **Forgotten password** (`/mot-de-passe-oublie`): email link `/reinitialiser/<token>` (1 h); same answer whether or not the account exists; learners without email ask the team on WhatsApp (staff use `issueResetForUser`).
- **Sessions**: random token in the `me_session` cookie (httpOnly, lax), only its sha256 stored in `Session`; 30 days, extended daily (`validateSession`) and the cookie's lifetime is refreshed by `src/proxy.ts`. A password change / reset signs out the other sessions; deactivation (`deactivateUser`) signs out everywhere and suspends enrolments (`restoreUser` lifts only those tagged `account-deactivated`).
- **Devices**: `me_device` cookie → `User.devices` (informational, never blocks). The learner sees and revokes sessions on `/compte`.
- Layers: `service.ts` (framework-free, unit-tested in `tests/auth.test.ts`), `session.ts` (cookies; only from Server Actions), `dal.ts` (`getCurrentUser` cached per render for Server Components, `readCurrentUser` uncached for Server Actions — sharing the render cache with an action trips a Next.js dev invariant; `requireUser`, `requireRole`), `src/app/(auth)/actions.ts`. `src/proxy.ts` only does optimistic redirects for the private areas (`/compte`, `/admin`, `/mes-cours`, `/apprendre`, `/progression`); real checks are in the DAL. `getCurrentUser` calls `connection()` (session expiry depends on the clock — avoids prerender errors).
- Cache Components: anything reading cookies, params or the current time sits inside `<Suspense>` (with `await connection()` before time-dependent queries). Don't use `useSearchParams()` in auth forms: it pushes them to client-only rendering (`useNextParam` in `login-form.tsx` reads `?next=` after hydration instead); `safeNext` blocks open redirects.
- Email: `src/lib/email.ts` (nodemailer, Brevo SMTP; simulation mode without `EMAIL_*`: links are logged in development).

## Public site (`src/app/(site)/`)

Route group with the shared header / footer (`src/components/site/`). Pages: `/` (storefront: hero, catalogue — Essentials featured card + job programmes in a `Carousel` (`components/site/carousel.tsx`: native scroll-snap, arrows / progress bar / edge fades driven by a ResizeObserver + scroll listener, works without JS) —, « Votre coach », method, stats, testimonials, CTA), `/programmes/[slug]` (all slugs prerendered via `generateStaticParams`; unknown slug → `notFound()`), `/coaching`. Plus `src/app/sitemap.ts`, `robots.ts`, `not-found.tsx`; JSON-LD (`components/site/json-ld.tsx`: EducationalOrganization on `/`, Course per programme). All public content comes from `src/lib/catalog.ts` (programmes) and `src/lib/content.ts` (method, stats, testimonials, coaching texts, `FOUNDER`); `src/lib/site.ts` holds `SITE_URL` (from `APP_URL`, also used by `metadataBase`, sitemap, OG images), phone and WhatsApp links.
- Programme names and the hero's « Speak the Language of » use the logo blue (`text-primary`, #364fab); « Your Profession » stays logo red. Don't put `.reveal` inside the carousel (a view() timeline would follow the horizontal scroller).
- **Personal branding**: the founder Ismaël Zerbo is the face of the brand — portrait `public/images/photos/founder-{720,1280}.webp` + `-1280.jpg` (generated with sharp from the original PNG) in the home hero, the « Votre coach » section (`components/site/founder.tsx`, after the catalogue: light background, sticky portrait with TEFL badge and name card, mission, 3 fact tiles, the three story paragraphs as a timeline titled « Mon parcours / Mes résultats / Pourquoi MaelEnglish », quote card, WhatsApp + coaching buttons) and the coaching hero (`FounderCard`); `FOUNDER` (name, « Coach Ish » nickname, title, story, facts, quote) holds his own texts — edit them there.
- Server Components by default; the only client pieces are `phrase-flip.tsx` and `speak.tsx` (Web Speech API « écouter », hidden where unsupported). The header's account link reads the session inside `<Suspense>` (fallback = « Connexion »), so the pages stay prerendered. The header turns navy once scrolled (`scroll-header.tsx`, `data-scrolled` + `group-data-[scrolled=true]/hdr:` variants; light wordmark `maelenglish-mark-light.webp` swapped in). The hero shows the logo only once (in the header). Mobile menu and FAQ use `<details>` (no JS).
- Photos: `<Photo>` (`components/site/photo.tsx`) renders the pre-sized WebP/JPEG files with a plain `<picture>` (no image optimiser). Catalogue icon names map to lucide components in `components/site/icons.tsx` (`ICONS`, plus `WhatsAppIcon`).
- UI primitives: `components/site/ui.tsx` (`Container`, `SectionHead`, `Pill`, `BUTTON` styles with the « pressable » 3D shadow, `WhatsAppButton`, `PhraseCard`). Feedback animations `animate-pop` / `animate-shake` / `animate-float` are defined in `globals.css` and disabled with `prefers-reduced-motion`. Home motion is CSS only: `.hero-in` (children slide up in sequence on load) and `.hero-photo` (transform only — it's the LCP element), `.reveal` (scroll-driven `animation-timeline: view()`, no JS; unsupported browsers just show content). Put `.reveal` on a wrapper, never on an element with a hover transform. `SectionHead` reveals by default. **Never wrap `.reveal` or `sticky` elements in `overflow-hidden`** (it becomes their scroll container: view() timelines freeze and sticky stops working) — use `overflow-clip` to clip decorative glows.

## Learner app (`src/app/(app)/`)

Signed-in shell (`(app)/layout.tsx`: top bar on desktop, bottom tab bar on phones). Pages: `/mes-cours` (enrolments + progress; welcome banner after activation), `/apprendre/[courseId]` (course map: modules → lesson nodes, quiz, assignment, finals; « Continuer » = `outline.next`), `/apprendre/[courseId]/lecons/[lessonId]` (video / text / PDF + « J'ai terminé », or the practice player), `/modules/[moduleId]/quiz`, `/modules/[moduleId]/devoir`, `/examen`, `/projet`, `/progression`, `/compte`. Login and activation land on `/mes-cours`; programme pages show « Accéder à mon cours » to enrolled learners (`components/site/enrolled-cta.tsx`).
- **Access** (`src/lib/learn/queries.ts`, server-only): `courseAccess(me, courseId)` — learners need an `Enrollment` whose `accessState` is active (or completed = read-only) on a published course; staff (`isStaff`) preview everything and **nothing is saved**. `courseTree` loads modules, published lessons, progress, best quiz scores, submissions and computes the outline. Every page and action re-checks access and that the step is open.
- **Progression** (`src/lib/learn/progress.ts`, pure, `tests/progress.test.ts`): lessons open one after another; the module quiz opens when the module's lessons are done; module N+1 opens when module N is complete (lessons + quiz passed); assignments open with their module; final exam / project open when every module is complete. Challenge courses (`isChallenge`): day N opens N−1 days after the enrolment start (time ceiling) and only once the previous checkpoint (module assignment, `isCheckpointRequired`) is graded.
- **Exercises** (`src/lib/learn/exercises.ts`, shared by browser and server): kinds `choice`, `build` (tap words), `order` (dnd-kit), `match`, `listen` (dictation, speech synthesis or `audioUrl`), `speak` (MediaRecorder + SpeechRecognition when available, else self-check; « Passer » when there's no mic), `gap` (`___`). `checkExercise` grades, `exerciseProblem` validates definitions (model pre-validate), shuffles are seeded (`seededShuffle`, no hydration mismatch). Player: `components/learn/practice/player.tsx` (check → feedback → missed exercises come back once; first tries are sent to `submitPractice`, regraded server-side → `LessonProgress.practiceScore`).
- **Graded quizzes** (module quiz, final exam): questions are sent **without answers**; `submitQuiz` grades on the server (`gradeQuiz`), stores a `QuizAttempt`, returns the review. Optional time limit is enforced client-side only (auto-submit).
- **Assignments** (module assignment / challenge checkpoint / final project): `submitAssignment` upserts one `AssignmentSubmission` (resubmitting resets it to pending; graded ones are locked).
- Actions live in `src/app/(app)/learn-actions.ts` and call `refresh()` after writes. Paths: `src/lib/learn/paths.ts`; step order: `src/lib/learn/sequence.ts`; video links → embeds (YouTube nocookie / Vimeo / files): `src/lib/learn/media.ts`.

## Gamification (`src/lib/gamification/`, `src/components/gamify/`)

- **Rules** (`rules.ts`, pure, `tests/gamification.test.ts`): XP per step (`XP`: lesson 10, practice 10 + score bonus + 5 if perfect, practice replay 5 once per lesson per day, quiz pass 25 (+10 perfect), final exam 100, assignment sent 15, assignment validated by a coach 20, daily goal reached +10); levels `levelThreshold(n) = 25·(n−1)·n` (0, 50, 150, 300…); daily streak (`nextStreak` / `displayStreak`, days in `APP_TZ`, default Africa/Ouagadougou); daily goal 10/20/30/50 XP; `BADGES` defined in code from counters; `publicName` = first name + initial (leaderboards).
- **Service** (`service.ts`, framework-free): `award(userId, items)` — each item has an idempotent `key` (unique `XpEvent` per user: `lesson:<id>`, `quiz:<moduleId>`, `exam:<courseId>`, `assignment:<course>:<module>`, `goal:<day>`…), updates `UserStats` (xp, streak, longest, today's XP, counters) and grants `UserBadge`s; returns a `Reward` (xp gained, level-up, streak, goal, new badges). `statsFor`, `badgesFor`, `xpByDay`, `weeklyLeaderboard(courseId)` (XP since Monday, top 10 + the learner).
- Called from `learn-actions.ts` after saved steps only (never in staff preview; failures are logged and never block learning). Actions return the reward; client screens call `pushReward` → `RewardCenter` (in the app shell, survives navigation): XP toast, level-up / badge dialogs with confetti and sounds. `playSound` / `confetti` / mute toggle in `components/gamify/sound.ts` (mute stored per device).
- UI: header `StatsBar` (streak flame, daily-goal ring, level → `/progression`), `/progression` (level, streak, goal picker, 7-day chart, badges), weekly `Leaderboard` on the course page. Models: `XpEvent`, `UserStats`, `UserBadge` (`src/models/Gamification.ts`).

## Admin & instructor (`src/app/admin/`)

Separate shell (sidebar, role-aware `AdminNav`). Pages: `/admin` (dashboard), `/admin/utilisateurs` (search, filters, pagination), `/nouveau` (create → activation link to copy, emailed if the account has an email, optional « Ouvrir WhatsApp » share link opened by the staff member — no automatic WhatsApp message), `/[userId]` (profile, role, new activation / reset link, deactivate / restore, devices, enrolments); `/admin/cours` (+ `/nouveau`), `/[courseId]` (modules: add / move / delete; info; team; delete), `/modules/[moduleId]` (lessons, quiz editor, assignment / checkpoint, module settings, teaching resources), `/lecons/[lessonId]` (lesson editor: Markdown with preview, video / PDF links, exercise editor for the 7 kinds with live validation), `/final` (final exam + project), `/inscriptions` (enrol by username / email / number with optional notification — WhatsApp enrolment template if configured, else email —, dates, status, remove); `/admin/corrections` (queue by status) + `/[submissionId]` (validate with optional grade, or return with mandatory feedback).
- **Permissions** (`src/lib/admin/permissions.ts`, pure, `tests/permissions.test.ts`): admin / super-admin everything; account-manager users + enrolments; instructor / english-coach content, grading and resources only for courses listing them in `Course.instructors`. Pages use `requireStaff` / `courseFor(me, id, need)` (`src/lib/admin/context.ts`); every action in `src/app/admin/actions.ts` re-checks.
- **Services** (framework-free, `tests/admin.test.ts`): `users.ts` (`updateAccount` with role rules, `listUsers`, `revokeDevice`), `content.ts` (courses, modules, lessons, ordering by swap, `saveQuiz`, `saveAssignment`, resources; new lessons are drafts; a course with enrolments can't be deleted), `enrollments.ts`, `grading.ts` (`gradeSubmission`: validating awards the learner `XP.assignmentGraded` = 20 once — key `graded:<submissionId>` — and unlocks the next challenge day). Mongoose validation errors become French messages via `errorMessage`.
- Files (PDF, images, audio) are links for now: no upload storage yet.

## PWA, offline & accessibility

- **Installable**: `src/app/manifest.ts` (start `/mes-cours?source=pwa`, standalone, shortcuts), icons generated by `node scripts/make-icons.mjs` (vector « M » of the logo in logo blue + red bar/toggle → `public/icons/*`, `src/app/icon.png`, `apple-icon.png`; maskable variant with safe zone). `InstallPrompt` card on `/mes-cours` (Android native prompt, iOS instructions).
- **Service worker** `public/sw.js` (registered in production only by `RegisterServiceWorker`; served with no-cache headers from `next.config.ts`): static assets cache-first; navigations network-first, keeping the last copy of learner / public pages (never admin, account or auth pages); fallback `public/offline.html` (plain HTML, no Next.js scripts — a Next page would break offline when its chunks aren't cached). Bump `VERSION` when changing caching. « Disponible hors ligne » (`DownloadCourse` on the course page) asks the worker to fetch every lesson of the open modules plus their `/_next/static` assets; those requests carry `X-ME-Offline: 1`, which lets the lesson page render lessons locked only by the in-module order.
- **Offline results**: `completeLesson` / `submitPractice` failing for lack of network are queued in localStorage (`components/pwa/offline-queue.ts`) and replayed in order by `OfflineSync` (app shell banner) when back online — the server re-checks each step. Logout (`LogoutButton`) clears the queue and cached pages (shared devices).
- **Colours / contrast**: the logo red `#ff5757` (`coral`) is used as is (user decision). **No solid red backgrounds** (user decision): buttons, cards and badges are **white with a red border** (`border-2 border-coral bg-white`, pressable red edge `shadow-[0_Npx_0_0_var(--color-coral)]`, hover `bg-coral-soft`). Red text on white has 3.1:1, so it must be large (≥ 19px bold — `BUTTON.coral` = `text-[19px] font-bold text-coral` — or ≥ 24px); small red text uses `coral-dark` `#b02a2a`. Exception: the mic button is solid `destructive` red while recording (live-mic alert). `success` `#12855a`. No `blur-3xl` blobs or header `backdrop-blur` (expensive on low-end Android): decorative glows are radial gradients. Above-the-fold photos are preloaded (`<Photo eager>`).
- Lighthouse mobile (prod build): accessibility 100 on public and learner pages; performance 88–96. Privacy policy: `/confidentialite` (owner must complete the [bracketed] legal entity, contact email and retention period).

Catalogue: `src/lib/catalog.ts` (`PROGRAMS`, `FORMAT`, `findProgram`, `formatFor`, `programPhoto`, `whatsappLink`; icons are lucide-react names). WhatsApp Cloud API client: `src/lib/whatsapp.ts` (server-only; simulation mode without token; only the enrolment template `maelenglish_inscription`).

## Brand

Tokens in `src/app/globals.css`: shadcn variables mapped to the brand (`primary` = blue #364fab, `accent` = coral) plus Tailwind colours `coral` (logo red), `coral-dark`, `coral-soft`, `brand`, `brand-dark`, `brand-deep`, `brand-soft`, `ink`, `success`, `xp`. Fonts (`next/font`): **Archivo** for headings (`font-heading`, applied to h1–h4), **Outfit** for body (`font-sans`). Images in `public/images/` (logos `maelenglish-logo*`, `-light` for dark backgrounds, OG image `maelenglish-og.jpg`) and `public/images/photos/<name>-{720,1280}.webp` + `-1280.jpg` (programme photos).

## Conventions & history

- URLs live at the root in French (`/programmes/[slug]`, `/coaching`, `/connexion`, `/mes-cours`, `/apprendre/...`, `/admin/...`). The app replaced the MaelEnglish part of the old AfroHK Express/EJS monolith (deleted; still in git history before the « remove legacy » commit). It had no users, so there are no redirects from old URLs and the database is **new and separate** (`APP_DB`, never the AfroHK one — the server refuses to start with an AfroHK `APP_DB`).
- Public figures must be verifiable (no invented stats); founder texts in `FOUNDER` are his own words.
- Product decisions: no self sign-up (staff create accounts); no WhatsApp messages for passwords; coach validation = +20 XP; app icon = logo « M » in blue with the red bar/toggle.
- Before committing: `npm run lint`, `npm test`, `npm run build`. Tests touching the database use `mongodb-memory-server`; never point a script at a real database without checking `APP_DB`.

## Environment

See `.env.example`. Required: `APP_DB`, `APP_URL` (prod: the final https domain — baked into email links, sitemap, share images). Optional: `APP_TZ` (default Africa/Ouagadougou), Brevo SMTP (`EMAIL_*`), WhatsApp Cloud API (`WHATSAPP_*`, simulation mode without token). Local: put overrides in `.env.local` (wins over `.env`). `src/instrumentation-node.ts` checks the configuration at startup (exits without `APP_DB`, warns about missing production settings).

## Deployment (Render)

`render.yaml` Blueprint: web service, Frankfurt, `npm ci && npm run build`, `npm start`, health check `GET /api/health` (200 when MongoDB answers within 3 s, else 503). Secrets (`APP_DB`, `APP_URL`, `EMAIL_*`, `WHATSAPP_*`) are `sync: false` — set them in the Render dashboard. After the first deploy: open `/installation` to create the first admin, then link the custom domain (HTTPS). Use a paid instance (the free plan sleeps).

Next: **Play Store** (Trusted Web Activity, after the final domain is live): `/.well-known/assetlinks.json`, Play developer account, store listing + data-safety form, privacy policy link, « store mode » hiding sign-up / payment buttons inside the app.
