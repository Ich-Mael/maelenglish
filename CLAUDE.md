# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # Start with nodemon (development)
npm start          # Start with node (production)
npm run clear-db   # Destroy ALL MongoDB collections (destructive — dev only)
```

No test suite is configured. The app runs on port 3000 by default (or `PORT` env var).

## Architecture

**Modular Monolith** — Express app with two independent programs, a shared core, and EJS views.

### Entry point: `app.js`
Sets up Express with Helmet CSP, rate limiting on auth routes (`authLimiter`, accessed via `req.app.get('authLimiter')`), session (MongoDB-backed via connect-mongo, 7-day expiry, lazy updates every 24h), Passport.js, flash messages, and mounts the two program routers. App exits on startup if `APP_DB` or `SECRET` are missing.

- **CSP** allows `'unsafe-inline'` for both `scriptSrc` and `scriptSrcAttr` — the EJS views rely on inline `onclick`/`onsubmit` handlers, so `scriptSrcAttr` must stay enabled or those silently break (Helmet defaults it to `'none'`).
- **Force-logout middleware** (after `flash()`): any live session whose `user.isActive === false` (soft-deleted) is immediately logged out and redirected to `/login`.

Also owns two public (no-auth) routes:
- `GET /` — home page; queries active `InstitutionCourse` counts for teaser section stats.
- `GET /formations` — public institution course catalog (search + filter). Strips HTML/entities from course fields via local `stripHtml()` helper before rendering.

`stripHtml(html)` is defined at the top of `app.js` — strips tags, decodes common French HTML entities. Use it whenever displaying institution course content outside the learning portal.

### Programs (`programs/`)
Each program is a self-contained Express router mounted in `app.js`:

- **`programs/ekalan`** — High school academic platform. Mounted at `/programs/ekalan`. Contains a `kalan` feature (video-based courses) with a strict content hierarchy: `Class → Subject → Chapter → HSCourseVideo`. Content access is split free/premium by `videoType` on `HSCourseVideo`. Models live in `programs/ekalan/features/kalan/model.js`.

- **`programs/language-learning`** — English language programs. Mounted at `/programs/language-learning`. Sub-routes: `english4all`, `english4everyone`, `pecp`, `general-english-boost` (full course platform), `student-english-boost`. The General English Boost feature has a full admin CRUD UI. Two coexisting course structures:
  - Legacy: `Course → Module → (Practice | EngCourseVideo)` from `shared/models/courses.js`
  - Modern: `Course → Module → Lesson` with `Lesson` types `video | text | pdf | practice_quiz` from `programs/language-learning/models/` (supports `LessonProgress`, `QuizAttempt`, `AssignmentSubmission`)

- **`programs/institution`** — Standalone course system for institution-managed content. Mounted at `/institution`. Fully independent models (`InstitutionCourse`, `InstitutionModule`, `InstitutionLesson`, etc.) and routes:
  - Admin: `/institution/dashboard/content/` — institution admins author and manage courses, modules, lessons, quizzes, assignments, final exams, and final projects
  - Student: `/institution/learn/` — students browse enrolled courses, view lessons, take quizzes/assignments, and submit final exams/projects
  - Auth: Uses `isInstitutionAdmin` + `loadInstitution` (admin) and `isInstitutionStudent` + `loadStudentInstitution` (student) from shared middleware
  - Enrollment: `InstitutionEnrollment` model (not embedded in User) with date windows and status tracking
  - Progress: `InstitutionLessonProgress`, `InstitutionQuizAttempt`, `InstitutionAssignmentSubmission`, `InstitutionFinalExamAttempt`, `InstitutionFinalProjectSubmission` models track student activity
  - Public catalog: `GET /formations` (no auth) — lists all active institution courses with search + filter. Rendered by `views/formations.ejs`. `GET /formations/:courseId` — public course detail page (`views/formations-show.ejs`); for a logged-in user it computes `isEnrolled` (active, in-window `InstitutionEnrollment`) and swaps the enroll-request form for an "Accéder au cours" CTA. `POST /formations/:courseId/enroll-request` short-circuits if the user is already enrolled.

### Shared core (`shared/`)
- `shared/models/user.js` — Single User model used across all programs. Carries program-specific flags (`isHighSchoolStudent`, `isClubMember`, `isPecpStudent`, `isVip`, etc.) and an embedded `specialProgram[]` array storing course enrollment with start/end dates. Soft-delete fields: `isActive` (default `true`; `false` = deactivated), `deactivatedAt`, `deactivatedBy`. **Treat `isActive` undefined as active** (legacy users predate the field) — only an explicit `false` blocks.
- `shared/models/courses.js` — Course, Module, Practice, EngCourseVideo, Evaluation, Grade models (used by language-learning legacy structure).
- `shared/models/institution.js` — Institution model with branding (slug, primaryColor, logo) and course assignments.
- `shared/middlewares/auth.js` — `isLoggedIn`, `isVerified`, `isAdmin`, `checkRoles(rolesArray)`, `profileOwner`.
- `shared/middlewares/institutionAuth.js` — `isInstitutionAdmin` middleware for institution-scoped access control. `checkInstitutionCourseAccess` gates student course access: requires an `InstitutionEnrollment` with `status === 'active'` (a `suspended` enrollment = no access) **and** within its start/end date window.
- `shared/middlewares/deviceTracker.js` — `trackDevice` middleware called after login; assigns a UUID cookie (`device_id`), records browser/OS/IP, and enforces `user.maxDevices` (default 3). Redirects to `/device-limit-reached` when exceeded.
- `shared/routes/account.js` — All account routes: register, login, logout, dashboard redirect, admin user management (create/list/edit/update/verify + device management), password reset, and email activation. Login uses a custom Passport callback that rejects deactivated accounts. Soft-delete: `DELETE /admin/users/:id` deactivates (sets `isActive=false` + suspends the user's active `InstitutionEnrollment`s with `suspendedReason: 'account-deactivated'`); `POST /admin/users/:id/restore` reverses it (only un-suspends enrollments tagged `account-deactivated`). No hard user delete exists.
- `shared/routes/adminInstitutions.js` — Institution CRUD, course assignment, and student management for global admins. Mounted at `/admin/institutions`.
- `shared/routes/adminCourses.js` — Global course management for admins. Mounted at `/admin/courses`.
- `shared/utilities/catchAsync.js` — Wraps async route handlers to forward errors to Express error handler.
- `shared/utilities/ExpressError.js` — Custom error class with `message` and `statusCode`.
- `shared/utilities/sendEmail.js` — `Emailer` class using Nodemailer via Brevo SMTP. Methods: `sendVerifyEmail()`, `sendPasswordReset()`, `sendEnrollmentEmail()`, `sendActivationEmail()`. Renders EJS templates from `views/emails/`. Templates are table-based with fully **inlined** styles and "bulletproof" buttons (solid `bgcolor` cell + inline `color` anchor) — never rely on `<style>` classes for button color, some clients strip them.
- `shared/utilities/url.js` — `getBaseUrl(req)` builds absolute URLs for email links. Priority: `APP_URL` env var → `X-Forwarded-Proto`+Host header → `req.protocol`+host. **Always use this** for links in emails; without `APP_URL` set, links fall back to the request Host (e.g. `*.onrender.com`).

### Views (`views/`)
Uses `ejs-mate` with layouts in `views/layouts/`. Partials in `views/partials/` (navbar, footer, flash, `preloader` — self-contained styles+markup+script, include right after `<body>`). The shared `navbar` partial hides the public "Formations" link when `currentUser` is set. Additional view directories: `views/admin/` (user/institution/course management), `views/institution-dashboard/` (institution-scoped admin), `views/emails/` (email templates), `views/user/`. All flash messages and UI text are in **French**.

Inside `.ejs`, write doc comments with `<%# ... %>`, **not** HTML `<!-- -->` — EJS still evaluates `<%- %>`/`<%= %>` tags inside HTML comments.

