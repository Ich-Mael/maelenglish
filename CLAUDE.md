@AGENTS.md

# CLAUDE.md

**MaelEnglish** — interactive, gamified English learning platform (slogan « Speak the Language of Your Profession »). Being **rewritten** from the old AfroHK Express/EJS app into Next.js. All UI text is in **French**.

## Commands

```bash
npm run dev     # Next.js dev server (http://localhost:3001)
npm run build   # production build — must pass before committing
npm run lint    # ESLint — must pass before committing
npm start       # serve the production build
npm test        # Vitest (tests/); model tests run on an in-memory MongoDB (mongodb-memory-server)
npm run typecheck
```

## Stack

Next.js 16 (App Router, `src/`), React 19, TypeScript, Tailwind CSS 4 + shadcn/ui (`components.json`, style base-nova, icons lucide), Mongoose (`src/lib/db.ts` → `connectDB()`, cached on `globalThis`, server-only). Planned: Motion, Rive / canvas-confetti / Howler (gamification feedback), dnd-kit + MediaRecorder (exercises), TanStack Query + Zustand, PWA. Auth is custom (see below). Hosting: Render (`render.yaml`, Node 22).

Next.js 16 differs from older versions — read `node_modules/next/dist/docs/` before using an API you're unsure about (see `AGENTS.md`).

## Data model (`src/models/`, import from `@/models`)

Mongoose 9 — **pre-hooks take no `next()`** (throw or `this.invalidate(...)` instead). Models are registered as `models.X || model(...)` (safe with Next.js hot reload); types via `InferSchemaType`.

- `User` — profile, roles and `passwordHash` (scrypt, `select: false`; empty until activation). Needs an **email OR a WhatsApp number**; `phoneE164` = `normalizePhone(phoneNumber)` (`src/lib/phone.ts`, default country 226), not unique (family phones). `username`/`email` lowercased, email unique + sparse. `ROLES`: user, english-coach, instructor, account-manager, admin, super-admin (`ADMIN_ROLES`, `STAFF_ROLES`, `hasRole`). Soft-delete: `isActive` (undefined = active, `isAccountActive`), `deactivatedAt/By`. Devices + `maxDevices` (3).
- `Course` — `program` = catalogue slug (validated against `PROGRAM_SLUGS`, `''` = none), `level`, `isPublished`, default cohort `startDate/endDate`, `instructors`, `finalExam`, `finalProject`, `isChallenge` + `challenge.themeLabel`.
- `Module` (`courseId`, `order`, `quiz`, `assignment`, `isCheckpointRequired`) → `Lesson` (`courseId`, `moduleId`, `order`, `type` video | text | pdf | practice_quiz). Children point to parents; no id arrays on parents.
- `Enrollment` — **the only source of course access** (replaces legacy `specialProgram`/`coursesTaken`/`students`): unique (userId, courseId), own `startDate`/`endDate` (null = open), `status` active | suspended | completed, `suspendedReason` (`account-deactivated` = lifted on account restore). `accessState(e, now)` → active | not-started | expired | suspended | completed.
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
- **Devices**: `me_device` cookie → `User.devices` (informational, never blocks — same as the legacy app). The learner sees and revokes sessions on `/compte`.
- Layers: `service.ts` (framework-free, unit-tested in `tests/auth.test.ts`), `session.ts` (cookies; only from Server Actions), `dal.ts` (`getCurrentUser` cached per render for Server Components, `readCurrentUser` uncached for Server Actions — sharing the render cache with an action trips a Next.js dev invariant; `requireUser`, `requireRole`), `src/app/(auth)/actions.ts`. `src/proxy.ts` only does optimistic redirects for `/compte`, `/admin`, `/mes-cours`, `/apprendre`; real checks are in the DAL.
- Cache Components: anything reading cookies, params or the current time sits inside `<Suspense>` (with `await connection()` before time-dependent queries). Don't use `useSearchParams()` in auth forms: it pushes them to client-only rendering (`useNextParam` in `login-form.tsx` reads `?next=` after hydration instead); `safeNext` blocks open redirects.
- Email: `src/lib/email.ts` (nodemailer, Brevo SMTP; simulation mode without `EMAIL_*`: links are logged in development).

