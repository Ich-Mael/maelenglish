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

### Programs (`programs/`)
Each program is a self-contained Express router mounted in `app.js`:

- **`programs/ekalan`** — High school academic platform. Mounted at `/programs/ekalan`. Contains a `kalan` feature (video-based courses) with a strict content hierarchy: `Class → Subject → Chapter → HSCourseVideo`. Content access is split free/premium by `videoType` on `HSCourseVideo`. Models live in `programs/ekalan/features/kalan/model.js`.

- **`programs/language-learning`** — English language programs. Mounted at `/programs/language-learning`. Sub-routes: `english4all`, `english4everyone`, `pecp`, `general-english-boost` (full course platform), `student-english-boost`. The General English Boost feature has a full admin CRUD UI. Two coexisting course structures:
  - Legacy: `Course → Module → (Practice | EngCourseVideo)` from `shared/models/courses.js`
  - Modern: `Course → Module → Lesson` with `Lesson` types `video | text | pdf | practice_quiz` from `programs/language-learning/models/` (supports `LessonProgress`, `QuizAttempt`, `AssignmentSubmission`)

### Shared core (`shared/`)
- `shared/models/user.js` — Single User model used across all programs. Carries program-specific flags (`isHighSchoolStudent`, `isClubMember`, `isPecpStudent`, `isVip`, etc.) and an embedded `specialProgram[]` array storing course enrollment with start/end dates.
- `shared/models/courses.js` — Course, Module, Practice, EngCourseVideo, Evaluation, Grade models (used by language-learning legacy structure).
- `shared/models/institution.js` — Institution model with branding (slug, primaryColor, logo) and course assignments.
- `shared/middlewares/auth.js` — `isLoggedIn`, `isVerified`, `isAdmin`, `checkRoles(rolesArray)`, `profileOwner`.
- `shared/middlewares/institutionAuth.js` — `isInstitutionAdmin` middleware for institution-scoped access control.
- `shared/middlewares/deviceTracker.js` — `trackDevice` middleware called after login; assigns a UUID cookie (`device_id`), records browser/OS/IP, and enforces `user.maxDevices` (default 3). Redirects to `/device-limit-reached` when exceeded.
- `shared/routes/account.js` — All account routes: register, login, logout, dashboard redirect, admin user management (CRUD + device management), password reset, and email activation.
- `shared/routes/adminInstitutions.js` — Institution CRUD, course assignment, and student management for global admins. Mounted at `/admin/institutions`.
- `shared/routes/adminCourses.js` — Global course management for admins. Mounted at `/admin/courses`.
- `shared/utilities/catchAsync.js` — Wraps async route handlers to forward errors to Express error handler.
- `shared/utilities/ExpressError.js` — Custom error class with `message` and `statusCode`.
- `shared/utilities/sendEmail.js` — `Emailer` class using Nodemailer via Brevo SMTP. Methods: `sendVerifyEmail()`, `sendPasswordReset()`, `sendEnrollmentEmail()`, `sendActivationEmail()`. Renders EJS templates from `views/emails/`.

### Views (`views/`)
Uses `ejs-mate` with layouts in `views/layouts/`. Partials in `views/partials/` (navbar, footer, flash). Additional view directories: `views/admin/` (user/institution/course management), `views/institution-dashboard/` (institution-scoped admin), `views/emails/` (email templates), `views/user/`. All flash messages and UI text are in **French**.

Global locals available in all views: `currentUser`, `success` (flash), `error` (flash), `isHomePage`.

## Key patterns

**Role system** — User roles: `user`, `account-manager`, `admin`, `super-admin`, `english-club-bm`, `english-club-admin`, `instructor`, `english-coach`, `student_manager`, `englishClub-boardMember`, `institution-admin`. Gate routes with `checkRoles(['admin', 'super-admin'])`. Both `admin` and `super-admin` have equivalent permissions; `institution-admin` is a separate scoped tier managed by `isInstitutionAdmin`.

**Institution (multi-tenant)** — Users can belong to an institution via `user.institutionId`. Institution admins manage their own student/course scopes via `/institution` dashboard. Global admins manage institutions at `/admin/institutions`.

**Course access** — `checkCourseAccess` middleware (`programs/language-learning/middlewares/courseAccess.js`) checks `user.specialProgram[]` for matching course title and validates start/end dates. Falls back to legacy `coursesTaken[]` membership without date checks.

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
APP_URL         # Base URL for email links (e.g. https://example.com)
EMAIL_FROM      # Sender address
EMAIL_HOST      # SMTP host (Brevo: smtp-relay.brevo.com)
EMAIL_PORT      # SMTP port (587)
EMAIL_USERNAME  # SMTP username
EMAIL_PASSWORD  # SMTP password
```