Global locals available in all views: `currentUser`, `success` (flash), `error` (flash), `isHomePage`.

## Key patterns

**Role system** — User roles: `user`, `account-manager`, `admin`, `super-admin`, `english-club-bm`, `english-club-admin`, `instructor`, `english-coach`, `student_manager`, `englishClub-boardMember`, `institution-admin`. Gate routes with `checkRoles(['admin', 'super-admin'])`. Both `admin` and `super-admin` have equivalent permissions; `institution-admin` is a separate scoped tier managed by `isInstitutionAdmin`.

**Institution (multi-tenant)** — Users can belong to an institution via `user.institutionId`. Institution admins manage their own student/course scopes via `/institution` dashboard. Global admins manage institutions at `/admin/institutions`.

**Course access** — `checkCourseAccess` middleware (`programs/language-learning/middlewares/courseAccess.js`) checks `user.specialProgram[]` for matching course title and validates start/end dates. Falls back to legacy `coursesTaken[]` membership without date checks.

**Account soft-delete** — There is no hard user deletion. Global admins deactivate accounts (`isActive=false`) via `DELETE /admin/users/:id`, which blocks login, force-logs-out live sessions, and suspends the user's active `InstitutionEnrollment`s (tagged `suspendedReason: 'account-deactivated'`). Restore reverses it, only un-suspending the tagged enrollments (so institution-initiated suspensions survive). All historical progress/grades/submissions are preserved. Admin UI: deactivate/restore buttons + "Désactivé" badge in `views/admin/users/list.ejs`.

