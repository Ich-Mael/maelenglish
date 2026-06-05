# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # Start with nodemon (development)
npm start          # Start with node (production)
npm run clear-db   # Run database cleanup script
```

No test suite is configured. The app runs on port 3000 by default (or `PORT` env var).

## Architecture

**Modular Monolith** — Express app with two independent programs, a shared core, and EJS views.

### Entry point: `app.js`
Sets up Express with Helmet CSP, rate limiting on auth routes (`authLimiter`, accessed via `req.app.get('authLimiter')`), session (MongoDB-backed via connect-mongo), Passport.js, flash messages, and mounts the two program routers.

### Programs (`programs/`)
Each program is a self-contained Express router mounted in `app.js`:

- **`programs/ekalan`** — High school academic platform. Mounted at `/programs/ekalan`. Contains a `kalan` feature (video-based courses) with a strict content hierarchy: `Class → Subject → Chapter → HSCourseVideo`. Content access is split free/premium by `videoType` on `HSCourseVideo`. Models live in `programs/ekalan/features/kalan/model.js`.

- **`programs/language-learning`** — English language programs. Mounted at `/programs/language-learning`. Sub-routes: `english4all`, `english4everyone`, `pecp`, `general-english-boost` (full course platform), `student-english-boost`. The General English Boost feature has a full admin CRUD UI and uses a `Course → Module → (Practice | EngCourseVideo)` hierarchy from `shared/models/courses.js`.

### Shared core (`shared/`)
- `shared/models/user.js` — Single User model used across all programs. Carries program-specific flags (`isHighSchoolStudent`, `isClubMember`, `isPecpStudent`, etc.) and an embedded `specialProgram[]` array storing course enrollment with start/end dates.
- `shared/models/courses.js` — Course, Module, Practice, EngCourseVideo, Evaluation, Grade models (used by language-learning).
- `shared/middlewares/auth.js` — `isLoggedIn`, `isVerified`, `isAdmin`, `checkRoles(rolesArray)`, `profileOwner`.
- `shared/middlewares/deviceTracker.js` — `trackDevice` middleware called after login; assigns a UUID cookie (`device_id`) and enforces `user.maxDevices` (default 3). Redirects to `/device-limit-reached` when exceeded.
- `shared/routes/account.js` — All account routes: register, login, logout, dashboard redirect, admin user management (CRUD + device management), password reset, and email activation.
- `shared/utilities/catchAsync.js` — Wraps async route handlers to forward errors to Express error handler.
- `shared/utilities/ExpressError.js` — Custom error class with `message` and `statusCode`.
- `shared/utilities/sendEmail.js` — `Emailer` class using Nodemailer via Brevo SMTP. Renders EJS templates from `views/emails/`.

### Views (`views/`)
Uses `ejs-mate` with layouts in `views/layouts/`. Partials in `views/partials/` (navbar, footer, flash). Program views under `views/programs/ekalan/` and `views/programs/language-learning/`. All flash messages and UI text are in **French**.

Global locals available in all views: `currentUser`, `success` (flash), `error` (flash), `isHomePage`.

## Key patterns

**Role system** — User roles: `user`, `account-manager`, `admin`, `super-admin`, `english-club-bm`, `english-club-admin`, `instructor`, `english-coach`, `student_manager`, `englishClub-boardMember`. Gate routes with `checkRoles(['admin', 'super-admin'])`.

**Course access** — `checkCourseAccess` middleware (`programs/language-learning/middlewares/courseAccess.js`) checks `user.specialProgram[]` for matching course title and validates start/end dates. Falls back to legacy `coursesTaken[]` membership without date checks.

**First-admin bootstrap** — If no admin exists in the DB, `POST /createaccount` automatically assigns `admin` role and skips email verification.

**Premium access (Kalan)** — Managed at the `Subject` level via `subject.premiumStudents[]`. Individual `HSCourseVideo` documents have an `isPremium` flag defaulting based on `videoType` (e.g. `advanceEx`, `nationalExam`, `CIAM_Premium` are premium by default).

## Environment variables

Required in `.env`:
```
APP_DB          # MongoDB connection string
SECRET          # Session/cookie secret
EMAIL_FROM      # Sender address
EMAIL_HOST      # SMTP host (currently Brevo: smtp-relay.brevo.com)
EMAIL_PORT      # SMTP port (587)
EMAIL_USERNAME  # SMTP username
EMAIL_PASSWORD  # SMTP password
```
