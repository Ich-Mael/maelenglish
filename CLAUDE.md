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

**Premium access (Kalan)** — Managed at the `Subject` level via `subject.premiumStudents[]`. Individual `HSCourseVideo` documents have an `isPremium` flag defaulting based on `videoType` (e.g. `advanceEx`, `nationalExam`, `CIAM_Premium` are premium by default).

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
```