**First-admin bootstrap** — If no admin exists in the DB, `POST /createaccount` automatically assigns `admin` role and skips email verification.

**Premium access (Kalan)** — Managed at the `Subject` level via `subject.premiumStudents[]` (price: `subject.premiumPrice`, default 2000 FCFA). Gate is `subjectPremiumAccess` (admins pass; others must be in `premiumStudents`), used on the premium chapter route `.../chapter/:id/PRE`. Individual `HSCourseVideo` documents have an `isPremium` flag defaulting based on `videoType` (e.g. `advanceEx`, `nationalExam`, `CIAM_Premium` are premium by default).

Student-facing brand for this per-subject tier is **"Kalan Ba"** (Bambara *ba* = big). Students request access in-app via the `views/partials/kalanPremiumCTA.ejs` partial (locked/pending/unlocked states; used on classHome, viewSubject, free-exercises) which creates a `PremiumRequest` (`{ studentId, subjectId, status }`, unique pending index). Admins manage requests per-subject at `GET .../subject/:id/premium` (manageSubjectPremium: pending requests + premium students w/ revoke + manual grant) and globally at `/admindashboard/kalan/premium-requests` (search/filter/pagination/FIFO + bulk approve-reject via `POST .../premium-requests/bulk`). Granting = pushing the HStudent id into `subject.premiumStudents`.

A second, **planned** tier **"Kalan Naaba"** (Mooré *naaba* = chief) — a class-wide bundle unlocking all subjects of a class at a 20% discount — is NOT built yet (intended as a class-level grant `Class.naabaStudents[]` + dynamic pricing).

**Rate limiting** — Applied only to auth routes (login, password reset, forgot-password): 20 attempts per 15-minute window.

## Environment variables

Required (app exits on startup if missing):
```
APP_DB          # MongoDB connection string
SECRET          # Session/cookie secret
```

Recommended (warnings logged if missing):
```
APP_URL         # Base URL for email links (e.g. https://www.afrohk.com). MUST be set in
                # production: without it, activation/reset/enrollment email links fall back
                # to the request Host (e.g. afrohk.onrender.com), which looks like phishing.
EMAIL_FROM      # Sender address
EMAIL_HOST      # SMTP host (Brevo: smtp-relay.brevo.com)
EMAIL_PORT      # SMTP port (587)
EMAIL_USERNAME  # SMTP username
EMAIL_PASSWORD  # SMTP password
ANTHROPIC_API_KEY  # Claude API key — required by the "Kalan Maths Lab" feature
                   # (programs/ekalan/features/kalan/mathsLab.js). Without it the
                   # step-by-step explanations fall back gracefully but won't generate.
MATHS_LAB_MODEL    # optional — Claude model for Kalan Maths Lab (default claude-haiku-4-5)
```

**Kalan Maths Lab (Kalan)** — formerly "Espace Maths"; student-facing brand is **Kalan Maths Lab** (a Kalan Ba / Kalan Naaba premium perk). `GET /programs/ekalan/kalan/class/:class_id/maths-lab`, gated by `mathsLabAccess` (active Maths Kalan Ba **or** Kalan Naaba). GeoGebra CAS (embedded, client-side) computes the authoritative answer + graph; `mathsLab.js` calls Claude (Haiku) to generate French worked steps **anchored to that answer**, rendered with KaTeX. Explanations are cached in the `MathExplanation` model (key = `function|operation|casResult`) so repeat questions cost nothing. The `/explain` JSON endpoint is rate-limited (`authLimiter`).

**LaTeX-in-JSON corruption (important):** Claude sometimes emits LaTeX with *lone* backslashes inside its JSON (`"\frac"`), and because `\f \b \n \r \t` are valid JSON escapes, `JSON.parse` silently turns `\frac` into `<formfeed>rac` (KaTeX then shows garbage — visible on fractions/√, e.g. integrals). `mathsLab.js` repairs this with `repairJsonBackslashes()` before parsing (escapes lone backslashes, keeps real `\\`); the controller's `cacheLooksCorrupted()` treats any cached entry whose LaTeX contains a control char as a miss and regenerates it (self-heals old corrupted cache rows).