## Public site (`src/app/(site)/`)

Route group with the shared header / footer (`src/components/site/`). Pages: `/` (storefront: hero, catalogue, « Testez-vous » mini quiz, method, stats, testimonials, CTA), `/programmes/[slug]` (all slugs prerendered via `generateStaticParams`; unknown slug → `notFound()`), `/coaching`. Plus `src/app/sitemap.ts`, `robots.ts`, `not-found.tsx`; JSON-LD (`components/site/json-ld.tsx`: EducationalOrganization on `/`, Course per programme). All public content comes from `src/lib/catalog.ts` (programmes) and `src/lib/content.ts` (method, stats, testimonials, coaching texts, `quizItems()`); `src/lib/site.ts` holds `SITE_URL` (from `APP_URL`, also used by `metadataBase`, sitemap, OG images), phone and WhatsApp links.
- Server Components by default; the only client pieces are `mini-quiz.tsx`, `phrase-flip.tsx` and `speak.tsx` (Web Speech API « écouter », hidden where unsupported). The header's account link reads the session inside `<Suspense>` (fallback = « Connexion »), so the pages stay prerendered. Mobile menu and FAQ use `<details>` (no JS).
- Photos: `<Photo>` (`components/site/photo.tsx`) renders the pre-sized WebP/JPEG files with a plain `<picture>` (no image optimiser). Catalogue icon names map to lucide components in `components/site/icons.tsx` (`ICONS`, plus `WhatsAppIcon`).
- UI primitives: `components/site/ui.tsx` (`Container`, `SectionHead`, `Pill`, `BUTTON` styles with the « pressable » 3D shadow, `WhatsAppButton`, `PhraseCard`). Feedback animations `animate-pop` / `animate-shake` / `animate-float` are defined in `globals.css` and disabled with `prefers-reduced-motion`.
- Enrolled learners still see « S'inscrire » on programme pages: the « Accéder à mon cours » switch comes with the learner app (phase 4).

Catalogue: `src/lib/catalog.ts` (`PROGRAMS`, `FORMAT`, `findProgram`, `formatFor`, `programPhoto`, `whatsappLink`; icons are lucide-react names). WhatsApp Cloud API client: `src/lib/whatsapp.ts` (server-only; simulation mode without token; only the enrolment template `maelenglish_inscription`).

## Brand

Tokens in `src/app/globals.css`: shadcn variables mapped to the brand (`primary` = blue #364fab, `accent` = coral) plus Tailwind colours `coral`, `coral-dark`, `coral-soft`, `brand`, `brand-dark`, `brand-deep`, `brand-soft`, `ink`, `success`, `xp`. Fonts (`next/font`): **Archivo** for headings (`font-heading`, applied to h1–h4), **Outfit** for body (`font-sans`). Images in `public/images/` (logos `maelenglish-logo*`, `-light` for dark backgrounds, OG image `maelenglish-og.jpg`) and `public/images/photos/<name>-{720,1280}.webp` + `-1280.jpg` (programme photos).

## Rewrite status

- `legacy/` = the old Express/EJS MaelEnglish app, **read-only reference** while porting (models, `catalog.js`, account/WhatsApp/notification flows, course engine). `legacy/CLAUDE.md` documents it in detail. Never run or import it from the new app; it is deleted at the end of the rewrite.
- E-Kalan, Institution and the AfroHK pages were removed and are not to be ported.
- URLs live at the root (`/`, `/programmes/[slug]`, `/coaching`, `/cours/...`); no redirects from the old `/maelenglish/*` URLs (the app had no users).
- Uses a **new, separate MongoDB database** (`APP_DB`), never the AfroHK one.
- Phases: 0 scaffold ✅ → 1 models & catalogue ✅ → 2 auth ✅ → 3 public site ✅ → 4 learner app & exercises → 5 gamification → 6 admin & instructor → 7 PWA & polish → 8 delete `legacy/`, deploy.

## Environment

See `.env.example`. Required: `APP_DB`, `SECRET`, `APP_URL`. Email via Brevo SMTP (`EMAIL_*`), WhatsApp Cloud API (`WHATSAPP_*`, simulation mode without token).