The view (`views/programs/ekalan/Class/maths-lab.ejs`) has **six modes** via a `Fonctions` / `Nombres complexes` / `Géométrie` / `Limites` / `Intégrales` / `Trigonométrie` segmented toggle. Mode is carried to the server by a `domain` field on `/explain` (`'function'` default | `'complex'`; geometry rides on `'complex'`); the controller branches validation + cache key (`complex|expression|operation|casResult`) and `explainSteps({domain,input,operation,casResult,params})` picks the per-domain system prompt. **Complex mode** (operations in `COMPLEX_OPERATIONS`: `modulus`, `argument`, `conjugate`, `exp_form`, `power`, `nth_roots`, `arithmetic` w/ `ARITH_LABELS` sum/product/quotient — `power`/`nth_roots` need integer `n` 2–12, `arithmetic` needs `z2`; plus an **équation sub-section**: `solve_poly` solves `a·z³+b·z²+c·z+d=0` over ℂ via `CSolutions` (coefficients complex, `expression` = polynomial without `= 0`), and a **guided step-by-step workflow** with ops `eval_at` (f(z₀) via `Substitute`), `find_root` (scans `CSolutions` roots for a real/pure-imaginary one via `getXcoord`/`Numeric(Real/Imaginary(Element))`), `quotient` (Q(z) via `Div(f, z−z₀)`), `solve_quotient` (`CSolutions(Div(...)=0)`) — the z₀-dependent ops carry `z0` in the body and cache key (`<op>:<z0>`); the displayed answer is always the authoritative CAS result, never the model's) turns the GeoGebra panel into an **Argand plane** (a complex number renders natively as a point; the JS plots z₁ + position vector and result/roots points). **Géométrie mode** (`triangle_nature`, `quad_nature` in `COMPLEX_OPERATIONS`) lets students add N point affixes (3–6), plots the points + `Polygon` on the Argand plane, and **deterministically classifies** the figure client-side (triangle: équilatéral/isocèle/rectangle/rectangle isocèle/quelconque; quadrilatère: parallélogramme/rectangle/losange/carré/trapèze) from coordinates read via `getXcoord`/`getYcoord`; the computed nature is the anchored `casResult` Claude justifies (longueurs via |z_B−z_A|, angles via arg of quotients). Points are defined as real GeoGebra Points `(x,y)` (not complex literals) so `Polygon`/`Segment` accept them. **Limites mode** (function-domain `limit` op) lets students pick the target (a finite point, `+∞`, or `−∞`) and the side (bilatérale / à gauche / à droite) → GeoGebra `Limit`/`LimitAbove`/`LimitBelow`; the point+side ride in the `/explain` body (`point`, `side`) so the prompt is precise **and the cache key is `…|limit:<point><side>|…`** (distinct per target/side — otherwise two different points yielding the same value would collide). The function-mode "Limite en +∞" quick button also sends `point:'+∞'` so it shares that cache. **Intégrales mode** has a toggle: **Primitive** (op `integral`, indefinite, reuses the primitive prompt) or **Intégrale définie** (op `integral_def`, GeoGebra `Integral(f,a,b)` — which also shades the area on the graph) with bounds `a`/`b` that ride in the `/explain` body and cache key (`…|integral_def:<a>,<b>|…`); the prompt uses the fundamental theorem F(b)−F(a). **Fonctions mode — Tableau de variation** (op `variations` in `OPERATIONS`): a dedicated `runVariation()` (not the generic `run(op)`) builds the table **client-side** — local extrema via GeoGebra `Extremum(f,-50,50)` read as points, `Limit(f,±Infinity)` for the ends, sign/arrow per interval inferred from the y-values (not from reading f′ roots) — and renders a classic 3-row HTML `<table class="ml-vartable">` into the answer area, then posts a short anchored summary (`f'(x)=… ; extrema: … ; limites: …`) as `casResult` so Claude explains the method (`showSteps(data, true)` keeps the table instead of overwriting it with the model's answer). A flagship **Étude complète** button (op `study`) runs `runStudy()`: one click chains domain → parity (only asserted on a symmetric domain) → limits & asymptotes (vertical from poles, **horizontal and oblique** `y=ax+b` from far-sample slope/intercept, else *branche parabolique*) → derivative & variation table (embedded via the shared `variationTableHTML(pts, fp, info)` helper extracted from `renderVariationTable`) → points caractéristiques (f(0) + numeric roots of f). It renders a purple multi-section report and sends a compact anchored summary to Claude for the narrative étude. Oblique asymptotes use the textbook method — `a = lim f(x)/x`, `b = lim[f(x)−ax]` — computed numerically with a three-scale convergence check (a and b must agree across scales, else *branche parabolique*); the a/b working is shown in the report. The symbolic **f′(x)** comes from a small pure-JS differentiator (`dxTok`/`dxParse`/`dxDiff`/`dxSimp`/`dxStr` → `derivExpr`) because GeoGebra's CAS `Derivative` returns `?` here for many functions; GeoGebra CAS/`getValueString` is only a fallback. The result is shown in **simplified final form** via a polynomial expander (`dxPoly`/`dxPolyStr`/`dxPretty`): numerator collected, denominator kept factored (e.g. `(x²+4x+3)/(x+2)²`). The étude report renders every line with **KaTeX** (French labels in a serif font; math built as LaTeX via a `tx()` unicode→LaTeX helper). Section 5 embeds the visual variation table; the `study` prompt explicitly forbids Claude drawing its own tableau (cache key `study:v2`). Two more function ops complete the tier: **Tangente en x₀** (op `tangent`, needs an `x0` field; `runTangent()` computes f(x₀) and f′(x₀) numerically (central difference), shows `y = f'(x₀)(x−x₀)+f(x₀)`, plots the line `TLine` + point `TPt`; cache key `tangent:<x0>`) and **Convexité** (op `convexity`; `runConvexity()` gets f″ symbolically from the JS differentiator applied twice, studies its sign by finite-difference sampling — poles excluded, inflexion = sign change of f″ bracketed from the last definite-sign sample — and lists convexe/concave intervals + points d'inflexion). UI: **main topics (mode tabs) are brand purple, feature buttons (ops) are brand gold/amber.** A separate **Domaine de définition** button (op `domain`) runs `runDomain()`: it samples f, finds definedness transitions (√/ln edges — closed `[` if f is finite there, open `]` otherwise) and poles (rational exclusions), then builds D_f as a union of intervals (`ℝ` when unrestricted, `∅` when empty) and lists excluded values; Claude explains the existence conditions. **Vertical asymptotes (poles)** are detected during sampling (sign-flip with large magnitude, or an undefined sample with large finite neighbours), located via a root of `g(x)=1/f(x)`, and rendered as a **red double-bar** column with the **left limit placed left of the bar and the right limit right of it** (each high/low by sign), in red pill badges (x value in red); pole brackets are skipped in extremum detection. The table also shows the **domain** `D_f` (ℝ minus the poles, as a union of intervals), flags **horizontal asymptotes** (finite limit at ±∞) with a red badge on the end value + a note, and omits the `f'(x)=…` line when GeoGebra's CAS `Derivative` returns `?`. Also: complex-mode user input is run through `normCplx()` (inserts explicit `*` for implicit products like `4i(1-i)` → `4i*(1-i)`) before any GeoGebra call, and `setErrorDialogsActive(false)` suppresses stray GeoGebra error modals. **Cercle trigo mode** is a fully **self-contained interactive SVG** (no GeoGebra, no AI/`/explain`, no server call): pointer-move on the circle sets the angle; it shows cos/sin/tan (with the cos/sin/tan segments + projections + tangent line drawn), snaps to remarkable angles (multiples of 30°/45°) to display **exact values** (√3/2 etc.) via KaTeX, and renders a grid of useful trig formulas. **Trigonométrie mode** combines two things: (1) operation buttons — **Équation** (solve a trig equation on an interval, e.g. `cos(x)=1/2` on `]-π;π]`), **Linéarisation**, **Duplication** — handled by a new **`trig` domain** where **Claude computes the result itself** (no GeoGebra anchor; GeoGebra's trig CAS commands are unreliable here), so the controller does **not** require `casResult` for `domain==='trig'` (ops in `TRIG_OPERATIONS`, prompt `SYSTEM_PROMPT_TRIG`, cache key `trig|<op>|<expr>|<interval>`); and (2) the **interactive unit-circle card** (`#trig-circle-card`, self-contained SVG, ranges in ]−π,π], snaps to remarkable angles for exact values, 3-col formula grid). `switchMode('trig')` hides `#graph-card` and shows `#trig-circle-card`; trig operation results render in the shared answer/steps area. All GeoGebra calls (`abs`/`arg`/`Conjugate`/`CSolutions`/`Polygon`/`Limit*`/`setCoordSystem`, imaginary unit `i`) are client-side and try/catch-guarded; there is **no `ZoomFit` command** — auto-fit is done with `setCoordSystem` over the plotted points. **Inside the `scripts` template literal, never use regex backslash escapes** (`\d`, `\s`, `\.`, `\u…`) — the EJS literal strips one backslash level and silently breaks them; the limit code uses literal `∞`/`−` chars + `Number()` instead.
